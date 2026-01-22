# Instruções de Deploy e Configuração

## Status do Deploy

✅ Projeto criado no Supabase
✅ Tabela `whatsapp_messages` criada
✅ Projeto Next.js criado e configurado
✅ Repositório GitHub criado: https://github.com/collectlabs/whatsapp-webhook-monitor
✅ Deploy na Vercel concluído: https://whatsapp-webhook-monitor-m50vd9g4g.vercel.app

## Próximos Passos

### 1. Configurar Variáveis de Ambiente na Vercel

Acesse o dashboard da Vercel e configure as seguintes variáveis de ambiente:

1. Acesse: https://vercel.com/leonardo-sao-thiagos-projects-7841c1cd/whatsapp-webhook-monitor/settings/environment-variables

2. Adicione as seguintes variáveis:
   - `SUPABASE_URL`: `https://uxioxvsldxusgxtldmcd.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: [Obtenha no dashboard do Supabase em Settings > API > service_role key]
   - `WEBHOOK_VERIFY_TOKEN`: [Crie um token aleatório seguro para verificação do webhook]

### 2. Obter Service Role Key do Supabase

1. Acesse: https://supabase.com/dashboard/project/uxioxvsldxusgxtldmcd/settings/api
2. Copie a `service_role` key (não a anon key)
3. Cole no campo `SUPABASE_SERVICE_ROLE_KEY` na Vercel

### 3. Configurar Webhook na Meta

1. Acesse: https://developers.facebook.com/
2. Vá para sua aplicação WhatsApp
3. Navegue até: Configurações > Webhooks
4. Clique em "Configurar Webhooks"
5. Preencha:
   - **URL do Callback**: `https://whatsapp-webhook-monitor-m50vd9g4g.vercel.app/api/webhook`
   - **Token de Verificação**: O mesmo valor configurado em `WEBHOOK_VERIFY_TOKEN`
6. Selecione o campo de assinatura: `messages`
7. Salve e verifique

### 4. Testar o Webhook

Após configurar, envie uma mensagem de teste do WhatsApp para o número configurado na sua aplicação Meta. Verifique:

1. Os logs na Vercel: https://vercel.com/leonardo-sao-thiagos-projects-7841c1cd/whatsapp-webhook-monitor/logs
2. Os dados no Supabase: https://supabase.com/dashboard/project/uxioxvsldxusgxtldmcd/editor

## Estrutura da Tabela

A tabela `whatsapp_messages` armazena:
- `message_id`: ID único da mensagem do WhatsApp
- `from_number`: Número do remetente
- `to_number`: Número de destino (phone_number_id)
- `timestamp`: Timestamp da mensagem
- `message_type`: Tipo da mensagem (text, image, audio, etc.)
- `message_body`: Conteúdo da mensagem (quando aplicável)
- `raw_payload`: Payload completo do webhook (JSONB)
- `created_at`: Data de criação do registro

## URLs Importantes

- **Aplicação**: https://whatsapp-webhook-monitor-m50vd9g4g.vercel.app
- **Endpoint Webhook**: https://whatsapp-webhook-monitor-m50vd9g4g.vercel.app/api/webhook
- **GitHub**: https://github.com/collectlabs/whatsapp-webhook-monitor
- **Supabase Dashboard**: https://supabase.com/dashboard/project/uxioxvsldxusgxtldmcd
- **Vercel Dashboard**: https://vercel.com/leonardo-sao-thiagos-projects-7841c1cd/whatsapp-webhook-monitor
