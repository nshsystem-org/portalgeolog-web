import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FINANCE_ATTACHMENT_BUCKET,
  sanitizeFinanceFileName,
  isLiberadoParaFaturamento,
} from "@/lib/financeiro";

export const runtime = "edge";

type UserRoleRow = {
  id: string;
  nome: string | null;
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

    const formData = await request.formData();
    const osId = String(formData.get("osId") || "").trim();
    const file = formData.get("file");
    const tipoDocumento = String(formData.get("tipoDocumento") || "comprovante")
      .trim()
      .toLowerCase() || "comprovante";
    const observacao = String(formData.get("observacao") || "").trim() || null;

    if (!osId) {
      return NextResponse.json(
        { error: "osId é obrigatório" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }

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

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 20MB." },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: osRow, error: osError } = await adminClient
      .from("ordens_servico")
      .select("id, status_financeiro, status_operacional")
      .eq("id", osId)
      .single();

    if (osError || !osRow) {
      return NextResponse.json(
        { error: "OS não encontrada." },
        { status: 404 },
      );
    }

    if (!isLiberadoParaFaturamento(osRow.status_operacional)) {
      return NextResponse.json(
        { error: "A OS precisa estar finalizada ou concluída para faturar." },
        { status: 409 },
      );
    }

    if ((osRow.status_financeiro || "Pendente") !== "Pendente") {
      return NextResponse.json(
        { error: "A OS já foi faturada ou recebida." },
        { status: 409 },
      );
    }

    const fileName = `${Date.now()}_${sanitizeFinanceFileName(file.name)}`;
    const storagePath = `${osId}/${tipoDocumento}/${fileName}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
      .from(FINANCE_ATTACHMENT_BUCKET)
      .upload(storagePath, new Blob([fileBuffer], { type: file.type }), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: attachment, error: insertError } = await adminClient
      .from("os_financeiro_anexos")
      .insert({
        ordem_servico_id: osId,
        storage_path: storagePath,
        nome_arquivo: file.name,
        mime_type: file.type,
        tamanho_bytes: file.size,
        tipo_documento: tipoDocumento,
        observacao,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("ordens_servico")
      .update({
        status_financeiro: "Faturado",
        financeiro_faturado_em: now,
      })
      .eq("id", osId);

    if (updateError) {
      throw updateError;
    }

    const { data: profile } = await adminClient
      .from("user_roles")
      .select("nome")
      .eq("id", user.id)
      .single();
    const profileRow = profile as UserRoleRow | null;

    await adminClient.from("os_logs").insert({
      os_id: osId,
      type: "status_change",
      description: "OS faturada com comprovante anexado",
      actor_name: profileRow?.nome || user.email || "Sistema",
      actor_id: user.id,
      metadata: {
        tipo_documento: tipoDocumento,
        nome_arquivo: file.name,
        storage_path: storagePath,
        status_financeiro: "Faturado",
      },
    });

    return NextResponse.json({
      success: true,
      attachment,
      statusFinanceiro: "Faturado",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
