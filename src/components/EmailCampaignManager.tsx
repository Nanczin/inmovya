import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Play,
  Pause,
  Square,
  RotateCcw,
  Mail,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Eye
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailCampaign {
  id: string;
  name: string;
  description?: string;
  template_subject: string;
  template_body: string;
  total_emails: number;
  sent_emails: number;
  failed_emails: number;
  status: string;
  delay_min: number;
  delay_max: number;
  batch_size: number;
  batch_pause: number;
  created_at: string;
  updated_at: string;
  image_attachments?: any; // Allow flexible type for database compatibility
}

interface ContactList {
  id: string;
  nome: string;
  total_contatos: number;
}

export function EmailCampaignManager() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedGmailAccountId, setSelectedGmailAccountId] = useState<string>('');
  const [emailInputType, setEmailInputType] = useState<'lista' | 'individual'>('lista');
  const [individualEmails, setIndividualEmails] = useState<string>('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [viewEmailsDialogOpen, setViewEmailsDialogOpen] = useState(false);
  const [campaignEmails, setCampaignEmails] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedCampaignForEmails, setSelectedCampaignForEmails] = useState<EmailCampaign | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template_subject: '',
    template_body: '',
    delay_min: 2,
    delay_max: 8,
    batch_size: 100,
    batch_pause: 90,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      template_subject: '',
      template_body: '',
      delay_min: 2,
      delay_max: 8,
      batch_size: 100,
      batch_pause: 90,
    });
    setEditingCampaign(null);
    setSelectedListId('');
    setSelectedGmailAccountId('');
    setEmailInputType('lista');
    setIndividualEmails('');
    setSelectedImages([]);
  };

  useEffect(() => {
    loadCampaigns();
    loadContactLists();
    loadGmailAccounts();

    // Setup real-time updates for campaigns
    const campaignChannel = supabase
      .channel('email-campaigns-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_campaigns',
        },
        (payload) => {
          console.log('Campaign updated:', payload);
          setCampaigns(prev => prev.map(campaign =>
            campaign.id === payload.new.id
              ? { ...campaign, ...payload.new }
              : campaign
          ));
        }
      )
      .subscribe();

    // Setup real-time updates for email queue
    const queueChannel = supabase
      .channel('email-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_queue',
        },
        (payload) => {
          console.log('Email queue updated:', payload);
          // Force update campaign stats when email queue changes
          if (payload.new && 'campanha_id' in payload.new && payload.new.campanha_id) {
            updateCampaignStats(payload.new.campanha_id as string);
          }
          // Update email list if dialog is open and it's the same campaign
          if (viewEmailsDialogOpen && selectedCampaignForEmails &&
            payload.new && 'campanha_id' in payload.new &&
            payload.new.campanha_id === selectedCampaignForEmails.id) {
            loadCampaignEmails(selectedCampaignForEmails, false);
          }
        }
      )
      .subscribe();

    return () => {
      campaignChannel.unsubscribe();
      queueChannel.unsubscribe();
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: "Não foi possível carregar as campanhas de email.",
        variant: "destructive",
      });
    }
  };

  const loadContactLists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('listas_contatos')
        .select('id, nome, total_contatos')
        .eq('status', 'Ativa')
        .eq('user_id', user.id);

      if (error) throw error;

      setContactLists(data || []);
    } catch (error) {
      console.error('Error loading contact lists:', error);
    }
  };

  const loadGmailAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('gmail_accounts')
        .select('id, email, display_name, is_active, daily_limit, current_count, status')
        .eq('is_active', true)
        .eq('user_id', user.id)
        .order('email');

      if (error) throw error;

      setGmailAccounts(data || []);
    } catch (error) {
      console.error('Error loading Gmail accounts:', error);
    }
  };

  const loadCampaignEmails = async (campaign: EmailCampaign, refreshStats = true) => {
    setLoadingEmails(true);
    setSelectedCampaignForEmails(campaign);
    setViewEmailsDialogOpen(true);

    try {
      // Refresh campaign stats first
      if (refreshStats) {
        await updateCampaignStats(campaign.id);
      }

      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .eq('campanha_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaignEmails(data || []);
    } catch (error) {
      console.error('Error loading campaign emails:', error);
      toast({
        title: "Erro ao carregar emails",
        description: "Não foi possível carregar os emails da campanha.",
        variant: "destructive",
      });
    } finally {
      setLoadingEmails(false);
    }
  };

  const updateCampaignStats = async (campaignId: string) => {
    try {
      // Get updated stats from email_queue
      const { data: queueStats, error: queueError } = await supabase
        .from('email_queue')
        .select('status')
        .eq('campanha_id', campaignId);

      if (queueError) throw queueError;

      // Calculate stats
      const sent = queueStats?.filter(item => item.status === 'sent').length || 0;
      const failed = queueStats?.filter(item => item.status === 'failed').length || 0;
      const total = queueStats?.length || 0;

      // Update campaign with new stats
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          sent_emails: sent,
          failed_emails: failed,
          total_emails: total,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      // Update local state
      setCampaigns(prev => prev.map(campaign =>
        campaign.id === campaignId
          ? { ...campaign, sent_emails: sent, failed_emails: failed, total_emails: total }
          : campaign
      ));

    } catch (error) {
      console.error('Error updating campaign stats:', error);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length !== files.length) {
        toast({
          title: "Arquivos inválidos",
          description: "Apenas imagens são permitidas.",
          variant: "destructive",
        });
      }
      setSelectedImages(prev => [...prev, ...imageFiles]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadPromises = selectedImages.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `campaign-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('empreendimentos')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('empreendimentos')
        .getPublicUrl(filePath);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.template_subject.trim() || !formData.template_body.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome, assunto e corpo do email.",
        variant: "destructive",
      });
      return;
    }

    if (!editingCampaign && emailInputType === 'lista' && !selectedListId) {
      toast({
        title: "Lista de contatos",
        description: "Por favor, selecione uma lista de contatos.",
        variant: "destructive",
      });
      return;
    }

    if (!editingCampaign && emailInputType === 'individual' && !individualEmails.trim()) {
      toast({
        title: "Emails individuais",
        description: "Por favor, insira pelo menos um email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let imageUrls: string[] = [];
      let contacts: any[] = [];

      // Upload images if any
      if (selectedImages.length > 0) {
        imageUrls = await uploadImages();
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const campaignData = {
        ...formData,
        user_id: user.id,
        image_attachments: imageUrls,
      };

      let result;
      if (editingCampaign) {
        result = await supabase
          .from('email_campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id)
          .select()
          .single();

        if (!result.error) {
          // Update pending email queue items with new template data
          const updateData: any = {
            subject: formData.template_subject,
            body: formData.template_body,
            updated_at: new Date().toISOString()
          };

          // Add images to pending emails if any were uploaded
          if (imageUrls.length > 0) {
            updateData.image_attachments = JSON.stringify(imageUrls);
            console.log('Atualizando emails pendentes com novas imagens:', imageUrls);
          }

          // Add Gmail account if one was selected
          if (selectedGmailAccountId) {
            updateData.gmail_account_id = selectedGmailAccountId;
          }

          await supabase
            .from('email_queue')
            .update(updateData)
            .eq('campanha_id', editingCampaign.id)
            .eq('status', 'pending');
        }
      } else {
        // Create campaign
        result = await supabase
          .from('email_campaigns')
          .insert(campaignData)
          .select()
          .single();

        if (result.error) throw result.error;

        // Add contacts to email queue
        if (emailInputType === 'lista') {
          // Add contacts from list
          const { data: listContacts, error: contactError } = await supabase
            .from('contatos')
            .select('*')
            .eq('lista_id', selectedListId)
            .eq('status', 'ativo');

          if (contactError) throw contactError;
          contacts = listContacts || [];
        } else {
          // Process individual emails
          const emailList = individualEmails
            .split('\n')
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));

          contacts = emailList.map(email => ({
            email: email,
            nome: email.split('@')[0], // Use part before @ as name
            telefone: '',
            dados_extras: {}
          }));
        }

        if (contacts && contacts.length > 0) {
          const queueItems = contacts.map(contact => ({
            user_id: user.id,
            campanha_id: result.data.id,
            recipient_email: contact.email,
            recipient_name: contact.nome,
            subject: formData.template_subject,
            body: formData.template_body,
            image_attachments: imageUrls,
            gmail_account_id: selectedGmailAccountId || null,
            template_data: {
              nome: contact.nome,
              email: contact.email,
              telefone: contact.telefone,
              ...(typeof contact.dados_extras === 'object' && contact.dados_extras ? contact.dados_extras : {})
            }
          }));

          const { error: queueError } = await supabase
            .from('email_queue')
            .insert(queueItems);

          if (queueError) throw queueError;

          // Update campaign with total emails
          await supabase
            .from('email_campaigns')
            .update({ total_emails: contacts.length })
            .eq('id', result.data.id);
        }
      }

      toast({
        title: "Campanha salva!",
        description: `Campanha ${formData.name} ${editingCampaign ? 'atualizada' : 'criada'} com sucesso.`,
      });



      await loadCampaigns();
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar a campanha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (campaign: EmailCampaign) => {
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      template_subject: campaign.template_subject,
      template_body: campaign.template_body,
      delay_min: campaign.delay_min,
      delay_max: campaign.delay_max,
      batch_size: campaign.batch_size,
      batch_pause: campaign.batch_pause,
    });

    // Reset selected images for editing mode
    setSelectedImages([]);

    // Load current Gmail account for this campaign
    try {
      const { data: queueData } = await supabase
        .from('email_queue')
        .select('gmail_account_id')
        .eq('campanha_id', campaign.id)
        .not('gmail_account_id', 'is', null)
        .limit(1);

      if (queueData && queueData.length > 0 && queueData[0].gmail_account_id) {
        setSelectedGmailAccountId(queueData[0].gmail_account_id);
      } else {
        setSelectedGmailAccountId('');
      }
    } catch (error) {
      console.error('Error loading campaign Gmail account:', error);
      setSelectedGmailAccountId('');
    }

    setEditingCampaign(campaign);
    setIsOpen(true);
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a campanha "${campaignName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      // Delete associated email queue items first
      await supabase
        .from('email_queue')
        .delete()
        .eq('campanha_id', campaignId);

      // Then delete the campaign
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      toast({
        title: "Campanha excluída",
        description: `Campanha "${campaignName}" foi excluída com sucesso.`,
      });

      await loadCampaigns();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir a campanha.",
        variant: "destructive",
      });
    }
  };

  const handleCampaignAction = async (campaignId: string, action: string) => {
    try {
      // Update campaign status immediately for better UX
      if (action === 'start') {
        setCampaigns(prev => prev.map(campaign =>
          campaign.id === campaignId
            ? { ...campaign, status: 'active' }
            : campaign
        ));
      }

      const response = await supabase.functions.invoke('gmail-dispatcher', {
        body: {
          action,
          campaignId,
        },
      });

      if (response.error) throw response.error;

      const actionMessages = {
        start: 'Campanha iniciada! Envio contínuo em andamento...',
        pause: 'Campanha pausada com sucesso!',
        resume: 'Campanha retomada com sucesso!',
        cancel: 'Campanha cancelada com sucesso!',
      };

      toast({
        title: "Ação executada",
        description: actionMessages[action as keyof typeof actionMessages],
      });

      await loadCampaigns();
    } catch (error: any) {
      console.error(`Error ${action} campaign:`, error);
      toast({
        title: "Erro na operação",
        description: error.message || "Não foi possível executar a operação.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (campaign: EmailCampaign) => {
    switch (campaign.status) {
      case 'draft':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'active':
        return (
          <Badge variant="default" className="bg-green-500 animate-pulse">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Enviando
            </div>
          </Badge>
        );
      case 'paused':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pausada</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-blue-500">Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{campaign.status}</Badge>;
    }
  };

  const getProgressPercentage = (campaign: EmailCampaign) => {
    if (campaign.total_emails === 0) return 0;
    return (campaign.sent_emails / campaign.total_emails) * 100;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Total Campanhas</p>
                <p className="text-2xl font-bold">{campaigns.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Play className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Campanhas Ativas</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {campaigns.filter(c => c.status === 'active').length}
                  </p>
                  {campaigns.filter(c => c.status === 'active').length > 0 && (
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Emails Enviados</p>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.sent_emails, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Emails Falhados</p>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.failed_emails, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Campaign List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Campanhas de Email</h3>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw]">
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {editingCampaign ? 'Editar' : 'Nova'} Campanha de Email
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Campanha *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome da campanha"
                    />
                  </div>

                  {!editingCampaign && (
                    <div className="col-span-2 space-y-4">
                      <div>
                        <Label>Tipo de Destinatários *</Label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="emailInputType"
                              value="lista"
                              checked={emailInputType === 'lista'}
                              onChange={(e) => setEmailInputType(e.target.value as 'lista' | 'individual')}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Lista de Contatos</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="emailInputType"
                              value="individual"
                              checked={emailInputType === 'individual'}
                              onChange={(e) => setEmailInputType(e.target.value as 'lista' | 'individual')}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Emails Individuais</span>
                          </label>
                        </div>
                      </div>

                      {emailInputType === 'lista' ? (
                        <div className="space-y-2">
                          <Label>Selecionar Lista de Contatos *</Label>
                          <select
                            value={selectedListId}
                            onChange={(e) => setSelectedListId(e.target.value)}
                            className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                          >
                            <option value="">Selecione uma lista</option>
                            {contactLists.map(list => (
                              <option key={list.id} value={list.id}>
                                {list.nome} ({list.total_contatos} contatos)
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Emails Individuais *</Label>
                          <Textarea
                            value={individualEmails}
                            onChange={(e) => setIndividualEmails(e.target.value)}
                            placeholder="Digite um email por linha:&#10;email1@exemplo.com&#10;email2@exemplo.com&#10;email3@exemplo.com"
                            rows={6}
                            className="resize-y"
                          />
                          <p className="text-xs text-muted-foreground">
                            Digite um email por linha. Emails inválidos serão ignorados automaticamente.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Conta Gmail para Envio</Label>
                    <select
                      value={selectedGmailAccountId}
                      onChange={(e) => setSelectedGmailAccountId(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="">Automático (próxima conta disponível)</option>
                      {gmailAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.email} ({account.display_name || 'Sem nome'}) - {account.current_count}/{account.daily_limit} enviados
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {editingCampaign ?
                        'Alterar a conta e/ou assunto afetará apenas emails pendentes desta campanha. Emails já enviados não são alterados.' :
                        'Se não selecionar uma conta específica, o sistema usará a próxima conta disponível e alternará automaticamente quando atingir o limite.'
                      }
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição da campanha"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Anexar Imagens {editingCampaign && "(novas imagens afetarão apenas emails pendentes)"}</Label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {selectedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {selectedImages.map((file, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-20 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={() => removeImage(index)}
                            >
                              ×
                            </Button>
                            <p className="text-xs text-muted-foreground truncate mt-1">{file.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {editingCampaign && editingCampaign.image_attachments && Array.isArray(editingCampaign.image_attachments) && editingCampaign.image_attachments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Imagens atuais da campanha:</p>
                        <div className="grid grid-cols-3 gap-2">
                          {editingCampaign.image_attachments.map((url: string, index: number) => (
                            <div key={index} className="relative">
                              <img
                                src={url}
                                alt={`Imagem atual ${index + 1}`}
                                className="w-full h-20 object-cover rounded border"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b">
                                Atual
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Adicione novas imagens acima para substituir ou complementar as existentes
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Imagens serão anexadas aos emails da campanha
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assunto do Email *</Label>
                  <Input
                    value={formData.template_subject}
                    onChange={(e) => setFormData({ ...formData, template_subject: e.target.value })}
                    placeholder="Assunto do email (use {{nome}} para personalizar)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Corpo do Email *</Label>
                  <div className="space-y-2">
                    <Textarea
                      value={formData.template_body}
                      onChange={(e) => setFormData({ ...formData, template_body: e.target.value })}
                      placeholder="Conteúdo do email (use {{nome}}, {{email}}, etc. para personalizar). Tags HTML também são suportadas!"
                      rows={8}
                    />
                    {formData.template_body && /<[^>]+>/.test(formData.template_body) && (
                      <div className="p-3 border rounded-lg bg-muted/50">
                        <Label className="text-sm font-medium mb-2 block">Preview do HTML:</Label>
                        <div
                          className="text-sm bg-white p-3 rounded border max-h-32 overflow-y-auto"
                          dangerouslySetInnerHTML={{
                            __html: formData.template_body.replace(/\{\{(\w+)\}\}/g, '<span class="bg-yellow-200 px-1 rounded">{{$1}}</span>')
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Configurações de Envio */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-primary" />
                    <Label className="font-semibold">Configurações Anti-Bloqueio</Label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Emails por Lote</Label>
                      <Input
                        type="number"
                        min="1"
                        max="500"
                        value={formData.batch_size}
                        onChange={(e) => setFormData({ ...formData, batch_size: parseInt(e.target.value) || 100 })}
                        placeholder="100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Pausa entre Lotes (segundos)</Label>
                      <Input
                        type="number"
                        min="30"
                        max="600"
                        value={formData.batch_pause}
                        onChange={(e) => setFormData({ ...formData, batch_pause: parseInt(e.target.value) || 90 })}
                        placeholder="90"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Delay Mínimo (segundos)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.delay_min}
                        onChange={(e) => setFormData({ ...formData, delay_min: parseInt(e.target.value) || 2 })}
                        placeholder="2"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Delay Máximo (segundos)</Label>
                      <Input
                        type="number"
                        min="2"
                        max="60"
                        value={formData.delay_max}
                        onChange={(e) => setFormData({ ...formData, delay_max: parseInt(e.target.value) || 8 })}
                        placeholder="8"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma campanha criada ainda.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Crie sua primeira campanha de email para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base truncate">{campaign.name}</h4>
                          {getStatusBadge(campaign)}
                        </div>
                      </div>

                      {campaign.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {campaign.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{campaign.total_emails}</span>
                          <span className="hidden sm:inline">total</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{campaign.sent_emails}</span>
                          <span className="hidden sm:inline">enviados</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{campaign.failed_emails}</span>
                          <span className="hidden sm:inline">falharam</span>
                        </div>
                        <div className="flex items-center gap-1 text-blue-600">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{campaign.total_emails - campaign.sent_emails - campaign.failed_emails}</span>
                          <span className="hidden sm:inline">pendentes</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons section */}
                    <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:shrink-0">
                      <div className="flex flex-wrap gap-2">


                        {campaign.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCampaignAction(campaign.id, 'pause')}
                            className="gap-1 flex-1 sm:flex-none"
                          >
                            <Pause className="w-3 h-3" />
                            Pausar
                          </Button>
                        )}

                        {campaign.status === 'paused' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCampaignAction(campaign.id, 'resume')}
                              className="gap-1 flex-1 sm:flex-none"
                            >
                              <Play className="w-3 h-3" />
                              Retomar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCampaignAction(campaign.id, 'cancel')}
                              className="gap-1 flex-1 sm:flex-none"
                            >
                              <Square className="w-3 h-3" />
                              Cancelar
                            </Button>
                          </>
                        )}

                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadCampaignEmails(campaign)}
                          className="flex-1 sm:flex-none"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver Emails
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(campaign)}
                          className="flex-1 sm:flex-none"
                        >
                          Editar
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                          className="flex-1 sm:flex-none"
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Progresso da Campanha</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {campaign.sent_emails}/{campaign.total_emails}
                      </span>
                      <span className="font-bold">
                        {Math.round(getProgressPercentage(campaign))}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={getProgressPercentage(campaign)}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog para visualizar emails da campanha */}
      <Dialog open={viewEmailsDialogOpen} onOpenChange={setViewEmailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg sm:text-xl">
                Emails da Campanha: {selectedCampaignForEmails?.name}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedCampaignForEmails && loadCampaignEmails(selectedCampaignForEmails)}
                disabled={loadingEmails}
                className="gap-1"
              >
                <RotateCcw className={`w-3 h-3 ${loadingEmails ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {loadingEmails ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Carregando emails...</div>
              </div>
            ) : campaignEmails.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Nenhum email encontrado nesta campanha.</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm font-medium p-3 bg-muted rounded-lg">
                  <div>Email</div>
                  <div>Nome</div>
                  <div>Status</div>
                  <div>Data/Hora</div>
                </div>
                {campaignEmails.map((email) => (
                  <div key={email.id} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm p-3 border rounded-lg">
                    <div className="truncate">{email.recipient_email}</div>
                    <div className="truncate">{email.recipient_name || '-'}</div>
                    <div>
                      <Badge
                        variant={
                          email.status === 'sent' ? 'default' :
                            email.status === 'failed' ? 'destructive' :
                              'secondary'
                        }
                        className={
                          email.status === 'sent' ? 'bg-green-500' :
                            email.status === 'processing' ? 'bg-yellow-500' :
                              ''
                        }
                      >
                        {email.status === 'sent' ? 'Enviado' :
                          email.status === 'failed' ? 'Falhou' :
                            email.status === 'processing' ? 'Processando' :
                              'Pendente'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {email.sent_at ? new Date(email.sent_at).toLocaleString('pt-BR') :
                        email.scheduled_for ? `Agendado: ${new Date(email.scheduled_for).toLocaleString('pt-BR')}` :
                          'Não agendado'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}