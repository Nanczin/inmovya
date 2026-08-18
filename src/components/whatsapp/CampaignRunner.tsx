import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Play, SkipForward, ExternalLink, Clock, AlertTriangle } from "lucide-react";

export function CampaignRunner({ campaign, onFinish, onUpdateStatus }: { campaign: any, onFinish: () => void, onUpdateStatus: (id: string, status: string) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, [campaign]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

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
    } catch (error) {
      console.error('Error fetching messages for runner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const msg = messages[currentIndex];
    if (!msg) return;

    // Open WhatsApp Web
    const text = encodeURIComponent(msg.mensagem_personalizada || "");
    const phone = msg.telefone.replace(/\D/g, ''); // Keep only numbers
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');

    // Update status in DB
    try {
      await supabase
        .from('whatsapp_campaign_messages')
        .update({ status: 'Entregue', data_envio: new Date().toISOString() })
        .eq('id', msg.id);
        
      // Update local state
      const updatedMessages = [...messages];
      updatedMessages[currentIndex].status = 'Entregue';
      setMessages(updatedMessages);
      
      // Move to next
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      
      // Check if finished
      if (nextIdx >= messages.length) {
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
    }
  };

  const handleSkip = async () => {
    const msg = messages[currentIndex];
    if (!msg) return;

    try {
      await supabase
        .from('whatsapp_campaign_messages')
        .update({ status: 'Falha', erro: 'Ignorado pelo usuário' })
        .eq('id', msg.id);
        
      const updatedMessages = [...messages];
      updatedMessages[currentIndex].status = 'Falha';
      setMessages(updatedMessages);
      
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      
      if (nextIdx >= messages.length) {
        onUpdateStatus(campaign.id, 'Concluída');
        onFinish();
      }
    } catch (error) {
      console.error("Error skipping message:", error);
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
              <Play className="w-5 h-5 text-primary" />
              Disparo em Andamento: {campaign.nome}
            </CardTitle>
            <CardDescription>Modo Click-to-Chat (Envio Manual)</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(campaign.id, 'Pausada')}>
            Pausar Disparo
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
              <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Próximo Contato:</h4>
              <div className="text-lg font-medium">{currentMsg.nome || 'Sem Nome'}</div>
              <div className="text-sm">{currentMsg.telefone}</div>
              
              <div className="mt-4 text-sm bg-background p-3 rounded border">
                {currentMsg.mensagem_personalizada}
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-64 flex flex-col justify-center gap-3">
            {cooldown > 0 ? (
              <div className="text-center p-4 bg-warning/10 border border-warning/20 rounded-lg flex flex-col items-center">
                <Clock className="w-8 h-8 text-warning mb-2 animate-pulse" />
                <div className="font-medium">Aguarde a cadência...</div>
                <div className="text-2xl font-bold mt-1">{cooldown}s</div>
                <div className="text-xs text-muted-foreground mt-2">Evita bloqueios no WhatsApp</div>
              </div>
            ) : (
              <>
                <Button size="lg" className="w-full h-14 text-base" onClick={handleSend}>
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Abrir WhatsApp e Enviar
                </Button>
                <Button variant="outline" className="w-full" onClick={handleSkip}>
                  <SkipForward className="w-4 h-4 mr-2" />
                  Pular este contato
                </Button>
                <div className="text-xs text-muted-foreground text-center flex items-start gap-1 mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Clique em "Enviar" no WhatsApp Web e volte aqui para a próxima mensagem.</span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
