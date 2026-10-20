// Gestor de Métricas — insights por regras (sem IA). Cada regra olha os números e devolve um aviso com ações.
import {
  NOMES,
  DIAS_SEMANA_PLURAL,
  type Conversao,
  type DesempenhoSemana,
  type EtapaFunil,
  type LeadParaGestor,
  type MetricaId,
  type ResultadoMetrica,
} from "./metricas";

export type Prioridade = "alta" | "media" | "baixa";

export interface AcaoInsight {
  label: string;
  leadIds?: string[];
  link?: string; // "esteiras" | "registrar" | módulo do app
}

export interface Insight {
  id: string;
  prioridade: Prioridade;
  titulo: string;
  texto: string;
  acoes: AcaoInsight[];
}

export interface EntradaInsights {
  metricas: ResultadoMetrica[];
  conversoes: Conversao[];
  gargalo: Conversao | null;
  diasRestantes: number;
  leads: LeadParaGestor[];
  parados: Record<EtapaFunil, (LeadParaGestor & { diasParado: number })[]>;
  semana: DesempenhoSemana[];
  diasSemRegistro: string[]; // AAAA-MM-DD
  oferta: { taxaInteresse: number | null; taxaInteresseAnterior: number | null; variacaoTaxa: number | null; ligacoes: number };
}

