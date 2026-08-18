import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, ExternalLink, Clock, AlertTriangle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CampaignRunner({ campaign, onFinish, onUpdateStatus }: { campaign: any, onFinish: () => void, onUpdateStatus: (id: string, status: string) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Use a ref to keep track of state inside the effect without re-triggering it constantly if not needed
  const isRunningRef = useRef(campaign.status === 'Em andamento');

  useEffect(() => {
    isRunningRef.current = campaign.status === 'Em andamento';
  }, [campaign.status]);

  useEffect(() => {
    fetchMessages();
  }, [campaign.id]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    // Auto runner engine
    if (isRunningRef.current && !loading && messages.length > 0 && currentIndex < messages.length) {
      if (cooldown > 0) {
        timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      } else {
        // Cooldown reached 0, fire next message
        executeNextMessage();
      }
    }
    
    return () => clearTimeout(timer);
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
    const msg = messages[currentIndex];
    if (!msg) return;

    // Simulate sending via API
    try {
      // Here you would normally integrate with Evolution API, ChatPro, Z-API, etc.
      // e.g.: await fetch('https://sua-api.com/send', { method: 'POST', body: JSON.stringify({ phone: msg.telefone, message: msg.mensagem_personalizada }) });
      
      // We simulate network delay
      await new Promise(r => setTimeout(r, 1000));

      await supabase
        .from('whatsapp_campaign_messages')
        .update({ status: 'Entregue', data_envio: new Date().toISOString() })
        .eq('id', msg.id);
        
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
        const min = campaign.configuracao_cadencia?.intervaloMinimo || 10;
        const max = campaign.configuracao_cadencia?.intervaloMaximo || 30;
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
      } catch (e) {}
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
                {currentMsg.mensagem_personalizada}
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
              <span>Não feche esta aba durante o disparo para não interromper a fila.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
