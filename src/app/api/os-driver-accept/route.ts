import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeWhatsAppPhone, sendWhatsAppMessage } from "@/lib/meta";
import { buildPostAcceptMessage } from "@/lib/driver-accept";
import {
  getOperationalCycleBannerTitle,
  type OperationalCycle,
} from "@/lib/os-messages";
import {
  loadOperationalCycleContextForOS,
  replaceOperationalCyclesForOS,
} from "@/lib/operational-cycles-db";

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

type OSDriverRouteRow = {
  id: string;
  status_operacional: string;
  motorista: string | null;
  veiculo_id: string | null;
  protocolo: string | null;
  os_number: string | null;
  data: string | null;
  hora: string | null;
};

type OrdensServicoUpdateBuilder = {
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: Error | null }>;
  };
};

const parseCycleIndex = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const updateCycleInList = (
  cycles: OperationalCycle[],
  itineraryIndex: number,
  updates: Partial<OperationalCycle>,
): OperationalCycle[] =>
  cycles.map((cycle) =>
    cycle.itineraryIndex === itineraryIndex ? { ...cycle, ...updates } : cycle,
  );

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const osId = searchParams.get("os_id");
    const preview = searchParams.get("preview") === "1";

    if (!osId) {
      return NextResponse.json(
        { success: false, error: "ID da OS não informado." },
        { status: 400 },
      );
    }

    const requestedCycleIndex = parseCycleIndex(
      searchParams.get("cycle_index"),
    );

    const { data: osRaw, error: findError } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, data, hora",
      )
      .eq("id", osId)
      .single();
    const os = osRaw as OSDriverRouteRow | null;

    if (findError || !os) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    if (!preview) {
      return NextResponse.json(
        { success: false, error: "Use o formulário para aceitar a viagem." },
        { status: 405 },
      );
    }

    const { cycle } = await loadOperationalCycleContextForOS(
      getAdmin(),
      osId,
      requestedCycleIndex,
    );

    let vehicle = null;
    if (os.veiculo_id) {
      const { data: v } = await getAdmin()
        .from("veiculos")
        .select("marca, modelo, placa")
        .eq("id", os.veiculo_id)
        .single();
      vehicle = v;
    }

    const alreadyAccepted = Boolean(
      cycle &&
      cycle.state !== "pending" &&
      cycle.state !== "cancelled" &&
      cycle.state !== "awaiting_accept",
    );

    return NextResponse.json({
      success: true,
      preview: true,
      os,
      vehicle,
      cycle,
      cycleTitle: cycle
        ? getOperationalCycleBannerTitle(cycle)
        : "NOVO ATENDIMENTO",
      alreadyAccepted,
      message: alreadyAccepted
        ? "Viagem já aceita pelo motorista anteriormente."
        : undefined,
    });
  } catch (error: unknown) {
    console.error("🔥 Erro os-driver-accept preview:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      os_id?: string;
      cycle_index?: number;
    };
    const osId = body.os_id;
    const requestedCycleIndex =
      typeof body.cycle_index === "number" && Number.isFinite(body.cycle_index)
        ? body.cycle_index
        : null;

    if (!osId) {
      return NextResponse.json(
        { success: false, error: "ID da OS não informado." },
        { status: 400 },
      );
    }

    const { data: osRaw, error: findError } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, data, hora",
      )
      .eq("id", osId)
      .single();
    const os = osRaw as OSDriverRouteRow | null;

    console.log(
      "[os-driver-accept] OS encontrada:",
      os?.id,
      "motorista:",
      os?.motorista,
      "status:",
      os?.status_operacional,
    );

    if (findError || !os) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    const { cycles, cycle } = await loadOperationalCycleContextForOS(
      getAdmin(),
      osId,
      requestedCycleIndex,
    );

    if (!cycle) {
      return NextResponse.json(
        {
          success: false,
          error: "Ciclo operacional não encontrado para esta OS.",
        },
        { status: 404 },
      );
    }

    if (
      cycle.state !== "pending" &&
      cycle.state !== "cancelled" &&
      cycle.state !== "awaiting_accept"
    ) {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        message: "Viagem já aceita pelo motorista anteriormente.",
      });
    }

    const now = new Date().toISOString();
    const updatedCycles = updateCycleInList(cycles, cycle.itineraryIndex, {
      state: "awaiting_start",
      acceptedAt: now,
      messageSentAt: cycle.messageSentAt || now,
    });

    await replaceOperationalCyclesForOS(getAdmin(), osId, updatedCycles);

    const ordensServico = getAdmin().from(
      "ordens_servico",
    ) as unknown as OrdensServicoUpdateBuilder;
    const { error: updateError } = await ordensServico
      .update({
        status_operacional: "Aguardando",
        driver_accepted_at: now,
      })
      .eq("id", osId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Erro ao registrar aceite do motorista." },
        { status: 500 },
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (getAdmin().from("os_logs") as any).insert({
        os_id: osId,
        type: "driver_accept",
        actor_name: os.motorista || "Motorista",
        description: `Motorista visualizou o atendimento${cycle ? ` — ${getOperationalCycleBannerTitle(cycle)}` : ""}`,
        metadata: {
          cycle_index: cycle?.itineraryIndex ?? null,
          motorista: os.motorista || "Motorista",
        },
      });
    } catch (logErr) {
      console.error("[os-driver-accept] Erro ao registrar log:", logErr);
    }

    let messageSent = false;
    try {
      if (os.motorista) {
        const motoristaNormalized = normalizeName(os.motorista);

        const { data: driverCandidatesRaw, error: driverError } =
          await getAdmin()
            .from("drivers")
            .select("name, phone")
            .ilike("name", `%${escapeLikePattern(os.motorista.trim())}%`)
            .limit(10);
        const driverCandidates = (driverCandidatesRaw || []) as Array<{
          name: string | null;
          phone: string | null;
        }>;

        const matchedDriver =
          driverCandidates.find(
            (candidate) =>
              normalizeName(candidate.name || "") === motoristaNormalized,
          ) ||
          driverCandidates.find((candidate) =>
            normalizeName(candidate.name || "").includes(motoristaNormalized),
          );

        const driverPhone = matchedDriver?.phone?.trim() || undefined;

        console.log("[os-driver-accept] Driver lookup:", {
          name: os.motorista,
          matchedName: matchedDriver?.name,
          phone: driverPhone,
          candidates: driverCandidates.length || 0,
          error: driverError?.message,
        });

        if (driverPhone) {
          const confirmationMsg = await buildPostAcceptMessage(osId, cycle);

          console.log(
            "[os-driver-accept] Enviando mensagem completa da OS com link Iniciar Rota:",
            normalizeWhatsAppPhone(driverPhone),
          );
          const result = await sendWhatsAppMessage(
            normalizeWhatsAppPhone(driverPhone),
            confirmationMsg,
          );

          if (result.success) {
            messageSent = true;
            console.log(
              "[os-driver-accept] Mensagem de aceite enviada com sucesso",
            );
          } else {
            console.error(
              "[os-driver-accept] Erro ao enviar mensagem de aceite:",
              result.error,
            );
          }
        } else {
          console.warn(
            "[os-driver-accept] Telefone do motorista não encontrado",
            {
              motorista: os.motorista,
              candidates: driverCandidates.map((candidate) => candidate.name),
            },
          );
        }
      } else {
        console.warn("[os-driver-accept] OS sem motorista definido");
      }
    } catch (notifyErr) {
      console.error(
        "[os-driver-accept] Erro ao enviar mensagem (Meta API):",
        notifyErr,
      );
    }

    return NextResponse.json({
      success: true,
      message: messageSent
        ? "Viagem aceita. Mensagens enviadas ao motorista."
        : "Viagem aceita.",
      cycle,
    });
  } catch (error: unknown) {
    console.error("🔥 Erro os-driver-accept POST:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
