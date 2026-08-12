import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, Users, Megaphone, Building2, FileText, Mic, Mail, Settings, BarChart3, Phone } from "lucide-react";
import inmovyaLogo from "@/assets/inmovya-logo.png";
interface SidebarProps {
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
  id: "campanhas",
  label: "Campanhas",
  icon: Megaphone
}, {
  id: "empreendimentos",
  label: "Empreendimentos",
  icon: Building2
}, {
  id: "materiais",
  label: "Materiais",
  icon: FileText
}, {
  id: "vozes",
  label: "Vozes",
  icon: Mic
}, {
  id: "mailing",
  label: "Mailing",
  icon: Mail
}, {
  id: "ligacoes",
  label: "Ligações",
  icon: Phone
}, {
  id: "relatorios",
  label: "Relatórios",
  icon: BarChart3
}];
export function Sidebar({
  activeModule,
  onModuleChange
}: SidebarProps) {
  return <div className="w-64 bg-card border-r border-border h-screen flex flex-col shadow-card">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/lovable-uploads/9cce030f-985f-4b71-8bfb-bba6c3472b9f.png" alt="Inmovya" className="w-12 h-12 object-contain bg-transparent" />
          <div>
            
            
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => {
        const Icon = item.icon;
        const isActive = activeModule === item.id;
        return <Button key={item.id} variant={isActive ? "default" : "ghost"} className={cn("w-full justify-start gap-3 h-12", isActive && "shadow-elegant")} onClick={() => onModuleChange(item.id)}>
              <Icon className="w-5 h-5" />
              {item.label}
            </Button>;
      })}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start gap-3 h-12" onClick={() => onModuleChange("settings")}>
          <Settings className="w-5 h-5" />
          Configurações
        </Button>
      </div>
    </div>;
}