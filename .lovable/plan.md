## Diagnóstico do seu CSV

O arquivo `Agenda_Padu_Studios.csv` **não** segue o formato "padrão" do SuperSaaS (users.csv + appointments.csv separados) que o wizard atual espera. É um export único com **273 linhas** onde cada linha é 1 agendamento + os dados do cliente denormalizados.

**Colunas detectadas:**
| Coluna do CSV | Vai virar |
|---|---|
| `Agenda Padu Studios` (Sala A / Gravação) | `appointment.room` |
| `Horário de início` (`DD/MM/YYYY   HH:MM`) | `appointment.date` + `appointment.start` |
| `Horário de fim` (`DD/MM/YYYY   HH:MM`) | `appointment.end` |
| `Descrição` | `appointment.notes` |
| `Nome completo` | `client.name` |
| `E-mail` | `client.email` |
| `Celular` | `client.phone` (chave de dedup) |
| `CPF` | `client.cpf` (descarta lixo tipo "00000") |
| `Nome da Banda` | `client.band` |
| `Estado` (`Aprovado` / `Aprovação pendente`) | `appointment.status` (`confirmed` / `pending`) |
| `Criado em` / `Atualizado em` / `Criado por` / `Atualizado por` | ignorados (metadados) |

**Estatísticas:** 248 em Sala A, 25 em Gravação · 267 Aprovado, 6 Pendente · ~147 clientes únicos por telefone · 175 linhas sem banda (só nome pessoal) · 3 sem email.

## Problemas do parser atual que precisam ser resolvidos

1. **Modo de arquivo único.** O wizard hoje pede 2 arquivos. Preciso adicionar modo "arquivo único combinado" onde o mesmo CSV alimenta clientes E agendamentos.
2. **Data + hora na mesma célula** com múltiplos espaços (`11/10/2025   14:00`). Parser atual espera `date` e `start` em colunas separadas.
3. **Telefones com caracteres invisíveis** (U+202A/U+202C bidi marks, U+2011 hifen não-quebrável). Ex: `‪+55 11 94900‑4009‬`. `normalizePhone` atual só remove `\D` no ASCII — precisa strip Unicode invisível antes.
4. **Agendamentos que cruzam meia-noite** (ex.: `21/10 20:00 → 22/10 00:00`). Modelo atual é single-day. Vou cortar em `23:59` na data de início e registrar aviso (5-6 linhas assim).
5. **CPFs lixo** (`00000`, `0000000`) devem virar campo vazio.
6. **Status** `Aprovado` (com espaços extras) → `confirmed`; `Aprovação pendente` → `pending`.

## O que muda no código

**Editar** `src/lib/import/supersaas-csv.ts`:
- `normalizePhone`: strip Unicode invisíveis/bidi antes do `\D`.
- Nova função `parseCombinedDateTime("DD/MM/YYYY   HH:MM")` → `{date, time}`.
- Novo hint set `PADU_COMBINED_HINTS` com as colunas em português acima.
- Novo normalizador de status incluindo "aprovado"/"aprovação pendente".
- Filtro de CPF: descarta se só tiver zeros ou < 11 dígitos.

**Editar** `src/lib/import/index.ts`:
- Novo orchestrator `importCombinedCsv(rows, mapping)` que:
  1. Deriva clientes deduplicados por telefone normalizado (fallback email→nome).
  2. Cria appointments referenciando o clientId.
  3. Trata cross-midnight (corta em 23:59 + adiciona nota).
  4. Devolve o mesmo relatório de sucesso/skipped.

**Editar** `src/components/import/import-wizard.tsx`:
- Passo 1 ganha toggle: **"Arquivo único (Padu Studios)"** vs **"Dois arquivos (SuperSaaS clássico)"**. Default no arquivo único.
- Passo 2 mostra os campos combinados numa coluna só quando em modo único.
- Preview do passo 3 continua igual (novos clientes / existentes / agendamentos / descartados).

**Sem mudança em:** store, tipos, telas de calendário, cadastro.

## Depois de implementar, o que faço

1. Rodo o parser contra o seu CSV via um teste rápido no sandbox e te reporto:
   - Nº de clientes criados vs esperado (~147)
   - Nº de agendamentos importados vs 273
   - Lista de descartados com o motivo (se houver)
2. Se estiver ok, você mesmo faz o upload em **Configurações → Importar** e confirma no browser.

## Fora do escopo

- Migrar store para Lovable Cloud (fica para outro passo — o import primeiro popula localStorage, depois migramos tudo junto).
- Importar leads/aprovações pendentes como fila separada (todas viram appointments com status `pending`).
- Reconstruir agendamentos cross-midnight como dois eventos (corta em 23:59 por ora).

Pode aprovar?