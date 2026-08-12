import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Download, Loader2, Volume2, User } from "lucide-react";

// Tipos de vozes disponíveis do Speechma
const VOICE_OPTIONS = [
  // Vozes Brasileiras
  { 
    id: 'portuguese-female-1', 
    name: 'Maria - Feminino BR', 
    gender: 'Feminino',
    language: 'pt-BR',
    description: 'Voz feminina brasileira natural e clara'
  },
  { 
    id: 'portuguese-female-2', 
    name: 'Ana - Feminino BR', 
    gender: 'Feminino',
    language: 'pt-BR',
    description: 'Voz feminina jovem e dinâmica'
  },
  { 
    id: 'portuguese-female-3', 
    name: 'Carla - Feminino BR', 
    gender: 'Feminino',
    language: 'pt-BR',
    description: 'Voz feminina suave e profissional'
  },
  { 
    id: 'portuguese-male-1', 
    name: 'João - Masculino BR', 
    gender: 'Masculino',
    language: 'pt-BR',
    description: 'Voz masculina brasileira profissional'
  },
  { 
    id: 'portuguese-male-2', 
    name: 'Carlos - Masculino BR', 
    gender: 'Masculino',
    language: 'pt-BR',
    description: 'Voz masculina madura e confiável'
  },
  { 
    id: 'portuguese-male-3', 
    name: 'Rafael - Masculino BR', 
    gender: 'Masculino',
    language: 'pt-BR',
    description: 'Voz masculina jovem e energética'
  },
  
  // Vozes Portuguesas (Portugal)
  { 
    id: 'portuguese-pt-female-1', 
    name: 'Sofia - Feminino PT', 
    gender: 'Feminino',
    language: 'pt-PT',
    description: 'Voz feminina portuguesa elegante'
  },
  { 
    id: 'portuguese-pt-male-1', 
    name: 'Miguel - Masculino PT', 
    gender: 'Masculino',
    language: 'pt-PT',
    description: 'Voz masculina portuguesa formal'
  },

  // Vozes Inglesas
  { 
    id: 'english-female-1', 
    name: 'Sarah - Female EN-US', 
    gender: 'Feminino',
    language: 'en-US',
    description: 'American female voice, clear and professional'
  },
  { 
    id: 'english-female-2', 
    name: 'Emma - Female EN-US', 
    gender: 'Feminino',
    language: 'en-US',
    description: 'American female voice, warm and friendly'
  },
  { 
    id: 'english-male-1', 
    name: 'David - Male EN-US', 
    gender: 'Masculino',
    language: 'en-US',
    description: 'American male voice, deep and confident'
  },
  { 
    id: 'english-male-2', 
    name: 'James - Male EN-US', 
    gender: 'Masculino',
    language: 'en-US',
    description: 'American male voice, smooth and articulate'
  },
  { 
    id: 'english-uk-female-1', 
    name: 'Catherine - Female EN-UK', 
    gender: 'Feminino',
    language: 'en-GB',
    description: 'British female voice, sophisticated accent'
  },
  { 
    id: 'english-uk-male-1', 
    name: 'Oliver - Male EN-UK', 
    gender: 'Masculino',
    language: 'en-GB',
    description: 'British male voice, distinguished accent'
  },

  // Vozes Espanholas
  { 
    id: 'spanish-female-1', 
    name: 'Carmen - Mujer ES', 
    gender: 'Feminino',
    language: 'es-ES',
    description: 'Voz femenina española clara y melodiosa'
  },
  { 
    id: 'spanish-male-1', 
    name: 'Pablo - Hombre ES', 
    gender: 'Masculino',
    language: 'es-ES',
    description: 'Voz masculina española fuerte y expresiva'
  },
  { 
    id: 'spanish-mx-female-1', 
    name: 'Lucia - Mujer MX', 
    gender: 'Feminino',
    language: 'es-MX',
    description: 'Voz femenina mexicana cálida y natural'
  },
  { 
    id: 'spanish-mx-male-1', 
    name: 'Diego - Hombre MX', 
    gender: 'Masculino',
    language: 'es-MX',
    description: 'Voz masculina mexicana amigable y confiable'
  },

  // Vozes Francesas
  { 
    id: 'french-female-1', 
    name: 'Marie - Femme FR', 
    gender: 'Feminino',
    language: 'fr-FR',
    description: 'Voix féminine française élégante et raffinée'
  },
  { 
    id: 'french-male-1', 
    name: 'Pierre - Homme FR', 
    gender: 'Masculino',
    language: 'fr-FR',
    description: 'Voix masculine française claire et distinguée'
  },

  // Vozes Alemãs
  { 
    id: 'german-female-1', 
    name: 'Anna - Weiblich DE', 
    gender: 'Feminino',
    language: 'de-DE',
    description: 'Deutsche weibliche Stimme, klar und freundlich'
  },
  { 
    id: 'german-male-1', 
    name: 'Hans - Männlich DE', 
    gender: 'Masculino',
    language: 'de-DE',
    description: 'Deutsche männliche Stimme, kraftvoll und sicher'
  },

  // Vozes Italianas
  { 
    id: 'italian-female-1', 
    name: 'Giulia - Femmina IT', 
    gender: 'Feminino',
    language: 'it-IT',
    description: 'Voce femminile italiana dolce e musicale'
  },
  { 
    id: 'italian-male-1', 
    name: 'Marco - Maschio IT', 
    gender: 'Masculino',
    language: 'it-IT',
    description: 'Voce maschile italiana espressiva e calorosa'
  },

  // Vozes Japonesas
  { 
    id: 'japanese-female-1', 
    name: 'Yuki - 女性 JP', 
    gender: 'Feminino',
    language: 'ja-JP',
    description: '日本の女性の声、優しくて丁寧'
  },
  { 
    id: 'japanese-male-1', 
    name: 'Hiroshi - 男性 JP', 
    gender: 'Masculino',
    language: 'ja-JP',
    description: '日本の男性の声、落ち着いて信頼できる'
  },

  // Vozes Chinesas
  { 
    id: 'chinese-female-1', 
    name: 'Li Wei - 女性 CN', 
    gender: 'Feminino',
    language: 'zh-CN',
    description: '中文女声，清晰标准的普通话'
  },
  { 
    id: 'chinese-male-1', 
    name: 'Zhang Ming - 男性 CN', 
    gender: 'Masculino',
    language: 'zh-CN',
    description: '中文男声，深沉有力的声音'
  },

  // Vozes Russas
  { 
    id: 'russian-female-1', 
    name: 'Anya - Женский RU', 
    gender: 'Feminino',
    language: 'ru-RU',
    description: 'Русский женский голос, мягкий и выразительный'
  },
  { 
    id: 'russian-male-1', 
    name: 'Dmitri - Мужской RU', 
    gender: 'Masculino',
    language: 'ru-RU',
    description: 'Русский мужской голос, глубокий и уверенный'
  },

  // Vozes Árabes
  { 
    id: 'arabic-female-1', 
    name: 'Fatima - أنثى AR', 
    gender: 'Feminino',
    language: 'ar-SA',
    description: 'صوت أنثوي عربي واضح وجميل'
  },
  { 
    id: 'arabic-male-1', 
    name: 'Omar - ذكر AR', 
    gender: 'Masculino',
    language: 'ar-SA',
    description: 'صوت ذكوري عربي قوي ومعبر'
  },

  // Voz Padrão
  { 
    id: 'default', 
    name: 'Padrão do Sistema', 
    gender: 'Neutro',
    language: 'auto',
    description: 'Voz padrão do Speechma (detecta idioma automaticamente)'
  }
];

