import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { BarChart3, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PowerBIFunnelProps {
  periodo: string;
  leadsCount: number;
  interacoesCount: number;
}

export function PowerBIFunnel({ periodo, leadsCount, interacoesCount }: PowerBIFunnelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [manualMetrics, setManualMetrics] = useState({
    visitas: 0,
    documentacao: 0,
    negociacao: 0,
    venda: 0,
    interacaoAjuste: 0
  });

  useEffect(() => {
    fetchMetricsFromDB();
  }, [periodo]);

  const fetchMetricsFromDB = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('powerbi_funnel_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('period', periodo)
        .maybeSingle();

      if (error) {
        console.error('Error fetching metrics:', error);
        return;
      }

      if (data) {
        setManualMetrics({
          visitas: data.visitas || 0,
          documentacao: data.documentacao || 0,
          negociacao: data.negociacao || 0,
          venda: data.venda || 0,
          interacaoAjuste: data.interacao_ajuste || 0
        });
      } else {
        setManualMetrics({ visitas: 0, documentacao: 0, negociacao: 0, venda: 0, interacaoAjuste: 0 });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Use upsert to insert or update based on user_id and period
      const { error } = await supabase
        .from('powerbi_funnel_metrics')
        .upsert({
          user_id: user.id,
          period: periodo,
          visitas: manualMetrics.visitas,
          documentacao: manualMetrics.documentacao,
          negociacao: manualMetrics.negociacao,
          venda: manualMetrics.venda,
          interacao_ajuste: manualMetrics.interacaoAjuste,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id, period'
        });

      if (error) throw error;

      toast({ title: 'Métricas salvas', description: 'Valores atualizados na nuvem para o período selecionado.' });
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const finalInteracoes = Math.max(0, interacoesCount + (Number(manualMetrics.interacaoAjuste) || 0));

  const data = [
    { name: 'Leads', valor: leadsCount, fill: '#3b82f6' },
    { name: 'Interações', valor: finalInteracoes, fill: '#8b5cf6' },
    { name: 'Visitas', valor: Number(manualMetrics.visitas) || 0, fill: '#f59e0b' },
    { name: 'Documentação', valor: Number(manualMetrics.documentacao) || 0, fill: '#10b981' },
    { name: 'Negociações', valor: Number(manualMetrics.negociacao) || 0, fill: '#ef4444' },
    { name: 'Vendas', valor: Number(manualMetrics.venda) || 0, fill: '#22c55e' },
  ];

  return (
    <Card className="shadow-card mt-6 border-blue-500/20 relative">
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}
      <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b">
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <BarChart3 className="w-5 h-5" />
          Funil de Vendas - Dashboard Power BI
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Inserção Manual de Dados</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2">Ajuste Interações (+/-)</Label>
                <Input type="number" value={manualMetrics.interacaoAjuste} onChange={e => setManualMetrics({...manualMetrics, interacaoAjuste: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2">Visitas</Label>
                <Input type="number" min="0" value={manualMetrics.visitas} onChange={e => setManualMetrics({...manualMetrics, visitas: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2">Documentação</Label>
                <Input type="number" min="0" value={manualMetrics.documentacao} onChange={e => setManualMetrics({...manualMetrics, documentacao: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2">Negociações</Label>
                <Input type="number" min="0" value={manualMetrics.negociacao} onChange={e => setManualMetrics({...manualMetrics, negociacao: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2">Vendas</Label>
                <Input type="number" min="0" value={manualMetrics.venda} onChange={e => setManualMetrics({...manualMetrics, venda: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || loading} className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
              {saving ? 'Salvando...' : 'Salvar Dados (Nuvem)'}
            </Button>

            <div className="text-xs text-muted-foreground mt-4 bg-muted/30 p-3 rounded-md">
              <span className="font-semibold">Info:</span> Leads e Interações (base) são calculados automaticamente pelo sistema de acordo com o período selecionado no topo da página.
            </div>
          </div>

          <div className="lg:col-span-2 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: 'currentColor' }} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={32}>
                  {data.map((entry, index) => (
                    <Cell key={"cell-" + index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
