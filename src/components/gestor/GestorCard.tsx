import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLeads } from "@/context/LeadsContext";
import { LeadPainel } from "@/components/leads/LeadPainel";
import { Brain, CheckCircle2, Circle, ListChecks, Loader2, RefreshCw, Settings2 } from "lucide-react";
import {
  calcularMes,
  chaveData,
  desempenhoPorDiaSemana,
  diasPassados,
  leadsParados,
  mesDe,
  NOMES,
  ofertaAtiva,
  type LigacaoSimples,
  type Metas,
  type RegistroDia,
  type ResultadoMetrica,
} from "@/lib/gestor/metricas";
import { gerarInsights, gerarPlanoHoje, type Insight } from "@/lib/gestor/insights";
import { carregarLigacoes, carregarMetas, carregarPlano, carregarRegistros, leadsParaGestor, lerLimitesParado, salvarPlano } from "@/lib/gestor/dados";

interface Props {
  onNavigate?: (modulo: string) => void;
}

const STATUS: Record<ResultadoMetrica["status"], { nome: string; cor: string }> = {
  batida: { nome: "Batida", cor: "text-success bg-success/10" },
  no_ritmo: { nome: "No ritmo", cor: "text-success bg-success/10" },
  atencao: { nome: "Atenção", cor: "text-warning bg-warning/10" },
  fora: { nome: "Fora", cor: "text-destructive bg-destructive/10" },
  sem_meta: { nome: "Sem meta", cor: "text-muted-foreground bg-muted" },
};
const PRIORIDADE = { alta: "bg-destructive", media: "bg-warning", baixa: "bg-primary" } as const;
const ORDEM: ResultadoMetrica["id"][] = ["interacoes", "negociacoes", "visitas", "documentacoes", "vendas_qtd", "vendas_valor", "leads", "ligacoes"];

const fmt = (id: ResultadoMetrica["id"], v: number) =>
  id === "vendas_valor" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : Math.round(v).toLocaleString("pt-BR");
