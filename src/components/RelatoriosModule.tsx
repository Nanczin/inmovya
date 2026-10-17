import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/context/LeadsContext";
import { RegistrosComerciais } from "@/components/relatorios/RegistrosComerciais";
import { getFunilTier, getStageForStatus, normalizeStatus, PERDIDO_STAGE_ID } from "@/lib/negociosStages";

// ---------- período ----------
type PeriodoId = "7" | "30" | "mes";
const PERIODOS: { id: PeriodoId; nome: string }[] = [
  { id: "7", nome: "7 dias" },
  { id: "30", nome: "30 dias" },
  { id: "mes", nome: "Este mês" },
];

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Janela atual e a anterior com o MESMO número de dias (comparação justa). */
function janelas(p: PeriodoId) {
  const hoje = inicioDoDia(new Date());
  const fim = somarDias(hoje, 1); // exclusivo
  const inicio = p === "mes" ? new Date(hoje.getFullYear(), hoje.getMonth(), 1) : somarDias(hoje, -(Number(p) - 1));
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
  const inicioAnt = somarDias(inicio, -dias);
  return { inicio, fim, inicioAnt, fimAnt: inicio, dias };
}

const dentro = (iso: string | undefined | null, a: Date, b: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= a.getTime() && t < b.getTime();
};

// ---------- cores do tema (o gráfico lê as variáveis do CSS) ----------
function lerCores() {
  const st = getComputedStyle(document.documentElement);
  const v = (n: string) => `hsl(${st.getPropertyValue(n).trim()})`;
  return {
    atual: v("--chart-1"),
    anterior: v("--chart-muted"),
    verde: v("--chart-2"),
    texto: v("--muted-foreground"),
    tinta: v("--foreground"),
    grade: v("--border"),
    fundo: v("--card"),
  };
}
function useCores() {
  const { resolvedTheme } = useTheme();
  const [cores, setCores] = useState(lerCores);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCores(lerCores()));
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);
  return cores;
}

// ---------- peças ----------
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })}%`;

function Variacao({ atual, anterior, pontos = false }: { atual: number; anterior: number; pontos?: boolean }) {
  // pontos = diferença em pontos percentuais (para taxas)
  const diff = pontos ? atual - anterior : anterior > 0 ? ((atual - anterior) / anterior) * 100 : atual > 0 ? 100 : 0;
  const igual = Math.abs(diff) < 0.5;
  const Icone = igual ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  const cor = igual ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-destructive";
  const texto = pontos
    ? `${diff > 0 ? "+" : ""}${diff.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
    : anterior === 0 && atual > 0
    ? "novo"
    : `${diff > 0 ? "+" : ""}${Math.round(diff)}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${cor}`}>
      <Icone className="w-3.5 h-3.5" /> {igual ? "igual" : texto}
    </span>
  );
}

function Indicador({ titulo, valor, sufixo, atual, anterior, pontos, detalhe }: { titulo: string; valor: string; sufixo?: string; atual: number; anterior: number; pontos?: boolean; detalhe?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="text-sm text-muted-foreground font-medium">{titulo}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight tabular-nums">{valor}</span>
        {sufixo && <span className="text-sm text-muted-foreground">{sufixo}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <Variacao atual={atual} anterior={anterior} pontos={pontos} />
        <span>vs período anterior{detalhe ? ` · ${detalhe}` : ""}</span>
      </div>
    </div>
  );
}

function Painel({ titulo, subtitulo, children, tabela }: { titulo: string; subtitulo?: string; children: React.ReactNode; tabela?: React.ReactNode }) {
  const [verTabela, setVerTabela] = useState(false);
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold leading-tight">{titulo}</h3>
          {subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>}
        </div>
        {tabela && (
          <button
            type="button"
            onClick={() => setVerTabela((v) => !v)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            title={verTabela ? "Ver gráfico" : "Ver tabela"}
            aria-label={verTabela ? "Ver gráfico" : "Ver tabela"}
          >
            {verTabela ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
          </button>
        )}
      </div>
      {verTabela ? tabela : children}
    </section>
  );
}

function Legenda({ itens }: { itens: { nome: string; cor: string; tipo?: "barra" | "linha" }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-2">
      {itens.map((i) => (
        <span key={i.nome} className="inline-flex items-center gap-1.5">
          {i.tipo === "linha" ? (
            <span className="w-4 h-0.5 rounded-full" style={{ background: i.cor }} />
          ) : (
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.cor }} />
          )}
          {i.nome}
        </span>
      ))}
    </div>
  );
}

