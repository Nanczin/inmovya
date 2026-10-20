// Gestor de Métricas — cálculos puros (sem banco, sem tela). Tudo determinístico e testável.

export type MetricaId = "interacoes" | "negociacoes" | "visitas" | "documentacoes" | "vendas_qtd" | "vendas_valor" | "leads" | "ligacoes";

export const NOMES: Record<MetricaId, { nome: string; singular: string }> = {
  interacoes: { nome: "interações", singular: "interação" },
  negociacoes: { nome: "negociações", singular: "negociação" },
  visitas: { nome: "visitas", singular: "visita" },
  documentacoes: { nome: "propostas/documentações", singular: "proposta" },
  vendas_qtd: { nome: "vendas", singular: "venda" },
  vendas_valor: { nome: "R$ em vendas", singular: "R$ em vendas" },
  leads: { nome: "leads", singular: "lead" },
  ligacoes: { nome: "ligações", singular: "ligação" },
};

export interface Metas {
  interacoes: number;
  negociacoes: number;
  visitas: number;
  documentacoes: number;
  vendas_qtd: number;
  vendas_valor: number;
  leads: number;
  ligacoes: number;
  so_dias_uteis: boolean;
}

export interface RegistroDia {
  data: string; // AAAA-MM-DD
  interacoes: number;
  negociacoes: number;
  visitas: number;
  documentacoes: number;
  vendas: number;
  venda_valor: number;
}

export type StatusRitmo = "batida" | "no_ritmo" | "atencao" | "fora" | "sem_meta";

export interface ResultadoMetrica {
  id: MetricaId;
  meta: number;
  realizado: number;
  pctAtingido: number; // 0..∞
  falta: number;
  ritmoNecessario: number; // por dia restante
  mediaDiaria: number; // até ontem
  projecao: number;
  pctProjecao: number;
  status: StatusRitmo;
}

// ---------- datas ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const chaveData = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const mesDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const parteMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return { a, m };
};
export const diasNoMes = (mes: string) => {
  const { a, m } = parteMes(mes);
  return new Date(a, m, 0).getDate();
};
export const ehDiaUtil = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** Dias do mês: decorridos (antes de hoje) e restantes (de hoje até o último dia, incluindo hoje). */
export function contarDias(mes: string, hoje: Date, soUteis: boolean) {
  const { a, m } = parteMes(mes);
  const total = diasNoMes(mes);
  const hojeK = chaveData(hoje);
  let decorridos = 0;
  let restantes = 0;
  let totalConta = 0;
  for (let d = 1; d <= total; d++) {
    const dt = new Date(a, m - 1, d);
    if (soUteis && !ehDiaUtil(dt)) continue;
    totalConta++;
    const k = chaveData(dt);
    if (k < hojeK) decorridos++;
    else restantes++;
  }
  return { decorridos, restantes, total: totalConta };
}

/** Dias (úteis) do mês que já passaram — para cobrar o "Registrar o dia". */
export function diasPassados(mes: string, hoje: Date, soUteis = true): string[] {
  const { a, m } = parteMes(mes);
  const hojeK = chaveData(hoje);
  const out: string[] = [];
  for (let d = 1; d <= diasNoMes(mes); d++) {
    const dt = new Date(a, m - 1, d);
    const k = chaveData(dt);
    if (k >= hojeK) break;
    if (soUteis && !ehDiaUtil(dt)) continue;
    out.push(k);
  }
  return out;
}

// ---------- meta x realizado ----------
export function somarRegistros(registros: RegistroDia[], mes: string) {
  const t = { interacoes: 0, negociacoes: 0, visitas: 0, documentacoes: 0, vendas_qtd: 0, vendas_valor: 0 };
  for (const r of registros) {
    if (!r.data.startsWith(mes)) continue;
    t.interacoes += r.interacoes || 0;
    t.negociacoes += r.negociacoes || 0;
    t.visitas += r.visitas || 0;
    t.documentacoes += r.documentacoes || 0;
    t.vendas_qtd += r.vendas || 0;
    t.vendas_valor += r.venda_valor || 0;
  }
  return t;
}

