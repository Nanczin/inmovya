import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, ExternalLink, Clock, AlertTriangle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { replaceVariables, parseSpintax } from "@/utils/formatUtils";

let campaignDispatchQueue: Promise<void> = Promise.resolve();

function enqueueCampaignDispatch(task: () => Promise<void>) {
  const queued = campaignDispatchQueue.then(task, task);
  campaignDispatchQueue = queued.catch(() => undefined);
  return queued;
}

export function CampaignRunner({ campaign, onFinish, onUpdateStatus }: { campaign: any, onFinish: () => void, onUpdateStatus: (id: string, status: string) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [extensionReady, setExtensionReady] = useState(false);
  const { toast } = useToast();
  
  // Use a ref to keep track of state inside the effect without re-triggering it constantly if not needed
  const isRunningRef = useRef(campaign.status === 'Em andamento');
  const isExecutingRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const lastRestAtRef = useRef(-1);

  const sendWithExtension = (payload: { phone: string; text: string; imageLocalId?: string }) => {
    return new Promise<void>((resolve, reject) => {
      const token = crypto.randomUUID();
      const timeout = window.setTimeout(() => {
        window.removeEventListener('INMOVYA_WHATSAPP_RESULT', handleResult as EventListener);
        reject(new Error('Tempo esgotado aguardando a confirmação da extensão.'));
      }, 90000);
      const handleResult = (event: CustomEvent) => {
        if (event.detail?.token !== token) return;
        window.clearTimeout(timeout);
        window.removeEventListener('INMOVYA_WHATSAPP_RESULT', handleResult as EventListener);
        event.detail?.ok ? resolve() : reject(new Error(event.detail?.error || 'O envio não foi confirmado.'));
      };
      window.addEventListener('INMOVYA_WHATSAPP_RESULT', handleResult as EventListener);
      window.dispatchEvent(new CustomEvent('INMOVYA_OPEN_WHATSAPP', { detail: { ...payload, token } }));
    });
  };

  useEffect(() => {
    // Check if background extension is present
    const handleReady = () => setExtensionReady(true);
    window.addEventListener('INMOVYA_EXTENSION_READY', handleReady);
    window.dispatchEvent(new CustomEvent('INMOVYA_CHECK_EXTENSION'));
    return () => window.removeEventListener('INMOVYA_EXTENSION_READY', handleReady);
  }, []);

  useEffect(() => {
    isRunningRef.current = campaign.status === 'Em andamento';
  }, [campaign.status]);

  useEffect(() => {
    fetchMessages();
  }, [campaign.id]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Web Worker para manter o timer rodando sem atrasos quando a aba está em segundo plano
    const workerCode = `
      let interval;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!interval) interval = setInterval(() => self.postMessage('tick'), 1000);
        } else if (e.data === 'stop') {
          clearInterval(interval);
          interval = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);

    return () => {
      workerRef.current?.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    const worker = workerRef.current;
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'tick') {
        setCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }
    };
    
    worker.addEventListener('message', handleMessage);
    
    // Auto runner engine
    if (isRunningRef.current && !loading && messages.length > 0 && currentIndex < messages.length) {
      if (cooldown > 0) {
        worker.postMessage('start');
      } else if (!isExecutingRef.current) {
        worker.postMessage('stop');
        enqueueCampaignDispatch(executeNextMessage);
      }
    } else {
      worker.postMessage('stop');
    }
    
    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.postMessage('stop');
    };
  }, [cooldown, loading, currentIndex, messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_campaign_messages')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Find first pending message
      const firstPending = (data || []).findIndex(m => m.status === 'Pendente');
      setCurrentIndex(firstPending >= 0 ? firstPending : (data || []).length);
      
      // If we are resuming, give it a quick 3s cooldown to not startle the user
      if (firstPending >= 0 && firstPending < (data || []).length && campaign.status === 'Em andamento') {
        setCooldown(3);
      }
    } catch (error) {
      console.error('Error fetching messages for runner:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeNextMessage = async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    const msg = messages[currentIndex];
    if (!msg) {
      isExecutingRef.current = false;
      return;
    }

    if (!extensionReady) {
      toast({
        title: 'Extensão necessária',
        description: 'Atualize e ative a extensão Inmovya Scale para iniciar o disparo confirmado.',
        variant: 'destructive'
      });
      onUpdateStatus(campaign.id, 'Pausada');
      isExecutingRef.current = false;
      return;
    }

    // O limite é global para o usuário, somando todas as campanhas.
    const limiteDiario = campaign.configuracao_cadencia?.limiteDiario;
    if (limiteDiario && limiteDiario > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        isExecutingRef.current = false;
        return;
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { count: sentToday = 0, error: countError } = await supabase
        .from('whatsapp_campaign_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'Entregue')
        .gte('data_envio', startOfToday.toISOString());
      if (countError) {
        toast({ title: 'Não foi possível validar o limite diário', description: 'A campanha foi pausada por segurança.', variant: 'destructive' });
        onUpdateStatus(campaign.id, 'Pausada');
        isExecutingRef.current = false;
        return;
      }

      if ((sentToday || 0) >= limiteDiario) {
        toast({ 
          title: "Limite Diário Atingido", 
          description: `A campanha atingiu o limite de ${limiteDiario} mensagens hoje e foi pausada automaticamente.`, 
          variant: "destructive" 
        });
        onUpdateStatus(campaign.id, 'Pausada');
        isExecutingRef.current = false;
        return;
      }

      const pausaApos = Number(campaign.configuracao_cadencia?.pausaAposMensagens) || 0;
      if (pausaApos > 0 && (sentToday || 0) > 0 && (sentToday || 0) % pausaApos === 0 && lastRestAtRef.current !== sentToday) {
        lastRestAtRef.current = sentToday || 0;
        const descanso = Math.max(1, Number(campaign.configuracao_cadencia?.tempoDescanso) || 1);
        setCooldown(descanso * 60);
        isExecutingRef.current = false;
        return;
      }
    }

    // Simulate sending via API
    try {
      // Gera o texto final da mensagem
      const fallbackMsg = replaceVariables(parseSpintax(campaign.mensagem || ""), msg.nome);
      const finalMsg = msg.mensagem_personalizada || fallbackMsg;
      let phone = msg.telefone.replace(/\D/g, '');
      
      // Adiciona DDI do Brasil caso o número venha apenas com DDD e telefone
      if (phone.length === 10 || phone.length === 11) {
        phone = '55' + phone;
      }
      
      await sendWithExtension({
        phone,
        text: finalMsg,
        imageLocalId: campaign.variaveis?.imagemLocalId || ''
      });

      await supabase
        .from('whatsapp_campaign_messages')
        .update({ status: 'Entregue', data_envio: new Date().toISOString() })
        .eq('id', msg.id);
      consecutiveFailuresRef.current = 0;
        
      // Update local state
      const updatedMessages = [...messages];
      updatedMessages[currentIndex].status = 'Entregue';
      setMessages(updatedMessages);
      
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      
      if (nextIdx >= messages.length) {
        toast({ title: "Disparo Concluído", description: "Todas as mensagens da campanha foram processadas." });
        onUpdateStatus(campaign.id, 'Concluída');
        onFinish();
      } else {
        // Apply cadence cooldown
        let min = campaign.configuracao_cadencia?.intervaloMinimo || 120;
        let max = campaign.configuracao_cadencia?.intervaloMaximo || 180;
        
        // Intervalo mínimo conservador para reduzir rajadas de envio.
        if (min < 120) min = 120; // regra: no mínimo 2 minutos entre mensagens
        if (max < min) max = min;
        
        const randomSeconds = Math.floor(Math.random() * (max - min + 1) + min);
        setCooldown(randomSeconds);
      }
    } catch (error) {
      console.error("Error updating message status:", error);
      // Even if failed, try to mark as failed and continue
      try {
        await supabase
          .from('whatsapp_campaign_messages')
          .update({ status: 'Falha', erro: 'Erro na API de disparo' })
          .eq('id', msg.id);
          
        const updatedMessages = [...messages];
        updatedMessages[currentIndex].status = 'Falha';
        setMessages(updatedMessages);
        setCurrentIndex(currentIndex + 1);
        setCooldown(5); // shorter cooldown on fail
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 3) {
          toast({ title: 'Campanha pausada', description: 'Três envios consecutivos falharam. Verifique o WhatsApp antes de continuar.', variant: 'destructive' });
          onUpdateStatus(campaign.id, 'Pausada');
        }
      } catch (e) {}
    } finally {
      isExecutingRef.current = false;
    }
  };

  if (loading) return <div className="p-4 border rounded-md mb-4 bg-muted animate-pulse">Carregando contatos da campanha...</div>;

  const total = messages.length;
  const sent = messages.filter(m => m.status !== 'Pendente').length;
  const currentMsg = messages[currentIndex];
  
  if (currentIndex >= total || !currentMsg) {
    return null; // or show finished state
  }

  return (
    <Card className="mb-6 border-primary/50 shadow-md">
      <CardHeader className="bg-primary/5 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Disparo Automático em Andamento: {campaign.nome}
            </CardTitle>
            <CardDescription>O sistema está processando a fila de envios automaticamente de acordo com a cadência definida.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => onUpdateStatus(campaign.id, 'Pausada')} className="text-warning">
            <Pause className="w-4 h-4 mr-2" /> Pausar Disparo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Progresso da Campanha</span>
                <span className="font-medium">{sent} / {total} enviados</span>
              </div>
              <Progress value={total > 0 ? (sent / total) * 100 : 0} className="h-2" />
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Processando Contato Atual:</h4>
              <div className="text-lg font-medium">{currentMsg.nome || 'Sem Nome'}</div>
              <div className="text-sm">{currentMsg.telefone}</div>
              
              <div className="mt-4 text-sm bg-background p-3 rounded border text-muted-foreground">
                {replaceVariables(currentMsg.mensagem_personalizada || "", currentMsg.nome)}
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-64 flex flex-col justify-center gap-3">
            <div className="text-center p-4 bg-primary/10 border border-primary/20 rounded-lg flex flex-col items-center">
              <Clock className="w-8 h-8 text-primary mb-2 animate-spin-slow" style={{ animationDuration: '3s' }} />
              <div className="font-medium">Cadência Ativa</div>
              <div className="text-3xl font-bold mt-1 text-primary">{cooldown}s</div>
              <div className="text-xs text-muted-foreground mt-2">Próximo disparo em instantes...</div>
            </div>
            
            <div className="text-xs text-muted-foreground text-center flex items-start gap-1 mt-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="text-left">
                <strong>Importante:</strong> Permita pop-ups no seu navegador. As abas do WhatsApp Web abrirão sozinhas, mas o disparo final da mensagem dentro do WhatsApp exige que você tenha uma Extensão do Chrome instalada (ou confirme manualmente apertando ENTER), pois sites normais não conseguem clicar no botão "Enviar" de outro site por questões de segurança.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
