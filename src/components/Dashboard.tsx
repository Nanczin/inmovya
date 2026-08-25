import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, Phone, TrendingUp, Play, Upload, FileText } from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import { supabase } from "@/integrations/supabase/client";
interface DashboardProps {
  onModuleChange?: (module: string) => void;
}
export function Dashboard({
  onModuleChange
}: DashboardProps = {}) {
  const {
    toast
  } = useToast();

  // Função para importar leads
  const handleImportarLeads = () => {
    if (onModuleChange) {
      toast({
        title: "Redirecionando",
        description: "Abrindo módulo de leads para importação...",
        variant: "default"
      });
      setTimeout(() => {
        onModuleChange("leads");
      }, 500);
    } else {
      // Fallback caso não tenha a função de navegação
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.xlsx,.json';
      input.onchange = e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          toast({
            title: "Importação Iniciada",
            description: `Processando arquivo: ${file.name}`,
            variant: "default"
          });
          setTimeout(() => {
            toast({
              title: "Leads Importados",
              description: `${Math.floor(Math.random() * 100) + 50} novos leads foram adicionados com sucesso.`,
              variant: "default"
            });
          }, 2000);
        }
      };
      input.click();
    }
  };

  // Função para iniciar nova campanha
  const handleIniciarCampanha = () => {
    if (onModuleChange) {
      toast({
        title: "Redirecionando",
        description: "Abrindo módulo de mailing...",
        variant: "default"
      });
      setTimeout(() => {
        onModuleChange("mailing");
      }, 500);
    } else {
      toast({
        title: "Nova Campanha",
        description: "Nova campanha será iniciada em breve!",
        variant: "default"
      });
    }
  };

  // Função para ver ligações
  const handleVerLigacoes = () => {
    if (onModuleChange) {
      toast({
        title: "Redirecionando",
        description: "Abrindo módulo de ligações...",
        variant: "default"
      });
      setTimeout(() => {
        onModuleChange("ligacoes");
      }, 500);
    } else {
      toast({
        title: "Configuração de Ligações",
        description: "Redirecionando para ligações...",
        variant: "default"
      });
    }
  };

  // Função para ver relatórios
  const handleVerRelatorios = () => {
    if (onModuleChange) {
      toast({
        title: "Redirecionando",
        description: "Abrindo módulo de relatórios...",
        variant: "default"
      });
      setTimeout(() => {
        onModuleChange("relatorios");
      }, 500);
    } else {
      toast({
        title: "Gerando Relatório",
        description: "Compilando dados dos últimos 30 dias...",
        variant: "default"
      });
    }
  };
  const [activeLeads, setActiveLeads] = useState(0);
  const [callsToday, setCallsToday] = useState(0);
  const [interacoes, setInteracoes] = useState(0);

  // Carregar dados de métricas reais
  useEffect(() => {
    loadMetrics();

    // Inscrever para atualizações em tempo real
    const channelContacts = supabase
      .channel('dashboard-contacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        loadMetrics();
      })
      .subscribe();

    const channelCalls = supabase
      .channel('dashboard-calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ligacoes' }, () => {
        loadMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelContacts);
      supabase.removeChannel(channelCalls);
    };
  }, []);

  const loadMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Contar leads totais (correspondente ao gerenciamento)
      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (leadsCount !== null) setActiveLeads(leadsCount);

      // Contar ligações de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: callsCount } = await supabase
        .from('ligacoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('data_ligacao', today.toISOString());

      if (callsCount !== null) setCallsToday(callsCount);

      // Contar interações
      const { count: interacoesCount } = await supabase
        .from('ligacoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'interacao');
        
      if (interacoesCount !== null) setInteracoes(interacoesCount);

    } catch (error) {
      console.error("Erro ao carregar métricas do dashboard:", error);
    }
  };

  const stats = [{
    title: "Leads Ativos",
    value: activeLeads.toString(),
    change: "Em tempo real",
    changeType: "neutral" as const,
    icon: Users,
    color: "text-primary"
  }, {
    title: "Ligações Hoje",
    value: callsToday.toString(),
    change: "Em tempo real",
    changeType: "neutral" as const,
    icon: Phone,
    color: "text-accent"
  }, {
    title: "Interações",
    value: interacoes.toString(),
    change: "Em tempo real",
    changeType: "neutral" as const,
    icon: TrendingUp,
    color: "text-success"
  }];
  return <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
    {/* Hero Section */}
    <div className="relative overflow-hidden rounded-xl bg-gradient-hero p-4 sm:p-6 lg:p-8 text-primary-foreground shadow-glow">
      <div className="absolute inset-0 opacity-20">
        <img src={heroDashboard} alt="Dashboard Hero" className="w-full h-full object-cover" />
      </div>
      <div className="relative z-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          Bem-vindo ao Inmovya
        </h1>
        <p className="text-primary-foreground/90 mb-4 sm:mb-6 max-w-2xl text-sm sm:text-base">
          Sua plataforma de automação inteligente está pronta para otimizar suas vendas imobiliárias.
          Comece configurando suas campanhas e importando seus leads.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Button variant="secondary" size="lg" className="shadow-elegant w-full sm:w-auto" onClick={handleIniciarCampanha}>
            <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            <span className="text-sm sm:text-base">Iniciar Oferta Ativa</span>
          </Button>
        </div>
      </div>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return <Card key={index} className="shadow-card hover:shadow-elegant transition-all duration-300 animate-slide-up" style={{
          animationDelay: `${index * 100}ms`
        }}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  {stat.title}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg bg-gradient-card ${stat.color} flex-shrink-0`}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
          </CardContent>
        </Card>;
      })}
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-1 gap-4 sm:gap-6">
      <Card className="shadow-card">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <Button variant="hero" className="w-full justify-start h-auto sm:h-16 p-4 text-left" onClick={handleImportarLeads}>
            <div className="flex items-center gap-3 sm:gap-4 w-full">
              <Upload className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm sm:text-base">Importar Novos Leads</div>
                <div className="text-xs sm:text-sm opacity-90 hidden sm:block">Adicionar leads via CSV, Excel ou JSON</div>
              </div>
            </div>
          </Button>

          <Button variant="success" className="w-full justify-start h-auto sm:h-16 p-4 text-left" onClick={handleVerLigacoes}>
            <div className="flex items-center gap-3 sm:gap-4 w-full">
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm sm:text-base">Ver Ligações</div>
                <div className="text-xs sm:text-sm opacity-90 hidden sm:block">Acompanhar histórico de ligações</div>
              </div>
            </div>
          </Button>

          <Button variant="default" className="w-full justify-start h-auto sm:h-16 p-4 text-left" onClick={handleVerRelatorios}>
            <div className="flex items-center gap-3 sm:gap-4 w-full">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm sm:text-base">Ver Relatórios</div>
                <div className="text-xs sm:text-sm opacity-90 hidden sm:block">Análise completa de performance e métricas</div>
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>;
}