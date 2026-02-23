# WhatsApp Webhook Monitor

Aplicação Next.js para receber e monitorar webhooks de mensagens do WhatsApp Cloud API da Meta.

## Funcionalidades

- Recebe webhooks do tipo "messages" da WhatsApp Cloud API
- Salva dados estruturados no Supabase
- Endpoint de verificação para configuração do webhook na Meta

## Estrutura do Projeto

```
whatsapp-webhook-monitor/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── route.ts      # Endpoint GET/POST para webhooks
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase.ts           # Cliente Supabase
│   └── webhook-processor.ts  # Processamento de webhooks
└── types/
    ├── webhook.ts            # Tipos do webhook
    └── supabase.ts           # Tipos do Supabase
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.local` com as seguintes variáveis:

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Webhook
WEBHOOK_VERIFY_TOKEN=your_verify_token_here

# API - Token de segurança (obrigatório para usar a API de envio)
API_KEY=your_api_key_here

# WhatsApp Cloud API - BMs e WABAs
# A estrutura (BMs, WABAs, phone_ids) fica nas tabelas bms e wabas no Supabase (veja migração em supabase/migrations/).
# No .env: apenas um token por BM. O nome da variável deve ser WHATSAPP_ACCESS_TOKEN_<NOME_BM>, onde <NOME_BM> é o campo "name" da tabela bms.
# Não é necessário WHATSAPP_ACCESS_TOKEN nem WHATSAPP_PHONE_NUMBER_ID (token e número vêm do Supabase + token por BM).
# Exemplo: se existe uma BM com name = "VIVENTI" no Supabase:
WHATSAPP_ACCESS_TOKEN_VIVENTI=EAA...
# Outra BM (name = "OUTRA_OPERACAO" na tabela bms):
# WHATSAPP_ACCESS_TOKEN_OUTRA_OPERACAO=EAA...

# OpenAI - Respostas Inteligentes com IA (opcional)
OPENAI_API_KEY=sk-your-openai-api-key
AI_ENABLED=true
AI_MODEL=gpt-4o-mini
```

### Respostas com IA (OpenAI Agents)

A aplicação suporta respostas inteligentes usando OpenAI Agents SDK. Quando configurado:

1. **AI_ENABLED**: Define se a IA está habilitada (`true`/`false`). Default: `true`
2. **OPENAI_API_KEY**: Chave da API OpenAI (obrigatória para usar IA)
3. **AI_MODEL**: Modelo a ser usado. Default: `gpt-4o-mini`. Opções: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`

Se a IA não estiver configurada ou ocorrer erro, o sistema usa a resposta padrão como fallback.

### Configuração da Resposta Automática

Para habilitar respostas automáticas, crie a tabela `response_config` no Supabase:

```sql
CREATE TABLE response_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_message TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO response_config (default_message, enabled) 
VALUES ('Olá! Agradecemos o seu retorno. Como podemos ajudar?', true);
```

A resposta automática é configurada **por número** na tabela `phone_numbers` (colunas `auto_reply_enabled` e `auto_reply_message`). A tabela `response_config` continua como fallback de mensagem quando a mensagem do número não está definida.

### BMs e WABAs (Supabase)

As contas WhatsApp são gerenciadas pelas tabelas `bms` e `wabas` no Supabase. No .env você define apenas o token de cada BM: `WHATSAPP_ACCESS_TOKEN_<name>`, onde `name` é o campo da tabela `bms`.

1. Execute a migração `supabase/migrations/20250222100000_create_bms_and_wabas.sql` (cria `bms` e `wabas`).
2. Insira uma BM: `INSERT INTO bms (name, meta_bm_id) VALUES ('VIVENTI', '570123512482433');`
3. Insira as WABAs (use o `id` retornado da BM ou busque por name): `INSERT INTO wabas (id, name, bm_id, phone_ids) VALUES ('1724376938524122', 'Viventi - Feirão 3', (SELECT id FROM bms WHERE name = 'VIVENTI'), '["1016451684884273"]');`
4. No .env: `WHATSAPP_ACCESS_TOKEN_VIVENTI=EAA...`

