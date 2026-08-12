import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Send,
  History,
  FileText,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  AtSign,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { emailMarketing } from "@/lib/emailService";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  placeholders: string[];
}

interface EmailLog {
  id: string;
  provider: string;
  recipient: string;
  subject: string;
  status: 'success' | 'failed' | 'pending';
  sent_at: string;
  error_message?: string;
}

export function EmailMarketingModule() {
  const { toast } = useToast();

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [selectedMailingList, setSelectedMailingList] = useState<string>('');
  const [mailingLists, setMailingLists] = useState<Array<{ id: string, nome: string, total_contatos: number }>>([]);

  // New template form states
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadEmailTemplates();
    loadEmailHistory();
    loadMailingLists();
  }, []);

  // Load template data when template is selected
  const handleTemplateSelection = (templateId: string) => {
    setSelectedTemplate(templateId);

    if (templateId && templateId !== "none") {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setCustomSubject(template.subject);
        setCustomBody(template.body);

        toast({
          title: "Template carregado!",
          description: `Template "${template.name}" foi aplicado com sucesso.`,
        });
      }
    } else if (templateId === "none") {
      setCustomSubject('');
      setCustomBody('');
    }
  };

  // Load template data when template is selected (backup for when templates load after selection)
  useEffect(() => {
    if (selectedTemplate && selectedTemplate !== "none") {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template && !customSubject && !customBody) {
        setCustomSubject(template.subject);
        setCustomBody(template.body);
      }
    }
  }, [selectedTemplate, templates]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('email-marketing-sender-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_templates'
        },
        () => loadEmailTemplates()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs'
        },
        () => loadEmailHistory()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listas_contatos'
        },
        () => loadMailingLists()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEmailTemplates = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data: templates, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (templates) {
        const formattedTemplates = templates.map(template => ({
          id: template.id,
          name: template.name,
          subject: template.subject,
          body: template.body,
          placeholders: Array.isArray(template.placeholders)
            ? (template.placeholders as string[]).filter(p => typeof p === 'string')
            : []
        }));
        setTemplates(formattedTemplates);
      }
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  };

  const loadMailingLists = async () => {
    try {
      const { data: lists, error } = await supabase
        .from('listas_contatos')
        .select('id, nome, total_contatos')
        .eq('status', 'Ativa')
        .order('nome', { ascending: true });

      if (error) throw error;

      if (lists) {
        setMailingLists(lists);
      }
    } catch (error) {
      console.error('Error loading mailing lists:', error);
    }
  };

  const loadEmailHistory = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (logs) {
        const formattedLogs = logs.map(log => ({
          id: log.id,
          provider: log.provider,
          recipient: log.recipient,
          subject: log.subject,
          status: log.status as 'success' | 'failed' | 'pending',
          sent_at: log.sent_at,
          error_message: log.error_message
        }));
        setEmailLogs(formattedLogs);
      }
    } catch (error) {
      console.error('Error loading email history:', error);
    }
  };

  const saveEmailTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome, assunto e corpo do template.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Extract placeholders from template body
      const placeholderRegex = /{{(.*?)}}/g;
      const matches = newTemplateBody.match(placeholderRegex) || [];
      const placeholders = [...new Set(matches)]; // Remove duplicates

      const templateData = {
        name: newTemplateName,
        subject: newTemplateSubject,
        body: newTemplateBody,
        placeholders: placeholders,
        user_id: user.id
      };

      if (isEditingTemplate && editingTemplateId) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplateId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: "Template atualizado!",
          description: "Template de email atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);

        if (error) throw error;

        toast({
          title: "Template salvo!",
          description: "Template de email criado com sucesso.",
        });
      }

      // Clear form and reset editing state
      setNewTemplateName('');
      setNewTemplateSubject('');
      setNewTemplateBody('');
      setIsEditingTemplate(false);
      setEditingTemplateId(null);

      // Reload templates
      loadEmailTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Erro ao salvar template",
        description: error.message || "Não foi possível salvar o template.",
        variant: "destructive",
      });
    }
  };

  const startEditingTemplate = (template: EmailTemplate) => {
    setNewTemplateName(template.name);
    setNewTemplateSubject(template.subject);
    setNewTemplateBody(template.body);
    setIsEditingTemplate(true);
    setEditingTemplateId(template.id);
  };

  const cancelEditingTemplate = () => {
    setNewTemplateName('');
    setNewTemplateSubject('');
    setNewTemplateBody('');
    setIsEditingTemplate(false);
    setEditingTemplateId(null);
  };

  const saveEmailLog = async (logData: Omit<EmailLog, 'id'>) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { error } = await supabase
        .from('email_logs')
        .insert({
          provider: logData.provider,
          recipient: logData.recipient,
          subject: logData.subject,
          status: logData.status,
          error_message: logData.error_message,
          user_id: user.id
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving email log:', error);
    }
  };

  const deleteEmailLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('email_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: "Log excluído!",
        description: "O registro de email foi removido do histórico.",
      });

      loadEmailHistory();
    } catch (error: any) {
      console.error('Error deleting email log:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o registro.",
        variant: "destructive",
      });
    }
  };

  const sendTestEmail = async () => {
    if (!recipientEmail && !selectedMailingList) {
      toast({
        title: "Destinatário necessário",
        description: "Selecione um destinatário individual ou uma lista de contatos.",
        variant: "destructive",
      });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;
      let errors: string[] = [];

      // Send to individual recipient using Gmail API
      if (recipientEmail) {
        try {
          console.log('Tentando enviar email para:', recipientEmail);
          const result = await emailMarketing({
            to: recipientEmail,
            subject: customSubject || 'Email de Marketing - Inmovya',
            html: customBody || '<h1>Este é um email de marketing do sistema Inmovya.</h1><p>Enviado via Gmail API</p>'
          });

          console.log('Resultado do envio:', result);

          if (result.success) {
            await saveEmailLog({
              provider: 'gmail-api',
              recipient: recipientEmail,
              subject: customSubject || 'Email de Marketing - Inmovya',
              status: 'success',
              sent_at: new Date().toISOString()
            });
            successCount++;
          } else {
            errors.push(`${recipientEmail}: ${result.error || result.message}`);
            await saveEmailLog({
              provider: 'gmail-api',
              recipient: recipientEmail,
              subject: customSubject || 'Email de Marketing - Inmovya',
              status: 'failed',
              sent_at: new Date().toISOString(),
              error_message: result.error || result.message
            });
            errorCount++;
          }
        } catch (error: any) {
          console.error('Erro ao enviar email individual:', error);
          errors.push(`${recipientEmail}: ${error.message}`);
          await saveEmailLog({
            provider: 'gmail-api',
            recipient: recipientEmail,
            subject: customSubject || 'Email de Marketing - Inmovya',
            status: 'failed',
            sent_at: new Date().toISOString(),
            error_message: error.message
          });
          errorCount++;
        }
      }

      // Send to mailing list using Gmail API
      if (selectedMailingList) {
        try {
          const { data: contacts, error: contactsError } = await supabase
            .from('contatos')
            .select('email, nome')
            .eq('lista_id', selectedMailingList)
            .not('email', 'is', null);

          if (contactsError) throw contactsError;

          for (const contact of contacts || []) {
            try {
              console.log('Tentando enviar email para contato da lista:', contact.email);
              const result = await emailMarketing({
                to: contact.email,
                subject: customSubject || 'Email de Marketing - Inmovya',
                html: customBody || '<h1>Este é um email de marketing do sistema Inmovya.</h1><p>Enviado via Gmail API</p>',
                name: contact.nome
              });

              if (result.success) {
                await saveEmailLog({
                  provider: 'gmail-api',
                  recipient: contact.email,
                  subject: customSubject || 'Email de Marketing - Inmovya',
                  status: 'success',
                  sent_at: new Date().toISOString()
                });
                successCount++;
              } else {
                errors.push(`${contact.email}: ${result.error || result.message}`);
                await saveEmailLog({
                  provider: 'gmail-api',
                  recipient: contact.email,
                  subject: customSubject || 'Email de Marketing - Inmovya',
                  status: 'failed',
                  sent_at: new Date().toISOString(),
                  error_message: result.error || result.message
                });
                errorCount++;
              }
            } catch (error: any) {
              console.error('Erro ao enviar email da lista:', error);
              errors.push(`${contact.email}: ${error.message}`);
              await saveEmailLog({
                provider: 'gmail-api',
                recipient: contact.email,
                subject: customSubject || 'Email de Marketing - Inmovya',
                status: 'failed',
                sent_at: new Date().toISOString(),
                error_message: error.message
              });
              errorCount++;
            }
          }
        } catch (error: any) {
          toast({
            title: "Erro ao carregar lista",
            description: error.message || "Não foi possível carregar os contatos da lista.",
            variant: "destructive",
          });
          return;
        }
      }

      // Show summary toast with detailed error information
      if (successCount > 0 && errorCount === 0) {
        toast({
          title: "Emails enviados via Gmail API!",
          description: `${successCount} email(s) enviado(s) com sucesso.`,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Envio parcial",
          description: `${successCount} enviado(s), ${errorCount} falhou(ram). Verifique o histórico para detalhes.`,
          variant: "destructive",
        });
      } else {
        // Show specific error details
        const errorMessage = errors.length > 0
          ? `Problemas encontrados: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
          : "Verifique se as contas Gmail estão configuradas corretamente.";

        toast({
          title: "Erro no envio",
          description: errorMessage,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Erro geral no envio:', error);
      toast({
        title: "Erro no envio",
        description: error.message || "Não foi possível enviar o email.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <AtSign className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sistema Gmail</h1>
          <p className="text-muted-foreground">
            Sistema de email marketing profissional usando Gmail API
          </p>
        </div>
      </div>

      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2 text-green-800">
          <AtSign className="w-5 h-5" />
          <span className="font-medium">Integração Gmail API Ativa</span>
        </div>
        <p className="text-sm text-green-700 mt-1">
          Todos os emails são enviados através da Gmail API, garantindo entregabilidade com alternância automática entre contas.
        </p>
      </div>

      <Tabs defaultValue="send" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Enviar Email
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Enviar Email Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="template">Template (Opcional)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template ou crie customizado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Email Individual</Label>
                  <Input
                    id="recipient"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mailingList">Ou Lista de Contatos</Label>
                  <Select value={selectedMailingList} onValueChange={setSelectedMailingList}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma lista" />
                    </SelectTrigger>
                    <SelectContent>
                      {mailingLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.nome} ({list.total_contatos} contatos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Email Content */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Conteúdo HTML</Label>
                  <Textarea
                    id="body"
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="Conteúdo HTML do email..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setShowPreview(true)} variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Visualizar
                </Button>
                <Button onClick={sendTestEmail} className="gap-2 flex-1">
                  <Send className="w-4 h-4" />
                  Enviar via Gmail API
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {isEditingTemplate ? 'Editar Template' : 'Novo Template'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Nome do Template</Label>
                  <Input
                    id="templateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Ex: Email de Boas-vindas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateSubject">Assunto</Label>
                  <Input
                    id="templateSubject"
                    value={newTemplateSubject}
                    onChange={(e) => setNewTemplateSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateBody">Corpo do Template (HTML)</Label>
                  <Textarea
                    id="templateBody"
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    placeholder="Conteúdo HTML... Use {{variavel}} para criar variáveis dinâmicas"
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  {isEditingTemplate && (
                    <Button onClick={cancelEditingTemplate} variant="outline">
                      Cancelar
                    </Button>
                  )}
                  <Button onClick={saveEmailTemplate}>
                    {isEditingTemplate ? 'Atualizar' : 'Salvar'} Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Templates List */}
            {templates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Templates Salvos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">{template.subject}</p>
                          {template.placeholders.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {template.placeholders.map((placeholder, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {placeholder}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingTemplate(template)}
                          >
                            Editar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Envios - Gmail API
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emailLogs.length === 0 ? (
                <div className="text-center py-6">
                  <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum email enviado ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-muted rounded">
                      <div className="flex items-center gap-3">
                        <div>
                          {log.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {log.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                          {log.status === 'pending' && <Clock className="w-4 h-4 text-yellow-600" />}
                        </div>
                        <div>
                          <div className="font-medium">{log.recipient}</div>
                          <div className="text-sm text-muted-foreground">{log.subject}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.sent_at).toLocaleString('pt-BR')} via {log.provider}
                          </div>
                          {log.error_message && (
                            <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteEmailLog(log.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <strong>Assunto:</strong> {customSubject}
            </div>
            <div className="border rounded p-4">
              <div
                dangerouslySetInnerHTML={{ __html: customBody }}
                className="prose prose-sm max-w-none"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}