import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Mail, Key, TestTube2, CheckCircle } from "lucide-react";

interface SMTPConfiguration {
  id?: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
  use_ssl: boolean;
  is_active: boolean;
}

export function SMTPConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [configs, setConfigs] = useState<SMTPConfiguration[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState<SMTPConfiguration>({
    provider: 'gmail',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    username: '',
    password: '',
    use_ssl: true,
    is_active: false,
  });

  const providerPresets = {
    gmail: {
      smtp_host: 'smtp.gmail.com',
      smtp_port: 465,
      use_ssl: true,
    },
    skymail: {
      smtp_host: 'smtp.skymail.net.br',
      smtp_port: 465,
      use_ssl: true,
    },
  };

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    const { data, error } = await supabase
      .from('smtp_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading SMTP configurations:', error);
      return;
    }

    setConfigs(data || []);
  };

  const handleProviderChange = (provider: string) => {
    const preset = providerPresets[provider as keyof typeof providerPresets];
    setFormData({
      ...formData,
      provider,
      ...preset,
    });
  };

  const handleSave = async () => {
    if (!formData.username.trim() || !formData.password.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha usuário e senha.",
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

      // Deactivate other configs for this provider
      if (formData.is_active) {
        await supabase
          .from('smtp_configurations')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('provider', formData.provider);
      }

      const configData = {
        ...formData,
        user_id: user.id,
      };

      let result;
      if (formData.id) {
        result = await supabase
          .from('smtp_configurations')
          .update(configData)
          .eq('id', formData.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('smtp_configurations')
          .insert(configData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({
        title: "Configuração salva!",
        description: `Configuração SMTP para ${formData.provider} salva com sucesso.`,
      });

      await loadConfigurations();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving SMTP config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    if (!formData.username.trim() || !formData.password.trim()) {
      toast({
        title: "Configure primeiro",
        description: "Preencha as credenciais antes de testar.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // First save the configuration permanently to test it
      const configData = {
        ...formData,
        user_id: user.id,
      };

      // Remove any existing id if this is a new config to avoid conflicts
      const { id, ...configToSave } = configData;

      let savedConfig;
      if (formData.id) {
        // Update existing config
        const { data, error } = await supabase
          .from('smtp_configurations')
          .update(configToSave)
          .eq('id', formData.id)
          .select()
          .single();
        if (error) throw error;
        savedConfig = data;
      } else {
        // Insert new config
        const { data, error } = await supabase
          .from('smtp_configurations')
          .insert(configToSave)
          .select()
          .single();
        if (error) throw error;
        savedConfig = data;
        // Update formData with the new id
        setFormData(prev => ({ ...prev, id: savedConfig.id }));
      }

      // Test email send using the saved configuration
      const response = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: formData.username,
          subject: 'Teste de Configuração SMTP - Inmovya',
          body: `Olá!\n\nEste é um email de teste para validar a configuração SMTP do provedor ${formData.provider}.\n\nSe você recebeu este email, a configuração está funcionando corretamente!\n\nAtenciosamente,\nSistema Inmovya`,
          provider: formData.provider,
        },
      });

      if (response.error) throw response.error;

      toast({
        title: "Teste realizado!",
        description: `Email de teste enviado com sucesso via ${formData.provider}. Verifique sua caixa de entrada.`,
      });

      // Reload configurations to show the saved one
      await loadConfigurations();
      
    } catch (error) {
      console.error('Error testing SMTP:', error);
      toast({
        title: "Erro no teste",
        description: "Não foi possível enviar o email de teste. Verifique suas credenciais.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      provider: 'gmail',
      smtp_host: 'smtp.gmail.com',
      smtp_port: 465,
      username: '',
      password: '',
      use_ssl: true,
      is_active: false,
    });
  };

  const handleEdit = (config: SMTPConfiguration) => {
    setFormData(config);
    setIsOpen(true);
  };

  const handleToggleActive = async (configId: string, isActive: boolean) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      if (isActive) {
        // Deactivate other configs for this provider
        const config = configs.find(c => c.id === configId);
        if (config) {
          await supabase
            .from('smtp_configurations')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('provider', config.provider)
            .neq('id', configId);
        }
      }

      await supabase
        .from('smtp_configurations')
        .update({ is_active: isActive })
        .eq('id', configId);

      await loadConfigurations();
      
      toast({
        title: isActive ? "Configuração ativada" : "Configuração desativada",
        description: `A configuração foi ${isActive ? 'ativada' : 'desativada'} com sucesso.`,
      });
    } catch (error) {
      console.error('Error toggling config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da configuração.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing Configurations */}
      {configs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Configurações SMTP</h3>
          {configs.map((config) => (
            <Card key={config.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="font-medium capitalize">{config.provider}</span>
                    {config.is_active && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {config.username} - {config.smtp_host}:{config.smtp_port}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.is_active}
                    onCheckedChange={(checked) => handleToggleActive(config.id!, checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(config)}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Settings className="w-4 h-4" />
            Configurar SMTP
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Configuração SMTP
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Provedor de Email</Label>
              <Select
                value={formData.provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="skymail">Skymail (Skynova)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* SMTP Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Servidor SMTP</Label>
                <Input
                  value={formData.smtp_host}
                  onChange={(e) => setFormData({...formData, smtp_host: e.target.value})}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input
                  type="number"
                  value={formData.smtp_port}
                  onChange={(e) => setFormData({...formData, smtp_port: parseInt(e.target.value)})}
                  placeholder="465"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email/Usuário</Label>
              <Input
                type="email"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Senha
                {formData.provider === 'gmail' && (
                  <span className="text-sm text-muted-foreground ml-2">
                    (Use App Password se 2FA habilitado)
                  </span>
                )}
              </Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.use_ssl}
                onCheckedChange={(checked) => setFormData({...formData, use_ssl: checked})}
              />
              <Label>Usar SSL/TLS</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label>Configuração ativa</Label>
            </div>

            {/* Help Text */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="text-sm space-y-2">
                  {formData.provider === 'gmail' ? (
                    <>
                      <p><strong>Gmail:</strong></p>
                      <p>• Para contas com 2FA: gere uma "App Password" nas configurações de segurança</p>
                      <p>• Use sua senha normal se 2FA não estiver habilitado</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Skymail:</strong></p>
                      <p>• Use as credenciais fornecidas pela Skynova</p>
                      <p>• Servidor: smtp.skymail.net.br, Porta: 465</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
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
                onClick={handleTest}
                disabled={isTesting}
                className="gap-2"
              >
                <TestTube2 className="w-4 h-4" />
                {isTesting ? "Testando..." : "Testar"}
              </Button>
              <Button 
                variant="ghost" 
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
  );
}
