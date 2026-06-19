import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "edge";

const AVATAR_BUCKET = "profile-images";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );
}

function getStorageObjectPath(avatarUrl: string): string | null {
  try {
    const url = new URL(avatarUrl);
    const marker = `/object/public/${AVATAR_BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return url.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const driverId = formData.get("driverId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }
    if (typeof driverId !== "string" || !driverId) {
      return NextResponse.json({ error: "driverId obrigatório" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Selecione uma imagem válida" }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Imagem muito grande. Máximo 2MB." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: currentDriver, error: driverError } = await adminClient
      .from("drivers")
      .select("avatar_url")
      .eq("id", driverId)
      .single();

    if (driverError) throw driverError;

    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `drivers/${driverId}/${fileName}`;

    const { error: uploadError } = await adminClient.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = adminClient.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    const { error: updateError } = await adminClient
      .from("drivers")
      .update({ avatar_url: publicUrl })
      .eq("id", driverId);

    if (updateError) throw updateError;

    if (currentDriver?.avatar_url) {
      const oldPath = getStorageObjectPath(currentDriver.avatar_url);
      if (oldPath) {
        await adminClient.storage.from(AVATAR_BUCKET).remove([oldPath]);
      }
    }

    return NextResponse.json({ success: true, publicUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");
    if (!driverId) {
      return NextResponse.json({ error: "driverId obrigatório" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: currentDriver, error: driverError } = await adminClient
      .from("drivers")
      .select("avatar_url")
      .eq("id", driverId)
      .single();

    if (driverError) throw driverError;

    if (currentDriver?.avatar_url) {
      const oldPath = getStorageObjectPath(currentDriver.avatar_url);
      if (oldPath) {
        await adminClient.storage.from(AVATAR_BUCKET).remove([oldPath]);
      }
    }

    const { error: updateError } = await adminClient
      .from("drivers")
      .update({ avatar_url: null })
      .eq("id", driverId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
