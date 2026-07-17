import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  calcHoraExtraCliente,
  FINANCE_ATTACHMENT_BUCKET,
  isLiberadoParaFaturamento,
  parseHoraExtraMinutes,
  sanitizeFinanceFileName,
} from "@/lib/financeiro";

export const runtime = "edge";

type EligibleOS = {
  id: string;
  valor_bruto: number | string | null;
  hora_extra: string | null;
  no_show: boolean | null;
  no_show_percentual: number | null;
  status_operacional: string | null;
};

type BatchFilters = {
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  centroCustoId: string;
};

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

function validateFilters(filters: BatchFilters): string | null {
  if (!filters.dataInicio || !filters.dataFim || !filters.clienteId) {
    return "Data inicial, data final e empresa são obrigatórias.";
  }
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !isoDatePattern.test(filters.dataInicio) ||
    !isoDatePattern.test(filters.dataFim)
  ) {
    return "Informe um período válido.";
  }
  if (filters.dataInicio > filters.dataFim) {
    return "A data inicial não pode ser posterior à data final.";
  }
  return null;
}

function calculateTotal(rows: EligibleOS[]): number {
  return rows.reduce((total, row) => {
    const baseValue = Number(row.valor_bruto || 0);
    const extraValue = calcHoraExtraCliente(
      parseHoraExtraMinutes(row.hora_extra),
    );
    const value = baseValue + extraValue;
    const noShowFactor = row.no_show
      ? (row.no_show_percentual ?? 100) / 100
      : 1;
    return total + value * noShowFactor;
  }, 0);
}

