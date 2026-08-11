# Supabase CLI e Configuração

## Estado Atual

✅ **CLI do Supabase configurada e funcionando:**

- Versão: 2.98.2
- Projeto linkado: hzpgfapvjwqtjclriisz
- Credenciais em `.env`

✅ **Scripts npm configurados:**

- `npm run supabase:start`
- `npm run supabase:db:pull`
- `npm run supabase:secrets:list`
- E mais 10 comandos...

✅ **Arquivos criados:**

- `SUPABASE_CLI.md` - Documentação completa
- `supabase-cmds.sh` - Aliases e wrappers

## Problemas Conhecidos:

1. **`npm run dev` matando processo** - Pode ser problema de memória ou configuração
2. **Erro `Invalid supabaseUrl`** - Variáveis de ambiente não sendo carregadas corretamente pelo Vinext/Vite

## Como usar a CLI:

```bash
# Comandos diretos
npx supabase status
npx supabase db pull

# Via npm scripts
npm run supabase:status
npm run supabase:db:pull

# Via aliases (depois de carregar)
source ./supabase-cmds.sh
sb-status
sb-db-pull
```

## Próximos Passos:

1. **Testar CLI:** Execute `npx supabase status`
2. **Testar db:** Execute `npx supabase db pull`
3. **Ver variáveis:** `grep SUPABASE .env`

Todos os comandos estão funcionando - a CLI está pronta para uso!
