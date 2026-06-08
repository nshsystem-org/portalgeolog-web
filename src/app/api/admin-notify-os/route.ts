/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "edge";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getAdmin = () => {
  if (!_supabaseAdmin)
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  return _supabaseAdmin;
};

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function numeroParaOrdinal(n: number): string {
  const unidades = [
    "",
    "Primeiro",
    "Segundo",
    "Terceiro",
    "Quarto",
    "Quinto",
    "Sexto",
    "Sétimo",
    "Oitavo",
    "Nono",
  ];
  const especiais: Record<number, string> = {
    10: "Décimo",
    11: "Décimo Primeiro",
    12: "Décimo Segundo",
    13: "Décimo Terceiro",
    14: "Décimo Quarto",
    15: "Décimo Quinto",
    16: "Décimo Sexto",
    17: "Décimo Sétimo",
    18: "Décimo Oitavo",
    19: "Décimo Nono",
  };
  const dezenas: Record<number, string> = {
    2: "Vigésimo",
    3: "Trigésimo",
    4: "Quadragésimo",
    5: "Quinquagésimo",
    6: "Sexagésimo",
    7: "Septuagésimo",
    8: "Octogésimo",
    9: "Nonagésimo",
  };
  if (n >= 1 && n <= 9) return unidades[n];
  if (n >= 10 && n <= 19) return especiais[n] || "";
  if (n >= 20 && n <= 99) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    const dt = dezenas[d] || "";
    const ut = u > 0 ? unidades[u] : "";
    if (dt && ut) return `${dt} ${ut}`;
    return dt || ut || String(n);
  }
  if (n === 100) return "Centésimo";
  return String(n);
}

