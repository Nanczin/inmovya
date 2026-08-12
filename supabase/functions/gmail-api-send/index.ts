
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GmailSendRequest {
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
  fromName?: string;
  accountId?: string;
  templateVars?: Record<string, string>;
  imageAttachments?: string[];
}

interface GmailAccount {
  id: string;
  email: string;
  app_password: string;
  display_name: string;
  is_active: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: GmailSendRequest = await req.json();
    const { to, subject, htmlBody, from, fromName = 'Consultor Imobiliário Estevão', accountId, templateVars } = request;

    console.log('Gmail API send request:', { to, subject, accountId });

    // Get Gmail account from database
    let gmailAccountQuery = supabase
      .from('gmail_accounts')
      .select('id, email, app_password, display_name, is_active')
      .eq('is_active', true);

    if (accountId) {
      gmailAccountQuery = gmailAccountQuery.eq('id', accountId);
    } else {
      gmailAccountQuery = gmailAccountQuery.limit(1);
    }

    const { data: gmailAccounts, error: accountError } = await gmailAccountQuery;

    if (accountError || !gmailAccounts || gmailAccounts.length === 0) {
      console.error('No active Gmail account found:', accountError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhuma conta Gmail ativa encontrada. Configure uma conta primeiro.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gmailAccount: GmailAccount = gmailAccounts[0];

    console.log('Using Gmail account:', gmailAccount.email);

    // Validate app password
    if (!gmailAccount.app_password) {
      throw new Error('Senha de aplicativo não configurada para esta conta Gmail');
    }

    // Process template variables
    let processedHtml = htmlBody;
    if (templateVars) {
      for (const [key, value] of Object.entries(templateVars)) {
        processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }

    // Send via Gmail SMTP (using app password)
    const fromEmail = from || gmailAccount.email;
    const cleanFromName = (fromName || '').replace(/["']/g, "").trim();
    const emailData = {
      from: `${cleanFromName} <${fromEmail}>`,
      to,
      subject,
      html: processedHtml
    };

    console.log('Sending email via Gmail SMTP...');

    // Use SMTP to send email with app password
    await sendEmailViaGmailSMTP(emailData, gmailAccount);

    console.log('Email sent successfully via Gmail SMTP');

    // Update usage statistics
    await supabase.rpc('increment_gmail_usage', { p_account_id: gmailAccount.id });

    // Log the email
    await supabase.from('email_logs').insert({
      recipient: to,
      subject: subject,
      provider: 'gmail-smtp',
      status: 'sent',
      gmail_account_id: gmailAccount.id
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email enviado com sucesso via Gmail SMTP'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gmail-api-send:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

// Function to send email via Gmail SMTP using app password
async function sendEmailViaGmailSMTP(emailData: any, gmailAccount: GmailAccount): Promise<void> {
  const { from, to, subject, html } = emailData;

  console.log('Connecting to Gmail SMTP...');

  // Create SMTP client for Gmail
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: gmailAccount.email,
        password: gmailAccount.app_password,
      },
    },
  });

  try {
    // Send email via SMTP
    await client.send({
      from: from,
      to: to,
      subject: subject,
      content: html,
      html: html,
      mimeType: "text/html",
    });

    console.log('Email sent successfully via Gmail SMTP');
  } finally {
    await client.close();
  }
}

serve(handler);
