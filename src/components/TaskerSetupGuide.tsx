import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Smartphone, 
  Download, 
  Settings, 
  Wifi, 
  Globe, 
  CheckCircle,
  AlertTriangle,
  ExternalLink
} from "lucide-react";

export function TaskerSetupGuide() {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Guia de Configuração do Tasker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Passo 1: Instalação */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-primary text-primary-foreground">1</Badge>
            <h3 className="font-semibold text-foreground">Instalar Aplicativos</h3>
          </div>
          <div className="pl-8 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="w-4 h-4" />
              <span>Instale o <strong>Tasker</strong> (app pago) na Play Store</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="w-4 h-4" />
              <span>Instale o <strong>AutoVoice</strong> (plugin do Tasker)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="w-4 h-4" />
              <span>Instale o <strong>AutoInput</strong> para automação de toque</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Passo 2: Servidor HTTP */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-primary text-primary-foreground">2</Badge>
            <h3 className="font-semibold text-foreground">Configurar Servidor HTTP</h3>
          </div>
          <div className="pl-8 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="w-4 h-4" />
              <span>Abra o Tasker → Menu → Preferences → Action</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4" />
              <span>Ative <strong>"Allow External Access"</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wifi className="w-4 h-4" />
              <span>Defina a porta como <strong>8080</strong></span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <strong>Importante:</strong> O dispositivo deve estar na mesma rede WiFi ou usar ngrok para acesso externo.
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Passo 3: Ngrok */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-primary text-primary-foreground">3</Badge>
            <h3 className="font-semibold text-foreground">Configurar Ngrok (Acesso Externo)</h3>
          </div>
          <div className="pl-8 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" />
              <span>Instale o ngrok no PC/Mac: <strong>https://ngrok.com</strong></span>
            </div>
            <div className="bg-secondary/50 border rounded-md p-3 space-y-1">
              <p className="text-xs font-mono text-foreground">ngrok http 192.168.X.X:8080</p>
              <p className="text-xs text-muted-foreground">Substitua X.X pelo IP real do dispositivo</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="w-4 h-4" />
              <span>Copie a URL gerada (ex: https://abc123.ngrok-free.app)</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Passo 4: Tarefas do Tasker */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-primary text-primary-foreground">4</Badge>
            <h3 className="font-semibold text-foreground">Criar Tarefas no Tasker</h3>
          </div>
          <div className="pl-8 space-y-3">
            
            {/* Tarefa 1: Fazer Ligação */}
            <div className="bg-gradient-card rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-foreground">📞 Tarefa: "Fazer Ligação"</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>1.</strong> Action → Phone → Call</p>
                <p><strong>2.</strong> Number: %par1 (parâmetro recebido)</p>
                <p><strong>3.</strong> Auto Dial: ✓ marcado</p>
              </div>
            </div>

            {/* Tarefa 2: Tocar Áudio */}
            <div className="bg-gradient-card rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-foreground">🔊 Tarefa: "Tocar Audio"</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>1.</strong> Action → Media → Music Play</p>
                <p><strong>2.</strong> File: %par1 (arquivo de áudio)</p>
                <p><strong>3.</strong> Wait For Completion: ✓</p>
              </div>
            </div>

            {/* Tarefa 3: Desligar */}
            <div className="bg-gradient-card rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-foreground">📵 Tarefa: "Desligar"</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>1.</strong> Action → Phone → End Call</p>
                <p><strong>2.</strong> Ou usar AutoInput para simular toque no botão</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Teste de Funcionamento */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-success text-success-foreground">✓</Badge>
            <h3 className="font-semibold text-foreground">Teste de Funcionamento</h3>
          </div>
          <div className="pl-8 space-y-2">
            <div className="text-sm text-muted-foreground">
              <p>1. Acesse: <span className="font-mono bg-secondary/50 px-1 rounded">https://sua-url.ngrok-free.app</span></p>
              <p>2. Aceite o aviso de segurança do ngrok</p>
              <p>3. Teste a conexão usando o botão "Testar Conexão" acima</p>
              <p>4. Se conectar, você pode iniciar campanhas</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Dica de Ouro:</p>
              <p>Para testar rapidamente, acesse a URL do ngrok no navegador primeiro. Isso resolve problemas de CORS e avisos de segurança.</p>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}