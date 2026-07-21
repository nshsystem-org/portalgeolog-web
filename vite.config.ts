import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Injetar TODAS as variáveis de ambiente que começam com NEXT_PUBLIC_ ou SUPABASE_
  // Isso garante que todas as variáveis necessárias estejam disponíveis
  const envDefines = Object.fromEntries(
    Object.entries(env)
      .filter(
        ([key]) =>
          key.startsWith("NEXT_PUBLIC_") ||
          key.startsWith("SUPABASE_") ||
          key === "RESEND_API_KEY",
      )
      .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );

  // Otimizações de DEV ONLY — não afetam build/prod (wrangler deploy usa dist/)
  const devOptimizations =
    command === "serve"
      ? {
          // Pré-bundleia dependências pesadas com esbuild (cold start mais rápido)
          optimizeDeps: {
            include: [
              "react",
              "react-dom",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "@supabase/supabase-js",
              "@supabase/ssr",
              "@fullcalendar/core",
              "@fullcalendar/react",
              "@fullcalendar/daygrid",
              "@fullcalendar/timegrid",
              "@fullcalendar/list",
              "@fullcalendar/interaction",
              "@tiptap/react",
              "@tiptap/starter-kit",
              "@tiptap/extension-text-align",
              "@tiptap/extension-underline",
              "framer-motion",
              "@googlemaps/js-api-loader",
              "date-fns",
              "date-fns-tz",
              "lucide-react",
              "sonner",
              "clsx",
              "tailwind-merge",
              "pdf-lib",
              "openai",
              "resend",
            ],
          },
          // HMR mais agressivo (polling pra filesystems lentos / WSL / ProtonDrive)
          server: {
            hmr: { overlay: true },
            // Não watcher node_modules nem .next nem dist (economiza CPU)
            watch: {
              ignored: [
                "**/node_modules/**",
                "**/.next/**",
                "**/dist/**",
                "**/.git/**",
              ],
            },
          },
        }
      : {};

  return {
    define: envDefines,
    plugins: [
      vinext(),
      tailwindcss(),
      ...(command === "build"
        ? [
            cloudflare({
              viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
            }),
          ]
        : []),
    ],
    ...devOptimizations,
  };
});
