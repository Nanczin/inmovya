import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SMTPConfig } from "./SMTPConfig";
import { EmailHistory } from "./EmailHistory";
import { EmailSetup } from "./EmailSetup";
import { EmailTemplates } from "./EmailTemplates";
import { 
  Mail, 
  Settings, 
  History,
  Send,
  FileText
} from "lucide-react";

export function EmailModule() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sistema de Email</h1>
          <p className="text-muted-foreground">
            Configure e gerencie o envio de emails com SMTP ou Resend
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="marketing" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Marketing
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="resend" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Resend (Backup)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurações SMTP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SMTPConfig />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Templates de Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmailTemplates />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Configurações de Email Marketing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Automação de Campanhas</h3>
                  <p className="text-muted-foreground mb-4">Configure como e quando enviar emails automaticamente.</p>
                  
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Boas-vindas automático</h4>
                        <p className="text-sm text-muted-foreground">Enviar email de boas-vindas para novos leads</p>
                      </div>
                      <input type="checkbox" className="rounded" />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Follow-up automático</h4>
                        <p className="text-sm text-muted-foreground">Enviar emails de acompanhamento após 7 dias</p>
                      </div>
                      <input type="checkbox" className="rounded" />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Newsletter semanal</h4>
                        <p className="text-sm text-muted-foreground">Enviar newsletter com novos empreendimentos</p>
                      </div>
                      <input type="checkbox" className="rounded" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Segmentação</h3>
                  <p className="text-muted-foreground mb-4">Configure grupos de leads para campanhas direcionadas.</p>
                  
                  <div className="grid gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Leads por Status</h4>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Quente (23)</span>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Morno (45)</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">Frio (12)</span>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Leads por Empreendimento</h4>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">Residencial Vista (34)</span>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm">Torre Central (28)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Configurações Gerais</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Frequência máxima de envio</label>
                      <select className="w-full p-2 border rounded-md">
                        <option>1 email por dia</option>
                        <option>3 emails por semana</option>
                        <option>1 email por semana</option>
                        <option>2 emails por mês</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Horário preferido para envio</label>
                      <select className="w-full p-2 border rounded-md">
                        <option>09:00 - Manhã</option>
                        <option>14:00 - Tarde</option>
                        <option>19:00 - Noite</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Assinatura padrão</label>
                      <textarea 
                        className="w-full p-2 border rounded-md" 
                        rows={3}
                        placeholder="Digite sua assinatura padrão para os emails..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <EmailHistory />
        </TabsContent>

        <TabsContent value="resend">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Configuração Resend (Backup)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmailSetup />
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> O Resend é mantido como opção de backup. 
                  Configure o SMTP como método principal para maior controle e personalização.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}