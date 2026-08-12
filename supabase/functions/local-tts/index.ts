
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voice = 'pt_BR-cadu-medium', serverUrl } = await req.json()

    if (!text) {
      throw new Error('Text is required')
    }

    // Get server URL from request or environment or use default
    const piperServerUrl = serverUrl || Deno.env.get('PIPER_TTS_URL') || 'http://127.0.0.1:8080'
    
    // Build URL with query parameters for GET request
    const url = new URL(`${piperServerUrl}/speak`)
    url.searchParams.append('text', text)
    url.searchParams.append('voice', voice)

    console.log(`Chamando Piper TTS: ${url.toString()}`)

    // Make request to local Piper TTS server
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'audio/wav',
        'User-Agent': 'Inmovya-TTS/1.0'
      }
    })

    console.log(`Resposta do servidor: ${response.status} ${response.statusText}`)
    console.log(`Content-Type: ${response.headers.get('content-type')}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Erro do servidor Piper: ${errorText}`)
      
      // Check if it's an HTML response (like ngrok warning page)
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
        throw new Error('Servidor ngrok bloqueado. Configure o ngrok com --host-header=rewrite ou use um túnel autenticado.')
      }
      
      throw new Error(`Servidor Piper TTS retornou erro ${response.status}: ${errorText}`)
    }

    const contentType = response.headers.get('content-type')
    
    // Check if response is actually audio
    if (!contentType?.includes('audio')) {
      const responseText = await response.text()
      console.error(`Resposta inesperada (não é áudio): ${responseText}`)
      
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        throw new Error('Servidor ngrok retornou página HTML. Configure o ngrok corretamente ou use um servidor direto.')
      }
      
      throw new Error('Servidor não retornou áudio válido')
    }

    // Get the WAV file as array buffer
    const audioBuffer = await response.arrayBuffer()
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('Áudio gerado está vazio')
    }

    console.log(`Áudio gerado: ${audioBuffer.byteLength} bytes`)
    
    // Convert to base64 for transport
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    )

    return new Response(
      JSON.stringify({ 
        success: true,
        audio_data: base64Audio,
        content_type: 'audio/wav',
        text,
        voice
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Erro na geração de áudio:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Servidor de voz indisponível no momento.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
