---
description: "Workflow de migrations Supabase e baseline sincronizado em 20260813"
trigger: always_on
---

## Supabase - Migrations

### Projeto

- Project ref: `hzpgfapvjwqtjclriisz`
- Project name: `portalgeolog-web`
- Region: `us-east-2`
- PostgreSQL: `17.6.1.084`
- Repo: `/home/hodu/projects/geolog/portalgeolog-web`
- Produção: https://portalgeolog.com.br
- GitHub: https://github.com/nshsystem-org/portalgeolog-web

### Baseline atual (20260813)

- Migrations locais ativas: 114 arquivos em `supabase/migrations/`
- Registros remotos em `supabase_migrations.schema_migrations`: 114
- Só-locais: 0
- Só-remotas: 0
- Snapshot do schema público remoto salvo em:
  `supabase/migrations_backup_pre_baseline_20260812/remote_public_schema_20260812.sql`
- Backup completo pré-baseline em:
  `supabase/migrations_backup_pre_baseline_20260812/`
- Backup histórico anterior em:
  `supabase/migrations_backup_pendentes/`
- Migrations pós-baseline (20260812):
  - `20260812215654_drop_passageiro_email_genero_notificar.sql`
  - `20260812223957_drop_passageiro_cpf.sql`
  - `20260813022809_drop_passageiro_enderecos.sql`
- Registro fantasma removido em 20260813: `20260812162424` (duplicata de `20260518000003_fix_passageiro_atomic_nulls` causada por re-aplicação antiga do CLI)

### Contagem de produção (validada pós-reconciliação 20260813)

- 54 tabelas públicas (era 55 — `passageiro_enderecos` removida)
- 108 funções
- 44 triggers
- 126 policies
- 22 tabelas em `supabase_realtime`
- 4 cron jobs
- 3.450 OS, 26 clientes, 208 motoristas, 20 bancos, 1 conta de caixa, 1.404 passageiros, 181 veículos

### Docker indisponível

A CLI do Supabase (`supabase db dump`, `supabase db pull`) depende do Docker, que **não está disponível** nesta máquina. Comandos que funcionam sem Docker:

- `supabase migration list` (comparar local vs remoto)
- `supabase migration repair <versão> --status applied|reverted` (ajustar só o histórico)
- `supabase db push --dry-run` (verificar se há pendências)
- `supabase migration new <nome>` (criar arquivo local)

Para inspecionar o schema remoto, usar `execute_sql` do `supabase-mcp-server` em vez de `pg_dump`.

### Conexão psql direta (alternativa quando MCP indisponível)

O MCP às vezes fica indisponível. Nesses casos, `psql` funciona pelo pooler `aws-1` (não `aws-0`):

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "host=aws-1-us-east-2.pooler.supabase.com port=5432 \
   user=postgres.hzpgfapvjwqtjclriisz dbname=postgres sslmode=require" \
  -c "SELECT 1;"
```

- `aws-0` retorna `ENOTFOUND tenant/user not found`
- `aws-1` na porta 5432 (session mode) funciona
- Porta 6543 (transaction mode) também rejeita o tenant
- Usar apenas para validações pontuais; migrations devem preferir o MCP `apply_migration` quando disponível

### Workflow obrigatório para novas migrations

1. `npx supabase migration new <nome>` — cria o arquivo local em `supabase/migrations/<timestamp>_<nome>.sql`
2. Escrever o SQL no arquivo
3. Aplicar no remoto via `apply_migration` do `supabase-mcp-server`, **usando exatamente o mesmo nome do arquivo local**
4. Conferir com `npx supabase migration list` — deve mostrar pareado, sem só-locais nem só-remotas
5. Validar efeitos via `execute_sql` (contagens, colunas, constraints)

Assim os dois lados nunca divergem.

### Regras de segurança para migrations

- **NUNCA** rodar `supabase db reset` em produção — apaga tudo
- **NUNCA** reexecutar DDL de migrations já aplicadas
- `supabase migration repair` mexe **só** na tabela de histórico, não executa SQL
- Antes de qualquer reorganização, copiar `supabase/migrations/` para um backup nomeado com data
- Timestamps de migration são chave única — nunca dois arquivos com o mesmo timestamp
- Se precisar renomear, preservar a ordem cronológica

### Tokens e segredos

- `SUPABASE_ACCESS_TOKEN` **não** deve ficar em `.env` sem autorização explícita
- Tokens colados no chat devem ser revogados e regerados após o uso
- `.env` contém: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`
- Para comandos CLI pontuais, exportar o token como variável de processo, não gravar em arquivo
