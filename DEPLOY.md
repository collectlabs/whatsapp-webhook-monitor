# Instruções de Deploy e Configuração

## Status do Deploy

✅ Projeto criado no Supabase
✅ Tabelas `webhook_messages` e `webhook_alerts` criadas
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
   - `API_KEY`: [Chave para autenticar send-template e phone-numbers]
   - `WHATSAPP_ACCOUNTS_LIST`: [Lista de nomes de BMs, separados por vírgula, para o Next.js expor as contas. Ex.: VIVENTI]
   - `WHATSAPP_ACCESS_TOKEN_<NOME_BM>`: [Um token por BM; NOME_BM deve ser igual ao campo "name" da tabela `bms` no Supabase. Ex.: WHATSAPP_ACCESS_TOKEN_VIVENTI]

   **Não são necessários:** `WHATSAPP_ACCESS_TOKEN` nem `WHATSAPP_PHONE_NUMBER_ID` — token e phone_number_id vêm das tabelas `bms`/`wabas` no Supabase e do token por BM no env.

   BMs e WABAs são configuradas nas tabelas `bms` e `wabas` no Supabase (veja migração em supabase/migrations/ e seção "Migração dos dados" no README).

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

## Estrutura das Tabelas

**webhook_messages** — eventos "messages" (mensagens, statuses, track-cta, payload bruto):
- `message_id`, `from_number`, `to_number`, `timestamp`, `message_type`, `message_body`, `raw_payload`, `created_at`, `waba_id`, `phone_number_id`, `bm_id`, `bm_name`

**webhook_alerts** — eventos de alerta (account_alerts e outros fields):
- `waba_id` (ID da WABA = entry.id do payload), `bm_id`, `bm_name`, `field`, `object`, `entity_type`, `entity_id`, `alert_type`, `alert_severity`, `alert_status`, `alert_description`, `raw_payload`, `created_at`

### Migração: colunas bm_id e bm_name

Para habilitar a estrutura BM >> WABA >> NUMBER_ID, execute a migração em `supabase/migrations/20250222000000_add_bm_id_bm_name.sql` no Supabase (SQL Editor ou CLI) para adicionar as colunas `bm_id` e `bm_name` nas tabelas indicadas.

### Migração: tabelas bms e wabas

As contas WhatsApp (BMs e WABAs) passaram a ser gerenciadas no Supabase. Execute `supabase/migrations/20250222100000_create_bms_and_wabas.sql` no Supabase. Em seguida, popule `bms` e `wabas` (manual ou via script `scripts/seed-whatsapp-accounts.ts`). No .env da Vercel, use `WHATSAPP_ACCOUNTS_LIST` (nomes das BMs) e `WHATSAPP_ACCESS_TOKEN_<NOME_BM>` (um por BM). Não use `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` nem `WHATSAPP_ACCOUNTS_*`.

## URLs Importantes

- **Aplicação**: https://whatsapp-webhook-monitor-m50vd9g4g.vercel.app
- **Endpoint Webhook**: https://whatsapp-webhook-monitor-m50vd9g4g.vercel.app/api/webhook
- **GitHub**: https://github.com/collectlabs/whatsapp-webhook-monitor
- **Supabase Dashboard**: https://supabase.com/dashboard/project/uxioxvsldxusgxtldmcd
- **Vercel Dashboard**: https://vercel.com/leonardo-sao-thiagos-projects-7841c1cd/whatsapp-webhook-monitor
