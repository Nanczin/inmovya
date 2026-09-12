import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface ManualFunnelMetrics {
  ligacoes: number;
  visitas: number;
  documentacao: number;
  negociacao: number;
  venda: number;
  interacaoAjuste: number;
}

interface PowerBIFunnelProps {
  leadsCount: number;
  ligacoesCount: number;
  interacoesCount: number;
  periodo: string;
  storagePeriod?: string;
  onMetricsChange?: (metrics: ManualFunnelMetrics) => void;
  onDailyMetricsChange?: (metrics: Record<string, ManualFunnelMetrics>) => void;
  rangeStart: string;
  rangeEnd: string;
}

const emptyMetrics = (): ManualFunnelMetrics => ({
  ligacoes: 0, visitas: 0, documentacao: 0, negociacao: 0, venda: 0, interacaoAjuste: 0
});

const localDateKey = (value: string | Date) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function PowerBIFunnel({ leadsCount, ligacoesCount, interacoesCount, periodo, onMetricsChange, onDailyMetricsChange, rangeStart, rangeEnd }: PowerBIFunnelProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [manualMetrics, setManualMetrics] = useState({
    ligacoes: 0,
    visitas: 0,
    documentacao: 0,
    negociacao: 0,
    venda: 0,
    interacaoAjuste: 0
  });
  const [loadedMetrics, setLoadedMetrics] = useState<ManualFunnelMetrics>(emptyMetrics());
  const [targetMetrics, setTargetMetrics] = useState<ManualFunnelMetrics>(emptyMetrics());
  const [dailyMetrics, setDailyMetrics] = useState<Record<string, ManualFunnelMetrics>>({});

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('powerbi_funnel_metrics')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        const startKey = localDateKey(rangeStart);
        const endKey = localDateKey(rangeEnd);
        const daily: Record<string, ManualFunnelMetrics> = {};
        let explicitTarget = emptyMetrics();
        (data || []).forEach(row => {
          const key = row.period?.startsWith('dia:') ? row.period.slice(4) : localDateKey(row.updated_at || row.created_at);
          if (key < startKey || key > endKey) return;
          const current = daily[key] || emptyMetrics();
          daily[key] = {
            ligacoes: current.ligacoes + (Number(row.ligacoes) || 0),
            visitas: current.visitas + (Number(row.visitas) || 0),
            documentacao: current.documentacao + (Number(row.documentacao) || 0),
            negociacao: current.negociacao + (Number(row.negociacao) || 0),
            venda: current.venda + (Number(row.venda) || 0),
            interacaoAjuste: current.interacaoAjuste + (Number(row.interacao_ajuste) || 0)
          };
          if (row.period === `dia:${endKey}`) {
            explicitTarget = {
              ligacoes: Number(row.ligacoes) || 0,
              visitas: Number(row.visitas) || 0,
              documentacao: Number(row.documentacao) || 0,
              negociacao: Number(row.negociacao) || 0,
              venda: Number(row.venda) || 0,
              interacaoAjuste: Number(row.interacao_ajuste) || 0
            };
          }
        });
        const aggregate = Object.values(daily).reduce<ManualFunnelMetrics>((total, item) => ({
          ligacoes: total.ligacoes + item.ligacoes,
          visitas: total.visitas + item.visitas,
          documentacao: total.documentacao + item.documentacao,
          negociacao: total.negociacao + item.negociacao,
          venda: total.venda + item.venda,
          interacaoAjuste: total.interacaoAjuste + item.interacaoAjuste
        }), emptyMetrics());
        setManualMetrics(aggregate);
        setLoadedMetrics(aggregate);
        setTargetMetrics(explicitTarget);
        setDailyMetrics(daily);
        onDailyMetricsChange?.(daily);
      } catch (error) {
        console.error('Error fetching powerbi metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [periodo, rangeStart, rangeEnd, onDailyMetricsChange]);

  useEffect(() => {
    onMetricsChange?.(manualMetrics);
  }, [manualMetrics, onMetricsChange]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const targetKey = localDateKey(rangeEnd);
      const savedMetrics = {
        ligacoes: Math.max(0, targetMetrics.ligacoes + manualMetrics.ligacoes - loadedMetrics.ligacoes),
        visitas: Math.max(0, targetMetrics.visitas + manualMetrics.visitas - loadedMetrics.visitas),
        documentacao: Math.max(0, targetMetrics.documentacao + manualMetrics.documentacao - loadedMetrics.documentacao),
        negociacao: Math.max(0, targetMetrics.negociacao + manualMetrics.negociacao - loadedMetrics.negociacao),
        venda: Math.max(0, targetMetrics.venda + manualMetrics.venda - loadedMetrics.venda),
        interacaoAjuste: targetMetrics.interacaoAjuste + manualMetrics.interacaoAjuste - loadedMetrics.interacaoAjuste
      };
      const { error } = await supabase
        .from('powerbi_funnel_metrics')
        .upsert({
          user_id: user.id,
          period: `dia:${targetKey}`,
          ligacoes: savedMetrics.ligacoes,
          visitas: savedMetrics.visitas,
          documentacao: savedMetrics.documentacao,
          negociacao: savedMetrics.negociacao,
          venda: savedMetrics.venda,
          interacao_ajuste: savedMetrics.interacaoAjuste,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, period' });

      if (error) throw error;
      setLoadedMetrics(manualMetrics);
      setTargetMetrics(savedMetrics);
      const nextDailyMetrics = {
        ...dailyMetrics,
        [targetKey]: {
          ...(dailyMetrics[targetKey] || emptyMetrics()),
          ligacoes: (dailyMetrics[targetKey]?.ligacoes || 0) + manualMetrics.ligacoes - loadedMetrics.ligacoes,
          visitas: (dailyMetrics[targetKey]?.visitas || 0) + manualMetrics.visitas - loadedMetrics.visitas,
          documentacao: (dailyMetrics[targetKey]?.documentacao || 0) + manualMetrics.documentacao - loadedMetrics.documentacao,
          negociacao: (dailyMetrics[targetKey]?.negociacao || 0) + manualMetrics.negociacao - loadedMetrics.negociacao,
          venda: (dailyMetrics[targetKey]?.venda || 0) + manualMetrics.venda - loadedMetrics.venda,
          interacaoAjuste: (dailyMetrics[targetKey]?.interacaoAjuste || 0) + manualMetrics.interacaoAjuste - loadedMetrics.interacaoAjuste
        }
      };
      setDailyMetrics(nextDailyMetrics);
      onDailyMetricsChange?.(nextDailyMetrics);

      toast({
        title: "Salvo com sucesso",
        description: "As métricas foram atualizadas para o período selecionado.",
      });
    } catch (error) {
      console.error('Error saving metrics:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as métricas.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const finalInteracoes = Math.max(0, interacoesCount + (Number(manualMetrics.interacaoAjuste) || 0));
  const finalLigacoes = Math.max(0, ligacoesCount + (Number(manualMetrics.ligacoes) || 0));

  const data = [
    { name: 'Leads', valor: leadsCount, fill: '#3b82f6' },
    { name: 'Interações', valor: finalInteracoes, fill: '#8b5cf6' },
    { name: 'Ligações', valor: finalLigacoes, fill: '#06b6d4' },
    { name: 'Visitas', valor: Number(manualMetrics.visitas) || 0, fill: '#f59e0b' },
    { name: 'Documentação', valor: Number(manualMetrics.documentacao) || 0, fill: '#10b981' },
    { name: 'Negociações', valor: Number(manualMetrics.negociacao) || 0, fill: '#ef4444' },
    { name: 'Vendas', valor: Number(manualMetrics.venda) || 0, fill: '#22c55e' },
  ];

  return (
    <Card className="col-span-full shadow-card mt-6 relative border-blue-500/20">
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center justify-between text-blue-600">
          <span>Métricas Nine Box</span>
          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar Métricas'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
            <h4 className="font-semibold text-sm mb-4">Ajustes Manuais ({periodo})</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2 text-xs">Interações (Ajuste)</Label>
                <Input type="number" value={manualMetrics.interacaoAjuste} onChange={e => setManualMetrics({...manualMetrics, interacaoAjuste: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2 text-xs">Ligações</Label>
                <Input type="number" min="0" value={manualMetrics.ligacoes} onChange={e => setManualMetrics({...manualMetrics, ligacoes: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2 text-xs">Visitas</Label>
                <Input type="number" min="0" value={manualMetrics.visitas} onChange={e => setManualMetrics({...manualMetrics, visitas: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2 text-xs">Documentação</Label>
                <Input type="number" min="0" value={manualMetrics.documentacao} onChange={e => setManualMetrics({...manualMetrics, documentacao: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2 text-xs">Negociações</Label>
                <Input type="number" min="0" value={manualMetrics.negociacao} onChange={e => setManualMetrics({...manualMetrics, negociacao: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="w-1/2 text-xs">Vendas</Label>
                <Input type="number" min="0" value={manualMetrics.venda} onChange={e => setManualMetrics({...manualMetrics, venda: parseInt(e.target.value) || 0})} className="w-1/2" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              * Leads e Interações base são calculados automaticamente para este período.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
