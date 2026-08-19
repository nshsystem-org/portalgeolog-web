import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FINANCE_ATTACHMENT_BUCKET } from "@/lib/financeiro";
import { hasFinanceAccess } from "@/lib/permissions-server";

export const runtime = "edge";

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

/**
 * GET /api/financeiro/anexos/[id]
 *
 * Retorna uma signed URL (válida por 60 segundos) para download do anexo
 * financeiro identado por `id`. O anexo é buscado na tabela
 * `os_financeiro_anexos` e o arquivo é servido do bucket
 * `financeiro-comprovantes`.
 *
 * Requer autenticação + acesso ao módulo financeiro.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: attachmentId } = await params;

    if (!attachmentId) {
      return NextResponse.json(
        { error: "ID do anexo é obrigatório." },
        { status: 400 },
      );
    }

    const authClient = await createAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 },
      );
    }

    if (!(await hasFinanceAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    const { data: attachment, error: attachmentError } = await adminClient
      .from("os_financeiro_anexos")
      .select("storage_path, nome_arquivo")
      .eq("id", attachmentId)
      .single();

    if (attachmentError || !attachment) {
      return NextResponse.json(
        { error: "Anexo não encontrado." },
        { status: 404 },
      );
    }

    const storagePath = attachment.storage_path as string;
    if (!storagePath) {
      return NextResponse.json(
        { error: "Caminho do anexo inválido." },
        { status: 500 },
      );
    }

    const { data: urlData, error: urlError } = await adminClient.storage
      .from(FINANCE_ATTACHMENT_BUCKET)
      .createSignedUrl(storagePath, 60, {
        download: true,
      });

    if (urlError || !urlData?.signedUrl) {
      console.error("Erro ao gerar signed URL:", urlError);
      return NextResponse.json(
        { error: "Falha ao gerar URL de download." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      signedUrl: urlData.signedUrl,
      fileName: attachment.nome_arquivo as string | null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
