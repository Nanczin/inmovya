import { supabase } from "@/integrations/supabase/client";

/**
 * Templates predefinidos para diferentes tipos de email
 */
export const emailTemplates = {
  leadWelcome: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo à Inmovya</title>
</head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <tr>
          <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">{{empresa}}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #333333; margin: 0 0 20px 0;">Olá, {{nome}}!</h2>
            <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
              Obrigado por demonstrar interesse em nossos empreendimentos. Estamos aqui para ajudá-lo a encontrar o imóvel dos seus sonhos.
            </p>
            <p style="color: #666666; line-height: 1.6; margin: 0 0 30px 0;">
              Em breve, nosso consultor {{consultor}} entrará em contato para apresentar as melhores oportunidades disponíveis.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{website}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Ver Empreendimentos
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px; background-color: #f8f9fa; text-align: center;">
            <p style="color: #666666; margin: 0; font-size: 14px;">
              <strong>{{consultor}}</strong><br>
              Consultor Imobiliário<br>
              📱 {{telefone}}<br>
              📧 {{email}}
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,

  modoButanta: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MODO Butantã - Seu Novo Lar</title>
</head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="padding: 0; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); text-align: center;">
            <h1 style="color: #ffffff; margin: 0; padding: 30px; font-size: 32px; font-weight: 300; letter-spacing: 2px;">
              MODO BUTANTÃ
            </h1>
          </td>
        </tr>
        
        <!-- Hero Image -->
        <tr>
          <td style="padding: 0;">
            <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=650&h=300&fit=crop" alt="MODO Butantã" style="width: 100%; height: 300px; object-fit: cover; display: block;">
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Olá, {{nome}}!</h2>
            
            <p style="color: #555555; line-height: 1.8; margin: 0 0 25px 0; font-size: 16px;">
              Apresentamos o <strong>MODO Butantã</strong>, um empreendimento exclusivo que combina localização privilegiada, design moderno e qualidade de vida excepcional.
            </p>
            
            <!-- Features Grid -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
              <tr>
                <td width="50%" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; vertical-align: top;">
                  <h4 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 16px;">🏢 Localização Premium</h4>
                  <p style="color: #666666; margin: 0; font-size: 14px; line-height: 1.5;">
                    Próximo ao metrô Butantã e principais centros comerciais da região.
                  </p>
                </td>
                <td width="50%" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; vertical-align: top;">
                  <h4 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 16px;">🌿 Área de Lazer</h4>
                  <p style="color: #666666; margin: 0; font-size: 14px; line-height: 1.5;">
                    Piscina, academia, salão de festas e espaços gourmet completos.
                  </p>
                </td>
              </tr>
            </table>
            
            <!-- Specifications -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 10px; margin: 30px 0;">
              <h3 style="color: #ffffff; margin: 0 0 15px 0; text-align: center; font-size: 20px;">Plantas Disponíveis</h3>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #ffffff; padding: 8px 0; font-size: 15px;">
                    🏠 <strong>2 Dormitórios:</strong> A partir de R$ 450.000
                  </td>
                </tr>
                <tr>
                  <td style="color: #ffffff; padding: 8px 0; font-size: 15px;">
                    🏡 <strong>3 Dormitórios:</strong> A partir de R$ 620.000
                  </td>
                </tr>
                <tr>
                  <td style="color: #ffffff; padding: 8px 0; font-size: 15px;">
                    🏘️ <strong>Duplex:</strong> A partir de R$ 780.000
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Call to Action -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://inmovya.com.br/modo-butanta" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: #ffffff; padding: 18px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(231,76,60,0.3);">
                📱 AGENDAR VISITA
              </a>
            </div>
            
            <p style="color: #666666; line-height: 1.6; margin: 25px 0 0 0; font-size: 15px; text-align: center;">
              <strong>Financiamento facilitado</strong> com as melhores condições do mercado.<br>
              <em>Entrada a partir de R$ 45.000 + parcelas que cabem no seu bolso.</em>
            </p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); text-align: center;">
            <h4 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px;">Seu Consultor Imobiliário</h4>
            <p style="color: #ecf0f1; margin: 0; font-size: 16px; line-height: 1.6;">
              <strong>{{consultor}}</strong><br>
              📱 {{telefone}}<br>
              📧 {{email}}<br>
              🌐 www.inmovya.com.br
            </p>
            <div style="margin-top: 20px;">
              <p style="color: #bdc3c7; margin: 0; font-size: 12px;">
                © 2024 Inmovya - Todos os direitos reservados
              </p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
};

/**
 * Função para enviar email de boas-vindas para novos leads usando Gmail API
 */
export async function sendLeadWelcomeEmail(leadData: {
  nome: string;
  email: string;
  empreendimento?: string;
}): Promise<{ success: boolean; message: string }> {
  // Processa template com variáveis
  let htmlBody = emailTemplates.leadWelcome
    .replace(/{{nome}}/g, leadData.nome)
    .replace(/{{empresa}}/g, 'Inmovya')
    .replace(/{{consultor}}/g, 'Estevão')
    .replace(/{{telefone}}/g, '(11) 93930-2207')
    .replace(/{{email}}/g, 'estevao@inmovya.com.br')
    .replace(/{{website}}/g, 'https://inmovya.com.br')
    .replace(/{{empreendimento}}/g, leadData.empreendimento || 'Nossos Empreendimentos');

  return await emailMarketing({
    to: leadData.email,
    subject: `Bem-vindo à Inmovya, ${leadData.nome}!`,
    html: htmlBody,
    name: leadData.nome
  });
}

/**
 * Função para enviar email do empreendimento MODO Butantã usando Gmail API
 */
