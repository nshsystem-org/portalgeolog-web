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
): OperationalCycle[] => {
  console.log(
    "[updateCycleInList] Atualizando ciclo específico:",
    "itineraryIndex:",
    itineraryIndex,
    "ciclos disponíveis:",
    cycles.map((c) => ({
      itineraryIndex: c.itineraryIndex,
      sequenceOrder: c.sequenceOrder,
      state: c.state,
    })),
    "updates:",
    updates,
  );

  const updated = cycles.map((cycle) => {
    if (cycle.itineraryIndex === itineraryIndex) {
      console.log(
        "[updateCycleInList] Ciclo encontrado e será atualizado:",
        cycle.itineraryIndex,
        cycle.title,
      );
      return { ...cycle, ...updates };
    }
    return cycle;
  });

  const affectedCount = updated.filter(
    (c) => c.itineraryIndex === itineraryIndex,
  ).length;
  console.log(
    "[updateCycleInList] Ciclos afetados:",
    affectedCount,
    "deveria ser 1",
  );

  return updated;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      os_id: string;
      cycle_index?: number;
      action:
        | "finish_cycle"
        | "revert_to_pending"
        | "revert_to_accept"
        | "finish_all";
    };

    const { os_id, cycle_index, action } = body;

    if (!os_id) {
      return NextResponse.json(
        { success: false, error: "Parâmetros inválidos." },
        { status: 400 },
      );
    }

    if (action !== "finish_all" && !Number.isFinite(cycle_index)) {
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

    // Caso especial: finalizar todos os ciclos de uma vez
    if (action === "finish_all") {
      const now = new Date().toISOString();
      const finishedCycles: OperationalCycle[] = cycles.map((c) =>
        c.state === "cancelled"
          ? c
          : {
              ...c,
              state: "completed",
              acceptedAt: c.acceptedAt || now,
              startedAt: c.startedAt || now,
              finishedAt: c.finishedAt || now,
            },
      );

      const ordensServicoBulk = getAdmin().from(
        "ordens_servico",
      ) as unknown as OrdensServicoUpdateBuilder;
      const { error: bulkUpdateError } = await ordensServicoBulk
        .update({
          driver_operation_cycles: finishedCycles,
          status_operacional: "Finalizado",
        })
        .eq("id", os_id);

      if (bulkUpdateError) {
        console.error("Erro ao finalizar todos os ciclos:", bulkUpdateError);
        return NextResponse.json(
          { success: false, error: "Erro ao atualizar banco de dados." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Todos os ciclos finalizados com sucesso.",
        cycle_state: "completed",
      });
    }

    console.log(
      "[os-manual-cycle] Buscando ciclo para atualizar:",
      "cycle_index recebido:",
      cycle_index,
      "ciclos disponíveis:",
      cycles.map((c) => ({
        itineraryIndex: c.itineraryIndex,
        sequenceOrder: c.sequenceOrder,
        state: c.state,
        title: c.title,
      })),
    );

    const cycle = cycles.find((c) => c.itineraryIndex === (cycle_index as number));

    if (!cycle) {
      console.error(
        "[os-manual-cycle] Ciclo não encontrado para cycle_index:",
        cycle_index,
      );
      return NextResponse.json(
        { success: false, error: "Ciclo não encontrado." },
        { status: 404 },
      );
    }

    console.log(
      "[os-manual-cycle] Ciclo encontrado:",
      cycle.itineraryIndex,
      cycle.title,
      "estado atual:",
      cycle.state,
    );

    let updatedCycles: OperationalCycle[] = cycles;
    let newState: OperationalCycleState = cycle.state;
    const targetIndex = cycle_index as number;

    switch (action) {
      case "finish_cycle":
        // Finalizar ciclo: transition to completed
        updatedCycles = updateCycleInList(cycles, targetIndex, {
          state: "completed",
          finishedAt: new Date().toISOString(),
        });
        newState = "completed";
        break;

      case "revert_to_pending":
        // Revert accept to pending: reset to pending state and clear all progress data
        updatedCycles = updateCycleInList(cycles, targetIndex, {
          state: "pending",
          acceptedAt: undefined,
          startedAt: undefined,
          finishedAt: undefined,
          kmInitial: undefined,
          kmFinal: undefined,
        });
        newState = "pending";
        break;

      case "revert_to_accept":
        // Revert from started/finished to accept: reset to awaiting_start state
        updatedCycles = updateCycleInList(cycles, targetIndex, {
          state: "awaiting_start",
          startedAt: undefined,
          finishedAt: undefined,
          kmInitial: undefined,
          kmFinal: undefined,
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

    // Validar que apenas o ciclo específico foi modificado
    const modifiedCycles = updatedCycles.filter(
      (c) => c.itineraryIndex === (cycle_index as number),
    );
    if (modifiedCycles.length !== 1) {
      console.error(
        "[os-manual-cycle] ERRO: Mais de um ciclo modificado ou nenhum ciclo modificado:",
        "esperado: 1",
        "encontrado:",
        modifiedCycles.length,
        "ciclos modificados:",
        modifiedCycles.map((c) => ({
          itineraryIndex: c.itineraryIndex,
          state: c.state,
        })),
      );
      return NextResponse.json(
        {
          success: false,
          error: "Erro de integridade: múltiplos ciclos afetados.",
        },
        { status: 500 },
      );
    }

    console.log(
      "[os-manual-cycle] Atualização concluída com sucesso:",
      "ciclo afetado:",
      modifiedCycles[0].itineraryIndex,
      "novo estado:",
      modifiedCycles[0].state,
    );

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