const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })}%`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmt = (id: MetricaId, v: number) => (id === "vendas_valor" ? brl(v) : n0(v));
const dataBR = (k: string) => k.split("-").reverse().slice(0, 2).join("/");
const PESO: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };

// Quem chamar para destravar cada passagem do funil
const ETAPAS_DO_GARGALO: Record<string, string[]> = {
  "interacoes>negociacoes": ["20", "50"],
  "negociacoes>visitas": ["70", "50"],
  "visitas>documentacoes": ["70"],
  "documentacoes>vendas_qtd": ["documentacao", "70"],
};

const recentes = (leads: LeadParaGestor[], etapas: string[], max: number) =>
  leads
    .filter((l) => l.etapa && etapas.includes(l.etapa))
    .sort((a, b) => (b.ultimaInteracao || "").localeCompare(a.ultimaInteracao || ""))
    .slice(0, max);

export function gerarInsights(e: EntradaInsights, max = 6): Insight[] {
  const out: Insight[] = [];
  const m = (id: MetricaId) => e.metricas.find((x) => x.id === id);

  // 1) Gargalo de conversão
  if (e.gargalo && e.gargalo.taxaReal !== null && e.gargalo.taxaMeta !== null) {
    const g = e.gargalo;
    const alvo = recentes(e.leads, ETAPAS_DO_GARGALO[`${g.de}>${g.para}`] || ["70"], 5);
    const verbo = g.para === "visitas" ? "visitar" : g.para === "negociacoes" ? "negociar" : g.para === "documentacoes" ? "fechar a proposta" : "fechar";
    out.push({
      id: "gargalo",
      prioridade: "alta",
      titulo: `Gargalo: ${NOMES[g.de].singular} → ${NOMES[g.para].singular}`,
      texto:
        `Seu gargalo é ${NOMES[g.de].singular} → ${NOMES[g.para].singular}: ${n0(g.realizadoDe)} ${NOMES[g.de].nome} viraram ${n0(g.realizadoPara)} ${NOMES[g.para].nome} ` +
        `(${pct(g.taxaReal)}, o ideal pela meta é ${pct(g.taxaMeta)}).` +
        (alvo.length ? ` Hoje chame estes leads para ${verbo}:` : ""),
      acoes: alvo.map((l) => ({ label: l.nome, leadIds: [l.id] })),
    });
  }

  // 2) Ritmo (métricas fora ou em atenção), num aviso só
  const atrasadas = e.metricas.filter((x) => (x.status === "fora" || x.status === "atencao") && x.id !== "leads" && x.id !== "ligacoes");
  if (atrasadas.length) {
    const linhas = atrasadas.map(
      (x) => `Faltam ${fmt(x.id, x.falta)} ${NOMES[x.id].nome}. Você precisa de ${x.id === "vendas_valor" ? brl(x.ritmoNecessario) : n1(x.ritmoNecessario)} por dia; sua média é ${x.id === "vendas_valor" ? brl(x.mediaDiaria) : n1(x.mediaDiaria)}.`
    );
    out.push({
      id: "ritmo",
      prioridade: atrasadas.some((x) => x.status === "fora") ? "alta" : "media",
      titulo: `Ritmo: ${atrasadas.length} meta(s) abaixo do necessário`,
      texto: linhas.join(" "),
      acoes: [{ label: "Registrar o dia", link: "registrar" }],
    });
  }

  // 3) Venda: falta pouco tempo e a venda não saiu
  const venda = m("vendas_qtd");
  if (venda && venda.meta > 0 && venda.realizado < venda.meta && e.diasRestantes <= 10) {
    const foco = [...e.leads].filter((l) => l.avanco > 0).sort((a, b) => b.avanco - a.avanco || (b.ultimaInteracao || "").localeCompare(a.ultimaInteracao || "")).slice(0, 3);
    out.push({
      id: "venda",
      prioridade: "alta",
      titulo: "Foco de fechamento",
      texto: `Faltam ${e.diasRestantes} dia(s) e ${n0(venda.falta)} venda(s) para a meta.` + (foco.length ? " Seus leads mais avançados:" : " Nenhum lead em 70% ou documentação agora."),
      acoes: foco.map((l) => ({ label: l.nome, leadIds: [l.id] })),
    });
  }

  // 4) Leads parados por etapa
  (["70", "50", "20"] as EtapaFunil[]).forEach((et) => {
    const lista = e.parados[et];
    if (!lista.length) return;
    out.push({
      id: `parados-${et}`,
      prioridade: et === "20" ? "baixa" : "media",
      titulo: `${lista.length} lead(s) parados em ${et}%`,
      texto: `Sem interação nem lembrete há dias. O mais antigo: ${lista[0].nome} (${lista[0].diasParado >= 999 ? "nunca" : `${lista[0].diasParado} dias`}).`,
      acoes: lista.slice(0, 8).map((l) => ({ label: l.nome, leadIds: [l.id] })),
    });
  });

  // 5) Registro faltando
  if (e.diasSemRegistro.length) {
    const d = e.diasSemRegistro;
    out.push({
      id: "registro",
      prioridade: "media",
      titulo: `${d.length} dia(s) sem "Registrar o dia"`,
      texto: `Sem registro: ${d.slice(-6).map(dataBR).join(", ")}${d.length > 6 ? "…" : ""}. Sem isso as metas ficam erradas.`,
      acoes: [{ label: "Registrar", link: "registrar" }],
    });
  }

  // 6) Oferta Ativa: interesse caindo
  if (e.oferta.variacaoTaxa !== null && e.oferta.variacaoTaxa < -0.3 && e.oferta.taxaInteresse !== null && e.oferta.taxaInteresseAnterior !== null) {
    out.push({
      id: "oferta",
      prioridade: "media",
      titulo: "Oferta Ativa: interesse caindo",
      texto: `O % de interessados caiu de ${pct(e.oferta.taxaInteresseAnterior)} para ${pct(e.oferta.taxaInteresse)} (${n0(e.oferta.ligacoes)} ligações). Revise a lista ou o horário das ligações.`,
      acoes: [{ label: "Abrir Ligações", link: "ligacoes" }],
    });
  }

  // 7) Meta batida
  const batidas = e.metricas.filter((x) => x.status === "batida");
  if (batidas.length) {
    const prox: Partial<Record<MetricaId, string>> = {
      interacoes: "transformar em negociações",
      negociacoes: "converter em visitas",
      visitas: "levar para proposta",
      documentacoes: "fechar as vendas",
    };
    const b = batidas[0];
    out.push({
      id: "batida",
      prioridade: "baixa",
      titulo: `Meta de ${NOMES[b.id].nome} batida`,
      texto:
        `Parabéns: ${fmt(b.id, b.realizado)} de ${fmt(b.id, b.meta)} ${NOMES[b.id].nome} (${pct(b.pctAtingido)}).` +
        (prox[b.id] ? ` Concentre o excedente em ${prox[b.id]}.` : "") +
        (batidas.length > 1 ? ` Também batidas: ${batidas.slice(1).map((x) => NOMES[x.id].nome).join(", ")}.` : ""),
      acoes: [],
    });
  }

  // 8) Dia da semana (só com pelo menos 2 registros em cada dia comparado)
  const uteis = e.semana.filter((s) => s.dia >= 1 && s.dia <= 5 && s.registros >= 2);
  if (uteis.length >= 2) {
    const melhor = uteis.reduce((a, b) => (b.mediaInteracoes > a.mediaInteracoes ? b : a));
    const pior = uteis.reduce((a, b) => (b.mediaInteracoes < a.mediaInteracoes ? b : a));
    if (pior.mediaInteracoes > 0 && melhor.mediaInteracoes / pior.mediaInteracoes >= 1.5) {
      out.push({
        id: "semana",
        prioridade: "baixa",
        titulo: "Melhor dia da semana",
        texto: `Suas ${DIAS_SEMANA_PLURAL[melhor.dia]} rendem ${n1(melhor.mediaInteracoes / pior.mediaInteracoes)}x mais interações que as ${DIAS_SEMANA_PLURAL[pior.dia]} (${n1(melhor.mediaInteracoes)} x ${n1(pior.mediaInteracoes)} por dia). Antecipe disparos e esteiras para as ${DIAS_SEMANA_PLURAL[melhor.dia]}.`,
        acoes: [{ label: "Abrir esteiras", link: "esteiras" }],
      });
    }
  }

  return out.map((x, i) => ({ x, i })).sort((a, b) => PESO[a.x.prioridade] - PESO[b.x.prioridade] || a.i - b.i).slice(0, max).map((y) => y.x);
}

// ---------- Plano de hoje (checklist) ----------
export interface ItemPlano {
  id: string;
  texto: string;
  campo?: "interacoes" | "negociacoes" | "visitas" | "documentacoes" | "vendas"; // progresso lido do registro de hoje
  alvo?: number;
  leadIds?: string[];
}

export function gerarPlanoHoje(metricas: ResultadoMetrica[], insights: Insight[]): ItemPlano[] {
  const itens: ItemPlano[] = [];
  const campo: Partial<Record<MetricaId, ItemPlano["campo"]>> = {
    interacoes: "interacoes",
    negociacoes: "negociacoes",
    visitas: "visitas",
    documentacoes: "documentacoes",
    vendas_qtd: "vendas",
  };
  const verbo: Partial<Record<MetricaId, string>> = {
    interacoes: "Fazer",
    negociacoes: "Abrir",
    visitas: "Marcar",
    documentacoes: "Fechar",
    vendas_qtd: "Fechar",
  };
  for (const x of metricas) {
    const c = campo[x.id];
    if (!c || x.meta <= 0 || x.falta <= 0) continue;
    const alvo = Math.max(1, Math.ceil(x.ritmoNecessario));
    itens.push({ id: `meta-${x.id}`, texto: `${verbo[x.id]} ${alvo} ${alvo === 1 ? NOMES[x.id].singular : NOMES[x.id].nome}`, campo: c, alvo });
  }
  const g = insights.find((i) => i.id === "gargalo");
  if (g && g.acoes.length) itens.push({ id: "gargalo", texto: `Chamar: ${g.acoes.map((a) => a.label).join(", ")}`, leadIds: g.acoes.flatMap((a) => a.leadIds || []) });
  const v = insights.find((i) => i.id === "venda");
  if (v && v.acoes.length) itens.push({ id: "venda", texto: `Fechamento: ${v.acoes.map((a) => a.label).join(", ")}`, leadIds: v.acoes.flatMap((a) => a.leadIds || []) });
  const parados = insights.filter((i) => i.id.startsWith("parados-"));
  parados.forEach((p) => itens.push({ id: p.id, texto: `Retomar ${p.titulo.replace(" parados em", " em")}`, leadIds: p.acoes.flatMap((a) => a.leadIds || []) }));
  if (insights.some((i) => i.id === "registro")) itens.push({ id: "registro", texto: "Registrar os dias que faltam" });
  itens.push({ id: "registrar-hoje", texto: "Registrar o dia de hoje no fim do expediente" });
  return itens;
}
