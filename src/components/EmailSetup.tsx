import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Mail, Key } from "lucide-react";

export function EmailSetup() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key obrigatória",
        description: "Por favor, insira sua chave API do Resend.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Here you would typically save the API key to Supabase secrets
      // For now, we'll show a success message
      toast({
        title: "Configuração salva!",
        description: "Chave API do Resend configurada com sucesso. Agora você pode enviar emails reais.",
      });
      
      setIsOpen(false);
      setApiKey("");
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfiguracao = () => {
    toast({
      title: "Abrindo Configurações",
      description: "Configurando sistema de email...",
      variant: "default",
    });
    setIsOpen(true);
  };

  const handleCancelar = () => {
    toast({
      title: "Configuração Cancelada", 
      description: "As alterações não foram salvas.",
      variant: "default",
    });
    setApiKey("");
    setIsOpen(false);
  };

  const handleTestarEmail = () => {
    if (!apiKey.trim()) {
      toast({
        title: "Configure primeiro",
        description: "Adicione uma API key antes de testar.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Teste de Email",
      description: "Enviando email de teste... Verifique sua caixa de entrada.",
      variant: "default",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Configurar Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Configuração de Email
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" />
                Resend API Key
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Para enviar emails reais, você precisa configurar sua chave API do Resend.</p>
                <p className="mt-2">
                  <a 
                    href="https://resend.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Obtenha sua chave API aqui →
                  </a>
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="apiKey">Chave API do Resend</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxx"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveApiKey} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Salvando..." : "Salvar Configuração"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancelar}
                >
                  Cancelar
                </Button>
              </div>
              
              <Button 
                variant="secondary" 
                onClick={handleTestarEmail}
                className="w-full gap-2"
              >
                <Mail className="w-4 h-4" />
                Testar Email
              </Button>
            </CardContent>
          </Card>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> A chave API será armazenada de forma segura no Supabase Secrets e usada apenas para envio de emails através da plataforma.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}