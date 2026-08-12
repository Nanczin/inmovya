import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Edit, Trash2, Crown, Shield } from "lucide-react";

type AppRole = "admin" | "manager" | "consultant" | "viewer" | "guest";

interface User {
  id: string;
  email: string;
  nome: string;
  role: AppRole;
  ultimo_login: string;
  criado_em: string;
  confirmado: boolean;
}

export function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("guest");

  const roles = [
    { value: "admin" as AppRole, label: "Administrador", color: "destructive" },
    { value: "manager" as AppRole, label: "Gerente", color: "default" },
    { value: "consultant" as AppRole, label: "Consultor", color: "secondary" },
    { value: "viewer" as AppRole, label: "Visualizador", color: "outline" },
    { value: "guest" as AppRole, label: "Convidado", color: "outline" }
  ];

  const getRoleInfo = (role: AppRole) => {
    return roles.find(r => r.value === role) || roles[4]; // Default to guest
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Buscar usuários da tabela auth.users com seus roles
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Para cada user_role, buscar informações do usuário do auth
      const usersWithDetails = await Promise.all(
        data.map(async (userRole) => {
          const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userRole.user_id);
          
          if (authError || !authUser.user) {
            console.warn(`Não foi possível buscar detalhes do usuário ${userRole.user_id}`);
            return null;
          }

          return {
            id: userRole.user_id,
            email: authUser.user.email || 'N/A',
            nome: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'N/A',
            role: userRole.role as AppRole,
            ultimo_login: authUser.user.last_sign_in_at 
              ? new Date(authUser.user.last_sign_in_at).toLocaleString('pt-BR')
              : 'Nunca',
            criado_em: new Date(authUser.user.created_at).toLocaleDateString('pt-BR'),
            confirmado: !!authUser.user.email_confirmed_at
          };
        })
      );

      // Filtrar usuários válidos
      const validUsers = usersWithDetails.filter(user => user !== null) as User[];
      setUsers(validUsers);

    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Role Atualizado",
        description: "O role do usuário foi atualizado com sucesso.",
      });

      await loadUsers(); // Recarregar lista
      setEditingUser(null);

    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o role do usuário.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addNewUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Erro",
        description: "Digite um email válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: 'TempPassword123!', // Senha temporária
        email_confirm: true,
        user_metadata: {
          full_name: newUserEmail.split('@')[0]
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Adicionar role na tabela user_roles
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: newUserRole,
            assigned_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (roleError) throw roleError;

        toast({
          title: "Usuário Criado",
          description: `Usuário ${newUserEmail} criado com role ${getRoleInfo(newUserRole).label}.`,
        });

        setNewUserEmail("");
        setNewUserRole("guest");
        setShowAddUser(false);
        await loadUsers();
      }

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o usuário.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja remover o usuário ${userEmail}?`)) {
      return;
    }

    setLoading(true);
    try {
      // Remover da tabela user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Remover do auth (opcional - comentado para manter histórico)
      // const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      // if (authError) throw authError;

      toast({
        title: "Usuário Removido",
        description: `Usuário ${userEmail} foi removido do sistema.`,
      });

      await loadUsers();

    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o usuário.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Gerenciar Usuários
        </h2>
        
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="usuario@inmovya.com"
                />
              </div>
              <div>
                <Label htmlFor="role">Role Inicial</Label>
                <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={addNewUser} disabled={loading}>
                  Criar Usuário
                </Button>
                <Button variant="outline" onClick={() => setShowAddUser(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <div className="text-center py-4">Carregando usuários...</div>}

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{user.nome}</h3>
                    {user.role === 'admin' && <Crown className="w-4 h-4 text-yellow-500" />}
                    <Badge variant={getRoleInfo(user.role).color as any}>
                      {getRoleInfo(user.role).label}
                    </Badge>
                    {user.confirmado && <Shield className="w-4 h-4 text-green-500" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    Último login: {user.ultimo_login} | Criado em: {user.criado_em}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Usuário: {user.nome}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Email</Label>
                          <Input value={user.email} disabled />
                        </div>
                        <div>
                          <Label>Role</Label>
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => updateUserRole(user.id, newRole as AppRole)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {user.role !== 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeUser(user.id, user.email)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
            <p className="text-muted-foreground">
              Adicione usuários ao sistema para começar a gerenciar permissões.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}