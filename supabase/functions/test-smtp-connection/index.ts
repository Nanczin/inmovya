import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useSSL: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: SMTPConfig = await req.json();

    // Simular teste de conexão SMTP
    // Em uma implementação real, você usaria uma biblioteca SMTP para testar a conexão
    console.log(`Testing SMTP connection to ${config.host}:${config.port}`);
    
    // Validações básicas
    if (!config.host || !config.username || !config.password) {
      throw new Error("Configuração incompleta. Verifique todos os campos.");
    }

    if (config.port < 1 || config.port > 65535) {
      throw new Error("Porta inválida. Use uma porta entre 1 e 65535.");
    }

    // Simular delay de teste
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Para fins de demonstração, vamos simular sucesso na maioria dos casos
    const isValid = Math.random() > 0.1; // 90% de chance de sucesso

    if (!isValid) {
      throw new Error("Falha na autenticação. Verifique usuário e senha.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Conexão SMTP testada com sucesso!"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error testing SMTP connection:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erro ao testar conexão SMTP"
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);