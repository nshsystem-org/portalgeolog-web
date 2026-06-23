import { createClient } from "@/lib/supabase/client";

let _supabase: ReturnType<typeof createClient> | null = null;
const getSupabase = () => {
  if (!_supabase) _supabase = createClient();
  return _supabase;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 1000,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay);
  }
}

// =============================================================================
// Types
// =============================================================================

export type DocagemStatus = "ativa" | "cancelada" | "finalizada";
export type DocagemInstanceStatus =
  | "pendente"
  | "andamento"
  | "finalizada"
  | "excluida";

export type DocagemDiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DocagemInput = {
  clienteId: string;
  centroCustoId?: string | null;
  solicitanteId?: string | null;
  motoristaId?: string | null;
  veiculoId?: string | null;
  endereco: string;
  dataInicio: string;
  dataFim: string;
  horarioInicio: string;
  horarioFim: string;
  diasSemana: number[];
  valorDiario: number;
  custoDiario?: number | null;
  observacao?: string | null;
};

export type DocagemInstance = {
  id: string;
  docagemId: string;
  protocolo: string | null;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  endereco: string;
  motoristaId: string | null;
  veiculoId: string | null;
  valor: number;
  custo: number | null;
  status: DocagemInstanceStatus;
  finalizadaEm: string | null;
  finalizadaPor: string | null;
  // Dados da mãe (expandidos no fetch)
  clienteId: string;
  centroCustoId: string | null;
  solicitanteId: string | null;
  observacao: string | null;
};

export type DocagemInstanceUpdate = {
  endereco?: string;
  motoristaId?: string | null;
  veiculoId?: string | null;
  valor?: number;
  custo?: number | null;
  horarioInicio?: string;
  horarioFim?: string;
};

export type DocagemSummary = {
  id: string;
  protocolo: string | null;
  clienteId: string;
  centroCustoId: string | null;
  solicitanteId: string | null;
  motoristaId: string | null;
  veiculoId: string | null;
  endereco: string;
  dataInicio: string;
  dataFim: string;
  horarioInicio: string;
  horarioFim: string;
  diasSemana: number[];
  valorDiario: number;
  custoDiario: number | null;
  observacao: string | null;
  status: DocagemStatus;
  createdAt: string;
};

// =============================================================================
// Mappers
// =============================================================================

function mapDocagemInstance(row: Record<string, unknown>): DocagemInstance {
  return {
    id: String(row.id),
    docagemId: String(row.docagem_id),
    protocolo: row.protocolo ? String(row.protocolo) : null,
    data: String(row.data),
    horarioInicio: String(row.horario_inicio),
    horarioFim: String(row.horario_fim),
    endereco: String(row.endereco),
    motoristaId: row.motorista_id ? String(row.motorista_id) : null,
    veiculoId: row.veiculo_id ? String(row.veiculo_id) : null,
    valor: Number(row.valor),
    custo: row.custo ? Number(row.custo) : null,
    status: String(row.status) as DocagemInstanceStatus,
    finalizadaEm: row.finalizada_em ? String(row.finalizada_em) : null,
    finalizadaPor: row.finalizada_por ? String(row.finalizada_por) : null,
    clienteId: String(row.cliente_id),
    centroCustoId: row.centro_custo_id ? String(row.centro_custo_id) : null,
    solicitanteId: row.solicitante_id ? String(row.solicitante_id) : null,
    observacao: row.observacao ? String(row.observacao) : null,
  };
}

function mapDocagemSummary(row: Record<string, unknown>): DocagemSummary {
  return {
    id: String(row.id),
    protocolo: row.protocolo ? String(row.protocolo) : null,
    clienteId: String(row.cliente_id),
    centroCustoId: row.centro_custo_id ? String(row.centro_custo_id) : null,
    solicitanteId: row.solicitante_id ? String(row.solicitante_id) : null,
    motoristaId: row.motorista_id ? String(row.motorista_id) : null,
    veiculoId: row.veiculo_id ? String(row.veiculo_id) : null,
    endereco: String(row.endereco),
    dataInicio: String(row.data_inicio),
    dataFim: String(row.data_fim),
    horarioInicio: String(row.horario_inicio),
    horarioFim: String(row.horario_fim),
    diasSemana: Array.isArray(row.dias_semana)
      ? row.dias_semana.map((v) => Number(v))
      : [],
    valorDiario: Number(row.valor_diario),
    custoDiario: row.custo_diario ? Number(row.custo_diario) : null,
    observacao: row.observacao ? String(row.observacao) : null,
    status: String(row.status) as DocagemStatus,
    createdAt: String(row.created_at),
  };
}

// =============================================================================
// Criação
// =============================================================================

export async function createDocagem(input: DocagemInput): Promise<string> {
  return withRetry(async () => {
    const { data, error } = await getSupabase().rpc("criar_docagem", {
      p_cliente_id: input.clienteId,
      p_centro_custo_id: input.centroCustoId ?? null,
      p_solicitante_id: input.solicitanteId ?? null,
      p_motorista_id: input.motoristaId ?? null,
      p_veiculo_id: input.veiculoId ?? null,
      p_endereco: input.endereco,
      p_data_inicio: input.dataInicio,
      p_data_fim: input.dataFim,
      p_horario_inicio: input.horarioInicio,
      p_horario_fim: input.horarioFim,
      p_dias_semana: input.diasSemana,
      p_valor_diario: input.valorDiario,
      p_custo_diario: input.custoDiario ?? null,
      p_observacao: input.observacao ?? null,
    });

    if (error) throw error;
    if (!data) throw new Error("Falha ao criar docagem: retorno vazio.");
    return String(data);
  });
}

