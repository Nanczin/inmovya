import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Plus, Search, Calendar, BarChart, Settings, FileText, Upload, RefreshCw, Play, Pause, Square, Trash2, Eye, Edit, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImportarListaDialog } from "@/components/dialogs/ImportarListaDialog";
import { CampaignReportDialog } from "@/components/dialogs/CampaignReportDialog";
import { CampaignRunner } from "@/components/whatsapp/CampaignRunner";
import { EditarCampanhaWhatsappDialog } from "@/components/dialogs/EditarCampanhaWhatsappDialog";
import { replaceVariables, parseSpintax } from "@/utils/formatUtils";

export function WhatsappModule() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("historico");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // New Campaign State
  const [newCampaign, setNewCampaign] = useState({
    nome: "",
    listaId: "",
    mensagem: "",
    cadencia: {
      intervaloMinimo: 10,
      intervaloMaximo: 30,
      limiteDiario: 100,
      pausaAposMensagens: 50,
      tempoDescanso: 60, // em minutos
    }
  });
  
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [activeCampaignForReport, setActiveCampaignForReport] = useState<any>(null);
  
  const [listas, setListas] = useState<any[]>([]);
  const [previewMessages, setPreviewMessages] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchCampaigns();
    fetchListas();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({ title: "Erro", description: "Não foi possível carregar as campanhas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchListas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('listas_contatos')
        .select('id, nome, total_contatos, validados')
        .eq('user_id', user.id);

      if (error) throw error;
      setListas(data || []);
    } catch (error) {
      console.error('Error fetching lists:', error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.nome || !newCampaign.listaId || !newCampaign.mensagem.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome, lista e a mensagem.", variant: "destructive" });
      return;
    }

    try {
      setIsCreating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create Campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('whatsapp_campaigns')
        .insert({
          user_id: user.id,
          nome: newCampaign.nome,
          lista_id: newCampaign.listaId,
          mensagem: newCampaign.mensagem,
          variaveis: { mensagens: [newCampaign.mensagem] }, // mantendo compatibilidade
          configuracao_cadencia: newCampaign.cadencia,
          status: 'Rascunho'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Fetch contacts from lista_id
      const { data: contacts, error: contactsError } = await supabase
        .from('contatos')
        .select('*')
        .eq('lista_id', newCampaign.listaId)
        .eq('status', 'ativo');

      if (contactsError) throw contactsError;

      if (contacts && contacts.length > 0) {
        const messagesToInsert = contacts.map(c => {
          const spintaxMsg = parseSpintax(newCampaign.mensagem);
          return {
            user_id: user.id,
            campaign_id: campaign.id,
            contato_id: c.id,
            nome: c.nome,
            telefone: c.telefone,
            mensagem_personalizada: replaceVariables(spintaxMsg, c.nome),
            status: 'Pendente'
          };
        });

        const { error: msgError } = await supabase
          .from('whatsapp_campaign_messages')
          .insert(messagesToInsert);

        if (msgError) throw msgError;
      }

      toast({ title: "Sucesso", description: "Campanha criada com sucesso!" });
      setNewCampaign({
        nome: "", listaId: "", mensagem: "",
        cadencia: { intervaloMinimo: 10, intervaloMaximo: 30, limiteDiario: 100, pausaAposMensagens: 50, tempoDescanso: 60 }
      });
      setActiveTab("historico");
      fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({ title: "Erro", description: "Não foi possível criar a campanha.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Status Atualizado", description: `A campanha agora está: ${status}` });
      fetchCampaigns();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Erro", description: "Falha ao atualizar o status.", variant: "destructive" });
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Excluída", description: "Campanha excluída com sucesso." });
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: "Erro", description: "Falha ao excluir a campanha.", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Em andamento": return "bg-primary text-primary-foreground";
      case "Concluída": return "bg-success text-success-foreground";
      case "Com erro": return "bg-destructive text-destructive-foreground";
      case "Pausada": return "bg-warning text-warning-foreground";
      case "Agendada": return "bg-info text-info-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredCampaigns = campaigns.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Disparador WhatsApp
          </h2>
          <p className="text-muted-foreground">Crie e gerencie campanhas de envio de mensagens no WhatsApp</p>
        </div>
        <Button onClick={() => setActiveTab("nova-campanha")}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="historico">Histórico de Campanhas</TabsTrigger>
          <TabsTrigger value="nova-campanha">Criar Nova Campanha</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="space-y-4 mt-4">
          
          {campaigns.filter(c => c.status === 'Em andamento').map(activeCampaign => (
            <CampaignRunner 
              key={activeCampaign.id} 
              campaign={activeCampaign} 
              onUpdateStatus={updateCampaignStatus}
              onFinish={fetchCampaigns} 
            />
          ))}

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar campanhas..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchCampaigns}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4">
            {filteredCampaigns.map((campaign) => (
              <Card key={campaign.id} className="shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{campaign.nome}</CardTitle>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Criado em: {new Date(campaign.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                    {campaign.status === 'Rascunho' || campaign.status === 'Pausada' || campaign.status === 'Cancelada' ? (
                      <Button size="sm" variant="outline" onClick={() => updateCampaignStatus(campaign.id, 'Em andamento')} className="text-success hover:text-success hover:bg-success/10">
                        <Play className="w-4 h-4 mr-1" /> Iniciar
                      </Button>
                    ) : null}
                    
                    {campaign.status === 'Em andamento' ? (
                      <Button size="sm" variant="outline" onClick={() => updateCampaignStatus(campaign.id, 'Pausada')} className="text-warning hover:text-warning hover:bg-warning/10">
                        <Pause className="w-4 h-4 mr-1" /> Pausar
                      </Button>
                    ) : null}
                    
                    {campaign.status === 'Em andamento' || campaign.status === 'Agendada' ? (
                      <Button size="sm" variant="outline" onClick={() => updateCampaignStatus(campaign.id, 'Cancelada')} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Square className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    ) : null}

                    
                    <EditarCampanhaWhatsappDialog campaign={campaign} onUpdated={fetchCampaigns}>
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4 mr-1" /> Editar
                      </Button>
                    </EditarCampanhaWhatsappDialog>
                    
                    <Button size="sm" variant="outline" onClick={() => deleteCampaign(campaign.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Excluir
                    </Button>
                    
                    <Button size="sm" variant="outline" onClick={() => {
                        setActiveCampaignForReport(campaign);
                        setIsReportOpen(true);
                      }}>
                      <BarChart className="w-4 h-4 mr-1" /> Relatório
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredCampaigns.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Nenhuma campanha encontrada.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="nova-campanha" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Campanha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input 
                  placeholder="Ex: Promoção Dia dos Pais" 
                  value={newCampaign.nome}
                  onChange={(e) => setNewCampaign({...newCampaign, nome: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Lista de Contatos</Label>
                  <ImportarListaDialog onListaImportada={(novaLista) => {
                    fetchListas();
                    if (novaLista && novaLista.id) {
                      setNewCampaign(prev => ({...prev, listaId: novaLista.id}));
                    }
                  }}>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Importar Nova Lista
                    </Button>
                  </ImportarListaDialog>
                </div>
                <Select value={newCampaign.listaId} onValueChange={(val) => setNewCampaign({...newCampaign, listaId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista de contatos" />
                  </SelectTrigger>
                  <SelectContent>
                    {listas.map(lista => (
                      <SelectItem key={lista.id} value={lista.id}>
                        {lista.nome} ({lista.validados} contatos válidos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Você pode criar novas listas no módulo de Mailing.</p>
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
                      <p>O Spintax escolhe palavras diferentes aleatoriamente para cada contato, evitando que o WhatsApp bloqueie seu número por spam. Coloque as opções entre chaves <strong>{'{ }'}</strong> e separe com uma barra reta <strong>{'|'}</strong>.</p>
                      <p className="font-mono bg-blue-100 dark:bg-blue-900/50 p-2 rounded mt-2 text-xs">
                        {'{Olá|Oi|E aí|Bom dia}'} {'{{nome}}'}, tudo bem? {'{Como posso ajudar?|Como vai?}'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 border p-4 rounded-md relative bg-muted/20">
                  <Textarea 
                    placeholder="{Olá|Oi} {{nome}}! Tudo bem?" 
                    rows={6}
                    value={newCampaign.mensagem}
                    onChange={(e) => setNewCampaign({...newCampaign, mensagem: e.target.value})}
                  />
                  <div className="text-xs text-muted-foreground bg-white dark:bg-zinc-800 p-2 rounded border mt-2">
                    <strong>Exemplo de Prévia Aleatória:</strong> {newCampaign.mensagem ? replaceVariables(parseSpintax(newCampaign.mensagem), "João") : "Sua mensagem aparecerá aqui..."}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações de Cadência</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalo Mínimo (segundos)</Label>
                  <Input 
                    type="number" 
                    value={newCampaign.cadencia.intervaloMinimo}
                    onChange={(e) => setNewCampaign({
                      ...newCampaign, 
                      cadencia: {...newCampaign.cadencia, intervaloMinimo: parseInt(e.target.value) || 0}
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo Máximo (segundos)</Label>
                  <Input 
                    type="number" 
                    value={newCampaign.cadencia.intervaloMaximo}
                    onChange={(e) => setNewCampaign({
                      ...newCampaign, 
                      cadencia: {...newCampaign.cadencia, intervaloMaximo: parseInt(e.target.value) || 0}
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Limite Diário de Mensagens</Label>
                  <Input 
                    type="number" 
                    value={newCampaign.cadencia.limiteDiario}
                    onChange={(e) => setNewCampaign({
                      ...newCampaign, 
                      cadencia: {...newCampaign.cadencia, limiteDiario: parseInt(e.target.value) || 0}
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pausa automática após (mensagens)</Label>
                  <Input 
                    type="number" 
                    value={newCampaign.cadencia.pausaAposMensagens}
                    onChange={(e) => setNewCampaign({
                      ...newCampaign, 
                      cadencia: {...newCampaign.cadencia, pausaAposMensagens: parseInt(e.target.value) || 0}
                    })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tempo de descanso (minutos)</Label>
                  <Input 
                    type="number" 
                    value={newCampaign.cadencia.tempoDescanso}
                    onChange={(e) => setNewCampaign({
                      ...newCampaign, 
                      cadencia: {...newCampaign.cadencia, tempoDescanso: parseInt(e.target.value) || 0}
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActiveTab("historico")}>Cancelar</Button>
            <Button onClick={handleCreateCampaign} disabled={isCreating}>
              {isCreating ? "Criando..." : "Salvar Campanha"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {activeCampaignForReport && (
        <CampaignReportDialog 
          open={isReportOpen} 
          onOpenChange={setIsReportOpen} 
          campaign={activeCampaignForReport} 
        />
      )}
    </div>
  );
}
