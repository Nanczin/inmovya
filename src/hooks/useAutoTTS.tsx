import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutoTTSResponse {
  mensagem: string;
  texto: string;
  audio_url?: string;
  erro?: string;
}

interface UseAutoTTSOptions {
  piperEndpoint?: string;
  enableAudio?: boolean;
}

export function useAutoTTS(options: UseAutoTTSOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const generateResponseWithAudio = async (
    mensagem: string,
    texto?: string
  ): Promise<AutoTTSResponse> => {
    const textToConvert = texto || mensagem;
    
    if (!options.enableAudio) {
      return {
        mensagem,
        texto: textToConvert
      };
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('auto-tts-response', {
        body: {
          mensagem,
          texto: textToConvert,
          piper_endpoint: options.piperEndpoint
        }
      });

      if (error) throw error;

      if (data.audio_url) {
        setLastAudioUrl(data.audio_url);
        
        // Tocar áudio automaticamente se disponível
        try {
          const audio = new Audio(data.audio_url);
          audio.play().catch(console.warn);
        } catch {
          // Ignorar erros de reprodução automática
        }
      }

      if (data.erro) {
        console.warn('Auto TTS warning:', data.erro);
      }

      return data;

    } catch (error: any) {
      console.error('Erro no Auto TTS:', error);
      
      toast({
        title: "⚠️ TTS Offline",
        description: "Texto gerado sem áudio (Piper TTS não disponível)",
        variant: "default",
      });

      // Retornar resposta textual em caso de erro
      return {
        mensagem,
        texto: textToConvert,
        erro: error.message
      };
    } finally {
      setIsGenerating(false);
    }
  };

  const playLastAudio = () => {
    if (lastAudioUrl) {
      const audio = new Audio(lastAudioUrl);
      audio.play().catch(console.warn);
    }
  };

  return {
    generateResponseWithAudio,
    playLastAudio,
    isGenerating,
    lastAudioUrl,
    hasAudio: !!lastAudioUrl
  };
}