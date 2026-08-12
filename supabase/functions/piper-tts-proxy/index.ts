
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PiperRequest {
  texto: string
  voz: string
  api_url?: string
}

interface PiperResponse {
  audio_base64: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { texto, voz, api_url = 'http://localhost:8080' }: PiperRequest = await req.json()

    if (!texto || texto.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Texto é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log(`🎤 Processando TTS: "${texto}" com voz: ${voz}`)
    console.log(`🌐 Conectando com: ${api_url}/speak`)

    // Construir URL com parâmetros de query para GET
    const url = new URL(`${api_url}/speak`)
    url.searchParams.append('text', texto)
    url.searchParams.append('voice', voz || 'default')
    
    console.log('📤 URL final:', url.toString())

    // Chamar a API Piper local usando GET com query parameters
    const piperResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    console.log(`📡 Status da resposta: ${piperResponse.status}`)

    if (!piperResponse.ok) {
      const errorText = await piperResponse.text()
      console.error(`❌ Erro na API Piper: ${piperResponse.status} - ${errorText}`)
      throw new Error(`Erro na API Piper: ${piperResponse.status} - ${errorText}`)
    }

    const piperData: PiperResponse = await piperResponse.json()

    if (!piperData.audio_base64) {
      throw new Error('API Piper não retornou áudio válido')
    }

    // Inicializar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Converter base64 para Uint8Array
    const audioData = Uint8Array.from(atob(piperData.audio_base64), c => c.charCodeAt(0))
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const filename = `tts-${voz}-${timestamp}.wav`

    // Upload do áudio para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audios')
      .upload(filename, audioData, {
        contentType: 'audio/wav',
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('Erro no upload:', uploadError)
      throw new Error('Falha ao salvar áudio no storage')
    }

    // Obter URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(filename)

    console.log(`✅ Áudio salvo: ${urlData.publicUrl}`)

    return new Response(
      JSON.stringify({
        success: true,
        url: urlData.publicUrl,
        filename,
        voz,
        texto: texto.substring(0, 50) + (texto.length > 50 ? '...' : '')
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
