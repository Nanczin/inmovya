import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { LeadsModule } from "@/components/LeadsModule";
import { GmailSystemModule } from "@/components/GmailSystemModule";
import { EmpreendimentosModule } from "@/components/EmpreendimentosModule";
import { MateriaisModule } from "@/components/MateriaisModule";
import { MailingModule } from "@/components/MailingModule";
import { LigacoesModule } from "@/components/LigacoesModule";
import { TemplatesModule } from "@/components/TemplatesModule";
import { RelatoriosModule } from "@/components/RelatoriosModule";
import { SettingsModule } from "@/components/SettingsModule";
import { AgendaModule } from "@/components/AgendaModule";
import { FunilModule } from "@/components/FunilModule";
import { WhatsappModule } from "@/components/WhatsappModule";

const Index = () => {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

    useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('taskId');
    const leadId = params.get('leadId');

    if (taskId) {
      setActiveModule('agenda');
      setNavigationParams({ id: taskId });
      window.history.replaceState({}, '', '/');
    } else if (leadId) {
      setActiveModule('leads');
      setNavigationParams({ id: leadId });
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleNavigation = (module: string, params?: any) => {
    setActiveModule(module);
    if (params) {
      setNavigationParams(params);
    }
  };

  // Show loading or auth check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Inmovya</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Inmovya</h1>
          <p className="text-muted-foreground">Sistema de Gestão Imobiliária</p>
          <Button onClick={() => navigate('/auth')}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <Dashboard onModuleChange={setActiveModule} />;
      case "agenda":
        return <AgendaModule initialTaskId={navigationParams?.id} />;
      case "leads":
        return <LeadsModule initialLeadId={navigationParams?.id} />;
      case "email-marketing":
        return <GmailSystemModule />;
      case "empreendimentos":
        return <EmpreendimentosModule />;
      case "materiais":
        return <MateriaisModule />;
      case "mailing":
        return <MailingModule onModuleChange={setActiveModule} />;
      case "ligacoes":
        return <LigacoesModule />;
      case "templates":
        return <TemplatesModule />;
      case "funil":
        return <FunilModule />;
      case "relatorios":
        return <RelatoriosModule />;
      case "whatsapp":
        return <WhatsappModule />;
      case "settings":
        return <SettingsModule />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">


          <Header activeModule={activeModule} onNavigate={handleNavigation} />

          <main className="flex-1 overflow-auto">
            <div className="h-full p-4 md:p-6">
              {renderModule()}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;


