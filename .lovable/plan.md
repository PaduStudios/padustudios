## Problema identificado

O evento de 13/07/2026 20h–22h no CSV é **"Lucas / GRAVAÇÃO DOS DR"** (telefone `000000`), mas no banco aparece vinculado ao cliente **"Calcinha preta"** (também com telefone `000000`).

Causa raiz: a importação inicial agrupou clientes pelo número de telefone. Vários registros distintos que compartilhavam o placeholder `000000` / `00000` foram fundidos em um único cliente, herdando o nome do primeiro que entrou. Isso afeta ao menos 3 agendamentos apontando para o mesmo `client_id` (Calcinha Preta, ensaio mensal e Dr.).

Como já revertemos a dedup por telefone no código, mas os dados no banco ainda estão fundidos, é preciso reimportar.

## Plano

1. **Limpar dados importados**
   - Apagar todos os registros de `appointments` e `clients` (importados do SuperSaaS). `finance_entries`, `wa_*` permanecem intactos.

2. **Ajustar a importação (`src/lib/import/index.ts` + wizard)**
   - Criar **um cliente por linha do CSV** que apresente telefone inválido/placeholder (vazio, `0`s repetidos, menos de 8 dígitos). Nada de mesclagem para esses.
   - Para telefones válidos, ainda mesclar somente quando **nome + telefone normalizado** baterem exatamente (evita perder nomes distintos que compartilham o mesmo número real). O usuário une o resto manualmente pelo CRM/Clientes.
   - Padronizar telefones válidos no formato E.164/BR na hora de gravar; placeholders ficam como estão (regra já combinada).

3. **Reimportar `Agenda_Padu_Studios.csv`**
   - Via wizard existente em `/settings/import`, com as regras acima.
   - Validar o caso do dia 13/07/2026: deve virar cliente "Lucas" com nota "GRAVAÇÃO DOS DR", separado do "Calcinha preta".

4. **Verificação**
   - Query no calendário do dia 13/07 mostra "Gravação · Lucas".
   - Contagens: total de agendamentos importados = linhas do CSV; nenhum cliente placeholder concentra 2+ nomes diferentes.

## Detalhes técnicos

- Considerar placeholder quando `normalizePhone(raw).length < 8` **ou** `/^0+$/.test(digits)`.
- Chave de merge para telefones válidos: `${normalizeName(name)}|${digits}` em vez de só `digits`.
- Nenhuma mudança de schema. Só lógica de importação + purge dos dados atuais.