export function AudioGeneratorSpeechma() {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("default");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<string>("");
  const { toast } = useToast();

  // Filtrar vozes por idioma
  const filteredVoices = selectedLanguage === "all" 
    ? VOICE_OPTIONS 
    : VOICE_OPTIONS.filter(voice => voice.language === selectedLanguage || voice.id === 'default');

  // Idiomas disponíveis
  const availableLanguages = [
    { value: "all", label: "Todos os idiomas" },
    { value: "pt-BR", label: "Português (Brasil)" },
    { value: "pt-PT", label: "Português (Portugal)" },
    { value: "en-US", label: "Inglês (EUA)" },
    { value: "en-GB", label: "Inglês (Reino Unido)" },
    { value: "es-ES", label: "Espanhol (Espanha)" },
    { value: "es-MX", label: "Espanhol (México)" },
    { value: "fr-FR", label: "Francês" },
    { value: "de-DE", label: "Alemão" },
    { value: "it-IT", label: "Italiano" },
    { value: "ja-JP", label: "Japonês" },
    { value: "zh-CN", label: "Chinês (Mandarim)" },
    { value: "ru-RU", label: "Russo" },
    { value: "ar-SA", label: "Árabe" }
  ];

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "Erro",
        description: "Digite um texto para gerar o áudio",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log('🎤 Gerando áudio com Web Speech API...');
      
      // Verificar se Web Speech API está disponível
      if (!('speechSynthesis' in window)) {
        throw new Error('Web Speech API não está disponível neste navegador');
      }

      // Aguardar carregamento das vozes
      const loadVoices = () => {
        return new Promise<SpeechSynthesisVoice[]>((resolve) => {
          let voices = speechSynthesis.getVoices();
          if (voices.length) {
            resolve(voices);
          } else {
            speechSynthesis.onvoiceschanged = () => {
              voices = speechSynthesis.getVoices();
              resolve(voices);
            };
          }
        });
      };

      const voices = await loadVoices();
      console.log('🔊 Vozes disponíveis:', voices.length);

      // Criar utterance
      const utterance = new SpeechSynthesisUtterance(text.trim());
      
      // Configurar voz baseada na seleção
      const selectedVoiceData = VOICE_OPTIONS.find(v => v.id === selectedVoice);
      
      if (selectedVoiceData && selectedVoiceData.language !== 'auto') {
        utterance.lang = selectedVoiceData.language;
        
        // Tentar encontrar uma voz que corresponda ao idioma e gênero
        let preferredVoice = null;
        
        if (selectedVoiceData.gender === 'Feminino') {
          preferredVoice = voices.find(v => 
            v.lang.startsWith(selectedVoiceData.language.split('-')[0]) && 
            (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.toLowerCase().includes('feminino'))
          );
        } else if (selectedVoiceData.gender === 'Masculino') {
          preferredVoice = voices.find(v => 
            v.lang.startsWith(selectedVoiceData.language.split('-')[0]) && 
            (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man') || v.name.toLowerCase().includes('masculino'))
          );
        }
        
        // Se não encontrar voz específica, usar qualquer voz do idioma
        if (!preferredVoice) {
          preferredVoice = voices.find(v => v.lang.startsWith(selectedVoiceData.language.split('-')[0]));
        }
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log('🎯 Voz selecionada:', preferredVoice.name);
        }
      } else {
        utterance.lang = 'pt-BR';
      }
      
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Simular carregamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Calcular duração estimada
      const wordCount = text.split(' ').length;
      const durationSeconds = Math.ceil((wordCount / 150) * 60);
      const duration = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`;
      
      // Criar um identificador único para este áudio
      const audioId = `speech-${Date.now()}`;
      
      setGeneratedAudio(audioId);
      setDuration(duration);
      
      // Guardar a utterance para reprodução posterior
      (window as any).currentUtterance = utterance;
      
      toast({
        title: "Sucesso!",
        description: `Áudio gerado com ${selectedVoiceData?.name || 'voz padrão'}`,
      });

    } catch (error: any) {
      console.error('❌ Erro:', error);
      
      toast({
        title: "Erro na geração",
        description: error.message || "Erro ao gerar áudio. Verifique se seu navegador suporta síntese de voz.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = () => {
    if (!generatedAudio) return;

    // Se já está tocando, pausar
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // Recuperar a utterance salva ou criar uma nova
    let utterance = (window as any).currentUtterance;
    
    if (!utterance) {
      utterance = new SpeechSynthesisUtterance(text.trim());
      const selectedVoiceData = VOICE_OPTIONS.find(v => v.id === selectedVoice);
      
      if (selectedVoiceData && selectedVoiceData.language !== 'auto') {
        utterance.lang = selectedVoiceData.language;
      } else {
        utterance.lang = 'pt-BR';
      }
      
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
    }

    // Configurar eventos
    utterance.onstart = () => {
      setIsPlaying(true);
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
    };
    
    utterance.onerror = () => {
      setIsPlaying(false);
      toast({
        title: "Erro",
        description: "Erro ao reproduzir áudio",
        variant: "destructive",
      });
    };

    // Reproduzir
    speechSynthesis.speak(utterance);
  };

  const handleDownload = () => {
    toast({
      title: "Download indisponível",
      description: "O download não está disponível com a Web Speech API. Use outros geradores para baixar arquivos.",
      variant: "destructive",
    });
  };

  const charCount = text.length;
  const maxChars = 1000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎤 Gerador Speechma TTS
          <Badge variant="outline">Gratuito</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="language-select" className="text-sm font-medium">Idioma</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger id="language-select">
                <SelectValue placeholder="Selecione um idioma" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background border border-border">
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-select" className="text-sm font-medium">Tipo de Voz</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger id="voice-select">
                <SelectValue placeholder="Selecione uma voz" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background border border-border max-h-60 overflow-y-auto">
                {filteredVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex items-center gap-2">
                      {voice.gender === 'Feminino' ? (
                        <User className="w-4 h-4 text-pink-500" />
                      ) : voice.gender === 'Masculino' ? (
                        <User className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-gray-500" />
                      )}
                      <div>
                        <div className="font-medium">{voice.name}</div>
                        <div className="text-xs text-muted-foreground">{voice.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Voz Selecionada</Label>
            <div className="p-3 rounded-lg bg-muted min-h-[40px]">
              {(() => {
                const voice = VOICE_OPTIONS.find(v => v.id === selectedVoice);
                return (
                  <div className="flex items-center gap-2">
                    {voice?.gender === 'Feminino' ? (
                      <User className="w-4 h-4 text-pink-500" />
                    ) : voice?.gender === 'Masculino' ? (
                      <User className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-gray-500" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{voice?.name}</div>
                      <div className="text-xs text-muted-foreground">{voice?.description}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Texto para conversão</label>
          <Textarea
            placeholder="Digite o texto que deseja converter em áudio..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[120px]"
            maxLength={maxChars}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{charCount}/{maxChars} caracteres</span>
            <span>Estimativa: ~{Math.ceil(text.split(' ').length / 150)} min</span>
          </div>
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !text.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Gerando áudio com {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}...
            </>
          ) : (
            <>
              🎤 Gerar Áudio
            </>
          )}
        </Button>

        {isGenerating && (
          <div className="space-y-2">
            <Progress value={33} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Processando requisição no Speechma...
            </p>
          </div>
        )}

        {generatedAudio && (
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Áudio gerado</p>
                  <p className="text-sm text-muted-foreground">
                    Duração: {duration} • {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlay}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            ℹ️ <strong>Info:</strong> Esta versão usa a Web Speech API do navegador para síntese de voz. 
            A qualidade e vozes disponíveis dependem do seu navegador e sistema operacional.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}