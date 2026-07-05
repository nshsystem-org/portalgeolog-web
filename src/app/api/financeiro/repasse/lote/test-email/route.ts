import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "edge";

function createResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

// Reaproveita o template da rota principal
type RepasseLoteEmailData = {
  driverName: string;
  driverId: string;
  vinculoTipo: string;
  dataInicio: string;
  dataFim: string;
  osCount: number;
  totalValue: number;
  actorName: string;
  actorEmail: string;
  osIds: string[];
};

function buildRepasseLoteEmailHTML(data: RepasseLoteEmailData): string {
  const vinculoLabel =
    data.vinculoTipo === "autonomo"
      ? "Autônomo"
      : data.vinculoTipo === "parceiro"
        ? "Parceiro"
        : data.vinculoTipo === "freelance"
          ? "Freelancer"
          : (data.vinculoTipo || "—");

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
    <div style="background-color: #001C3A; padding: 28px; text-align: center;">
      <img src="https://portalgeolog.com.br/logo.png" alt="Geolog" width="56" height="56" style="margin: 0 auto 12px auto; display: block;" />
      <h1 style="color: #fff; margin: 0; font-size: 20px;">Portal Geolog</h1>
      <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Repasse em Lote Registrado</p>
    </div>
    <div style="padding: 40px; background-color: #fff;">
      <h2 style="color: #001C3A; margin-top: 0;">Resumo do Repasse em Lote</h2>
      <p style="font-size: 16px; line-height: 1.6;">
        O repasse em lote foi registrado com sucesso por
        <strong>${data.actorName}</strong>.
      </p>

      <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #bbf7d0;">
        <h3 style="margin: 0 0 16px 0; color: #166534; font-size: 14px; font-weight: bold;">DADOS DO REPASSE</h3>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Motorista:</strong> ${data.driverName}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Vínculo:</strong> ${vinculoLabel}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Período:</strong> ${formatDateBR(data.dataInicio)} a ${formatDateBR(data.dataFim)}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Quantidade de OS:</strong> ${data.osCount}</p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Valor Total:</strong> ${formatCurrency(data.totalValue)}</p>
      </div>

      <div style="text-align: center; margin: 40px 0;">
        <a href="https://portalgeolog.com.br/portal/financeiro" style="background-color: #001C3A; color: #fff; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Ver no Portal</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #eee; margin: 40px 0;" />

      <p style="font-size: 13px; color: #94a3b8; text-align: center;">
        &copy; 2026 Geolog Transportes e Logística Ltda.
      </p>
    </div>
  </div>`;
}

export async function GET() {
  try {
    const resend = createResendClient();
    if (!resend) {
      return NextResponse.json(
        { error: "RESEND_API_KEY não configurada" },
        { status: 500 },
      );
    }

    // Dados fictícios para teste
    const fictitiousData: RepasseLoteEmailData = {
      driverName: "João Carlos da Silva",
      driverId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      vinculoTipo: "autonomo",
      dataInicio: "2026-06-01",
      dataFim: "2026-06-30",
      osCount: 12,
      totalValue: 3840.5,
      actorName: "Carlos Eduardo Mendes",
      actorEmail: "carlos.mendes@geologtransporte.com",
      osIds: [
        "f1e2d3c4-b5a6-7890-abcd-ef1234567001",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567002",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567003",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567004",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567005",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567006",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567007",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567008",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567009",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567010",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567011",
        "f1e2d3c4-b5a6-7890-abcd-ef1234567012",
      ],
    };

    const { data, error } = await resend.emails.send({
      from: "Portal Geolog <suporte@portalgeolog.com.br>",
      to: "nshsistemas@gmail.com",
      subject: `Repasse em Lote — ${fictitiousData.driverName} (${formatDateBR(fictitiousData.dataInicio)} a ${formatDateBR(fictitiousData.dataFim)})`,
      html: buildRepasseLoteEmailHTML(fictitiousData),
    });

    if (error) {
      return NextResponse.json(
        { error: `Erro ao enviar e-mail: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "E-mail de teste enviado para nshsistemas@gmail.com",
      resendId: data?.id,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
