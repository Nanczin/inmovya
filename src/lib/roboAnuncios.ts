// Robô de anúncios dentro do Inmovya Scale: aqui o Inmovya só guarda as configurações (robo_ext_config)
// e entrega à extensão o mesmo token do agente de 1º contato. Quem conversa no WhatsApp é a extensão.
import { supabase } from "@/integrations/supabase/client";
import { carregarConfigAgente, entregarParaExtensao, salvarConfigAgente } from "@/lib/primeiroContato";

export const VERSAO_SCALE_ROBO = "1.8.0";
export const ERRO_SQL_ROBO = "Falta preparar o banco: rode o arquivo supabase/robo_extensao.sql no SQL Editor do Supabase (uma vez).";
export const FRASES_PADRAO = [
  "tenho interesse",
  "vi o anuncio",
  "vi seu anuncio",
  "vi o seu anuncio",
  "mais informacoes",
  "gostaria de saber mais",
  "quero saber mais",
];

export interface ConfigRobo {
  ativo: boolean;
  ativadoEm: string | null;
  iaChave: string;
  iaModelo: string;
  frases: string[];
  recuperarHoras: number;
  numeroAviso: string;
  testeNumero: string;
  testeDesde: string | null;
}
export interface SinalRobo {
  ultimoSinal: string | null;
  aviso: string | null;
}
export interface ConversaRobo {
  telefone: string;
  nome: string | null;
  situacao: string;
  respostas: Record<string, string>;
  resultado_inmovya: string | null;
  msgs_robo: number;
  updated_at: string;
}

const erroDeTabela = (e: any) =>
  /robo_ext_config|relation .* does not exist|schema cache|could not find the table/i.test(`${e?.message || ""} ${e?.details || ""}`) ||
  ["42P01", "PGRST205", "PGRST204"].includes(e?.code);

async function usuario() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre no Inmovya.");
  return user;
}

export async function carregarRobo(): Promise<{ cfg: ConfigRobo; sinal: SinalRobo }> {
  const user = await usuario();
  const { data, error } = await supabase.from("robo_ext_config" as any).select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw erroDeTabela(error) ? new Error(ERRO_SQL_ROBO) : error;
  const r: any = data;
  return {
    cfg: {
      ativo: !!r?.ativo,
      ativadoEm: r?.ativado_em || null,
      iaChave: r?.ia_chave || "",
      iaModelo: r?.ia_modelo || "openai/gpt-oss-120b",
      frases: r?.frases_anuncio?.length ? r.frases_anuncio : FRASES_PADRAO,
      recuperarHoras: r?.recuperar_horas ?? 12,
      numeroAviso: r?.numero_aviso || "5511988782027",
      testeNumero: r?.teste_numero || "",
      testeDesde: r?.teste_desde || null,
    },
    sinal: { ultimoSinal: r?.ultimo_sinal || null, aviso: r?.aviso || null },
  };
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").toLowerCase().trim();

/** Salva e entrega o token à extensão deste Chrome (o mesmo do 1º contato; cria se ainda não existir). */
export async function salvarRobo(c: ConfigRobo): Promise<{ entregue: boolean }> {
  const user = await usuario();
  const anterior = await carregarRobo().catch(() => null);
  const ativadoEm = c.ativo ? (anterior?.cfg.ativo && c.ativadoEm ? c.ativadoEm : new Date().toISOString()) : null;
  const { error } = await supabase.from("robo_ext_config" as any).upsert(
    {
      user_id: user.id,
      ativo: c.ativo,
      ativado_em: ativadoEm,
      ia_chave: c.iaChave.trim() || null,
      ia_modelo: c.iaModelo.trim() || "openai/gpt-oss-120b",
      frases_anuncio: c.frases.map(semAcento).filter(Boolean),
      recuperar_horas: Math.max(1, Math.min(72, Math.round(c.recuperarHoras || 12))),
      numero_aviso: c.numeroAviso.replace(/\D/g, ""),
      teste_numero: c.testeNumero.replace(/\D/g, "") || null,
      teste_desde: c.testeNumero.replace(/\D/g, "") ? c.testeDesde || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "user_id" }
  );
  if (error) throw erroDeTabela(error) ? new Error(ERRO_SQL_ROBO) : error;
  // token do agente: o robô usa o mesmo. Se ainda não existe, cria sem ligar o 1º contato.
  const { cfg: agente, sinal } = await carregarConfigAgente();
  if (!sinal.temToken) await salvarConfigAgente(agente);
  const entregue = c.ativo ? await entregarParaExtensao(false) : true;
  return { entregue };
}

export async function lerConversasRobo(): Promise<ConversaRobo[]> {
  const user = await usuario();
  const { data, error } = await supabase
    .from("robo_conversas" as any)
    .select("telefone,nome,situacao,respostas,resultado_inmovya,msgs_robo,updated_at,atendido_por")
    .eq("user_id", user.id)
    .eq("atendido_por", "extensao")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return (data as any[]) || [];
}

/** Testa a chave da IA (Groq) com uma pergunta curta. */
export async function testarIA(chave: string, modelo: string): Promise<string> {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo || "openai/gpt-oss-120b",
      max_tokens: 200,
      messages: [{ role: "user", content: "Responda só: Olá! A IA do robô está funcionando." }],
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `A IA respondeu ${r.status}`);
  return String(j?.choices?.[0]?.message?.content || "").trim();
}
