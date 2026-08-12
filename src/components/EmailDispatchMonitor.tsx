import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertTriangle,
  Users,
  Send
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QueueStatus {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

interface GmailAccountStatus {
  id: string;
  email: string;
  current_count: number;
  daily_limit: number;
  status: string;
  is_active: boolean;
}

interface EmailCampaign {
  id: string;
  name: string;
  status: string;
  total_emails: number;
  sent_emails: number;
  failed_emails: number;
}

export function EmailDispatchMonitor() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0
  });
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(() => {
    // Restore saved campaign selection from localStorage
    return localStorage.getItem('selectedCampaignId') || 'all';
  });
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountStatus[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Controle manual de processamento
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { toast } = useToast();

  // Save campaign selection to localStorage whenever it changes
  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    localStorage.setItem('selectedCampaignId', campaignId);
  };

  useEffect(() => {
    loadCampaigns();
    loadQueueStatus();
    loadGmailAccounts();

    // Update every 10 seconds
    const interval = setInterval(() => {
      loadQueueStatus();
      loadGmailAccounts();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Validate saved campaign selection when campaigns are loaded
  useEffect(() => {
    if (campaigns.length > 0 && selectedCampaignId !== 'all') {
      const campaignExists = campaigns.some(c => c.id === selectedCampaignId);
      if (!campaignExists) {
        // If saved campaign no longer exists, reset to 'all'
        handleCampaignChange('all');
      }
    }
  }, [campaigns]);

  useEffect(() => {
    loadQueueStatus();
  }, [selectedCampaignId]);

  const loadCampaigns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_campaigns')
        .select('id, name, status, total_emails, sent_emails, failed_emails')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadQueueStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('email_queue')
        .select('status')
        .eq('user_id', user.id);

      // Filter by campaign if selected
      if (selectedCampaignId !== 'all') {
        query = query.eq('campanha_id', selectedCampaignId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const status: QueueStatus = {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0
      };

      data?.forEach(item => {
        status[item.status as keyof QueueStatus]++;
      });

      setQueueStatus(status);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  };

  const loadGmailAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGmailAccounts([]);
        return;
      }

      const { data, error } = await supabase
        .from('gmail_accounts')
        .select('id, email, current_count, daily_limit, status, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('email');

      if (error) throw error;
      setGmailAccounts(data || []);
    } catch (error) {
      console.error('Error loading Gmail accounts:', error);
    }
  };


  const handleResetAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('gmail_accounts')
        .update({
          status: 'active',
          current_count: 0
        })
        .eq('is_active', true)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Contas resetadas",
        description: "Todas as contas Gmail foram resetadas e reativadas.",
      });

      loadGmailAccounts();
    } catch (error: any) {
      console.error('Error resetting accounts:', error);
      toast({
        title: "Erro ao resetar",
        description: error.message || "Não foi possível resetar as contas.",
        variant: "destructive",
      });
    }
  };

  const hasAvailableAccounts = () => {
    return gmailAccounts.some(account =>
      account.status === 'active' && account.current_count < account.daily_limit
    );
  };

  const hasErrorAccounts = () => {
    return gmailAccounts.some(account => account.status === 'error');
  };

  const handlePauseProcess = async () => {
    try {
      const action = isPaused ? 'resume' : 'pause';
      const response = await supabase.functions.invoke('gmail-dispatcher', {
        body: {
          action: action
        },
      });

      if (response.error) throw response.error;

      setIsPaused(!isPaused);
      toast({
        title: isPaused ? "Processamento retomado" : "Processamento pausado",
        description: isPaused ? "O processamento da fila foi retomado." : "O processamento da fila foi pausado.",
      });

      // Reload status after a delay
      setTimeout(() => {
        loadQueueStatus();
        loadGmailAccounts();
      }, 1000);
    } catch (error: any) {
      console.error('Error toggling process:', error);
      toast({
        title: "Erro na operação",
        description: error.message || "Não foi possível alterar o estado do processamento.",
        variant: "destructive",
      });
    }
  };


  const getTotalEmails = () => {
    return queueStatus.pending + queueStatus.processing + queueStatus.sent + queueStatus.failed;
  };

  const getCompletionPercentage = () => {
    const total = getTotalEmails();
    if (total === 0) return 0;
    return ((queueStatus.sent + queueStatus.failed) / total) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Campanha */}
      <Card>
        <CardHeader>
          <CardTitle>
            Selecionar Campanha para Disparar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCampaignId} onValueChange={handleCampaignChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {campaigns.map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCampaignId !== 'all' && (
            <div className="mt-3 p-3 bg-primary/10 text-primary rounded-lg text-sm">
              <strong>Atenção:</strong> Apenas os emails da campanha "{campaigns.find(c => c.id === selectedCampaignId)?.name}" serão enviados quando iniciar o disparo.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts de status */}
      {getTotalEmails() === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {selectedCampaignId === 'all'
              ? "Não há emails na fila para processamento. Crie uma nova campanha para começar a enviar emails."
              : "Não há emails na fila para esta campanha específica."
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Alert se não há contas disponíveis */}
      {getTotalEmails() > 0 && !hasAvailableAccounts() && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Todas as contas Gmail estão indisponíveis (limite atingido ou erro).
            {hasErrorAccounts() && " Use 'Resetar Contas' para reativar contas com erro."}
          </AlertDescription>
        </Alert>
      )}

      {/* Status da Fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{queueStatus.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
              <div>
                <p className="text-2xl font-bold">{queueStatus.processing}</p>
                <p className="text-xs text-muted-foreground">Processando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{queueStatus.sent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{queueStatus.failed}</p>
                <p className="text-xs text-muted-foreground">Falharam</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso Geral */}
      {getTotalEmails() > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Progresso do Envio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Concluído</span>
                <span>{queueStatus.sent + queueStatus.failed} de {getTotalEmails()}</span>
              </div>
              <Progress value={getCompletionPercentage()} className="w-full" />
              <div className="text-xs text-muted-foreground">
                {getCompletionPercentage().toFixed(1)}% concluído
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Controles de Envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={async () => {
                // Estado 1: Iniciar (Se não está processando nem pausado e tem pendentes)
                if (!isProcessing && !isPaused && queueStatus.pending > 0) {
                  // Check accounts first
                  if (!hasAvailableAccounts()) {
                    toast({ title: "Nenhuma conta disponível", description: "Verifique os limites das contas ou resete-as.", variant: "destructive" });
                    return;
                  }

                  setIsProcessing(true);
                  toast({ title: "Iniciando disparos", description: "O processamento contínuo foi iniciado." });

                  // Iniciar loop de processamento
                  const startContinuousDispatch = async () => {
                    while (true) {
                      // Verificar usuários
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) break;

                      // Verificar se ainda há emails pendentes
                      const { count } = await supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending');

                      if (!count || count === 0) {
                        setIsProcessing(false);
                        toast({ title: "Concluído", description: "Todos os emails foram processados." });
                        break;
                      }

                      // Preparar payload
                      const body: any = { action: 'process_queue' };
                      if (selectedCampaignId !== 'all') body.campaignId = selectedCampaignId;

                      // Chamar função server-side
                      const response = await supabase.functions.invoke('gmail-dispatcher', { body });

                      if (response.error) {
                        console.error("Erro no dispatcher:", response.error);
                        // Pausa maior em caso de erro
                        await new Promise(r => setTimeout(r, 10000));
                      } else if (response.data && response.data.processed === 0) {
                        // Se não processou nada (ex: limites), espera
                        await new Promise(r => setTimeout(r, 5000));
                      } else {
                        // Processou algo, espera breve
                        await new Promise(r => setTimeout(r, 2000));
                      }

                      loadQueueStatus();
                      loadGmailAccounts();
                    }
                  };

                  startContinuousDispatch().catch(err => {
                    console.error("Erro fatal no loop:", err);
                    setIsProcessing(false);
                  });
                }
                // Estado 2: Pausar (Se está processando e não pausado)
                else if (isProcessing && !isPaused) {
                  await handlePauseProcess(); // Isso invoca backend 'pause' e seta isPaused=true
                }
                // Estado 3: Retomar (Se está pausado)
                else if (isPaused) {
                  await handlePauseProcess(); // Isso invoca backend 'resume' e seta isPaused=false
                }
              }}
              disabled={queueStatus.pending === 0}
              variant={isPaused ? "default" : isProcessing ? "destructive" : "default"}
              className="flex items-center justify-center gap-2 w-full sm:w-auto min-w-[140px]"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" /> Retomar
                </>
              ) : isProcessing ? (
                <>
                  <Pause className="w-4 h-4" /> Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Iniciar
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleResetAccounts}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Resetar Contas
            </Button>

            <Button
              variant="ghost"
              onClick={loadQueueStatus}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </p>
        </CardContent>
      </Card>

      {/* Status das Contas Gmail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Status das Contas Gmail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {gmailAccounts.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma conta Gmail ativa encontrada.</p>
            ) : (
              gmailAccounts.map(account => (
                <div key={account.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted rounded-lg gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-full">
                      <p className="font-medium truncate max-w-[200px] sm:max-w-none" title={account.email}>{account.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.current_count} / {account.daily_limit} emails enviados hoje
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                    <Progress
                      value={(account.current_count / account.daily_limit) * 100}
                      className="w-full sm:w-20"
                    />
                    <Badge variant={
                      account.status === 'active' ? 'default' :
                        account.status === 'error' ? 'destructive' : 'secondary'
                    }>
                      {account.status === 'active' ? 'Ativa' :
                        account.status === 'error' ? 'Erro' : account.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}