import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { fromZonedTime } from "date-fns-tz";

/**
 * Alerta diário de OS finalizadas sem valores (valor bruto e/ou custo do motorista).
 * Mesma condição do isFinalizadoSemValor() usado nos alertas vermelhos do
 * calendário/tabela/painel (src/lib/os-messages.ts).
 *
 * Cron: 8h e 16h BRT (11h e 19h UTC) — ver wrangler.workers.toml [triggers].
 */

export interface OSAlertaItem {
  id: string;
  protocolo: string;
  os_number: string | null;
  data: string | null;
  hora: string | null;
  cliente_nome: string | null;
  motorista: string | null;
  valor_bruto: number | null;
  custo: number | null;
  falta_valor_bruto: boolean;
  falta_custo: boolean;
}

interface OSAlertaRow {
  id: string;
  protocolo: string | null;
  os_number: string | null;
  data: string | null;
  hora: string | null;
  motorista: string | null;
  valor_bruto: number | string | null;
  custo: number | string | null;
  cliente_id: string | null;
  isento_valor_bruto: boolean | null;
  isento_custo: boolean | null;
}

interface ClienteRow {
  id: string;
  nome: string | null;
}

let _adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient(): ReturnType<typeof createClient> {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _adminClient;
}

function getAlertaTimezone(): string {
  return process.env.REMINDER_TIMEZONE ?? "America/Sao_Paulo";
}

function createResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function getRecipients(): string[] {
  const fixed = [
    "contato@geologtransporte.com",
    "logistica@geologtransporte.com",
  ];
  const extra = process.env.ALERTA_VALORES_RECIPIENTS;
  if (!extra) return fixed;
  const extras = extra
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return [...fixed, ...extras];
}

/** Busca todas as OS finalizadas sem valor bruto e/ou custo, não arquivadas. */
export async function getFinalizadasSemValor(): Promise<OSAlertaItem[]> {
  const supabase = getAdminClient();

  const { data: osRows, error } = await supabase
    .from("ordens_servico")
    .select(
      "id, protocolo, os_number, data, hora, motorista, valor_bruto, custo, cliente_id, isento_valor_bruto, isento_custo",
    )
    .eq("status_operacional", "Finalizado")
    .eq("arquivado", false)
    .order("data", { ascending: true });

  if (error) throw error;
  if (!osRows || osRows.length === 0) return [];

  const rows = osRows as unknown as OSAlertaRow[];

  // Buscar nomes dos clientes em paralelo (chunk se muitas)
  const clienteIds = Array.from(
    new Set(rows.map((r) => r.cliente_id).filter(Boolean)),
  ) as string[];

  const clienteMap = new Map<string, string>();
  if (clienteIds.length > 0) {
    const { data: clienteRows, error: clienteError } = await supabase
      .from("clientes")
      .select("id, nome")
      .in("id", clienteIds);

    if (clienteError) {
      console.error(
        "[os-alerta-valores] Erro ao buscar clientes:",
        clienteError,
      );
    } else if (clienteRows) {
      for (const c of clienteRows as unknown as ClienteRow[]) {
        if (c.nome) clienteMap.set(c.id, c.nome);
      }
    }
  }

  return rows
    .map((r) => {
      const vBruto =
        typeof r.valor_bruto === "string"
          ? Number(r.valor_bruto)
          : r.valor_bruto;
      const vCusto =
        typeof r.custo === "string" ? Number(r.custo) : r.custo;

      const isentoVB = Boolean(r.isento_valor_bruto);
      const isentoC = Boolean(r.isento_custo);

      return {
        id: r.id,
        protocolo: r.protocolo || "",
        os_number: r.os_number,
        data: r.data,
        hora: r.hora,
        cliente_nome: r.cliente_id
          ? clienteMap.get(r.cliente_id) ?? null
          : null,
        motorista: r.motorista,
        valor_bruto: vBruto,
        custo: vCusto,
        falta_valor_bruto:
          !isentoVB && (vBruto === null || vBruto === undefined || vBruto === 0),
        falta_custo:
          !isentoC && (vCusto === null || vCusto === undefined || vCusto === 0),
      };
    })
    .filter((item) => item.falta_valor_bruto || item.falta_custo);
}

function formatarDataBRT(dataISO: string | null): string {
  if (!dataISO) return "—";
  try {
    const tz = getAlertaTimezone();
    // dataISO vem como "YYYY-MM-DD" — interpretar como meia-noite no TZ Brasil
    const local = new Date(`${dataISO}T00:00:00`);
    // Apenas formatar DD/MM/YYYY (já está em ISO simples)
    const [y, m, d] = dataISO.split("-");
    void local;
    void tz;
    void fromZonedTime;
    return `${d}/${m}/${y}`;
  } catch {
    return dataISO;
  }
}

