
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Zap, 
  Play, 
  Loader2,
  Copy,
  ExternalLink,
  Download
} from "lucide-react";

interface AudioGeradoLote {
  voz: string;
  nomeVoz: string;
  url: string;
  status: 'pendente' | 'gerando' | 'sucesso' | 'erro';
  erro?: string;
  duracao?: string;
  audioData?: string;
}

const COQUI_VOICES = [
  { id: 'pt-br-female-1', name: 'Amanda (Feminino BR)', gender: 'Feminino' },
  { id: 'pt-br-female-2', name: 'Clara (Feminino BR)', gender: 'Feminino' },
  { id: 'pt-br-female-3', name: 'Maria (Feminino BR)', gender: 'Feminino' },
  { id: 'pt-br-male-1', name: 'João (Masculino BR)', gender: 'Masculino' },
  { id: 'pt-br-male-2', name: 'Ricardo (Masculino BR)', gender: 'Masculino' },
  { id: 'pt-br-male-3', name: 'Bruno (Masculino BR)', gender: 'Masculino' }
];

export function BulkAudioGeneratorCoqui() {
  const [texto, setTexto] = useState('');
  const [audiosLote, setAudiosLote] = useState<AudioGeradoLote[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioTocando, setAudioTocando] = useState<string | null>(null);
  const { toast } = useToast();

  const gerarTodosAudios = async () => {
    if (!texto.trim()) {
      toast({
        title: "Texto obrigatório",
        description: "Digite o texto que será convertido em áudio",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    // Inicializar estado dos áudios
    const audiosInicial: AudioGeradoLote[] = COQUI_VOICES.map(voice => ({
      voz: voice.id,
      nomeVoz: voice.name,
      url: '',
      status: 'pendente'
    }));
    
    setAudiosLote(audiosInicial);

    // Gerar áudios sequencialmente
    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < COQUI_VOICES.length; i++) {
      const voice = COQUI_VOICES[i];
      
      // Atualizar status para "gerando"
      setAudiosLote(prev => prev.map(audio => 
        audio.voz === voice.id 
          ? { ...audio, status: 'gerando' }
          : audio
      ));

      try {
        const { data, error } = await supabase.functions.invoke('generate-audio-coqui', {
          body: {
            text: texto,
            voice: voice.id,
            name: `${voice.name.split(' ')[0]}-${Date.now()}`
          }
        });

        if (error) throw error;

        if (data.success) {
          // Sucesso
          setAudiosLote(prev => prev.map(audio => 
            audio.voz === voice.id 
              ? { 
                  ...audio, 
                  status: 'sucesso',
                  url: data.audio_url,
                  audioData: data.audio_data,
                  duracao: data.duration
                }
              : audio
          ));
          sucessos++;
        } else {
          throw new Error(data.error || 'Erro desconhecido');
        }

      } catch (error: any) {
        // Erro
        setAudiosLote(prev => prev.map(audio => 
          audio.voz === voice.id 
            ? { 
                ...audio, 
                status: 'erro',
                erro: error.message
              }
            : audio
        ));
        falhas++;
      }

      // Atualizar progresso
      setProgress(((i + 1) / COQUI_VOICES.length) * 100);

      // Pequena pausa entre requisições
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsGenerating(false);

    // Toast final
    toast({
      title: "🚀 Geração Coqui TTS concluída!",
      description: `${sucessos} sucessos, ${falhas} falhas de ${COQUI_VOICES.length} vozes`,
      variant: sucessos > 0 ? "default" : "destructive"
    });
  };

  const copiarUrl = (url: string, nomeVoz: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "📋 URL copiada!",
      description: `Link do áudio ${nomeVoz} gerado com Coqui TTS`
    });
  };

  const reproduzirAudio = (audioId: string, url: string) => {
    if (audioTocando === audioId) {
      setAudioTocando(null);
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => audio.pause());
    } else {
      setAudioTocando(audioId);
      
      const audio = new Audio(url);
      audio.play().catch(() => {
        toast({
          title: "❌ Erro na reprodução",
          description: "Não foi possível reproduzir o áudio",
          variant: "destructive"
        });
        setAudioTocando(null);
      });
      audio.onended = () => setAudioTocando(null);
    }
  };

  const baixarTodosAudios = () => {
    const audiosComSucesso = audiosLote.filter(audio => 
      audio.status === 'sucesso' && audio.url
    );

    if (audiosComSucesso.length === 0) {
      toast({
        title: "Nenhum áudio disponível",
        description: "Gere os áudios primeiro",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "📥 Baixando áudios Coqui TTS...",
      description: `Preparando ${audiosComSucesso.length} arquivos`
    });

    audiosComSucesso.forEach((audio, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = audio.url;
        link.download = `${audio.nomeVoz.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
        link.click();
      }, index * 100);
    });
  };

  const exemploTexto = `Olá {nome}, aqui é a Talita, da Inmovya. Estou entrando em contato para apresentar uma oportunidade incrível no setor imobiliário! Você tem interesse em conhecer mais sobre nossos lançamentos exclusivos?`;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Geração em Lote - Coqui TTS (Todas as Vozes)
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant="default">✅ Gratuito</Badge>
            <Badge variant="secondary">🏠 Local</Badge>
            <Badge variant="outline">🎯 {COQUI_VOICES.length} Vozes</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite o texto que será convertido em áudio com todas as vozes Coqui TTS disponíveis..."
              className="min-h-[120px]"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Este texto será convertido com todas as {COQUI_VOICES.length} vozes Coqui TTS (100% gratuito)
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => setTexto(exemploTexto)}
              variant="outline"
              size="sm"
            >
              Usar Exemplo
            </Button>
            
            <Button 
              onClick={gerarTodosAudios}
              disabled={isGenerating || !texto.trim()}
              className="flex-1"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? 'Gerando...' : `Gerar ${COQUI_VOICES.length} Áudios Coqui TTS`}
            </Button>

            {audiosLote.some(a => a.status === 'sucesso') && (
              <Button 
                onClick={baixarTodosAudios}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Todos
              </Button>
            )}
          </div>

          {isGenerating && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Progresso: {Math.round(progress)}%
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {audiosLote.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Resultados da Geração Coqui TTS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audiosLote.map(audio => (
                <div key={audio.voz} className="p-4 rounded-lg border bg-gradient-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{audio.nomeVoz}</div>
                    <Badge 
                      variant={
                        audio.status === 'sucesso' ? 'default' :
                        audio.status === 'erro' ? 'destructive' :
                        audio.status === 'gerando' ? 'secondary' : 'outline'
                      }
                    >
                      {audio.status === 'pendente' && 'Aguardando'}
                      {audio.status === 'gerando' && 'Gerando...'}
                      {audio.status === 'sucesso' && 'Pronto'}
                      {audio.status === 'erro' && 'Erro'}
                    </Badge>
                  </div>

                  {audio.status === 'gerando' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando com Coqui TTS...
                    </div>
                  )}

                  {audio.status === 'erro' && (
                    <div className="text-sm text-destructive">
                      {audio.erro}
                    </div>
                  )}

                  {audio.status === 'sucesso' && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Duração: {audio.duracao} | Coqui TTS
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reproduzirAudio(audio.voz, audio.url)}
                        >
                          {audioTocando === audio.voz ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copiarUrl(audio.url, audio.nomeVoz)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(audio.url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações sobre uso */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/10 border-l-4 border-primary">
              <div className="font-medium text-sm mb-1">🚀 Nova Tecnologia Coqui TTS</div>
              <div className="text-xs text-muted-foreground">
                • 100% Gratuito, sem APIs externas<br/>
                • Vozes realistas em português brasileiro<br/>
                • Processamento local (sem custos mensais)
              </div>
            </div>

            <div className="p-3 rounded-lg bg-accent/50 border-l-4 border-accent">
              <div className="font-medium text-sm mb-1">⚡ Compatibilidade Total</div>
              <div className="text-xs text-muted-foreground">
                • URLs funcionam diretamente para streaming<br/>
                • Compatível com Android/Tasker<br/>
                • Substituiu 100% o sistema LuvVoice/Lovo
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
