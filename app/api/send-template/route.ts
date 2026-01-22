import { NextRequest, NextResponse } from 'next/server';
import { sendTemplateMessage } from '@/lib/whatsapp-client';
import { SendTemplateRequest } from '@/types/whatsapp-message';

// Handler genérico para capturar todos os métodos HTTP e diagnosticar
export async function OPTIONS(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:5',message:'OPTIONS method called',data:{url:request.url,method:request.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
  // #endregion
  return new NextResponse(null, { status: 200 });
}

/**
 * POST - Enviar mensagem usando template aprovado do WhatsApp
 * 
 * Endpoint para envio de mensagens utilizando templates aprovados da WhatsApp Cloud API.
 * Suporta todos os componentes: header, body, footer, buttons (quick_reply e url).
 * 
 * Exemplo de payload:
 * {
 *   "phoneNumber": "5521995282478",
 *   "phoneNumberId": "123456789012345",
 *   "message": {
 *     "type": "template",
 *     "template": {
 *       "name": "hsm_macro_portal_2",
 *       "language": { "code": "pt_BR" },
 *       "components": [
 *         {
 *           "type": "body",
 *           "parameters": [
 *             { "type": "text", "text": "TALVANE CAMARGO BARBOSA" },
 *             { "type": "text", "text": "CONSIGNADO" },
 *             { "type": "text", "text": "26" }
 *           ]
 *         },
 *         {
 *           "type": "button",
 *           "sub_type": "url",
 *           "index": 0,
 *           "parameters": [
 *             { "type": "text", "text": "c65ef1fc" }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:42',message:'POST function entry',data:{method:'POST',url:request.url,headers:Object.fromEntries(request.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:45',message:'Before parsing body',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // Parse do body
    let body: SendTemplateRequest;
    try {
      body = await request.json();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:50',message:'Body parsed successfully',data:{hasPhoneNumber:!!body.phoneNumber,hasPhoneNumberId:!!body.phoneNumberId,hasMessage:!!body.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:54',message:'JSON parse error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('[DEBUG] Erro ao fazer parse do JSON:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Payload JSON inválido',
          },
        },
        { status: 400 }
      );
    }

    console.log('[DEBUG] Requisição recebida para envio de template:', {
      phoneNumber: body.phoneNumber,
      phoneNumberId: body.phoneNumberId,
      templateName: body.message?.template?.name,
      timestamp: new Date().toISOString(),
    });

    // Enviar mensagem
    const result = await sendTemplateMessage(body);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:70',message:'sendTemplateMessage result',data:{success:result.success,hasError:!!result.error,errorCode:result.error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // Retornar resposta baseada no resultado
    if (result.success) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:75',message:'Returning success response',data:{messageId:result.messageId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        {
          success: true,
          messageId: result.messageId,
        },
        { status: 200 }
      );
    } else {
      // Mapear códigos de erro para status HTTP apropriados
      const errorCode = result.error?.code || 'UNKNOWN_ERROR';
      let statusCode = 500;

      if (errorCode === 'VALIDATION_ERROR') {
        statusCode = 400;
      } else if (errorCode.startsWith('WHATSAPP_API_')) {
        const whatsappStatus = parseInt(errorCode.replace('WHATSAPP_API_', ''));
        // Mapear status codes comuns da API do WhatsApp
        if (whatsappStatus === 401) {
          statusCode = 401; // Unauthorized
        } else if (whatsappStatus === 403) {
          statusCode = 403; // Forbidden
        } else if (whatsappStatus === 429) {
          statusCode = 429; // Too Many Requests
        } else if (whatsappStatus >= 400 && whatsappStatus < 500) {
          statusCode = 400; // Bad Request
        } else {
          statusCode = 502; // Bad Gateway (erro do serviço externo)
        }
      }

      console.error('[DEBUG] Erro ao enviar template:', {
        error: result.error,
        statusCode,
        phoneNumber: body.phoneNumber,
        phoneNumberId: body.phoneNumberId,
        templateName: body.message?.template?.name,
      });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:112',message:'Returning error response',data:{statusCode,errorCode,errorMessage:result.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: statusCode }
      );
    }
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:120',message:'Unexpected error in POST handler',data:{error:error instanceof Error ? error.message : String(error),stack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.error('[DEBUG] Erro inesperado no endpoint send-template:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erro interno do servidor',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Informações sobre o endpoint
 * Retorna documentação básica do endpoint
 */
export async function GET() {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/send-template/route.ts:140',message:'GET function called',data:{method:'GET'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  return NextResponse.json({
    endpoint: '/api/send-template',
    method: 'POST',
    description: 'Endpoint para envio de mensagens usando templates aprovados do WhatsApp',
    requiredEnvVars: [
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_API_VERSION (opcional, default: v21.0)',
    ],
    example: {
      phoneNumber: '5521995282478',
      phoneNumberId: '123456789012345',
      message: {
        type: 'template',
        template: {
          name: 'hsm_macro_portal_2',
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'TALVANE CAMARGO BARBOSA' },
                { type: 'text', text: 'CONSIGNADO' },
                { type: 'text', text: '26' },
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: 0,
              parameters: [{ type: 'text', text: 'c65ef1fc' }],
            },
          ],
        },
      },
    },
  });
}
