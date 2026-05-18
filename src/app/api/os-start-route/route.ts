import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/lib/meta";
import {
  findOperationalCycleByIndex,
  getFirstPendingOperationalCycle,
  getOperationalCycleBannerTitle,
  normalizeOperationalCycles,
  type OperationalCycle,
} from "@/lib/os-messages";

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

type OSStartRow = {
  id: string;
  status_operacional: string;
  motorista: string | null;
  veiculo_id: string | null;
  protocolo: string | null;
  os_number: string | null;
  driver_operation_cycles: OperationalCycle[] | null;
  current_driver_cycle_index: number | null;
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

const resolveCycle = (
  os: OSStartRow,
  requestedCycleIndex: number | null,
): OperationalCycle | undefined => {
  const cycles = normalizeOperationalCycles(os.driver_operation_cycles);
  if (requestedCycleIndex !== null) {
    return findOperationalCycleByIndex(cycles, requestedCycleIndex);
  }

  if (
    typeof os.current_driver_cycle_index === "number" &&
    Number.isFinite(os.current_driver_cycle_index)
  ) {
    const currentCycle = cycles.find(
      (cycle) => cycle.sequenceOrder === os.current_driver_cycle_index,
    );
    if (
      currentCycle &&
      currentCycle.state !== "completed" &&
      currentCycle.state !== "cancelled"
    ) {
      return currentCycle;
    }
  }

  return getFirstPendingOperationalCycle(cycles) || cycles[0];
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
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, driver_operation_cycles, current_driver_cycle_index",
      )
      .eq("id", osId)
      .single();
    const os = osRaw as OSStartRow | null;

    if (findError || !os) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    const cycle = resolveCycle(os, requestedCycleIndex);
    const alreadyStarted = Boolean(
      cycle &&
      (cycle.state === "awaiting_finish" || cycle.state === "completed"),
    );

    return NextResponse.json({
      success: true,
      os,
      alreadyStarted,
      cycle,
      cycleTitle: cycle
        ? getOperationalCycleBannerTitle(cycle)
        : "NOVO ATENDIMENTO",
      message: alreadyStarted ? "Rota já iniciada anteriormente." : undefined,
    });
  } catch (error: unknown) {
    console.error("🔥 Erro os-start-route preview:", error);
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
      km_initial?: number;
      cycle_index?: number;
    };
    const osId = body.os_id;
    const kmInitial = body.km_initial;
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
      typeof kmInitial !== "number" ||
      kmInitial < 0 ||
      !Number.isFinite(kmInitial)
    ) {
      return NextResponse.json(
        { success: false, error: "Quilometragem inicial inválida." },
        { status: 400 },
      );
    }

    const { data: osRaw, error: findError } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, driver_operation_cycles, current_driver_cycle_index",
      )
      .eq("id", osId)
      .single();
    const os = osRaw as OSStartRow | null;

    if (findError || !os) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    const cycles = normalizeOperationalCycles(os.driver_operation_cycles);
    const cycle = resolveCycle(os, requestedCycleIndex);

    if (!cycle) {
      return NextResponse.json(
        {
          success: false,
          error: "Ciclo operacional não encontrado para esta OS.",
        },
        { status: 404 },
      );
    }

    if (cycle.state === "awaiting_finish" || cycle.state === "completed") {
      return NextResponse.json({
        success: true,
        alreadyStarted: true,
        message: "Rota já iniciada anteriormente.",
      });
    }

    if (
      cycle.state !== "awaiting_start" &&
      cycle.state !== "pending" &&
      cycle.state !== "awaiting_accept"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Este ciclo não pode ser iniciado no momento.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updatedCycles = updateCycleInList(cycles, cycle.itineraryIndex, {
      state: "awaiting_finish",
      startedAt: now,
      kmInitial,
    });

    const ordensServico = getAdmin().from(
      "ordens_servico",
    ) as unknown as OrdensServicoUpdateBuilder;

    const { error: updateError } = await ordensServico
      .update({
        status_operacional: "Em Rota",
        route_started_at: now,
        driver_km_initial: kmInitial,
        route_started_km: kmInitial,
        driver_operation_cycles: updatedCycles,
        current_driver_cycle_index: cycle.sequenceOrder,
      })
      .eq("id", osId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Erro ao iniciar a rota." },
        { status: 500 },
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (getAdmin().from("os_logs") as any).insert({
        os_id: osId,
        type: "driver_start",
        actor_name: os.motorista || "Motorista",
        description: `Rota iniciada${cycle ? ` — ${getOperationalCycleBannerTitle(cycle)}` : ""} (KM: ${kmInitial})`,
        metadata: {
          cycle_index: cycle?.itineraryIndex ?? null,
          km_initial: kmInitial,
        },
      });
    } catch (logErr) {
      console.error("[os-start-route] Erro ao registrar log:", logErr);
    }

    // Envio de template finalizar_rota_motorista
    try {
      if (os.motorista) {
        const { data: driverPhone } = (await getAdmin()
          .from("drivers")
          .select("phone")
          .eq("name", os.motorista)
          .single()) as { data: { phone: string } | null };

        if (driverPhone?.phone) {
          const finishUrl = `${osId}?cycle_index=${cycle.itineraryIndex}`;
          const kmFormatted = kmInitial.toLocaleString("pt-BR");

          const templateComponents = [
            {
              type: "body",
              parameters: [{ type: "text", text: kmFormatted }],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: finishUrl }],
            },
          ];

          const templateResult = await sendWhatsAppTemplate(
            driverPhone.phone,
            "finalizar_rota_motorista",
            "pt_BR",
            templateComponents,
          );

          if (templateResult.success) {
            console.log(
              "[os-start-route] Template finalizar_rota_motorista enviado para",
              driverPhone.phone,
            );
          } else {
            console.warn(
              "[os-start-route] Falha ao enviar template finalizar_rota_motorista:",
              templateResult.error,
            );
          }
        }
      }
    } catch (notifyErr) {
      console.error("Erro ao enviar template finalizar_rota_motorista:", notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: "Rota iniciada. Boa viagem!",
    });
  } catch (error: unknown) {
    console.error("🔥 Erro os-start-route POST:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
