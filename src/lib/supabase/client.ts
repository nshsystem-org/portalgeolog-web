import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function parseCookieHeader(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((cookie) => {
      const [name, ...rest] = cookie.split("=");
      return {
        name: decodeURIComponent(name.trim()),
        value: rest.length ? decodeURIComponent(rest.join("=")) : "",
      };
    });
}

function setCookieHeader(
  name: string,
  value: string,
  options?: Record<string, unknown>,
) {
  if (typeof document === "undefined") return;
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (!options) {
    document.cookie = cookieString;
    return;
  }
  if (options.path) cookieString += `; path=${options.path}`;
  if (options.domain) cookieString += `; domain=${options.domain}`;
  if (typeof options.maxAge === "number")
    cookieString += `; max-age=${options.maxAge}`;
  if (options.expires instanceof Date)
    cookieString += `; expires=${options.expires.toUTCString()}`;
  else if (typeof options.expires === "string")
    cookieString += `; expires=${options.expires}`;
  if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;
  if (options.secure) cookieString += `; secure`;
  if (options.httpOnly) cookieString += `; httponly`;
  document.cookie = cookieString;
}

export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
      cookies: {
        getAll() {
          return parseCookieHeader();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            setCookieHeader(name, value, options);
          });
        },
      },
    },
  );

  return client;
}
