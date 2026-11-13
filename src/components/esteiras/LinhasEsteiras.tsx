// Esteiras em linha: cada esteira é uma linha, cada passo uma parada (bolinha) com a quantidade de leads.
// Clicar numa parada abre, logo abaixo, quem está ali e a mensagem do passo (renderPainel).
import { ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronRight, Flag, Search, X as XIcon } from "lucide-react";
import type { Esteira, EsteiraPasso } from "@/lib/esteiras";

export type LeadNaLinha = {
  id: string;
  nome: string;
  telefone?: string | null;
  esteira_id?: string | null;
  esteira_passo?: number | null;
  esteira_proximo?: string | null;
  observacoes?: string | null;
};

export type ParadaSelecionada = { esteiraId: string; idx: number } | null;

// cores das linhas (texto branco por cima passa no contraste, no tema claro e no escuro)
export const CORES_LINHA = ["#C2410C", "#2F5BEA", "#0F766E", "#7A4FD6", "#BE185D", "#4D7C0F", "#A16207", "#0369A1"];
export const corDaEsteira = (esteiras: Esteira[], id: string) => {
  const i = Math.max(0, esteiras.findIndex((e) => e.id === id));
  return CORES_LINHA[i % CORES_LINHA.length];
};

const semAcento = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** "D1 Manhã" → "D1 M": cabe embaixo da bolinha */
export const rotuloCurto = (p: EsteiraPasso | undefined, i: number) =>
  (p?.titulo || `P${i + 1}`)
    .replace(/\s*manh[ãa]\s*/i, " M")
    .replace(/\s*tarde\s*/i, " T")
    .replace(/\s*noite\s*/i, " N")
    .trim()
    .slice(0, 8);