// =============================================================================
// Busca de instâncias para o calendário
// =============================================================================

export async function fetchDocagemInstancesByRange({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<DocagemInstance[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("docagem_instancias")
      .select(
        `
        id,
        docagem_id,
        data,
        horario_inicio,
        horario_fim,
        endereco,
        motorista_id,
        veiculo_id,
        valor,
        custo,
        status,
        finalizada_em,
        finalizada_por,
        docagem:docagem_id (
          protocolo,
          cliente_id,
          centro_custo_id,
          solicitante_id,
          observacao
        )
      `,
      )
      .gte("data", from)
      .lte("data", to)
      .neq("status", "excluida")
      .order("data", { ascending: true })
      .order("horario_inicio", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as Array<Record<string, unknown>>;

    return rows.map((row) => {
      const docagem = (row.docagem as Record<string, unknown>) || {};
      return mapDocagemInstance({
        ...row,
        protocolo: docagem.protocolo,
        cliente_id: docagem.cliente_id,
        centro_custo_id: docagem.centro_custo_id,
        solicitante_id: docagem.solicitante_id,
        observacao: docagem.observacao,
      });
    });
  });
}

// =============================================================================
// Busca de docagens para a tabela/lista
// =============================================================================

export async function fetchDocagens(): Promise<DocagemSummary[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("docagens")
      .select("*")
      .neq("status", "cancelada")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data || []) as Array<Record<string, unknown>>).map(
      mapDocagemSummary,
    );
  });
}

// =============================================================================
// Ações por dia
// =============================================================================

export async function finalizarDocagemDia(
  instanciaId: string,
): Promise<string> {
  return withRetry(async () => {
    const { data, error } = await getSupabase().rpc("finalizar_docagem_dia", {
      p_instancia_id: instanciaId,
    });
    if (error) throw error;
    if (!data) throw new Error("Falha ao finalizar dia de docagem.");
    return String(data);
  });
}

export async function excluirDocagemDia(instanciaId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await getSupabase().rpc(
      "alterar_status_docagem_instancia",
      {
        p_instancia_id: instanciaId,
        p_status: "excluida",
      },
    );
    if (error) throw error;
  });
}

export async function reativarDocagemDia(instanciaId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await getSupabase().rpc(
      "alterar_status_docagem_instancia",
      {
        p_instancia_id: instanciaId,
        p_status: "pendente",
      },
    );
    if (error) throw error;
  });
}

export async function resetarDocagemDia(instanciaId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await getSupabase().rpc("resetar_docagem_dia", {
      p_instancia_id: instanciaId,
    });
    if (error) throw error;
  });
}

export async function updateDocagemInstance(
  instanciaId: string,
  updates: DocagemInstanceUpdate,
): Promise<void> {
  return withRetry(async () => {
    const payload: Record<string, unknown> = {};
    if (updates.endereco !== undefined) payload.endereco = updates.endereco;
    if (updates.motoristaId !== undefined)
      payload.motorista_id = updates.motoristaId;
    if (updates.veiculoId !== undefined) payload.veiculo_id = updates.veiculoId;
    if (updates.valor !== undefined) payload.valor = updates.valor;
    if (updates.custo !== undefined) payload.custo = updates.custo;
    if (updates.horarioInicio !== undefined)
      payload.horario_inicio = updates.horarioInicio;
    if (updates.horarioFim !== undefined)
      payload.horario_fim = updates.horarioFim;

    const { error } = await getSupabase()
      .from("docagem_instancias")
      .update(payload)
      .eq("id", instanciaId);

    if (error) throw error;
  });
}

// =============================================================================
// Busca de um resumo de docagem por id
// =============================================================================

export async function fetchDocagemById(
  id: string,
): Promise<DocagemSummary | null> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("docagens")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapDocagemSummary(data as Record<string, unknown>);
  });
}

// =============================================================================
// Atualização de docagem mãe
// =============================================================================

export async function updateDocagem(
  id: string,
  updates: Partial<Omit<DocagemInput, "diasSemana" | "dataInicio" | "dataFim">>,
): Promise<void> {
  return withRetry(async () => {
    const payload: Record<string, unknown> = {};
    if (updates.clienteId !== undefined) payload.cliente_id = updates.clienteId;
    if (updates.centroCustoId !== undefined)
      payload.centro_custo_id = updates.centroCustoId;
    if (updates.solicitanteId !== undefined)
      payload.solicitante_id = updates.solicitanteId;
    if (updates.motoristaId !== undefined)
      payload.motorista_id = updates.motoristaId;
    if (updates.veiculoId !== undefined) payload.veiculo_id = updates.veiculoId;
    if (updates.endereco !== undefined) payload.endereco = updates.endereco;
    if (updates.horarioInicio !== undefined)
      payload.horario_inicio = updates.horarioInicio;
    if (updates.horarioFim !== undefined)
      payload.horario_fim = updates.horarioFim;
    if (updates.valorDiario !== undefined)
      payload.valor_diario = updates.valorDiario;
    if (updates.custoDiario !== undefined)
      payload.custo_diario = updates.custoDiario;
    if (updates.observacao !== undefined)
      payload.observacao = updates.observacao;

    const { error } = await getSupabase()
      .from("docagens")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
  });
}

// =============================================================================
// Cancelamento de docagem mãe
// =============================================================================

export async function cancelarDocagem(id: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await getSupabase()
      .from("docagens")
      .update({ status: "cancelada" })
      .eq("id", id);
    if (error) throw error;
  });
}
