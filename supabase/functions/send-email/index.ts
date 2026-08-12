import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, subject, body, leadName } = await req.json()

    // Get Resend API key from Supabase secrets
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not found in environment variables')
    }

    // Send email using Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Inmovya <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${body.replace(/\n/g, '<br>')}
          </div>
        `,
        text: body,
      }),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text()
      throw new Error(`Resend API error: ${errorData}`)
    }

    const emailResult = await resendResponse.json()

    // Log email activity (optional - store in your database)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // You can log this to a table if needed
    // await supabaseClient.from('email_logs').insert({
    //   recipient: to,
    //   subject: subject,
    //   lead_name: leadName,
    //   sent_at: new Date().toISOString(),
    //   email_id: emailResult.id
    // })

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResult.id,
        message: 'Email enviado com sucesso!'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor'
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