const fmtDia = (id: ResultadoMetrica["id"], v: number) =>
  id === "vendas_valor" ? fmt(id, v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const abrirRegistroDoDia = (dia?: string) => window.dispatchEvent(new CustomEvent("inmovya:registrar-dia", { detail: { dia } }));

export function GestorCard({ onNavigate }: Props) {
  const { leads } = useLeads();
  const [mes, setMes] = useState(mesDe(new Date()));
  const [metas, setMetas] = useState<Metas | null>(null);
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [ligacoes, setLigacoes] = useState<LigacaoSimples[]>([]);
  const [feitos, setFeitos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [leadAberto, setLeadAberto] = useState<string | null>(null);

  const hoje = useMemo(() => new Date(), [registros]); // eslint-disable-line react-hooks/exhaustive-deps
  const diaHoje = chaveData(new Date());
  const mesAtual = mes === mesDe(new Date());
  // mês passado: avalia como se fosse o último dia do mês
  const referencia = useMemo(() => {
    if (mesAtual) return hoje;
    const [a, m] = mes.split("-").map(Number);
    return new Date(a, m, 1, 0, 0, 1);
  }, [mes, mesAtual, hoje]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [a, m] = mes.split("-").map(Number);
      const desde = new Date(a, m - 2, 1); // mês anterior também (comparação da Oferta Ativa)
      const [mt, regs, ligs, fts] = await Promise.all([
        carregarMetas(mes),
        carregarRegistros(),
        carregarLigacoes(desde),
        carregarPlano(diaHoje).catch(() => [] as string[]),
      ]);
      setMetas(mt.existe ? mt.metas : null);
      setRegistros(regs);
      setLigacoes(ligs);
      setFeitos(fts);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [mes, diaHoje]);

  useEffect(() => {
    carregar();
    const recarregar = () => carregar();
    window.addEventListener("inmovya:registro-salvo", recarregar);
    return () => window.removeEventListener("inmovya:registro-salvo", recarregar);
  }, [carregar]);

  const calculo = useMemo(() => {
    if (!metas) return null;
    const [a, m] = mes.split("-").map(Number);
    const inicio = new Date(a, m - 1, 1);
    const fim = new Date(a, m, 1);
    const leadsNoMes = leads.filter((l) => l.created_at && new Date(l.created_at) >= inicio && new Date(l.created_at) < fim).length;
    const ligacoesNoMes = ligacoes.filter((l) => new Date(l.data) >= inicio && new Date(l.data) < fim).length;
    const r = calcularMes({ mes, hoje: referencia, metas, registros, leadsNoMes, ligacoesNoMes });
    const lg = leadsParaGestor(leads, referencia);
    const parados = leadsParados(lg, referencia, lerLimitesParado());
    // Oferta Ativa: últimos 7 dias x 7 dias antes
    const fimOA = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate() + 1);
    const iniOA = new Date(fimOA.getTime() - 7 * 86400000);
    const oferta = ofertaAtiva(ligacoes, iniOA, fimOA, new Date(iniOA.getTime() - 7 * 86400000));
    const comRegistro = new Set(registros.map((x) => x.data));
    const diasSemRegistro = diasPassados(mes, referencia, true).filter((d) => !comRegistro.has(d));
    const tresMeses = registros.filter((x) => x.data >= chaveData(new Date(a, m - 3, 1)) && x.data < chaveData(fim));
    const insights = gerarInsights({
      metricas: r.metricas,
      conversoes: r.conversoes,
      gargalo: r.gargalo,
      diasRestantes: r.dias.restantes,
      leads: lg,
      parados,
      semana: desempenhoPorDiaSemana(tresMeses),
      diasSemRegistro,
      oferta,
    });
    return { ...r, insights, plano: gerarPlanoHoje(r.metricas, insights), oferta };
  }, [metas, mes, registros, ligacoes, leads, referencia]);

  const registroHoje = registros.find((x) => x.data === diaHoje);
  const marcar = async (id: string) => {
    const novo = feitos.includes(id) ? feitos.filter((x) => x !== id) : [...feitos, id];
    setFeitos(novo);
    try {
      await salvarPlano(diaHoje, novo);
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const acao = (a: Insight["acoes"][number]) => {
    if (a.leadIds?.length) return setLeadAberto(a.leadIds[0]);
    if (a.link === "registrar") return abrirRegistroDoDia();
    if (a.link) onNavigate?.(a.link);
  };

  const metricas = calculo ? ORDEM.map((id) => calculo.metricas.find((x) => x.id === id)!).filter((x) => x.meta > 0) : [];
  const feitosNoPlano = calculo
    ? calculo.plano.filter((p) => feitos.includes(p.id) || (p.campo && p.alvo && registroHoje && (registroHoje[p.campo] || 0) >= p.alvo)).length
    : 0;

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Gestor do mês</h2>
            <p className="text-xs text-muted-foreground">
              {calculo
                ? `${calculo.dias.restantes} dia(s) ${metas?.so_dias_uteis ? "úteis " : ""}restantes · projeção pela sua média diária`
                : "Metas, ritmo e o que fazer hoje"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-8 w-[150px]" aria-label="Mês" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={carregar} disabled={carregando} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate?.("settings")} title="Metas do mês (Configurações)">
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {erro ? (
        <p className="text-sm text-warning">{erro}</p>
      ) : carregando && !calculo ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando…
        </div>
      ) : !metas ? (
        <div className="rounded-xl border border-dashed p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground">Sem metas para este mês. Defina (ou importe da planilha Spartanos) em Configurações.</span>
          <Button size="sm" onClick={() => onNavigate?.("settings")}>Definir metas</Button>
        </div>
      ) : (
        calculo && (
          <>
            {/* Progresso das metas */}
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {metricas.map((x) => {
                const st = STATUS[x.status];
                const w = Math.min(100, x.pctAtingido);
                const wp = Math.min(100, x.pctProjecao);
                return (
                  <div key={x.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold capitalize">{NOMES[x.id].nome}</span>
                      <span className="tabular-nums">
                        <b>{fmt(x.id, x.realizado)}</b>
                        <span className="text-muted-foreground"> / {fmt(x.id, x.meta)}</span>
                        <span className={`ml-2 text-[11px] font-bold rounded-full px-1.5 py-0.5 ${st.cor}`}>{st.nome}</span>
                      </span>
                    </div>
                    <div className="relative h-2.5 mt-1 rounded-full bg-muted overflow-hidden" title={`Projeção: ${fmt(x.id, x.projecao)} (${Math.round(x.pctProjecao)}%)`}>
                      <div className="absolute inset-y-0 left-0 bg-primary/25 rounded-full" style={{ width: `${wp}%` }} />
                      <div className={`absolute inset-y-0 left-0 rounded-full ${x.status === "fora" ? "bg-destructive" : x.status === "atencao" ? "bg-warning" : "bg-success"}`} style={{ width: `${w}%` }} />
                    </div>
                    {x.status !== "batida" && x.status !== "sem_meta" && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        Precisa {fmtDia(x.id, x.ritmoNecessario)}/dia · média {fmtDia(x.id, x.mediaDiaria)}/dia · projeção {fmt(x.id, x.projecao)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
              {/* Insights */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold">O que os números dizem</h3>
                {calculo.insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tudo no ritmo. Siga assim.</p>
                ) : (
                  calculo.insights.map((i) => (
                    <div key={i.id} className="rounded-xl border p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORIDADE[i.prioridade]}`} aria-label={`prioridade ${i.prioridade}`} />
                        <span className="text-sm font-semibold">{i.titulo}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{i.texto}</p>
                      {i.acoes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {i.acoes.map((a, k) => (
                            <Button key={k} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => acao(a)}>
                              {a.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Plano de hoje */}
              {mesAtual && (
                <div className="rounded-xl border p-3 h-fit">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-primary" /> Plano de hoje
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {feitosNoPlano}/{calculo.plano.length}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {calculo.plano.map((p) => {
                      const progresso = p.campo && registroHoje ? registroHoje[p.campo] || 0 : 0;
                      const auto = !!(p.campo && p.alvo && progresso >= p.alvo);
                      const ok = auto || feitos.includes(p.id);
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => !auto && marcar(p.id)} className="w-full flex items-start gap-2 text-left text-sm rounded-lg px-1.5 py-1 hover:bg-muted">
                            {ok ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                            <span className={`flex-1 ${ok ? "line-through text-muted-foreground" : ""}`}>
                              {p.texto}
                              {p.campo && p.alvo ? <span className="text-xs text-muted-foreground tabular-nums"> · {progresso}/{p.alvo}</span> : null}
                            </span>
                          </button>
                          {p.leadIds && p.leadIds.length > 0 && !ok && (
                            <div className="flex flex-wrap gap-1 pl-7 pb-1">
                              {p.leadIds.slice(0, 6).map((id) => (
                                <button key={id} type="button" className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted" onClick={() => setLeadAberto(id)}>
                                  {leads.find((l) => l.id === id)?.nome || "lead"}
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-2">Os números contam sozinhos pelo "Registrar o dia" de hoje.</p>
                </div>
              )}
            </div>
          </>
        )
      )}
      <LeadPainel leadId={leadAberto} onClose={() => setLeadAberto(null)} onAbrirFicha={(id) => { setLeadAberto(null); onNavigate?.("leads"); void id; }} />
    </section>
  );
}
