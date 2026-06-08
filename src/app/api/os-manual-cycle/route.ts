import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  type OperationalCycle,
  type OperationalCycleState,
} from "@/lib/os-messages";
import {
  loadOperationalCycleContextForOS,
  replaceOperationalCyclesForOS,
} from "@/lib/operational-cycles-db";

export const runtime = "edge";

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
      return NextResponse.json(
        { success: false, error: "Não autenticado." },
        { status: 401 },
      );
    }


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

    let actorName = "Sistema";
    let actorId: string | null = null;
    let actorAvatarUrl: string | null = null;

    if (user) {
      actorId = user.id;
      const userMetadata = user.user_metadata as
        | Record<string, unknown>
        | undefined;
      actorName =
        (typeof userMetadata?.nome === "string" ? userMetadata.nome : null) ||
        (typeof userMetadata?.full_name === "string"
          ? userMetadata.full_name
          : null) ||
        user.email ||
        "Sistema";

      const { data: profile } = await getAdmin()
        .from("user_roles")
        .select("nome, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      actorName = profile?.nome || actorName;
      actorAvatarUrl = profile?.avatar_url || null;
    }

    const { data: osRaw, error: fetchError } = await getAdmin()
      .from("ordens_servico")
      .select("id, status_operacional, motorista")
      .eq("id", os_id)
      .single();

    if (fetchError || !osRaw) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    const { cycles } = await loadOperationalCycleContextForOS(
      getAdmin(),
      os_id,
      null,
    );

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

      await replaceOperationalCyclesForOS(getAdmin(), os_id, finishedCycles);

      const ordensServicoBulk = getAdmin().from(
        "ordens_servico",
      ) as unknown as OrdensServicoUpdateBuilder;
      const { error: bulkUpdateError } = await ordensServicoBulk
        .update({
          status_operacional: "Finalizado",
          updated_at: new Date().toISOString(),
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

    const cycle = cycles.find(
      (c) => c.itineraryIndex === (cycle_index as number),
    );

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

    await replaceOperationalCyclesForOS(getAdmin(), os_id, updatedCycles);

    console.log(
      "[os-manual-cycle] Ciclos persistidos no banco:",
      "os_id:",
      os_id,
      "total de ciclos:",
      updatedCycles.length,
      "ciclo modificado:",
      updatedCycles.find((c) => c.itineraryIndex === (cycle_index as number)),
    );

    // Verificar se todos os ciclos estão concluídos/cancelados para atualizar status geral
    const allCompletedOrCancelled = updatedCycles.every(
      (c) => c.state === "completed" || c.state === "cancelled",
    );

    const ordensServicoBulk = getAdmin().from(
      "ordens_servico",
    ) as unknown as OrdensServicoUpdateBuilder;

    if (allCompletedOrCancelled) {
      const { error: bulkUpdateError } = await ordensServicoBulk
        .update({
          status_operacional: "Finalizado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", os_id);

      if (bulkUpdateError) {
        console.error("Erro ao finalizar todos os ciclos:", bulkUpdateError);
        return NextResponse.json(
          { success: false, error: "Erro ao atualizar banco de dados." },
          { status: 500 },
        );
      }

      const { error: logError } = await getAdmin()
        .from("os_logs")
        .insert({
          os_id,
          type: "status_change",
          actor_name: actorName,
          actor_id: actorId,
          actor_avatar_url: actorAvatarUrl,
          description: "Todos os ciclos finalizados manualmente",
          metadata: {
            action: "finish_all",
            cycle_count: updatedCycles.length,
            status_operacional: "Finalizado",
          },
        } as never);

      if (logError) {
        console.error("[os-manual-cycle] Erro ao registrar log:", logError);
      }

      console.log(
        "[os-manual-cycle] Todos os ciclos concluídos. Status da OS atualizado para Finalizado.",
      );
    } else {
      // Tocar a tabela ordens_servico para disparar evento Realtime
      // (necessário porque a RPC replace_os_operational_cycles faz DELETE+INSERT
      // e pode não disparar eventos Realtime corretamente)
      await ordensServicoBulk
        .update({ updated_at: new Date().toISOString() })
        .eq("id", os_id);
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

    const actionDescriptions: Record<string, string> = {
      finish_cycle: "Ciclo finalizado manualmente",
      revert_to_pending: "Ciclo revertido para pendente",
      revert_to_accept: "Ciclo revertido para aceitação",
    };

    const { error: logError } = await getAdmin()
      .from("os_logs")
      .insert({
        os_id,
        type: "status_change",
        actor_name: actorName,
        actor_id: actorId,
        actor_avatar_url: actorAvatarUrl,
        description:
          actionDescriptions[action] || "Ciclo operacional atualizado",
        metadata: {
          action,
          cycle_index: targetIndex,
          cycle_title: cycle.title,
          new_state: newState,
        },
      } as never);

    if (logError) {
      console.error("[os-manual-cycle] Erro ao registrar log:", logError);
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
