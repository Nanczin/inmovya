import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Minus, Plus, PenLine, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { carregarMetas } from "@/components/arena/DefinirMetasDialog";
import type { Metas } from "@/components/ArenaModule";
import { lerReais, reais, salvarVgvDoDia, somarVgv, vendasProporcionais, vgvDoMes, vgvPorDiaDe, type VgvPorDia } from "@/lib/vgv";

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
  semana?: number[]; // dias da semana do filtro de cima (0 = domingo)
  abrirAoCarregar?: boolean; // link direto /relatorios?registrar=1 (ex.: vindo da Agenda)
}
const diaDaSemana = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

export function RegistrosComerciais({ inicio, fim, inicioAnt, fimAnt, corAtual, corVerde, semana = [0, 1, 2, 3, 4, 5, 6], abrirAoCarregar = false }: Props) {
  const { toast } = useToast();
  const [porDia, setPorDia] = useState<Record<string, Valores>>({});
  const [linhaDoDia, setLinhaDoDia] = useState<Record<string, any>>({});
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState(chave(new Date()));
  const [form, setForm] = useState<Valores>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [vgvPorDia, setVgvPorDia] = useState<VgvPorDia>({});
  const [metas, setMetas] = useState<Metas | null>(null);
  const [vgvTexto, setVgvTexto] = useState("");

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
    const mt = await carregarMetas();
    setMetas(mt);
    setVgvPorDia(vgvPorDiaDe(mt));
    setCarregou(true);
  }, []);
  const [carregou, setCarregou] = useState(false);
  const secaoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const somar = (a: Date, b: Date) => {
    const t = vazio();
    const ka = chave(a);
    const kb = chave(new Date(b.getTime() - 1));
    Object.entries(porDia).forEach(([k, v]) => {
      if (k < ka || k > kb || !semana.includes(diaDaSemana(k))) return;
      CAMPOS.forEach((c) => (t[c.id] += v[c.id]));
    });
    return t;
  };
  const atual = useMemo(() => somar(inicio, fim), [porDia, inicio, fim, semana]);
  const anterior = useMemo(() => somar(inicioAnt, fimAnt), [porDia, inicioAnt, fimAnt, semana]);
  const vgvFiltrado = useMemo(() => Object.fromEntries(Object.entries(vgvPorDia).filter(([k]) => semana.includes(diaDaSemana(k)))), [vgvPorDia, semana]);
  const vgvAtual = useMemo(() => somarVgv(vgvFiltrado, chave(inicio), chave(new Date(fim.getTime() - 1))), [vgvFiltrado, inicio, fim]);
  const vgvAnterior = useMemo(() => somarVgv(vgvFiltrado, chave(inicioAnt), chave(new Date(fimAnt.getTime() - 1))), [vgvFiltrado, inicioAnt, fimAnt]);
  // meta do mês corrente, proporcional ao VGV
  const mesAtual = chave(new Date()).slice(0, 7);
  const vgvMes = vgvDoMes(vgvPorDia, mesAtual);
  const vendasPorVgv = metas ? vendasProporcionais(vgvMes, metas) : null;

  const abrir = (k = chave(new Date())) => {
    setDia(k);
    carregarDia(k);
    setAberto(true);
  };

  // Métricas dia a dia: todos os dias do período, inclusive sábado e domingo
  const [verTodosDias, setVerTodosDias] = useState(true);
  const DIARIO: Campo[] = ["interacoes", "documentacoes", "visitas", "negociacoes"];
  const faixa = useMemo(() => ({ a: inicio, b: fim }), [inicio, fim]);
  const dias = useMemo(() => {
    const lista: { k: string; d: Date; v: Valores }[] = [];
    const hoje = chave(new Date());
    for (let d = new Date(faixa.a.getFullYear(), faixa.a.getMonth(), faixa.a.getDate()); d < faixa.b; d.setDate(d.getDate() + 1)) {
      const k = chave(d);
      if (k > hoje) break;
      if (!semana.includes(d.getDay())) continue;
      const v = porDia[k] || vazio();
      lista.push({ k, d: new Date(d), v });
    }
    return lista.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porDia, faixa, semana]);
  const diasUteis = dias.length;
  const totalDias = useMemo(() => {
    const t = vazio();
    dias.forEach(({ v }) => DIARIO.forEach((c) => (t[c] += v[c])));
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);
  const maxDia = useMemo(() => {
    const m = vazio();
    dias.forEach(({ v }) => DIARIO.forEach((c) => (m[c] = Math.max(m[c], v[c]))));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);
  const diasVisiveis = verTodosDias ? dias : dias.slice(0, 10);
  const nomeDia = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  // link direto (Agenda → Relatórios → Registrar): rola até aqui e abre o Registrar de hoje
  const abriuDireto = useRef(false);
  useEffect(() => {
    if (!abrirAoCarregar || !carregou || abriuDireto.current) return;
    abriuDireto.current = true;
    secaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirAoCarregar, carregou]);

  const carregarDia = (k: string) => {
    const row = linhaDoDia[k];
    const v = vazio();
    if (row) CAMPOS.forEach((c) => (v[c.id] = Number(row[c.coluna]) || 0));
    setForm(v);
    setVgvTexto(vgvPorDia[k] ? vgvPorDia[k].toLocaleString("pt-BR") : "");
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
      const vgv = lerReais(vgvTexto);
      if (vgv !== (vgvPorDia[dia] || 0)) await salvarVgvDoDia(dia, form.vendas > 0 ? vgv : 0);
      toast({
        title: "Registro salvo",
        description: `Dia ${dia.split("-").reverse().join("/")}${form.vendas > 0 && vgv > 0 ? ` · VGV ${reais(vgv)}` : ""}`,
      });
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
    <section ref={secaoRef} className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card scroll-mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold leading-tight">Atendimento até a venda</h3>
          <p className="text-xs text-muted-foreground mt-0.5">O que você registrou no período e quanto de uma etapa passou para a próxima</p>
        </div>
        <Button onClick={() => abrir()} className="h-9">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-3">
          <div className="text-xs font-semibold text-muted-foreground">VGV vendido no período</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <b className="text-xl tabular-nums">{reais(vgvAtual)}</b>
            {vgvAnterior > 0 && vgvAtual !== vgvAnterior && (
              <span className={`inline-flex items-center text-xs font-bold ${vgvAtual > vgvAnterior ? "text-success" : "text-destructive"}`} title={`Período anterior: ${reais(vgvAnterior)}`}>
                {vgvAtual > vgvAnterior ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {Math.abs(Math.round(((vgvAtual - vgvAnterior) / vgvAnterior) * 100))}%
              </span>
            )}
          </div>
          {atual.vendas > 0 && <div className="text-xs text-muted-foreground mt-0.5">ticket médio {reais(vgvAtual / atual.vendas)}</div>}
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs font-semibold text-muted-foreground">Meta de vendas do mês {vendasPorVgv !== null ? "(pelo VGV)" : ""}</div>
          {metas && vendasPorVgv !== null ? (
            <>
              <div className="flex items-baseline gap-1 mt-0.5">
                <b className="text-xl tabular-nums">{vendasPorVgv.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</b>
                <span className="text-muted-foreground">/ {metas.mesVendas} vendas</span>
              </div>
              <div className="h-2 mt-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (vgvMes / Math.max(1, metas.mesVgv)) * 100)}%`, background: corVerde }} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {reais(vgvMes)} de {reais(metas.mesVgv)} · cada {reais(metas.mesVgv / Math.max(1, metas.mesVendas))} = 1 venda
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">
              Defina a meta de <b className="text-foreground">VGV do mês</b> em “Definir metas” (Arena ou Ligações) para a meta de vendas andar pelo valor vendido.
            </div>
          )}
        </div>
      </div>

      {/* Por dia */}
      <div className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
          <div>
            <h4 className="font-bold text-sm leading-tight">Por dia</h4>
            <p className="text-xs text-muted-foreground">Todos os dias do período, inclusive sábado e domingo. Clique em um dia para registrar ou corrigir.</p>
          </div>
        </div>
        {dias.length === 0 ? (
          <div className="text-sm text-muted-foreground rounded-xl border p-4 text-center">Nenhum dia com esse filtro.</div>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[460px]">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left font-semibold px-3 py-2">Dia</th>
                  {DIARIO.map((c) => (
                    <th key={c} className="text-right font-semibold px-3 py-2">
                      {CAMPOS.find((x) => x.id === c)!.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diasVisiveis.map(({ k, d, v }) => {
                  const vazioDia = !DIARIO.some((c) => v[c] > 0);
                  return (
                    <tr key={k} className={`border-t hover:bg-muted/40 cursor-pointer ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/25" : ""}`} onClick={() => abrir(k)} title="Clique para registrar ou corrigir este dia">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        <span className="capitalize">{nomeDia(d)}</span>
                        {k === chave(new Date()) && <span className="ml-1.5 text-[10px] font-bold text-primary">hoje</span>}
                        {vazioDia && <span className="ml-1.5 text-[10px] text-muted-foreground">sem registro</span>}
                      </td>
                      {DIARIO.map((c) => {
                        const n = v[c];
                        const pct = maxDia[c] > 0 ? (n / maxDia[c]) * 100 : 0;
                        return (
                          <td key={c} className="px-3 py-2 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden sm:block w-14 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: corAtual }} />
                              </div>
                              <span className={n ? "font-bold" : "text-muted-foreground"}>{n}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 text-xs">
                  <td className="px-3 py-2 font-semibold">Total · média/dia</td>
                  {DIARIO.map((c) => (
                    <td key={c} className="px-3 py-2 text-right tabular-nums">
                      <b className="text-sm">{totalDias[c]}</b>
                      <span className="text-muted-foreground"> · {(totalDias[c] / Math.max(1, diasUteis)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {dias.length > 10 && (
          <Button variant="ghost" size="sm" className="mt-1.5 h-8" onClick={() => setVerTodosDias((x) => !x)}>
            {verTodosDias ? "Mostrar só os últimos 10 dias" : `Ver todos os ${dias.length} dias`}
          </Button>
        )}
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
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">VGV das vendas deste dia (R$)</span>
            <Input
              inputMode="decimal"
              placeholder={form.vendas > 0 ? "ex.: 850.000 ou 1,2 mi" : "registre a venda acima para informar o VGV"}
              disabled={form.vendas === 0}
              value={vgvTexto}
              onChange={(e) => setVgvTexto(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.vendas > 0 && lerReais(vgvTexto) > 0
                ? `= ${reais(lerReais(vgvTexto))}${metas && metas.mesVgv > 0 ? ` · conta ${(vendasProporcionais(lerReais(vgvTexto), metas) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} na meta de vendas` : ""}`
                : "Soma de todas as vendas do dia."}
            </span>
          </label>
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
