import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * GET - Endpoint de rastreamento para cliques em botões CTA URL
 * 
 * Este endpoint deve ser usado como URL intermediária nos botões CTA URL.
 * Ele registra o clique no banco e redireciona para a URL final.
 * 
 * Uso:
 * - URL do botão CTA: https://seu-dominio.vercel.app/api/track-cta?url=https://site-final.com&user=5511999999999&button_id=meu_botao
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = searchParams.get('url');
    const userPhone = searchParams.get('user');
    const buttonId = searchParams.get('button_id') || searchParams.get('buttonId') || 'unknown';
    const referrer = request.headers.get('referer') || 'unknown';

    console.log('[DEBUG] CTA URL clicado:', {
      targetUrl,
      userPhone,
      buttonId,
      referrer,
      timestamp: new Date().toISOString(),
    });

    // Salvar o evento de clique no Supabase
    if (targetUrl) {
      const supabase = getSupabaseClient();
      const result = await supabase.from('whatsapp_messages').insert({
        message_id: `cta_click_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from_number: userPhone || 'unknown',
        to_number: 'unknown', // Não temos phone_number_id neste contexto
        timestamp: Math.floor(Date.now() / 1000),
        message_type: 'cta_url_click',
        message_body: `CTA URL clicado: Botão "${buttonId}" -> ${targetUrl}`,
        raw_payload: {
          type: 'cta_url_tracking',
          target_url: targetUrl,
          user_phone: userPhone,
          button_id: buttonId,
          referrer: referrer,
          timestamp: new Date().toISOString(),
          user_agent: request.headers.get('user-agent'),
        } as any,
      });

      if (result.error) {
        console.error('[DEBUG] Erro ao salvar clique CTA URL:', result.error);
        // Continuar mesmo com erro para não bloquear o redirecionamento
      } else {
        console.log('[DEBUG] Clique CTA URL salvo com sucesso');
      }
    }

    // Redirecionar para a URL final
    if (targetUrl) {
      return NextResponse.redirect(targetUrl);
    }

    // Se não houver URL, retornar erro
    return new NextResponse('URL parameter is required', { status: 400 });
  } catch (error) {
    console.error('[DEBUG] Erro ao processar rastreamento CTA URL:', error);
    // Em caso de erro, tentar redirecionar mesmo assim se houver URL
    const targetUrl = request.nextUrl.searchParams.get('url');
    if (targetUrl) {
      return NextResponse.redirect(targetUrl);
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
