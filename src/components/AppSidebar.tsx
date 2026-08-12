import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Home, Users, Building2, FileText, Mail, Settings, BarChart3, Phone, AtSign, Filter } from "lucide-react";
interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}
const menuItems = [{
  id: "dashboard",
  label: "Dashboard",
  icon: Home
}, {
  id: "leads",
  label: "Leads",
  icon: Users
}, {
  id: "empreendimentos",
  label: "Empreendimentos",
  icon: Building2
}, {
  id: "materiais",
  label: "Materiais",
  icon: FileText
}, {
  id: "mailing",
  label: "Mailing",
  icon: Mail
}, {
  id: "email-marketing",
  label: "Email Marketing",
  icon: AtSign
}, {
  id: "ligacoes",
  label: "Ligações",
  icon: Phone
}, {
  id: "templates",
  label: "Templates",
  icon: FileText
}, {
  id: "funil",
  label: "Funil",
  icon: Filter
}, {
  id: "relatorios",
  label: "Relatórios",
  icon: BarChart3
}];
export function AppSidebar({
  activeModule,
  onModuleChange
}: AppSidebarProps) {
  const {
    state,
    isMobile,
    setOpenMobile
  } = useSidebar();
  const isCollapsed = state === "collapsed";
  return <Sidebar collapsible="icon" className="border-r">
    <SidebarHeader className="p-4">
      <img src="/lovable-uploads/9cce030f-985f-4b71-8bfb-bba6c3472b9f.png" alt="Inmovya" className="w-14 h-14 object-contain flex-shrink-0" />
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Navegação</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => {
                    onModuleChange(item.id);
                    if (isMobile) setOpenMobile(false);
                  }}
                  isActive={isActive}
                  className="w-full"
                >
                  <Icon className="w-4 h-4" />
                  {!isCollapsed && <span>{item.label}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

  </Sidebar>;
}