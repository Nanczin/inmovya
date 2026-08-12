import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import {
  Mail,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  Download,
  RefreshCw
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailStats {
  total_sent: number;
  total_failed: number;
  success_rate: number;
  avg_per_day: number;
}

interface CampaignStats {
  id: string;
  name: string;
  total_emails: number;
  sent_emails: number;
  failed_emails: number;
  success_rate: number;
  status: string;
  created_at: string;
}

interface AccountStats {
  email: string;
  current_count: number;
  daily_limit: number;
  usage_percentage: number;
  status: string;
  total_sent_today: number;
}

interface DailyStats {
  date: string;
  sent: number;
  failed: number;
  total: number;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

export function EmailReportsModule() {
  const [emailStats, setEmailStats] = useState<EmailStats>({
    total_sent: 0,
    total_failed: 0,
    success_rate: 0,
    avg_per_day: 0
  });
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([]);
  const [accountStats, setAccountStats] = useState<AccountStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState(7); // Last 7 days
  const { toast } = useToast();

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadEmailStats(),
        loadCampaignStats(),
        loadAccountStats(),
        loadDailyStats()
      ]);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Erro ao carregar relatórios",
        description: "Não foi possível carregar os dados dos relatórios.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmailStats = async () => {
    const startDate = startOfDay(subDays(new Date(), dateRange));
    const endDate = endOfDay(new Date());

    const { data: logs, error } = await supabase
      .from('email_logs')
      .select('status, sent_at')
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());

    if (error) throw error;

    const total_sent = logs?.filter(log => log.status === 'success').length || 0;
    const total_failed = logs?.filter(log => log.status === 'failed').length || 0;
    const total = total_sent + total_failed;
    const success_rate = total > 0 ? (total_sent / total) * 100 : 0;
    const avg_per_day = total / dateRange;

    setEmailStats({
      total_sent,
      total_failed,
      success_rate,
      avg_per_day
    });
  };

  const loadCampaignStats = async () => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const stats = data?.map(campaign => ({
      ...campaign,
      success_rate: campaign.total_emails > 0
        ? ((campaign.sent_emails / campaign.total_emails) * 100)
        : 0
    })) || [];

    setCampaignStats(stats);
  };

  const loadAccountStats = async () => {
    const { data, error } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    // Get today's email logs for each account
    const today = startOfDay(new Date());
    const { data: todayLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('provider, recipient')
      .gte('sent_at', today.toISOString())
      .eq('status', 'success');

    if (logsError) throw logsError;

    const stats = data?.map(account => {
      const todaySent = todayLogs?.filter(log =>
        log.provider === 'gmail' // We could enhance this to track specific accounts
      ).length || 0;

      return {
        email: account.email,
        current_count: account.current_count,
        daily_limit: account.daily_limit,
        usage_percentage: (account.current_count / account.daily_limit) * 100,
        status: account.status,
        total_sent_today: todaySent
      };
    }) || [];

    setAccountStats(stats);
  };

  const loadDailyStats = async () => {
    const days = [];
    for (let i = dateRange - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);

      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('status')
        .gte('sent_at', startDate.toISOString())
        .lte('sent_at', endDate.toISOString());

      if (error) throw error;

      const sent = logs?.filter(log => log.status === 'success').length || 0;
      const failed = logs?.filter(log => log.status === 'failed').length || 0;

      days.push({
        date: format(date, 'dd/MM', { locale: ptBR }),
        sent,
        failed,
        total: sent + failed
      });
    }

    setDailyStats(days);
  };

  const exportReport = async () => {
    try {
      // Simple CSV export
      const csvData = [
        ['Data', 'Campanhas', 'Emails Enviados', 'Emails Falhados', 'Taxa de Sucesso'],
        ...campaignStats.map(campaign => [
          format(parseISO(campaign.created_at), 'dd/MM/yyyy', { locale: ptBR }),
          campaign.name,
          campaign.sent_emails,
          campaign.failed_emails,
          `${campaign.success_rate.toFixed(1)}%`
        ])
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Relatório exportado",
        description: "O arquivo CSV foi baixado com sucesso.",
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar o relatório.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Ativa</Badge>;
      case 'paused':
        return <Badge variant="outline">Pausada</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-blue-500">Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'limit_reached':
        return <Badge variant="destructive">Limite Atingido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pieData = [
    { name: 'Enviados', value: emailStats.total_sent, color: '#10B981' },
    { name: 'Falharam', value: emailStats.total_failed, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Relatórios de Email</h2>
          <p className="text-muted-foreground">
            Análise detalhada dos disparos de email
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(parseInt(e.target.value))}
            className="h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <Button
            onClick={loadReports}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Emails Enviados</p>
                <p className="text-2xl font-bold">{emailStats.total_sent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Emails Falharam</p>
                <p className="text-2xl font-bold">{emailStats.total_failed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Taxa de Sucesso</p>
                <p className="text-2xl font-bold">{emailStats.success_rate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Média por Dia</p>
                <p className="text-2xl font-bold">{Math.round(emailStats.avg_per_day)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Stats Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Disparos por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sent" stackId="a" fill="#10B981" name="Enviados" />
                <Bar dataKey="failed" stackId="a" fill="#EF4444" name="Falharam" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Success Rate Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance das Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaignStats.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{campaign.name}</h4>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {campaign.total_emails} total
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {campaign.sent_emails} enviados
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {campaign.failed_emails} falharam
                    </span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-medium">
                    {campaign.success_rate.toFixed(1)}% sucesso
                  </div>
                  <Progress
                    value={campaign.success_rate}
                    className="w-24"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gmail Accounts Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Contas Gmail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accountStats.map((account, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="font-medium">{account.email}</span>
                    {getStatusBadge(account.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {account.current_count} / {account.daily_limit} emails hoje
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-medium">
                    {account.usage_percentage.toFixed(1)}% usado
                  </div>
                  <Progress
                    value={account.usage_percentage}
                    className="w-24"
                  />
                </div>
              </div>
            ))}

            {accountStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conta Gmail configurada</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}