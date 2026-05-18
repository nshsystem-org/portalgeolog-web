// Wrapper para Cloudflare Workers — importa o build do vinext
// e converte a função handler em um objeto Worker com método fetch

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
};

export default worker;
