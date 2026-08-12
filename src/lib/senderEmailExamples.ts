import { emailMarketing } from '@/lib/emailService';

/**
 * Exemplos de uso da função emailMarketing com Gmail API
 * 
 * Esta função substitui o SMTP tradicional para campanhas de marketing,
 * oferecendo melhor entregabilidade e controle sobre os envios.
 */

// Exemplo 1: Email simples para um lead
export async function exemploEmailSimples() {
  const resultado = await emailMarketing({
    to: 'lead@exemplo.com',
    subject: 'Novidade sobre o imóvel que você pesquisou',
    html: `
      <h1>Olá, João!</h1>
      <p>O imóvel <strong>Apartamento Vila Sônia</strong> acabou de ser atualizado!</p>
      <p>Novas condições de financiamento disponíveis.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://inmovya.com.br/imovel/123" 
           style="background: #2B3C8D; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px; font-weight: bold;">
          Ver Detalhes do Imóvel
        </a>
      </div>
      
      <p>Atenciosamente,<br>
      Equipe Inmovya</p>
    `,
    name: 'João Silva'
  });

  if (resultado.success) {
    console.log('✅ Email enviado com sucesso!');
  } else {
    console.error('❌ Erro:', resultado.error);
  }
}

// Exemplo 2: Email promocional MODO Butantã
export async function exemploEmailPromocional() {
  const lead = {
    nome: 'Maria Santos',
    email: 'maria@exemplo.com',
    imovel: 'MODO Butantã - 2 dormitórios'
  };

  const htmlPromocional = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>MODO Butantã - Oportunidade Única</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f9;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2B3C8D 0%, #1f2a60 100%); 
                    padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🏢 MODO Butantã</h1>
          <p style="margin: 10px 0 0; font-size: 16px;">
            Sua nova vida começa aqui, ${lead.nome}!
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #2B3C8D; margin: 0 0 20px 0;">
            Últimas Unidades Disponíveis
          </h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            O ${lead.imovel} que você demonstrou interesse está com 
            <strong>condições especiais de financiamento</strong> neste mês!
          </p>
          
          <!-- Benefits -->
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0;">
            <h3 style="color: #2B3C8D; margin: 0 0 15px 0;">✨ Benefícios Exclusivos</h3>
            <ul style="text-align: left; color: #555; line-height: 1.8;">
              <li>🚇 200m da Estação Vila Sônia</li>
              <li>🏠 Vaga de garagem inclusa</li>
              <li>💼 Coworking com salas de reunião</li>
              <li>💰 Financiamento direto com a construtora</li>
            </ul>
          </div>
          
          <!-- CTA Button -->
          <div style="margin: 35px 0;">
            <a href="https://wa.link/pt9i49" 
               style="background: #B99117; color: white; padding: 18px 35px; 
                      text-decoration: none; border-radius: 50px; font-weight: bold; 
                      font-size: 16px; display: inline-block;">
              📲 Falar com Consultor
            </a>
          </div>
          
          <p style="color: #888; font-size: 14px; margin: 20px 0 0 0;">
            Estevão - Consultor Imobiliário<br>
            📞 (11) 93930-2207 | 📧 estevao@inmovya.com.br
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;

  return await emailMarketing({
    to: lead.email,
    subject: 'MODO Butantã - Últimas Unidades com Desconto Especial! 🏢',
    html: htmlPromocional,
    name: lead.nome
  });
}

// Exemplo 3: Template com variáveis dinâmicas
export function criarEmailPersonalizado(dadosLead: {
  nome: string;
  email: string;
  empreendimento: string;
  valor: string;
  corretor: string;
  telefone: string;
}) {
  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <h1 style="color: #2B3C8D;">Olá, ${dadosLead.nome}!</h1>
      
      <p>Temos uma oportunidade incrível no <strong>${dadosLead.empreendimento}</strong> 
         que pode ser perfeita para você.</p>
      
      <div style="background: #f0f8ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3 style="color: #2B3C8D; margin: 0 0 10px 0;">💰 Investimento</h3>
        <p style="font-size: 18px; font-weight: bold; color: #B99117; margin: 0;">
          A partir de ${dadosLead.valor}
        </p>
      </div>
      
      <p>Entre em contato comigo para conhecer todas as condições especiais:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="tel:${dadosLead.telefone}" 
           style="background: #2B3C8D; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px; margin-right: 10px;">
          📞 Ligar Agora
        </a>
        <a href="https://web.whatsapp.com/send?phone=5511939302207" 
           style="background: #25D366; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px;">
          💬 WhatsApp
        </a>
      </div>
      
      <p>Atenciosamente,<br>
      <strong>${dadosLead.corretor}</strong><br>
      Consultor Imobiliário Inmovya<br>
      📱 ${dadosLead.telefone}</p>
    </div>
  `;

  return emailMarketing({
    to: dadosLead.email,
    subject: `${dadosLead.empreendimento} - Oportunidade Especial para ${dadosLead.nome}`,
    html,
    name: dadosLead.nome
  });
}

// Exemplo de uso integrado com leads
export async function enviarEmailParaLead(lead: any) {
  try {
    const resultado = await emailMarketing({
      to: lead.email,
      subject: `Novidade sobre ${lead.empreendimento_interesse || 'imóveis'} - Inmovya`,
      html: `
        <h1>Olá, ${lead.nome}!</h1>
        <p>Temos novidades sobre os imóveis que você tem interesse.</p>
        <p>Nossa equipe preparou uma seleção especial baseada no seu perfil.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://inmovya.com.br/contato" 
             style="background: #2B3C8D; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Ver Oportunidades
          </a>
        </div>
        
        <p>Atenciosamente,<br>Equipe Inmovya</p>
      `,
      name: lead.nome
    });

    console.log(
      resultado.success
        ? `✅ Email enviado para ${lead.nome} (${lead.email})`
        : `❌ Falha ao enviar para ${lead.nome}: ${resultado.error}`
    );

    return resultado;
  } catch (error) {
    console.error('Erro ao enviar email para lead:', error);
    return { success: false, error: 'Erro interno' };
  }
}