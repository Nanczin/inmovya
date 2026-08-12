import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🎤 Speechma TTS Edge Function iniciada!');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    console.log('📝 Texto recebido:', text?.substring(0, 50) + '...');

    // Validação básica
    if (!text) {
      console.log('❌ Texto obrigatório ausente');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Text is required'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🌐 Tentando acessar Speechma...');

    // Primeiro, fazer uma requisição GET para obter a página inicial e cookies/tokens
    const initialResponse = await fetch('https://speechma.com', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!initialResponse.ok) {
      throw new Error(`Falha ao acessar Speechma: ${initialResponse.status}`);
    }

    const htmlContent = await initialResponse.text();
    console.log('✅ Página inicial carregada');

    // Extrair cookies da resposta inicial
    const setCookieHeader = initialResponse.headers.get('set-cookie');
    const cookies = setCookieHeader || '';

    // Buscar por tokens CSRF ou outros identificadores na página
    const csrfMatch = htmlContent.match(/csrf[_-]?token['"]\s*:\s*['"]([^'"]+)['"]/i);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    console.log('🔐 Token CSRF encontrado:', csrfToken ? 'Sim' : 'Não');

    // Buscar por padrões mais específicos do speechma
    const formMatch = htmlContent.match(/<form[^>]*action=['"]([^'"]*)['"]/i);
    let apiEndpoint = formMatch ? formMatch[1] : '';
    
    // Se não encontrar no form, buscar por scripts que contenham endpoints
    if (!apiEndpoint) {
      const scriptMatch = htmlContent.match(/fetch\(['"`]([^'"`]*(?:generate|tts|speech)[^'"`]*)['"]/i);
      apiEndpoint = scriptMatch ? scriptMatch[1] : '/api/generate';
    }

    // Se não começar com /, adicionar o domínio
    if (!apiEndpoint.startsWith('http')) {
      apiEndpoint = `https://speechma.com${apiEndpoint.startsWith('/') ? '' : '/'}${apiEndpoint}`;
    }

    console.log('🎯 Endpoint da API:', apiEndpoint);

    // Preparar dados para envio
    const formData = new FormData();
    formData.append('text', text);
    formData.append('voice', 'default');
    formData.append('language', 'pt-BR');
    
    if (csrfToken) {
      formData.append('_token', csrfToken);
    }

    // Fazer requisição para gerar o áudio
    console.log('📤 Enviando requisição para gerar áudio...');
    
    const generateResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://speechma.com',
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData,
    });

    if (!generateResponse.ok) {
      console.log('⚠️ Resposta da API não OK:', generateResponse.status);
      
      // Tentar alternativas de endpoint
      const alternativeEndpoints = [
        'https://speechma.com/api/tts',
        'https://speechma.com/generate',
        'https://speechma.com/tts',
        'https://speechma.com/api/speech'
      ];

      let successResponse = null;
      
      for (const endpoint of alternativeEndpoints) {
        console.log(`🔄 Tentando endpoint alternativo: ${endpoint}`);
        
        try {
          const altResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'Referer': 'https://speechma.com',
              'Cookie': cookies,
            },
            body: JSON.stringify({
              text: text,
              voice: 'default',
              language: 'pt-BR'
            }),
          });

          if (altResponse.ok) {
            successResponse = altResponse;
            console.log('✅ Endpoint alternativo funcionou:', endpoint);
            break;
          }
        } catch (e) {
          console.log(`❌ Endpoint ${endpoint} falhou:`, e.message);
        }
      }

      if (!successResponse) {
        throw new Error('Todos os endpoints falharam. Site pode ter proteção anti-bot.');
      }

      generateResponse = successResponse;
    }

    const responseData = await generateResponse.json();
    console.log('📦 Resposta recebida:', Object.keys(responseData));

    // Buscar URL do áudio na resposta
    let audioUrl = null;
    
    // Possíveis campos onde a URL pode estar
    const possibleFields = ['audio_url', 'url', 'file', 'audio', 'result', 'data'];
    
    for (const field of possibleFields) {
      if (responseData[field]) {
        audioUrl = responseData[field];
        break;
      }
    }

    // Se a URL for relativa, torná-la absoluta
    if (audioUrl && !audioUrl.startsWith('http')) {
      audioUrl = `https://speechma.com${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
    }

    if (!audioUrl) {
      console.log('❌ URL do áudio não encontrada na resposta');
      throw new Error('URL do áudio não encontrada na resposta do Speechma');
    }

    console.log('🎵 URL do áudio encontrada:', audioUrl);

    // Calcular duração estimada
    const wordCount = text.split(' ').length;
    const durationSeconds = Math.ceil((wordCount / 150) * 60);
    const duration = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`;

    console.log('✅ Áudio gerado com sucesso via Speechma!');

    return new Response(
      JSON.stringify({
        success: true,
        audio_url: audioUrl,
        duration: duration,
        provider: 'Speechma',
        text_length: text.length,
        estimated_cost: 0.00
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na integração com Speechma:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Falha na integração com Speechma',
        details: error.message,
        suggestion: 'O site pode ter proteção anti-bot ou mudou sua estrutura'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});