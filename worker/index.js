// Wrapper para Cloudflare Workers — importa o build do vinext
// e converte a função handler em um objeto Worker com método fetch
//
// CRON SCHEDULE (definido em wrangler.workers.toml → [triggers].crons):
//
//   "*/1 * * * *"     → /api/cron/os-reminders
//       Roda a cada 1 minuto. Cobre TODAS as fases de lembrete do motorista:
//         Fase 1: T-720min (12h antes)   → template lembrete_viagem_motorista
//         Fase 2: T-60min  (1h antes)    → template inicio_viagem_motorista (botão)
//         Fase 3: T-15min  (pre-start)   → template pre_start_viagem_motorista
//         Fase 4: T+5min   (atraso)      → template atraso_inicio_motorista (botão)
//         Fase 5: T+30min  (crítico)     → mesmo template + log para internos
//       A idempotência (os_cycle_reminders) garante que cada fase só envia uma vez.
//       As execuções intermediárias fazem apenas SELECT rápido no banco (custo baixo).
//       Feature flags em app_settings controlam cada fase independentemente.
//
//   "0 11 * * *"      → /api/cron/os-alerta-valores
//   "0 19 * * *"      → /api/cron/os-alerta-valores
//       Alertas de valores de OS (manhã e noite).
//
//   "0 */2 * * *"     → /api/cron/pendencias-alert
//       Alertas de pendências a cada 2 horas.

const worker = {
  async fetch(request, env, ctx) {
    // Injeta variáveis do Cloudflare no process.env para compatibilidade com vinext
    // ANTES de carregar o bundle server (evita capturas top-level de undefined)
    if (!globalThis.process) {
      globalThis.process = { env: {} };
    }

    // Primeiro, copia todas as variáveis do env do Cloudflare para process.env
    // Isso garante que referências top-level no bundle server funcionem
    Object.assign(globalThis.process.env, env);

    // Depois cria um Proxy para consultar env como fallback para novas propriedades
    const originalEnv = globalThis.process.env;
    globalThis.process.env = new Proxy(originalEnv, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop in env) return env[prop];
        return undefined;
      },
      has(target, prop) {
        return prop in target || prop in env;
      },
    });

    const { default: handler } = await import("../dist/server/index.js");

    return handler(request, ctx);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scheduled(controller, env, _ctx) {
    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
      console.warn("[worker] CRON_SECRET não configurado — pulando cron");
      return;
    }

    // Map cron expression → API route
    const cronRoutes = {
      "*/1 * * * *": "/api/cron/os-reminders",
      "0 11 * * *": "/api/cron/os-alerta-valores",
      "0 19 * * *": "/api/cron/os-alerta-valores",
      "0 */2 * * *": "/api/cron/pendencias-alert",
    };

    const route = cronRoutes[controller.cron];
    if (!route) {
      // Fallback: chama os-reminders para crons não mapeados (compat)
      console.log(
        `[worker] Cron '${controller.cron}' não mapeado — fallback os-reminders`,
      );
      await callCronRoute(
        "https://portalgeolog.com.br/api/cron/os-reminders",
        cronSecret,
      );
      return;
    }

    const url = `https://portalgeolog.com.br${route}`;
    await callCronRoute(url, cronSecret);
  },
};

async function callCronRoute(url, cronSecret) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      },
    });

    const body = await response.text();
    console.log(`[worker] Cron ${url} respondeu ${response.status}: ${body}`);
  } catch (error) {
    console.error(`[worker] Erro no cron ${url}:`, error);
  }
}

export default worker;
