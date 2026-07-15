import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fromZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

/**
 * GET /api/pendencias
 *
 * Retorna TODAS as pendências do sistema (sem filtro de RLS), usando
 * a service role key. Espelha a lógica do cron pendencias-alert e do
 * PendenciaWarnings, mas enxerga todas as empresas.
 *
 * Categorias:
 *  - sem_valor: OS finalizada sem valor bruto e/ou custo
 *  - atrasada: OS atrasada ou não iniciada no dia
 *  - rascunho: rascunho antigo (ageDays >= 1) — filtrado por usuário
 *  - docagem: instância de docagem não finalizada com data no passado
 *
 * Query params:
 *  - user_id (opcional): para rascunhos pessoais
 */

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

function getTimezone(): string {
  return process.env.REMINDER_TIMEZONE ?? "America/Sao_Paulo";
}

interface PendenciaItemAPI {
  id: string;
  protocolo: string;
  os: string;
  clienteNome: string;
  data: string;
  motivo: "sem_valor" | "atrasada" | "rascunho" | "docagem";
  tipo: "os" | "freelance" | "rascunho" | "docagem";
  ageDays?: number;
}

interface OSRow {
  id: string;
  protocolo: string | null;
  os_number: string | null;
  cliente_id: string | null;
  data: string | null;
  hora: string | null;
  status_operacional: string | null;
  valor_bruto: number | string | null;
  custo: number | string | null;
  arquivado: boolean;
  tipo: string | null;
  created_at: string | null;
  created_by: string | null;
  isento_valor_bruto: boolean | null;
  isento_custo: boolean | null;
}

interface ClienteRow {
  id: string;
  nome: string;
}

interface DocagemRow {
  id: string;
  data: string;
  docagem_id: string;
  status: string;
  docagem: {
    protocolo: string | null;
    cliente_id: string | null;
  } | null;
}

/**
 * Verifica se uma OS está finalizada sem valor (espelha isFinalizadoSemValor).
 * Respeita flags individuais de isenção.
 */
function checkSemValor(row: OSRow): boolean {
  if (row.status_operacional !== "Finalizado") return false;
  const vBruto =
    typeof row.valor_bruto === "string" ? Number(row.valor_bruto) : row.valor_bruto;
  const vCusto =
    typeof row.custo === "string" ? Number(row.custo) : row.custo;
  const faltaVB =
    !row.isento_valor_bruto &&
    (vBruto === null || vBruto === undefined || vBruto === 0);
  const faltaC =
    !row.isento_custo &&
    (vCusto === null || vCusto === undefined || vCusto === 0);
  return faltaVB || faltaC;
}

/**
 * Verifica se uma OS está atrasada ou não iniciada (espelha isOsAtrasadaOuNaoIniciada).
 */
