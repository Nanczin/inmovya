import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flame, Lock, Plus, Settings2, Shield, Swords, Target, Trophy, Zap } from "lucide-react";

// ARENA SPARTANA — transforma as métricas do dia a dia em jogo: XP, nível, missões do dia, sequência,
// metas do mês com o ritmo necessário e conquistas. Dados: ligações (Oferta Ativa) e os registros do dia
// (interações, negociações, visitas, documentações, vendas — tabela powerbi_funnel_metrics, linha "dia:AAAA-MM-DD").

type Metrica = "ligacoes" | "interessados" | "interacoes" | "negociacoes" | "visitas" | "documentacoes" | "vendas";
type Dia = Record<Metrica, number>;
const vazio = (): Dia => ({ ligacoes: 0, interessados: 0, interacoes: 0, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0 });

const NOMES: Record<Metrica, string> = {
  ligacoes: "Ligações",
  interessados: "Interessados",
  interacoes: "Interações",
  negociacoes: "Negociações",
  visitas: "Visitas",
  documentacoes: "Documentações",
  vendas: "Vendas",
};
// quanto vale cada coisa (o que está mais perto da venda vale mais)
const SINGULAR: Partial<Record<Metrica, string>> = { negociacoes: "Negociação", visitas: "Visita", documentacoes: "Documentação", vendas: "Venda" };
const XP: Record<Metrica, number> = { ligacoes: 1, interessados: 10, interacoes: 3, negociacoes: 25, visitas: 60, documentacoes: 120, vendas: 600 };
// registros manuais (+1 direto daqui) → coluna da powerbi_funnel_metrics
const COLUNA: Partial<Record<Metrica, string>> = {
  interacoes: "interacao_ajuste",
  negociacoes: "negociacao",
  visitas: "visitas",
  documentacoes: "documentacao",
  vendas: "venda",
};

interface Metas {
  diaLigacoes: number;
  diaInteressados: number;
  diaInteracoes: number;
  mesVisitas: number;
  mesNegociacoes: number;
  mesDocumentacoes: number;
  mesVendas: number;
}
const METAS_PADRAO: Metas = {
  diaLigacoes: 200,
  diaInteressados: 5,
  diaInteracoes: 15,
  mesVisitas: 12,
  mesNegociacoes: 8,
  mesDocumentacoes: 3,
  mesVendas: 2,
};

const NIVEIS = [
  { nome: "Recruta", xp: 0 },
  { nome: "Soldado", xp: 600 },
  { nome: "Hoplita", xp: 1800 },
  { nome: "Veterano", xp: 3600 },
  { nome: "Centurião", xp: 6000 },
  { nome: "Spartano", xp: 9000 },
  { nome: "Lenda de Esparta", xp: 14000 },
];

