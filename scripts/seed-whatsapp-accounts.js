/**
 * Script de seed: migra estrutura de BMs/WABAs de um JSON para as tabelas bms e wabas no Supabase.
 *
 * Formato do JSON (igual ao antigo WHATSAPP_ACCOUNTS_<NOME>, sem o token):
 * {
 *   "NOME_BM": {
 *     "id": "meta_bm_id (opcional)",
 *     "wabas": [
 *       { "id": "waba_id", "name": "Nome da WABA", "phone_ids": ["phone_number_id", ...] }
 *     ]
 *   }
 * }
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-whatsapp-accounts.js scripts/accounts-backup.json
 *
 * Ou com .env.local (Node 20+): node --env-file=.env.local scripts/seed-whatsapp-accounts.js scripts/accounts-backup.json
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node scripts/seed-whatsapp-accounts.js <caminho-do-json>');
  console.error('Ex.: node scripts/seed-whatsapp-accounts.js scripts/accounts-backup.json');
  process.exit(1);
}

const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(absolutePath)) {
  console.error('Arquivo não encontrado:', absolutePath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  for (const [bmName, bmData] of Object.entries(data)) {
    if (!bmData || !Array.isArray(bmData.wabas) || bmData.wabas.length === 0) {
      console.warn('Ignorando BM sem wabas:', bmName);
      continue;
    }

    const metaBmId = bmData.id || `local_${bmName}`;
    const { data: insertedBm, error: bmError } = await supabase
      .from('bms')
      .insert({
        meta_bm_id: metaBmId,
        name: bmName,
      })
      .select('bm_uuid')
      .single();

    if (bmError) {
      if (bmError.code === '23505') {
        const { data: existing } = await supabase.from('bms').select('bm_uuid').eq('name', bmName).single();
        if (existing) {
          console.log('BM já existe:', bmName, '- inserindo WABAs...');
          for (const w of bmData.wabas) {
            if (!w.id || !Array.isArray(w.phone_ids)) continue;
            const { error: wErr } = await supabase.from('wabas').upsert({
              meta_waba_id: String(w.id).trim(),
              name: (w.name && String(w.name).trim()) || bmName,
              bm_uuid: existing.bm_uuid,
              phone_ids: w.phone_ids.map((id) => String(id)),
            }, { onConflict: 'meta_waba_id' });
            if (wErr) console.error('Erro WABA', w.id, wErr);
            else console.log('  WABA', w.id, w.name || '');
          }
        }
        continue;
      }
      console.error('Erro ao inserir BM', bmName, bmError);
      continue;
    }

    const bmUuid = insertedBm.bm_uuid;
    console.log('BM inserida:', bmName, bmUuid);

    for (const w of bmData.wabas) {
      if (!w.id || !Array.isArray(w.phone_ids)) continue;
      const { error: wErr } = await supabase.from('wabas').insert({
        meta_waba_id: String(w.id).trim(),
        name: (w.name && String(w.name).trim()) || bmName,
        bm_uuid: bmUuid,
        phone_ids: w.phone_ids.map((id) => String(id)),
      });
      if (wErr) console.error('Erro WABA', w.id, wErr);
      else console.log('  WABA', w.id, w.name || '');
    }
  }
  console.log('Concluído. Defina no .env: WHATSAPP_ACCESS_TOKEN_<NOME_BM> para cada BM.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
