import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAutoTTS } from "@/hooks/useAutoTTS";
import { AudioLibrary } from "@/components/AudioLibrary";
import {
  Mic, 
  Play, 
  Pause, 
  Download,
  Volume2,
  Loader2,
  Copy,
  ExternalLink,
  Zap,
  Library,
  Settings,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  Trash2
} from "lucide-react";

interface AudioGerado {
  id: string;
  nome: string;
  texto: string;
  voz: string;
  url: string;
  criadoEm: string;
  duracao?: string;
}

interface PiperVoice {
  id: string;
  name: string;
}

// Vozes disponíveis no servidor Piper (baseado nos modelos .onnx disponíveis)
const DEFAULT_VOICES: PiperVoice[] = [
  { id: 'pt_BR-cadu-medium', name: 'Cadu (Português BR - Médio)' },
  { id: 'pt_BR-edresson-low', name: 'Edresson (Português BR - Baixo)' },
  { id: 'pt_BR-faber-medium', name: 'Faber (Português BR - Médio)' },
  { id: 'pt_BR-jeff-medium', name: 'Jeff (Português BR - Médio)' }
];

export function VozesModule() {
  const [audiosGerados, setAudiosGerados] = useState<AudioGerado[]>([]);
  const [vozesSupabase, setVozesSupabase] = useState<any[]>([]);
  const [piperVoices, setPiperVoices] = useState<PiperVoice[]>(DEFAULT_VOICES);
  const [novoAudio, setNovoAudio] = useState({
    nome: '',
    texto: '',
    voz: 'pt_BR-faber-medium'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioTocando, setAudioTocando] = useState<string | null>(null);
  const [piperEndpoint, setPiperEndpoint] = useState(() => {
    return localStorage.getItem('piperEndpoint') || "https://0db839bdc4c3.ngrok-free.app";
  });
  const [connectionStatus, setConnectionStatus] = useState<string>("Verificando...");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const autoTTS = useAutoTTS({ 
    piperEndpoint, 
    enableAudio: true 
  });
  const [autoResponse, setAutoResponse] = useState({
    mensagem: "",
    texto: "",
    audio_url: ""
  });

  // Buscar vozes disponíveis do servidor Piper
  const buscarVozesPiper = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${piperEndpoint}/voices`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const voices = await response.json();
        if (Array.isArray(voices) && voices.length > 0) {
          setPiperVoices(voices.map(voice => ({
            id: voice.id || voice.name || voice,
            name: voice.display_name || voice.name || voice.id || voice
          })));
        }
      }
    } catch (error) {
      console.warn('Não foi possível buscar vozes do servidor Piper:', error);
    }
  };

  // Verificar status da conexão com o servidor Piper
  const verificarConexao = async () => {
    setConnectionStatus("Verificando...");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${piperEndpoint}/status`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setConnectionStatus(response.ok ? "Conectado" : "Offline");
      
      // Se conectado, buscar vozes disponíveis
      if (response.ok) {
        await buscarVozesPiper();
      }
    } catch (error) {
      setConnectionStatus("Offline");
    }
  };

  // Carregar vozes do Supabase
  const carregarVozesSupabase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vozes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar vozes do Supabase:', error);
        throw error;
      }

      setVozesSupabase(data || []);
    } catch (error) {
      console.error('Erro ao buscar vozes:', error);
      toast({
        title: "Erro ao carregar vozes",
        description: "Não foi possível carregar as vozes salvas no banco de dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carregar audios gerados do localStorage
    const audiosStorage = localStorage.getItem('audiosGerados');
    if (audiosStorage) {
      setAudiosGerados(JSON.parse(audiosStorage));
    }
    
    // Inicializar com as vozes padrão
    setPiperVoices(DEFAULT_VOICES);
    
    // Carregar vozes do Supabase
    carregarVozesSupabase();
  }, []);

  useEffect(() => {
    verificarConexao();
    const interval = setInterval(verificarConexao, 30000); // Verificar a cada 30s
    return () => clearInterval(interval);
  }, [piperEndpoint]);

  useEffect(() => {
    // Salvar audios gerados no localStorage
    localStorage.setItem('audiosGerados', JSON.stringify(audiosGerados));
  }, [audiosGerados]);

  const copiarUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "URL copiada!",
      description: "Link do áudio copiado para a área de transferência"
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
        audio.play();
        audio.onended = () => setAudioTocando(null);
        audio.onerror = () => {
          toast({
            title: "Erro na reprodução",
            description: "Não foi possível reproduzir o áudio",
            variant: "destructive"
          });
          setAudioTocando(null);
        };
      } catch (error) {
        console.error('Erro ao reproduzir áudio:', error);
        setAudioTocando(null);
      }
    }
  };

  const baixarAudio = async (url: string, texto: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${texto.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
      link.click();
      
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o áudio",
        variant: "destructive"
      });
    }
  };

  const excluirVoz = async (vozId: string, nomeVoz: string) => {
    try {
      const { error } = await supabase
        .from('vozes')
        .delete()
        .eq('id', vozId);

      if (error) {
        console.error('Erro ao excluir voz:', error);
        throw error;
      }

      // Recarregar a lista de vozes
      carregarVozesSupabase();

      toast({
        title: "Voz excluída",
        description: `"${nomeVoz}" foi removida do banco de dados`,
      });
    } catch (error) {
      console.error('Erro ao excluir voz:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a voz",
        variant: "destructive",
      });
    }
  };

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
      let response;
      let provider = 'piper';
      
      // Se o servidor Piper está offline, usar diretamente OpenAI
      if (connectionStatus === "Offline") {
        console.log('Servidor Piper offline, usando OpenAI TTS diretamente');
        
        const openaiResponse = await supabase.functions.invoke('openai-tts', {
          body: {
            text: novoAudio.texto,
            voice: 'alloy'
          }
        });

        if (openaiResponse.error) {
          throw new Error(openaiResponse.error.message || 'Erro na API do OpenAI');
        }

        response = openaiResponse.data;
        provider = 'openai';
        
        if (!response?.audio_url) {
          throw new Error('Resposta inválida da API OpenAI');
        }
      } else {
        // Tentar primeiro com autoTTS (Piper)
        try {
          response = await autoTTS.generateResponseWithAudio(novoAudio.texto);
          provider = 'piper';
          console.log('Usando Piper TTS');
        } catch (piperError) {
          console.warn('Piper TTS falhou, tentando OpenAI TTS:', piperError);
          
          // Fallback para OpenAI TTS
          const openaiResponse = await supabase.functions.invoke('openai-tts', {
            body: {
              text: novoAudio.texto,
              voice: 'alloy'
            }
          });

          if (openaiResponse.error) {
            throw new Error(openaiResponse.error.message || 'Erro na API do OpenAI');
          }

          response = openaiResponse.data;
          provider = 'openai';
          console.log('Usando OpenAI TTS como fallback');
        }
      }
      
      if (response?.audio_url) {
        const audioGerado: AudioGerado = {
          id: `audio-${Date.now()}`,
          nome: novoAudio.nome,
          texto: novoAudio.texto,
          voz: novoAudio.voz,
          url: response.audio_url,
          criadoEm: new Date().toLocaleString('pt-BR'),
          duracao: "~" + Math.ceil(novoAudio.texto.length / 15) + "s"
        };

        setAudiosGerados(prev => [audioGerado, ...prev]);

        // Salvar no banco de dados Supabase
        try {
          const vozData = {
            nome: novoAudio.nome,
            tipo: 'sintetica',
            arquivo_url: response.audio_url,
            ativa: true,
            configuracoes: {
              texto: novoAudio.texto,
              voz: novoAudio.voz,
              duracao: audioGerado.duracao,
              provider: response.audio_url.includes('data:') ? 'openai' : 'piper'
            }
          };

          const { data, error } = await supabase
            .from('vozes')
            .insert([vozData])
            .select()
            .single();

          if (error) {
            console.error('Erro ao salvar voz no Supabase:', error);
            throw error;
          }

          console.log('Voz salva no Supabase:', data);
          carregarVozesSupabase();
        } catch (supabaseError) {
          console.error('Erro ao salvar no Supabase:', supabaseError);
          toast({
            title: "Aviso",
            description: "Áudio gerado mas não foi possível salvar no banco de dados.",
            variant: "destructive"
          });
        }

        // Salvar na biblioteca (localStorage)
        try {
          const audioLibrary = localStorage.getItem('audioLibrary');
          const audioBiblioteca = {
            id: Date.now().toString(),
            texto: novoAudio.texto,
            audio_url: response.audio_url,
            voz: novoAudio.voz,
            duracao: audioGerado.duracao,
            created_at: new Date().toISOString()
          };
          
          const audiosAtuais = audioLibrary ? JSON.parse(audioLibrary) : [];
          const audiosAtualizados = [...audiosAtuais, audioBiblioteca];
          localStorage.setItem('audioLibrary', JSON.stringify(audiosAtualizados));
        } catch (error) {
          console.warn('Erro ao salvar na biblioteca:', error);
        }

        // Atualizar resposta formatada
        setAutoResponse({
          mensagem: `Áudio "${novoAudio.nome}" gerado com sucesso`,
          texto: novoAudio.texto,
          audio_url: response.audio_url
        });

        toast({
          title: `🎵 Áudio gerado com ${provider === 'openai' ? 'OpenAI' : 'Piper'} TTS!`,
          description: `${novoAudio.nome} salvo na biblioteca e banco de dados`
        });
      } else {
        throw new Error("Não foi possível gerar o áudio");
      }

      // Limpar formulário
      setNovoAudio({
        nome: '',
        texto: '',
        voz: piperVoices[0]?.id || 'pt_BR-faber-medium'
      });

    } catch (error: any) {
      console.error('Erro na geração de áudio:', error);
      toast({
        title: "❌ Erro na geração",
        description: error.message || "Falha ao gerar áudio",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Gerador TTS
          </TabsTrigger>
          <TabsTrigger value="vozes-salvas" className="flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Vozes Salvas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="space-y-6">
          {/* Status do Servidor Piper */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {connectionStatus === "Conectado" ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                Status da Conexão Piper TTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className={connectionStatus === "Conectado" ? "border-green-200" : "border-red-200"}>
                {connectionStatus === "Conectado" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription>
                  <div className="flex items-center justify-between w-full">
                    <span>
                      Servidor: {piperEndpoint} - Status: {connectionStatus}
                    </span>
                    <div className="flex gap-2">
                      <Badge variant={connectionStatus === "Conectado" ? "default" : "destructive"}>
                        {connectionStatus}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={verificarConexao}
                        disabled={connectionStatus === "Verificando..."}
                      >
                        {connectionStatus === "Verificando..." ? "Verificando..." : "Verificar"}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Configuração do Servidor */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração do Servidor Piper
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="piper-endpoint">URL do Servidor Piper TTS</Label>
                <Input
                  id="piper-endpoint"
                  value={piperEndpoint}
                  onChange={(e) => {
                    const newEndpoint = e.target.value;
                    setPiperEndpoint(newEndpoint);
                    localStorage.setItem('piperEndpoint', newEndpoint);
                  }}
                  placeholder="https://0db839bdc4c3.ngrok-free.app"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A URL será salva automaticamente e mantida entre sessões
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gerador Principal */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Gerador de Áudio TTS
              </CardTitle>
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
                  <Label htmlFor="voz-audio">Voz TTS</Label>
                  <Select
                    value={novoAudio.voz}
                    onValueChange={(value) => setNovoAudio(prev => ({ ...prev, voz: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione uma voz" />
                    </SelectTrigger>
                    <SelectContent>
                      {piperVoices.map(voice => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
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
                  placeholder="Digite o texto que será convertido em áudio..."
                  className="min-h-[100px] mt-1"
                />
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
                {isGenerating ? 'Gerando...' : 'Gerar Áudio TTS'}
              </Button>
            </CardContent>
          </Card>

          {/* Resultado Formatado */}
          {autoResponse.audio_url && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-primary" />
                  Resposta Formatada (Tasker)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resposta Manual sem Context */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{autoResponse.mensagem}</h4>
                    {autoResponse.audio_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const audio = new Audio(autoResponse.audio_url);
                          audio.play().catch(console.warn);
                        }}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Reproduzir
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{autoResponse.texto}</p>
                  {autoResponse.audio_url && (
                    <p className="text-xs text-green-600 mt-2">
                      ✅ Áudio disponível: {autoResponse.audio_url.substring(0, 50)}...
                    </p>
                  )}
                </div>
                
                {/* JSON Formatado para Tasker */}
                <div className="bg-muted p-4 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-medium text-sm">JSON para Tasker:</h5>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(autoResponse, null, 2));
                        toast({
                          title: "JSON copiado!",
                          description: "Dados formatados copiados para o Tasker"
                        });
                      }}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground overflow-x-auto">
                    {JSON.stringify(autoResponse, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Áudios Gerados */}
          {audiosGerados.length > 0 && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Áudios Gerados ({audiosGerados.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {audiosGerados.map(audio => (
                    <div key={audio.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{audio.nome}</h4>
                          <div className="text-sm text-muted-foreground">
                            {audio.voz} • {audio.criadoEm}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reproduzirAudio(audio.id, audio.url)}
                          >
                            {audioTocando === audio.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copiarUrl(audio.url)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => baixarAudio(audio.url, audio.texto)}
                          >
                            <Download className="w-4 h-4" />
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
                      <p className="text-sm text-muted-foreground">
                        {audio.texto}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vozes-salvas" className="space-y-6">
          {/* Header das Vozes Salvas */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Vozes Salvas no Banco de Dados</h3>
              <p className="text-sm text-muted-foreground">
                Todas as vozes geradas são automaticamente salvas aqui
              </p>
            </div>
            <Button variant="outline" onClick={carregarVozesSupabase} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Atualizar
            </Button>
          </div>

          {/* Stats das Vozes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {loading ? "..." : vozesSupabase.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-accent text-accent-foreground">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {loading ? "..." : vozesSupabase.filter(v => v.tipo === 'sintetica').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Sintéticas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success text-success-foreground">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {loading ? "..." : vozesSupabase.filter(v => v.ativa).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Ativas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning text-warning-foreground">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {loading ? "..." : vozesSupabase.filter(v => v.tipo === 'gravada').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Gravadas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista das Vozes Salvas */}
          {loading ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <div className="text-muted-foreground">Carregando vozes...</div>
              </CardContent>
            </Card>
          ) : vozesSupabase.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <Volume2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <div className="text-muted-foreground mb-4">Nenhuma voz encontrada</div>
                <p className="text-sm text-muted-foreground">
                  As vozes geradas nas campanhas ou no gerador aparecerão aqui automaticamente
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vozesSupabase.map((voz) => (
                <Card key={voz.id} className="shadow-card hover:shadow-elegant transition-all duration-300">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {voz.tipo === 'sintetica' ? (
                          <Volume2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Mic className="w-4 h-4 text-accent" />
                        )}
                        <CardTitle className="text-lg">{voz.nome}</CardTitle>
                      </div>
                      <Badge className={voz.ativa ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                        {voz.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Criada em {new Date(voz.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Informações da Voz */}
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Tipo:</span> {voz.tipo === 'sintetica' ? 'Sintética' : 'Gravada'}
                      </div>
                      {voz.configuracoes?.voz_utilizada && (
                        <div className="text-sm">
                          <span className="font-medium">Voz:</span> {voz.configuracoes.voz_utilizada}
                        </div>
                      )}
                      {voz.configuracoes?.contexto && (
                        <div className="text-sm">
                          <span className="font-medium">Contexto:</span> {voz.configuracoes.contexto}
                        </div>
                      )}
                      {voz.configuracoes?.texto_original && (
                        <div className="text-sm">
                          <span className="font-medium">Texto:</span> 
                          <span className="ml-1 text-muted-foreground">
                            {voz.configuracoes.texto_original.substring(0, 50)}
                            {voz.configuracoes.texto_original.length > 50 ? '...' : ''}
                          </span>
                        </div>
                      )}
                      {voz.configuracoes?.texto && (
                        <div className="text-sm">
                          <span className="font-medium">Texto:</span> 
                          <span className="ml-1 text-muted-foreground">
                            {voz.configuracoes.texto.substring(0, 50)}
                            {voz.configuracoes.texto.length > 50 ? '...' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Audio Player */}
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reproduzirAudio(`supabase-${voz.id}`, voz.arquivo_url)}
                      >
                        {audioTocando === `supabase-${voz.id}` ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <div className="flex-1 text-sm text-muted-foreground">
                        {audioTocando === `supabase-${voz.id}` ? 'Reproduzindo...' : 'Clique para ouvir'}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copiarUrl(voz.arquivo_url)}
                        className="flex-1"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar URL
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => baixarAudio(voz.arquivo_url, voz.nome)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(voz.arquivo_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => excluirVoz(voz.id, voz.nome)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
