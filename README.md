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

# WhatsApp Cloud API (para resposta automática)
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

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

A resposta automática será enviada para qualquer mensagem recebida do cliente (texto, imagem, áudio, vídeo, documento, localização ou clique em botão).

### Configuração do Webhook na Meta

1. Acesse o [Facebook Developers](https://developers.facebook.com/)
2. Vá para sua aplicação WhatsApp
3. Configure o webhook com:
   - **URL**: `https://seu-dominio.vercel.app/api/webhook`
   - **Verify Token**: O mesmo valor de `WEBHOOK_VERIFY_TOKEN`
   - **Campos de assinatura**: Selecione `messages`

## Estrutura de Dados

Os webhooks são salvos na tabela `whatsapp_messages` do Supabase com os seguintes campos:

- `message_id`: ID único da mensagem
- `from_number`: Número do remetente
- `to_number`: Número de destino (phone_number_id)
- `timestamp`: Timestamp da mensagem
- `message_type`: Tipo da mensagem (text, image, audio, etc.)
- `message_body`: Conteúdo da mensagem (quando aplicável)
- `raw_payload`: Payload completo do webhook (JSONB)
- `created_at`: Data de criação do registro

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy

O projeto está configurado para deploy automático na Vercel através do GitHub.

## Licença

ISC
