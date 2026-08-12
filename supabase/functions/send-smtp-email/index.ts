import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  body: string
  leadId?: string
  provider?: 'skymail' | 'gmail'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, subject, body, leadId, provider } = await req.json() as EmailRequest
    
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

    // Get SMTP configuration for the user to get the from email
    const { data: smtpConfig, error: configError } = await supabaseClient
      .from('smtp_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('provider', provider || 'gmail')
      .single()

    if (configError || !smtpConfig) {
      throw new Error(`SMTP configuration not found for provider: ${provider || 'gmail'}`)
    }

    console.log('Using Resend with from email:', smtpConfig.username)

    // Initialize Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    // Send email using Resend with HTML rendering
    const emailResponse = await resend.emails.send({
      from: `Inmovya <onboarding@resend.dev>`, // Resend requires verified domain
      to: [to],
      subject: subject,
      html: body, // Resend handles HTML perfectly
    })

    console.log('Resend email sent successfully:', emailResponse)

    // Log email in database
    const { error: logError } = await supabaseClient.from('email_logs').insert({
      user_id: user.id,
      provider: 'resend', // Mark as resend provider
      recipient: to,
      subject: subject,
      body: body,
      status: 'success',
      lead_id: leadId ? parseInt(leadId) : null,
      sent_at: new Date().toISOString(),
    })

    if (logError) {
      console.error('Error logging email:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email enviado com sucesso via Resend!',
        provider: 'resend',
        resendId: emailResponse.data?.id
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error sending email via Resend:', error)
    
    // Try to log failed email if we have user context
    try {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          const { to, subject, body, leadId, provider } = await req.json() as EmailRequest
          await supabaseClient.from('email_logs').insert({
            user_id: user.id,
            provider: 'resend',
            recipient: to || 'unknown',
            subject: subject || 'unknown',
            body: body || '',
            status: 'failed',
            error_message: error.message || 'Unknown error',
            lead_id: leadId ? parseInt(leadId) : null,
            sent_at: new Date().toISOString(),
          })
        }
      }
    } catch (logError) {
      console.error('Error logging failed email:', logError)
    }
    
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