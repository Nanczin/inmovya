import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Settings, BarChart3, Send } from "lucide-react";
import { GmailAccountManager } from "./GmailAccountManager";
import { EmailCampaignManager } from "./EmailCampaignManager";
import { EmailReportsModule } from "./EmailReportsModule";
import { EmailDispatchMonitor } from "./EmailDispatchMonitor";


export function GmailSystemModule() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sistema de Disparo Gmail</h1>
        <p className="text-muted-foreground">
          Gerencie contas Gmail, campanhas e monitore disparos com alternância automática e controle inteligente
        </p>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
          <TabsTrigger value="campaigns" className="gap-2 py-2 sm:py-1.5">
            <Send className="w-4 h-4" />
            Campanhas & Monitor
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2 py-2 sm:py-1.5">
            <Settings className="w-4 h-4" />
            Contas Gmail
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 py-2 sm:py-1.5">
            <BarChart3 className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-8">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Gerenciador de Campanhas
                </CardTitle>
              </CardHeader>
            </Card>
            <EmailCampaignManager />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2 pt-4">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Monitor de Disparos em Tempo Real</h2>
            </div>
            <EmailDispatchMonitor />
          </div>
        </TabsContent>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Gerenciamento de Contas Gmail
              </CardTitle>
            </CardHeader>
          </Card>
          <GmailAccountManager />
        </TabsContent>

        <TabsContent value="reports">
          <EmailReportsModule />
        </TabsContent>
      </Tabs>
    </div>
  );
}