async function getBatchData(filters: BatchFilters) {
  const adminClient = createAdminClient();
  const { data: customer, error: customerError } = await adminClient
    .from("clientes")
    .select("id, nome")
    .eq("id", filters.clienteId)
    .single();

  if (customerError || !customer) {
    throw new Error("Empresa não encontrada.");
  }

  let centerName: string | null = null;
  if (filters.centroCustoId) {
    const { data: center, error: centerError } = await adminClient
      .from("centros_custo")
      .select("id, nome")
      .eq("id", filters.centroCustoId)
      .eq("cliente_id", filters.clienteId)
      .single();

    if (centerError || !center) {
      throw new Error("Centro de custo não pertence à empresa selecionada.");
    }
    centerName = center.nome;
  }

  let query = adminClient
    .from("ordens_servico")
    .select(
      "id, valor_bruto, hora_extra, no_show, no_show_percentual, status_operacional",
    )
    .eq("arquivado", false)
    .eq("cliente_id", filters.clienteId)
    .eq("status_financeiro", "Pendente")
    .eq("isento_valor_bruto", false)
    .gte("data", filters.dataInicio)
    .lte("data", filters.dataFim);

  if (filters.centroCustoId) {
    query = query.eq("centro_custo_id", filters.centroCustoId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const eligible = ((data ?? []) as EligibleOS[]).filter((row) =>
    isLiberadoParaFaturamento(row.status_operacional),
  );

  return {
    adminClient,
    customerName: customer.nome,
    centerName,
    eligible,
    totalValue: calculateTotal(eligible),
  };
}

async function getAuthenticatedUser() {
  const authClient = await createAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();
  return error ? null : user;
}

async function hasFinanceAccess(userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("user_roles")
    .select("categoria, specific_permissions")
    .eq("id", userId)
    .single();
  if (error || !data) return false;
  if (data.categoria === "administrador" || data.categoria === "financeiro") {
    return true;
  }
  const permissions = data.specific_permissions as Record<string, unknown> | null;
  const financePermissions = permissions?.financeiro as
    | Record<string, unknown>
    | undefined;
  return financePermissions?.page_access === true;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasFinanceAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const url = new URL(request.url);
    const filters = {
      dataInicio: url.searchParams.get("dataInicio")?.trim() || "",
      dataFim: url.searchParams.get("dataFim")?.trim() || "",
      clienteId: url.searchParams.get("clienteId")?.trim() || "",
      centroCustoId: url.searchParams.get("centroCustoId")?.trim() || "",
    };
    const validationError = validateFilters(filters);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const batch = await getBatchData(filters);
    return NextResponse.json({
      count: batch.eligible.length,
      totalValue: batch.totalValue,
      customerName: batch.customerName,
      centerName: batch.centerName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasFinanceAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const formData = await request.formData();
    const filters = {
      dataInicio: String(formData.get("dataInicio") || "").trim(),
      dataFim: String(formData.get("dataFim") || "").trim(),
      clienteId: String(formData.get("clienteId") || "").trim(),
      centroCustoId: String(formData.get("centroCustoId") || "").trim(),
    };
    const validationError = validateFilters(filters);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const tipoDocumento =
      String(formData.get("tipoDocumento") || "nota_fiscal").trim() ||
      "nota_fiscal";

    if (file) {
      const allowedTypes = new Set([
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
      ]);
      if (!allowedTypes.has(file.type)) {
        return NextResponse.json(
          { error: "Envie PDF, PNG, JPG ou WEBP." },
          { status: 400 },
        );
      }
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Arquivo muito grande. Máximo 20MB." },
          { status: 400 },
        );
      }
    }

    const batch = await getBatchData(filters);
    if (batch.eligible.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma OS liberada e pendente foi encontrada." },
        { status: 404 },
      );
    }

    const ids = batch.eligible.map((row) => row.id);
    const storagePaths: string[] = [];
    const attachmentPathByOSId = new Map<string, string>();
    const cleanupAttachments = async (paths: string[]): Promise<void> => {
      if (paths.length === 0) return;
      await batch.adminClient
        .from("os_financeiro_anexos")
        .delete()
        .in("storage_path", paths);
      await batch.adminClient.storage
        .from(FINANCE_ATTACHMENT_BUCKET)
        .remove(paths);
    };

    if (file) {
      const fileBuffer = await file.arrayBuffer();
      const batchId = Date.now();
      const fileName = sanitizeFinanceFileName(file.name);
      const attachments: Array<{
        ordem_servico_id: string;
        storage_path: string;
        nome_arquivo: string;
        mime_type: string;
        tamanho_bytes: number;
        tipo_documento: string;
        observacao: string;
        created_by: string;
      }> = [];
      for (const osId of ids) {
        const storagePath = `lotes/${batchId}/${osId}_${fileName}`;
        const { error: uploadError } = await batch.adminClient.storage
          .from(FINANCE_ATTACHMENT_BUCKET)
          .upload(storagePath, new Blob([fileBuffer], { type: file.type }), {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) {
          await cleanupAttachments(storagePaths);
          throw uploadError;
        }
        storagePaths.push(storagePath);
        attachmentPathByOSId.set(osId, storagePath);
        attachments.push({
          ordem_servico_id: osId,
          storage_path: storagePath,
          nome_arquivo: file.name,
          mime_type: file.type,
          tamanho_bytes: file.size,
          tipo_documento: tipoDocumento,
          observacao: "Documento do faturamento em lote",
          created_by: user.id,
        });
      }
      const { error: attachmentError } = await batch.adminClient
        .from("os_financeiro_anexos")
        .insert(attachments);
      if (attachmentError) {
        await cleanupAttachments(storagePaths);
        throw attachmentError;
      }
    }

    const now = new Date().toISOString();
    const { data: updatedRows, error: updateError } = await batch.adminClient
      .from("ordens_servico")
      .update({
        status_financeiro: "Faturado",
        financeiro_faturado_em: now,
      })
      .in("id", ids)
      .in("status_operacional", ["Finalizado", "Concluído", "Concluido"])
      .eq("status_financeiro", "Pendente")
      .eq("isento_valor_bruto", false)
      .select("id");
    if (updateError) {
      await cleanupAttachments(storagePaths);
      throw updateError;
    }

    const updatedIds = (updatedRows ?? []).map((row) => row.id as string);
    if (updatedIds.length === 0) {
      await cleanupAttachments(storagePaths);
      return NextResponse.json(
        { error: "As OS selecionadas já foram faturadas por outro usuário." },
        { status: 409 },
      );
    }
    const updatedIdSet = new Set(updatedIds);
    const skippedPaths = ids
      .filter((id) => !updatedIdSet.has(id))
      .map((id) => attachmentPathByOSId.get(id))
      .filter((path): path is string => Boolean(path));
    await cleanupAttachments(skippedPaths);
    const updatedStoragePaths = updatedIds
      .map((id) => attachmentPathByOSId.get(id))
      .filter((path): path is string => Boolean(path));
    const updatedTotalValue = calculateTotal(
      batch.eligible.filter((row) => updatedIdSet.has(row.id)),
    );

    const { data: profile } = await batch.adminClient
      .from("user_roles")
      .select("nome")
      .eq("id", user.id)
      .single();

    await batch.adminClient.from("os_logs").insert({
      os_id: updatedIds[0],
      type: "status_change",
      description: `Faturamento em lote: ${updatedIds.length} OS de ${batch.customerName}`,
      actor_name: profile?.nome || user.email || "Sistema",
      actor_id: user.id,
      metadata: {
        action: "faturamento_lote",
        os_ids: updatedIds,
        cliente_id: filters.clienteId,
        centro_custo_id: filters.centroCustoId || null,
        data_inicio: filters.dataInicio,
        data_fim: filters.dataFim,
        total_value: updatedTotalValue,
        storage_paths: updatedStoragePaths,
      },
    });

    return NextResponse.json({
      success: true,
      count: updatedIds.length,
      totalValue: updatedTotalValue,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
