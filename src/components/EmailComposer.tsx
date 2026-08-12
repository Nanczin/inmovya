import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailTemplates } from "./EmailTemplates";
import { useToast } from "@/hooks/use-toast";
import { emailMarketing } from "@/lib/emailService";
import { supabase } from "@/integrations/supabase/client";
import { 
  Send,
  Mail,
  Paperclip,
  Save,
  Eye,
  Settings
} from "lucide-react";

interface Lead {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  interesse: string;
}

interface EmailComposerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmailComposer({ lead, isOpen, onClose }: EmailComposerProps) {
  const [emailData, setEmailData] = useState({
    to: lead?.email || "",
    subject: "",
    body: "",
    template: "",
    selectedAccount: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
  const { toast } = useToast();

  const emailTemplates = {
    "primeiro-contato": {
      subject: "Bem-vindo(a) à Inmovya - Informações sobre {interesse}",
      body: `Olá {nome},

Muito obrigado pelo seu interesse em nossos empreendimentos!

Estou entrando em contato para apresentar mais detalhes sobre o {interesse} e entender melhor suas necessidades.

Nossos diferenciais:
• Localização privilegiada
• Acabamentos de primeira qualidade  
• Áreas de lazer completas
• Facilidades de financiamento

Gostaria de agendar uma conversa para apresentar o projeto em detalhes? Posso ligar para você ou, se preferir, podemos nos encontrar no local.

Fico à disposição para esclarecer qualquer dúvida!

Atenciosamente,
Equipe Inmovya
📞 {telefone}
📧 contato@inmovya.com.br`
    },
    "follow-up": {
      subject: "Continuando nossa conversa sobre {interesse}",
      body: `Olá {nome},

Espero que esteja bem!

Estou retomando nosso contato sobre o {interesse}. Conforme conversamos, preparei algumas informações adicionais que podem ser do seu interesse.

Principais pontos destacados:
• Condições especiais de pagamento disponíveis
• Documentação regularizada e entrega garantida
• Possibilidade de personalização do imóvel

Quando seria um bom momento para conversarmos? Tenho alguns horários disponíveis esta semana.

Aguardo seu retorno!

Atenciosamente,
Equipe Inmovya`
    },
    "materiais": {
      subject: "Materiais do {interesse} - Inmovya",
      body: `Olá {nome},

Conforme solicitado, estou enviando os materiais do {interesse}:

📋 Incluso neste email:
• Planta baixa e layout dos apartamentos
• Tabela de preços atualizada
• Condições de pagamento
• Memorial descritivo
• Cronograma de obras

Caso tenha alguma dúvida sobre os materiais ou queira mais informações específicas, não hesite em entrar em contato.

Estou à disposição para agendar uma visita ao empreendimento!

Atenciosamente,
Equipe Inmovya`
    },
    "agendamento": {
      subject: "Vamos conhecer o {interesse}? - Agendamento de visita",
      body: `Olá {nome},

Que tal conhecer pessoalmente o {interesse}?

Gostaria de agendar uma visita para que você possa:
• Conhecer o apartamento decorado
• Visualizar as áreas comuns
• Tirar todas as suas dúvidas
• Conhecer as condições especiais

Horários disponíveis:
• Manhã: 9h às 12h
• Tarde: 14h às 18h
• Sábados: 9h às 16h

Qual horário funciona melhor para você?

Aguardo sua confirmação!

Atenciosamente,
Equipe Inmovya`
    }
  };

  const applyTemplate = (templateKey: string) => {
    if (!lead) return;

    const template = emailTemplates[templateKey as keyof typeof emailTemplates];
    if (!template) return;

    const replacePlaceholders = (text: string) => {
      return text
        .replace(/{nome}/g, lead.nome)
        .replace(/{interesse}/g, lead.interesse)
        .replace(/{telefone}/g, lead.telefone);
    };

    setEmailData({
      ...emailData,
      subject: replacePlaceholders(template.subject),
      body: replacePlaceholders(template.body),
      template: templateKey
    });
  };

  const handleSend = async () => {
    if (!emailData.to || !emailData.subject || !emailData.body) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o destinatário, assunto e corpo do email.",
        variant: "destructive",
      });
      return;
    }

