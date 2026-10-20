// Gestor de Métricas — leitura e gravação no Supabase (metas, registros do dia, plano de hoje, ligações).
import { supabase } from "@/integrations/supabase/client";
import { getStageForStatus, normalizeStatus } from "@/lib/negociosStages";
import type { Lead } from "@/context/LeadsContext";
import { LIMITES_PARADO_PADRAO, type EtapaFunil, type LeadParaGestor, type LigacaoSimples, type Metas, type RegistroDia } from "./metricas";

export const METAS_VAZIAS: Metas = {
  interacoes: 0,
  negociacoes: 0,
  visitas: 0,
  documentacoes: 0,
  vendas_qtd: 0,
  vendas_valor: 0,
  leads: 0,
  ligacoes: 0,
  so_dias_uteis: false,
};

const sb = supabase as any; // tabelas novas ainda não estão nos tipos gerados

const usuario = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre no Inmovya de novo.");
  return user.id;
};

const faltaSql = (e: any) => /metas_mensais|plano_diario|venda_valor|does not exist|PGRST20[45]|schema cache/i.test(String(e?.message || ""));
export const ERRO_SQL = "Falta rodar o arquivo supabase/gestor_metricas.sql no SQL Editor do Supabase.";

export async function carregarMetas(mes: string): Promise<{ metas: Metas; existe: boolean }> {
  const uid = await usuario();
  const { data, error } = await sb.from("metas_mensais").select("*").eq("user_id", uid).eq("mes", mes).maybeSingle();
  if (error) throw new Error(faltaSql(error) ? ERRO_SQL : error.message);
  if (!data) return { metas: { ...METAS_VAZIAS }, existe: false };
  const n = (v: any) => Number(v) || 0;
  return {
    existe: true,
    metas: {
      interacoes: n(data.interacoes),
      negociacoes: n(data.negociacoes),
      visitas: n(data.visitas),
      documentacoes: n(data.documentacoes),
      vendas_qtd: n(data.vendas_qtd),
      vendas_valor: n(data.vendas_valor),
      leads: n(data.leads),
      ligacoes: n(data.ligacoes),
      so_dias_uteis: !!data.so_dias_uteis,
    },
  };
}

export async function salvarMetas(mes: string, m: Partial<Metas>) {
  const uid = await usuario();
  const { error } = await sb.from("metas_mensais").upsert({ user_id: uid, mes, ...m }, { onConflict: "user_id,mes" });
  if (error) throw new Error(faltaSql(error) ? ERRO_SQL : error.message);
}

/** Registros do "Registrar o dia" (linhas "dia:AAAA-MM-DD" da powerbi_funnel_metrics). */
export async function carregarRegistros(): Promise<RegistroDia[]> {
  const uid = await usuario();
  const { data, error } = await sb.from("powerbi_funnel_metrics").select("*").eq("user_id", uid).like("period", "dia:%");
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    data: String(r.period).slice(4),
    interacoes: Number(r.interacao_ajuste) || 0,
    negociacoes: Number(r.negociacao) || 0,
    visitas: Number(r.visitas) || 0,
    documentacoes: Number(r.documentacao) || 0,
    vendas: Number(r.venda) || 0,
    venda_valor: Number(r.venda_valor) || 0,
  }));
}

/** Grava os realizados por dia (upsert por data; mantém as ligações já registradas). */
export async function salvarRegistros(registros: RegistroDia[]) {
  if (!registros.length) return;
  const uid = await usuario();
  const { data: atuais } = await sb.from("powerbi_funnel_metrics").select("period, ligacoes").eq("user_id", uid).in("period", registros.map((r) => `dia:${r.data}`));
  const lig = new Map<string, number>((atuais || []).map((a: any) => [a.period, Number(a.ligacoes) || 0]));
  const linhas = registros.map((r) => ({
    user_id: uid,
    period: `dia:${r.data}`,
    interacao_ajuste: r.interacoes,
    negociacao: r.negociacoes,
    visitas: r.visitas,
    documentacao: r.documentacoes,
    venda: r.vendas,
    venda_valor: r.venda_valor,
    ligacoes: lig.get(`dia:${r.data}`) || 0,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("powerbi_funnel_metrics").upsert(linhas, { onConflict: "user_id, period" });
  if (error) throw new Error(faltaSql(error) ? ERRO_SQL : error.message);
}

export async function carregarPlano(dia: string): Promise<string[]> {
  const uid = await usuario();
  const { data, error } = await sb.from("plano_diario").select("feitos").eq("user_id", uid).eq("dia", dia).maybeSingle();
  if (error) throw new Error(faltaSql(error) ? ERRO_SQL : error.message);
  return (data?.feitos as string[]) || [];
}

export async function salvarPlano(dia: string, feitos: string[]) {
  const uid = await usuario();
  const { error } = await sb.from("plano_diario").upsert({ user_id: uid, dia, feitos }, { onConflict: "user_id,dia" });
  if (error) throw new Error(faltaSql(error) ? ERRO_SQL : error.message);
}

const ehInteressado = (resultado: string) => {
  const n = normalizeStatus(resultado);
  return n.includes("interessado") && !n.includes("nao");
};

export async function carregarLigacoes(desde: Date): Promise<LigacaoSimples[]> {
  const uid = await usuario();
  const out: LigacaoSimples[] = [];
  for (let de = 0; de < 20000; de += 1000) {
    const { data, error } = await supabase
      .from("ligacoes")
      .select("data_ligacao, resultado")
      .eq("user_id", uid)
      .gte("data_ligacao", desde.toISOString())
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((l: any) => l.data_ligacao && out.push({ data: l.data_ligacao, interessado: ehInteressado(l.resultado || "") }));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// quanto mais alto, mais perto de fechar
const AVANCO: Record<string, number> = {
  "20": 1,
  "50": 2,
  "70": 3,
  documentacao: 4,
  "fluxo-incorporadora": 5,
  "contrato-enviado": 5,
  "contrato-aberto": 5,
  "objecoes-contrato": 5,
  "90": 6,
  "contrato-assinado": 7,
  "ato-pagamento": 7,
};

export function leadsParaGestor(leads: Lead[], hoje: Date): LeadParaGestor[] {
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return leads.map((l: any) => {
    const etapa = getStageForStatus(l.status)?.id || null;
    const datas = [l.ultimo_contato, l.esteira_ultimo_envio, l.primeiro_contato_status === "enviado" ? l.primeiro_contato_em : null].filter(Boolean) as string[];
    const ultima = datas.sort().pop() || null;
    const temLembreteAberto = (l.tasks || []).some((t: any) => t.due_date && new Date(t.due_date).getTime() >= inicioHoje);
    return { id: l.id, nome: l.nome || "Sem nome", etapa, ultimaInteracao: ultima, temLembreteAberto, avanco: (etapa && AVANCO[etapa]) || 0 };
  });
}

const CHAVE_LIMITES = "inmovya_gestor_parado";
export const lerLimitesParado = (): Record<EtapaFunil, number> => {
  try {
    return { ...LIMITES_PARADO_PADRAO, ...(JSON.parse(localStorage.getItem(CHAVE_LIMITES) || "{}") || {}) };
  } catch {
    return { ...LIMITES_PARADO_PADRAO };
  }
};
export const salvarLimitesParado = (l: Record<EtapaFunil, number>) => {
  try {
    localStorage.setItem(CHAVE_LIMITES, JSON.stringify(l));
  } catch {
    /* ignore */
  }
};
