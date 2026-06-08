import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Configurar Edge Runtime para Cloudflare Workers
export const runtime = "edge";

type UserRoleRow = {
  id: string;
  nome: string | null;
  tipo_usuario: string | null;
  categoria: string | null;
  empresa_id: string | null;
  specific_permissions: Record<string, unknown> | null;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for gestão de acesso",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  return apiKey ? new Resend(apiKey) : null;
}

async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
}

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const authClient = await createAuthClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("categoria")
    .eq("id", user.id)
    .single();

  if (!role || role.categoria !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  return { userId: user.id };
}

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Busca os perfis (roles)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("user_roles")
      .select("*");

    if (profileError) {
      console.error("Error fetching user_roles:", profileError);
      throw profileError;
    }

    // 2. Busca os usuários do Authentication
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    // 3. Mescla os dados
    const users = authData.users.map((user: SupabaseUser) => {
      const profile = profiles?.find((p: UserRoleRow) => p.id === user.id);
      return {
        id: user.id,
        email: user.email,
        nome: profile?.nome || user.user_metadata?.full_name || "Desconhecido",
        tipo_usuario: profile?.tipo_usuario || "interno",
        categoria: profile?.categoria || "operador",
        empresa_id: profile?.empresa_id,
        specific_permissions: profile?.specific_permissions || {},
        created_at: user.created_at,
      };
    });

    return NextResponse.json(users);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabaseAdmin = createSupabaseAdminClient();

    const { id, updates } = await request.json();

    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user_roles:", error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabaseAdmin = createSupabaseAdminClient();
    const resend = createResendClient();

    const { email, nome, tipo_usuario, categoria } = await request.json();

    // 1. Criar o usuário no Auth (Admin)
    const passwordDefault = crypto.randomUUID().slice(0, 12);
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: passwordDefault,
        email_confirm: true,
        user_metadata: { full_name: nome },
      });

    if (authError) {
      console.error("Error creating auth user:", authError);
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Atualizar ou Inserir na tabela user_roles
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({
      id: userId,
      nome: nome,
      tipo_usuario: tipo_usuario || "interno",
      categoria: categoria || "operador",
    });

    if (roleError) {
      console.error("Error inserting user_role:", roleError);
      throw roleError;
    }

    // 3. Enviar E-mail de Boas-vindas profissional
    try {
      if (resend) {
        await resend.emails.send({
          from: "Portal Geolog <suporte@portalgeolog.com.br>",
          to: email,
          subject: "Bem-vindo ao Portal Geolog - Suas Credenciais de Acesso",
          html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #001C3A; padding: 40px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">Portal Geolog</h1>
            </div>
            <div style="padding: 40px; background-color: #fff;">
              <h2 style="color: #001C3A; margin-top: 0;">Olá, ${nome}!</h2>
              <p style="font-size: 16px; line-height: 1.6;">Sua conta foi criada com sucesso no <strong>Portal Geolog</strong>. Abaixo estão suas credenciais de acesso:</p>
              
              <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 14px; color: #64748b;">E-mail de Acesso:</p>
                <p style="margin: 5px 0 15px 0; font-size: 18px; font-weight: bold; color: #0f172a;">${email}</p>
                
                <p style="margin: 0; font-size: 14px; color: #64748b;">Senha Temporária:</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #0f172a;">${passwordDefault}</p>
              </div>

              <div style="background-color: #fff4e5; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #ffe7cc; color: #854d0e; font-size: 14px; font-weight: bold; text-align: center;">
                ⚠️ Nota: Por motivos de segurança, você deverá alterar sua senha após o primeiro acesso.
              </div>

              <div style="text-align: center; margin: 40px 0;">
                <a href="https://portalgeolog.com.br/login" style="background-color: #001C3A; color: #fff; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Acessar o Painel</a>
              </div>

              <hr style="border: 0; border-top: 1px solid #eee; margin: 40px 0;" />
              
              <p style="font-size: 13px; color: #94a3b8; text-align: center;">
                &copy; 2026 Geolog Transportes e Logística Ltda.
              </p>
            </div>
          </div>
        `,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr);
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabaseAdmin = createSupabaseAdminClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) throw new Error("ID do usuário é obrigatório");

    // 1. Limpar referências em ordens_servico para evitar erro de foreign key
    await supabaseAdmin
      .from("ordens_servico")
      .update({ created_by: null })
      .eq("created_by", id);

    // 2. Limpar referências em app_notifications
    await supabaseAdmin
      .from("app_notifications")
      .update({ created_by: null })
      .eq("created_by", id);

    // 3. Limpar referências em veiculos
    await supabaseAdmin
      .from("veiculos")
      .update({ created_by: null })
      .eq("created_by", id);

    // 4. Deletar notificações pessoais do usuário (notifications tem cascade)
    await supabaseAdmin.from("notifications").delete().eq("user_id", id);

    // 5. Deletar notificações do sistema para este usuário
    await supabaseAdmin.from("app_notifications").delete().eq("user_id", id);

    // 6. Deletar da tabela user_roles (tem cascade para user_presence)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("id", id);

    if (roleError) {
      console.error("Error deleting user_role:", roleError);
      // Não bloqueamos aqui pois o Auth ainda pode ser removido,
      // mas se falhar por FK, o próximo passo falhará.
    }

    // 7. Deletar do Auth (Admin) - Isso remove o usuario do sistema
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      console.error("Error deleting auth user:", authError);
      throw authError;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Full delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
