import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "edge";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

function createResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

type RepasseLoteEmailData = {
  driverName: string;
  driverId: string;
  vinculoTipo: string;
  dataInicio: string;
  dataFim: string;
  osCount: number;
  totalValue: number;
  actorName: string;
  actorEmail: string;
  osIds: string[];
};

function buildRepasseLoteEmailHTML(data: RepasseLoteEmailData): string {
  const vinculoLabel =
    data.vinculoTipo === "autonomo"
      ? "Autônomo"
      : data.vinculoTipo === "parceiro"
        ? "Parceiro"
        : data.vinculoTipo === "freelance"
          ? "Freelancer"
          : (data.vinculoTipo || "—");

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
    <div style="background-color: #001C3A; padding: 28px; text-align: center;">
      <img src="https://portalgeolog.com.br/logo.png" alt="Geolog" width="56" height="56" style="margin: 0 auto 12px auto; display: block;" />
      <h1 style="color: #fff; margin: 0; font-size: 20px;">Portal Geolog</h1>
      <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Repasse em Lote Registrado</p>
    </div>
    <div style="padding: 40px; background-color: #fff;">
      <h2 style="color: #001C3A; margin-top: 0;">Resumo do Repasse em Lote</h2>
      <p style="font-size: 16px; line-height: 1.6;">
        O repasse em lote foi registrado com sucesso por
        <strong>${data.actorName}</strong>.
      </p>

      <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #bbf7d0;">
        <h3 style="margin: 0 0 16px 0; color: #166534; font-size: 14px; font-weight: bold;">DADOS DO REPASSE</h3>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Motorista:</strong> ${data.driverName}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Vínculo:</strong> ${vinculoLabel}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Período:</strong> ${formatDateBR(data.dataInicio)} a ${formatDateBR(data.dataFim)}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Quantidade de OS:</strong> ${data.osCount}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Valor Total:</strong> ${formatCurrency(data.totalValue)}</p>
      </div>

      <div style="text-align: center; margin: 40px 0;">
        <a href="https://portalgeolog.com.br/portal/financeiro" style="background-color: #001C3A; color: #fff; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Ver no Portal</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #eee; margin: 40px 0;" />

      <p style="font-size: 13px; color: #94a3b8; text-align: center;">
        &copy; 2026 Geolog Transportes e Logística Ltda.
      </p>
    </div>
  </div>`;
}

async function sendRepasseLoteEmail(
  data: RepasseLoteEmailData,
  to: string | string[],
): Promise<void> {
  const resend = createResendClient();
  if (!resend) {
    console.warn("[repasse-lote] RESEND_API_KEY não configurada — e-mail não enviado");
    return;
  }

  const recipients = Array.isArray(to) ? to : [to];

  await resend.emails.send({
    from: "Portal Geolog <suporte@portalgeolog.com.br>",
    to: recipients,
    subject: `Repasse em Lote — ${data.driverName} (${formatDateBR(data.dataInicio)} a ${formatDateBR(data.dataFim)})`,
    html: buildRepasseLoteEmailHTML(data),
  });
}


async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
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

    const body = (await request.json()) as {
      driverId?: string;
      dataInicio?: string;
      dataFim?: string;
    };

    const driverId = String(body.driverId || "").trim();
    const dataInicio = String(body.dataInicio || "").trim();
    const dataFim = String(body.dataFim || "").trim();

    if (!driverId || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "driverId, dataInicio e dataFim são obrigatórios" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // Valida motorista e determina vínculo
    const { data: driver, error: driverError } = await adminClient
      .from("drivers")
      .select("id, vinculo_tipo, name")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      return NextResponse.json(
        { error: "Motorista não encontrado." },
        { status: 404 },
      );
    }

    const isAutonomo = driver.vinculo_tipo === "autonomo";
    const isParceiro = driver.vinculo_tipo === "parceiro";

    // Busca OS elegíveis: motorista no período com repasse pendente
    const { data: osRows, error: osError } = await adminClient
      .from("ordens_servico")
      .select("id, cliente_id, tipo, custo, no_show, no_show_percentual, hora_extra")
      .eq("driver_id", driverId)
      .eq("repasse_pago", false)
      .gte("data", dataInicio)
      .lte("data", dataFim);

    if (osError) throw osError;

    // Freelance: sempre elegível; autonomo e parceiro: todas as OS do driver
    const eligible = (osRows ?? []).filter(
      (os) => os.tipo === "freelance" || isAutonomo || isParceiro,
    );

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma OS elegível encontrada para este período." },
        { status: 404 },
      );
    }

    const ids = eligible.map((os) => os.id);

    // Calcula totalValue aplicando no-show e hora extra (R$ 20/h)
    const HORA_EXTRA_MOTORISTA = 20;
    const calcBilledMinutes = (input: number): number => {
      if (input <= 0) return 0;
      return Math.ceil(input / 30) * 30;
    };
    const totalValue = eligible.reduce((sum, os) => {
      const custoBase = Number(os.custo || 0);
      const horaExtra = os.hora_extra as string | null;
      const heMin = (() => {
        if (!horaExtra) return 0;
        const [hStr, mStr] = horaExtra.trim().split(":");
        return (parseInt(hStr || "0", 10) * 60) + parseInt(mStr || "0", 10);
      })();
      const heBilled = calcBilledMinutes(heMin);
      const heValue = (heBilled / 60) * HORA_EXTRA_MOTORISTA;
      const total = custoBase + heValue;
      if (os.no_show) {
        const fator = ((os.no_show_percentual as number | null) ?? 100) / 100;
        return sum + total * fator;
      }
      return sum + total;
    }, 0);

    // Atualiza em lote
    const { error: updateError } = await adminClient
      .from("ordens_servico")
      .update({ repasse_pago: true })
      .in("id", ids);

    if (updateError) throw updateError;

    // Log único resumindo o lote
    const { data: profile } = await adminClient
      .from("user_roles")
      .select("nome")
      .eq("id", user.id)
      .single();

    await adminClient.from("os_logs").insert({
      os_id: ids[0],
      type: "status_change",
      description: `Repasse em lote registrado: ${ids.length} OS para ${driver.name || driverId} (${dataInicio} a ${dataFim})`,
      actor_name: profile?.nome || user.email || "Sistema",
      actor_id: user.id,
      metadata: {
        action: "repasse_lote_pago",
        lote: true,
        cliente_id: osRows[0]?.cliente_id ?? null,
        os_ids: ids,
        driver_id: driverId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        total_value: totalValue,
      },
    });

    // Envia e-mail de resumo do repasse em lote
    try {
      await sendRepasseLoteEmail(
        {
          driverName: driver.name || driverId,
          driverId,
          vinculoTipo: driver.vinculo_tipo || "",
          dataInicio,
          dataFim,
          osCount: ids.length,
          totalValue,
          actorName: profile?.nome || user.email || "Sistema",
          actorEmail: user.email || "Sistema",
          osIds: ids,
        },
        ["contato@geologtransporte.com", "logistica@geologtransporte.com"],
      );
    } catch (emailErr) {
      console.error("[repasse-lote] Falha ao enviar e-mail de resumo:", emailErr);
    }

    return NextResponse.json({
      success: true,
      count: ids.length,
      totalValue,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
