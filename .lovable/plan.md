## Recomendação de canal

**Evolution API** (não-oficial, via QR Code) — melhor custo/benefício para um estúdio pequeno:
- Usa o próprio número comercial que você já divulga (sem migrar para número Meta).
- Gratuito para hospedar, sem taxa por mensagem.
- Setup em minutos: escaneia QR, pronto.
- Trade-off: risco de banimento se enviar disparos em massa não solicitados. O uso previsto (responder cliente, agendar, confirmar) tem risco baixo.

Se preferir zero risco de banimento, migramos para **WhatsApp Cloud API (Meta)** depois — a arquitetura fica idêntica; troca só o adaptador de envio.

## Arquitetura

```text
Cliente WhatsApp
      │
      ▼
Evolution API (self-host)  ──►  Webhook  ──►  /api/public/hooks/whatsapp  (TanStack server route)
                                                       │
                                                       ▼
                                              Motor de conversa
                                              ├─ Máquina de estados (agendamento)
                                              ├─ IA Lovable (FAQ / fallback)
                                              └─ Store (clientes, appointments)
                                                       │
                                                       ▼
                                    Envia resposta ← Evolution API ← WhatsApp
```

Cron pg_cron chama `/api/public/hooks/whatsapp-reminders` a cada 30 min → varre ensaios 24h à frente sem confirmação → dispara lembrete.

## Escopo v1

### 1. Configuração (aba Automação)
- Formulário: URL da Evolution API, token, número da instância.
- Botão "Conectar" mostra QR Code para escanear.
- Editor de **base de conhecimento**: pergunta ↔ resposta (preço, endereço, horário de funcionamento, política de cancelamento). A IA consulta essa base como contexto.
- Toggles: FAQ automático / Agendamento automático / Lembretes 24h / Modo humano-primeiro.
- Prompt personalizado do atendente (tom de voz, nome do estúdio).

### 2. Motor de conversa
- Nova mensagem chega → identifica cliente (busca por telefone; cria como lead se não existir).
- Detecta intenção via IA (`openai/gpt-5.5`):
  - `faq` → responde usando base de conhecimento.
  - `agendar` → entra na máquina de estados: pergunta dia → mostra horários livres reais → pergunta sala (Ensaio / Gravação ao Vivo / Gravação por Canal) → confirma preço → cria appointment como `pending`.
  - `cancelar` / `remarcar` → busca ensaio futuro do cliente e confirma ação.
  - `humano` (frases como "quero falar com atendente") → marca conversa como "aguardando humano", para o robô.
- Cada mensagem (entrada e saída) fica salva numa tabela `wa_messages` linkada ao `client_id`.

### 3. Confirmação 24h
- Cron a cada 30 min: seleciona appointments com data = hoje+1 e status `confirmed` que ainda não receberam lembrete.
- Envia: "Oi [banda]! Confirmando seu ensaio amanhã às [hora] na sala [sala]. Responde 1 para confirmar ou 2 para cancelar."
- Resposta atualiza status do appointment.

### 4. Caixa de entrada (nova rota `/inbox`, só admin)
- Lista de conversas com últimas 24h, ordenadas por mensagem mais recente.
- Coluna esquerda: conversas. Direita: histórico + campo para responder manualmente.
- Botão "Pausar robô nesta conversa" (24h) — o cliente fala só com você.
- Badge visível quando conversa está "aguardando humano".

## Banco (nova migração)

```text
wa_settings         (linha única)     evolution_url, token, instance, kb_json, prompt, toggles
wa_conversations    conversas         client_id, last_message_at, status, bot_paused_until
wa_messages         histórico         conversation_id, direction (in/out), text, sent_by (bot/human), created_at
appointments        + reminder_sent_at, confirmation_source
```

## Como vou entregar (3 fases)

1. **Fase 1 — Infra + FAQ** (foundation)
   - Tabelas, tela de config, conexão Evolution, webhook recebendo mensagens, IA respondendo FAQ com base de conhecimento. Você já pode testar respondendo perguntas simples.

2. **Fase 2 — Agendamento pelo chat + Caixa de entrada**
   - Máquina de estados de agendamento, integração com a agenda real, tela `/inbox` para acompanhar/responder manualmente.

3. **Fase 3 — Confirmação 24h**
   - Cron + fluxo de resposta 1/2.

## Detalhes técnicos

- Server routes públicos em `src/routes/api/public/hooks/*` (webhook Evolution + cron reminders), com verificação de token.
- Server function `sendWhatsAppMessage` centraliza o envio (fácil trocar para Meta Cloud API depois).
- IA via Lovable AI Gateway (`openai/gpt-5.5`), tools do AI SDK para intenções estruturadas (`schedule`, `cancel`, `faq`, `handoff`).
- Todas as respostas do robô ficam gravadas — auditoria completa do que ele disse.
- Nada de spam: robô só responde quem escreveu primeiro (exceto lembretes 24h de ensaios já confirmados).

Aprova o plano? Se sim, começo pela **Fase 1**.