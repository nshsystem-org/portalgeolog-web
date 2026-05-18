import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeOperationalCycles,
  type OperationalCycle,
  type OperationalCycleState,
} from "@/lib/os-messages";

export const runtime = "edge";

type OSRow = {
  id: string;
  status_operacional: string;
  motorista: string | null;
  driver_operation_cycles: OperationalCycle[] | null;
};

type OrdensServicoUpdateBuilder = {
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: Error | null }>;
  };
};

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getAdmin = () => {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
  return _supabaseAdmin;
};

const updateCycleInList = (
  cycles: OperationalCycle[],
  itineraryIndex: number,
  updates: Partial<OperationalCycle>,
): OperationalCycle[] =>
  cycles.map((cycle) =>
    cycle.itineraryIndex === itineraryIndex ? { ...cycle, ...updates } : cycle,
  );

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      os_id: string;
      cycle_index: number;
      action: "finish_cycle" | "revert_to_pending" | "revert_to_accept";
    };

    const { os_id, cycle_index, action } = body;

    if (!os_id || !Number.isFinite(cycle_index)) {
      return NextResponse.json(
        { success: false, error: "Parâmetros inválidos." },
        { status: 400 },
      );
    }

    const { data: osRaw, error: fetchError } = await getAdmin()
      .from("ordens_servico")
      .select("id, status_operacional, motorista, driver_operation_cycles")
      .eq("id", os_id)
      .single();

    if (fetchError || !osRaw) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    const os = osRaw as OSRow;
    const cycles = normalizeOperationalCycles(os.driver_operation_cycles);
    const cycle = cycles.find((c) => c.itineraryIndex === cycle_index);

    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Ciclo não encontrado." },
        { status: 404 },
      );
    }

    let updatedCycles: OperationalCycle[] = cycles;
    let newState: OperationalCycleState = cycle.state;

    switch (action) {
      case "finish_cycle":
        // Finalizar ciclo: transition to completed
        updatedCycles = updateCycleInList(cycles, cycle_index, {
          state: "completed",
          finishedAt: new Date().toISOString(),
        });
        newState = "completed";
        break;

      case "revert_to_pending":
        // Revert accept to pending: reset to pending state
        updatedCycles = updateCycleInList(cycles, cycle_index, {
          state: "pending",
          acceptedAt: undefined,
        });
        newState = "pending";
        break;

      case "revert_to_accept":
        // Revert from started to accept: reset to awaiting_start state
        updatedCycles = updateCycleInList(cycles, cycle_index, {
          state: "awaiting_start",
          startedAt: undefined,
          kmInitial: cycle.kmInitial, // Keep initial KM if exists
        });
        newState = "awaiting_start";
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Ação inválida." },
          { status: 400 },
        );
    }

    // Update the database
    const ordensServico = getAdmin().from(
      "ordens_servico",
    ) as unknown as OrdensServicoUpdateBuilder;
    const { error: updateError } = await ordensServico
      .update({ driver_operation_cycles: updatedCycles })
      .eq("id", os_id);

    if (updateError) {
      console.error("Erro ao atualizar ciclo manualmente:", updateError);
      return NextResponse.json(
        { success: false, error: "Erro ao atualizar banco de dados." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Ciclo ${action} realizado com sucesso.`,
      cycle_state: newState,
    });
  } catch (error: unknown) {
    console.error("Erro na rota os-manual-cycle:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
