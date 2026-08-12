
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, MapPin, Briefcase, Camera, Save, Trash2, ChevronDown, Lock, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileDialog({ isOpen, onClose }: EditProfileDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { addNotification, subscribeToPush } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Initialize with empty values
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    department: "",
    location: "",
    bio: "",
    avatar: ""
  });

  // Carregar dados do perfil quando o dialog abrir
  useEffect(() => {
    if (isOpen && user) {
      loadProfileData();
    }
  }, [isOpen, user]);

  const loadProfileData = async () => {
    if (!user) return;

    setIsLoadingProfile(true);
    try {
      // Buscar dados do perfil na tabela profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
      }

      // Preencher com dados salvos ou dados padrão
      setProfileData({
        name: profile?.full_name || user?.user_metadata?.full_name || "",
        email: user?.email || "",
        phone: profile?.phone || user?.user_metadata?.phone || "",
        position: profile?.position || "",
        department: profile?.department || "",
        location: profile?.location || "",
        bio: profile?.bio || "",
        avatar: profile?.avatar_url || user?.user_metadata?.avatar_url || ""
      });
    } catch (error) {
      console.error('Erro ao carregar dados do perfil:', error);
      toast({
        title: "Erro ao Carregar",
        description: "Houve um problema ao carregar seus dados.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);

    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      let avatarUrl = profileData.avatar;

      // Upload da imagem se for um arquivo base64
      if (profileData.avatar && profileData.avatar.startsWith('data:')) {
        const file = await fetch(profileData.avatar).then(r => r.blob());
        const fileName = `${Date.now()}.jpg`;
        const filePath = `${user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(uploadData.path);

        avatarUrl = publicUrlData.publicUrl;
      }

      // Salvar dados do perfil na tabela profiles
      const profileUpdateData = {
        user_id: user.id,
        full_name: profileData.name || null,
        phone: profileData.phone || null,
        position: profileData.position || null,
        department: profileData.department || null,
        location: profileData.location || null,
        bio: profileData.bio || null,
        avatar_url: avatarUrl || null,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileUpdateData, { onConflict: 'user_id' });

      if (profileError) {
        throw profileError;
      }

      // Atualizar metadata do usuário se necessário
      if (profileData.name !== user?.user_metadata?.full_name) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            full_name: profileData.name,
          }
        });

        if (updateError) {
          console.warn('Erro ao atualizar metadados do usuário:', updateError);
        }
      }

      toast({
        title: "Perfil Atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({
        title: "Erro ao Salvar",
        description: "Houve um problema ao atualizar seu perfil.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo do arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo Inválido",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho do arquivo (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo Muito Grande",
        description: "A imagem deve ter no máximo 2MB.",
        variant: "destructive",
      });
      return;
    }

    // Ler o arquivo como base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setProfileData(prev => ({
        ...prev,
        avatar: result
      }));

      toast({
        title: "Avatar Atualizado",
        description: "Sua foto de perfil foi alterada com sucesso.",
      });
    };

    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
    fileInput?.click();
  };

  const removeAvatar = () => {
    setProfileData(prev => ({
      ...prev,
      avatar: ""
    }));

    toast({
      title: "Foto Removida",
      description: "Sua foto de perfil foi removida com sucesso.",
    });
  };

  // Gerar iniciais do nome do usuário
  const getUserInitials = () => {
    if (profileData.name) {
      return profileData.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Editar Perfil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando dados do perfil...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Avatar Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profileData.avatar} />
                  <AvatarFallback className="text-lg">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Camera className="w-4 h-4" />
                        Foto do Perfil
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={triggerFileInput}>
                        <Camera className="w-4 h-4 mr-2" />
                        Alterar Foto
                      </DropdownMenuItem>
                      {profileData.avatar && (
                        <DropdownMenuItem onClick={removeAvatar} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover Foto
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG ou GIF. Máximo 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Basic Information */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="seu@email.com"
                    disabled={true}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      if (!profileData.email) return;
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(profileData.email, {
                          redirectTo: window.location.origin + '/reset-password',
                        });
                        if (error) throw error;
                        toast({
                          title: "Email enviado",
                          description: "Verifique sua caixa de entrada para redefinir a senha.",
                        });
                      } catch (err: any) {
                        toast({
                          title: "Erro",
                          description: err.message || "Erro ao enviar email de redefinição.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Redefinir Senha
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Notificações */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Notificações</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      try {
                        toast({ title: "Iniciando teste...", description: "Solicitando permissão e enviando notificação." });
                        await subscribeToPush();
                        addNotification({
                          type: 'info',
                          title: 'Teste de Notificação 🔔',
                          message: 'Isso é um teste! Se você viu isso, as notificações estão funcionando corretamente neste dispositivo.',
                        });
                      } catch (e) {
                        console.error(e);
                        toast({ title: "Erro", description: "Falha ao enviar notificação.", variant: "destructive" });
                      }
                    }}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Testar Notificações no Celular
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Clique para verificar se seu dispositivo está recebendo notificações push e locais corretamente.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveProfile} disabled={isLoading} className="gap-2">
                  <Save className="w-4 h-4" />
                  {isLoading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
