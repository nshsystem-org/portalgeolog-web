import { NextResponse } from "next/server";
import {
  CAIXA_ATTACHMENT_BUCKET,
  createAdminClient,
  getAuthUser,
  hasCaixaAccess,
} from "../../_shared";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: lancamento, error } = await adminClient
      .from("caixa_lancamentos")
      .select("id, anexo_path")
      .eq("id", id)
      .single();

    if (error || !lancamento) {
      return NextResponse.json(
        { error: "Lançamento não encontrado" },
        { status: 404 },
      );
    }
    if (!lancamento.anexo_path) {
      return NextResponse.json(
        { error: "Lançamento não possui comprovante" },
        { status: 404 },
      );
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from(CAIXA_ATTACHMENT_BUCKET)
      .createSignedUrl(lancamento.anexo_path, 300);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: "Falha ao gerar URL do comprovante" },
        { status: 500 },
      );
    }

    return NextResponse.json({ signedUrl: signed.signedUrl });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
