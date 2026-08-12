import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Server,
  AlertTriangle
} from "lucide-react";

interface SchedulerStatus {
  isRunning: boolean;
  pendingEmails: number;
  activeAccounts: number;
  remainingCapacity: number;
  currentLoad: 'low' | 'medium' | 'high';
  nextProcessIn: number;
}

interface QueueStats {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export function AntiBlockSystemManager() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const response = await supabase.functions.invoke('email-scheduler', {
        body: {},
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setStatus(response.data);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar o status do sistema",
        variant: "destructive",
      });
    }
  };

  const fetchQueueStats = async () => {
    try {
      const { data: queueData, error } = await supabase
        .from('email_queue')
        .select('status');

      if (error) throw error;

      const stats = queueData.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        acc.total++;
        return acc;
      }, { pending: 0, sent: 0, failed: 0, total: 0 });

      setQueueStats(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const handleAction = async (action: 'start' | 'stop') => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('email-scheduler', {
        body: { action },
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Sucesso",
        description: `Sistema ${action === 'start' ? 'iniciado' : 'parado'} com sucesso`,
      });

      await fetchStatus();
    } catch (error) {
      console.error(`Erro ao ${action}:`, error);
      toast({
        title: "Erro",
        description: `Não foi possível ${action === 'start' ? 'iniciar' : 'parar'} o sistema`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processNow = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('smart-email-processor', {
        body: {},
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Processamento Iniciado",
        description: `${response.data.processed || 0} emails foram processados`,
      });

      await fetchStatus();
      await fetchQueueStats();
    } catch (error) {
      console.error('Erro ao processar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a fila de emails",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccountRecovery = async (action: string) => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('gmail-account-recovery', {
        body: { action },
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Recuperação Executada",
        description: response.data.message,
      });

      await fetchStatus();
    } catch (error) {
      console.error('Erro na recuperação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível executar a recuperação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getLoadColor = (load: string) => {
    switch (load) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLoadText = (load: string) => {
    switch (load) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      default: return 'Desconhecida';
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchQueueStats();

    // Atualizar status a cada 10 segundos
    const interval = setInterval(() => {
      fetchStatus();
      fetchQueueStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Sistema Anti-Bloqueio</h2>
        <p className="text-muted-foreground">
          Controle inteligente de envio de emails com distribuição automática e prevenção de bloqueios
        </p>
      </div>

      {/* Status Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Status de Execução */}
            <div className="text-center">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${status?.isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-medium">
                {status?.isRunning ? 'Executando' : 'Parado'}
              </p>
            </div>

            {/* Carga Atual */}
            <div className="text-center">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${getLoadColor(status?.currentLoad || '')}`} />
              <p className="text-sm font-medium">
                Carga: {getLoadText(status?.currentLoad || '')}
              </p>
            </div>

            {/* Contas Ativas */}
            <div className="text-center">
              <div className="text-lg font-bold">{status?.activeAccounts || 0}</div>
              <p className="text-sm text-muted-foreground">Contas Ativas</p>
            </div>

            {/* Capacidade Restante */}
            <div className="text-center">
              <div className="text-lg font-bold">{status?.remainingCapacity || 0}</div>
              <p className="text-sm text-muted-foreground">Capacidade Diária</p>
            </div>
          </div>

          {/* Controles */}
          <div className="flex gap-2 justify-center mb-4">
            <Button
              onClick={() => handleAction(status?.isRunning ? 'stop' : 'start')}
              disabled={loading}
              variant={status?.isRunning ? 'destructive' : 'default'}
            >
              {status?.isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Parar Sistema
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Sistema
                </>
              )}
            </Button>

            <Button
              onClick={processNow}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Processar Agora
            </Button>
          </div>

          {/* Controles de Recuperação */}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              onClick={() => handleAccountRecovery('reactivate_error_accounts')}
              disabled={loading}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reativar Contas em Erro
            </Button>

            <Button
              onClick={() => handleAccountRecovery('reset_daily_counters')}
              disabled={loading}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reset Contadores
            </Button>

            <Button
              onClick={() => handleAccountRecovery('reset_all_active')}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reset Completo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas da Fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{queueStats?.pending || 0}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{queueStats?.sent || 0}</p>
                <p className="text-sm text-muted-foreground">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{queueStats?.failed || 0}</p>
                <p className="text-sm text-muted-foreground">Falharam</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{queueStats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações Detalhadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Características do Sistema</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Distribuição inteligente entre contas Gmail</li>
                <li>• Delays adaptativos baseados no uso</li>
                <li>• Recuperação automática de contas em erro</li>
                <li>• Retry exponencial para falhas temporárias</li>
                <li>• Monitoramento de limites diários</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Limites de Segurança</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Gmail: 450 emails/dia por conta</li>
                <li>• Máximo 10 emails em rajada</li>
                <li>• Cooldown de 15 min após erro</li>
                <li>• Reset automático dos contadores diários</li>
                <li>• Balanceamento de carga automático</li>
              </ul>
            </div>
          </div>

          {status?.pendingEmails > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Há {status.pendingEmails} emails na fila aguardando processamento.
                  {status.isRunning 
                    ? ` Próximo processamento em ${Math.round(status.nextProcessIn / 1000)} segundos.`
                    : ' Inicie o sistema para começar o processamento.'
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}