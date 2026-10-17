import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Users,
  FileText,
  Mail,
  Settings,
  BarChart3,
  Phone,
  AtSign,
  Filter,
  Calendar as CalendarIcon,
  MessageCircle,
  Briefcase,
  Workflow,
  LayoutTemplate,
} from "lucide-react";

interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

type Item = { id: string; label: string; icon: typeof Home };

// Agrupado pelo que você faz no dia: atender → prospectar → materiais → acompanhar
const grupos: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Dia a dia",
    itens: [
      { id: "dashboard", label: "Início", icon: Home },
      { id: "agenda", label: "Agenda", icon: CalendarIcon },
      { id: "leads", label: "Leads", icon: Users },
      { id: "negocios", label: "Negócios", icon: Briefcase },
      { id: "esteiras", label: "Esteiras", icon: Workflow },
    ],
  },
  {
    titulo: "Prospecção",
    itens: [
      { id: "ligacoes", label: "Ligações", icon: Phone },
      { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
      { id: "mailing", label: "Mailing", icon: Mail },
      { id: "email-marketing", label: "Email Marketing", icon: AtSign },
    ],
  },
  {
    titulo: "Conteúdo",
    itens: [
      { id: "materiais", label: "Materiais", icon: FileText },
      { id: "templates", label: "Templates", icon: LayoutTemplate },
      { id: "funil", label: "Funil", icon: Filter },
    ],
  },
  {
    titulo: "Resultados",
    itens: [{ id: "relatorios", label: "Relatórios", icon: BarChart3 }],
  },
];

export function AppSidebar({ activeModule, onModuleChange }: AppSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const recolhido = state === "collapsed";

  const ir = (id: string) => {
    onModuleChange(id);
    if (isMobile) setOpenMobile(false);
  };

  const botao = (item: Item) => {
    const Icon = item.icon;
    const ativo = activeModule === item.id;
    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          onClick={() => ir(item.id)}
          isActive={ativo}
          tooltip={item.label}
          className={`relative h-[34px] rounded-lg font-medium text-[13.5px] transition-colors
            text-sidebar-foreground hover:bg-sidebar-accent hover:text-white
            data-[active=true]:bg-sidebar-accent data-[active=true]:text-white
            ${ativo ? "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-sidebar-primary" : ""}`}
        >
          <Icon className={`w-[18px] h-[18px] ${ativo ? "text-sidebar-primary" : ""}`} />
          {!recolhido && <span>{item.label}</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <button type="button" onClick={() => ir("dashboard")} className="flex items-center gap-2.5 min-w-0" title="Início">
          <img src="/brand/marca-branca.png" alt="" className="h-8 w-auto shrink-0" />
          {!recolhido && <span className="text-white text-lg font-extrabold tracking-tight">Inmovya</span>}
        </button>
      </SidebarHeader>

      <SidebarContent className="px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {grupos.map((g) => (
          <SidebarGroup key={g.titulo} className="py-1">
            {!recolhido && (
              <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/55 h-6">{g.titulo}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">{g.itens.map(botao)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-1 pb-3 pt-1 border-t border-sidebar-border">
        <SidebarMenu>{botao({ id: "settings", label: "Configurações", icon: Settings })}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
