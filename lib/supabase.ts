import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

// Função para obter o cliente Supabase
// Valida as variáveis de ambiente apenas quando necessário (lazy initialization)
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'lib/supabase.ts:getSupabaseClient',message:'missing env',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseServiceRoleKey},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    throw new Error(
      'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

// Export para compatibilidade com código existente
export const supabase = {
  get from() {
    return getSupabaseClient().from;
  },
};
