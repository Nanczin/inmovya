import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthCallbackRequest {
  code: string;
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

    const { code }: OAuthCallbackRequest = await req.json();
    
    if (!code) {
      throw new Error('Código de autorização não fornecido');
    }

    console.log('Processing Gmail OAuth callback with code:', code.substring(0, 10) + '...');

    // Exchange code for tokens
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const redirectUri = `${new URL(req.url).origin}/gmail-callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      throw new Error(`Erro na troca do token: ${tokenData.error_description || tokenData.error}`);
    }

    console.log('Token exchange successful');

    // Get user info from Gmail API
    const userInfoResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      console.error('User info error:', userInfo);
      throw new Error('Erro ao obter informações do usuário');
    }

    console.log('User info retrieved:', userInfo.emailAddress);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Get authenticated user from Supabase
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação necessário');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Store Gmail account in database
    const { data: existingAccount, error: checkError } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('email', userInfo.emailAddress)
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingAccount) {
      // Update existing account
      const { error: updateError } = await supabase
        .from('gmail_accounts')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id);

      if (updateError) throw updateError;

      console.log('Gmail account updated successfully');
    } else {
      // Create new account
      const { error: insertError } = await supabase
        .from('gmail_accounts')
        .insert({
          user_id: user.id,
          email: userInfo.emailAddress,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          status: 'active',
          daily_limit: 500, // Gmail API daily limit per user
          current_count: 0
        });

      if (insertError) throw insertError;

      console.log('Gmail account created successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Conta Gmail configurada com sucesso',
        email: userInfo.emailAddress
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gmail-oauth-callback:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);