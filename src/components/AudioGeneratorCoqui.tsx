
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mic, 
  Play, 
  Download,
  Volume2,
  Loader2,
  Copy,
  ExternalLink,
  Zap
} from "lucide-react";

interface AudioGerado {
  id: string;
  nome: string;
  texto: string;
  voz: string;
  url: string;
  criadoEm: string;
  duracao?: string;
  audioData?: string;
}

// Vozes Coqui TTS disponíveis
const COQUI_VOICES = [
  { id: 'pt-br-female-1', name: 'Amanda (Feminino BR)', gender: 'Feminino', language: 'pt-BR' },
  { id: 'pt-br-female-2', name: 'Clara (Feminino BR)', gender: 'Feminino', language: 'pt-BR' },
  { id: 'pt-br-female-3', name: 'Maria (Feminino BR)', gender: 'Feminino', language: 'pt-BR' },
  { id: 'pt-br-male-1', name: 'João (Masculino BR)', gender: 'Masculino', language: 'pt-BR' },
  { id: 'pt-br-male-2', name: 'Ricardo (Masculino BR)', gender: 'Masculino', language: 'pt-BR' },
  { id: 'pt-br-male-3', name: 'Bruno (Masculino BR)', gender: 'Masculino', language: 'pt-BR' }
];