function checkAtrasada(
  row: OSRow,
  hojeStr: string,
  nowUtcMs: number,
  tz: string,
): boolean {
  if (row.arquivado) return false;
  if (row.tipo === "rascunho") return false;
  const status = row.status_operacional;
  if (!status || status === "Cancelado" || status === "Finalizado") return false;
  if (!row.data) return false;

  const parts = row.data.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return false;
  const osDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Data passada
  if (osDate < today) return true;

  // Dia atual + ainda Pendente/Aguardando com hora já passada
  if (
    osDate.getTime() === today.getTime() &&
    (status === "Pendente" || status === "Aguardando") &&
    row.hora
  ) {
    const [hStr, mStr] = row.hora.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr ?? "0", 10);
    if (!isNaN(h) && !isNaN(m)) {
      const [y, mo, d] = row.data.split("-").map(Number);
      const localIso = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      try {
        const utcDate = fromZonedTime(localIso, tz);
        if (nowUtcMs >= utcDate.getTime()) return true;
      } catch {
        // ignore
      }
    }
  }

  return false;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");

    const supabase = getAdminClient();
    const tz = getTimezone();
    const nowUtc = fromZonedTime(new Date(), tz);
    const hojeStr = nowUtc.toISOString().slice(0, 10);
    const nowUtcMs = nowUtc.getTime();
    const DAY_MS = 1000 * 60 * 60 * 24;

    // Buscar TODAS as OS não-arquivadas (service role = sem RLS).
    // Supabase limita a 1000 linhas por requisição, então fazemos paginação.
    const PAGE_SIZE = 1000;
    let osRows: OSRow[] = [];
    let page = 0;
    let done = false;
    while (!done) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(
          "id, protocolo, os_number, cliente_id, data, hora, status_operacional, valor_bruto, custo, arquivado, tipo, created_at, created_by, isento_valor_bruto, isento_custo",
        )
        .eq("arquivado", false)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        console.error("[api/pendencias] erro ao buscar OS:", error);
        return NextResponse.json({ error: "Erro ao buscar OS" }, { status: 500 });
      }
      const rows = (data || []) as unknown as OSRow[];
      if (rows.length === 0) {
        done = true;
      } else {
        osRows = osRows.concat(rows);
        page++;
        if (rows.length < PAGE_SIZE) done = true;
      }
    }

    // Buscar TODOS os clientes para lookup de nome
    const { data: clienteRows, error: clienteError } = await supabase
      .from("clientes")
      .select("id, nome")
      .limit(100000);

    if (clienteError) {
      console.error("[api/pendencias] erro ao buscar clientes:", clienteError);
    }

    const clienteMap = new Map<string, string>();
    for (const c of (clienteRows || []) as unknown as ClienteRow[]) {
      clienteMap.set(c.id, c.nome);
    }

    // Buscar docagens não finalizadas com data no passado
    const { data: docagemRows, error: docagemError } = await supabase
      .from("docagem_instancias")
      .select(
        "id, data, docagem_id, status, docagem:docagem_id (protocolo, cliente_id)",
      )
      .lt("data", hojeStr)
      .in("status", ["pendente", "andamento"])
      .limit(100000)
      .order("data", { ascending: true });

    if (docagemError) {
      console.error("[api/pendencias] erro ao buscar docagens:", docagemError);
    }

    // Processar OS
    const items: PendenciaItemAPI[] = [];
    const typedOsRows = (osRows || []) as unknown as OSRow[];

    for (const row of typedOsRows) {
      // Rascunhos antigos do usuário (pessoal)
      if (row.tipo === "rascunho") {
        if (!userId) continue;
        if (row.created_by && row.created_by !== userId) continue;
        const createdMs = row.created_at
          ? new Date(row.created_at).getTime()
          : nowUtcMs;
        const ageDays = Math.floor((nowUtcMs - createdMs) / DAY_MS);
        if (ageDays < 1) continue;
        items.push({
          id: row.id,
          protocolo: row.protocolo || "",
          os: row.os_number || "",
          clienteNome: clienteMap.get(row.cliente_id ?? "") || "Cliente não informado",
          data: row.data || "",
          motivo: "rascunho",
          tipo: "rascunho",
          ageDays,
        });
        continue;
      }

      // OS / Freelance
      const semValorFlag = checkSemValor(row);
      const atrasadaFlag = checkAtrasada(row, hojeStr, nowUtcMs, tz);

      if (semValorFlag) {
        items.push({
          id: row.id,
          protocolo: row.protocolo || "",
          os: row.os_number || "",
          clienteNome: clienteMap.get(row.cliente_id ?? "") || "Cliente não informado",
          data: row.data || "",
          motivo: "sem_valor",
          tipo: (row.tipo as "os" | "freelance") || "os",
        });
      }
      if (atrasadaFlag) {
        items.push({
          id: row.id,
          protocolo: row.protocolo || "",
          os: row.os_number || "",
          clienteNome: clienteMap.get(row.cliente_id ?? "") || "Cliente não informado",
          data: row.data || "",
          motivo: "atrasada",
          tipo: (row.tipo as "os" | "freelance") || "os",
        });
      }
    }

    // Processar docagens
    const typedDocagemRows = (docagemRows || []) as unknown as DocagemRow[];
    for (const doc of typedDocagemRows) {
      const ageDays = Math.floor(
        (nowUtcMs - new Date(doc.data).getTime()) / DAY_MS,
      );
      const docagemInner = doc.docagem;
      items.push({
        id: doc.id,
        protocolo: docagemInner?.protocolo || "",
        os: "",
        clienteNome:
          clienteMap.get(docagemInner?.cliente_id ?? "") ||
          "Cliente não informado",
        data: doc.data,
        motivo: "docagem",
        tipo: "docagem",
        ageDays,
      });
    }

    // Contagens por categoria
    const counts = {
      semValor: items.filter((i) => i.motivo === "sem_valor").length,
      atrasadas: items.filter((i) => i.motivo === "atrasada").length,
      rascunhos: items.filter((i) => i.motivo === "rascunho").length,
      docagens: items.filter((i) => i.motivo === "docagem").length,
      total: items.length,
    };

    return NextResponse.json({
      items,
      counts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/pendencias] Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
