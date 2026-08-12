import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { TaskerIntegration } from "./TaskerIntegration";
import { IAConfigSection } from "./IAConfigSection";
import { AutomationConfig } from "./AutomationConfig";
import { 
  Settings,
  Smartphone,
  Globe,
  Key,
  Bell,
  Shield,
  Database,
  Mic,
  Phone,
  Save,
  TestTube,
  Zap,
  Users,
  Lock
} from "lucide-react";

export function SettingsModule() {
  const { toast } = useToast();
  
  const [configuracoes, setConfiguracoes] = useState({
    tasker: {
      ip: "192.168.1.100",
      porta: "8080",
      token: "tk_abc123def456",
      status: "Conectado",
      ultimaConexao: "2024-01-28 14:30"
    },
    ia: {
      openai_key: "sk-...hidden",
      elevenlabs_key: "el_...hidden",
      modelo_gpt: "gpt-4",
      temperatura: 0.7,
      max_tokens: 150
    },
    automacao: {
      intervalo_ligacoes: 15,
      tentativas_maximas: 3,
      horario_inicio: "09:00",
      horario_fim: "18:00",
      dias_semana: ["seg", "ter", "qua", "qui", "sex"],
      ativo: false
    },
    notificacoes: {
      email: true,
      sms: false,
      whatsapp: true,
      dashboard: true
    },
    seguranca: {
      backup_automatico: true,
      retencao_dados: 365,
      logs_auditoria: true,
      ip_whitelist: true
    }
  });

  const salvarConfiguracoes = () => {
    // Simular salvamento
    localStorage.setItem('inmovya_config', JSON.stringify(configuracoes));
    
    toast({
      title: "Configurações Salvas",
      description: "Todas as configurações foram salvas com sucesso.",
      variant: "default",
    });
  };

  const realizarBackupManual = () => {
    const backup = {
      configuracoes,
      timestamp: new Date().toISOString(),
      version: "v2.1.4"
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `inmovya-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    toast({
      title: "Backup Realizado",
      description: "Backup baixado com sucesso.",
      variant: "default",
    });
  };

  const visualizarLogs = () => {
    const logs = [
      `[${new Date().toISOString()}] Sistema iniciado`,
      `[${new Date().toISOString()}] Configurações carregadas`,
      `[${new Date().toISOString()}] Integração Tasker: ${configuracoes.tasker.status}`,
      `[${new Date().toISOString()}] Automação: ${configuracoes.automacao.ativo ? 'Ativa' : 'Inativa'}`
    ];
    
    console.log("=== LOGS DO SISTEMA ===");
    logs.forEach(log => console.log(log));
    
    toast({
      title: "Logs do Sistema",
      description: "Logs exibidos no console do navegador.",
      variant: "default",
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
          <p className="text-muted-foreground">Gerencie todas as configurações da plataforma</p>
        </div>
        <Button variant="hero" className="shadow-elegant" onClick={salvarConfiguracoes}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurações Principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Integração Tasker */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Integração Tasker (Android)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-gradient-card">
                <div className="p-2 rounded-lg bg-success text-success-foreground">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">Status da Conexão</div>
                  <div className="text-sm text-muted-foreground">Última conexão: {configuracoes.tasker.ultimaConexao}</div>
                </div>
                <Badge className="bg-success text-success-foreground">
                  {configuracoes.tasker.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tasker-ip">IP do Dispositivo</Label>
                  <Input id="tasker-ip" value={configuracoes.tasker.ip} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="tasker-porta">Porta HTTP Server</Label>
                  <Input id="tasker-porta" value={configuracoes.tasker.porta} className="mt-1" />
                </div>
              </div>

              <div>
                <Label htmlFor="tasker-token">Token de Autenticação</Label>
                <Input id="tasker-token" value={configuracoes.tasker.token} type="password" className="mt-1" />
              </div>

              <div className="flex gap-3">
                <Button variant="default">
                  <TestTube className="w-4 h-4 mr-2" />
                  Testar Conexão
                </Button>
                <Button variant="outline">
                  <Globe className="w-4 h-4 mr-2" />
                  QR Code Setup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* APIs de IA */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                APIs de Inteligência Artificial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input id="openai-key" value={configuracoes.ia.openai_key} type="password" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Usado para geração de scripts e análise de sentimento</p>
              </div>

              <div>
                <Label htmlFor="elevenlabs-key">ElevenLabs API Key</Label>
                <Input id="elevenlabs-key" value={configuracoes.ia.elevenlabs_key} type="password" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Usado para síntese de voz ultra-realista</p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="gpt-model">Modelo GPT</Label>
                  <Input id="gpt-model" value={configuracoes.ia.modelo_gpt} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="temperatura">Temperatura</Label>
                  <Input id="temperatura" value={configuracoes.ia.temperatura} type="number" step="0.1" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input id="max-tokens" value={configuracoes.ia.max_tokens} type="number" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Automação */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Automação de Ligações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="intervalo">Intervalo entre Ligações (min)</Label>
                  <Input id="intervalo" value={configuracoes.automacao.intervalo_ligacoes} type="number" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="tentativas">Tentativas Máximas</Label>
                  <Input id="tentativas" value={configuracoes.automacao.tentativas_maximas} type="number" className="mt-1" />
                </div>
                <div>
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-1 mt-1">
                    {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia, index) => (
                      <Button 
                        key={dia} 
                        variant={configuracoes.automacao.dias_semana.includes(dia.toLowerCase()) ? "default" : "outline"} 
                        size="sm" 
                        className="w-10 h-8 text-xs"
                      >
                        {dia}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hora-inicio">Horário de Início</Label>
                  <Input id="hora-inicio" value={configuracoes.automacao.horario_inicio} type="time" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="hora-fim">Horário de Fim</Label>
                  <Input id="hora-fim" value={configuracoes.automacao.horario_fim} type="time" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar de Configurações */}
        <div className="space-y-6">
          {/* Notificações */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Email</div>
                  <div className="text-sm text-muted-foreground">Relatórios e alertas</div>
                </div>
                <Switch checked={configuracoes.notificacoes.email} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">SMS</div>
                  <div className="text-sm text-muted-foreground">Alertas urgentes</div>
                </div>
                <Switch checked={configuracoes.notificacoes.sms} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">WhatsApp</div>
                  <div className="text-sm text-muted-foreground">Notificações em tempo real</div>
                </div>
                <Switch checked={configuracoes.notificacoes.whatsapp} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Dashboard</div>
                  <div className="text-sm text-muted-foreground">Notificações no app</div>
                </div>
                <Switch checked={configuracoes.notificacoes.dashboard} />
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Backup Automático</div>
                  <div className="text-sm text-muted-foreground">Backup diário dos dados</div>
                </div>
                <Switch checked={configuracoes.seguranca.backup_automatico} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Logs de Auditoria</div>
                  <div className="text-sm text-muted-foreground">Registrar todas as ações</div>
                </div>
                <Switch checked={configuracoes.seguranca.logs_auditoria} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">IP Whitelist</div>
                  <div className="text-sm text-muted-foreground">Restringir acesso por IP</div>
                </div>
                <Switch checked={configuracoes.seguranca.ip_whitelist} />
              </div>

              <Separator />

              <div>
                <Label>Retenção de Dados (dias)</Label>
                <Input value={configuracoes.seguranca.retencao_dados} type="number" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Usuários */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Usuários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Gerenciar Usuários
              </Button>
              
              <Button variant="outline" className="w-full justify-start">
                <Key className="w-4 h-4 mr-2" />
                Permissões
              </Button>
              
              <Button variant="outline" className="w-full justify-start">
                <Lock className="w-4 h-4 mr-2" />
                Política de Senhas
              </Button>
            </CardContent>
          </Card>

          {/* Sistema */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">Versão</div>
                <div className="text-muted-foreground">Inmovya v2.1.4</div>
              </div>
              
              <div className="text-sm">
                <div className="font-medium">Última Atualização</div>
                <div className="text-muted-foreground">28/01/2024</div>
              </div>
              
              <Separator />
              
              <Button variant="outline" className="w-full justify-start">
                <Database className="w-4 h-4 mr-2" />
                Backup Manual
              </Button>
              
              <Button variant="outline" className="w-full justify-start">
                <Settings className="w-4 h-4 mr-2" />
                Logs do Sistema
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}