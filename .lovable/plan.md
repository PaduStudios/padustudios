## O que vai mudar

### 1) Alinhamento das linhas do calendário
Arquivo: `src/components/calendar/week-grid.tsx`
- Causa: o body tem scroll vertical (~15px) e o header não; as colunas `1fr` do body ficam mais estreitas que as do header, então o destaque de "hoje" e as linhas verticais saem do lugar.
- Fix: usar `scrollbar-gutter: stable` no container com scroll e espelhar a mesma reserva no header (padding-right igual ou wrapper equivalente), garantindo que ambas as grades usem a mesma largura útil.
- Sem mudança de layout, tipografia ou cores.

### 2) Import passa a gravar no backend
Hoje o store é 100% localStorage. As tabelas `clients` e `appointments` já existem no Lovable Cloud com policies públicas; falta ligar.

**`src/lib/scheduling/store.ts` (reescrever)**
- Manter a mesma API pública (`addClient`, `findClientByPhone`, `updateClient`, `deleteClient`, `addAppointment`, `updateAppointment`, `deleteAppointment`, `subscribe`, `getSnapshot`, `getServerSnapshot`) — nenhuma tela precisa mudar.
- Boot: `select *` de `clients` e `appointments`, mapeando snake_case ↔ camelCase (`start_time`↔`start`, `end_time`↔`end`, `payment_method`↔`paymentMethod`, `ends_next_day` idem).
- Cada mutação chama `supabase.from(...).insert/update/delete(...)`; em sucesso atualiza o cache em memória e emite para subscribers.
- `leads` continuam em memória (não há tabela — fora de escopo).

**`src/lib/import/index.ts`**
- `commit()` vira `async`: um `insert(rows).select()` de clientes, depois um `insert(rows)` de agendamentos, resolvendo os `_clientKey` `new:i` com os UUIDs retornados. Merges vão em `Promise.all` de `update().eq('id', ...)`.
- Assinatura de retorno continua `CommitResult`.

**`src/components/import/import-wizard.tsx`**
- `doImport()` vira async com estado `importing` para desabilitar o botão e mostrar toast enquanto roda o bulk.

## Fora de escopo
- Migrar `leads` e o formulário público `book.tsx` (usam store local — próxima etapa).
- Realtime via `postgres_changes` (por ora, mutações locais já disparam re-render; refresh puxa do banco).
- Scoping por usuário — as policies atuais são `public`, coerente com single-tenant.

## Verificação
1. `bunx tsgo` para checar tipos do novo store.
2. Playwright headless: abrir `/settings/import`, upar `Agenda_Padu_Studios.csv`, clicar "Importar tudo", ir pra `/calendar`, dar reload e confirmar que os ~272 ensaios continuam lá.
3. Screenshot do calendário para conferir alinhamento cabeçalho ↔ colunas com e sem "hoje" em destaque.
