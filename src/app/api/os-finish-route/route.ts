import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeWhatsAppPhone, sendWhatsAppMessage } from "@/lib/meta";
import {
  getNextOperationalCycle,
  getOperationalCycleBannerTitle,
  type OperationalCycle,
} from "@/lib/os-messages";
import {
  loadOperationalCycleContextForOS,
  replaceOperationalCyclesForOS,
} from "@/lib/operational-cycles-db";

export const runtime = "edge";

type OSFinishRow = {
  id: string;
  status_operacional: string;
  motorista: string | null;
  protocolo: string | null;
  os_number: string | null;
  veiculo_id: string | null;
  driver_km_initial: number | null;
  route_started_km: number | null;
  route_finished_at: string | null;
};

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const osId = searchParams.get("os_id");
    const requestedCycleIndex = parseCycleIndex(
      searchParams.get("cycle_index"),
    );

    if (!osId) {
      return NextResponse.json(
        { success: false, error: "ID da OS não informado." },
        { status: 400 },
      );
    }

    const { data: osRaw, error: findError } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, driver_km_initial, route_started_km, route_finished_at",
      )
      .eq("id", osId)
      .single();
    const os = osRaw as OSFinishRow | null;

    if (findError || !os) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    const { cycle } = await loadOperationalCycleContextForOS(
      getAdmin(),
      osId,
      requestedCycleIndex,
    );
    // Correção de inconsistência: ciclo pode estar "completed" no JSON mas
    // route_finished_at nulo (dados legados não atualizados). Permitir refinalizar.
    const alreadyFinished = Boolean(
      cycle && cycle.state === "completed" && os.route_finished_at,
    );
    const canFinish = Boolean(
      cycle &&
      (cycle.state === "awaiting_finish" ||
        cycle.state === "awaiting_km_finish" ||
        (cycle.state === "completed" && !os.route_finished_at)),
    );

    return NextResponse.json({
      success: true,
      os,
      alreadyFinished,
      canFinish,
      cycle,
      cycleTitle: cycle
        ? getOperationalCycleBannerTitle(cycle)
        : "NOVO ATENDIMENTO",
      message: alreadyFinished
        ? "Rota já finalizada anteriormente."
        : undefined,
    });
  } catch (error: unknown) {
    console.error("🔥 Erro os-finish-route preview:", error);
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
      km_final?: number;
      cycle_index?: number;
    };
    const osId = body.os_id;
    const kmFinal = body.km_final;
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
    if (
      typeof kmFinal !== "number" ||
      kmFinal < 0 ||
      !Number.isFinite(kmFinal)
    ) {
      return NextResponse.json(
        { success: false, error: "Quilometragem final inválida." },
        { status: 400 },
      );
    }

    const { data: osRaw, error: findError } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, driver_km_initial, route_started_km, route_finished_at",
      )
      .eq("id", osId)
      .single();
    const os = osRaw as OSFinishRow | null;

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

    if (cycle.state === "completed" && os.route_finished_at) {
      return NextResponse.json({
        success: true,
        alreadyFinished: true,
        message: "Rota já finalizada anteriormente.",
      });
    }

    if (
      cycle.state !== "awaiting_finish" &&
      cycle.state !== "awaiting_km_finish" &&
      !(cycle.state === "completed" && !os.route_finished_at)
    ) {
      return NextResponse.json(
        { success: false, error: "A viagem ainda não foi iniciada." },
        { status: 400 },
      );
    }

    const startKm =
      cycle.kmInitial ?? os.route_started_km ?? os.driver_km_initial ?? 0;
    if (kmFinal < startKm) {
      return NextResponse.json(
        {
          success: false,
          error: "A quilometragem final não pode ser menor que a inicial.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updatedCycles = updateCycleInList(cycles, cycle.itineraryIndex, {
      state: "completed",
      finishedAt: now,
      kmFinal,
    });

    const nextCycle = getNextOperationalCycle(cycles, cycle.itineraryIndex);
    const finalStatus = nextCycle ? "Aguardando" : "Finalizado";

    const nextCycles = nextCycle
      ? updateCycleInList(updatedCycles, nextCycle.itineraryIndex, {
          state:
            nextCycle.state === "completed" ? "completed" : "awaiting_accept",
          messageSentAt: nextCycle.messageSentAt || now,
        })
      : updatedCycles;

    await replaceOperationalCyclesForOS(getAdmin(), osId, nextCycles);

    const { error: updateError } = await getAdmin()
      .from("ordens_servico")
      .update({
        status_operacional: finalStatus,
        route_finished_at: now,
        route_finished_km: kmFinal,
      } as never)
      .eq("id", osId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Erro ao finalizar a rota." },
        { status: 500 },
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (getAdmin().from("os_logs") as any).insert({
        os_id: osId,
        type: finalStatus === "Finalizado" ? "status_change" : "driver_finish",
        actor_name: os.motorista || "Motorista",
        description:
          finalStatus === "Finalizado"
            ? `Atendimento finalizado${cycle ? ` — ${getOperationalCycleBannerTitle(cycle)}` : ""} (KM: ${kmFinal})`
            : `Rota finalizada${cycle ? ` — ${getOperationalCycleBannerTitle(cycle)}` : ""} (KM: ${kmFinal})`,
        metadata: {
          cycle_index: cycle?.itineraryIndex ?? null,
          km_final: kmFinal,
          status_operacional: finalStatus,
          action: finalStatus === "Finalizado" ? "finish_all" : "driver_finish",
        },
      });
    } catch (logErr) {
      console.error("[os-finish-route] Erro ao registrar log:", logErr);
    }

    // Envio de próximo ciclo para motorista
    if (nextCycle && os.motorista) {
      try {
        const { data: driverPhone } = (await getAdmin()
          .from("drivers")
          .select("phone")
          .eq("name", os.motorista)
          .single()) as { data: { phone: string } | null };

        if (driverPhone?.phone) {
          const nextLink = `https://portalgeolog.com.br/aceitar/${osId}?cycle_index=${nextCycle.itineraryIndex}`;
          const nextMessage = [
            `🚦 *${getOperationalCycleBannerTitle(nextCycle)}*`,
            "",
            "O ciclo anterior foi concluído. Clique no link abaixo para aceitar o próximo atendimento:",
            nextLink,
          ].join("\n");
          await sendWhatsAppMessage(
            normalizeWhatsAppPhone(driverPhone.phone),
            nextMessage,
          );
        }
      } catch (notifyNextErr) {
        console.error(
          "Erro ao enviar próximo ciclo para o motorista:",
          notifyNextErr,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Rota finalizada! Obrigado.",
      cycle,
      nextCycle,
    });
  } catch (error: unknown) {
    console.error("🔥 Erro os-finish-route POST:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