Para migrar dados que estavam em `WHATSAPP_ACCOUNTS_*`, copie o JSON (sem o token) para um arquivo no formato de `scripts/accounts-backup.example.json` e execute: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-whatsapp-accounts.js scripts/accounts-backup.json`. Ou insira manualmente via SQL no Supabase.

### Resposta automática e envio por número

- **Resposta automática** (habilitar e mensagem por número) fica na tabela **`phone_numbers`**:
  - **auto_reply_enabled**: ativa/desativa resposta automática naquele número (default: `false`).
  - **auto_reply_message**: texto da mensagem automática (nullable; fallback: `response_config.default_message`).
- **Permissão de envio** (hierarquia BM/WABA/número) fica em **`enabled_for_sending`** nas tabelas `bms`, `wabas` e `phone_numbers`.
- **Número para exibição** fica em **`phone_numbers.display_phone_number`**.

Exemplo no Supabase:

```sql
-- Habilitar resposta automática e definir mensagem
UPDATE phone_numbers SET auto_reply_enabled = true, auto_reply_message = 'Olá! Em breve responderemos.'
WHERE meta_phone_number_id = '823349844204985';

-- Desabilitar uso do número na API de envio
UPDATE phone_numbers SET enabled_for_sending = false WHERE meta_phone_number_id = '...';
```

### API de envio de template

- **Autenticação**: header `X-API-Key` com o valor de `API_KEY` (obrigatório).
- **WABA e número**: no body, `waba_id` é **obrigatório** (id na tabela `wabas` no Supabase); `phone_id` é opcional (usa o primeiro da conta se omitido). O token da Meta **não** é enviado na requisição; fica no .env como `WHATSAPP_ACCESS_TOKEN_<NOME_BM>`.
- **Contas**: BMs e WABAs são configuradas nas tabelas `bms` e `wabas` no Supabase. No .env, defina um token por BM: `WHATSAPP_ACCESS_TOKEN_<name da BM>`.

A resposta automática será enviada apenas para números com `auto_reply_enabled = true` em `phone_numbers`. Números com `enabled_for_sending = false` (em `bms`, `wabas` ou `phone_numbers`) não podem ser usados na API de envio.

### API de listagem de números (GET /api/phone-numbers)

- **Autenticação**: header `X-API-Key` (obrigatório).
- **Resposta**: lista de números com `waba_id`, `waba_name`, `bm_id`, `bm_name`, `phone_id`, `allowed_for_sending`, `auto_reply_enabled`, `message` e `phone_number` (id do Meta). Útil para consultar status de envio e quais números estão habilitados por WABA/BM.

### Configuração do Webhook na Meta

1. Acesse o [Facebook Developers](https://developers.facebook.com/)
2. Vá para sua aplicação WhatsApp
3. Configure o webhook com:
   - **URL**: `https://seu-dominio.vercel.app/api/webhook`
   - **Verify Token**: O mesmo valor de `WEBHOOK_VERIFY_TOKEN`
   - **Campos de assinatura**: Selecione `messages`

## Estrutura de Dados

Os webhooks são salvos em duas tabelas no Supabase:

**webhook_messages** — eventos do tipo "messages" (mensagens recebidas, statuses, cliques CTA, payload bruto):
- `message_id`, `from_number`, `to_number`, `timestamp`, `message_type`, `message_body`, `raw_payload`, `created_at`, `waba_id`, `phone_number_id`, `bm_id`, `bm_name`

**webhook_alerts** — eventos de alerta (account_alerts, business_capability_update, template updates, etc.):
- `waba_id` (entry.id do payload), `bm_id`, `bm_name`, `field`, `object`, `entity_type`, `entity_id`, `alert_type`, `alert_severity`, `alert_status`, `alert_description`, `raw_payload`, `created_at`

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy

O projeto está configurado para deploy automático na Vercel através do GitHub.

## Licença

ISC
