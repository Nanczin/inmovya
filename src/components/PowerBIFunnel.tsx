import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useLeads } from '@/context/LeadsContext';
import { BarChart3, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PowerBIFunnelProps {
  periodo: string;
}

export function PowerBIFunnel({ periodo }: PowerBIFunnelProps) {
  const { leads } = useLeads();
  const { toast } = useToast();

  const storageKey = "powerbi_metrics_$periodo";

  const [manualMetrics, setManualMetrics] = useState({
    visitas: 0,
    documentacao: 0,
    negociacao: 0,
    venda: 0,
    interacaoAjuste: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setManualMetrics(JSON.parse(saved));
      } catch(e) {}
    } else {
      setManualMetrics({
        visitas: 0,
        documentacao: 0,
        negociacao: 0,
        venda: 0,
        interacaoAjuste: 0
      });
    }
  }, [periodo, storageKey]);

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(manualMetrics));
    toast({ title: 'Métricas salvas', description: 'Valores atualizados para o período: ' + periodo });
  };

  const filteredLeads = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    
    switch (periodo) {
      case 'hoje':
        startDate.setHours(0,0,0,0);
        break;
      case 'ontem':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0,0,0,0);
        const endDate = new Date(startDate);
        endDate.setHours(23,59,59,999);
        return leads.filter(l => new Date(l.created_at || '') >= startDate && new Date(l.created_at || '') <= endDate);
      case '7dias':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30dias':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90dias':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setFullYear(2000); // custom or all
    }
    
    return leads.filter(l => new Date(l.created_at || '') >= startDate);
  }, [leads, periodo]);

  const leadCount = filteredLeads.length;
  // Considera interacao automatica os leads que tiveram ultimo_contato ou estao em status de contato
  const interacaoAuto = filteredLeads.filter(l => l.ultimo_contato || ['em_contato', 'interessado', 'qualificado'].includes(l.status)).length;
  const interacaoCount = Math.max(0, interacaoAuto + (Number(manualMetrics.interacaoAjuste) || 0));

  const data = [
    { name: 'Leads', valor: leadCount, fill: '#3b82f6' },
    { name: 'Interações', valor: interacaoCount, fill: '#8b5cf6' },
    { name: 'Visitas', valor: Number(manualMetrics.visitas) || 0, fill: '#f59e0b' },
    { name: 'Documentação', valor: Number(manualMetrics.documentacao) || 0, fill: '#10b981' },
    { name: 'Negociações', valor: Number(manualMetrics.negociacao) || 0, fill: '#ef4444' },
    { name: 'Vendas', valor: Number(manualMetrics.venda) || 0, fill: '#22c55e' },
  ];

  return (
    <Card className="shadow-card mt-6 border-blue-500/20">
      <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b">
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <BarChart3 className="w-5 h-5" />
          Funil de Vendas - Dashboard Power BI ({periodo})
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

            <Button onClick={handleSave} className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Salvar Dados
            </Button>

            <div className="text-xs text-muted-foreground mt-4 bg-muted/30 p-3 rounded-md">
              <span className="font-semibold">Info:</span> Leads e Interações (base) são calculados automaticamente pelo sistema de acordo com o período selecionado.
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


