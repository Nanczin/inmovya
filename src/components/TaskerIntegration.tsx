
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { 
  Smartphone,
  Phone,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";

interface TaskerConfig {
  ngrok_url: string; // Now accepts both ngrok URLs and local server URLs
  status: string;
  ultimaConexao: string;
}

interface TaskerIntegrationProps {
  config: TaskerConfig;
  onConfigChange: (config: TaskerConfig) => void;
}

export function TaskerIntegration({ config, onConfigChange }: TaskerIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof TaskerConfig, value: string) => {
    const newConfig = {
      ...config,
      [field]: value
    };
    onConfigChange(newConfig);
  };

  const testConnection = async () => {
    if (!config.ngrok_url?.trim()) {
      toast({
        title: "❌ URL Necessária",
        description: "Insira a URL do servidor antes de testar",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      let baseUrl = config.ngrok_url.trim();
      
      // Adicionar protocolo se não tiver
      if (!baseUrl.startsWith('http')) {
        // Para URLs do ngrok, sempre usar HTTPS
        if (baseUrl.includes('ngrok') || baseUrl.includes('.app')) {
          baseUrl = 'https://' + baseUrl;
        } else if (baseUrl.startsWith('192.168.') || baseUrl.startsWith('10.') || baseUrl.startsWith('172.') || baseUrl.includes('localhost')) {
          baseUrl = 'http://' + baseUrl;
        } else {
          baseUrl = 'https://' + baseUrl;
        }
      }

      console.log(`🌐 Testando servidor: ${baseUrl}`);

      // Detectar se é ngrok
      const isNgrok = baseUrl.includes('ngrok') || baseUrl.includes('.ngrok.io') || baseUrl.includes('ngrok-free.app');
      
      if (isNgrok) {
        // Para ngrok, usar estratégia especial
        console.log('🚀 Detectado servidor ngrok, usando estratégia otimizada');
        
        // Primeiro, tentar uma requisição simples com no-cors para bypassing CORS
        try {
          await fetch(baseUrl, {
            method: 'GET',
            mode: 'no-cors',
            headers: {
              'ngrok-skip-browser-warning': 'true'
            },
            signal: AbortSignal.timeout(20000)
          });
          
          console.log('📡 Requisição no-cors enviada para ngrok');
          
          const newConfig = {
            ...config,
            status: "Conectado (Ngrok)",
            ultimaConexao: new Date().toLocaleString('pt-BR')
          };
          onConfigChange(newConfig);
          
          toast({
            title: "🚀 Ngrok Conectado!",
            description: "Conexão estabelecida com sucesso. Para comandos funcionarem, abra a URL no navegador primeiro.",
            variant: "default",
          });
          
        } catch (error) {
          // Se falhar, orientar sobre configuração
          console.log('⚠️ Ngrok precisa de configuração adicional');
          
          const newConfig = {
            ...config,
            status: "Ngrok - Necessita Configuração",
            ultimaConexao: "Abra a URL no navegador primeiro"
          };
          onConfigChange(newConfig);
          
          toast({
            title: "🔧 Configuração Ngrok Necessária",
            description: "Abra a URL do ngrok no navegador primeiro para aceitar o aviso de segurança.",
            variant: "default",
          });
        }
        
      } else {
        // Para servidores locais
        const isLocalUrl = baseUrl.startsWith('http://') && (
          baseUrl.includes('192.168.') || 
          baseUrl.includes('localhost') || 
          baseUrl.includes('127.0.0.1') ||
          baseUrl.includes('10.') || 
          baseUrl.includes('172.')
        );

        if (isLocalUrl && window.location.protocol === 'https:') {
          const newConfig = {
            ...config,
            status: "Erro de Segurança",
            ultimaConexao: "URLs HTTP bloqueadas em HTTPS"
          };
          onConfigChange(newConfig);
          
          toast({
            title: "🔒 Bloqueado por Segurança",
            description: "URLs HTTP locais são bloqueadas em sites HTTPS. Use ngrok ou servidor HTTPS local.",
            variant: "destructive",
          });
          return;
        }

        // Tentar conexão normal para servidores locais
        const response = await fetch(baseUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/json,*/*',
            'User-Agent': 'Inmovya-TaskerClient/1.0'
          },
          mode: 'cors',
          signal: AbortSignal.timeout(15000)
        });

        console.log(`📡 Resposta recebida: Status ${response.status}`);

        const newConfig = {
          ...config,
          status: "Conectado (Local)", 
          ultimaConexao: new Date().toLocaleString('pt-BR')
        };
        onConfigChange(newConfig);

        if (response.status === 404) {
          toast({
            title: "⚠️ Servidor Local Ativo - Sem API",
            description: "Servidor responde, mas sem API específica configurada",
            variant: "default",
          });
        } else {
          toast({
            title: "🚀 Servidor Local Conectado!",
            description: `Conexão estabelecida (Status: ${response.status})`,
            variant: "default",
          });
        }
      }
      
    } catch (error: any) {
      console.error('❌ Erro de conexão:', error);
      
      const newConfig = {
        ...config,
        status: "Desconectado", 
        ultimaConexao: "Falha na conexão"
      };
      onConfigChange(newConfig);
      
      let errorMsg = '';
      if (error.name === 'AbortError') {
        errorMsg = 'Timeout (20s) - servidor demorou para responder. Verifique se o Tasker HTTP Server está ativo.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMsg = 'Falha na conexão. Para ngrok, abra a URL no navegador primeiro. Para servidor local, verifique se está rodando.';
      } else {
        errorMsg = error.message;
      }
      
      toast({
        title: "🔴 Conexão Falhou",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes("Conectado")) return "bg-success text-success-foreground";
    if (status.includes("Desconectado")) return "bg-destructive text-destructive-foreground";
    if (status.includes("Erro")) return "bg-destructive text-destructive-foreground";
    return "bg-warning text-warning-foreground";
  };

  const getStatusIcon = (status: string) => {
    if (status.includes("Conectado")) return <CheckCircle className="w-5 h-5" />;
    if (status.includes("Desconectado") || status.includes("Erro")) return <XCircle className="w-5 h-5" />;
    return <Phone className="w-5 h-5" />;
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Conexão do Servidor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 p-3 rounded-lg bg-gradient-card">
          <div className={`p-2 rounded-lg ${getStatusColor(config.status)}`}>
            {getStatusIcon(config.status)}
          </div>
          <div className="flex-1">
            <div className="font-medium text-foreground">Status da Conexão</div>
            <div className="text-sm text-muted-foreground">
              Última conexão: {config.ultimaConexao}
            </div>
          </div>
          <Badge className={getStatusColor(config.status)}>
            {config.status}
          </Badge>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="server-url">🌐 URL do Servidor</Label>
            <Input 
              id="server-url" 
              value={config.ngrok_url || ''} 
              onChange={(e) => handleInputChange('ngrok_url', e.target.value)}
              className="mt-1" 
              placeholder="https://abc123.ngrok-free.app ou http://192.168.10.116:8080"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ✅ Cole aqui a URL do servidor. Exemplos:<br/>
              • Ngrok (recomendado): https://abc123.ngrok-free.app<br/>
              • Local (apenas HTTP em desenvolvimento): http://192.168.10.116:8080
            </p>
            
            {config.ngrok_url?.includes('ngrok') && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800">
                  💡 <strong>Dica para Ngrok:</strong> Para melhor funcionamento:<br/>
                  1. Abra a URL ngrok no navegador primeiro<br/>
                  2. Aceite o aviso de segurança do ngrok<br/>
                  3. Depois teste a conexão aqui<br/>
                  4. Para evitar avisos: use <code>ngrok http --domain=seu-dominio.ngrok-free.app 8080</code>
                </p>
              </div>
            )}
            
            {(config.ngrok_url?.includes('192.168.') || config.ngrok_url?.includes('localhost') || config.ngrok_url?.startsWith('http://')) && !config.ngrok_url?.includes('ngrok') && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-800">
                  ⚠️ <strong>Limitação de Segurança:</strong> URLs HTTP locais não funcionam em aplicações HTTPS.<br/>
                  <strong>Soluções:</strong><br/>
                  • Use ngrok: <code>ngrok http 8080</code><br/>
                  • Use servidor HTTPS local<br/>
                  • Acesse a aplicação via HTTP (não recomendado)
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="default" 
            onClick={testConnection}
            disabled={isConnecting || !config.ngrok_url?.trim()}
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            Testar Conexão
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
