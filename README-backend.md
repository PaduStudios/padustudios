# Backend — CRM Padu OS

Todo o backend do CRM (schema do banco + camada de acesso a dados) vive
neste repositório e é portátil para qualquer Postgres com PostgREST
(Supabase Cloud, Supabase self-hosted, Neon, Railway, RDS + PostgREST,
Nhost, etc). A app não depende de nada exclusivo do Lovable.

---

## 1. O que está no Git

```
db/
  schema.sql                  # Schema completo: tabelas, índices, GRANTs,
                              # RLS, policies, triggers.
src/
  integrations/supabase/      # Cliente TS (browser + server) —
                              # apenas URL + chave, sem lógica proprietária.
  lib/scheduling/             # Regras de negócio do CRM (puras, sem I/O):
    availability.ts           # Motor de disponibilidade inteligente
    store.ts                  # Camada de estado (hoje localStorage, pronta
                              # para trocar por Supabase sem tocar na UI).
    time.ts                   # Helpers de horários
    types.ts                  # Domínio (Client, Appointment, Lead, ...)
  routes/                     # Rotas TanStack Start (SSR + client)
.env.example                  # Variáveis de ambiente exigidas
```

---

## 2. Esquema do banco

**Tabelas em `public`:**

| Tabela         | Campos principais                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `clients`      | `name`, `phone`, `email`, `cpf`, `band`, `members`, `origin`, `notes`, `created_at`, `updated_at`   |
| `appointments` | `client_id` (FK → clients, ON DELETE CASCADE), `date`, `start_time`, `end_time`, `ends_next_day`, `status`, `room`, `price`, `payment_method`, `notes` |

**Índices:** `clients_phone_idx`, `appointments_client_idx`, `appointments_date_idx`.

**Trigger:** `update_clients_updated_at` chama `public.update_updated_at_column()` antes de cada UPDATE.

**RLS:** habilitada em ambas. Policies atuais são permissivas (acesso público) — apropriado para o CRM interno rodando atrás de auth de app ou VPN. Endureça se for expor publicamente (ver seção 6).

---

## 3. Subir em qualquer Postgres

```bash
# 1. Criar o banco (exemplo com Postgres puro)
createdb padu_crm

# 2. Aplicar o schema
psql "postgres://user:pass@host:5432/padu_crm" -f db/schema.sql
```

Para a app conversar com esse banco você também precisa de **PostgREST**
(ou Supabase, que já embute PostgREST + Auth). Opções:

- **Supabase Cloud** — cria projeto novo, pega URL + anon key.
- **Supabase self-hosted** — [docker-compose oficial](https://supabase.com/docs/guides/self-hosting/docker).
- **PostgREST standalone** — [docs](https://postgrest.org/en/stable/) apontando para o Postgres acima.

---

## 4. Rodar localmente com Supabase CLI

```bash
# Instalar CLI: https://supabase.com/docs/guides/cli
supabase start
psql "$(supabase status -o json | jq -r .DB_URL)" -f db/schema.sql
```

O `supabase start` imprime as URLs/keys locais — copie para o `.env`.

---

## 5. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
# Browser (Vite) — expostas ao cliente
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=xxx

# Servidor (TanStack server functions)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx   # NUNCA expor no cliente
```

Rodando:

```bash
bun install
bun run dev      # http://localhost:8080
bun run build    # gera dist/ para deploy
```

---

## 6. Endurecer segurança (produção pública)

As policies atuais liberam CRUD público. Antes de expor à internet aberta,
adicione autenticação real e substitua por policies com escopo:

```sql
-- Exemplo: apenas usuários autenticados
DROP POLICY "public read clients" ON public.clients;
CREATE POLICY "authed read clients"
  ON public.clients FOR SELECT TO authenticated USING (true);
```

Ajuste os `GRANT`s para remover `anon` se não houver leitura pública.

---

## 7. Migrar dados do Lovable Cloud para outro provedor

1. No Lovable: **Cloud → Advanced settings → Export data** (gera dump SQL).
2. Aplique o schema no destino: `psql "$DATABASE_URL" -f db/schema.sql`.
3. Restaure os dados: `psql "$DATABASE_URL" -f dump.sql`.
4. Atualize `.env` para o novo host e redeploy.

---

## 8. Evoluindo o schema

Enquanto o backend rodar no Lovable Cloud, mudanças passam pela ferramenta
de migration da plataforma. **Sempre** espelhe a mudança em `db/schema.sql`
(ou crie `db/migrations/000X_*.sql` incrementais) para manter o Git como
fonte de verdade portátil.

Fora do Lovable, o fluxo é o de sempre:

```bash
psql "$DATABASE_URL" -f db/migrations/0002_add_room_table.sql
```
