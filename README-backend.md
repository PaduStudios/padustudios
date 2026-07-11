# Backend — schema versionado no Git

O schema completo do banco vive em [`db/schema.sql`](./db/schema.sql).
É SQL puro, portátil para qualquer Postgres com PostgREST — Supabase
Cloud, Supabase self-hosted, Neon, Railway, RDS, etc.

## Estrutura

```
db/
  schema.sql        # tabelas, índices, GRANTs, RLS, policies, triggers
.env.example        # variáveis de ambiente que a app espera
```

## Aplicar em qualquer Postgres

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Depois aponte o `.env` (ver `.env.example`) para o novo host. Nenhuma
mudança de código é necessária — a app usa `@supabase/supabase-js` com
URL + chave via env vars.

## Rodar Supabase local (opcional)

```bash
# https://supabase.com/docs/guides/cli
supabase start
psql "$(supabase status -o json | jq -r .DB_URL)" -f db/schema.sql
```

Copie as URLs/keys que o `supabase start` imprime para o `.env`.

## Migrar dados existentes do Lovable Cloud

1. Lovable → Cloud → Advanced settings → **Export data** (gera dump).
2. Restaure no destino: `psql "$DATABASE_URL" -f dump.sql`.
3. Troque as env vars do `.env` e faça redeploy.

## Mantendo o schema em sincronia

Enquanto o backend rodar no Lovable Cloud, mudanças de schema passam
pela ferramenta de migration do Lovable. **Sempre** espelhe a alteração
em `db/schema.sql` (ou adicione um novo arquivo `db/migrations/000X_*.sql`
se preferir migrations incrementais) — assim o Git continua sendo a
fonte de verdade portátil, independente da plataforma.
