
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Pause, 
  Download,
  Search,
  Trash2,
  Clock,
  Volume2,
  Copy,
  ExternalLink
} from "lucide-react";

interface AudioGenerated {
  id: string;
  texto: string;
  audio_url: string;
  voz: string;
  duracao?: string;
  created_at: string;
  size?: number;
}

export function AudioLibrary() {
  const [audios, setAudios] = useState<AudioGenerated[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    carregarAudios();
  }, []);

  const carregarAudios = () => {
    // Carregar áudios do localStorage
    try {
      const audiosStorage = localStorage.getItem('audioLibrary');
      if (audiosStorage) {
        const audiosParsed = JSON.parse(audiosStorage);
        setAudios(audiosParsed);
      }
    } catch (error) {
      console.error('Erro ao carregar biblioteca de áudios:', error);
    } finally {
      setLoading(false);
    }
  };

  const salvarAudio = (audio: Omit<AudioGenerated, 'id' | 'created_at'>) => {
    const novoAudio: AudioGenerated = {
      ...audio,
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    };

    const audiosAtuais = [...audios, novoAudio];
    setAudios(audiosAtuais);
    
    // Salvar no localStorage
    localStorage.setItem('audioLibrary', JSON.stringify(audiosAtuais));
    
    toast({
      title: "Áudio salvo na biblioteca!",
      description: `Áudio "${audio.texto.substring(0, 30)}..." adicionado`,
    });
  };

  const excluirAudio = (audioId: string) => {
    const audiosAtualizados = audios.filter(audio => audio.id !== audioId);
    setAudios(audiosAtualizados);
    localStorage.setItem('audioLibrary', JSON.stringify(audiosAtualizados));
    
    toast({
      title: "Áudio excluído",
      description: "Áudio removido da biblioteca",
    });
  };

  const reproduzirAudio = (audioId: string, url: string) => {
    if (playingAudio === audioId) {
      setPlayingAudio(null);
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => audio.pause());
    } else {
      setPlayingAudio(audioId);
      
      try {
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => setPlayingAudio(null);
        audio.onerror = () => {
          toast({
            title: "Erro na reprodução",
            description: "Não foi possível reproduzir o áudio",
            variant: "destructive"
          });
          setPlayingAudio(null);
        };
      } catch (error) {
        console.error('Erro ao reproduzir áudio:', error);
        setPlayingAudio(null);
      }
    }
  };

  const copiarUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "URL copiada!",
      description: "Link do áudio copiado para a área de transferência"
    });
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

  const audiosFiltrados = audios.filter(audio =>
    audio.texto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audio.voz.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Expor função globalmente para outros componentes
  window.salvarAudioNaBiblioteca = salvarAudio;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Carregando biblioteca...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">🎵 Biblioteca de Áudios</h3>
          <p className="text-muted-foreground">Seus áudios gerados e salvos</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {audios.length} áudios salvos
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar áudios por texto ou voz..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{audios.length}</div>
                <div className="text-sm text-muted-foreground">Total de Áudios</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-accent text-accent-foreground">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {audios.filter(a => {
                    const hoje = new Date();
                    const criadoEm = new Date(a.created_at);
                    return hoje.toDateString() === criadoEm.toDateString();
                  }).length}
                </div>
                <div className="text-sm text-muted-foreground">Hoje</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success text-success-foreground">
                <Play className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{audiosFiltrados.length}</div>
                <div className="text-sm text-muted-foreground">Filtrados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audio List */}
      {audiosFiltrados.length > 0 ? (
        <div className="space-y-4">
          {audiosFiltrados.map((audio) => (
            <Card key={audio.id} className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{audio.voz}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(audio.created_at).toLocaleString('pt-BR')}
                      </span>
                      {audio.duracao && (
                        <Badge variant="secondary">{audio.duracao}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground mb-2 line-clamp-2">
                      {audio.texto}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      URL: {audio.audio_url.substring(0, 50)}...
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reproduzirAudio(audio.id, audio.audio_url)}
                    >
                      {playingAudio === audio.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copiarUrl(audio.audio_url)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => baixarAudio(audio.audio_url, audio.texto)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(audio.audio_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Áudio</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir este áudio da biblioteca? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => excluirAudio(audio.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <Volume2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm ? 'Nenhum áudio encontrado' : 'Biblioteca vazia'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Tente ajustar sua busca ou limpar o filtro'
                : 'Os áudios gerados aparecerão aqui automaticamente'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
