import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Upload, Mic, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NovaVozDialogProps {
  children: React.ReactNode;
  onVoiceCreated: (voice: any) => void;
}

export function NovaVozDialog({ children, onVoiceCreated }: NovaVozDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    categoria: "",
    genero: "",
    descricao: "",
    textoTeste: "Olá, esta é uma demonstração da minha voz sintética.",
    configuracao: {
      velocidade: [1.0],
      tom: [0.8],
      pausa: [0.3]
    }
  });
  const { toast } = useToast();

  // Vozes gratuitas disponíveis da LuvVoice
  const vozesLuvVoice = [
    { id: "pt-br-jenny", nome: "Francisca", genero: "Feminino", categoria: "Natural", tipo: "Gratuita" },
    { id: "pt-br-antonio", nome: "Antonio", genero: "Masculino", categoria: "Profissional", tipo: "Gratuita" },
    { id: "pt-br-amanda", nome: "Thalita", genero: "Feminino", categoria: "Comercial", tipo: "Gratuita" },
    { id: "pt-br-ricardo", nome: "Fabio", genero: "Masculino", categoria: "Executivo", tipo: "Gratuita" },
    { id: "pt-br-camila", nome: "Brenda", genero: "Feminino", categoria: "Jovem", tipo: "Gratuita" },
    { id: "pt-br-bruno", nome: "Nicolau", genero: "Masculino", categoria: "Consultor", tipo: "Gratuita" }
  ];

  const [vozSelecionada, setVozSelecionada] = useState<string>("");
  const [audioTeste, setAudioTeste] = useState<string | null>(null);
  const [gerandoAudio, setGerandoAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Função para reproduzir/pausar áudio
  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const audio = audioRef.current;
      
      // Se há um áudio de teste, usar ele; senão, gerar áudio sintético da voz
      if (audioTeste) {
        // Verificar se é um data URL válido ou um blob URL
        if (audioTeste.startsWith('data:audio/') || audioTeste.startsWith('blob:') || audioTeste.startsWith('http')) {
          audio.src = audioTeste;
          audio.onended = () => setIsPlaying(false);
          audio.onerror = (e) => {
            console.error("Erro ao carregar áudio:", audioTeste);
            toast({
              title: "❌ Erro no áudio",
              description: "Não foi possível reproduzir o áudio gerado. Usando demonstração sintética.",
              variant: "destructive"
            });
            playVoiceBeep();
          };
          
          setIsPlaying(true);
          audio.play().catch((error) => {
            console.error("Erro ao reproduzir áudio:", error);
            toast({
              title: "❌ Erro na reprodução",
              description: "Usando demonstração sintética da voz.",
              variant: "destructive"
            });
            playVoiceBeep();
          });
        } else {
          playVoiceBeep();
        }
      } else {
        // Reproduzir um beep representativo da voz selecionada
        playVoiceBeep();
      }
    }
  };

  // Função para gerar um beep representativo da voz selecionada
  const playVoiceBeep = () => {
    if (!vozSelecionada) {
      toast({
        title: "Selecione uma voz",
        description: "Escolha uma voz base LuvVoice para ouvir uma demonstração."
      });
      return;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Diferentes frequências baseadas no gênero da voz selecionada
      const vozBase = vozesLuvVoice.find(v => v.id === vozSelecionada);
      const frequency = vozBase?.genero === "Feminino" ? 1200 : 600; // Feminino mais agudo, masculino mais grave
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1.5);

      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 1500);

      toast({
        title: `Demonstração da voz ${vozBase?.nome}`,
        description: "Clique em 'Gerar Teste' para ouvir a voz real sintetizada."
      });
    } catch (error) {
      console.error("Erro ao gerar áudio sintético:", error);
      toast({
        variant: "destructive",
        title: "Erro de áudio",
        description: "Não foi possível reproduzir áudio neste navegador"
      });
    }
  };

  const handleGerarTeste = async () => {
    if (!vozSelecionada || !formData.textoTeste.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione uma voz e digite um texto para teste"
      });
      return;
    }

    setGerandoAudio(true);
    
    try {
      // Usar a edge function para gerar áudio com LuvVoice gratuito
      const { data, error } = await supabase.functions.invoke('generate-audio-luvvoice', {
        body: {
          text: formData.textoTeste,
          voice: vozSelecionada,
          name: `teste-${formData.nome || 'voz'}`
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro na geração do áudio');
      }

      setAudioTeste(data.audio_url);
      
      toast({
        title: "Áudio gerado com sucesso!",
        description: `Teste criado com a voz ${data.voice_used} (LuvVoice gratuita).`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar áudio:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Falha ao gerar áudio de teste"
      });
    } finally {
      setGerandoAudio(false);
    }
  };

  const handleCriarVoz = async () => {
    if (!formData.nome.trim() || !vozSelecionada) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha os campos obrigatórios"
      });
      return;
    }

    setLoading(true);

    try {
      const vozBase = vozesLuvVoice.find(v => v.id === vozSelecionada);
      
      // Simular criação da voz personalizada
      const novaVoz = {
        id: Date.now(),
        nome: formData.nome,
        genero: vozBase?.genero || "Feminino",
        categoria: formData.categoria || vozBase?.categoria || "Personalizada",
        idioma: "Português BR",
        qualidade: "Premium",
        campanhasAtivas: 0,
        minutosUsados: 0,
        criadaEm: new Date().toISOString().split('T')[0],
        descricao: formData.descricao,
        amostra: audioTeste || "/audio/default-sample.mp3",
        personalizacao: {
          velocidade: formData.configuracao.velocidade[0],
          tom: formData.configuracao.tom[0],
          pausa: formData.configuracao.pausa[0]
        },
        scripts: [
          `Olá {nome}, aqui é ${formData.nome}...`,
          `Boa tarde {nome}, tudo bem? Aqui é ${formData.nome}...`
        ],
        luvvoiceId: vozSelecionada
      };

      onVoiceCreated(novaVoz);
      
      toast({
        title: "Voz criada com sucesso!",
        description: `A voz ${formData.nome} foi adicionada ao sistema.`
      });

      setOpen(false);
      
      // Reset form
      setFormData({
        nome: "",
        categoria: "",
        genero: "",
        descricao: "",
        textoTeste: "Olá, esta é uma demonstração da minha voz sintética.",
        configuracao: {
          velocidade: [1.0],
          tom: [0.8],
          pausa: [0.3]
        }
      });
      setVozSelecionada("");
      setAudioTeste(null);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao criar nova voz"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Nova Voz Sintética - LuvVoice Gratuita
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Configurações Básicas */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome da Voz *</Label>
              <Input
                id="nome"
                placeholder="Ex: João Vendedor"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="voz">Voz Base LuvVoice (Gratuita) *</Label>
              <Select value={vozSelecionada} onValueChange={setVozSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz gratuita" />
                </SelectTrigger>
                <SelectContent>
                  {vozesLuvVoice.map((voz) => (
                    <SelectItem key={voz.id} value={voz.id}>
                      <div className="flex items-center gap-2">
                        <span>{voz.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {voz.genero}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {voz.categoria}
                        </Badge>
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                          {voz.tipo}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                ✅ Todas as vozes são completamente gratuitas
              </p>
            </div>

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select 
                value={formData.categoria} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corporativo">Corporativo</SelectItem>
                  <SelectItem value="Vendas">Vendas</SelectItem>
                  <SelectItem value="Consultivo">Consultivo</SelectItem>
                  <SelectItem value="Executivo">Executivo</SelectItem>
                  <SelectItem value="Atendimento">Atendimento</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o uso ideal desta voz..."
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>

            {/* Configurações de Voz */}
            <div className="space-y-4 p-4 rounded-lg bg-gradient-card border border-border">
              <h4 className="font-medium text-foreground">Personalização da Voz</h4>
              
              <div>
                <Label>Velocidade: {formData.configuracao.velocidade[0]}x</Label>
                <Slider
                  value={formData.configuracao.velocidade}
                  onValueChange={(value) => 
                    setFormData(prev => ({
                      ...prev,
                      configuracao: { ...prev.configuracao, velocidade: value }
                    }))
                  }
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Tom: {formData.configuracao.tom[0]}</Label>
                <Slider
                  value={formData.configuracao.tom}
                  onValueChange={(value) => 
                    setFormData(prev => ({
                      ...prev,
                      configuracao: { ...prev.configuracao, tom: value }
                    }))
                  }
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Pausa: {formData.configuracao.pausa[0]}s</Label>
                <Slider
                  value={formData.configuracao.pausa}
                  onValueChange={(value) => 
                    setFormData(prev => ({
                      ...prev,
                      configuracao: { ...prev.configuracao, pausa: value }
                    }))
                  }
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          {/* Teste de Voz */}
          <div className="space-y-4">
            <Card className="shadow-card">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-3">Teste de Voz Gratuita</h4>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="textoTeste">Texto para teste</Label>
                    <Textarea
                      id="textoTeste"
                      value={formData.textoTeste}
                      onChange={(e) => setFormData(prev => ({ ...prev, textoTeste: e.target.value }))}
                      className="min-h-[100px]"
                      placeholder="Digite um texto para testar a voz..."
                    />
                  </div>

                  <Button 
                    onClick={handleGerarTeste}
                    disabled={gerandoAudio || !vozSelecionada}
                    variant="outline"
                    className="w-full"
                  >
                    {gerandoAudio ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {gerandoAudio ? "Gerando Áudio..." : "Gerar Teste"}
                  </Button>

                  {audioTeste && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Áudio LuvVoice Gratuito</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={handlePlayPause}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ✅ Áudio gerado com voz gratuita da LuvVoice
                      </div>
                      <audio ref={audioRef} preload="metadata" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-3">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Scripts Exemplo
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    "Olá {'{nome}'}, aqui é {formData.nome || 'a nova voz'}..."
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    "Boa tarde {'{nome}'}, tudo bem? Aqui é {formData.nome || 'a nova voz'}..."
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCriarVoz} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Criar Voz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
