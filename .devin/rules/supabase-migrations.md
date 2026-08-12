---
description: "Workflow de migrations Supabase e baseline sincronizado em 20260812"
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

### Baseline atual (20260812)

- Migrations locais ativas: 111 arquivos em `supabase/migrations/`
- Registros remotos em `supabase_migrations.schema_migrations`: 111
- Só-locais: 0
- Só-remotas: 0
- Snapshot do schema público remoto salvo em:
  `supabase/migrations_backup_pre_baseline_20260812/remote_public_schema_20260812.sql`
- Backup completo pré-baseline em:
  `supabase/migrations_backup_pre_baseline_20260812/`
- Backup histórico anterior em:
  `supabase/migrations_backup_pendentes/`

### Contagem de produção (validada pós-reconciliação)

- 55 tabelas públicas
- 108 funções
- 44 triggers
- 127 policies
- 22 tabelas em `supabase_realtime`
- 4 cron jobs
- 3.415 OS, 24 clientes, 204 motoristas, 20 bancos, 1 conta de caixa

### Docker indisponível

A CLI do Supabase (`supabase db dump`, `supabase db pull`) depende do Docker, que **não está disponível** nesta máquina. Comandos que funcionam sem Docker:

- `supabase migration list` (comparar local vs remoto)
- `supabase migration repair <versão> --status applied|reverted` (ajustar só o histórico)
- `supabase db push --dry-run` (verificar se há pendências)
- `supabase migration new <nome>` (criar arquivo local)

Para inspecionar o schema remoto, usar `execute_sql` do `supabase-mcp-server` em vez de `pg_dump`.

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
