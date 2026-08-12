import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationsDialog } from "@/components/dialogs/NotificationsDialog";
import { EditProfileDialog } from "@/components/dialogs/EditProfileDialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Search, User, Settings, LogOut } from "lucide-react";
import { toast } from "sonner";
interface HeaderProps {
  activeModule: string;
  onNavigate?: (module: string, params?: any) => void;
}
const moduleNames: Record<string, string> = {
  dashboard: "Dashboard Principal",
  leads: "Gerenciamento de Leads",
  campanhas: "Campanhas Ativas",
  empreendimentos: "Empreendimentos",
  materiais: "Materiais de Venda",
  vozes: "Vozes Sintéticas",
  mailing: "Listas de Contatos",
  ligacoes: "Histórico de Ligações",
  relatorios: "Relatórios e Análises",
  settings: "Configurações"
};
export function Header({
  activeModule,
  onNavigate
}: HeaderProps) {
  const {
    signOut,
    user
  } = useAuth();
  const {
    displayName,
    avatarUrl,
    refetchProfile
  } = useProfile();
  const {
    unreadCount
  } = useNotifications();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const handleNavigate = (module: string, id?: string) => {
    console.log(`Navegando para: ${module}`, id ? `ID: ${id}` : '');
    if (onNavigate) {
      onNavigate(module, { id });
    }
    setIsSearchOpen(false);
  };
  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
  };
  const handleProfileClose = () => {
    setIsEditProfileOpen(false);
    // Recarregar perfil após fechar o dialog
    refetchProfile();
  };
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };
  return <>
    {/* Desktop Header */}
    <header className="hidden md:flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      {/* Left section */}
      <div className="flex items-center gap-2 lg:gap-4 flex-1 max-w-2xl min-w-0">
        <SidebarTrigger className="lg:hidden flex-shrink-0" />

      </div>

      {/* Center section - Search (Hidden on tablet, visible on desktop) */}
      <div className="hidden xl:flex items-center gap-4 flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Buscar leads, campanhas..." className="pl-10 w-full cursor-pointer bg-muted/50 border-0 focus-visible:bg-background text-sm" onClick={() => setIsSearchOpen(true)} readOnly />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
        {/* Search button for tablet/mobile */}
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setIsSearchOpen(true)}>
          <Search className="w-4 h-4" />
        </Button>



        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative mr-1"
          onClick={() => setIsNotificationsOpen(true)}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 sm:gap-2 max-w-[120px] sm:max-w-none">
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-xs">
                  {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:inline text-sm truncate">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 z-50">
            <DropdownMenuItem onClick={handleEditProfile}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Editar Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Mobile-only Header */}
    <header className="md:hidden flex h-16 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SidebarTrigger />
        <h2 className="text-lg font-semibold text-foreground truncate">
          {moduleNames[activeModule] || "Inmovya"}
        </h2>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)}>
          <Search className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="relative" onClick={() => setIsNotificationsOpen(true)}>
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Avatar className="w-7 h-7">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-xs">
                  {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 z-50">
            <DropdownMenuItem onClick={handleEditProfile}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Editar Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Global Search Modal */}
    <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={handleNavigate} />

    {/* Notifications Dialog */}
    <NotificationsDialog isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

    {/* Edit Profile Dialog */}
    <EditProfileDialog isOpen={isEditProfileOpen} onClose={handleProfileClose} />
  </>;
}