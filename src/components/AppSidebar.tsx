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
  Bot,
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
      { id: "robo-anuncios", label: "Robô de anúncios", icon: Bot },
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
            group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto
            ${ativo && !recolhido ? "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-sidebar-primary" : ""}`}
        >
          <Icon className={`w-[18px] h-[18px] ${ativo ? "text-sidebar-primary" : ""}`} />
          {!recolhido && <span>{item.label}</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={recolhido ? "px-0 pt-5 pb-3 items-center" : "px-4 pt-5 pb-3"}>
        <button type="button" onClick={() => ir("dashboard")} className={`flex items-center gap-2.5 min-w-0 ${recolhido ? "justify-center w-full" : ""}`} title="Início">
          <img src="/brand/marca-branca.png" alt="" className={`${recolhido ? "h-7" : "h-8"} w-auto shrink-0`} />
          {!recolhido && <span className="text-white text-lg font-extrabold tracking-tight">Inmovya</span>}
        </button>
      </SidebarHeader>

      <SidebarContent className="px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden group-data-[collapsible=icon]:px-0">
        {grupos.map((g, i) => (
          <SidebarGroup
            key={g.titulo}
            className={`py-1 ${recolhido ? "px-0" : ""} ${recolhido && i > 0 ? "mt-1 pt-2 border-t border-sidebar-border/60 mx-3 w-auto" : ""}`}
          >
            {!recolhido && (
              <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/55 h-6">{g.titulo}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className={recolhido ? "gap-1 items-center" : "gap-0.5"}>{g.itens.map(botao)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className={`pb-3 pt-2 border-t border-sidebar-border ${recolhido ? "px-0" : "px-1"}`}>
        <SidebarMenu className={recolhido ? "items-center" : ""}>{botao({ id: "settings", label: "Configurações", icon: Settings })}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
