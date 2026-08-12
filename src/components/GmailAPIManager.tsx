import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Mail, Settings, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GmailAccount {
  id: string;
  email: string;
  is_active: boolean;
  status: string;
  current_count: number;
  daily_limit: number;
  created_at: string;
}

export function GmailAPIManager() {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadGmailAccounts();
  }, []);

  const loadGmailAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('gmail_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading Gmail accounts:', error);
      toast({
        title: "Erro ao carregar contas",
        description: "Não foi possível carregar as contas do Gmail",
        variant: "destructive",
      });
    }
  };

  const generateAuthUrl = () => {
    const clientId = "YOUR_GMAIL_CLIENT_ID"; // This will need to be configured
    const redirectUri = `${window.location.origin}/gmail-callback`;
    const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";
    
    const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    setAuthUrl(authUrl);
    window.open(authUrl, '_blank');
  };

  const handleAuthCode = async () => {
    const code = prompt("Cole aqui o código de autorização obtido do Google:");
    if (!code) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
        body: { code }
      });

      if (error) throw error;

      toast({
        title: "Conta configurada!",
        description: "Conta Gmail configurada com sucesso",
      });

      loadGmailAccounts();
    } catch (error) {
      console.error('Error handling auth code:', error);
      toast({
        title: "Erro na autenticação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('gmail_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Conta ${!currentStatus ? 'ativada' : 'desativada'} com sucesso`,
      });

      loadGmailAccounts();
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da conta",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'limit_reached': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6" />
          Gmail API - Configuração OAuth 2.0
        </h2>
        <p className="text-muted-foreground">
          Configure contas Gmail para envio de emails via API oficial
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Adicionar Nova Conta Gmail
          </CardTitle>
          <CardDescription>
            Configure uma nova conta Gmail para envio de emails através da API oficial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Pré-requisitos:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Configurar projeto no Google Cloud Console</li>
              <li>Ativar a Gmail API</li>
              <li>Criar credenciais OAuth 2.0</li>
              <li>Adicionar {window.location.origin}/gmail-callback às URLs de redirecionamento</li>
            </ol>
            <a 
              href="https://console.cloud.google.com/apis/credentials" 
              target="_blank" 
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mt-2"
            >
              <ExternalLink className="w-3 h-3" />
              Google Cloud Console
            </a>
          </div>

          <div className="flex gap-4">
            <Button onClick={generateAuthUrl} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Iniciar Autorização OAuth
            </Button>
            <Button 
              onClick={handleAuthCode} 
              disabled={isLoading}
              variant="outline"
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              {isLoading ? "Processando..." : "Inserir Código de Autorização"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas Gmail Configuradas</CardTitle>
          <CardDescription>
            Gerencie suas contas Gmail para envio de emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma conta Gmail configurada ainda
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(account.status)}`} />
                    <div>
                      <p className="font-medium">{account.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.current_count}/{account.daily_limit} emails hoje
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={account.is_active ? "default" : "secondary"}>
                      {account.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAccountStatus(account.id, account.is_active)}
                    >
                      {account.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}