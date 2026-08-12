import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Monitor,
  Phone,
  Clock,
  TrendingUp,
  Users,
  PhoneCall,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter
} from "lucide-react";

interface CallLog {
  id: string;
  campanha: string;
  numero: string;
  nome: string;
  status: 'sucesso' | 'falha' | 'em_andamento' | 'sem_resposta';
  inicioLigacao: string;
  fimLigacao?: string;
  duracao?: string;
  tentativa: number;
  audioUrl: string;
  taskerDevice: string;
  errorMessage?: string;
}

interface MonitorStats {
  totalLigacoes: number;
  sucessos: number;
  falhas: number;
  emAndamento: number;
  taxaSucesso: number;
  duracaoMedia: string;
}

export function CallMonitor() {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [stats, setStats] = useState<MonitorStats>({
    totalLigacoes: 0,
    sucessos: 0,
    falhas: 0,
    emAndamento: 0,
    taxaSucesso: 0,
    duracaoMedia: '0:00'
  });
  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    const carregarLigacoes = async () => {
      try {
        const { data, error } = await supabase
          .from('ligacoes')
          .select('*')
          .order('data_ligacao', { ascending: false });

        if (error) throw error;

        const ligacoesFormatadas: CallLog[] = data.map(ligacao => ({
          id: ligacao.id,
          campanha: 'Campanha Real',
          numero: ligacao.numero_telefone,
          nome: `Lead ${ligacao.numero_telefone.slice(-4)}`,
          status: ligacao.status as 'sucesso' | 'falha' | 'em_andamento' | 'sem_resposta',
          inicioLigacao: new Date(ligacao.data_ligacao).toLocaleTimeString(),
          fimLigacao: ligacao.duracao ? new Date(ligacao.data_ligacao + ligacao.duracao * 1000).toLocaleTimeString() : undefined,
          duracao: ligacao.duracao ? `${Math.floor(ligacao.duracao / 60)}:${(ligacao.duracao % 60).toString().padStart(2, '0')}` : undefined,
          tentativa: 1,
          audioUrl: ligacao.gravacao_url || '',
          taskerDevice: 'Device Real',
          errorMessage: ligacao.resultado && ligacao.status === 'falha' ? ligacao.resultado : undefined
        }));

        setCallLogs(ligacoesFormatadas);
      } catch (error) {
        console.error('Erro ao carregar ligações:', error);
        setCallLogs([]);
      }
    };

    carregarLigacoes();
  }, []);

  // Calcular estatísticas
  useEffect(() => {
    const total = callLogs.length;
    const sucessos = callLogs.filter(log => log.status === 'sucesso').length;
    const falhas = callLogs.filter(log => log.status === 'falha').length;
    const emAndamento = callLogs.filter(log => log.status === 'em_andamento').length;
    const taxaSucesso = total > 0 ? Math.round((sucessos / total) * 100) : 0;
    
    setStats({
      totalLigacoes: total,
      sucessos,
      falhas,
      emAndamento,
      taxaSucesso,
      duracaoMedia: '0:22'
    });
  }, [callLogs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sucesso': return 'bg-success text-success-foreground';
      case 'falha': return 'bg-destructive text-destructive-foreground';
      case 'em_andamento': return 'bg-primary text-primary-foreground';
      case 'sem_resposta': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sucesso': return <CheckCircle className="w-4 h-4" />;
      case 'falha': return <XCircle className="w-4 h-4" />;
      case 'em_andamento': return <Phone className="w-4 h-4 animate-pulse" />;
      case 'sem_resposta': return <PhoneCall className="w-4 h-4" />;
      default: return <Phone className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sucesso': return 'Sucesso';
      case 'falha': return 'Falha';
      case 'em_andamento': return 'Em andamento';
      case 'sem_resposta': return 'Sem resposta';
      default: return status;
    }
  };

  const filteredLogs = callLogs.filter(log => {
    const matchesSearch = !filtro || 
      log.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      log.numero.includes(filtro) ||
      log.campanha.toLowerCase().includes(filtro.toLowerCase());
    
    const matchesStatus = statusFiltro === 'todos' || log.status === statusFiltro;
    
    return matchesSearch && matchesStatus;
  });

  const iniciarMonitoramento = () => {
    setIsMonitoring(!isMonitoring);
    // Em produção, seria uma conexão WebSocket ou polling
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas em Tempo Real */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalLigacoes}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-success">{stats.sucessos}</div>
            <div className="text-xs text-muted-foreground">Sucessos</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.falhas}</div>
            <div className="text-xs text-muted-foreground">Falhas</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">{stats.emAndamento}</div>
            <div className="text-xs text-muted-foreground">Ativas</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.taxaSucesso}%</div>
            <div className="text-xs text-muted-foreground">Taxa Sucesso</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.duracaoMedia}</div>
            <div className="text-xs text-muted-foreground">Duração Média</div>
          </CardContent>
        </Card>
      </div>

      {/* Controles e Filtros */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Monitor de Ligações em Tempo Real
            </div>
            <Button 
              variant={isMonitoring ? "destructive" : "default"}
              onClick={iniciarMonitoramento}
            >
              {isMonitoring ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Monitorando
                </>
              ) : (
                <>
                  <Monitor className="w-4 h-4 mr-2" />
                  Iniciar Monitor
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="filtro-busca">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="filtro-busca"
                  placeholder="Nome, telefone ou campanha..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="status-filtro">Status</Label>
              <select
                id="status-filtro"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
              >
                <option value="todos">Todos</option>
                <option value="em_andamento">Em andamento</option>
                <option value="sucesso">Sucesso</option>
                <option value="falha">Falha</option>
                <option value="sem_resposta">Sem resposta</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log de Ligações */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Histórico de Ligações ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLogs.map(log => (
                <div key={log.id} className="p-4 rounded-lg border bg-gradient-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(log.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(log.status)}
                          {getStatusText(log.status)}
                        </div>
                      </Badge>
                      <div>
                        <div className="font-medium">{log.nome}</div>
                        <div className="text-sm text-muted-foreground">{log.numero}</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{log.campanha}</div>
                      <div className="text-muted-foreground">
                        Tentativa {log.tentativa}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Início: {log.inicioLigacao}
                      </div>
                      {log.fimLigacao && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Fim: {log.fimLigacao}
                        </div>
                      )}
                      {log.duracao && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Duração: {log.duracao}
                        </div>
                      )}
                    </div>
                    <div className="text-xs">
                      Device: {log.taskerDevice}
                    </div>
                  </div>
                  
                  {log.errorMessage && (
                    <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
                      Erro: {log.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PhoneCall className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Nenhuma ligação encontrada</h3>
              <p className="text-muted-foreground">
                {filtro || statusFiltro !== 'todos' 
                  ? 'Ajuste os filtros para ver mais resultados'
                  : 'As ligações aparecerão aqui em tempo real'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispositivos Conectados */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Dispositivos Tasker Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success animate-pulse"></div>
                <div>
                  <div className="font-medium">Samsung Galaxy A54</div>
                  <div className="text-sm text-muted-foreground">IP: 192.168.15.110:8080</div>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-success text-success-foreground">Online</Badge>
                <div className="text-xs text-muted-foreground mt-1">2 ligações ativas</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-card opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
                <div>
                  <div className="font-medium">Xiaomi Redmi Note</div>
                  <div className="text-sm text-muted-foreground">IP: 192.168.15.115:8080</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary">Offline</Badge>
                <div className="text-xs text-muted-foreground mt-1">Última atividade: 2h atrás</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}