export async function sendModoButantaEmail(leadData: {
  nome: string;
  email: string;
}): Promise<{ success: boolean; message: string }> {
  // Processa template com variáveis
  let htmlBody = emailTemplates.modoButanta
    .replace(/{{nome}}/g, leadData.nome)
    .replace(/{{consultor}}/g, 'Estevão')
    .replace(/{{telefone}}/g, '(11) 93930-2207')
    .replace(/{{email}}/g, 'estevao@inmovya.com.br');

  return await emailMarketing({
    to: leadData.email,
    subject: 'MODO Butantã - Seu Novo Lar Aguarda Por Você!',
    html: htmlBody,
    name: leadData.nome
  });
}

/**
 * Função para converter arquivo para base64 (para anexos)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:mime;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Função principal para email marketing usando Gmail API
 * Sistema de envio profissional para campanhas de marketing
 */
export async function emailMarketing({
  to,
  subject,
  html,
  name,
  senderName,
  templateVars,
  accountId
}: {
  to: string;
  subject: string;
  html: string;
  name?: string;
  senderName?: string;
  templateVars?: Record<string, string>;
  accountId?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    console.log('📧 Enviando email marketing via Gmail API para:', to);

    // Verificar se há contas Gmail configuradas
    let gmailAccounts;
    if (accountId) {
      // Usar conta específica se fornecida
      const { data: specificAccount, error: specificError } = await supabase
        .from('gmail_accounts')
        .select('id, email, is_active, display_name')
        .eq('id', accountId)
        .eq('is_active', true)
        .limit(1);

      if (specificError || !specificAccount || specificAccount.length === 0) {
        console.error('❌ Conta Gmail específica não encontrada ou inativa:', specificError);
        return {
          success: false,
          message: 'Conta Gmail selecionada não está disponível.',
          error: 'INVALID_GMAIL_ACCOUNT'
        };
      }
      gmailAccounts = specificAccount;
    } else {
      // Buscar qualquer conta ativa
      const { data: accounts, error: accountError } = await supabase
        .from('gmail_accounts')
        .select('id, email, is_active, display_name')
        .eq('is_active', true)
        .limit(1);

      if (accountError || !accounts || accounts.length === 0) {
        console.error('❌ Nenhuma conta Gmail ativa encontrada:', accountError);
        return {
          success: false,
          message: 'Nenhuma conta Gmail configurada. Configure uma conta Gmail primeiro.',
          error: 'NO_GMAIL_ACCOUNTS'
        };
      }
      gmailAccounts = accounts;
    }

    // Processa variáveis do template se fornecidas
    let processedHtml = html;
    const defaultTemplateVars = {
      nome: name || 'Cliente',
      consultor: 'Estevão',
      telefone: '(11) 93930-2207',
      email: 'estevao@inmovya.com.br',
      empresa: 'Inmovya',
      website: 'https://inmovya.com.br',
      ...templateVars
    };

    // Aplicar variáveis do template
    for (const [key, value] of Object.entries(defaultTemplateVars)) {
      processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const response = await supabase.functions.invoke('gmail-api-send', {
      body: {
        to,
        subject,
        htmlBody: processedHtml,
        fromName: senderName || gmailAccounts[0].display_name || 'Inmovya',
        templateVars: defaultTemplateVars,
        accountId: gmailAccounts[0].id
      }
    });

    if (response.error) {
      console.error('❌ Erro na chamada da Gmail API:', response.error);

      // Fallback para Resend em caso de erro no Gmail
      console.log('🔄 Tentando enviar via Resend como fallback...');

      try {
        const resendResponse = await supabase.functions.invoke('send-email', {
          body: {
            to,
            subject,
            body: processedHtml,
            leadName: name || 'Cliente'
          }
        });

        if (resendResponse.data?.success) {
          console.log('✅ Email enviado com sucesso via Resend (fallback)');
          return {
            success: true,
            message: 'Email enviado com sucesso via Resend'
          };
        } else {
          throw new Error('Falha no fallback Resend');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback Resend também falhou:', fallbackError);
        throw new Error(response.error.message || 'Erro ao enviar email');
      }
    }

    const result = response.data;
    if (result?.success) {
      console.log('✅ Email marketing enviado com sucesso via Gmail API:', result);
      return {
        success: true,
        message: `Email enviado com sucesso via Gmail API (ID: ${result.messageId})`
      };
    } else {
      throw new Error(result?.error || 'Erro desconhecido na Gmail API');
    }
  } catch (error) {
    console.error('❌ Erro no email marketing:', error);

    // Fallback adicional: tentar Resend mesmo quando a chamada lança exceção
    try {
      console.log('🔄 Tentando enviar via Resend como fallback (catch)...');

      // Reprocessar variáveis do template para o fallback
      let fallbackHtml = html;
      const fallbackVars = {
        nome: name || 'Cliente',
        consultor: 'Estevão',
        telefone: '(11) 93930-2207',
        email: 'estevao@inmovya.com.br',
        empresa: 'Inmovya',
        website: 'https://inmovya.com.br',
        ...templateVars
      };
      for (const [key, value] of Object.entries(fallbackVars)) {
        fallbackHtml = fallbackHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      const resendResponse = await supabase.functions.invoke('send-email', {
        body: {
          to,
          subject,
          body: fallbackHtml,
          leadName: name || 'Cliente'
        }
      });

      if (resendResponse.data?.success) {
        console.log('✅ Email enviado com sucesso via Resend (fallback no catch)');
        return {
          success: true,
          message: 'Email enviado com sucesso via Resend'
        };
      }
    } catch (fallbackError) {
      console.error('❌ Fallback Resend também falhou (catch):', fallbackError);
    }

    return {
      success: false,
      message: 'Erro ao enviar email de marketing',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}