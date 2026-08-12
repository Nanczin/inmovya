import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  Play, 
  Pause, 
  Square,
  Clock,
  Users,
  PhoneCall,
  Upload,
  Download
} from "lucide-react";

interface Contato {
  id: string;
  numero: string;
  nome: string;
  status: 'pendente' | 'chamando' | 'concluido' | 'falha';
  tentativas: number;
  ultimaLigacao?: string;
}

interface Campanha {
  id: string;
  nome: string;
  audioUrl: string;
  contatos: Contato[];
  status: 'criada' | 'executando' | 'pausada' | 'concluida';
  intervalo: number; // segundos entre ligações
  maxTentativas: number;
  taskerUrl: string;
  criadaEm: string;
}

interface CampanhaManagerProps {
  taskerConfig: {
    ip: string;
    porta: string;
    ngrok_url: string;
    status: string;
  };
}

export function CampanhaManager({ taskerConfig }: CampanhaManagerProps) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [novaCampanha, setNovaCampanha] = useState({
    nome: '',
    audioUrl: '',
    intervalo: 30,
    maxTentativas: 3
  });
  const [contatosTexto, setContatosTexto] = useState('');
  const [campanhaAtiva, setCampanhaAtiva] = useState<string | null>(null);
  const { toast } = useToast();

  const getTaskerBaseUrl = () => {
    if (taskerConfig.ngrok_url && taskerConfig.ngrok_url.trim()) {
      let url = taskerConfig.ngrok_url.trim();
      if (!url.startsWith('http')) {
        // Para URLs locais (com IP), usar http por padrão
        if (url.startsWith('192.168.') || url.startsWith('10.') || url.startsWith('172.') || url.includes('localhost')) {
          url = 'http://' + url;
        } else {
          url = 'https://' + url;
        }
      }
      return url;
    }
    return `http://${taskerConfig.ip}:${taskerConfig.porta}`;
  };

  const processarContatos = (texto: string): Contato[] => {
    const linhas = texto.split('\n').filter(linha => linha.trim());
    return linhas.map((linha, index) => {
      const partes = linha.split(',').map(p => p.trim());
      let numero = partes[0].replace(/\D/g, ''); // apenas números
      const nome = partes[1] || `Contato ${index + 1}`;
      
      // Normalizar telefone (formato brasileiro)
      if (numero.length === 8 || numero.length === 9) {
        numero = '11' + numero; // Adicionar DDD 11 se não tiver
      }
      
      // Se tem 13 dígitos, remover o 55 do início
      if (numero.length === 13 && numero.startsWith('55')) {
        numero = numero.substring(2);
      }
      
      // Se tem 12 dígitos, remover o 0 após o código do país
      if (numero.length === 12 && numero.startsWith('55')) {
        numero = numero.substring(2);
      }
      
      return {
        id: `contato-${Date.now()}-${index}`,
        numero,
        nome,
        status: 'pendente' as const,
        tentativas: 0
      };
    });
  };

  const criarCampanha = () => {
    if (!novaCampanha.nome || !novaCampanha.audioUrl || !contatosTexto) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const contatos = processarContatos(contatosTexto);
    if (contatos.length === 0) {
      toast({
        title: "Erro nos contatos",
        description: "Adicione pelo menos um contato válido",
        variant: "destructive"
      });
      return;
    }

    const campanha: Campanha = {
      id: `campanha-${Date.now()}`,
      nome: novaCampanha.nome,
      audioUrl: novaCampanha.audioUrl,
      contatos,
      status: 'criada',
      intervalo: novaCampanha.intervalo,
      maxTentativas: novaCampanha.maxTentativas,
      taskerUrl: getTaskerBaseUrl(),
      criadaEm: new Date().toLocaleString('pt-BR')
    };

    setCampanhas(prev => [...prev, campanha]);
    
    // Limpar formulário
    setNovaCampanha({
      nome: '',
      audioUrl: '',
      intervalo: 30,
      maxTentativas: 3
    });
    setContatosTexto('');

    toast({
      title: "✅ Campanha criada!",
      description: `${contatos.length} contatos adicionados`
    });
  };

  const executarLigacao = async (campanha: Campanha, contato: Contato) => {
    try {
      // Atualizar status do contato
      setCampanhas(prev => prev.map(c => 
        c.id === campanha.id 
          ? {
              ...c,
              contatos: c.contatos.map(ct => 
                ct.id === contato.id 
                  ? { ...ct, status: 'chamando', tentativas: ct.tentativas + 1 }
                  : ct
              )
            }
          : c
      ));

      // Fazer chamada para o webhook do Tasker via Supabase
      const webhookUrl = 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/tasker-webhook';
      
      const payload = {
        mensagem: `Ligação automática para ${contato.nome} no número ${contato.numero}. Reproduzindo áudio: ${campanha.audioUrl}`,
        voz: 'pt-BR-Edresson',
        velocidade: 1.0,
        numero: contato.numero,
        audio_url: campanha.audioUrl
      };
      
      console.log(`📞 Disparando ligação via webhook:`, payload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Resposta do webhook CampanhaManager:', result);
        
        // Sucesso - Webhook processou o comando
        setCampanhas(prev => prev.map(c => 
          c.id === campanha.id 
            ? {
                ...c,
                contatos: c.contatos.map(ct => 
                  ct.id === contato.id 
                    ? { 
                        ...ct, 
                        status: 'concluido',
                        ultimaLigacao: new Date().toLocaleString('pt-BR')
                      }
                    : ct
                )
              }
            : c
        ));

        toast({
          title: "📞 Ligação disparada",
          description: `${contato.nome} - ${result.mensagem || 'comando processado'}`
        });
      } else {
        const errorData = await response.json();
        console.error('❌ Erro do webhook CampanhaManager:', errorData);
        throw new Error(`Webhook erro: ${errorData.mensagem || response.status}`);
      }
    } catch (error: any) {
      console.error('Erro na ligação:', error);
      
      setCampanhas(prev => prev.map(c => 
        c.id === campanha.id 
          ? {
              ...c,
              contatos: c.contatos.map(ct => 
                ct.id === contato.id 
                  ? { ...ct, status: 'falha' }
                  : ct
              )
            }
          : c
      ));

      toast({
        title: "❌ Falha na ligação",
        description: `${contato.nome}: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const executarCampanha = async (campanhaId: string) => {
    const campanha = campanhas.find(c => c.id === campanhaId);
    if (!campanha) return;

    setCampanhaAtiva(campanhaId);
    setCampanhas(prev => prev.map(c => 
      c.id === campanhaId ? { ...c, status: 'executando' } : c
    ));

    const contatosPendentes = campanha.contatos.filter(c => 
      c.status === 'pendente' || (c.status === 'falha' && c.tentativas < campanha.maxTentativas)
    );

    for (const contato of contatosPendentes) {
      if (campanhaAtiva !== campanhaId) break; // Parada

      await executarLigacao(campanha, contato);
      
      // Aguardar intervalo entre ligações
      if (contatosPendentes.indexOf(contato) < contatosPendentes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, campanha.intervalo * 1000));
      }
    }

    setCampanhaAtiva(null);
    setCampanhas(prev => prev.map(c => 
      c.id === campanhaId ? { ...c, status: 'concluida' } : c
    ));

    toast({
      title: "🎉 Campanha concluída!",
      description: `${contatosPendentes.length} ligações processadas`
    });
  };

  const pausarCampanha = (campanhaId: string) => {
    setCampanhaAtiva(null);
    setCampanhas(prev => prev.map(c => 
      c.id === campanhaId ? { ...c, status: 'pausada' } : c
    ));
    
    toast({
      title: "⏸️ Campanha pausada",
      description: "Execução interrompida"
    });
  };

  const getStatusCampanhaColor = (status: string) => {
    switch (status) {
      case 'executando': return "bg-primary text-primary-foreground";
      case 'concluida': return "bg-success text-success-foreground";
      case 'pausada': return "bg-warning text-warning-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusContatoColor = (status: string) => {
    switch (status) {
      case 'concluido': return "bg-success text-success-foreground";
      case 'chamando': return "bg-primary text-primary-foreground";
      case 'falha': return "bg-destructive text-destructive-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const exportarContatos = () => {
    const exemplo = `11999999999,João Silva
11888888888,Maria Santos
11777777777,Pedro Costa`;
    
    const blob = new Blob([exemplo], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-contatos.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Criar Nova Campanha */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Nova Campanha de Ligações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome-campanha">Nome da Campanha</Label>
              <Input
                id="nome-campanha"
                value={novaCampanha.nome}
                onChange={(e) => setNovaCampanha(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Prospecção Janeiro 2024"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="audio-url">URL do Áudio (LuvVoice)</Label>
              <Input
                id="audio-url"
                value={novaCampanha.audioUrl}
                onChange={(e) => setNovaCampanha(prev => ({ ...prev, audioUrl: e.target.value }))}
                placeholder="https://seudominio.com/audio.mp3"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="intervalo">Intervalo entre ligações (segundos)</Label>
              <Select value={novaCampanha.intervalo.toString()} onValueChange={(value) => setNovaCampanha(prev => ({ ...prev, intervalo: parseInt(value) }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 segundos</SelectItem>
                  <SelectItem value="30">30 segundos</SelectItem>
                  <SelectItem value="60">1 minuto</SelectItem>
                  <SelectItem value="120">2 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="max-tentativas">Máximo de tentativas por contato</Label>
              <Select value={novaCampanha.maxTentativas.toString()} onValueChange={(value) => setNovaCampanha(prev => ({ ...prev, maxTentativas: parseInt(value) }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 tentativa</SelectItem>
                  <SelectItem value="2">2 tentativas</SelectItem>
                  <SelectItem value="3">3 tentativas</SelectItem>
                  <SelectItem value="5">5 tentativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="contatos">Lista de Contatos</Label>
              <Button variant="outline" size="sm" onClick={exportarContatos}>
                <Download className="w-4 h-4 mr-1" />
                Baixar modelo
              </Button>
            </div>
            <Textarea
              id="contatos"
              value={contatosTexto}
              onChange={(e) => setContatosTexto(e.target.value)}
              placeholder="11999999999,João Silva&#10;11888888888,Maria Santos&#10;11777777777,Pedro Costa"
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Formato: numero,nome (um por linha). Exemplo: 11999999999,João Silva
            </p>
          </div>

          <Button onClick={criarCampanha} className="w-full">
            <PhoneCall className="w-4 h-4 mr-2" />
            Criar Campanha
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Campanhas */}
      {campanhas.map(campanha => (
        <Card key={campanha.id} className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                {campanha.nome}
              </CardTitle>
              <Badge className={getStatusCampanhaColor(campanha.status)}>
                {campanha.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Criada em: {campanha.criadaEm} • {campanha.contatos.length} contatos
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-2 rounded bg-gradient-card">
                <div className="text-lg font-bold text-primary">
                  {campanha.contatos.filter(c => c.status === 'pendente').length}
                </div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
              <div className="text-center p-2 rounded bg-gradient-card">
                <div className="text-lg font-bold text-warning">
                  {campanha.contatos.filter(c => c.status === 'chamando').length}
                </div>
                <div className="text-xs text-muted-foreground">Chamando</div>
              </div>
              <div className="text-center p-2 rounded bg-gradient-card">
                <div className="text-lg font-bold text-success">
                  {campanha.contatos.filter(c => c.status === 'concluido').length}
                </div>
                <div className="text-xs text-muted-foreground">Concluídos</div>
              </div>
              <div className="text-center p-2 rounded bg-gradient-card">
                <div className="text-lg font-bold text-destructive">
                  {campanha.contatos.filter(c => c.status === 'falha').length}
                </div>
                <div className="text-xs text-muted-foreground">Falhas</div>
              </div>
            </div>

            {/* Controles */}
            <div className="flex gap-2">
              {campanha.status === 'executando' ? (
                <Button 
                  variant="destructive" 
                  onClick={() => pausarCampanha(campanha.id)}
                  disabled={campanhaAtiva !== campanha.id}
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pausar
                </Button>
              ) : (
                <Button 
                  onClick={() => executarCampanha(campanha.id)}
                  disabled={taskerConfig.status !== 'Conectado' || !!campanhaAtiva}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Executar
                </Button>
              )}
            </div>

            {/* Lista de contatos (primeiros 5) */}
            <div className="space-y-2">
              <Label>Contatos ({campanha.contatos.length} total)</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {campanha.contatos.slice(0, 10).map(contato => (
                  <div key={contato.id} className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <div className="flex-1">
                      <div className="font-medium">{contato.nome}</div>
                      <div className="text-sm text-muted-foreground">{contato.numero}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusContatoColor(contato.status)}>
                        {contato.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {contato.tentativas}/{campanha.maxTentativas}
                      </div>
                    </div>
                  </div>
                ))}
                {campanha.contatos.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    ... e mais {campanha.contatos.length - 10} contatos
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {campanhas.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center">
            <PhoneCall className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhuma campanha criada</h3>
            <p className="text-muted-foreground">
              Crie sua primeira campanha de ligações automatizadas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}