/** Monta o HTML do email de alerta — resumo técnico (sem listagem item a item). */
export function buildAlertaValoresEmailHTML(
  items: OSAlertaItem[],
  geracaoEm: Date = new Date(),
): string {
  const tz = getAlertaTimezone();
  const geracaoStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(geracaoEm);

  // Paleta azul do portal (#001c3a)
  const AZUL = "#001c3a";
  const AZUL_CLARO = "#eff6ff";
  const AZUL_BORDA = "#bfdbfe";
  const AZUL_TEXTO = "#1e3a8a";
  const LOGO_URL = "https://portalgeolog.com.br/logo.png";

  if (items.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: ${AZUL}; padding: 28px; text-align: center;">
          <img src="${LOGO_URL}" alt="Geolog" width="56" height="56" style="margin: 0 auto 12px auto; display: block;" />
          <h1 style="color: #fff; margin: 0; font-size: 20px;">TUDO EM DIA</h1>
        </div>
        <div style="padding: 32px; background-color: #fff; text-align: center;">
          <p style="margin: 0 0 12px 0; font-size: 16px; color: #166534; font-weight: bold;">
            Nenhum atendimento finalizado sem valores.
          </p>
          <p style="margin: 0; font-size: 13px; color: #64748b;">
            Relatório gerado em ${geracaoStr}
          </p>
        </div>
      </div>
    `;
  }

  const total = items.length;

  // Agrupa apenas por dia: o tipo no resumo é sempre "Faltando valores"
  // Usa a data ISO (YYYY-MM-DD) como chave para ordenar cronologicamente.
  type GrupoDia = { diaISO: string; dia: string; qtd: number };
  const gruposMap = new Map<string, GrupoDia>();
  for (const item of items) {
    const diaISO = item.data ?? "";
    const dia = formatarDataBRT(item.data);
    const existente = gruposMap.get(diaISO);
    if (existente) {
      existente.qtd += 1;
    } else {
      gruposMap.set(diaISO, { diaISO, dia, qtd: 1 });
    }
  }

  // Ordena decrescente pela data ISO (mês/ano mais recente primeiro,
  // e dentro do mesmo mês os dias mais recentes primeiro).
  const grupos = Array.from(gruposMap.values()).sort((a, b) =>
    b.diaISO.localeCompare(a.diaISO),
  );

  const linhasTabela = grupos
    .map(
      (g) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 11px 14px; color: ${AZUL_TEXTO}; font-size: 13px; font-weight: bold; white-space: nowrap;">💰 Faltando valores</td>
          <td style="padding: 11px 14px; color: #334155; font-size: 13px; white-space: nowrap;">${g.dia}</td>
          <td style="padding: 11px 14px; color: ${AZUL}; font-size: 15px; font-weight: bold; text-align: right;">${g.qtd}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
      <div style="background-color: ${AZUL}; padding: 28px; text-align: center;">
        <img src="${LOGO_URL}" alt="Geolog" width="56" height="56" style="margin: 0 auto 12px auto; display: block;" />
        <h1 style="color: #fff; margin: 0 0 6px 0; font-size: 20px;">ALERTA DE ATENDIMENTOS SEM VALORES</h1>
        <p style="color: #93c5fd; margin: 0; font-size: 14px;">Relatório gerado em ${geracaoStr}</p>
      </div>

      <div style="padding: 28px; background-color: #fff;">
        <div style="background: #25578c; border-radius: 14px; padding: 24px 28px; margin-bottom: 28px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 42px; font-weight: bold; color: #fff; line-height: 1;">${total}</p>
          <p style="margin: 0; font-size: 14px; color: #bfdbfe; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Avisos de alerta encontrados</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: ${AZUL_CLARO}; border-bottom: 2px solid ${AZUL_BORDA};">
              <th style="padding: 12px 14px; text-align: left; font-size: 10px; font-weight: bold; color: ${AZUL_TEXTO}; text-transform: uppercase; letter-spacing: 1px;">Tipo</th>
              <th style="padding: 12px 14px; text-align: left; font-size: 10px; font-weight: bold; color: ${AZUL_TEXTO}; text-transform: uppercase; letter-spacing: 1px;">Data</th>
              <th style="padding: 12px 14px; text-align: right; font-size: 10px; font-weight: bold; color: ${AZUL_TEXTO}; text-transform: uppercase; letter-spacing: 1px;">Quantidade</th>
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>

        <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
          Acesse o <a href="https://portalgeolog.com.br/portal/os" style="color: ${AZUL}; text-decoration: none; font-weight: bold;">Portal Geolog</a> para revisar e lançar os valores pendentes.
        </p>
      </div>

      <div style="background-color: ${AZUL_CLARO}; padding: 16px 20px; text-align: center; border-top: 1px solid ${AZUL_BORDA}; font-size: 12px; color: ${AZUL_TEXTO}; font-weight: bold;">
        <p style="margin: 0;">© 2026 Geolog Transportes e Logística Ltda. — Alerta automático do sistema.</p>
      </div>
    </div>
  `;
}

/** Orquestra: busca OS com problema, monta HTML e envia via Resend. */
export async function sendAlertaValoresEmail(): Promise<{
  enviados: number;
  totalOS: number;
  itens: OSAlertaItem[];
}> {
  const resend = createResendClient();
  if (!resend) {
    throw new Error("RESEND_API_KEY não configurada");
  }

  const itens = await getFinalizadasSemValor();
  const recipients = getRecipients();
  const geracao = new Date();

  const html = buildAlertaValoresEmailHTML(itens, geracao);

  // Detecta turno pelo horário BRT (8h = matutino, 16h = vespertino)
  const horaBRT = new Intl.DateTimeFormat("pt-BR", {
    timeZone: getAlertaTimezone(),
    hour: "numeric",
    hour12: false,
  })
    .format(geracao)
    .replace(/[^0-9]/g, "");
  const turno =
    Number(horaBRT) < 12 ? "Aviso Matinal" : "Aviso Vespertino";

  const subject =
    itens.length === 0
      ? `Portal Geolog - ${turno} — Nenhum alerta encontrado`
      : `Portal Geolog - ${turno} de alertas encontrados`;

  const { error } = await resend.emails.send({
    from: "Portal Geolog <suporte@portalgeolog.com.br>",
    to: recipients,
    subject,
    html,
  });

  if (error) throw error;

  return { enviados: recipients.length, totalOS: itens.length, itens };
}
