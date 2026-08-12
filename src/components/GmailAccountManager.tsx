import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Plus, Trash2, AlertCircle, CheckCircle, Clock, Eye, EyeOff, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GmailAccount {
  id: string;
  email: string;
  app_password: string;
  display_name?: string;
  is_active: boolean;
  daily_limit: number;
  current_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export function GmailAccountManager() {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GmailAccount | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    app_password: '',
    display_name: '',
    daily_limit: 450,
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
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
        description: "Não foi possível carregar as contas Gmail.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      app_password: '',
      display_name: '',
      daily_limit: 450,
      is_active: true,
    });
    setEditingAccount(null);
  };

  const handleSave = async () => {
    if (!formData.email.trim() || !formData.app_password.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha email e app password.",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@gmail\.com$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, digite um email Gmail válido (@gmail.com).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const accountData = {
        ...formData,
        app_password: formData.app_password.replace(/\s/g, ''),
        user_id: user.id,
      };

      let result;
      if (editingAccount) {
        result = await supabase
          .from('gmail_accounts')
          .update(accountData)
          .eq('id', editingAccount.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('gmail_accounts')
          .insert(accountData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({
        title: "Conta salva!",
        description: `Conta Gmail ${formData.email} ${editingAccount ? 'atualizada' : 'adicionada'} com sucesso.`,
      });

      await loadAccounts();
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving Gmail account:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar a conta Gmail.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (account: GmailAccount) => {
    setFormData({
      email: account.email,
      app_password: account.app_password,
      display_name: account.display_name || '',
      daily_limit: account.daily_limit,
      is_active: account.is_active,
    });
    setEditingAccount(account);
    setIsOpen(true);
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta Gmail?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('gmail_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: "Conta excluída",
        description: "A conta Gmail foi removida com sucesso.",
      });

      await loadAccounts();
    } catch (error: any) {
      console.error('Error deleting Gmail account:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a conta Gmail.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (accountId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('gmail_accounts')
        .update({
          is_active: isActive,
          status: isActive ? 'active' : 'suspended'
        })
        .eq('id', accountId);

      if (error) throw error;

      await loadAccounts();

      toast({
        title: isActive ? "Conta ativada" : "Conta desativada",
        description: `A conta foi ${isActive ? 'ativada' : 'desativada'} com sucesso.`,
      });
    } catch (error: any) {
      console.error('Error toggling account:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da conta.",
        variant: "destructive",
      });
    }
  };

  const handleReactivateAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('gmail_accounts')
        .update({
          status: 'active',
          current_count: 0, // Reset count when reactivating
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId);

      if (error) throw error;

      await loadAccounts();

      toast({
        title: "Conta reativada",
        description: "A conta foi reativada e está pronta para uso.",
      });
    } catch (error: any) {
      console.error('Error reactivating account:', error);
      toast({
        title: "Erro",
        description: "Não foi possível reativar a conta.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (account: GmailAccount) => {
    if (!account.is_active) {
      return <Badge variant="secondary">Inativa</Badge>;
    }

    switch (account.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Ativa</Badge>;
      case 'limit_reached':
        return <Badge variant="destructive">Limite Atingido</Badge>;
      case 'suspended':
        return <Badge variant="outline">Suspensa</Badge>;
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="destructive">Erro</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReactivateAccount(account.id)}
              className="h-6 px-2 text-xs"
            >
              Reativar
            </Button>
          </div>
        );
      default:
        return <Badge variant="secondary">{account.status}</Badge>;
    }
  };

  const togglePasswordVisibility = (accountId: string) => {
    setShowPassword(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const activeAccounts = accounts.filter(acc => acc.is_active);
  const totalDailyLimit = activeAccounts.reduce((sum, acc) => sum + acc.daily_limit, 0);
  const totalUsedToday = activeAccounts.reduce((sum, acc) => sum + acc.current_count, 0);

  // Filter accounts based on status
  const filteredAccounts = accounts.filter(account => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return account.is_active && account.status === 'active';
    if (statusFilter === 'limit_reached') return account.status === 'limit_reached';
    if (statusFilter === 'suspended') return account.status === 'suspended' || !account.is_active;
    if (statusFilter === 'error') return account.status === 'error';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Total de Contas</p>
                <p className="text-2xl font-bold">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Contas Ativas</p>
                <p className="text-2xl font-bold">{activeAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium">Limite Diário Total</p>
              <p className="text-2xl font-bold">{totalDailyLimit.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium">Enviados Hoje</p>
              <p className="text-2xl font-bold">{totalUsedToday.toLocaleString()}</p>
              <Progress
                value={(totalUsedToday / totalDailyLimit) * 100}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gmail Setup Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Como configurar App Password no Gmail:</strong><br />
          1. Acesse as configurações da sua conta Google<br />
          2. Vá em "Segurança" → "Como fazer login no Google"<br />
          3. Ative a "Verificação em duas etapas" se não estiver ativada<br />
          4. Clique em "Senhas de app" e gere uma nova senha para "Email"<br />
          5. Use essa senha de 16 caracteres no campo "App Password" abaixo
        </AlertDescription>
      </Alert>

      {/* Account List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Contas Gmail Configuradas</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="limit_reached">Limite atingido</SelectItem>
                  <SelectItem value="suspended">Suspensas/Inativas</SelectItem>
                  <SelectItem value="error">Com erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Conta Gmail
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingAccount ? 'Editar' : 'Adicionar'} Conta Gmail
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Gmail *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu.email@gmail.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>App Password *</Label>
                    <Input
                      type="password"
                      value={formData.app_password}
                      onChange={(e) => setFormData({ ...formData, app_password: e.target.value })}
                      placeholder="xxxx xxxx xxxx xxxx"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome de Exibição</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value.replace(/['"]/g, '') })}
                      placeholder="Nome ou descrição da conta"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Limite Diário</Label>
                    <Input
                      type="number"
                      min="1"
                      max="500"
                      value={formData.daily_limit}
                      onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Recomendado: máximo 450 emails por dia
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Conta ativa</Label>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsOpen(false);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {accounts.length === 0
                  ? "Nenhuma conta Gmail configurada ainda."
                  : "Nenhuma conta encontrada com o filtro selecionado."
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {accounts.length === 0
                  ? "Adicione suas contas Gmail para começar a enviar emails."
                  : "Altere o filtro para ver outras contas ou adicione novas contas."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4" />
                      <div>
                        <p className="font-medium">{account.email}</p>
                        {account.display_name && (
                          <p className="text-sm text-muted-foreground">
                            {account.display_name}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(account)}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Usado hoje: {account.current_count}/{account.daily_limit}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        App Password:
                        <span className="font-mono ml-1">
                          {showPassword[account.id]
                            ? account.app_password
                            : '•'.repeat(16)
                          }
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePasswordVisibility(account.id)}
                          className="h-6 w-6 p-0"
                        >
                          {showPassword[account.id] ?
                            <EyeOff className="w-3 h-3" /> :
                            <Eye className="w-3 h-3" />
                          }
                        </Button>
                      </span>
                    </div>

                    <Progress
                      value={(account.current_count / account.daily_limit) * 100}
                      className="max-w-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center justify-center mr-2">
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={(checked) => handleToggleActive(account.id, checked)}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-200"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(account)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}