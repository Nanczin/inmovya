import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, TestTube2, FileText, AtSign } from "lucide-react";
import { emailMarketing, sendModoButantaEmail, emailTemplates } from "@/lib/emailService";

export function EmailTestModule() {
  const [isLoading, setIsLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("custom");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const { toast } = useToast();

  const handleSendTestEmail = async () => {
    if (!recipient || !recipientName) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o email e nome do destinatário.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let result;

      if (selectedTemplate === "modoButanta") {
        result = await sendModoButantaEmail({
          nome: recipientName,
          email: recipient
        });
      } else {
        if (!customSubject || !customBody) {
          toast({
            title: "Template incompleto",
            description: "Preencha o assunto e corpo do email.",
            variant: "destructive",
          });
          return;
        }

        // Processar variáveis no HTML
        let processedHTML = customBody
          .replace(/{{nome}}/g, recipientName)
          .replace(/{{consultor}}/g, 'Estevão')
          .replace(/{{telefone}}/g, '(11) 93930-2207')
          .replace(/{{email}}/g, 'estevao@inmovya.com.br');

        result = await emailMarketing({
          to: recipient,
          subject: customSubject,
          html: processedHTML,
          name: recipientName
        });
      }

      if (result.success) {
        toast({
          title: "Email enviado via Gmail API!",
          description: result.message,
        });
        
        // Reset form
        setRecipient("");
        setRecipientName("");
        setCustomSubject("");
        setCustomBody("");
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : 'Erro interno do servidor',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplate = (templateKey: string) => {
    if (templateKey === "leadWelcome") {
      setCustomSubject("Bem-vindo à Inmovya!");
      setCustomBody(emailTemplates.leadWelcome);
    } else if (templateKey === "modoButanta") {
      // Template will be used directly via sendModoButantaEmail
      setCustomSubject("");
      setCustomBody("");
    } else {
      setCustomSubject("");
      setCustomBody("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <AtSign className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sistema de Email - Gmail API</h1>
          <p className="text-muted-foreground">
            Teste o envio de emails usando a Gmail API
          </p>
        </div>
      </div>

      <Tabs defaultValue="test" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="test" className="gap-2">
            <TestTube2 className="w-4 h-4" />
            Teste de Envio
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Ver Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Enviar Email de Teste via Gmail API
              </CardTitle>
              <CardDescription>
                Teste o sistema de envio usando a Gmail API com alta entregabilidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recipient Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Email do Destinatário</Label>
                  <Input
                    id="recipient"
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Nome do Destinatário</Label>
                  <Input
                    id="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="João da Silva"
                  />
                </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select value={selectedTemplate} onValueChange={(value) => {
                  setSelectedTemplate(value);
                  loadTemplate(value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modoButanta">MODO Butantã (Completo)</SelectItem>
                    <SelectItem value="leadWelcome">Boas-vindas para Lead</SelectItem>
                    <SelectItem value="custom">Template Customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800">
                  <AtSign className="w-4 h-4" />
                  <span className="font-medium">Gmail API</span>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  Todos os emails são enviados através da Gmail API com excelente entregabilidade
                </p>
              </div>

              {/* Custom Template Fields */}
              {selectedTemplate !== "modoButanta" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Assunto do Email</Label>
                    <Input
                      id="subject"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Assunto do email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body">Corpo do Email (HTML)</Label>
                    <Textarea
                      id="body"
                      value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)}
                      placeholder="Conteúdo HTML do email... Use {{nome}}, {{consultor}}, {{telefone}} para variáveis"
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <div className="text-xs text-muted-foreground">
                      <strong>Variáveis disponíveis:</strong> {`{{nome}}, {{consultor}}, {{telefone}}, {{email}}`}
                    </div>
                  </div>
                </>
              )}

              {/* Send Button */}
              <Button 
                onClick={handleSendTestEmail} 
                disabled={isLoading}
                className="w-full gap-2"
              >
                <Send className="w-4 h-4" />
                {isLoading ? "Enviando via Gmail API..." : "Enviar Email de Teste"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>MODO Butantã - Template Completo</CardTitle>
                <CardDescription>
                  Template HTML responsivo para o empreendimento MODO Butantã
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Variáveis disponíveis:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><code>{"{{nome}}"}</code> - Nome do cliente</li>
                    <li><code>{"{{consultor}}"}</code> - Estevão (fixo)</li>
                    <li><code>{"{{telefone}}"}</code> - (11) 93930-2207 (fixo)</li>
                    <li><code>{"{{email}}"}</code> - estevao@inmovya.com.br (fixo)</li>
                  </ul>
                  <p className="mt-4"><strong>Recursos:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Design responsivo para desktop e mobile</li>
                    <li>Enviado via Gmail API para máxima entregabilidade</li>
                    <li>Call-to-action para agendamento de visita</li>
                    <li>Informações de plantas e preços</li>
                    <li>Footer com dados completos do consultor</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template de Boas-vindas</CardTitle>
                <CardDescription>
                  Template genérico para novos leads interessados em empreendimentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Ideal para:</strong> Primeiros contatos, leads de formulários web, captação geral</p>
                  <p><strong>Inclui:</strong> Mensagem de bienvenida, próximos passos, dados de contato</p>
                  <p><strong>Entrega:</strong> Via Gmail API para garantir chegada na caixa de entrada</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}