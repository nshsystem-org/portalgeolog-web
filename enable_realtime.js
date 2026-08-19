const { Client } = require("pg");

async function enableRealtime() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error("SUPABASE_DB_PASSWORD não definido no ambiente.");
    process.exit(1);
  }

  const host =
    process.env.SUPABASE_DB_HOST || "aws-1-us-east-2.pooler.supabase.com";
  const port = process.env.SUPABASE_DB_PORT || "5432";
  const user = process.env.SUPABASE_DB_USER || "postgres.hzpgfapvjwqtjclriisz";
  const database = process.env.SUPABASE_DB_NAME || "postgres";
  const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Conectando ao banco de dados Supabase...");
    await client.connect();
    console.log("✅ Conectado!");

    const sql = `
      BEGIN;
      -- 1. Garante que a publicação 'supabase_realtime' existe
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
          CREATE PUBLICATION supabase_realtime; 
        END IF; 
      END $$;

      -- 2. Define as tabelas que PERMITE Realtime (sobrescreve a lista anterior para evitar erros de duplicidade)
      -- Usamos SET TABLE para definir exatamente a lista que queremos
      ALTER PUBLICATION supabase_realtime SET TABLE 
        clientes, 
        solicitantes, 
        ordens_servico, 
        centros_custo, 
        passageiros, 
        drivers, 
        tipos_servico;

      -- 3. Habilita o Realtime a nível de REPLICA (FULL permite ver o dado antigo e o novo no payload)
      -- Isso torna o sincronismo muito mais robusto
      ALTER TABLE clientes REPLICA IDENTITY FULL;
      ALTER TABLE solicitantes REPLICA IDENTITY FULL;
      ALTER TABLE ordens_servico REPLICA IDENTITY FULL;
      ALTER TABLE centros_custo REPLICA IDENTITY FULL;
      ALTER TABLE passageiros REPLICA IDENTITY FULL;
      ALTER TABLE drivers REPLICA IDENTITY FULL;
      ALTER TABLE tipos_servico REPLICA IDENTITY FULL;

      COMMIT;
    `;

    console.log("🚀 Executando comandos de ativação Realtime...");
    await client.query(sql);
    console.log("✨ REALTIME ATIVADO COM SUCESSO PARA TODAS AS TABELAS!");
  } catch (err) {
    console.error("❌ Erro ao ativar Realtime:", err.message);
    if (err.message.includes("password authentication failed")) {
      console.error("⚠️ A senha fornecida parece estar incorreta.");
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

enableRealtime();
