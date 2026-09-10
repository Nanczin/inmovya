import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Edit, Plus, Trash2, Info, Image, Loader2, X } from "lucide-react";
import { replaceVariables, parseSpintax } from "@/utils/formatUtils";

interface EditarCampanhaWhatsappDialogProps {
  children: React.ReactNode;
  campaign: any;
  onUpdated: () => void;
}

export function EditarCampanhaWhatsappDialog({ children, campaign, onUpdated }: EditarCampanhaWhatsappDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState<string>("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [imagemNome, setImagemNome] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cadencia, setCadencia] = useState({
    intervaloMinimo: 30,
    intervaloMaximo: 60,
    limiteDiario: 100,
    pausaAposMensagens: 50,
    tempoDescanso: 60
  });

  const { toast } = useToast();

  useEffect(() => {
    if (open && campaign) {
      setNome(campaign.nome || "");
      
      // Attempt to load messages from variaveis JSON or fallback to main message
      if (campaign.variaveis && campaign.variaveis.mensagens && Array.isArray(campaign.variaveis.mensagens) && campaign.variaveis.mensagens.length > 0) {
        setMensagem(campaign.variaveis.mensagens[0]);
      } else {
        setMensagem(campaign.mensagem || "");
      }
      setImagemUrl(campaign.variaveis?.imagemUrl || "");
      setImagemNome(campaign.variaveis?.imagemNome || "");

      setCadencia({
        intervaloMinimo: Math.max(30, campaign.configuracao_cadencia?.intervaloMinimo || 30),
        intervaloMaximo: Math.max(30, campaign.configuracao_cadencia?.intervaloMaximo || 60),
        limiteDiario: campaign.configuracao_cadencia?.limiteDiario || 100,
        pausaAposMensagens: campaign.configuracao_cadencia?.pausaAposMensagens || 50,
        tempoDescanso: campaign.configuracao_cadencia?.tempoDescanso || 60
      });
    }
  }, [open, campaign]);

  const handleSalvar = async () => {
    if (!nome.trim() || !mensagem.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha o nome e a mensagem.", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      
      const variaveis = { ...(campaign.variaveis || {}), mensagens: [mensagem], imagemUrl, imagemNome };

      // Update the campaign
      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update({
          nome: nome,
          mensagem: mensagem, // fallback
          variaveis: variaveis,
          configuracao_cadencia: cadencia,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      if (error) throw error;

      // Update all pending messages with new variations
      const { data: pendingMessages, error: pendingError } = await supabase
        .from('whatsapp_campaign_messages')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'Pendente');

      if (pendingError) throw pendingError;

      if (pendingMessages && pendingMessages.length > 0) {
        // Prepare updates for each pending message (selecting a new random variation)
        const updates = pendingMessages.map(msg => {
          // Parse spintax and variables for each contact
          const spintaxMsg = parseSpintax(mensagem);
          const personalized = replaceVariables(spintaxMsg, msg.nome);
          
          return {
            ...msg,
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      toast({ title: 'Imagem inválida', description: 'Use uma imagem de até 10 MB.', variant: 'destructive' });
      return;
    }
    if (cadencia.limiteDiario < 1 || cadencia.intervaloMinimo < 30 || cadencia.intervaloMaximo < cadencia.intervaloMinimo) {
      toast({ title: 'Cadência inválida', description: 'Confira o limite diário e use intervalos a partir de 30 segundos.', variant: 'destructive' });
      return;
    }
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');
      const extension = file.name.split('.').pop() || 'jpg';
      const path = `whatsapp_campaigns/${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('empreendimentos').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('empreendimentos').getPublicUrl(path);
      setImagemUrl(publicUrl);
      setImagemNome(file.name);
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      toast({ title: 'Erro no upload', description: 'Não foi possível armazenar a imagem.', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
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
              <Label>Mensagem da Campanha</Label>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium">Como usar o Spintax?</p>
                  <p>O Spintax escolhe palavras diferentes aleatoriamente para cada contato, evitando bloqueios. Coloque as opções entre chaves <strong>{'{ }'}</strong> e separe com uma barra reta <strong>{'|'}</strong>.</p>
                  <p className="font-mono bg-blue-100 dark:bg-blue-900/50 p-2 rounded mt-2 text-xs">
                    {'{Olá|Oi|E aí}'} {'{{nome}}'}, tudo bem? {'{Como posso ajudar?|Como vai?}'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 border p-4 rounded-md relative bg-muted/20">
              <Textarea 
                placeholder="{Olá|Oi} {{nome}}! Tudo bem?" 
                rows={6}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
              <div className="text-xs text-muted-foreground bg-white dark:bg-zinc-800 p-2 rounded border mt-2">
                <strong>Exemplo de Prévia:</strong> {mensagem ? replaceVariables(parseSpintax(mensagem), "João") : "Sua mensagem aparecerá aqui..."}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">As mensagens pendentes serão atualizadas com as novas variações de forma aleatória ao salvar.</p>
            <div className="space-y-2 pt-2">
              <Label>Imagem da campanha (opcional)</Label>
              {imagemUrl ? (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <img src={imagemUrl} alt="Prévia" className="h-16 w-16 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{imagemNome}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setImagemUrl(''); setImagemNome(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Label htmlFor={`edit-whatsapp-image-${campaign.id}`} className="flex h-10 cursor-pointer items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent">
                  {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
                  {uploadingImage ? 'Enviando...' : 'Selecionar imagem'}
                </Label>
              )}
              <Input id={`edit-whatsapp-image-${campaign.id}`} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Cadência</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intervalo Min (segundos)</Label>
                <Input 
                  type="number" 
                  min={30}
                  value={cadencia.intervaloMinimo}
                  onChange={(e) => setCadencia({...cadencia, intervaloMinimo: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo Max (segundos)</Label>
                <Input 
                  type="number" 
                  min={30}
                  value={cadencia.intervaloMaximo}
                  onChange={(e) => setCadencia({...cadencia, intervaloMaximo: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Limite Diário de Mensagens</Label>
                <Input 
                  type="number" 
                  min={1}
                  value={cadencia.limiteDiario}
                  onChange={(e) => setCadencia({...cadencia, limiteDiario: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Pausa após X mensagens</Label>
                <Input 
                  type="number" 
                  min={1}
                  value={cadencia.pausaAposMensagens}
                  onChange={(e) => setCadencia({...cadencia, pausaAposMensagens: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tempo Descanso (minutos)</Label>
                <Input 
                  type="number" 
                  min={1}
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