const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const xpDoDia = (d: Dia) => (Object.keys(XP) as Metrica[]).reduce((s, k) => s + d[k] * XP[k], 0);
const ehDiaUtil = (d: Date) => d.getDay() !== 0; // segunda a sábado
const interessado = (r?: string | null) => {
  const n = String(r || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return n.includes("interessado") && !n.includes("nao") && !n.includes("sem interesse");
};

function lerMetasLocal(): Metas {
  try {
    const m = JSON.parse(localStorage.getItem("inmovya_arena_metas") || "null");
    const dia = Number(localStorage.getItem("meta_ligacoes_diarias")) || METAS_PADRAO.diaLigacoes;
    return { ...METAS_PADRAO, diaLigacoes: dia, ...(m || {}) };
  } catch {
    return METAS_PADRAO;
  }
}

export function ArenaModule() {
  const { toast } = useToast();
  const [dias, setDias] = useState<Record<string, Dia>>({});
  const [linhas, setLinhas] = useState<Record<string, any>>({});
  const [metas, setMetas] = useState<Metas>(lerMetasLocal);
  const [editando, setEditando] = useState<Metas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [festa, setFesta] = useState<string | null>(null);

  const hoje = new Date();
  const kHoje = chave(hoje);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioHist = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1); // 3 meses: sequência e recordes

  const carregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const m: Record<string, Dia> = {};
    const pegar = (k: string) => (m[k] = m[k] || vazio());
    // ligações (Oferta Ativa)
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase
        .from("ligacoes")
        .select("data_ligacao, resultado")
        .eq("user_id", user.id)
        .gte("data_ligacao", inicioHist.toISOString())
        .range(de, de + 999);
      if (error) break;
      (data || []).forEach((l: any) => {
        const d = pegar(chave(new Date(l.data_ligacao)));
        d.ligacoes++;
        if (interessado(l.resultado)) d.interessados++;
      });
      if (!data || data.length < 1000) break;
    }
    // registros do dia
    const reg: Record<string, any> = {};
    const { data: rows } = await supabase.from("powerbi_funnel_metrics").select("*").eq("user_id", user.id);
    (rows || []).forEach((r: any) => {
      const p = String(r.period || "");
      if (!p.startsWith("dia:")) return;
      const k = p.slice(4);
      reg[k] = r;
      const d = pegar(k);
      d.interacoes += Number(r.interacao_ajuste) || 0;
      d.negociacoes += Number(r.negociacao) || 0;
      d.visitas += Number(r.visitas) || 0;
      d.documentacoes += Number(r.documentacao) || 0;
      d.vendas += Number(r.venda) || 0;
    });
    // metas guardadas no banco (vale em qualquer computador); se não houver, fica a deste navegador
    const { data: g } = await supabase.from("arena_metas" as any).select("metas").eq("user_id", user.id).maybeSingle();
    if ((g as any)?.metas) setMetas({ ...METAS_PADRAO, ...(g as any).metas });
    setDias(m);
    setLinhas(reg);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    const t = window.setInterval(carregar, 60_000);
    return () => window.clearInterval(t);
  }, [carregar]);

  const dHoje = dias[kHoje] || vazio();

  // ---- mês / temporada ----
  const mes = useMemo(() => {
    const t = vazio();
    Object.entries(dias).forEach(([k, d]) => {
      if (k >= chave(inicioMes) && k <= kHoje) (Object.keys(t) as Metrica[]).forEach((c) => (t[c] += d[c]));
    });
    return t;
  }, [dias, kHoje]);
  const xpMes = xpDoDia(mes);
  const nivelIdx = NIVEIS.reduce((acc, n, i) => (xpMes >= n.xp ? i : acc), 0);
  const nivel = NIVEIS[nivelIdx];
  const prox = NIVEIS[nivelIdx + 1];
  const pctNivel = prox ? Math.min(100, ((xpMes - nivel.xp) / (prox.xp - nivel.xp)) * 100) : 100;

  // dias úteis que faltam no mês (contando hoje)
  const diasRestantes = useMemo(() => {
    let n = 0;
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    for (let d = new Date(hoje); d <= fim; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d)) n++;
    return Math.max(1, n);
  }, [kHoje]);
  const diasUteisPassados = useMemo(() => {
    let n = 0;
    for (let d = new Date(inicioMes); chave(d) < kHoje; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d)) n++;
    return n;
  }, [kHoje]);

  // ---- missões de hoje ----
  const missoes = [
    { id: "lig", m: "ligacoes" as Metrica, alvo: metas.diaLigacoes, titulo: "Bater a meta de ligações", dica: "Oferta Ativa — rodadas 11:30 e 16:00" },
    { id: "int", m: "interessados" as Metrica, alvo: metas.diaInteressados, titulo: "Encontrar interessados", dica: "Ligações classificadas como Interessado" },
    { id: "itr", m: "interacoes" as Metrica, alvo: metas.diaInteracoes, titulo: "Gerar interações", dica: "Leads que responderam/conversaram" },
  ];
  const missoesFeitas = missoes.filter((x) => dHoje[x.m] >= x.alvo).length;

  // ---- sequência: dias úteis seguidos batendo a meta de ligações (hoje conta se já bateu) ----
  const sequencia = useMemo(() => {
    let n = 0;
    const d = new Date(hoje);
    if ((dias[chave(d)]?.ligacoes || 0) < metas.diaLigacoes) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 90; i++) {
      if (ehDiaUtil(d)) {
        if ((dias[chave(d)]?.ligacoes || 0) >= metas.diaLigacoes) n++;
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [dias, metas.diaLigacoes, kHoje]);

  // ---- recordes ----
  const recordeLig = Math.max(0, ...Object.entries(dias).filter(([k]) => k !== kHoje).map(([, d]) => d.ligacoes));
  const recordeXp = Math.max(0, ...Object.entries(dias).filter(([k]) => k !== kHoje).map(([, d]) => xpDoDia(d)));

  // ---- semana (seg→sáb) ----
  const semana = useMemo(() => {
    const seg = new Date(hoje);
    seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(seg);
      d.setDate(seg.getDate() + i);
      const k = chave(d);
      return { k, rot: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), xp: xpDoDia(dias[k] || vazio()), futuro: k > kHoje, bateu: (dias[k]?.ligacoes || 0) >= metas.diaLigacoes };
    });
  }, [dias, kHoje, metas.diaLigacoes]);
  const maxSemana = Math.max(1, ...semana.map((s) => s.xp));

  // ---- conquistas ----
  const todos = Object.values(dias);
  const conquistas = [
    { id: "c1", nome: "Primeiro sangue", desc: "Primeira venda do mês", ok: mes.vendas >= 1, icone: "🏆" },
    { id: "c2", nome: "Maratonista", desc: "300 ligações num dia", ok: todos.some((d) => d.ligacoes >= 300), icone: "🏃" },
    { id: "c3", nome: "Muralha", desc: "5 dias seguidos batendo a meta de ligações", ok: sequencia >= 5, icone: "🛡️" },
    { id: "c4", nome: "Faro de ouro", desc: "10 interessados num dia", ok: todos.some((d) => d.interessados >= 10), icone: "🎯" },
    { id: "c5", nome: "Pé na rua", desc: "2 visitas no mesmo dia", ok: todos.some((d) => d.visitas >= 2), icone: "🚶" },
    { id: "c6", nome: "Mesa cheia", desc: "Meta de negociações do mês", ok: mes.negociacoes >= metas.mesNegociacoes, icone: "🤝" },
    { id: "c7", nome: "Missão cumprida", desc: "As 3 missões de hoje", ok: missoesFeitas === missoes.length, icone: "⚔️" },
    { id: "c8", nome: "Quebra-recorde", desc: "Superar seu recorde de ligações", ok: recordeLig > 0 && dHoje.ligacoes > recordeLig, icone: "🔥" },
    { id: "c9", nome: "Spartano", desc: "Chegar ao nível Spartano no mês", ok: xpMes >= 9000, icone: "🦁" },
  ];

  // comemora quando uma missão do dia ou uma conquista nova acaba de ser cumprida (cada uma uma vez só)
  useEffect(() => {
    if (carregando) return;
    const ler = (k: string): string[] => {
      try {
        return JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        return null as any;
      }
    };
    const kMis = `inmovya_arena_missoes_${kHoje}`;
    const kCon = "inmovya_arena_conquistas";
    const misFeitas = missoes.filter((x) => dHoje[x.m] >= x.alvo).map((x) => x.id);
    const conFeitas = conquistas.filter((c) => c.ok).map((c) => `${c.id}:${c.id === "c1" || c.id === "c6" || c.id === "c9" ? kHoje.slice(0, 7) : c.id === "c7" || c.id === "c8" ? kHoje : ""}`);
    const misVistas = ler(kMis);
    const conVistas = ler(kCon);
    // 1ª vez que abre (sem histórico): só guarda, sem festa pelo que já existia
    const novasMis = misVistas ? misFeitas.filter((f) => !misVistas.includes(f)) : [];
    const novasCon = conVistas ? conFeitas.filter((f) => !conVistas.includes(f)) : [];
    const nova = novasCon[0] ? conquistas.find((c) => novasCon[0].startsWith(c.id + ":"))?.nome : novasMis[0] ? missoes.find((x) => x.id === novasMis[0])?.titulo : null;
    if (nova) setFesta(nova);
    try {
      localStorage.setItem(kMis, JSON.stringify(misFeitas));
      localStorage.setItem(kCon, JSON.stringify([...new Set([...(conVistas || []), ...conFeitas])]));
    } catch {
      /* ignora */
    }
  }, [carregando, dias, metas]);

  // +1 rápido (interação, negociação, visita, documentação, venda) → mesma linha do dia usada em Relatórios
  const somarUm = async (m: Metrica) => {
    const col = COLUNA[m];
    if (!col) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const r = linhas[kHoje] || {};
    const novo = {
      user_id: user.id,
      period: `dia:${kHoje}`,
      ligacoes: Number(r.ligacoes) || 0,
      interacao_ajuste: Number(r.interacao_ajuste) || 0,
      negociacao: Number(r.negociacao) || 0,
      visitas: Number(r.visitas) || 0,
      documentacao: Number(r.documentacao) || 0,
      venda: Number(r.venda) || 0,
      updated_at: new Date().toISOString(),
    } as any;
    novo[col] = (Number(r[col]) || 0) + 1;
    const { error } = await supabase.from("powerbi_funnel_metrics").upsert(novo, { onConflict: "user_id, period" });
    if (error) return toast({ title: "Não consegui registrar", description: error.message, variant: "destructive" });
    toast({ title: `+${XP[m]} XP`, description: `${NOMES[m]} registrada hoje.` });
    carregar();
  };

  const salvarMetas = async () => {
    if (!editando) return;
    setMetas(editando);
    try {
      localStorage.setItem("inmovya_arena_metas", JSON.stringify(editando));
      localStorage.setItem("meta_ligacoes_diarias", String(editando.diaLigacoes));
    } catch {
      /* ignora */
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("arena_metas" as any).upsert({ user_id: user.id, metas: editando, updated_at: new Date().toISOString() } as any, { onConflict: "user_id" });
    setEditando(null);
    toast({ title: "Metas salvas" });
  };

  const metasMes = [
    { m: "vendas" as Metrica, alvo: metas.mesVendas },
    { m: "documentacoes" as Metrica, alvo: metas.mesDocumentacoes },
    { m: "visitas" as Metrica, alvo: metas.mesVisitas },
    { m: "negociacoes" as Metrica, alvo: metas.mesNegociacoes },
  ];

  const frase =
    missoesFeitas === missoes.length
      ? "Dia vencido. Tudo o que vier agora é bônus de XP."
      : dHoje.ligacoes === 0
        ? "A batalha começa na primeira ligação. Bora!"
        : `Faltam ${Math.max(0, metas.diaLigacoes - dHoje.ligacoes)} ligações para fechar a missão principal.`;

  const mesNome = hoje.toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="space-y-4 max-w-6xl">
      {/* cabeçalho: nível e XP da temporada */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Arena Spartana · temporada de {mesNome}</div>
              <div className="text-2xl font-bold leading-tight">{nivel.nome}</div>
              <div className="text-sm text-muted-foreground">{frase}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-3xl font-black tabular-nums">{xpMes.toLocaleString("pt-BR")}</div>
              <div className="text-xs text-muted-foreground">XP no mês</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setEditando(metas)} title="Definir metas">
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{nivel.nome}</span>
            <span>{prox ? `faltam ${(prox.xp - xpMes).toLocaleString("pt-BR")} XP para ${prox.nome}` : "nível máximo!"}</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctNivel}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* missões de hoje */}
        <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Swords className="w-4 h-4" /> Missões de hoje
            </h3>
            <span className="text-sm font-semibold tabular-nums">
              {missoesFeitas}/{missoes.length} · +{xpDoDia(dHoje)} XP hoje
            </span>
          </div>
          <div className="space-y-3">
            {missoes.map((x) => {
              const v = dHoje[x.m];
              const pct = Math.min(100, (v / Math.max(1, x.alvo)) * 100);
              const ok = v >= x.alvo;
              return (
                <div key={x.id} className={`rounded-xl border p-3 ${ok ? "border-success/50 bg-success/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">
                        {ok ? "✅ " : ""}
                        {x.titulo}
                      </div>
                      <div className="text-xs text-muted-foreground">{x.dica}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-bold">
                        {v}/{x.alvo}
                      </span>
                      {COLUNA[x.m] && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => somarUm(x.m)} title={`Registrar +1 ${NOMES[x.m]}`}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="h-2 mt-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${ok ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["negociacoes", "visitas", "documentacoes", "vendas"] as Metrica[]).map((m) => (
              <Button key={m} variant="secondary" size="sm" onClick={() => somarUm(m)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {SINGULAR[m]} <span className="ml-1 text-xs text-muted-foreground">+{XP[m]} XP</span>
              </Button>
            ))}
          </div>
        </section>

        {/* sequência e recordes */}
        <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${sequencia ? "bg-orange-100 text-orange-600 dark:bg-orange-950" : "bg-muted text-muted-foreground"}`}>
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black tabular-nums">
                {sequencia} {sequencia === 1 ? "dia" : "dias"}
              </div>
              <div className="text-xs text-muted-foreground">seguidos batendo {metas.diaLigacoes} ligações</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Recorde de ligações</div>
              <div className="text-lg font-bold tabular-nums">{Math.max(recordeLig, dHoje.ligacoes)}</div>
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Melhor dia (XP)</div>
              <div className="text-lg font-bold tabular-nums">{Math.max(recordeXp, xpDoDia(dHoje))}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">XP da semana</div>
            <div className="flex items-end gap-1.5 h-20">
              {semana.map((s) => (
                <div key={s.k} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-md ${s.k === kHoje ? "bg-primary" : s.bateu ? "bg-success/70" : "bg-primary/30"}`}
                    style={{ height: `${s.futuro ? 4 : Math.max(4, (s.xp / maxSemana) * 64)}px`, opacity: s.futuro ? 0.3 : 1 }}
                    title={`${s.xp} XP`}
                  />
                  <span className="text-[10px] text-muted-foreground">{s.rot}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* metas do mês com ritmo */}
      <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card">
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" /> Metas de {mesNome}
          <span className="text-xs font-normal text-muted-foreground">· {diasRestantes} dias úteis restantes</span>
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metasMes.map(({ m, alvo }) => {
            const v = mes[m];
            const pct = Math.min(100, (v / Math.max(1, alvo)) * 100);
            const falta = Math.max(0, alvo - v);
            const projecao = diasUteisPassados > 0 ? Math.round((v / diasUteisPassados) * (diasUteisPassados + diasRestantes)) : v;
            const noRitmo = projecao >= alvo || v >= alvo;
            return (
              <div key={m} className="rounded-xl border p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-sm">{NOMES[m]}</span>
                  <span className="tabular-nums">
                    <b className="text-lg">{v}</b>
                    <span className="text-muted-foreground">/{alvo}</span>
                  </span>
                </div>
                <div className="h-2 mt-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${v >= alvo ? "bg-success" : noRitmo ? "bg-primary" : "bg-warning"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className={`text-xs mt-1.5 ${v >= alvo ? "text-success font-semibold" : noRitmo ? "text-muted-foreground" : "text-warning font-semibold"}`}>
                  {v >= alvo
                    ? "Meta batida! 🏆"
                    : noRitmo
                      ? `No ritmo: projeção de ${projecao}`
                      : `Fora do ritmo (projeção ${projecao}). Precisa de ${(falta / diasRestantes).toFixed(1).replace(".", ",")}/dia`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* conquistas */}
      <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card">
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4" /> Conquistas
          <span className="text-xs font-normal text-muted-foreground">
            · {conquistas.filter((c) => c.ok).length}/{conquistas.length}
          </span>
        </h3>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {conquistas.map((c) => (
            <div key={c.id} className={`rounded-xl border p-3 text-center ${c.ok ? "border-warning/50 bg-warning/5" : "opacity-60"}`} title={c.desc}>
              <div className="text-2xl">{c.ok ? c.icone : <Lock className="w-6 h-6 mx-auto text-muted-foreground" />}</div>
              <div className="font-semibold text-sm mt-1">{c.nome}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{c.desc}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
          <Zap className="w-3 h-3" /> XP: ligação 1 · interessado 10 · interação 3 · negociação 25 · visita 60 · documentação 120 · venda 600. Ligações vêm da
          Oferta Ativa; o resto do botão + ou de Relatórios → Registrar.
        </p>
      </section>

      {/* comemoração */}
      {festa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFesta(null)}>
          <div className="rounded-3xl bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 max-w-sm mx-4">
            <div className="text-6xl mb-2">🏆</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Conquista desbloqueada</div>
            <div className="text-2xl font-black mt-1">{festa}</div>
            <div className="text-sm text-muted-foreground mt-2">Isso é Esparta! Continue assim.</div>
            <Button className="mt-4" onClick={() => setFesta(null)}>
              Bora!
            </Button>
          </div>
        </div>
      )}

      {/* metas */}
      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Suas metas</DialogTitle>
            <DialogDescription>As do dia viram missões; as do mês mostram se você está no ritmo. Use as da planilha Spartanos.</DialogDescription>
          </DialogHeader>
          {editando && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["diaLigacoes", "Ligações por dia"],
                  ["diaInteressados", "Interessados por dia"],
                  ["diaInteracoes", "Interações por dia"],
                  ["mesNegociacoes", "Negociações no mês"],
                  ["mesVisitas", "Visitas no mês"],
                  ["mesDocumentacoes", "Documentações no mês"],
                  ["mesVendas", "Vendas no mês"],
                ] as [keyof Metas, string][]
              ).map(([k, rot]) => (
                <label key={k} className="grid gap-1 text-sm font-semibold">
                  {rot}
                  <Input
                    type="number"
                    min={0}
                    value={editando[k]}
                    onChange={(e) => setEditando({ ...editando, [k]: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarMetas}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
