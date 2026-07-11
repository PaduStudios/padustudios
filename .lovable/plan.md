## Objetivo

Trazer do SuperSaaS via CSV:
1. **Cadastro de clientes/bandas** → tabela `clients`
2. **Agendamentos passados (histórico)** → tabela `appointments`

## Por que CSV

- Formato bruto, sem HTML/estilos: cada linha vira 1 registro, sem parsing frágil.
- SuperSaaS exporta CSV nativamente em **Supervise → Users** (para clientes) e em **Reports → Appointments/Usage report** (para agendamentos). É o mesmo caminho pros planos pagos e o trial.
- XLS/HTML só compensariam se o CSV não estivesse disponível — não é o seu caso.

## Como vai funcionar no app

Uma nova tela **Configurações → Importar do SuperSaaS** com 3 passos:

### Passo 1 — Upload dos dois CSVs
- Dois campos de upload:
  - `users.csv` (cadastro)
  - `appointments.csv` (histórico de ensaios)
- O app lê os arquivos no navegador (nada sai do computador do usuário até confirmar).

### Passo 2 — Mapeamento de colunas + prévia
Os nomes de coluna do SuperSaaS variam de acordo com a configuração da agenda, então o app mostra um preview das 5 primeiras linhas e deixa você mapear cada coluna:

Para **clientes**:
```
CSV do SuperSaaS         →   Campo Padu OS
------------------------      ----------------
Full name                →   name
Phone / Mobile           →   phone   (obrigatório — é a chave de dedupe)
Email                    →   email
Company / Band           →   band
[custom field]           →   members
Sign-up source           →   origin
Notes                    →   notes
Sign-up date             →   createdAt
```

Para **agendamentos**:
```
CSV do SuperSaaS         →   Campo Padu OS
------------------------      ----------------
User / Full name         →   (usado pra achar o cliente por nome + telefone)
Phone                    →   (fallback pra achar o cliente)
Date                     →   date   (aceita dd/mm/yyyy, yyyy-mm-dd, mm/dd/yyyy)
Start time               →   start  (HH:mm)
End time / Duration      →   end    (calcula se só vier duração)
Resource / Schedule      →   room
Price                    →   price
Payment                  →   payment_method
Status                   →   status (mapeia: paid/booked → confirmed, cancelled → cancelled, etc.)
Comment / Notes          →   notes
```

O mapeamento é salvo em localStorage pra você não refazer numa reimportação.

### Passo 3 — Preview + confirmação
Mostra um resumo:
- N clientes novos, M clientes já existentes (dedupe por telefone normalizado — só dígitos)
- N agendamentos importados, X descartados (sem cliente correspondente ou data inválida)
- Lista dos descartados com o motivo, exportável em CSV pra corrigir manualmente
- Botão **Importar tudo**

### Regras de import

- **Dedupe de clientes**: pelo telefone normalizado (`replace(/\D/g, '')`). Se já existir, atualiza campos vazios; nunca sobrescreve dados existentes.
- **Agendamentos → cliente**: procura primeiro por telefone; se não achar, por nome exato (case-insensitive). Se falhar os dois, marca como descartado.
- **Status padrão**: importados como `confirmed` (pra histórico), exceto se o CSV explicitamente marcar cancelado.
- **Datas passadas**: mantidas como estão — aparecem no calendário nas semanas correspondentes ao rolar pra trás.

## Onde os dados vão parar (importante)

Hoje o app ainda usa **localStorage** (mock store). Ou seja: o import vai popular seu navegador. Vantagens:
- Rápido, sem back-end, você já testa hoje.
- Se apagar o cache do navegador, perde. Reimporta.

Quando você me pedir pra plugar o Lovable Cloud (tabelas `clients` e `appointments` já existem no Supabase), a mesma tela de import passa a escrever no banco em vez do localStorage — **sem mudar a UI de import**, só troca o `store.addClient`/`store.addAppointment` pela versão Supabase. O CSV que você usar hoje continua servindo.

## O que preciso de você antes de codar

1. **Confirmar o caminho acima** — CSV via tela de import no app.
2. **Um CSV de exemplo do SuperSaaS** (pode ser só as primeiras linhas, com nomes ou dados de teste) pra eu:
   - Já deixar o auto-mapping pré-preenchido com os nomes exatos das colunas que o SuperSaaS usa na sua conta
   - Testar o parser com datas/horários no formato real
3. **Decisão sobre `origin`**: SuperSaaS não tem esse conceito. Trato tudo como `other`, ou você quer setar um valor fixo (ex.: `supersaas`) pra rastrear a origem da importação?

## Arquivos que vou criar (na fase build)

- `src/routes/_shell.settings.import.tsx` — rota da tela de import
- `src/components/import/import-wizard.tsx` — wizard de 3 passos
- `src/components/import/csv-preview.tsx` — tabela de preview
- `src/components/import/column-mapper.tsx` — UI de mapeamento
- `src/lib/import/supersaas-csv.ts` — parser + normalização (datas BR/US, telefones, status)
- `src/lib/import/index.ts` — orquestrador (dedupe, aplicação no store)
- Link no menu lateral: **Configurações → Importar**

Sem alterações no Supabase agora — só front-end + mock store.