async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const authClient = await createAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { osId } = body;

    if (!osId) {
      return NextResponse.json(
        { error: "osId é obrigatório" },
        { status: 400 },
      );
    }

    const resend = createResendClient();
    if (!resend) {
      return NextResponse.json(
        { error: "RESEND_API_KEY não configurada" },
        { status: 500 },
      );
    }

    const supabaseAdmin = getAdmin();

    // Buscar dados completos da OS
    const { data: osData, error: osError } = await supabaseAdmin
      .from("ordens_servico")
      .select("*")
      .eq("id", osId)
      .single();

    if (osError || !osData) {
      return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
    }

    // Buscar dados relacionados
    const [
      { data: clienteData },
      { data: driversData },
      { data: vehiclesData },
    ] = await Promise.all([
      supabaseAdmin
        .from("clientes")
        .select("*")
        .eq("id", (osData as any).cliente_id)
        .maybeSingle(),
      (osData as any).motorista
        ? supabaseAdmin
            .from("drivers")
            .select("*")
            .eq("name", (osData as any).motorista)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      (osData as any).veiculo_id
        ? supabaseAdmin
            .from("veiculos")
            .select("*")
            .eq("id", (osData as any).veiculo_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const cliente = (clienteData as any)?.nome || "Empresa não informada";
    const centroCusto =
      (clienteData as any)?.centros_custo?.find(
        (cc: any) => cc.id === (osData as any).centro_custo_id,
      )?.nome || "Não informado";
    const driverPhone = (driversData as any)?.phone || "Não informado";
    const vehicleInfo = vehiclesData || {
      tipo: "",
      placa: "",
      marca: "",
      modelo: "",
    };
    const tipoCapitalizado = vehicleInfo.tipo
      ? vehicleInfo.tipo.charAt(0).toUpperCase() + vehicleInfo.tipo.slice(1)
      : "Não informado";

    // Buscar waypoints e passageiros
    const { data: waypointsData } = await supabaseAdmin
      .from("os_waypoints")
      .select("*")
      .eq("ordem_servico_id", osId)
      .order("position");

    // Montar lista de passageiros
    const allPassengers: { nome: string; celular: string }[] = [];
    if (waypointsData) {
      for (const wp of waypointsData as any[]) {
        const { data: wpPassengers, error: wpPassError } = await supabaseAdmin
          .from("os_waypoint_passengers")
          .select("passageiro_id")
          .eq("waypoint_id", wp.id);

        if (wpPassError) {
          console.error(
            "Erro ao buscar passageiros do waypoint:",
            wp.id,
            wpPassError,
          );
          continue;
        }

        if (wpPassengers) {
          for (const wpPass of wpPassengers as any[]) {
            const { data: passRecord, error: passError } = await supabaseAdmin
              .from("passageiros")
              .select("*")
              .eq("id", wpPass.passageiro_id)
              .maybeSingle();

            if (passError) {
              console.error(
                "Erro ao buscar dados do passageiro:",
                wpPass.passageiro_id,
                passError,
              );
              continue;
            }

            if (
              passRecord &&
              !allPassengers.some(
                (x) => x.nome === (passRecord as any).nome_completo,
              )
            ) {
              allPassengers.push({
                nome: (passRecord as any).nome_completo,
                celular: (passRecord as any).celular
                  ? (passRecord as any).celular.replace(
                      /(\d{2})(\d{5})(\d{4})/,
                      "($1) $2-$3",
                    )
                  : "Não informado",
              });
            }
          }
        }
      }
    }

    const paxText =
      allPassengers.length > 0
        ? allPassengers
            .map(
              (p) =>
                `<li>${p.nome}${p.celular !== "Não informado" ? ` – ${p.celular}` : ""}</li>`,
            )
            .join("")
        : "<li>Não informado</li>";

    // Montar itinerário
    let itineraryText = "";
    if (waypointsData && (waypointsData as any[]).length > 0) {
      const itineraries = new Map<number, any[]>();
      (waypointsData as any[]).forEach((wp) => {
        const index =
          typeof wp.itinerary_index === "number" ? wp.itinerary_index : 0;
        if (!itineraries.has(index)) itineraries.set(index, []);
        itineraries.get(index)?.push(wp);
      });

      itineraryText = Array.from(itineraries.entries())
        .map(([idx, wps]) => {
          const firstWp = wps[0];
          const itData = firstWp?.data || (osData as any).data;
          const itHora = firstWp?.hora || (osData as any).hora;
          const dateTimeLine = itData
            ? ` — ${itData.split("-").reverse().join("/")}${itHora ? ` - ${itHora.slice(0, 5)}` : ""}`
            : itHora
              ? ` — ${itHora.slice(0, 5)}`
              : "";
          const itTitle =
            idx < 0
              ? `${numeroParaOrdinal(Math.abs(idx))} Retorno${dateTimeLine}`
              : `${numeroParaOrdinal(idx + 1)} Itinerário${dateTimeLine}`;

          const stops = wps
            .map((w: any, relIdx: number) => {
              const label = w.label?.trim() || "Não informado";
              const comment = w.comment?.trim();
              let line = "";
              if (relIdx === 0) line = `<strong>Origem:</strong> ${label}`;
              else if (relIdx === wps.length - 1)
                line = `<strong>Destino Final:</strong> ${label}`;
              else line = `<strong>Parada ${relIdx}:</strong> ${label}`;
              if (comment)
                line += `<br><em style="color: #64748b; font-size: 13px;">Obs: ${comment}</em>`;
              return `<li style="margin-bottom: 8px;">${line}</li>`;
            })
            .join("");

          return `<div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; font-weight: bold;">${itTitle}</h4>
          <ul style="margin: 0; padding-left: 20px; list-style: none;">${stops}</ul>
        </div>`;
        })
        .join("");
    }

    // Formatação de data/hora
    const firstItWp = waypointsData?.[0];
    const firstItData = firstItWp?.data || osData.data;
    const firstItHora = firstItWp?.hora || osData.hora;
    const dataHoraHeaderParts: string[] = [];
    if (firstItData)
      dataHoraHeaderParts.push(
        `Data: ${firstItData.split("-").reverse().join("/")}`,
      );
    if (firstItHora)
      dataHoraHeaderParts.push(`Horário: ${firstItHora.slice(0, 5)}`);

    // Formatação de moeda
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);

    const osLine = osData.os
      ? `<p><strong>OS:</strong> ${osData.os.toUpperCase()}</p>`
      : "";
    const marcaModeloLine =
      vehicleInfo.marca || vehicleInfo.modelo
        ? `<p><strong>Marca/Modelo:</strong> ${[vehicleInfo.marca, vehicleInfo.modelo].filter(Boolean).join(" ")}</p>`
        : "";

    // HTML do email (sem ícones, estilo profissional)
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #001C3A; padding: 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">NOVO ATENDIMENTO</h1>
        </div>
        <div style="padding: 40px; background-color: #fff;">
          <h2 style="color: #001C3A; margin-top: 0; font-size: 18px;">Protocolo: ${(osData as any).protocolo}</h2>
          
          ${
            dataHoraHeaderParts.length > 0
              ? `
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 14px;">
            ${dataHoraHeaderParts.map((p) => `<p style="margin: 4px 0;"><strong>${p}</strong></p>`).join("")}
          </div>
          `
              : ""
          }

          <div style="margin: 24px 0;">
            <p><strong>Fornecedor:</strong> Geolog Transporte Executivo</p>
            ${osLine}
            <p><strong>Empresa:</strong> ${cliente}</p>
            <p><strong>Solicitante:</strong> ${(osData as any).solicitante || "Não informado"}</p>
            <p><strong>C. Custo:</strong> ${centroCusto}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 14px; font-weight: bold;">PASSAGEIRO(S)</h3>
            <ul style="margin: 0; padding-left: 20px;">${paxText}</ul>
          </div>

          ${
            itineraryText ||
            `
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 14px; font-weight: bold;">ITINERÁRIO</h3>
            <p style="margin: 0; color: #64748b;">Não informado</p>
          </div>
          `
          }

          <div style="margin: 24px 0;">
            <p><strong>Motorista:</strong> ${(osData as any).motorista || "Não informado"}</p>
            <p><strong>Contato:</strong> ${driverPhone}</p>
            <p><strong>Veículo:</strong> ${tipoCapitalizado}</p>
            ${marcaModeloLine}
            <p><strong>Placa:</strong> ${vehicleInfo.placa || "Não informada"}</p>
          </div>

          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #bbf7d0;">
            <h3 style="margin: 0 0 16px 0; color: #166534; font-size: 14px; font-weight: bold;">FINANCEIRO</h3>
            <p style="margin: 8px 0;"><strong>Valor Bruto:</strong> ${formatCurrency((osData as any).valor_bruto ?? 0)}</p>
            <p style="margin: 8px 0;"><strong>Custo Motorista:</strong> ${formatCurrency((osData as any).custo ?? 0)}</p>
            <p style="margin: 8px 0;"><strong>Lucro Líquido:</strong> ${formatCurrency((osData as any).lucro ?? 0)}</p>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #eee; font-size: 12px; color: #64748b;">
          <p style="margin: 0;">&copy; 2026 Geolog Transportes e Logística Ltda.</p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: "Portal Geolog <suporte@portalgeolog.com.br>",
      to: "contato@geologtransporte.com",
      subject: `Novo Atendimento - ${(osData as any).protocolo}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao enviar email administrativo:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
