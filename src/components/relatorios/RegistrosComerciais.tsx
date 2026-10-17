import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Minus, Plus, PenLine, ArrowDownRight, ArrowUpRight } from "lucide-react";

// Registros feitos à mão no dia a dia (ficam na tabela powerbi_funnel_metrics, uma linha por dia: "dia:AAAA-MM-DD")
type Campo = "interacoes" | "negociacoes" | "visitas" | "documentacoes" | "vendas";
const CAMPOS: { id: Campo; nome: string; coluna: string }[] = [
  { id: "interacoes", nome: "Interações", coluna: "interacao_ajuste" },
  { id: "negociacoes", nome: "Negociações", coluna: "negociacao" },
  { id: "visitas", nome: "Visitas", coluna: "visitas" },
  { id: "documentacoes", nome: "Documentações", coluna: "documentacao" },
  { id: "vendas", nome: "Vendas", coluna: "venda" },
];
type Valores = Record<Campo, number>;
const vazio = (): Valores => ({ interacoes: 0, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0 });

const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Props {
  inicio: Date;
  fim: Date; // exclusivo
  inicioAnt: Date;
  fimAnt: Date;
  corAtual: string;
  corVerde: string;
}

export function RegistrosComerciais({ inicio, fim, inicioAnt, fimAnt, corAtual, corVerde }: Props) {
  const { toast } = useToast();
  const [porDia, setPorDia] = useState<Record<string, Valores>>({});
  const [linhaDoDia, setLinhaDoDia] = useState<Record<string, any>>({});
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState(chave(new Date()));
  const [form, setForm] = useState<Valores>(vazio());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("powerbi_funnel_metrics").select("*").eq("user_id", user.id);
    if (error) return;
    const m: Record<string, Valores> = {};
    const linhas: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      if (String(row.period || "").startsWith("interacao_efetiva:")) return; // ajuste antigo, fora da conta
      const k = String(row.period || "").startsWith("dia:") ? row.period.slice(4) : chave(new Date(row.updated_at || row.created_at));
      const atual = m[k] || vazio();
      CAMPOS.forEach((c) => (atual[c.id] += Number(row[c.coluna]) || 0));
      m[k] = atual;
      if (String(row.period || "").startsWith("dia:")) linhas[k] = row;
    });
    setPorDia(m);
    setLinhaDoDia(linhas);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const somar = (a: Date, b: Date) => {
    const t = vazio();
    const ka = chave(a);
    const kb = chave(new Date(b.getTime() - 1));
    Object.entries(porDia).forEach(([k, v]) => {
      if (k < ka || k > kb) return;
      CAMPOS.forEach((c) => (t[c.id] += v[c.id]));
    });
    return t;
  };
  const atual = useMemo(() => somar(inicio, fim), [porDia, inicio, fim]);
  const anterior = useMemo(() => somar(inicioAnt, fimAnt), [porDia, inicioAnt, fimAnt]);

  const abrir = () => {
    const hoje = chave(new Date());
    setDia(hoje);
    carregarDia(hoje);
    setAberto(true);
  };
  const carregarDia = (k: string) => {
    const row = linhaDoDia[k];
    const v = vazio();
    if (row) CAMPOS.forEach((c) => (v[c.id] = Number(row[c.coluna]) || 0));
    setForm(v);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login de novo.");
      const existente = linhaDoDia[dia];
      const { error } = await supabase.from("powerbi_funnel_metrics").upsert(
        {
          user_id: user.id,
          period: `dia:${dia}`,
          ligacoes: Number(existente?.ligacoes) || 0,
          interacao_ajuste: form.interacoes,
          negociacao: form.negociacoes,
          visitas: form.visitas,
          documentacao: form.documentacoes,
          venda: form.vendas,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id, period" }
      );
      if (error) throw error;
      toast({ title: "Registro salvo", description: `Dia ${dia.split("-").reverse().join("/")}` });
      setAberto(false);
      await carregar();
    } catch (e: any) {
      toast({ title: "Não consegui salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const max = Math.max(1, ...CAMPOS.map((c) => atual[c.id]));

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold leading-tight">Atendimento até a venda</h3>
          <p className="text-xs text-muted-foreground mt-0.5">O que você registrou no período e quanto de uma etapa passou para a próxima</p>
        </div>
        <Button onClick={abrir} className="h-9">
          <PenLine className="w-4 h-4 mr-1.5" /> Registrar
        </Button>
      </div>

      <div className="space-y-2.5">
        {CAMPOS.map((c, i) => {
          const v = atual[c.id];
          const antes = anterior[c.id];
          const prev = i > 0 ? atual[CAMPOS[i - 1].id] : 0;
          const conv = i > 0 && prev > 0 ? Math.round((v / prev) * 100) : null;
          const diff = antes > 0 ? Math.round(((v - antes) / antes) * 100) : null;
          return (
            <div key={c.id} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
              <span className="font-semibold">{c.nome}</span>
              <div className="h-6 rounded-md bg-muted overflow-hidden">
                <div className="h-full rounded-md" style={{ width: `${(v / max) * 100}%`, minWidth: v ? 6 : 0, background: c.id === "vendas" ? corVerde : corAtual }} />
              </div>
              <span className="tabular-nums text-right w-[150px] sm:w-[190px] flex items-center justify-end gap-2">
                <b className="text-base">{v}</b>
                {conv !== null && <span className="text-xs text-muted-foreground">{conv}% da anterior</span>}
                {diff !== null && diff !== 0 && (
                  <span className={`inline-flex items-center text-xs font-bold ${diff > 0 ? "text-success" : "text-destructive"}`} title={`Período anterior: ${antes}`}>
                    {diff > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(diff)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Registrar o dia</DialogTitle>
            <DialogDescription>Quantas você fez neste dia. Salvar de novo o mesmo dia substitui os números.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label className="text-sm font-semibold">Dia</label>
            <Input
              type="date"
              value={dia}
              max={chave(new Date())}
              onChange={(e) => {
                setDia(e.target.value);
                carregarDia(e.target.value);
              }}
            />
          </div>
          <div className="divide-y">
            {CAMPOS.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-semibold">{c.nome}</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={`Menos ${c.nome}`}
                    onClick={() => setForm((f) => ({ ...f, [c.id]: Math.max(0, f[c.id] - 1) }))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="h-9 w-16 text-center font-bold tabular-nums"
                    value={form[c.id]}
                    onChange={(e) => setForm((f) => ({ ...f, [c.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    aria-label={c.nome}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={`Mais ${c.nome}`}
                    onClick={() => setForm((f) => ({ ...f, [c.id]: f[c.id] + 1 }))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
