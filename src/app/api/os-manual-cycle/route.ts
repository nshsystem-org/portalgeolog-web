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
import { sendNextOperationalCycleFlow } from "@/lib/operational-cycle-flow";

export const runtime = "edge";

type OrdensServicoUpdateBuilder = {
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: Error | null }>;
  };
};

type UserRoleRow = {
  nome: string | null;
  avatar_url: string | null;
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

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const authClient = await createAuthClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const body = (await request.json()) as {
      os_id: string;
      cycle_index?: number;
      action:
        | "finish_cycle"
        | "revert_to_pending"
        | "revert_to_accept"
        | "restart_route"
        | "finish_all"
        | "edit_km";
      reset_reason?: "rescheduling" | "other";
      reset_reason_text?: string;
      // edit_km fields
      km_field?: "initial" | "final";
      km_new_value?: number;
      km_reason?: string;
      km_bypass_odometer?: boolean;
    };

    const { os_id, cycle_index, action, reset_reason, reset_reason_text } = body;
    const { km_field, km_new_value, km_reason, km_bypass_odometer } = body;

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
        .maybeSingle() as unknown as {
        data: UserRoleRow | null;
        error: Error | null;
      };

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

      console.log(
        `[Perf][os-manual-cycle] finish_all ${(performance.now() - startedAt).toFixed(0)}ms`,
      );

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

    // ── finish_cycle: delega para RPC atômica ──────────────────────────────────
    // A RPC finish_cycle_manual:
    //   - Se km_initial existe: mantém, ignora km_final
    //   - Se nenhum KM existe: finaliza sem KM
    //   - Atualiza os_operational_cycles + ordens_servico atomicamente
    //   - Preenche acceptedAt/startedAt ausentes (ciclo que não passou pelo WhatsApp)
    //   - Insere log de auditoria
    if (action === "finish_cycle") {
      // Primeira linha de defesa (segunda está dentro da RPC)
      if (cycle.state === "completed" || cycle.state === "cancelled") {
        console.warn(
          `[os-manual-cycle] Tentativa de finalizar ciclo já em estado "${cycle.state}". Bloqueado.`,
        );
        return NextResponse.json(
          { success: false, error: "Este ciclo já está finalizado.", already_finished: true },
          { status: 409 },
        );
      }

      const { data: rpcData, error: rpcError } = await getAdmin().rpc(
        "finish_cycle_manual",
        {
          p_os_id: os_id,
          p_cycle_index: cycle_index as number,
          p_actor_name: actorName,
        },
      );

      if (rpcError) {
        console.error("[os-manual-cycle] Erro na RPC finish_cycle_manual:", rpcError);
        return NextResponse.json(
          { success: false, error: "Erro ao finalizar ciclo." },
          { status: 500 },
        );
      }

      const rpcResult = rpcData as {
        success: boolean;
        error?: string;
        already_finished?: boolean;
        statusOperacional?: string;
        kmInitial?: number | null;
        updatedCycles?: unknown;
      };

      if (!rpcResult.success) {
        if (rpcResult.already_finished || rpcResult.error === "ALREADY_FINISHED") {
          return NextResponse.json(
            { success: false, error: "Este ciclo já está finalizado.", already_finished: true },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { success: false, error: rpcResult.error || "Erro ao finalizar ciclo." },
          { status: 400 },
        );
      }

      const updatedCyclesAfterFinish = Array.isArray(rpcResult.updatedCycles)
        ? (rpcResult.updatedCycles as OperationalCycle[])
        : cycles;
      const nextCycle = updatedCyclesAfterFinish
        .filter(
          (c) =>
            c.sequenceOrder > cycle.sequenceOrder &&
            c.state !== "completed" &&
            c.state !== "cancelled",
        )
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];

      let nextCycleStarted = false;
      let nextCycleIndex: number | null = null;

      if (nextCycle) {
        nextCycleIndex = nextCycle.itineraryIndex;
        const nextCycleResult = await sendNextOperationalCycleFlow(getAdmin(), {
          osId: os_id,
          targetCycleIndex: nextCycle.itineraryIndex,
          cycles: updatedCyclesAfterFinish,
        });

        if (nextCycleResult.success) {
          nextCycleStarted = true;
          console.log(
            "[os-manual-cycle] Próximo ciclo iniciado automaticamente:",
            nextCycle.itineraryIndex,
            nextCycle.title,
            "msgId:",
            nextCycleResult.templateMessageId,
          );
        } else {
          console.warn(
            "[os-manual-cycle] Falha ao iniciar próximo ciclo automaticamente:",
            nextCycleResult.error,
          );
        }
      }

      console.log(
        `[Perf][os-manual-cycle] finish_cycle (RPC atômica) km_initial=${rpcResult.kmInitial ?? "null"} status=${rpcResult.statusOperacional} ${(performance.now() - startedAt).toFixed(0)}ms`,
      );

      return NextResponse.json({
        success: true,
        message: "Ciclo finalizado com sucesso.",
        cycle_state: "completed",
        status_operacional: rpcResult.statusOperacional,
        next_cycle_started: nextCycleStarted,
        next_cycle_index: nextCycleIndex,
      });
    }
    // ────────────────────────────────────────────────────────────────────────────

    let updatedCycles: OperationalCycle[] = cycles;
    let newState: OperationalCycleState = cycle.state;
    let ordensServicoUpdate: Record<string, unknown> | null = null;
    const targetIndex = cycle_index as number;

    switch (action) {
      case "revert_to_pending": {
        // Reset total: volta para pendente, motorista precisa aceitar novamente
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
      }

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

      case "restart_route":
        // Reabre a rota após finalização: limpa os marcos operacionais do ciclo
        updatedCycles = updateCycleInList(cycles, targetIndex, {
          state: "awaiting_start",
          acceptedAt: undefined,
          startedAt: undefined,
          finishedAt: undefined,
          messageSentAt: undefined,
          kmInitial: undefined,
          kmFinal: undefined,
        });
        newState = "awaiting_start";
        ordensServicoUpdate = {
          status_operacional: "Em Rota",
          route_started_at: null,
          route_started_km: null,
          route_finished_at: null,
          route_finished_km: null,
          driver_flow_start_message_id: null,
          driver_flow_finish_message_id: null,
          updated_at: new Date().toISOString(),
        };
        break;

      case "edit_km": {
        // Edição manual de KM sem precisar resetar o ciclo ou reenviar template
        if (!km_field || km_new_value === undefined || km_new_value === null) {
          return NextResponse.json(
            { success: false, error: "Parâmetros inválidos para edição de KM." },
            { status: 400 },
          );
        }
        if (!Number.isFinite(km_new_value) || km_new_value < 0) {
          return NextResponse.json(
            { success: false, error: "Valor de KM inválido." },
            { status: 400 },
          );
        }
        if (!km_reason || km_reason.trim().length < 3) {
          return NextResponse.json(
            { success: false, error: "Justificativa obrigatória para edição de KM." },
            { status: 400 },
          );
        }

        // Buscar veiculo_id da OS para checar odômetro
        const { data: osForKm } = await getAdmin()
          .from("ordens_servico")
          .select("veiculo_id")
          .eq("id", os_id)
          .single() as unknown as { data: { veiculo_id: string | null } | null };

        if (!km_bypass_odometer && osForKm?.veiculo_id) {
          const { data: odo } = await getAdmin()
            .from("vehicle_km_odometer")
            .select("last_km")
            .eq("veiculo_id", osForKm.veiculo_id)
            .maybeSingle() as unknown as { data: { last_km: number } | null };

          if (odo && km_new_value <= odo.last_km) {
            return NextResponse.json(
              {
                success: false,
                error: "KM_BELOW_ODOMETER",
                current_odometer: odo.last_km,
              },
              { status: 422 },
            );
          }
        }

        const kmField = km_field === "initial" ? "kmInitial" : "kmFinal";
        const oldKm = km_field === "initial" ? cycle.kmInitial : cycle.kmFinal;

        updatedCycles = updateCycleInList(cycles, targetIndex, {
          [kmField]: km_new_value,
        });
        newState = cycle.state; // estado não muda

        // Sincronizar ordens_servico
        if (km_field === "initial") {
          ordensServicoUpdate = {
            route_started_km: km_new_value,
            updated_at: new Date().toISOString(),
          };
        } else {
          ordensServicoUpdate = {
            route_finished_km: km_new_value,
            updated_at: new Date().toISOString(),
          };
        }

        await replaceOperationalCyclesForOS(getAdmin(), os_id, updatedCycles);

        // Tocar ordens_servico para Realtime
        const ordensServicoKmBulk = getAdmin().from(
          "ordens_servico",
        ) as unknown as OrdensServicoUpdateBuilder;
        await ordensServicoKmBulk
          .update(ordensServicoUpdate)
          .eq("id", os_id);

        // Atualizar odômetro e histórico se não for bypass
        if (osForKm?.veiculo_id) {
          await getAdmin()
            .from("vehicle_km_odometer")
            .upsert(
              {
                veiculo_id: osForKm.veiculo_id,
                last_km: km_new_value,
                last_km_type: km_field,
                last_os_id: os_id,
                last_recorded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "veiculo_id" },
            );

          await getAdmin()
            .from("vehicle_km_history")
            .insert({
              veiculo_id: osForKm.veiculo_id,
              os_id,
              km_value: km_new_value,
              km_type: km_field,
              driver_name: actorName,
              recorded_via: "manual",
            });
        }

        // Log auditoria
        const kmLabel = km_field === "initial" ? "KM Inicial" : "KM Final";
        const kmLogDesc = `${kmLabel} editado manualmente: ${(oldKm ?? 0).toLocaleString("pt-BR")} → ${km_new_value.toLocaleString("pt-BR")}`;
        await getAdmin()
          .from("os_logs")
          .insert({
            os_id,
            type: "status_change",
            actor_name: actorName,
            actor_id: actorId,
            actor_avatar_url: actorAvatarUrl,
            description: kmLogDesc,
            metadata: {
              action: "edit_km",
              cycle_index: targetIndex,
              cycle_title: cycle.title,
              km_field,
              old_value: oldKm ?? null,
              new_value: km_new_value,
              reason: km_reason,
              bypass_odometer: km_bypass_odometer ?? false,
            },
          } as never);

        console.log(
          `[Perf][os-manual-cycle] edit_km ${(performance.now() - startedAt).toFixed(0)}ms`,
        );

        return NextResponse.json({
          success: true,
          message: `${kmLabel} atualizado com sucesso.`,
          km_field,
          new_value: km_new_value,
        });
      }

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
        .update(
          ordensServicoUpdate ?? {
            status_operacional: "Finalizado",
            updated_at: new Date().toISOString(),
          },
        )
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
      console.log(
        `[Perf][os-manual-cycle] ${action} ${(performance.now() - startedAt).toFixed(0)}ms`,
      );

      return NextResponse.json({
        success: true,
        message: "Todos os ciclos finalizados com sucesso.",
        cycle_state: "completed",
      });
    } else {
      // Tocar a tabela ordens_servico para disparar evento Realtime
      // (necessário porque a RPC replace_os_operational_cycles faz DELETE+INSERT
      // e pode não disparar eventos Realtime corretamente)
      await ordensServicoBulk
        .update(
          ordensServicoUpdate ?? { updated_at: new Date().toISOString() },
        )
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

    let logDescription: string;
    if (action === "revert_to_pending" && reset_reason) {
      const reasonLabels: Record<string, string> = {
        rescheduling: "Ciclo revertido — Remarcação/Atraso",
        other: "Ciclo revertido",
      };
      logDescription = reasonLabels[reset_reason] ?? "Ciclo revertido para pendente";
      if (reset_reason === "other" && reset_reason_text) {
        logDescription += `: ${reset_reason_text}`;
      }
    } else {
      const actionDescriptions: Record<string, string> = {
        revert_to_pending: "Ciclo revertido para pendente",
        revert_to_accept: "Ciclo revertido para aceitação",
        restart_route: "Rota reaberta e reiniciada manualmente",
      };
      logDescription = actionDescriptions[action] || "Ciclo operacional atualizado";
    }

    const { error: logError } = await getAdmin()
      .from("os_logs")
      .insert({
        os_id,
        type: "status_change",
        actor_name: actorName,
        actor_id: actorId,
        actor_avatar_url: actorAvatarUrl,
        description: logDescription,
        metadata: {
          action,
          cycle_index: targetIndex,
          cycle_title: cycle.title,
          new_state: newState,
          ...(reset_reason ? { reset_reason } : {}),
          ...(reset_reason_text ? { reset_reason_text } : {}),
        },
      } as never);

    if (logError) {
      console.error("[os-manual-cycle] Erro ao registrar log:", logError);
    }

    console.log(
      `[Perf][os-manual-cycle] ${action} ${(performance.now() - startedAt).toFixed(0)}ms`,
    );

    return NextResponse.json({
      success: true,
      message: `Ciclo ${action} realizado com sucesso.`,
      cycle_state: newState,
    });
  } catch (error: unknown) {
    console.error("Erro na rota os-manual-cycle:", error);
    console.log(
      `[Perf][os-manual-cycle] failed after ${(performance.now() - startedAt).toFixed(0)}ms`,
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
