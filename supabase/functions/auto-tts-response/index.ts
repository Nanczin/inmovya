import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutoTTSRequest {
  mensagem: string
  texto: string
  piper_endpoint?: string
}

interface AutoTTSResponse {
  mensagem: string
  texto: string
  audio_url?: string
  erro?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mensagem, texto, piper_endpoint }: AutoTTSRequest = await req.json()

    if (!texto || texto.trim() === '') {
      return new Response(
        JSON.stringify({ 
          mensagem,
          texto: '',
          erro: 'Texto é obrigatório' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const endpoint = piper_endpoint || 'https://0db839bdc4c3.ngrok-free.app'
    console.log(`🎤 Convertendo texto em áudio: "${texto.substring(0, 50)}..."`)
    console.log(`🌐 Usando endpoint: ${endpoint}`)

    try {
      // Construir URL com parâmetros de query
      const audioUrl = new URL(`${endpoint}/audio-url`)
      audioUrl.searchParams.append('texto', texto.trim())
      
      console.log('📤 URL de requisição:', audioUrl.toString())

      // Chamar o endpoint Piper com timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos timeout

      const piperResponse = await fetch(audioUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Inmovya-AutoTTS/1.0'
        }
      })

      clearTimeout(timeoutId)

      if (!piperResponse.ok) {
        throw new Error(`Piper retornou erro ${piperResponse.status}`)
      }

      const responseText = await piperResponse.text()
      console.log('📡 Resposta do Piper:', responseText)

      // Assumir que a resposta é uma URL direta para o arquivo WAV
      let audioFileUrl = responseText.trim()
      
      // Se não for uma URL válida, verificar se é JSON
      try {
        const jsonResponse = JSON.parse(responseText)
        if (jsonResponse.audio_url) {
          audioFileUrl = jsonResponse.audio_url
        }
      } catch {
        // Se não for JSON, assumir que é uma URL direta
      }

      // Validar se é uma URL válida
      if (!audioFileUrl.startsWith('http')) {
        audioFileUrl = `${endpoint}/${audioFileUrl.replace(/^\/+/, '')}`
      }

      console.log(`✅ Áudio gerado: ${audioFileUrl}`)

      const response: AutoTTSResponse = {
        mensagem: mensagem || texto,
        texto: texto,
        audio_url: audioFileUrl
      }

      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )

    } catch (piperError) {
      console.error('❌ Erro no Piper TTS:', piperError)
      
      // Retornar resposta sem áudio em caso de erro
      const fallbackResponse: AutoTTSResponse = {
        mensagem: mensagem || texto,
        texto: texto,
        erro: `Piper TTS offline: ${piperError.message}`
      }

      return new Response(
        JSON.stringify(fallbackResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

  } catch (error) {
    console.error('❌ Erro na Auto TTS Function:', error)
    return new Response(
      JSON.stringify({ 
        erro: error.message || 'Erro interno do servidor',
        mensagem: '',
        texto: ''
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})