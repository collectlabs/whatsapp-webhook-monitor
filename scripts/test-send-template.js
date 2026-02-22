/**
 * Testa o disparo da API send-template localmente.
 * Uso: node scripts/test-send-template.js [numero_destino] [template_name] [waba_id]
 * Exemplo: node scripts/test-send-template.js 5521999999999 hello_world
 *
 * Carrega .env.local da raiz do projeto.
 */

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  });
  return env;
}

function getFirstWabaId(env) {
  const prefix = 'WHATSAPP_ACCOUNTS_';
  for (const key of Object.keys(env)) {
    if (key.startsWith(prefix) && key.length > prefix.length) {
      try {
        const a = JSON.parse(env[key]);
        if (a && a.id) return a.id;
      } catch {}
    }
  }
  try {
    const arr = JSON.parse(env.WHATSAPP_ACCOUNTS || '[]');
    return Array.isArray(arr) && arr.length > 0 ? arr[0].id : null;
  } catch {
    return null;
  }
}

async function main() {
  const env = loadEnvLocal();
  const apiKey = env.API_KEY;
  if (!apiKey) {
    console.error('API_KEY não encontrada no .env.local');
    process.exit(1);
  }

  const to = process.argv[2] || '5521999999999';
  const templateName = process.argv[3] || 'hello_world';
  const wabaId = process.argv[4] || getFirstWabaId(env);
  if (!wabaId) {
    console.error('waba_id obrigatório. Passe como 3º argumento ou configure WHATSAPP_ACCOUNTS no .env.local');
    process.exit(1);
  }

  const url = 'http://localhost:3000/api/send-template';
  const body = {
    to,
    template_name: templateName,
    waba_id: wabaId,
  };

  console.log('Enviando para', url);
  console.log('Body:', JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  console.log('Status:', res.status);
  console.log('Resposta:', JSON.stringify(data, null, 2));

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
