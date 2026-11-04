// ETIQUETAS DE PROJETO — projeto_origem do lead → etiqueta (Lista) do WhatsApp Business.
// A regra fica no banco (tabela projeto_etiquetas) e a conta é feita por UMA função só:
// resolver_etiqueta_projeto (supabase/projeto_etiquetas.sql). O banco recalcula sozinho a etiqueta
// de todo lead novo ou com projeto alterado (captura Bitrix/Midrah, cadastro, importação, edição);
// o Inmovya Scale põe a etiqueta na conversa do WhatsApp (só adiciona, nunca tira).
import { supabase } from "@/integrations/supabase/client";

export interface RegraProjeto {
  id?: string;
  padrao: string; // "collection + vila mariana" (as duas) · "sarutai | saruutai" (qualquer uma) · "*" (qualquer outro)
  etiqueta: string;
  ordem: number;
  ativo: boolean;
}

export type StatusEtiqueta = "pendente" | "aplicada" | "ja_estava" | "sem_conversa" | "erro";

export const NOME_STATUS: Record<StatusEtiqueta, string> = {
  pendente: "pendente no WhatsApp",
  aplicada: "aplicada no WhatsApp",
  ja_estava: "já estava no WhatsApp",
  sem_conversa: "pendente: sem conversa no WhatsApp",
  erro: "pendente: deu erro, tenta de novo",
};

const faltaSql = (e: any) =>
  /projeto_etiquetas|resolver_etiqueta_projeto|etiqueta_projeto|does not exist|schema cache|PGRST20/i.test(`${e?.message || ""} ${e?.details || ""}`);

export class FaltaSqlEtiquetas extends Error {
  constructor() {
    super("Falta rodar o arquivo supabase/projeto_etiquetas.sql no SQL Editor do Supabase.");
  }
}

/** A função única: projeto_origem → etiqueta(s) de projeto (pergunta ao banco, que usa as suas regras). */
export async function resolverEtiquetaProjeto(projetoOrigem?: string | null): Promise<string[]> {
  if (!String(projetoOrigem || "").trim()) return [];
  const { data, error } = await supabase.rpc("resolver_etiqueta_projeto_web" as any, { p_projeto: projetoOrigem });
  if (error) throw faltaSql(error) ? new FaltaSqlEtiquetas() : error;
  return (data as string[]) || [];
}

export async function listarRegras(): Promise<RegraProjeto[]> {
  const { data, error } = await supabase.from("projeto_etiquetas" as any).select("id, padrao, etiqueta, ordem, ativo").order("ordem").order("created_at");
  if (error) throw faltaSql(error) ? new FaltaSqlEtiquetas() : error;
  return (data as any[]) || [];
}

/** Salva a lista inteira (apaga as que você tirou) e recalcula a etiqueta dos leads. */
export async function salvarRegras(regras: RegraProjeto[], removidas: string[]) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login de novo.");
  if (removidas.length) {
    const { error } = await supabase.from("projeto_etiquetas" as any).delete().in("id", removidas);
    if (error) throw error;
  }
  const limpas = regras
    .map((r) => ({ ...r, padrao: r.padrao.trim(), etiqueta: r.etiqueta.trim() }))
    .filter((r) => r.padrao && r.etiqueta);
  const existentes = limpas.filter((r) => r.id).map((r) => ({ id: r.id, user_id: user.id, padrao: r.padrao, etiqueta: r.etiqueta, ordem: r.ordem, ativo: r.ativo }));
  const novas = limpas.filter((r) => !r.id).map((r) => ({ user_id: user.id, padrao: r.padrao, etiqueta: r.etiqueta, ordem: r.ordem, ativo: r.ativo }));
  if (existentes.length) {
    const { error } = await supabase.from("projeto_etiquetas" as any).upsert(existentes as any);
    if (error) throw error;
  }
  if (novas.length) {
    const { error } = await supabase.from("projeto_etiquetas" as any).insert(novas as any);
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc("etiquetas_projeto_recalcular" as any);
  if (error) throw error;
  return (data as any)?.alterados ?? 0;
}

/** Etiquetas que existem no WhatsApp (o Inmovya Scale manda a lista quando o WhatsApp Web está aberto). */
export async function etiquetasDoWhatsApp(): Promise<{ nomes: string[]; em: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { nomes: [], em: null };
  const { data } = await supabase.from("agente_config" as any).select("etiquetas_wa, etiquetas_wa_em").eq("user_id", user.id).maybeSingle();
  return { nomes: ((data as any)?.etiquetas_wa as string[]) || [], em: (data as any)?.etiquetas_wa_em || null };
}

/** O que a extensão contou da última rodada (ex.: "ok: 10 conferidos…" ou "parou: aperte F5…"). */
export async function diagnosticoExtensao(): Promise<{ texto: string | null; em: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { texto: null, em: null };
  const { data } = await supabase.from("agente_config" as any).select("etiquetas_diag, etiquetas_diag_em").eq("user_id", user.id).maybeSingle();
  return { texto: (data as any)?.etiquetas_diag || null, em: (data as any)?.etiquetas_diag_em || null };
}

/** Botão "Sincronizar etiquetas de projeto": põe todos os leads com projeto na fila do Inmovya Scale. */
export async function sincronizarEtiquetasProjeto(): Promise<{ inicio: string; na_fila: number }> {
  const { data, error } = await supabase.rpc("etiquetas_projeto_sincronizar" as any);
  if (error) throw faltaSql(error) ? new FaltaSqlEtiquetas() : error;
  return data as any;
}

export interface ResumoSincronizacao {
  total: number;
  pendentes: number;
  aplicados: number;
  jaCertos: number;
  semConversa: { id: string; nome: string; telefone: string }[];
  erros: { id: string; nome: string; telefone: string; aviso: string }[];
  avisos: { nome: string; aviso: string }[];
}

export async function resumoEtiquetasProjeto(): Promise<ResumoSincronizacao> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, etiqueta_projeto_status, etiqueta_projeto_aviso" as any)
    .not("etiqueta_projeto" as any, "is", null)
    .limit(5000);
  if (error) throw faltaSql(error) ? new FaltaSqlEtiquetas() : error;
  const linhas = (data as any[]) || [];
  const r: ResumoSincronizacao = { total: linhas.length, pendentes: 0, aplicados: 0, jaCertos: 0, semConversa: [], erros: [], avisos: [] };
  for (const l of linhas) {
    const s = l.etiqueta_projeto_status as StatusEtiqueta | null;
    if (s === "pendente") r.pendentes++;
    else if (s === "aplicada") r.aplicados++;
    else if (s === "ja_estava") r.jaCertos++;
    else if (s === "sem_conversa") r.semConversa.push({ id: l.id, nome: l.nome, telefone: l.telefone });
    else if (s === "erro") r.erros.push({ id: l.id, nome: l.nome, telefone: l.telefone, aviso: l.etiqueta_projeto_aviso || "" });
    if (l.etiqueta_projeto_aviso && s !== "erro") r.avisos.push({ nome: l.nome, aviso: l.etiqueta_projeto_aviso });
  }
  return r;
}