export function AudioGeneratorCoqui() {
  const [audiosGerados, setAudiosGerados] = useState<AudioGerado[]>([]);
  const [novoAudio, setNovoAudio] = useState({
    nome: '',
    texto: '',
    voz: 'pt-br-female-1'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioTocando, setAudioTocando] = useState<string | null>(null);
  const { toast } = useToast();

  const gerarAudio = async () => {
    if (!novoAudio.nome || !novoAudio.texto) {
      toast({
        title: "Dados incompletos",
        description: "Preencha o nome e o texto do áudio",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Chamar a nova edge function Coqui TTS
      const { data, error } = await supabase.functions.invoke('generate-audio-coqui', {
        body: {
          text: novoAudio.texto,
          voice: novoAudio.voz,
          name: novoAudio.nome
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro na geração do áudio');
      }

      const audioGerado: AudioGerado = {
        id: `audio-${Date.now()}`,
        nome: novoAudio.nome,
        texto: novoAudio.texto,
        voz: novoAudio.voz,
        url: data.audio_url,
        audioData: data.audio_data,
        criadoEm: new Date().toLocaleString('pt-BR'),
        duracao: data.duration
      };

      setAudiosGerados(prev => [audioGerado, ...prev]);

      toast({
        title: "🎵 Áudio gerado com Coqui TTS!",
        description: `${novoAudio.nome} - ${data.duration} - Voz realista gerada localmente`
      });

      // Limpar formulário
      setNovoAudio({
        nome: '',
        texto: '',
        voz: 'pt-br-female-1'
      });

    } catch (error: any) {
      console.error('Erro na geração de áudio:', error);
      toast({
        title: "❌ Erro na geração",
        description: error.message || "Falha ao gerar áudio com Coqui TTS",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copiarUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "📋 URL copiada!",
      description: "Link do áudio gerado com Coqui TTS"
    });
  };

  const reproduzirAudio = (audioId: string, url: string) => {
    if (audioTocando === audioId) {
      setAudioTocando(null);
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => audio.pause());
    } else {
      setAudioTocando(audioId);
      
      try {
        const audio = new Audio(url);
        audio.play().then(() => {
          console.log('Áudio Coqui reproduzindo:', url.substring(0, 50) + '...');
        }).catch(error => {
          console.error('Erro ao reproduzir áudio:', error);
          toast({
            title: "❌ Erro na reprodução",
            description: "Não foi possível reproduzir o áudio",
            variant: "destructive"
          });
          setAudioTocando(null);
        });
        
        audio.onended = () => setAudioTocando(null);
      } catch (error) {
        console.error('Erro ao criar áudio:', error);
        setAudioTocando(null);
      }
    }
  };

  const baixarAudio = (audio: AudioGerado) => {
    if (audio.audioData) {
      const link = document.createElement('a');
      link.href = audio.url;
      link.download = `${audio.nome.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
      link.click();
    }
  };

  const getVoiceName = (voiceId: string) => {
    return COQUI_VOICES.find(v => v.id === voiceId)?.name || voiceId;
  };

  const exemplosTexto = [
    "Olá! Sou da empresa Inmovya. Temos uma oportunidade incrível de investimento imobiliário para você. Posso falar com você agora?",
    "Boa tarde! Estou ligando para falar sobre o lançamento do nosso novo empreendimento. Você tem interesse em conhecer?",
    "Olá! Detectamos que você tem interesse em imóveis. Gostaria de receber informações sobre nossos lançamentos exclusivos?"
  ];

  return (
    <div className="space-y-6">
      {/* Gerador de Áudio Coqui TTS */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Gerador de Áudio Coqui TTS (Gratuito & Local)
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="default">✅ Gratuito</Badge>
            <Badge variant="secondary">🏠 Local</Badge>
            <Badge variant="outline">🎯 Voz Realista</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome-audio">Nome do Áudio</Label>
              <Input
                id="nome-audio"
                value={novoAudio.nome}
                onChange={(e) => setNovoAudio(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Prospecção Imóveis"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="voz-audio">Voz Coqui TTS</Label>
              <Select value={novoAudio.voz} onValueChange={(value) => setNovoAudio(prev => ({ ...prev, voz: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COQUI_VOICES.map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name} ({voice.gender})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="texto-audio">Texto para Conversão</Label>
            <Textarea
              id="texto-audio"
              value={novoAudio.texto}
              onChange={(e) => setNovoAudio(prev => ({ ...prev, texto: e.target.value }))}
              placeholder="Digite o texto que será convertido em áudio com Coqui TTS..."
              className="min-h-[100px] mt-1"
            />
            <div className="text-xs text-muted-foreground mt-1">
              ✅ Sem limites | 🎯 Vozes realistas | 💰 Totalmente gratuito
            </div>
          </div>

          {/* Exemplos rápidos */}
          <div>
            <Label>Exemplos rápidos:</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {exemplosTexto.map((exemplo, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoAudio(prev => ({ ...prev, texto: exemplo }))}
                  className="text-xs"
                >
                  Exemplo {index + 1}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            onClick={gerarAudio}
            disabled={isGenerating || !novoAudio.nome || !novoAudio.texto}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? 'Gerando com Coqui TTS...' : 'Gerar Áudio Coqui TTS (Gratuito)'}
          </Button>

          <div className="p-3 rounded-lg bg-gradient-primary/10 border-l-4 border-primary">
            <div className="font-medium text-sm mb-1">🚀 Nova Tecnologia Coqui TTS</div>
            <div className="text-xs text-muted-foreground">
              • 100% Gratuito e sem limites<br/>
              • Processamento local (sem APIs externas)<br/>
              • Vozes realistas em português brasileiro<br/>
              • Compatível com Tasker e automações
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Áudios Gerados */}
      {audiosGerados.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Áudios Coqui TTS Gerados ({audiosGerados.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {audiosGerados.map(audio => (
                <div key={audio.id} className="p-4 rounded-lg border bg-gradient-card">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{audio.nome}</h4>
                      <div className="text-sm text-muted-foreground">
                        {getVoiceName(audio.voz)} • {audio.duracao} • {audio.criadoEm}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="default">Coqui TTS</Badge>
                      <Badge variant="secondary">Gratuito</Badge>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {audio.texto}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reproduzirAudio(audio.id, audio.url)}
                    >
                      {audioTocando === audio.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copiarUrl(audio.url)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => baixarAudio(audio)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Baixar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(audio.url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Abrir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {audiosGerados.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-medium mb-2">Pronto para gerar áudios gratuitos</h3>
            <p className="text-muted-foreground">
              Use o Coqui TTS para criar áudios com vozes realistas sem custos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
