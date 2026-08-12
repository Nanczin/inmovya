import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  htmlBody: string
  templateVars?: Record<string, string>
  attachments?: Array<{
    filename: string
    content: string // base64 encoded
    contentType: string
  }>
  leadId?: string
  provider?: 'skymail' | 'gmail'
}

// Rate limiting: max 100 emails per hour per user
const RATE_LIMIT_PER_HOUR = 100
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const hourInMs = 60 * 60 * 1000
  
  const userLimit = rateLimitMap.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize counter
    rateLimitMap.set(userId, { count: 1, resetTime: now + hourInMs })
    return true
  }
  
  if (userLimit.count >= RATE_LIMIT_PER_HOUR) {
    return false
  }
  
  userLimit.count++
  return true
}

function processTemplateVariables(htmlContent: string, variables: Record<string, string>): string {
  let processedContent = htmlContent
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    processedContent = processedContent.replace(regex, value)
  })
  
  return processedContent
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, subject, htmlBody, templateVars = {}, attachments = [], leadId, provider } = await req.json() as EmailRequest
    
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

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      throw new Error(`Rate limit exceeded. Maximum ${RATE_LIMIT_PER_HOUR} emails per hour allowed.`)
    }

    console.log(`Sending email to: ${to} from user: ${user.id}`)

    // Get SMTP configuration for the user
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

    // Process template variables
    const processedHtmlBody = processTemplateVariables(htmlBody, templateVars)

    console.log('Using SMTP config:', {
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      username: smtpConfig.username,
      useSSL: smtpConfig.use_ssl
    })

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.smtp_host,
        port: smtpConfig.smtp_port,
        tls: smtpConfig.use_ssl,
        auth: {
          username: smtpConfig.username,
          password: smtpConfig.password,
        },
      },
    })

    // Send email with HTML content
    await client.send({
      from: smtpConfig.username,
      to: to,
      subject: subject,
      content: processedHtmlBody,
      html: processedHtmlBody,
      mimeType: "text/html",
    })
    
    // Add attachments if any
    if (attachments.length > 0) {
      // For attachments, we need to send separately or use a different approach
      console.log('Attachments not yet supported in this version');
    }
    await client.close()

    console.log('Email sent successfully')

    // Log email in database
    const { error: logError } = await supabaseClient.from('email_logs').insert({
      user_id: user.id,
      provider: smtpConfig.provider,
      recipient: to,
      subject: subject,
      body: processedHtmlBody,
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
        message: 'Email enviado com sucesso!',
        provider: smtpConfig.provider,
        processedVariables: Object.keys(templateVars).length
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
          const requestBody = await req.json() as EmailRequest
          await supabaseClient.from('email_logs').insert({
            user_id: user.id,
            provider: requestBody.provider || 'gmail',
            recipient: requestBody.to || 'unknown',
            subject: requestBody.subject || 'unknown',
            body: requestBody.htmlBody || '',
            status: 'failed',
            error_message: error.message || 'Unknown error',
            lead_id: requestBody.leadId ? parseInt(requestBody.leadId) : null,
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