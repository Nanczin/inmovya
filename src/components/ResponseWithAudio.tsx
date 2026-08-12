import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAutoTTSContext } from '@/components/AutoTTSProvider';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Loader2,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';

interface ResponseWithAudioProps {
  mensagem: string;
  texto?: string;
  autoGenerate?: boolean;
  showControls?: boolean;
}

export function ResponseWithAudio({ 
  mensagem, 
  texto, 
  autoGenerate = true,
  showControls = true 
}: ResponseWithAudioProps) {
  const { generateResponseWithAudio, playLastAudio, isGenerating, hasAudio } = useAutoTTSContext();
  const [response, setResponse] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (autoGenerate && (mensagem || texto)) {
      handleGenerateAudio();
    }
  }, [mensagem, texto, autoGenerate]);

  const handleGenerateAudio = async () => {
    try {
      setHasError(false);
      const result = await generateResponseWithAudio(mensagem, texto);
      setResponse(result);
      
      if (result.erro) {
        setHasError(true);
      }
    } catch (error) {
      setHasError(true);
      setResponse({
        mensagem,
        texto: texto || mensagem,
        erro: 'Falha na geração de áudio'
      });
    }
  };

  if (!response && !isGenerating) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">{mensagem}</p>
            {showControls && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateAudio}
              >
                <Volume2 className="w-4 h-4 mr-2" />
                Gerar Áudio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Mensagem Principal */}
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1">{response?.mensagem || mensagem}</p>
          
          {/* Status Badges */}
          <div className="flex gap-2">
            {isGenerating && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Gerando...
              </Badge>
            )}
            
            {response?.audio_url && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Áudio OK
              </Badge>
            )}
            
            {hasError && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                TTS Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Controles de Áudio */}
        {showControls && (
          <div className="flex gap-2">
            {response?.audio_url ? (
              <Button
                variant="outline"
                size="sm"
                onClick={playLastAudio}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Reproduzir Áudio
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAudio}
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                {isGenerating ? 'Gerando...' : 'Tentar Áudio'}
              </Button>
            )}
          </div>
        )}

        {/* Erro de TTS */}
        {response?.erro && (
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {response.erro}
            </AlertDescription>
          </Alert>
        )}

        {/* URL do Áudio (para debug/Tasker) */}
        {response?.audio_url && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <strong>Audio URL:</strong> {response.audio_url}
          </div>
        )}
      </CardContent>
    </Card>
  );
}