const CHAVE_FECHADAS = "inmovya_esteiras_fechadas";
const lerFechadas = (): Set<string> | null => {
  try {
    const v = localStorage.getItem(CHAVE_FECHADAS);
    return v ? new Set<string>(JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
};

interface Props {
  esteiras: Esteira[];
  passosDe: (esteiraId: string) => EsteiraPasso[];
  leads: LeadNaLinha[]; // só quem está em alguma esteira
  fimDeHoje: number;
  selecionada: ParadaSelecionada;
  onSelecionar: (s: ParadaSelecionada) => void;
  renderPainel: (esteira: Esteira, idx: number, leadsDaParada: LeadNaLinha[]) => ReactNode;
}

export function LinhasEsteiras({ esteiras, passosDe, leads, fimDeHoje, selecionada, onSelecionar, renderPainel }: Props) {
  const [busca, setBusca] = useState("");
  const [fechadas, setFechadas] = useState<Set<string> | null>(lerFechadas);

  // posição de cada lead: índice do passo (passos.length = já recebeu tudo, aguardando resposta)
  const porParada = useMemo(() => {
    const m = new Map<string, LeadNaLinha[]>();
    leads.forEach((l) => {
      if (!l.esteira_id) return;
      const total = passosDe(l.esteira_id).length;
      const idx = Math.min(Math.max(l.esteira_passo || 0, 0), total);
      const k = `${l.esteira_id}:${idx}`;
      m.set(k, [...(m.get(k) || []), l]);
    });
    return m;
  }, [leads, passosDe]);

  // primeira vez: esteiras sem lead começam encolhidas
  useEffect(() => {
    if (fechadas || !esteiras.length) return;
    setFechadas(new Set<string>(esteiras.filter((e) => !leads.some((l) => l.esteira_id === e.id)).map((e) => e.id)));
  }, [esteiras, leads, fechadas]);

  const salvarFechadas = (s: Set<string>) => {
    setFechadas(s);
    try {
      localStorage.setItem(CHAVE_FECHADAS, JSON.stringify(Array.from(s)));
    } catch {
      /* sem armazenamento: só nesta sessão */
    }
  };
  const fechadasAgora = fechadas || new Set<string>();
  const todasFechadas = esteiras.length > 0 && esteiras.every((e) => fechadasAgora.has(e.id));

  // busca por nome ou telefone
  const q = semAcento(busca.trim());
  const dig = busca.replace(/\D/g, "");
  const resultados = useMemo(() => {
    if (q.length < 2 && dig.length < 3) return [] as LeadNaLinha[];
    return leads.filter((l) => semAcento(l.nome || "").includes(q) || (dig.length >= 3 && (l.telefone || "").replace(/\D/g, "").includes(dig)));
  }, [leads, q, dig]);
  const buscando = q.length >= 2 || dig.length >= 3;
  const achadas = useMemo(() => {
    const s = new Set<string>();
    resultados.forEach((l) => {
      const total = passosDe(l.esteira_id!).length;
      s.add(`${l.esteira_id}:${Math.min(Math.max(l.esteira_passo || 0, 0), total)}`);
    });
    return s;
  }, [resultados, passosDe]);

  const irPara = (l: LeadNaLinha) => {
    if (!l.esteira_id) return;
    const total = passosDe(l.esteira_id).length;
    const n = new Set(fechadasAgora);
    n.delete(l.esteira_id);
    salvarFechadas(n);
    onSelecionar({ esteiraId: l.esteira_id, idx: Math.min(Math.max(l.esteira_passo || 0, 0), total) });
    setBusca("");
  };

  const quando = (l: LeadNaLinha) => {
    if (!l.esteira_proximo) return "hoje";
    const t = new Date(l.esteira_proximo).getTime();
    if (t <= fimDeHoje) return "hoje";
    return new Date(t).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Busca */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-[240px] h-11 flex items-center gap-2 rounded-xl border bg-card px-3 focus-within:ring-2 focus-within:ring-primary/40">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            placeholder="Buscar lead nas esteiras (nome ou telefone)"
            aria-label="Buscar lead nas esteiras"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
          />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => salvarFechadas(todasFechadas ? new Set<string>() : new Set<string>(esteiras.map((e) => e.id)))}
          className="h-11 px-4 rounded-xl border bg-card text-sm font-semibold hover:bg-muted"
        >
          {todasFechadas ? "Expandir todas" : "Encolher todas"}
        </button>
      </div>

      {buscando && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b text-sm font-bold">
            {resultados.length ? `${resultados.length} lead${resultados.length === 1 ? "" : "s"} encontrado${resultados.length === 1 ? "" : "s"}` : "Nenhum lead com esse nome nas esteiras"}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {resultados.slice(0, 40).map((l) => {
              const e = esteiras.find((x) => x.id === l.esteira_id);
              const ps = passosDe(l.esteira_id!);
              const idx = Math.min(Math.max(l.esteira_passo || 0, 0), ps.length);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => irPara(l)}
                  className="w-full grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                >
                  <span className="text-sm font-semibold truncate">{l.nome}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corDaEsteira(esteiras, l.esteira_id!) }} />
                    <span className="truncate">{e?.nome}</span>
                  </span>
                  <span className="text-xs font-bold whitespace-nowrap">
                    {idx >= ps.length ? "aguardando resposta" : `${ps[idx]?.titulo || `P${idx + 1}`} · ${quando(l)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Linhas */}
      {esteiras.map((e) => {
        const ps = passosDe(e.id);
        const cor = corDaEsteira(esteiras, e.id);
        const contar = (i: number) => (porParada.get(`${e.id}:${i}`) || []).length;
        const total = ps.reduce((a, _, i) => a + contar(i), 0) + contar(ps.length);
        const achouAqui = buscando && Array.from<string>(achadas).some((k) => k.startsWith(`${e.id}:`));
        const aberta = !fechadasAgora.has(e.id) || achouAqui;
        const sel = selecionada?.esteiraId === e.id ? selecionada.idx : null;
        const paradas = [...ps.map((p, i) => ({ i, rotulo: rotuloCurto(p, i), titulo: p.titulo || `Passo ${i + 1}`, fim: false })), { i: ps.length, rotulo: "Fim", titulo: "Aguardando resposta", fim: true }];
        return (
          <div key={e.id} className="rounded-2xl border bg-card px-2.5 py-1.5">
            <button
              type="button"
              aria-expanded={aberta}
              onClick={() => {
                const n = new Set(fechadasAgora);
                aberta ? n.add(e.id) : n.delete(e.id);
                salvarFechadas(n);
              }}
              className="w-full min-h-12 flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${aberta ? "rotate-90" : ""}`} aria-hidden="true" />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cor }} />
                <span className="text-[15px] font-extrabold">{e.nome}</span>
              </span>
              <span className="text-[13px] text-muted-foreground">
                {ps.length} passo{ps.length === 1 ? "" : "s"} · {total} lead{total === 1 ? "" : "s"}
              </span>
            </button>

            {aberta && (
              <div className="overflow-x-auto px-2 pb-2">
                <div className="relative flex justify-between pt-2.5 pb-1" style={{ minWidth: paradas.length * 60 }}>
                  <div className="absolute left-[26px] right-[26px] top-[30px] h-0.5 bg-border" aria-hidden="true" />
                  {paradas.map((p) => {
                    const n = contar(p.i);
                    const lista = porParada.get(`${e.id}:${p.i}`) || [];
                    const hoje = !p.fim && lista.some((l) => !l.esteira_proximo || new Date(l.esteira_proximo).getTime() <= fimDeHoje);
                    const marcado = sel === p.i || (buscando && achadas.has(`${e.id}:${p.i}`));
                    const apagado = buscando && !achadas.has(`${e.id}:${p.i}`);
                    return (
                      <div key={p.i} className="w-[52px] shrink-0 flex flex-col items-center gap-1.5 relative">
                        <button
                          type="button"
                          aria-label={`${e.nome}, ${p.titulo}: ${n} lead(s)${hoje ? ", envia hoje" : ""}`}
                          aria-pressed={sel === p.i}
                          title={`${p.titulo}${n ? ` · ${n} lead(s)` : ""}${hoje ? " · envia hoje" : ""}`}
                          onClick={() => onSelecionar(sel === p.i ? null : { esteiraId: e.id, idx: p.i })}
                          className="relative z-[1] box-border w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square rounded-full p-0 m-0 leading-none flex items-center justify-center text-sm font-extrabold transition-opacity"
                          style={{
                            background: n ? (p.fim ? "hsl(var(--foreground))" : cor) : "hsl(var(--card))",
                            color: n ? (p.fim ? "hsl(var(--background))" : "#FFFFFF") : "hsl(var(--muted-foreground))",
                            border: n ? "0" : "2px solid hsl(var(--border))",
                            outline: marcado ? "2px solid hsl(var(--foreground))" : hoje ? `2px solid ${cor}` : "none",
                            outlineOffset: 3,
                            opacity: apagado ? 0.35 : 1,
                          }}
                        >
                          {n ? n : p.fim ? <Flag className="w-4 h-4" aria-hidden="true" /> : ""}
                        </button>
                        <span className={`text-[11px] font-bold whitespace-nowrap ${sel === p.i ? "text-foreground" : "text-muted-foreground"}`}>{p.rotulo}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {aberta && sel !== null && (
              <div className="border-t mx-2 mt-1 pt-3 pb-2">{renderPainel(e, sel, porParada.get(`${e.id}:${sel}`) || [])}</div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground px-1">Bolinha colorida = tem lead ali · anel = envia hoje · clique numa bolinha para ver os leads e a mensagem do passo.</p>
    </div>
  );
}