function DicaGrafico({ active, payload, label, formatar }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-elegant text-xs">
      <div className="font-semibold mb-1">{formatar ? formatar(label, payload) : label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color || p.stroke || p.fill }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const TabelaSimples = ({ colunas, linhas }: { colunas: string[]; linhas: (string | number)[][] }) => (
  <div className="overflow-x-auto max-h-72">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground border-b">
          {colunas.map((c) => (
            <th key={c} className="py-1.5 pr-3 font-semibold">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i} className="border-b last:border-0">
            {l.map((v, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j > 0 ? "tabular-nums" : ""}`}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type Ligacao = { data_ligacao: string; status: string | null; resultado: string | null };

async function todasAsPaginas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// nomes curtos para os resultados da Oferta Ativa
const nomeResultado = (r: string) => {
  const n = normalizeStatus(r);
  if (n.includes("caixa postal") || n.includes("nao atendeu")) return "Não atendeu / caixa postal";
  if (n.includes("interessado") && !n.includes("nao")) return "Interessado";
  if (n.includes("sem interesse") || n.includes("nao interessado") || n.includes("nao tem interesse")) return "Sem interesse";
  if (n.includes("numero") && (n.includes("errado") || n.includes("invalido") || n.includes("inexistente"))) return "Número errado";
  if (!n || n === "processado") return "Sem classificação";
  return r.length > 28 ? `${r.slice(0, 27)}…` : r;
};

export function RelatoriosModule() {
  const { leads } = useLeads();
  const cores = useCores();
  const [periodo, setPeriodo] = useState<PeriodoId>(() => {
    try {
      return (localStorage.getItem("inmovya_relatorio_periodo") as PeriodoId) || "30";
    } catch {
      return "30";
    }
  });
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const j = useMemo(() => janelas(periodo), [periodo]);

  const escolher = (p: PeriodoId) => {
    setPeriodo(p);
    try {
      localStorage.setItem("inmovya_relatorio_periodo", p);
    } catch {
      /* ignore */
    }
  };

  // Ligações guardadas por 60 dias (o histórico mais antigo é apagado para não ocupar o banco)
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const corte = somarDias(inicioDoDia(new Date()), -60).toISOString();
      await Promise.all([
        supabase.from("ligacoes").delete().eq("user_id", user.id).lt("data_ligacao", corte),
        supabase.from("email_logs").delete().eq("user_id", user.id).lt("sent_at", corte),
      ]).catch(() => {});
    })();
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const dados = await todasAsPaginas<Ligacao>((de, ate) =>
          supabase
            .from("ligacoes")
            .select("data_ligacao, status, resultado")
            .eq("user_id", user.id)
            .gte("data_ligacao", j.inicioAnt.toISOString())
            .lt("data_ligacao", j.fim.toISOString())
            .range(de, ate) as any
        );
        if (vivo) setLigacoes(dados);
      } catch (e) {
        console.error("Relatórios: erro ao carregar ligações", e);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [j]);

  // ---------- leads ----------
  const leadsAtual = useMemo(() => leads.filter((l) => dentro(l.created_at, j.inicio, j.fim)), [leads, j]);
  const leadsAnt = useMemo(() => leads.filter((l) => dentro(l.created_at, j.inicioAnt, j.fimAnt)), [leads, j]);

  // funil: posição ATUAL dos leads que chegaram no período (quem está no 50% já passou pelo 20%)
  const funil = (lista: typeof leads) => {
    const ordem = ["20", "50", "70", "vendeu"];
    const nivel = (status?: string) => {
      const t = getFunilTier(status);
      return t ? ordem.indexOf(t.stageId) : -1;
    };
    // em atendimento: saiu da Validação e não foi perdido
    const contatados = lista.filter((l) => {
      const st = getStageForStatus(l.status);
      return !!st && st.phase !== "entrada" && st.id !== PERDIDO_STAGE_ID;
    }).length;
    return {
      chegaram: lista.length,
      contatados,
      p20: lista.filter((l) => nivel(l.status) >= 0).length,
      p50: lista.filter((l) => nivel(l.status) >= 1).length,
      p70: lista.filter((l) => nivel(l.status) >= 2).length,
      fechado: lista.filter((l) => nivel(l.status) >= 3).length,
    };
  };
  const fA = useMemo(() => funil(leadsAtual), [leadsAtual]);
  const fB = useMemo(() => funil(leadsAnt), [leadsAnt]);
  const etapasFunil = [
    { nome: "Chegaram", a: fA.chegaram, b: fB.chegaram },
    { nome: "Em atendimento", a: fA.contatados, b: fB.contatados },
    { nome: "20%", a: fA.p20, b: fB.p20 },
    { nome: "50%", a: fA.p50, b: fB.p50 },
    { nome: "70%", a: fA.p70, b: fB.p70 },
    { nome: "Fechado", a: fA.fechado, b: fB.fechado },
  ];

  // série diária com o período anterior alinhado pelo dia (dia 1 com dia 1)
  const serieDiaria = <T,>(itensA: T[], itensB: T[], data: (x: T) => string | undefined) => {
    const contar = (lista: T[]) => {
      const m = new Map<string, number>();
      lista.forEach((x) => {
        const d = data(x);
        if (!d) return;
        const k = chaveDia(new Date(d));
        m.set(k, (m.get(k) || 0) + 1);
      });
      return m;
    };
    const mA = contar(itensA);
    const mB = contar(itensB);
    return Array.from({ length: j.dias }, (_, i) => {
      const dA = somarDias(j.inicio, i);
      const dB = somarDias(j.inicioAnt, i);
      return {
        dia: dA.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        diaAnterior: dB.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        atual: mA.get(chaveDia(dA)) || 0,
        anterior: mB.get(chaveDia(dB)) || 0,
      };
    });
  };
  const leadsPorDia = useMemo(() => serieDiaria(leadsAtual, leadsAnt, (l) => l.created_at), [leadsAtual, leadsAnt, j]);

  // origem
  const porOrigem = useMemo(() => {
    const nome = (o?: string) => {
      const n = normalizeStatus(o);
      if (!n) return "Sem origem";
      if (n.includes("roleta") || n.includes("bitrix")) return "Roleta / Bitrix";
      if (n.includes("instagram") || n.includes("facebook") || n.includes("meta")) return "Meta Ads";
      if (n.includes("google")) return "Google";
      if (n.includes("oferta") || n.includes("ligac") || n.includes("mailing")) return "Oferta ativa";
      return o!.trim();
    };
    const m = new Map<string, { origem: string; atual: number; anterior: number }>();
    leadsAtual.forEach((l) => {
      const k = nome(l.origem);
      m.set(k, { origem: k, atual: (m.get(k)?.atual || 0) + 1, anterior: m.get(k)?.anterior || 0 });
    });
    leadsAnt.forEach((l) => {
      const k = nome(l.origem);
      m.set(k, { origem: k, atual: m.get(k)?.atual || 0, anterior: (m.get(k)?.anterior || 0) + 1 });
    });
    const lista = Array.from(m.values()).sort((a, b) => b.atual - a.atual || b.anterior - a.anterior);
    if (lista.length <= 6) return lista;
    const resto = lista.slice(5).reduce((t, x) => ({ origem: "Outras", atual: t.atual + x.atual, anterior: t.anterior + x.anterior }), { origem: "Outras", atual: 0, anterior: 0 });
    return [...lista.slice(0, 5), resto];
  }, [leadsAtual, leadsAnt]);

  // ---------- ligações ----------
  const ligA = useMemo(() => ligacoes.filter((l) => dentro(l.data_ligacao, j.inicio, j.fim)), [ligacoes, j]);
  const ligB = useMemo(() => ligacoes.filter((l) => dentro(l.data_ligacao, j.inicioAnt, j.fimAnt)), [ligacoes, j]);
  const ligPorDia = useMemo(() => serieDiaria(ligA, ligB, (l) => l.data_ligacao), [ligA, ligB, j]);
  const interessados = (lista: Ligacao[]) => lista.filter((l) => nomeResultado(l.resultado || "") === "Interessado").length;
  const resultados = useMemo(() => {
    const m = new Map<string, { nome: string; atual: number; anterior: number }>();
    ligA.forEach((l) => {
      const k = nomeResultado(l.resultado || "");
      m.set(k, { nome: k, atual: (m.get(k)?.atual || 0) + 1, anterior: m.get(k)?.anterior || 0 });
    });
    ligB.forEach((l) => {
      const k = nomeResultado(l.resultado || "");
      m.set(k, { nome: k, atual: m.get(k)?.atual || 0, anterior: (m.get(k)?.anterior || 0) + 1 });
    });
    return Array.from(m.values())
      .sort((a, b) => b.atual - a.atual)
      .map((r) => ({ ...r, pctA: pct(r.atual, ligA.length), pctB: pct(r.anterior, ligB.length) }));
  }, [ligA, ligB]);

  const taxaFunilA = pct(fA.p20, fA.chegaram);
  const taxaFunilB = pct(fB.p20, fB.chegaram);
  const taxaIntA = pct(interessados(ligA), ligA.length);
  const taxaIntB = pct(interessados(ligB), ligB.length);

  const eixo = { stroke: cores.grade, tick: { fill: cores.texto, fontSize: 11 }, tickLine: false, axisLine: false } as const;
  const rotuloPeriodo = periodo === "mes" ? "o mesmo nº de dias antes" : `os ${periodo} dias anteriores`;

  const GraficoDiario = ({ dados, nome }: { dados: typeof leadsPorDia; nome: string }) => (
    <>
      <Legenda
        itens={[
          { nome: `${nome} no período`, cor: cores.atual },
          { nome: "Período anterior", cor: cores.anterior, tipo: "linha" },
        ]}
      />
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={dados.length > 20 ? 2 : "20%"}>
            <CartesianGrid vertical={false} stroke={cores.grade} strokeDasharray="0" />
            <XAxis dataKey="dia" {...eixo} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...eixo} allowDecimals={false} width={40} />
            <Tooltip
              cursor={{ fill: cores.grade, opacity: 0.5 }}
              content={<DicaGrafico formatar={(label: string, p: any[]) => `${label} (antes: ${p[0]?.payload?.diaAnterior})`} />}
            />
            <Bar dataKey="atual" name="Período atual" fill={cores.atual} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line dataKey="anterior" name="Período anterior" stroke={cores.anterior} strokeWidth={2} dot={false} type="monotone" activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Comparando com {rotuloPeriodo}
          {carregando && " · carregando ligações…"}
        </p>
        <div className="flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={periodo === p.id}
              onClick={() => escolher(p.id)}
              className={`px-3 h-8 rounded-md text-sm font-semibold ${periodo === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador titulo="Leads novos" valor={leadsAtual.length.toLocaleString("pt-BR")} atual={leadsAtual.length} anterior={leadsAnt.length} />
        <Indicador titulo="Chegaram ao 20%" valor={fmtPct(taxaFunilA)} atual={taxaFunilA} anterior={taxaFunilB} pontos detalhe={`${fA.p20} leads`} />
        <Indicador titulo="Ligações feitas" valor={ligA.length.toLocaleString("pt-BR")} atual={ligA.length} anterior={ligB.length} />
        <Indicador titulo="Ligações com interesse" valor={fmtPct(taxaIntA)} atual={taxaIntA} anterior={taxaIntB} pontos detalhe={`${interessados(ligA)} interessados`} />
      </div>

      <h2 className="text-lg font-extrabold tracking-tight pt-2">Leads e funil</h2>
      <div className="grid lg:grid-cols-2 gap-4">
        <Painel
          titulo="Leads novos por dia"
          subtitulo={`${leadsAtual.length} agora · ${leadsAnt.length} antes`}
          tabela={<TabelaSimples colunas={["Dia", "Agora", "Antes"]} linhas={leadsPorDia.map((d) => [d.dia, d.atual, d.anterior])} />}
        >
          <GraficoDiario dados={leadsPorDia} nome="Leads" />
        </Painel>

        <Painel
          titulo="Até onde os leads chegaram"
          subtitulo="Etapa atual dos leads que chegaram no período (quem está no 50% já passou pelo 20%)"
          tabela={
            <TabelaSimples
              colunas={["Etapa", "Agora", "% agora", "% antes"]}
              linhas={etapasFunil.map((e) => [e.nome, e.a, fmtPct(pct(e.a, fA.chegaram)), fmtPct(pct(e.b, fB.chegaram))])}
            />
          }
        >
          <div className="space-y-2.5">
            {etapasFunil.map((e, i) => {
              const pA = pct(e.a, fA.chegaram);
              const pB = pct(e.b, fB.chegaram);
              return (
                <div key={e.nome} className="grid grid-cols-[92px_1fr_88px] items-center gap-3 text-sm">
                  <span className="font-semibold truncate">{e.nome}</span>
                  <div className="relative h-6 rounded-md bg-muted overflow-hidden" title={`Antes: ${fmtPct(pB)} (${e.b})`}>
                    <div className="h-full rounded-md" style={{ width: `${Math.max(pA, e.a ? 1.5 : 0)}%`, background: i === etapasFunil.length - 1 ? cores.verde : cores.atual }} />
                    {i > 0 && fB.chegaram > 0 && (
                      <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/60" style={{ left: `calc(${pB}% - 1px)` }} aria-hidden />
                    )}
                  </div>
                  <span className="text-right tabular-nums">
                    <b>{e.a}</b> <span className="text-muted-foreground text-xs">{i > 0 ? fmtPct(pA) : ""}</span>
                  </span>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
              <span className="w-0.5 h-3 bg-foreground/60 inline-block" /> marca onde estava no período anterior
            </p>
          </div>
        </Painel>
      </div>

      <Painel
        titulo="De onde vieram os leads"
        subtitulo="Agora e no período anterior"
        tabela={<TabelaSimples colunas={["Origem", "Agora", "Antes"]} linhas={porOrigem.map((o) => [o.origem, o.atual, o.anterior])} />}
      >
        {porOrigem.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lead novo neste período.</p>
        ) : (
          <>
            <Legenda
              itens={[
                { nome: "Agora", cor: cores.atual },
                { nome: "Período anterior", cor: cores.anterior },
              ]}
            />
            <div style={{ height: Math.max(120, porOrigem.length * 52) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porOrigem} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid horizontal={false} stroke={cores.grade} />
                  <XAxis type="number" {...eixo} allowDecimals={false} />
                  <YAxis type="category" dataKey="origem" {...eixo} width={120} tick={{ fill: cores.tinta, fontSize: 12 }} />
                  <Tooltip cursor={{ fill: cores.grade, opacity: 0.4 }} content={<DicaGrafico />} />
                  <Bar dataKey="atual" name="Agora" fill={cores.atual} radius={[0, 4, 4, 0]} maxBarSize={16}>
                    <LabelList dataKey="atual" position="right" fill={cores.tinta} fontSize={11} fontWeight={700} />
                  </Bar>
                  <Bar dataKey="anterior" name="Período anterior" fill={cores.anterior} radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Painel>

      <h2 className="text-lg font-extrabold tracking-tight pt-2">Atendimento</h2>
      <RegistrosComerciais inicio={j.inicio} fim={j.fim} inicioAnt={j.inicioAnt} fimAnt={j.fimAnt} corAtual={cores.atual} corVerde={cores.verde} />

      <h2 className="text-lg font-extrabold tracking-tight pt-2">Ligações da Oferta Ativa</h2>
      <div className="grid lg:grid-cols-2 gap-4">
        <Painel
          titulo="Ligações por dia"
          subtitulo={`${ligA.length} agora · ${ligB.length} antes`}
          tabela={<TabelaSimples colunas={["Dia", "Agora", "Antes"]} linhas={ligPorDia.map((d) => [d.dia, d.atual, d.anterior])} />}
        >
          <GraficoDiario dados={ligPorDia} nome="Ligações" />
        </Painel>

        <Painel
          titulo="Resultado das ligações"
          subtitulo="% das ligações do período"
          tabela={
            <TabelaSimples
              colunas={["Resultado", "Agora", "% agora", "% antes"]}
              linhas={resultados.map((r) => [r.nome, r.atual, fmtPct(r.pctA), fmtPct(r.pctB)])}
            />
          }
        >
          {resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma ligação neste período.</p>
          ) : (
            <div className="space-y-3">
              {resultados.slice(0, 6).map((r) => (
                <div key={r.nome}>
                  <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                    <span className="font-semibold truncate">{r.nome}</span>
                    <span className="tabular-nums shrink-0">
                      <b>{fmtPct(r.pctA)}</b> <span className="text-xs text-muted-foreground">({r.atual}) · antes {fmtPct(r.pctB)}</span>
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.pctA}%`, background: r.nome === "Interessado" ? cores.verde : cores.atual }} />
                    {ligB.length > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/60" style={{ left: `calc(${r.pctB}% - 1px)` }} aria-hidden />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>
      <p className="text-[11px] text-muted-foreground">As ligações ficam guardadas por 60 dias.</p>
    </div>
  );
}
