import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const level = searchParams.get("level");
    const component = searchParams.get("component");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabase
      .from("frontend_error_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (level && level !== "all") {
      query = query.eq("error_level", level);
    }

    if (userId && userId !== "all") {
      query = query.eq("user_id", userId);
    }

    if (component && component !== "all") {
      query = query.ilike("component", `%${component}%`);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Erro ao buscar logs:", error);
      return NextResponse.json({ error: "Erro ao buscar logs" }, { status: 500 });
    }

    // Buscar informações dos usuários separadamente
    const userIds = data?.map(log => log.user_id).filter(Boolean) as string[];
    let usersMap: Record<string, { nome: string }> = {};
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("user_roles")
        .select("id, nome")
        .in("id", userIds);
      
      if (!usersError && users) {
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = { nome: user.nome };
          return acc;
        }, {} as Record<string, { nome: string }>);
      }
    }

    // Combinar logs com informações de usuários
    const logsWithUsers = (data || []).map(log => ({
      ...log,
      user: log.user_id ? usersMap[log.user_id] : null
    }));

    return NextResponse.json({
      logs: logsWithUsers,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
