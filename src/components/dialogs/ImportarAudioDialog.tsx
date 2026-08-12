import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, Pause, Trash2, FileAudio, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportarAudioDialogProps {
  children: React.ReactNode;
  onAudioImported: (voice: any) => void;
}

export function ImportarAudioDialog({ children, onAudioImported }: ImportarAudioDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    categoria: "",
    genero: "",
    descricao: "",
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se é um arquivo de áudio
    if (!file.type.startsWith('audio/')) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione um arquivo de áudio válido"
      });
      return;
    }

    // Verificar tamanho do arquivo (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O arquivo deve ter no máximo 10MB"
      });
      return;
    }

    setAudioFile(file);
    
    // Criar URL para preview
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    
    // Auto-preencher nome se estiver vazio
    if (!formData.nome) {
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extensão
      setFormData(prev => ({ ...prev, nome: fileName }));
    }

    toast({
      title: "Arquivo carregado!",
      description: `Áudio "${file.name}" pronto para importação`
    });
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleRemoveFile = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioFile(null);
    setAudioUrl(null);
    setIsPlaying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportar = async () => {
    if (!audioFile || !formData.nome.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um arquivo e preencha o nome da voz"
      });
      return;
    }

    setLoading(true);

    try {
      // Simular upload do arquivo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Criar nova voz com o áudio importado
      const novaVoz = {
        id: Date.now(),
        nome: formData.nome,
        genero: formData.genero || "Neutro",
        categoria: formData.categoria || "Importada",
        idioma: "Português BR",
        qualidade: "Importada",
        campanhasAtivas: 0,
        minutosUsados: 0,
        criadaEm: new Date().toISOString().split('T')[0],
        descricao: formData.descricao || `Voz importada do arquivo ${audioFile.name}`,
        amostra: audioUrl, // Em produção, seria a URL do arquivo uploaded
        personalizacao: {
          velocidade: 1.0,
          tom: 0.8,
          pausa: 0.3
        },
        scripts: [
          `Olá {nome}, aqui é ${formData.nome}...`,
          `Boa tarde {nome}, tudo bem? Aqui é ${formData.nome}...`
        ],
        tipoOrigem: "importada",
        arquivoOriginal: audioFile.name
      };

      onAudioImported(novaVoz);
      
      toast({
        title: "Áudio importado com sucesso!",
        description: `A voz ${formData.nome} foi adicionada ao sistema.`
      });

      setOpen(false);
      
      // Reset form
      setFormData({
        nome: "",
        categoria: "",
        genero: "",
        descricao: "",
      });
      handleRemoveFile();
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao importar áudio"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Áudio Pronto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Upload Area */}
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {!audioFile ? (
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileAudio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Clique para selecionar um arquivo de áudio
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Suporta MP3, WAV, OGG, M4A • Máximo 10MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileAudio className="w-8 h-8 text-primary" />
                        <div className="text-left">
                          <div className="font-medium">{audioFile.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(audioFile.size)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePlayPause}
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
                          onClick={handleRemoveFile}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {audioUrl && (
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        onLoadedMetadata={() => {
                          const duration = audioRef.current?.duration;
                          if (duration) {
                            console.log(`Duração: ${formatDuration(duration)}`);
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configurações da Voz */}
          {audioFile && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-4">
                <h4 className="font-medium text-foreground">Informações da Voz</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome da Voz *</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Maria Apresentadora"
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    />
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
                      <SelectItem value="Narração">Narração</SelectItem>
                      <SelectItem value="Institucional">Institucional</SelectItem>
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
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImportar} 
            disabled={loading || !audioFile}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Importar Áudio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}