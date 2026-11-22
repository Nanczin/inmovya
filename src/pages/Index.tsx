import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { LeadsModule } from "@/components/LeadsModule";
import { GmailSystemModule } from "@/components/GmailSystemModule";
import { MailingModule } from "@/components/MailingModule";
import { LigacoesModule } from "@/components/LigacoesModule";
import { RelatoriosModule } from "@/components/RelatoriosModule";
import { ConfiguracoesModule } from "@/components/ConfiguracoesModule";
import { AgendaModule } from "@/components/AgendaModule";
import { NegociosModule } from "@/components/NegociosModule";
import { EsteirasModule } from "@/components/EsteirasModule";
import { EsteiraEmAndamento } from "@/components/esteiras/EsteiraEmAndamento";
import { RespostasWhatsApp } from "@/components/esteiras/RespostasWhatsApp";
import { ArenaModule } from "@/components/ArenaModule";
import { MetasDoDia } from "@/components/arena/MetasDoDia";
import { TaskViewDialog } from "@/components/dialogs/TaskViewDialog";
import { LembretesPopup } from "@/components/LembretesPopup";

const Index = () => {
  // envio da esteira interrompido por recarregar a página: abre direto em Esteiras para continuar
  const [activeModule, setActiveModule] = useState(() => {
    try {
      const r = JSON.parse(localStorage.getItem("inmovya_esteira_rodada") || "null");
      if (r && r.dia === new Date().toLocaleDateString("pt-BR") && Array.isArray(r.ids) && r.ids.length) return "esteiras";
    } catch {
      /* ignore */
    }
    return "arena";
  });
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [globalViewTaskId, setGlobalViewTaskId] = useState<string | null>(null);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // muda a cada link direto, para a tela abrir de novo já no lugar certo
  const [navKey, setNavKey] = useState(0);

  // Links diretos: /leads?lead=ID · /negocios?coluna=p2 · /esteiras?esteira=ID · /ligacoes · /relatorios?registrar=1 · /agenda
  useEffect(() => {
    const seg = location.pathname.replace(/^\/+/, "").split("/")[0];
    const modulos: Record<string, string> = { leads: "leads", negocios: "negocios", esteiras: "esteiras", ligacoes: "ligacoes", relatorios: "relatorios", agenda: "agenda" };
    const mod = modulos[seg];
    if (!mod) return;
    const p = new URLSearchParams(location.search);
    setActiveModule(mod);
    setNavigationParams({
      id: p.get("lead") || p.get("compromisso") || undefined,
      coluna: p.get("coluna") || undefined,
      esteira: p.get("esteira") || undefined,
      registrar: p.has("registrar"),
    });
    setNavKey((k) => k + 1);
  }, [location.key, location.pathname, location.search]);

    useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('taskId');
    const leadId = params.get('leadId');

    if (taskId) {
      setGlobalViewTaskId(taskId);
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
    if (module === 'view-task') {
      setGlobalViewTaskId(params?.id);
      return;
    }
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
        return <LeadsModule key={navKey} initialLeadId={navigationParams?.id} />;
      case "email-marketing":
        return <GmailSystemModule />;
      case "negocios":
        return <NegociosModule key={navKey} onNavigate={handleNavigation} initialColuna={navigationParams?.coluna} />;
      case "esteiras":
        return <EsteirasModule key={navKey} initialEsteiraId={navigationParams?.esteira} />;
      case "mailing":
        return <MailingModule onModuleChange={setActiveModule} />;
      case "ligacoes":
        return <LigacoesModule />;
      case "funil": // o funil agora fica dentro de Relatórios
      case "relatorios":
        return <RelatoriosModule key={navKey} abrirRegistrar={!!navigationParams?.registrar} />;
      case "arena":
        return <ArenaModule />;
      case "settings":
        return <ConfiguracoesModule />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          activeModule={activeModule}
          onModuleChange={(m) => {
            // pelo menu, Esteiras abre com todas as colunas (o filtro é só quando vem do botão do Negócios)
            try {
              sessionStorage.removeItem("inmovya_esteira_coluna");
            } catch {
              /* ignore */
            }
            setActiveModule(m);
            setNavigationParams(null);
            // saiu de um link direto pelo menu: a barra de endereço volta para o início
            if (location.pathname !== "/") navigate("/", { replace: true });
          }}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">


          <Header activeModule={activeModule} onNavigate={handleNavigation} />

          <main className="flex-1 overflow-auto">
            <div className="h-full p-3 sm:p-4 md:p-6">
              {renderModule()}
            </div>
          </main>
        </div>
      </div>
    <TaskViewDialog taskId={globalViewTaskId} onClose={() => setGlobalViewTaskId(null)} />
    <LembretesPopup
      onVerTarefa={(id) => setGlobalViewTaskId(id)}
      onVerLead={(id) => { setActiveModule("leads"); setNavigationParams({ id }); }}
    />
    <MetasDoDia onAbrirArena={() => setActiveModule("arena")} />
    <RespostasWhatsApp />
    {activeModule !== "esteiras" && <EsteiraEmAndamento onAbrir={() => setActiveModule("esteiras")} />}
    </SidebarProvider>
  );
};

export default Index;





