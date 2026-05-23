import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUserIdFromSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      errorLevel,
      component,
      functionName,
      errorMessage,
      errorStack,
      errorDetails,
      url,
      userAgent,
    } = body;

    const userId = await getUserIdFromSession();
    
    // Usar service role para gravar o log (ignora RLS de escrita para logs)
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabaseAdmin.from("frontend_error_logs").insert({
      user_id: userId,
      error_level: errorLevel || "error",
      component: component || null,
      function_name: functionName || null,
      error_message: errorMessage || null,
      error_stack: errorStack || null,
      error_details: errorDetails || null,
      url: url || request.headers.get("referer") || null,
      user_agent: userAgent || request.headers.get("user-agent") || null,
    });

    if (error) {
      console.error("Erro ao inserir log no Supabase:", error);
      return NextResponse.json({ error: "Erro ao salvar log" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao processar log de erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
