import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Edit, Plus, Trash2 } from "lucide-react";
import { replaceVariables } from "@/utils/formatUtils";

interface EditarCampanhaWhatsappDialogProps {
  children: React.ReactNode;
  campaign: any;
  onUpdated: () => void;
}

export function EditarCampanhaWhatsappDialog({ children, campaign, onUpdated }: EditarCampanhaWhatsappDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [nome, setNome] = useState("");
  const [mensagens, setMensagens] = useState<string[]>([""]);
  const [cadencia, setCadencia] = useState({
    intervaloMinimo: 10,
    intervaloMaximo: 30,
    pausaAposMensagens: 50,
    tempoDescanso: 60
  });

  const { toast } = useToast();

  useEffect(() => {
    if (open && campaign) {
      setNome(campaign.nome || "");
      
      // Attempt to load messages from variaveis JSON or fallback to main message
      if (campaign.variaveis && campaign.variaveis.mensagens && Array.isArray(campaign.variaveis.mensagens)) {
        setMensagens(campaign.variaveis.mensagens);
      } else {
        setMensagens([campaign.mensagem || ""]);
      }

      setCadencia({
        intervaloMinimo: campaign.configuracao_cadencia?.intervaloMinimo || 10,
        intervaloMaximo: campaign.configuracao_cadencia?.intervaloMaximo || 30,
        pausaAposMensagens: campaign.configuracao_cadencia?.pausaAposMensagens || 50,
        tempoDescanso: campaign.configuracao_cadencia?.tempoDescanso || 60
      });
    }
  }, [open, campaign]);

  const handleSalvar = async () => {
    const validMessages = mensagens.filter(m => m.trim() !== "");
    if (!nome.trim() || validMessages.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Preencha o nome e pelo menos uma mensagem.", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      
      const variaveis = { ...(campaign.variaveis || {}), mensagens: validMessages };

      // Update the campaign
      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update({
          nome: nome,
          mensagem: validMessages[0], // fallback
          variaveis: variaveis,
          configuracao_cadencia: cadencia,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      if (error) throw error;

      // Update all pending messages with new variations
      const { data: pendingMessages, error: pendingError } = await supabase
        .from('whatsapp_campaign_messages')
        .select('id, nome')
        .eq('campaign_id', campaign.id)
        .eq('status', 'Pendente');

      if (pendingError) throw pendingError;

      if (pendingMessages && pendingMessages.length > 0) {
        // Prepare updates for each pending message (selecting a new random variation)
        const updates = pendingMessages.map(msg => {
          const randomMsg = validMessages[Math.floor(Math.random() * validMessages.length)];
          const personalized = replaceVariables(randomMsg, msg.nome);
          
          return {
            id: msg.id,
            mensagem_personalizada: personalized,
            updated_at: new Date().toISOString()
          };
        });

        // Upsert the changes back into the table
        const { error: upsertError } = await supabase
          .from('whatsapp_campaign_messages')
          .upsert(updates, { onConflict: 'id' });

        if (upsertError) throw upsertError;
      }

      toast({ title: "Sucesso", description: "Campanha atualizada com sucesso!" });
      onUpdated();
      setOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar campanha:', error);
      toast({ title: "Erro", description: "Falha ao atualizar a campanha.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-primary" />
            Editar Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Nome da Campanha</Label>
            <Input 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Promoção Dia das Mães" 
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Variações de Mensagem (Spintax)</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setMensagens([...mensagens, ""])}
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar
              </Button>
            </div>
            
            {mensagens.map((msg, index) => (
              <div key={index} className="space-y-2 border p-4 rounded-md relative bg-muted/20">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm font-medium text-primary">Variação {index + 1}</Label>
                  {mensagens.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive h-8 px-2"
                      onClick={() => {
                        const newMsg = [...mensagens];
                        newMsg.splice(index, 1);
                        setMensagens(newMsg);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Textarea 
                  placeholder="Olá {{nome}}! Tudo bem?" 
                  rows={4}
                  value={msg}
                  onChange={(e) => {
                    const newMsg = [...mensagens];
                    newMsg[index] = e.target.value;
                    setMensagens(newMsg);
                  }}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">As mensagens pendentes serão atualizadas com as novas variações de forma aleatória.</p>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Cadência</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intervalo Min (segundos)</Label>
                <Input 
                  type="number" 
                  value={cadencia.intervaloMinimo}
                  onChange={(e) => setCadencia({...cadencia, intervaloMinimo: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo Max (segundos)</Label>
                <Input 
                  type="number" 
                  value={cadencia.intervaloMaximo}
                  onChange={(e) => setCadencia({...cadencia, intervaloMaximo: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Pausa após X mensagens</Label>
                <Input 
                  type="number" 
                  value={cadencia.pausaAposMensagens}
                  onChange={(e) => setCadencia({...cadencia, pausaAposMensagens: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Tempo Descanso (minutos)</Label>
                <Input 
                  type="number" 
                  value={cadencia.tempoDescanso}
                  onChange={(e) => setCadencia({...cadencia, tempoDescanso: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
