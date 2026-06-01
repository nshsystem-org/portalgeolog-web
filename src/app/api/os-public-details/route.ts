import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getAdmin = () => {
  if (!_supabaseAdmin)
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  return _supabaseAdmin;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const osId = searchParams.get("os_id");

    if (!osId) {
      return NextResponse.json(
        { success: false, error: "ID da OS não informado." },
        { status: 400 },
      );
    }

    const { data: os, error: osError } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, status_operacional, motorista, veiculo_id, protocolo, os_number, data, hora, driver_accepted_at, driver_km_initial, route_started_at, route_finished_at, route_finished_km",
      )
      .eq("id", osId)
      .single();

    if (osError || !os) {
      return NextResponse.json(
        { success: false, error: "Ordem de serviço não encontrada." },
        { status: 404 },
      );
    }

    let vehicle = null;
    if (os.veiculo_id) {
      const { data: v } = await getAdmin()
        .from("veiculos")
        .select("marca, modelo, placa")
        .eq("id", os.veiculo_id)
        .single();
      vehicle = v;
    }

    return NextResponse.json({
      success: true,
      os,
      vehicle,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
