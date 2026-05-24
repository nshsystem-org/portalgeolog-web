import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FINANCE_ATTACHMENT_BUCKET } from "@/lib/financeiro";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authClient = await createAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: attachment, error } = await adminClient
      .from("os_financeiro_anexos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !attachment) {
      return NextResponse.json(
        { error: "Anexo não encontrado." },
        { status: 404 },
      );
    }

    const { data: signedUrlData, error: signedUrlError } =
      await adminClient.storage
        .from(FINANCE_ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw signedUrlError || new Error("Não foi possível gerar o link.");
    }

    return NextResponse.json({
      success: true,
      attachment,
      signedUrl: signedUrlData.signedUrl,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
