import { useState, useRef, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mic, 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
  Wifi,
  WifiOff
} from "lucide-react";

interface AudioGeneration {
  id: string;
  texto: string;
  voz: string;
  audioData: string;
  timestamp: number;
  status: 'success' | 'error';
}

export function VozesModuleCoqui() {
  const [texto, setTexto] = useState("");
  const [voz, setVoz] = useState("pt_BR-cadu-medium");
  const [serverUrl, setServerUrl] = useState("http://localhost:8080");
  const [connectionStatus, setConnectionStatus] = useState<string>("Verificando...");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioHistory, setAudioHistory] = useState<AudioGeneration[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const vozesDisponiveis = [
    { value: "pt_BR-cadu-medium", label: "Cadu (Masculina)" },
    { value: "pt_BR-edresson-low", label: "Edresson (Masculina)" },
    { value: "pt_BR-faber-medium", label: "Faber (Masculina)" },
    { value: "pt_BR-amanda-medium", label: "Amanda (Feminina)" },
    { value: "pt_BR-clara-medium", label: "Clara (Feminina)" },
    { value: "pt_BR-jeff-medium", label: "Jeff (Masculina)" },
  ];

  // Verificar status da conexão com o servidor Piper
  const verificarConexao = async () => {
    setConnectionStatus("Verificando...");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${serverUrl}/status`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setConnectionStatus(response.ok ? "Conectado" : "Offline");
    } catch (error) {
      setConnectionStatus("Offline");
    }
  };

  useEffect(() => {
    verificarConexao();
    const interval = setInterval(verificarConexao, 30000); // Verificar a cada 30s
    return () => clearInterval(interval);
  }, [serverUrl]);

  const gerarAudio = async () => {
    if (!texto.trim()) {
      toast({
        title: "Erro",
        description: "Digite um texto para gerar o áudio",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('local-tts', {
        body: {
          text: texto.trim(),
          voice: voz
        }
      });

      if (error) throw error;

      if (data.success) {
        // Convert base64 to blob
        const binaryString = atob(data.audio_data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        const newAudio: AudioGeneration = {
          id: Date.now().toString(),
          texto: data.text,
          voz: data.voice,
          audioData: audioUrl,
          timestamp: Date.now(),
          status: 'success'
        };

        setAudioHistory(prev => [newAudio, ...prev.slice(0, 9)]);
        setCurrentAudio(audioUrl);

        toast({
          title: "✅ Áudio gerado!",
          description: `Voz ${data.voice} processada com sucesso via Piper TTS`,
        });
      } else {
        throw new Error(data.error || 'Servidor de voz indisponível no momento.');
      }
    } catch (error: any) {
      console.error('Erro ao gerar áudio:', error);
      
      const errorAudio: AudioGeneration = {
        id: Date.now().toString(),
        texto: texto.substring(0, 50) + (texto.length > 50 ? '...' : ''),
        voz,
        audioData: '',
        timestamp: Date.now(),
        status: 'error'
      };
      
      setAudioHistory(prev => [errorAudio, ...prev.slice(0, 9)]);

      toast({
        title: "❌ Erro na geração",
        description: error.message || "Servidor de voz indisponível no momento.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playPauseAudio = (audioData?: string) => {
    const audioToPlay = audioData || currentAudio;
    if (!audioToPlay || !audioRef.current) return;

    if (audioRef.current.src !== audioToPlay) {
      audioRef.current.src = audioToPlay;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const downloadAudio = (audioData: string, filename: string) => {
    const link = document.createElement('a');
    link.href = audioData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">🎤 Síntese de Voz com Piper TTS</h2>
          <p className="text-muted-foreground">Geração de áudio ultra-realista com inteligência artificial</p>
        </div>
      </div>

      {/* Tabs para organizar funcionalidades */}
      <Tabs defaultValue="gerador" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gerador">Gerador de Áudio</TabsTrigger>
          <TabsTrigger value="lote">Geração em Lote</TabsTrigger>
        </TabsList>

        <TabsContent value="gerador" className="space-y-6">
          {/* Status do Servidor */}
          <Card>
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
              <div className="flex items-center justify-between">
                <Alert className={connectionStatus === "Conectado" ? "border-green-200" : "border-red-200"}>
                  {connectionStatus === "Conectado" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <AlertDescription>
                    <div className="flex items-center justify-between w-full">
                      <span>
                        Servidor: {serverUrl} - Status: {connectionStatus}
                      </span>
                      <Badge variant={connectionStatus === "Conectado" ? "default" : "destructive"}>
                        {connectionStatus}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={verificarConexao}
                  disabled={connectionStatus === "Verificando..."}
                >
                  {connectionStatus === "Verificando..." ? "Verificando..." : "Verificar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configuração do Servidor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração do Servidor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="server-url">URL do Servidor Piper TTS</Label>
                  <Input
                    id="server-url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:8080"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gerador Principal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Gerar Áudio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="voz">Voz</Label>
                  <Select value={voz} onValueChange={setVoz}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma voz" />
                    </SelectTrigger>
                    <SelectContent>
                      {vozesDisponiveis.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="texto">Texto para conversão</Label>
                  <Textarea
                    id="texto"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Digite o texto que deseja converter em áudio..."
                    rows={4}
                    maxLength={1000}
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    {texto.length}/1000 caracteres
                  </div>
                </div>

                <Button
                  onClick={gerarAudio}
                  disabled={isGenerating || !texto.trim() || connectionStatus !== "Conectado"}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando áudio...
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Gerar Áudio com Piper TTS
                    </>
                  )}
                </Button>
              </div>

              {/* Player de Áudio */}
              {currentAudio && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Áudio gerado com sucesso!</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => playPauseAudio()}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadAudio(currentAudio, `audio-${voz}-${Date.now()}.wav`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Histórico */}
          {audioHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Áudios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {audioHistory.map((audio) => (
                    <div
                      key={audio.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {audio.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">Voz: {audio.voz}</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(audio.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {audio.texto}
                        </p>
                      </div>
                      
                      {audio.status === 'success' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => playPauseAudio(audio.audioData)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadAudio(audio.audioData, `audio-${audio.voz}-${audio.timestamp}.wav`)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lote" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Geração em Lote
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Funcionalidade de geração em lote em desenvolvimento. 
                  Em breve você poderá gerar múltiplos áudios simultaneamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audio Element */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