export function calcularMetrica(id: MetricaId, meta: number, realizado: number, dias: { decorridos: number; restantes: number }): ResultadoMetrica {
  const falta = Math.max(0, meta - realizado);
  const mediaDiaria = dias.decorridos > 0 ? realizado / dias.decorridos : realizado;
  const ritmoNecessario = dias.restantes > 0 ? falta / dias.restantes : falta;
  const projecao = realizado + mediaDiaria * dias.restantes;
  const pctAtingido = meta > 0 ? (realizado / meta) * 100 : 0;
  const pctProjecao = meta > 0 ? (projecao / meta) * 100 : 0;
  let status: StatusRitmo;
  if (meta <= 0) status = "sem_meta";
  else if (realizado >= meta) status = "batida";
  else if (pctProjecao >= 100) status = "no_ritmo";
  else if (pctProjecao >= 80) status = "atencao";
  else status = "fora";
  return { id, meta, realizado, pctAtingido, falta, ritmoNecessario, mediaDiaria, projecao, pctProjecao, status };
}

// ---------- conversões entre etapas ----------
export const ETAPAS_CONVERSAO: [MetricaId, MetricaId][] = [
  ["interacoes", "negociacoes"],
  ["negociacoes", "visitas"],
  ["visitas", "documentacoes"],
  ["documentacoes", "vendas_qtd"],
];

export interface Conversao {
  de: MetricaId;
  para: MetricaId;
  realizadoDe: number;
  realizadoPara: number;
  taxaReal: number | null; // %
  taxaMeta: number | null; // %
  queda: number | null; // 0..1 (quanto a real está abaixo da da meta)
  amostraSuficiente: boolean;
}

/** Amostra mínima na etapa de origem para a conversão contar (evita "0 de 1 = 0%"). */
export const AMOSTRA_MINIMA = 5;

export function calcularConversoes(realizado: Partial<Record<MetricaId, number>>, metas: Partial<Record<MetricaId, number>>): Conversao[] {
  return ETAPAS_CONVERSAO.map(([de, para]) => {
    const rDe = realizado[de] || 0;
    const rPara = realizado[para] || 0;
    const mDe = metas[de] || 0;
    const mPara = metas[para] || 0;
    const taxaReal = rDe > 0 ? (rPara / rDe) * 100 : null;
    const taxaMeta = mDe > 0 ? (mPara / mDe) * 100 : null;
    const queda = taxaReal !== null && taxaMeta !== null && taxaMeta > 0 ? (taxaMeta - taxaReal) / taxaMeta : null;
    return { de, para, realizadoDe: rDe, realizadoPara: rPara, taxaReal, taxaMeta, queda, amostraSuficiente: rDe >= AMOSTRA_MINIMA };
  });
}

/** Gargalo = etapa com a maior queda relativa versus a conversão da meta (só com amostra suficiente e queda > 0). */
export function acharGargalo(conversoes: Conversao[]): Conversao | null {
  let pior: Conversao | null = null;
  for (const c of conversoes) {
    if (!c.amostraSuficiente || c.queda === null || c.queda <= 0) continue;
    if (!pior || (c.queda as number) > (pior.queda as number)) pior = c;
  }
  return pior;
}

// ---------- dia da semana ----------
export const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const DIAS_SEMANA_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

export interface DesempenhoSemana {
  dia: number; // 0=domingo
  registros: number;
  mediaInteracoes: number;
  mediaVisitas: number;
}

export function desempenhoPorDiaSemana(registros: RegistroDia[]): DesempenhoSemana[] {
  const acc = Array.from({ length: 7 }, (_, dia) => ({ dia, registros: 0, i: 0, v: 0 }));
  for (const r of registros) {
    const [a, m, d] = r.data.split("-").map(Number);
    const dia = new Date(a, m - 1, d).getDay();
    acc[dia].registros++;
    acc[dia].i += r.interacoes || 0;
    acc[dia].v += r.visitas || 0;
  }
  return acc.map((x) => ({
    dia: x.dia,
    registros: x.registros,
    mediaInteracoes: x.registros ? x.i / x.registros : 0,
    mediaVisitas: x.registros ? x.v / x.registros : 0,
  }));
}