    if (gmailAccounts.length > 0 && !emailData.selectedAccount) {
      toast({
        title: "Conta não selecionada",
        description: "Por favor, selecione uma conta Gmail para envio.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Usar sistema de email marketing
      const result = await emailMarketing({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.body.replace(/\n/g, '<br>'),
        name: lead?.nome,
        templateVars: {
          nome: lead?.nome || 'Cliente',
          interesse: lead?.interesse || '',
          telefone: lead?.telefone || '',
          email: lead?.email || ''
        },
        accountId: emailData.selectedAccount
      });

      if (result.success) {
        toast({
          title: "Email enviado!",
          description: `Email enviado com sucesso para ${lead?.nome} via sistema de email marketing.`,
        });
        onClose();
      } else {
        throw new Error(result.error || result.message || 'Erro ao enviar email');
      }
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast({
        title: "Erro no envio",
        description: error instanceof Error ? error.message : "Não foi possível enviar o email. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = () => {
    toast({
      title: "Rascunho salvo",
      description: "Email foi salvo como rascunho.",
    });
  };

  const handlePreview = () => {
    toast({
      title: "Visualização",
      description: "Prévia do email preparada.",
    });
  };

  // Buscar contas Gmail disponíveis
  useEffect(() => {
    const fetchGmailAccounts = async () => {
      try {
        const { data: accounts, error } = await supabase
          .from('gmail_accounts')
          .select('id, email, display_name, is_active, current_count, daily_limit')
          .eq('is_active', true)
          .order('email');

        if (error) {
          console.error('Erro ao buscar contas Gmail:', error);
          return;
        }

        setGmailAccounts(accounts || []);
        
        // Selecionar a primeira conta por padrão
        if (accounts && accounts.length > 0 && !emailData.selectedAccount) {
          setEmailData(prev => ({ ...prev, selectedAccount: accounts[0].id }));
        }
      } catch (error) {
        console.error('Erro ao carregar contas Gmail:', error);
      }
    };

    if (isOpen) {
      fetchGmailAccounts();
    }
  }, [isOpen, emailData.selectedAccount]);

  // Atualizar destinatário quando lead mudar
  React.useEffect(() => {
    if (lead?.email) {
      setEmailData(prev => ({ ...prev, to: lead.email }));
    }
  }, [lead]);

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Compor Email - {lead.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Templates */}
          <div>
            <Label htmlFor="template">Template de Email</Label>
            <Select value={emailData.template} onValueChange={(value) => {
              if (value === 'custom') {
                // Load custom templates
                return;
              }
              applyTemplate(value);
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione um template ou escreva seu próprio email" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primeiro-contato">Primeiro Contato</SelectItem>
                <SelectItem value="follow-up">Follow-up</SelectItem>
                <SelectItem value="materiais">Envio de Materiais</SelectItem>
                <SelectItem value="agendamento">Agendamento de Visita</SelectItem>
                <SelectItem value="custom">Templates Personalizados...</SelectItem>
              </SelectContent>
            </Select>
          </div>

           {/* Custom Templates Dialog */}
          {emailData.template === 'custom' && (
            <Dialog open={true} onOpenChange={() => setEmailData({...emailData, template: ''})}>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Selecionar Template Personalizado</DialogTitle>
                </DialogHeader>
                <EmailTemplates onSelectTemplate={(template) => {
                  const replacePlaceholders = (text: string) => {
                    return text
                      .replace(/\{\{nome_cliente\}\}/g, lead?.nome || '')
                      .replace(/\{\{empreendimento\}\}/g, lead?.interesse || '')
                      .replace(/\{\{telefone\}\}/g, lead?.telefone || '')
                      .replace(/\{\{email\}\}/g, lead?.email || '');
                  };

                  setEmailData({
                    ...emailData,
                    subject: replacePlaceholders(template.subject),
                    body: replacePlaceholders(template.body),
                    template: template.name
                  });
                }} />
              </DialogContent>
            </Dialog>
          )}

          {/* Seleção de Conta Gmail */}
          {gmailAccounts.length > 0 && (
            <div>
              <Label htmlFor="gmail-account">Conta de Envio</Label>
              <Select 
                value={emailData.selectedAccount} 
                onValueChange={(value) => setEmailData({...emailData, selectedAccount: value})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta para envio" />
                </SelectTrigger>
                <SelectContent>
                  {gmailAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col">
                        <span>{account.display_name || account.email}</span>
                        <span className="text-xs text-gray-500">
                          {account.email} • {account.current_count}/{account.daily_limit} hoje
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {gmailAccounts.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Contas Gmail</span>
              </div>
              <p className="text-xs text-amber-700">
                Configure pelo menos uma conta Gmail nas configurações para enviar emails.
              </p>
            </div>
          )}

          {/* Destinatário */}
          <div>
            <Label htmlFor="to">Para</Label>
            <Input
              id="to"
              type="email"
              value={emailData.to}
              onChange={(e) => setEmailData({...emailData, to: e.target.value})}
              className="mt-1"
              placeholder="seuemail@inmovya.com"
            />
          </div>

          {/* Assunto */}
          <div>
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={emailData.subject}
              onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
              className="mt-1"
              placeholder="Assunto do email"
            />
          </div>

          {/* Corpo do email */}
          <div>
            <Label htmlFor="body">Mensagem</Label>
            <Textarea
              id="body"
              value={emailData.body}
              onChange={(e) => setEmailData({...emailData, body: e.target.value})}
              className="mt-1 min-h-[300px]"
              placeholder="Digite sua mensagem aqui..."
            />
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button 
              onClick={handleSend} 
              className="flex-1 min-w-[120px]"
              disabled={isLoading}
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? "Enviando..." : "Enviar Email"}
            </Button>
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Rascunho
            </Button>
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Visualizar
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}