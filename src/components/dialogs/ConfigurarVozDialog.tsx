import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Upload, Mic, Settings, Loader2, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ConfigurarVozDialogProps {
  children: React.ReactNode;
  voz: any;
  onVoiceUpdated: (updatedVoice: any) => void;
}

export function ConfigurarVozDialog({ children, voz, onVoiceUpdated }: ConfigurarVozDialogProps) {
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
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [gerandoAudio, setGerandoAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
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

  // Carregar dados da voz quando o diálogo abrir
  useEffect(() => {
    if (open && voz) {
      setFormData({
        nome: voz.nome || "",
        categoria: voz.configuracoes?.categoria || "",
        genero: voz.configuracoes?.genero || "",
        descricao: voz.configuracoes?.descricao || "",
        textoTeste: "Olá, esta é uma demonstração da minha voz sintética.",
        configuracao: {
          velocidade: [voz.configuracoes?.personalizacao?.velocidade || 1.0],
          tom: [voz.configuracoes?.personalizacao?.tom || 0.8],
          pausa: [voz.configuracoes?.personalizacao?.pausa || 0.3]
        }
      });
      setVozSelecionada(voz.configuracoes?.luvvoiceId || "pt-br-jenny");
    }
  }, [open, voz]);

  const [audioTeste, setAudioTeste] = useState<string | null>(null);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const audio = audioRef.current;
      
      // Se há um áudio de teste, usar ele; senão, usar áudio de demonstração
      if (audioTeste || voz?.amostra) {
        audio.src = audioTeste || voz?.amostra || "";
      } else {
        // Para demonstração, simular reprodução sem áudio real
        setIsPlaying(true);
        // Simular duração do áudio
        setTimeout(() => setIsPlaying(false), 3000);
        
        toast({
          title: "Reproduzindo demonstração",
          description: "Gere um teste de áudio para ouvir a voz real."
        });
        return;
      }
      
      audio.onended = () => setIsPlaying(false);
      audio.onloadeddata = () => {
        audio.play().catch(() => {
          toast({
            variant: "destructive", 
            title: "Erro de áudio",
            description: "Não foi possível reproduzir o áudio"
          });
          setIsPlaying(false);
        });
      };
      
      setIsPlaying(true);
    }
  };

  const handleGerarTeste = async () => {
    if (!vozSelecionada || !formData.textoTeste.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Digite um texto para teste"
      });
      return;
    }

    setGerandoAudio(true);
    
    try {
      // Usar edge function com LuvVoice gratuita
      const { data, error } = await supabase.functions.invoke('generate-audio-luvvoice', {
        body: {
          text: formData.textoTeste,
          voice: vozSelecionada,
          name: `config-teste-${voz.nome}`
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro na geração do áudio');
      }

      setAudioTeste(data.audio_url);
      
      toast({
        title: "Áudio regenerado!",
        description: `Teste com voz gratuita ${data.voice_used} pronto.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao gerar áudio de teste"
      });
    } finally {
      setGerandoAudio(false);
    }
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O nome da voz é obrigatório"
      });
      return;
    }

    setLoading(true);

    try {
      const vozAtualizada = {
        ...voz,
        nome: formData.nome,
        categoria: formData.categoria,
        genero: formData.genero,
        descricao: formData.descricao,
        personalizacao: {
          velocidade: formData.configuracao.velocidade[0],
          tom: formData.configuracao.tom[0],
          pausa: formData.configuracao.pausa[0]
        },
        luvvoiceId: vozSelecionada
      };

      onVoiceUpdated(vozAtualizada);
      
      toast({
        title: "Configurações salvas!",
        description: `A voz ${formData.nome} foi atualizada com sucesso.`
      });

      setOpen(false);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao salvar configurações"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (voz) {
      setFormData({
        nome: voz.nome || "",
        categoria: voz.categoria || "",
        genero: voz.genero || "",
        descricao: voz.descricao || "",
        textoTeste: "Olá, esta é uma demonstração da minha voz sintética.",
        configuracao: {
          velocidade: [voz.personalizacao?.velocidade || 1.0],
          tom: [voz.personalizacao?.tom || 0.8],
          pausa: [voz.personalizacao?.pausa || 0.3]
        }
      });
      setVozSelecionada(voz.luvvoiceId || "pt-br-jenny");
      
      toast({
        title: "Configurações restauradas",
        description: "Valores originais foram restaurados"
      });
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
            <Settings className="w-5 h-5 text-primary" />
            Configurar Voz: {voz?.nome} (LuvVoice Gratuita)
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
              <Label htmlFor="voz">Voz Base LuvVoice (Gratuita)</Label>
              <Select value={vozSelecionada} onValueChange={setVozSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz gratuita" />
                </SelectTrigger>
                <SelectContent>
                  {vozesLuvVoice.map((vozOption) => (
                    <SelectItem key={vozOption.id} value={vozOption.id}>
                      <div className="flex items-center gap-2">
                        <span>{vozOption.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {vozOption.genero}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {vozOption.categoria}
                        </Badge>
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                          {vozOption.tipo}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                ✅ Usando vozes completamente gratuitas da LuvVoice
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
              <Label htmlFor="genero">Gênero</Label>
              <Select 
                value={formData.genero} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, genero: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gênero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Neutro">Neutro</SelectItem>
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
                <h4 className="font-medium text-foreground mb-3">Teste com Voz Gratuita</h4>
                
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
                    disabled={gerandoAudio}
                    variant="outline"
                    className="w-full"
                  >
                    {gerandoAudio ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {gerandoAudio ? "Gerando Áudio..." : "Regenerar com Novas Configurações"}
                  </Button>

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
                      ✅ Reproduzir amostra da voz gratuita
                    </div>
                    <audio ref={audioRef} preload="metadata" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-3">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Scripts Exemplo
                </h4>
                
                <div className="space-y-2">
                  {voz?.scripts?.slice(0, 2).map((script: string, index: number) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/50 text-sm">
                      "{script}"
                    </div>
                  )) || (
                    <>
                      <div className="p-3 rounded-lg bg-muted/50 text-sm">
                        "Olá {'{nome}'}, aqui é {formData.nome || 'a voz'}..."
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-sm">
                        "Boa tarde {'{nome}'}, tudo bem? Aqui é {formData.nome || 'a voz'}..."
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-3">Estatísticas de Uso</h4>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-primary">{voz?.campanhasAtivas || 0}</div>
                    <div className="text-muted-foreground">Campanhas Ativas</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-accent">{voz?.minutosUsados || 0}</div>
                    <div className="text-muted-foreground">Minutos Gerados</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  <strong>Criada em:</strong> {voz?.criadaEm || "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Original
          </Button>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
