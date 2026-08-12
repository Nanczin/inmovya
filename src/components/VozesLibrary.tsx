import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { NovaVozDialog } from "@/components/dialogs/NovaVozDialog";
import { ImportarAudioDialog } from "@/components/dialogs/ImportarAudioDialog";
import { ConfigurarVozDialog } from "@/components/dialogs/ConfigurarVozDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Upload, 
  Search, 
  Filter,
  Mic,
  Play,
  Pause,
  Download,
  Settings,
  Volume2,
  User,
  Clock,
  Trash2,
  MoreHorizontal,
  Zap
} from "lucide-react";

export function VozesLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [playingVoice, setPlayingVoice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [vozes, setVozes] = useState<any[]>([]);

  useEffect(() => {
    carregarVozes();
  }, []);

  const carregarVozes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vozes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVozes(data || []);
    } catch (error) {
      console.error('Erro ao carregar vozes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as vozes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNovaVoz = async (novaVoz: any) => {
    try {
      const { data, error } = await supabase
        .from('vozes')
        .insert({
          nome: novaVoz.nome,
          tipo: novaVoz.tipo || 'sintetica',
          configuracoes: {
            luvvoiceId: novaVoz.luvvoiceId,
            personalizacao: novaVoz.personalizacao,
            qualidade: novaVoz.qualidade,
            genero: novaVoz.genero,
            categoria: novaVoz.categoria,
            descricao: novaVoz.descricao,
            scripts: novaVoz.scripts,
            campanhasAtivas: novaVoz.campanhasAtivas || 0,
            minutosUsados: novaVoz.minutosUsados || 0
          },
          arquivo_url: novaVoz.amostra,
          ativa: true
        })
        .select()
        .single();

      if (error) throw error;

      setVozes(prev => [data, ...prev]);
      
      toast({
        title: "Voz criada com sucesso!",
        description: `A voz "${novaVoz.nome}" foi adicionada`,
      });
    } catch (error) {
      console.error('Erro ao criar voz:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a voz",
        variant: "destructive",
      });
    }
  };

  const handleVozAtualizada = async (vozAtualizada: any) => {
    try {
      const { error } = await supabase
        .from('vozes')
        .update({
          nome: vozAtualizada.nome,
          configuracoes: {
            luvvoiceId: vozAtualizada.luvvoiceId,
            personalizacao: vozAtualizada.personalizacao,
            qualidade: vozAtualizada.qualidade,
            genero: vozAtualizada.genero,
            categoria: vozAtualizada.categoria,
            descricao: vozAtualizada.descricao,
            scripts: vozAtualizada.scripts,
            campanhasAtivas: vozAtualizada.campanhasAtivas || 0,
            minutosUsados: vozAtualizada.minutosUsados || 0
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', vozAtualizada.id);

      if (error) throw error;

      setVozes(prev => prev.map(voz => 
        voz.id === vozAtualizada.id ? { ...voz, ...vozAtualizada } : voz
      ));
      
      toast({
        title: "Voz atualizada!",
        description: `As configurações foram salvas`,
      });
    } catch (error) {
      console.error('Erro ao atualizar voz:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a voz",
        variant: "destructive",
      });
    }
  };

  const handleExcluirVoz = async (voz: any) => {
    try {
      const { error } = await supabase
        .from('vozes')
        .delete()
        .eq('id', voz.id);

      if (error) throw error;

      setVozes(prev => prev.filter(v => v.id !== voz.id));
      
      toast({
        title: "Voz excluída!",
        description: `A voz "${voz.nome}" foi removida do sistema`,
      });
    } catch (error) {
      console.error('Erro ao excluir voz:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a voz",
        variant: "destructive",
      });
    }
  };

  const getQualityColor = (qualidade: string) => {
    switch (qualidade) {
      case "Premium": return "bg-primary text-primary-foreground";
      case "Standard": return "bg-accent text-accent-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getGenreColor = (genero: string) => {
    switch (genero) {
      case "Feminino": return "bg-pink-100 text-pink-800 border-pink-200";
      case "Masculino": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handlePlayPause = async (voiceId: number) => {
    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => audio.pause());
    } else {
      const voz = vozes.find(v => v.id === voiceId);
      if (!voz) return;

      setPlayingVoice(voiceId);

      if (voz.arquivo_url) {
        try {
          const audio = new Audio(voz.arquivo_url);
          await audio.play();
          audio.onended = () => setPlayingVoice(null);
          audio.onerror = () => {
            console.error('Erro ao reproduzir áudio da voz:', voz.arquivo_url);
            playVoiceSynthesis(voz);
          };
        } catch (error) {
          console.error('Erro ao criar áudio:', error);
          playVoiceSynthesis(voz);
        }
      } else {
        playVoiceSynthesis(voz);
      }
    }
  };

  const playVoiceSynthesis = (voz: any) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const frequency = voz.configuracoes?.genero === "Feminino" ? 1200 : 600;
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 2);

      setTimeout(() => setPlayingVoice(null), 2000);

      toast({
        title: `Demonstração: ${voz.nome}`,
        description: "Som sintético baseado nas configurações da voz"
      });
    } catch (error) {
      console.error("Erro na síntese de áudio:", error);
      setPlayingVoice(null);
    }
  };

  const handleUsarEmCampanha = (voz: any) => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "Em breve você poderá vincular vozes diretamente às campanhas."
    });
  };

  const filteredVozes = vozes.filter(voz =>
    voz.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (voz.configuracoes?.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">🎤 Biblioteca de Vozes</h3>
          <p className="text-muted-foreground">Gerencie suas vozes personalizadas</p>
        </div>
        <div className="flex gap-4">
          <NovaVozDialog onVoiceCreated={handleNovaVoz}>
            <Button variant="hero" className="shadow-elegant">
              <Plus className="w-4 h-4 mr-2" />
              Nova Voz
            </Button>
          </NovaVozDialog>
          <ImportarAudioDialog onAudioImported={handleNovaVoz}>
            <Button variant="success">
              <Upload className="w-4 h-4 mr-2" />
              Importar Áudio
            </Button>
          </ImportarAudioDialog>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar vozes por nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{vozes.length}</div>
                <div className="text-sm text-muted-foreground">Vozes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-accent text-accent-foreground">
                <User className="w-5 h-5" />
              </div>
               <div>
                 <div className="text-2xl font-bold text-foreground">{vozes.filter(v => v.ativa).length}</div>
                 <div className="text-sm text-muted-foreground">Ativas</div>
               </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success text-success-foreground">
                <Mic className="w-5 h-5" />
              </div>
               <div>
                 <div className="text-2xl font-bold text-foreground">{vozes.filter(v => v.configuracoes?.genero === 'Feminino').length}</div>
                 <div className="text-sm text-muted-foreground">Femininas</div>
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
                 <div className="text-2xl font-bold text-foreground">{vozes.filter(v => v.configuracoes?.genero === 'Masculino').length}</div>
                 <div className="text-sm text-muted-foreground">Masculinas</div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Voices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredVozes.map((voz) => (
          <Card key={voz.id} className="shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-3">
                    {voz.nome}
                    <Badge variant="outline" className={getGenreColor(voz.configuracoes?.genero || 'Neutro')}>
                      {voz.configuracoes?.genero || 'Neutro'}
                    </Badge>
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">{voz.configuracoes?.descricao || 'Sem descrição'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getQualityColor(voz.configuracoes?.qualidade || 'Standard')}>
                    {voz.configuracoes?.qualidade || 'Standard'}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleUsarEmCampanha(voz)}>
                        <User className="w-4 h-4 mr-2" />
                        Usar em Campanha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir Voz
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Voz</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a voz "{voz.nome}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleExcluirVoz(voz)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Audio Player */}
              <div className="p-4 rounded-lg bg-gradient-card border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant={playingVoice === voz.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePlayPause(voz.id)}
                    >
                      {playingVoice === voz.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <span className="text-sm font-medium">Amostra de Voz</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                {playingVoice === voz.id && (
                  <Progress value={60} className="h-2" />
                )}
              </div>

              {/* Voice Info */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Categoria:</span>
                  <Badge variant="outline">{voz.configuracoes?.categoria || 'Geral'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{voz.tipo || 'Sintética'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Criada em:</span>
                  <span className="font-medium">
                    {voz.created_at ? new Date(voz.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Carregando vozes...</p>
        </div>
      )}

      {!loading && filteredVozes.length === 0 && (
        <div className="text-center py-8">
          <Mic className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            Nenhuma voz encontrada
          </h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece criando sua primeira voz'}
          </p>
        </div>
      )}
    </div>
  );
}