/**
 * Testa as APIs principais (health, phone-numbers) com o schema padronizado.
 * Uso: node --env-file=.env.local scripts/test-apis.js
 * Requer: servidor rodando (npm run dev) e API_KEY no .env.local
 */

const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const apiKey = process.env.API_KEY;

async function run() {
  if (!apiKey) {
    console.error('❌ API_KEY não definida. Use: node --env-file=.env.local scripts/test-apis.js');
    process.exit(1);
  }

  const headers = { 'X-API-Key': apiKey };
  let ok = 0;
  let fail = 0;

  console.log('Base URL:', base);
  console.log('');

  // GET /api/health
  try {
    const res = await fetch(`${base}/api/health`, { headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      console.log('✅ GET /api/health:', res.status, '- count:', data.count ?? data.health?.length ?? '-');
      ok++;
    } else {
      console.log('❌ GET /api/health:', res.status, data.error || data.message || JSON.stringify(data).slice(0, 80));
      fail++;
    }
  } catch (e) {
    console.log('❌ GET /api/health: erro de rede', e.message);
    fail++;
  }

  // GET /api/phone-numbers
  try {
    const res = await fetch(`${base}/api/phone-numbers`, { headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      const items = data.items ?? data.data ?? [];
      const len = Array.isArray(items) ? items.length : 0;
      console.log('✅ GET /api/phone-numbers:', res.status, '- items:', len);
      ok++;
    } else {
      console.log('❌ GET /api/phone-numbers:', res.status, data.error || data.message || JSON.stringify(data).slice(0, 200));
      fail++;
    }
  } catch (e) {
    console.log('❌ GET /api/phone-numbers: erro de rede', e.message);
    fail++;
  }

  // GET /api/templates?waba_id= (requer meta_waba_id válido; pode 404 se não houver)
  const wabaId = process.argv[2] || '';
  if (wabaId) {
    try {
      const res = await fetch(`${base}/api/templates?waba_id=${encodeURIComponent(wabaId)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log('✅ GET /api/templates?waba_id=...:', res.status);
        ok++;
      } else {
        console.log('⚠️ GET /api/templates:', res.status, data.error || data.message || '(pode ser 404 se waba_id inválido)');
      }
    } catch (e) {
      console.log('❌ GET /api/templates: erro de rede', e.message);
      fail++;
    }
  }

  console.log('');
  console.log('Resumo:', ok, 'ok,', fail, 'falha(s)');
  process.exit(fail > 0 ? 1 : 0);
}

run();
