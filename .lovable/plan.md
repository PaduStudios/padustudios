## Objetivo

Tornar o backend independente do Lovable Cloud, versionando schema e configuração no Git para poder migrar/rodar em qualquer provedor Postgres (Supabase self-hosted, Neon, Railway, RDS, etc).

## O que fica no Git

1. **`supabase/migrations/`** — pasta versionada com todo o SQL do schema atual (tabelas `clients`, `appointments`, policies, grants, função `update_updated_at_column`, triggers). Hoje as migrations rodam pelo tool do Lovable e não estão no repo — vou exportá-las para arquivos `.sql` numerados.
2. **`supabase/config.toml`** — já existe, mantido no repo.
3. **`supabase/seed.sql`** (opcional) — dados de exemplo para bootstrap local.
4. **`.env.example`** — documentando `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*` sem valores reais.
5. **`README-backend.md`** — instruções de como:
   - Rodar Postgres/Supabase localmente (`supabase start` ou Docker Compose)
   - Aplicar migrations (`supabase db push` ou `psql -f`)
   - Configurar variáveis de ambiente apontando para outro backend

## O que NÃO muda no código

O código da app já usa `@supabase/supabase-js` com URL + chave via env vars. Isso significa que apontar para outro Postgres com PostgREST/Supabase compatível é só trocar `.env` — nenhum refactor de componente necessário.

## Limitações a deixar claras

- **Dados**: registros existentes ficam no Lovable Cloud. Para migrar, exporta via Cloud → Advanced settings → Export data e importa no destino.
- **Auth**: se usar Supabase Auth self-hosted, precisa reconfigurar providers (Google OAuth etc).
- **Enquanto continuar no Lovable**: mudanças de schema feitas pelo tool do Lovable também precisam ser espelhadas nos arquivos `.sql` do repo (ou passar a criar as migrations manualmente e aplicar via CLI).

## Passos de implementação

1. Ler o schema atual via `supabase--read_query` no `information_schema` para gerar SQL fiel de `clients`, `appointments`, policies e grants.
2. Criar `supabase/migrations/0001_init.sql` com todo o schema.
3. Criar `.env.example` e `README-backend.md`.
4. Confirmar que build continua passando (sem mudanças de código de app).

## Perguntas antes de executar

- Você quer **continuar usando Lovable Cloud como backend ativo** e apenas ter o schema versionado como "plano B" de portabilidade? Ou quer **migrar agora** para outro provedor (Supabase self-hosted, Neon, etc)?
- Se migrar agora: qual destino?