// ---------- Oferta Ativa ----------
export interface LigacaoSimples {
  data: string; // ISO
  interessado: boolean;
}

export function ofertaAtiva(ligacoes: LigacaoSimples[], inicio: Date, fim: Date, inicioAnt: Date) {
  const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
  const t = (l: LigacaoSimples) => new Date(l.data).getTime();
  const atual = ligacoes.filter((l) => t(l) >= inicio.getTime() && t(l) < fim.getTime());
  const ant = ligacoes.filter((l) => t(l) >= inicioAnt.getTime() && t(l) < inicio.getTime());
  const taxa = (xs: LigacaoSimples[]) => (xs.length ? (xs.filter((l) => l.interessado).length / xs.length) * 100 : null);
  const taxaAtual = taxa(atual);
  const taxaAnterior = taxa(ant);
  const variacao = taxaAtual !== null && taxaAnterior !== null && taxaAnterior > 0 ? (taxaAtual - taxaAnterior) / taxaAnterior : null;
  return {
    ligacoes: atual.length,
    ligacoesAnterior: ant.length,
    porDia: atual.length / dias,
    porDiaAnterior: ant.length / dias,
    taxaInteresse: taxaAtual,
    taxaInteresseAnterior: taxaAnterior,
    variacaoTaxa: variacao,
  };
}

// ---------- leads parados ----------
export type EtapaFunil = "20" | "50" | "70";
export const LIMITES_PARADO_PADRAO: Record<EtapaFunil, number> = { "20": 2, "50": 3, "70": 2 };

export interface LeadParaGestor {
  id: string;
  nome: string;
  etapa: string | null; // id da etapa (20, 50, 70, documentacao, ...)
  ultimaInteracao: string | null; // ISO
  temLembreteAberto: boolean; // lembrete pendente com data de hoje em diante
  avanco: number; // quanto mais alto, mais perto de fechar
}

export function leadsParados(leads: LeadParaGestor[], hoje: Date, limites: Record<EtapaFunil, number> = LIMITES_PARADO_PADRAO) {
  const out: Record<EtapaFunil, (LeadParaGestor & { diasParado: number })[]> = { "20": [], "50": [], "70": [] };
  for (const l of leads) {
    const e = l.etapa as EtapaFunil;
    if (!(e in out) || l.temLembreteAberto) continue;
    const ult = l.ultimaInteracao ? new Date(l.ultimaInteracao).getTime() : 0;
    const diasParado = ult ? Math.floor((hoje.getTime() - ult) / 86400000) : 999;
    if (diasParado > limites[e]) out[e].push({ ...l, diasParado });
  }
  (Object.keys(out) as EtapaFunil[]).forEach((e) => out[e].sort((a, b) => b.diasParado - a.diasParado));
  return out;
}

// ---------- tudo junto ----------
export interface EntradaGestor {
  mes: string;
  hoje: Date;
  metas: Metas;
  registros: RegistroDia[];
  leadsNoMes: number;
  ligacoesNoMes: number;
}

export function calcularMes(e: EntradaGestor) {
  const dias = contarDias(e.mes, e.hoje, e.metas.so_dias_uteis);
  const soma = somarRegistros(e.registros, e.mes);
  const realizado: Record<MetricaId, number> = { ...soma, leads: e.leadsNoMes, ligacoes: e.ligacoesNoMes };
  const ids: MetricaId[] = ["interacoes", "negociacoes", "visitas", "documentacoes", "vendas_qtd", "vendas_valor", "leads", "ligacoes"];
  const metricas = ids.map((id) => calcularMetrica(id, e.metas[id] || 0, realizado[id] || 0, dias));
  const conversoes = calcularConversoes(realizado, e.metas);
  return { dias, realizado, metricas, conversoes, gargalo: acharGargalo(conversoes) };
}
