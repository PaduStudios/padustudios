# Backend — schema versionado

O schema do banco vive em `supabase/migrations/` e é totalmente
portátil: roda em qualquer Postgres com PostgREST (Supabase Cloud,
Supabase self-hosted, ou stack própria).

## Estrutura

```
supabase/
  config.toml             # config do CLI local
  migrations/
    0001_init.sql         # tabelas clients, appointments, policies, grants, triggers
```

## Rodando localmente (Supabase CLI)

```bash
# Instalar CLI: https://supabase.com/docs/guides/cli
supabase start           # sobe Postgres + Auth + PostgREST em Docker
supabase db reset        # aplica todas as migrations
```

O `supabase start` imprime as URLs/keys locais — copie para o `.env`.

## Aplicando em outro Postgres

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
```

Depois é só apontar o `.env` (ver `.env.example`) para o novo host.
Nenhuma mudança de código da app é necessária — tudo passa por
`@supabase/supabase-js` com URL + chave via env vars.

## Adicionando novas migrations

Crie arquivos numerados em ordem: `0002_add_x.sql`, `0003_...`.
Sempre siga o padrão CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY
para tabelas em `public`, senão o PostgREST bloqueia acesso.

## Migrando dados existentes do Lovable Cloud

1. Lovable → Cloud → Advanced settings → **Export data** (gera dump).
2. Restaure no destino: `psql "$DATABASE_URL" -f dump.sql`.
3. Troque as env vars do `.env` para o novo backend e faça redeploy.

## Enquanto continuar no Lovable Cloud

Mudanças de schema feitas via ferramentas do Lovable **também** precisam
ser espelhadas como novos arquivos `.sql` neste diretório para manter o
Git como fonte da verdade portátil.
