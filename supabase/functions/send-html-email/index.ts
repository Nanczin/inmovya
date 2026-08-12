import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  htmlBody: string
  templateVars?: Record<string, string>
  imageAttachments?: string[]
  leadId?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, subject, htmlBody, templateVars = {}, imageAttachments = [], leadId } = await req.json() as EmailRequest
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header missing')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    console.log(`📧 Enviando email HTML para: ${to}`)

    // Process template variables
    let processedHtml = htmlBody
    const defaultTemplateVars = {
      nome: 'Cliente',
      consultor: 'Estevão',
      telefone: '(11) 93930-2207',
      email: 'estevao@inmovya.com.br',
      empresa: 'Inmovya',
      website: 'https://inmovya.com.br',
      ...templateVars
    }

    // Apply template variables
    for (const [key, value] of Object.entries(defaultTemplateVars)) {
      processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }

    // Embed images in HTML if provided
    if (imageAttachments && imageAttachments.length > 0) {
      let imagesHtml = '<div style="margin: 20px 0; text-align: center;">'
      imageAttachments.forEach((url, index) => {
        imagesHtml += `<img src="${url}" alt="Imagem ${index + 1}" style="max-width: 100%; height: auto; margin: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`
      })
      imagesHtml += '</div>'
      
      // Add images at the end if HTML doesn't have </body>
      if (processedHtml.includes('</body>')) {
        processedHtml = processedHtml.replace('</body>', `${imagesHtml}</body>`)
      } else {
        processedHtml += imagesHtml
      }
    }

    // Enhanced HTML structure if needed
    const isFullHtml = processedHtml.includes('<!DOCTYPE') || processedHtml.includes('<html')
    if (!isFullHtml) {
      processedHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${subject}</title>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; 
      background-color: #f8f9fa; 
      line-height: 1.6;
    }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .email-content { 
      padding: 40px 30px; 
      color: #333333; 
      font-size: 16px; 
    }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: 0 !important; }
      .email-content { padding: 20px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-content">
      ${processedHtml}
    </div>
  </div>
</body>
</html>`
    }

    // Send via Gmail API
    const response = await supabaseClient.functions.invoke('gmail-api-send', {
      body: {
        to,
        subject,
        htmlBody: processedHtml,
        fromName: 'Inmovya',
        templateVars: defaultTemplateVars,
        imageAttachments
      }
    })

    if (response.error) {
      console.error('❌ Erro na Gmail API:', response.error)
      throw new Error(response.error.message || 'Erro ao enviar email via Gmail API')
    }

    const result = response.data
    if (result?.success) {
      console.log('✅ Email HTML enviado com sucesso:', result)
      
      // Log email in database
      await supabaseClient.from('email_logs').insert({
        user_id: user.id,
        provider: 'gmail-api',
        recipient: to,
        subject: subject,
        body: processedHtml,
        status: 'success',
        lead_id: leadId ? parseInt(leadId) : null,
        sent_at: new Date().toISOString(),
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Email HTML enviado com sucesso!`,
          messageId: result.messageId
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    } else {
      throw new Error(result?.error || 'Erro desconhecido na Gmail API')
    }
  } catch (error) {
    console.error('❌ Erro no envio de email HTML:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})