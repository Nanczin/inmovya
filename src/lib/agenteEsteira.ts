// Agente da esteira: lê a conversa do lead no WhatsApp (pelo Inmovya Scale), um LLM analisa se a
// resposta foi positiva, negativa ou neutra, aplica as regras e guarda um relatório por lead.
//   • sem resposta no fim da esteira → tag "disparo" + sai do funil (Inmovya) e etiqueta Lead (WhatsApp)
//   • positiva → sobe para 50% (Inmovya e WhatsApp) e sai da esteira
//   • negativa / neutra → sai da esteira e avisa (você decide o resto)
import { supabase } from "@/integrations/supabase/client";
import { carregarConfiguracoes, salvarConfiguracoes } from "@/lib/supabase";
import { getStageForStatus } from "@/lib/negociosStages";
import { checarExtensao, etiquetasDaEsteira, extensaoAtualizada, telefoneWhatsApp } from "@/lib/esteiras";
import { isWhatsAppOcupado, setWhatsAppOcupado } from "@/lib/etiquetasWhatsApp";

export type Classificacao = "sem_resposta" | "positiva" | "negativa" | "neutra";

export interface MensagemWA {
  dir: "in" | "out";
  data: string | null; // "DD/MM/AAAA"
  hora: string | null; // "HH:MM"
  texto: string;
  tipo: string;
}

export interface RelatorioAgente {
  id: string;
  em: string;
  leadId: string;
  nome: string;
  telefone: string;
  esteira: string;
  momento: "antes do envio" | "fim da esteira" | "verificação";
  classificacao: Classificacao;
  resumo: string;
  sugestao: string;
  respostas: string[]; // o que o lead escreveu
  acoes: string[];
  erro?: string;
  via: string; // "IA (Gemini)", "IA (OpenAI)" ou "regras"
}

// ---------- Configuração ----------
const CFG_KEY = "inmovya_agente_esteira";
export const getAgenteAtivo = () => {
  try {
    return localStorage.getItem(CFG_KEY) !== "0";
  } catch {
    return true;
  }
};
export const setAgenteAtivo = (v: boolean) => {
  try {
    localStorage.setItem(CFG_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
};

// ---------- Relatório (fica neste navegador) ----------
const REL_KEY = "inmovya_agente_relatorio";
const ouvintes = new Set<() => void>();
let relatorioCache: RelatorioAgente[] | null = null;
export const lerRelatorio = (): RelatorioAgente[] => {
  if (relatorioCache) return relatorioCache;
  try {
    relatorioCache = JSON.parse(localStorage.getItem(REL_KEY) || "[]");
  } catch {
    relatorioCache = [];
  }
  return relatorioCache!;
};
const salvarRelatorio = (r: RelatorioAgente) => {
  // "ainda sem resposta" é um estado: guarda só o mais recente de cada lead
  const anteriores = lerRelatorio().filter(
    (x) => !(x.leadId === r.leadId && x.classificacao === "sem_resposta" && x.momento !== "fim da esteira")
  );
  relatorioCache = [r, ...anteriores].slice(0, 300);
  try {
    localStorage.setItem(REL_KEY, JSON.stringify(relatorioCache));
  } catch {
    /* ignore */
  }
  ouvintes.forEach((f) => f());
};
export const limparRelatorio = () => {
  relatorioCache = [];
  try {
    localStorage.removeItem(REL_KEY);
  } catch {
    /* ignore */
  }
  ouvintes.forEach((f) => f());
};
export const assinarRelatorio = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};

// ---------- Ponte com o Inmovya Scale ----------
const pedirExtensao = (detail: Record<string, any>, timeoutMs = 120000) =>
  new Promise<any>((resolve, reject) => {
    const token = crypto.randomUUID();
    const t = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu a tempo."));
    }, timeoutMs);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(t);
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      event.detail?.ok ? resolve(event.detail) : reject(new Error(event.detail?.error || "Falha no WhatsApp."));
    };
    window.addEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_AGENT", { detail: { ...detail, token, background: true } }));
  });

export const agenteDisponivel = () => extensaoAtualizada("1.5.0");

export async function lerConversa(telefone: string): Promise<MensagemWA[]> {
  const r = await pedirExtensao({ op: "read", phone: telefoneWhatsApp(telefone) });
  return Array.isArray(r.mensagens) ? r.mensagens : [];
}

export async function trocarEtiquetas(telefone: string, add: string[], remove: string[]) {
  const r = await pedirExtensao({ op: "labels", phone: telefoneWhatsApp(telefone), add, remove });
  return { alteracoes: (r.alteracoes || []) as string[], etiquetas: (r.etiquetas || []) as string[] };
}

// ---------- Leitura das respostas ----------
const paraData = (m: MensagemWA) => {
  if (!m.data || !m.hora) return null;
  const [d, mes, a] = m.data.split("/").map((n) => parseInt(n, 10));
  const [h, min] = m.hora.split(":").map((n) => parseInt(n, 10));
  if (!d || !mes || !a) return null;
  return new Date(a, mes - 1, d, h || 0, min || 0).getTime();
};

/** Mensagens do lead depois do último envio da esteira (ou depois da sua última mensagem). */
export function respostasDepois(mensagens: MensagemWA[], desdeIso?: string | null) {
  const desde = desdeIso ? new Date(desdeIso).getTime() - 60_000 : null;
  const ultimaSua = mensagens.map((m) => m.dir).lastIndexOf("out");
  return mensagens.filter((m, i) => {
    if (m.dir !== "in") return false;
    const t = paraData(m);
    if (desde && t) return t >= desde;
    return i > ultimaSua; // sem data: conta se veio depois da sua última mensagem
  });
}

// ---------- Análise (LLM) ----------
// Prioridade: Google Gemini (plano gratuito) → OpenAI → regras por palavras.
type ChavesIA = { gemini: string | null; openai: string | null };
let chavesCache: ChavesIA | undefined;
let chavesEm = 0;
async function chavesIA(): Promise<ChavesIA> {
  if (chavesCache && Date.now() - chavesEm < 5 * 60_000) return chavesCache;
  const okOpenAI = (k?: string) => (k && k.startsWith("sk-") && !k.includes("...") ? k : null);
  const okGemini = (k?: string) => (k && k.trim().length > 20 ? k.trim() : null);
  let ia: any = null;
  try {
    ia = JSON.parse(localStorage.getItem("inmovya_config") || "null")?.ia || null;
  } catch {
    /* ignore */
  }
  if (!okGemini(ia?.gemini_key) && !okOpenAI(ia?.openai_key)) {
    try {
      const r: any = await carregarConfiguracoes();
      ia = (r?.data || r)?.ia || ia;
    } catch {
      /* ignore */
    }
  }
  chavesEm = Date.now();
  return (chavesCache = { gemini: okGemini(ia?.gemini_key), openai: okOpenAI(ia?.openai_key) });
}

/** Lê a chave do Gemini salva (para mostrar na tela do agente). */
export async function lerChaveGemini(): Promise<string> {
  const c = await chavesIA();
  return c.gemini || "";
}

/** Salva a chave do Gemini neste navegador e nas Configurações do Inmovya (banco). */
export async function salvarChaveGemini(chave: string) {
  const k = chave.trim();
  try {
    const atual = JSON.parse(localStorage.getItem("inmovya_config") || "{}");
    localStorage.setItem("inmovya_config", JSON.stringify({ ...atual, ia: { ...(atual.ia || {}), gemini_key: k } }));
  } catch {
    /* ignore */
  }
  chavesCache = undefined;
  try {
    const r: any = await carregarConfiguracoes();
    const cfg = r?.data || {};
    await salvarConfiguracoes({ ...cfg, ia: { ...(cfg.ia || {}), gemini_key: k } } as any);
  } catch {
    /* fica salvo neste navegador */
  }
}

/** Testa a chave no Google. */
export async function testarChaveGemini(chave: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(chave.trim())}`);
  return r.ok;
}

const MODELOS_GEMINI = ["gemini-2.5-flash", "gemini-flash-latest"];

async function perguntarGemini(chave: string, prompt: string) {
  let ultimoErro = "";
  for (const modelo of MODELOS_GEMINI) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      }
    );
    if (resp.status === 404 || resp.status >= 500) {
      // modelo desativado ou sobrecarregado ("high demand"): tenta o próximo
      ultimoErro = resp.status === 404 ? `modelo ${modelo} indisponível` : "Gemini sobrecarregado no momento";
      continue;
    }
    if (!resp.ok) throw new Error(resp.status === 429 ? "limite grátis do Gemini atingido por agora" : `Gemini indisponível (${resp.status})`);
    const json = await resp.json();
    const texto = (json.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
    return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, "") || "{}");
  }
  throw new Error(ultimoErro || "Gemini indisponível");
}

async function perguntarOpenAI(chave: string, prompt: string) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI indisponível (${resp.status})`);
  const json = await resp.json();
  return JSON.parse(json.choices?.[0]?.message?.content || "{}");
}

const NEG = /(n[aã]o\s+(tenho|tenho mais)\s+interesse|sem interesse|n[aã]o quero|n[aã]o me (mande|envie|chame)|pare de|para de|remov|descadastr|tira(r)? meu n[uú]mero|j[aá] comprei|n[aã]o (estou|to|tô) procurando|n[aã]o obrigad|bloque|engano|n[uú]mero errado|n[aã]o sou)/i;
const POS = /(tenho interesse|quero|me (manda|envia|liga|chama)|pode (mandar|enviar|ligar)|gostei|interessad|qual (o )?valor|quanto|pre[cç]o|tabela|planta|visita|agendar|hor[aá]rio|sim\b|claro|manda|envia|mais informa|detalhes|condi[cç][oõ]es|entrada|financ)/i;

function analisarPorRegras(textos: string[]): { classificacao: Classificacao; resumo: string; sugestao: string } {
  const t = textos.join(" \n ");
  if (NEG.test(t)) return { classificacao: "negativa", resumo: "Resposta indica falta de interesse.", sugestao: "Confirme se quer encerrar o contato." };
  if (POS.test(t)) return { classificacao: "positiva", resumo: "Resposta indica interesse.", sugestao: "Responda e avance na qualificação." };
  return { classificacao: "neutra", resumo: "Respondeu, mas sem sinal claro de interesse.", sugestao: "Responda pessoalmente para entender o momento do lead." };
}

async function analisarComIA(
  chaves: ChavesIA,
  lead: { nome: string; observacoes?: string | null },
  esteira: string,
  conversa: MensagemWA[],
  respostas: MensagemWA[]
) {
  const historico = conversa
    .slice(-14)
    .map((m) => `${m.dir === "in" ? "LEAD" : "CORRETOR"}${m.data ? ` (${m.data} ${m.hora || ""})` : ""}: ${m.texto || `[${m.tipo}]`}`)
    .join("\n");
  const prompt = `Você é o assistente de um corretor de imóveis (público principalmente investidor). O lead "${lead.nome}" estava numa esteira de follow-up ("${esteira}")${lead.observacoes ? ` e procura: ${String(lead.observacoes).slice(0, 200)}` : ""}.
Analise as RESPOSTAS do lead depois da última mensagem da esteira e classifique:
- "positiva": demonstra interesse, pede informação, valor, material, visita, ligação, ou aceita continuar.
- "negativa": não tem interesse, já comprou, pede para parar, número errado, irritação.
- "neutra": respondeu sem sinal claro (ex.: "quem é?", "ok", figurinha, áudio sem contexto, "depois vejo").
Responda só em JSON: {"classificacao":"positiva|negativa|neutra","resumo":"1 frase sobre o que o lead disse","sugestao":"próximo passo curto e prático para o corretor"}

CONVERSA (mais recentes no fim):
${historico}

RESPOSTAS DO LEAD A CLASSIFICAR:
${respostas.map((m) => `- ${m.texto || `[${m.tipo}]`}`).join("\n")}`;
  const out = chaves.gemini ? await perguntarGemini(chaves.gemini, prompt) : await perguntarOpenAI(chaves.openai!, prompt);
  const c = String(out.classificacao || "").toLowerCase();
  return {
    classificacao: (["positiva", "negativa", "neutra"].includes(c) ? c : "neutra") as Classificacao,
    resumo: String(out.resumo || "").slice(0, 300),
    sugestao: String(out.sugestao || "").slice(0, 300),
  };
}

// ---------- Regras ----------
const ETIQUETAS_FUNIL = ["Bitrix", "20%", "50%", "70%", "75%"];

export interface LeadAgente {
  id: string;
  nome: string;
  telefone: string;
  status?: string | null;
  tags?: string[] | null;
  observacoes?: string | null;
  esteira_ultimo_envio?: string | null;
}

/**
 * Lê a conversa, analisa e aplica as regras. Devolve o relatório.
 * momento "antes do envio": só age se o lead respondeu (sem resposta → segue a esteira normalmente).
 * momento "fim da esteira": sem resposta → disparo + Lead.
 */
export interface EsteiraAgente {
  nome: string;
  ao_concluir_tag?: string | null;
  ao_concluir_etapa?: string | null;
}

/** Quando o lead começou esta esteira (1º envio registrado no histórico, últimos 60 dias). */
async function inicioDaEsteira(leadId: string, esteiraNome: string, fallback?: string | null) {
  try {
    const desde = new Date(Date.now() - 60 * 86400_000).toISOString();
    const { data } = await supabase
      .from("lead_timeline")
      .select("created_at")
      .eq("lead_id", leadId)
      .eq("author", "Esteira")
      .like("title", `Esteira ${esteiraNome} —%`)
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(1);
    return (data as any)?.[0]?.created_at || fallback || null;
  } catch {
    return fallback || null;
  }
}

export async function rodarAgente(lead: LeadAgente, esteiraInfo: EsteiraAgente, momento: RelatorioAgente["momento"]): Promise<RelatorioAgente> {
  const esteiraNome = esteiraInfo.nome;
  const rel: RelatorioAgente = {
    id: crypto.randomUUID(),
    em: new Date().toISOString(),
    leadId: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    esteira: esteiraNome,
    momento,
    classificacao: "sem_resposta",
    resumo: "",
    sugestao: "",
    respostas: [],
    acoes: [],
    via: "regras",
  };
  try {
    const conversa = await lerConversa(lead.telefone);
    // respostas desde o 1º envio desta esteira (pega também quem respondeu antes do agente existir)
    const desde = await inicioDaEsteira(lead.id, esteiraNome, lead.esteira_ultimo_envio);
    const respostas = respostasDepois(conversa, desde);
    rel.respostas = respostas.map((m) => m.texto || `[${m.tipo}]`).slice(-10);

    if (!respostas.length) {
      rel.classificacao = "sem_resposta";
      if (momento !== "fim da esteira") {
        const ultimaSua = [...conversa].reverse().find((m) => m.dir === "out");
        rel.resumo = "Ainda não respondeu — segue na esteira.";
        rel.sugestao = ultimaSua ? `Última mensagem sua: ${ultimaSua.data || ""} ${ultimaSua.hora || ""}`.trim() : "";
        if (momento === "verificação") salvarRelatorio(rel); // aparece no relatório (sem duplicar)
        return rel;
      }
      rel.resumo = "Terminou a esteira sem responder.";
      rel.sugestao = "Lead vai para a lista de disparo.";
      // Inmovya: tags do fim da esteira (padrão "disparo"), etapa do fim (ex.: Perdido) ou sai do funil
      const tagsFim = etiquetasDaEsteira(esteiraInfo);
      const novasTags = tagsFim.length ? tagsFim : ["disparo"];
      const tags = Array.from(new Set([...(lead.tags || []), ...novasTags]));
      const etapaFim = (esteiraInfo.ao_concluir_etapa || "").trim() || null;
      let { error } = await supabase
        .from("leads")
        .update({ tags, status: etapaFim, esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any)
        .eq("id", lead.id);
      if (error) ({ error } = await supabase.from("leads").update({ tags, esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any).eq("id", lead.id));
      if (error) throw error;
      rel.acoes.push(`Inmovya: tag ${novasTags.join(", ")}, ${etapaFim ? `foi para ${etapaFim}` : "saiu do funil"} e da esteira`);
      // WhatsApp: etiqueta Lead
      const wa = await trocarEtiquetas(lead.telefone, ["Lead"], ETIQUETAS_FUNIL);
      rel.acoes.push(`WhatsApp: ${wa.alteracoes.length ? wa.alteracoes.join(", ") : "etiquetas já estavam certas"}`);
    } else {
      const chaves = await chavesIA();
      let analise;
      if (chaves.gemini || chaves.openai) {
        try {
          analise = await analisarComIA(chaves, lead, esteiraNome, conversa, respostas);
          rel.via = chaves.gemini ? "IA (Gemini)" : "IA (OpenAI)";
        } catch (e: any) {
          analise = analisarPorRegras(rel.respostas);
          rel.erro = `${e?.message || "IA falhou"} — usei regras por palavras`;
        }
      } else {
        analise = analisarPorRegras(rel.respostas);
      }
      Object.assign(rel, analise);

      if (rel.classificacao === "positiva") {
        const atual = getStageForStatus(lead.status)?.id;
        const sobe = !atual || atual === "20" || ["validacao", "primeiro-impacto", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "respondeu", "lista-fria"].includes(atual);
        const update: Record<string, any> = { esteira_id: null, esteira_passo: 0, esteira_proximo: null };
        if (sobe) update.status = "50%";
        const { error } = await supabase.from("leads").update(update as any).eq("id", lead.id);
        if (error) throw error;
        rel.acoes.push(sobe ? "Inmovya: subiu para 50% e saiu da esteira" : "Inmovya: saiu da esteira (já estava em 50% ou mais)");
        if (sobe) {
          const wa = await trocarEtiquetas(lead.telefone, ["50%"], ["Bitrix", "20%", "Lead"]);
          rel.acoes.push(`WhatsApp: ${wa.alteracoes.length ? wa.alteracoes.join(", ") : "etiquetas já estavam certas"}`);
        }
      } else {
        const { error } = await supabase.from("leads").update({ esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any).eq("id", lead.id);
        if (error) throw error;
        rel.acoes.push("Inmovya: saiu da esteira (não recebe mais mensagens automáticas)");
      }
    }
    // histórico no card do lead
    await supabase.from("lead_timeline").insert({
      lead_id: lead.id,
      type: "note",
      title: `Agente da esteira — ${rotulo(rel.classificacao)}`,
      description: [rel.resumo, rel.sugestao && `Sugestão: ${rel.sugestao}`, rel.respostas.length && `Lead: ${rel.respostas.join(" / ")}`, rel.acoes.join("\n")]
        .filter(Boolean)
        .join("\n"),
      author: "Agente",
    } as any);
  } catch (e: any) {
    rel.erro = e?.message || "Falha no agente";
  }
  salvarRelatorio(rel);
  return rel;
}

export const rotulo = (c: Classificacao, momento?: RelatorioAgente["momento"]) =>
  c === "sem_resposta" && momento && momento !== "fim da esteira"
    ? "Sem resposta (segue na esteira)"
    : ({ sem_resposta: "Sem resposta → disparo", positiva: "Positiva → 50%", negativa: "Negativa", neutra: "Neutra" })[c];

// ---------- Modo rápido (lote): uma janela do WhatsApp, busca por número, lê a lista de conversas ----------
export interface InfoConversa {
  nome: string;
  ultimaMensagem: string;
  ultimaSua: boolean; // a última mensagem da conversa é sua (tem tique)
  quando: string; // "19:09", "ontem", "sexta-feira", "12/10/2026"
  naoLidas: number;
  etiquetas: string[];
}
type ItemLote = { id: string; op: "scan" | "labels"; phone: string; add?: string[]; remove?: string[] };

async function lote(itens: ItemLote[]): Promise<Record<string, any>> {
  if (!itens.length) return {};
  const r = await pedirExtensao({ op: "batch", itens }, 90_000 + itens.length * 25_000);
  const out: Record<string, any> = {};
  (r.resultados || []).forEach((x: any) => (out[x.id] = x));
  return out;
}

/** Data aproximada do "quando" da lista de conversas (hora de hoje, ontem, dia da semana ou data). */
function dataDoQuando(q: string): Date | null {
  const t = String(q || "").trim().toLowerCase();
  const hoje = new Date();
  let m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), +m[1], +m[2]);
  if (t === "ontem") return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1, 23, 59);
  const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const i = dias.indexOf(t);
  if (i >= 0) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59);
    let volta = (hoje.getDay() - i + 7) % 7 || 7;
    d.setDate(d.getDate() - volta);
    return d;
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return new Date(+(m[3].length === 2 ? "20" + m[3] : m[3]), +m[2] - 1, +m[1], 23, 59);
  return null;
}

/** Sua última mensagem foi depois do último envio da esteira? (= você está conversando com o lead) */
function voceConversando(info: InfoConversa, ultimoEnvio?: string | null) {
  if (!info.ultimaSua || !ultimoEnvio) return false;
  const q = dataDoQuando(info.quando);
  if (!q) return false;
  const envio = new Date(ultimoEnvio);
  const soDia = /^\d{1,2}:\d{2}$/.test(String(info.quando).trim()) ? false : true;
  if (soDia) return new Date(q.getFullYear(), q.getMonth(), q.getDate()) > new Date(envio.getFullYear(), envio.getMonth(), envio.getDate());
  return q.getTime() > envio.getTime() + 10 * 60_000;
}

interface EntradaLote {
  lead: LeadAgente;
  esteira: EsteiraAgente;
  noFim: boolean;
  momento: RelatorioAgente["momento"];
}

/**
 * Confere vários leads de uma vez (rápido): 1) lê a lista de conversas de todos numa janela só;
 * 2) a IA analisa quem respondeu; 3) aplica as regras no Inmovya; 4) troca as etiquetas no WhatsApp numa janela só.
 */
export async function processarLote(
  entradas: EntradaLote[],
  aoProgredir?: (atual: number, total: number, nome: string) => void
): Promise<RelatorioAgente[]> {
  const rels: RelatorioAgente[] = [];
  const etiquetasPorLead: Record<string, { add: string[]; remove: string[]; rel: RelatorioAgente }> = {};
  const TAM = 6;
  for (let i = 0; i < entradas.length; i += TAM) {
    const pedaco = entradas.slice(i, i + TAM);
    aoProgredir?.(Math.min(i + pedaco.length, entradas.length), entradas.length, pedaco.map((e) => e.lead.nome).join(", "));
    let res: Record<string, any> = {};
    try {
      res = await lote(pedaco.map((e) => ({ id: e.lead.id, op: "scan" as const, phone: telefoneWhatsApp(e.lead.telefone) })));
    } catch (e: any) {
      pedaco.forEach((x) => (res[x.lead.id] = { ok: false, error: e?.message || "Falha no WhatsApp" }));
    }
    for (const { lead, esteira, noFim, momento } of pedaco) {
      const r = res[lead.id] || {};
      const rel: RelatorioAgente = {
        id: crypto.randomUUID(),
        em: new Date().toISOString(),
        leadId: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        esteira: esteira.nome,
        momento: noFim ? "fim da esteira" : momento,
        classificacao: "sem_resposta",
        resumo: "",
        sugestao: "",
        respostas: [],
        acoes: [],
        via: "regras",
      };
      try {
        if (!r.ok) throw new Error(r.error || "Falha ao ler o WhatsApp");
        if (!r.encontrado) throw new Error("Conversa não encontrada no WhatsApp (confira o número).");
        const info = r.info as InfoConversa;
        if (info.ultimaSua) {
          if (voceConversando(info, lead.esteira_ultimo_envio)) {
            // você mandou mensagem depois da esteira: conversa ativa, a esteira para
            rel.classificacao = "neutra";
            rel.resumo = "Você está conversando com o lead (sua mensagem é mais recente que a da esteira).";
            rel.sugestao = "Siga a conversa manualmente.";
            const { error } = await supabase.from("leads").update({ esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any).eq("id", lead.id);
            if (error) throw error;
            rel.acoes.push("Inmovya: saiu da esteira");
          } else if (!noFim) {
            rel.resumo = "Ainda não respondeu — segue na esteira.";
            rel.sugestao = info.quando ? `Última mensagem sua: ${info.quando}` : "";
            rels.push(rel);
            salvarRelatorio(rel);
            continue;
          } else {
            // fim da esteira sem resposta
            rel.resumo = "Terminou a esteira sem responder.";
            rel.sugestao = "Lead vai para a lista de disparo.";
            const tagsFim = etiquetasDaEsteira(esteira);
            const novasTags = tagsFim.length ? tagsFim : ["disparo"];
            const tags = Array.from(new Set([...(lead.tags || []), ...novasTags]));
            const etapaFim = (esteira.ao_concluir_etapa || "").trim() || null;
            let { error } = await supabase.from("leads").update({ tags, status: etapaFim, esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any).eq("id", lead.id);
            if (error) ({ error } = await supabase.from("leads").update({ tags, esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any).eq("id", lead.id));
            if (error) throw error;
            rel.acoes.push(`Inmovya: tag ${novasTags.join(", ")}, ${etapaFim ? `foi para ${etapaFim}` : "saiu do funil"} e da esteira`);
            etiquetasPorLead[lead.id] = { add: ["Lead"], remove: ETIQUETAS_FUNIL, rel };
          }
        } else {
          // a última mensagem é do lead: respondeu
          rel.respostas = [info.ultimaMensagem || "[mídia]"];
          const conversa: MensagemWA[] = [{ dir: "in", data: null, hora: info.quando, texto: info.ultimaMensagem, tipo: info.ultimaMensagem ? "texto" : "mídia" }];
          const chaves = await chavesIA();
          let analise;
          if (chaves.gemini || chaves.openai) {
            try {
              analise = await analisarComIA(chaves, lead, esteira.nome, conversa, conversa);
              rel.via = chaves.gemini ? "IA (Gemini)" : "IA (OpenAI)";
            } catch (e: any) {
              analise = analisarPorRegras(rel.respostas);
              rel.erro = `${e?.message || "IA falhou"} — usei regras por palavras`;
            }
          } else analise = analisarPorRegras(rel.respostas);
          Object.assign(rel, analise);
          if (info.naoLidas > 1) rel.resumo = `${rel.resumo} (${info.naoLidas} mensagens não lidas — abra a conversa)`.trim();
          if (rel.classificacao === "positiva") {
            const atual = getStageForStatus(lead.status)?.id;
            const sobe = !atual || atual === "20" || ["validacao", "primeiro-impacto", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "respondeu", "lista-fria"].includes(atual);
            const update: Record<string, any> = { esteira_id: null, esteira_passo: 0, esteira_proximo: null };
            if (sobe) update.status = "50%";
            const { error } = await supabase.from("leads").update(update as any).eq("id", lead.id);
            if (error) throw error;
            rel.acoes.push(sobe ? "Inmovya: subiu para 50% e saiu da esteira" : "Inmovya: saiu da esteira (já estava em 50% ou mais)");
            if (sobe) etiquetasPorLead[lead.id] = { add: ["50%"], remove: ["Bitrix", "20%", "Lead"], rel };
          } else {
            const { error } = await supabase.from("leads").update({ esteira_id: null, esteira_passo: 0, esteira_proximo: null } as any).eq("id", lead.id);
            if (error) throw error;
            rel.acoes.push("Inmovya: saiu da esteira (não recebe mais mensagens automáticas)");
          }
        }
        await supabase.from("lead_timeline").insert({
          lead_id: lead.id,
          type: "note",
          title: `Agente da esteira — ${rotulo(rel.classificacao, rel.momento)}`,
          description: [rel.resumo, rel.sugestao && `Sugestão: ${rel.sugestao}`, rel.respostas.length && `Lead: ${rel.respostas.join(" / ")}`, rel.acoes.join("\n")]
            .filter(Boolean)
            .join("\n"),
          author: "Agente",
        } as any);
      } catch (e: any) {
        rel.erro = e?.message || "Falha no agente";
      }
      rels.push(rel);
      salvarRelatorio(rel);
    }
  }

  // etiquetas do WhatsApp de todos de uma vez (uma janela)
  const ids = Object.keys(etiquetasPorLead);
  if (ids.length) {
    aoProgredir?.(entradas.length, entradas.length, "trocando etiquetas no WhatsApp");
    const porId = Object.fromEntries(entradas.map((e) => [e.lead.id, e.lead]));
    let res: Record<string, any> = {};
    try {
      res = await lote(ids.map((id) => ({ id, op: "labels" as const, phone: telefoneWhatsApp(porId[id].telefone), add: etiquetasPorLead[id].add, remove: etiquetasPorLead[id].remove })));
    } catch (e: any) {
      ids.forEach((id) => (res[id] = { ok: false, error: e?.message }));
    }
    ids.forEach((id) => {
      const { rel } = etiquetasPorLead[id];
      const r = res[id] || {};
      rel.acoes.push(r.ok ? `WhatsApp: ${(r.alteracoes || []).length ? r.alteracoes.join(", ") : "etiquetas já estavam certas"}` : `WhatsApp: não troquei a etiqueta (${r.error || "erro"})`);
      salvarRelatorio(rel);
    });
  }
  return rels;
}

/** Antes de rodar a esteira: confere de uma vez quem respondeu. Devolve os ids que NÃO devem receber. */
export async function verificarAntesDoEnvio(
  itens: { lead: LeadAgente & { esteira_passo?: number | null }; esteira: EsteiraAgente }[],
  aoProgredir?: (atual: number, total: number, nome: string) => void
): Promise<Map<string, RelatorioAgente>> {
  const alvo = itens.filter((i) => (i.lead.esteira_passo || 0) > 0 && i.lead.esteira_ultimo_envio);
  const out = new Map<string, RelatorioAgente>();
  if (!alvo.length || !getAgenteAtivo() || !agenteDisponivel()) return out;
  const rels = await processarLote(alvo.map((i) => ({ lead: i.lead, esteira: i.esteira, noFim: false, momento: "antes do envio" as const })), aoProgredir);
  rels.forEach((r) => {
    if (!r.erro && r.classificacao !== "sem_resposta") out.set(r.leadId, r);
  });
  return out;
}

// ---------- Verificação (roda sozinho enquanto o Inmovya está aberto, e no botão "Rodar agora") ----------
// Confere TODOS os leads que já receberam mensagem da esteira:
//   • quem respondeu → analisa e aplica as regras
//   • quem terminou a esteira e o prazo venceu sem resposta → disparo + Lead
//   • quem ainda não respondeu e está no meio → segue a esteira (só aparece no resumo)

export interface ResumoVerificacao {
  em: string;
  conferidos: number;
  responderam: number;
  fim: number;
  semResposta: string[]; // nomes que seguem na esteira
  erros: string[];
}

let rodandoFim = false;
let ultimaRodada: string | null = null;
let progresso: { atual: number; total: number; nome: string } | null = null;
const RESUMO_KEY = "inmovya_agente_ultima_verificacao";
const CONFERIDO_KEY = "inmovya_agente_conferidos"; // leadId -> quando foi conferido (evita reabrir a cada 30 min)

export const lerResumo = (): ResumoVerificacao | null => {
  try {
    return JSON.parse(localStorage.getItem(RESUMO_KEY) || "null");
  } catch {
    return null;
  }
};
export const statusFim = () => ({ rodando: rodandoFim, ultimaRodada, progresso });

const lerConferidos = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(CONFERIDO_KEY) || "{}");
  } catch {
    return {};
  }
};
const marcarConferido = (id: string) => {
  try {
    const m = lerConferidos();
    m[id] = Date.now();
    localStorage.setItem(CONFERIDO_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
};

/** Leads em esteira que já receberam pelo menos uma mensagem, com a esteira de cada um. */
export async function leadsParaVerificar() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, status, tags, observacoes, esteira_id, esteira_passo, esteira_proximo, esteira_ultimo_envio")
    .not("esteira_id", "is", null);
  if (error || !leads?.length) return [];
  const ids = Array.from(new Set(leads.map((l: any) => l.esteira_id)));
  const [{ data: esteiras }, { data: passos }] = await Promise.all([
    supabase.from("esteiras").select("id, nome, ao_concluir_tag, ao_concluir_etapa").in("id", ids),
    supabase.from("esteira_passos").select("id, esteira_id").in("esteira_id", ids),
  ]);
  const total = (id: string) => (passos || []).filter((p: any) => p.esteira_id === id).length;
  const agora = Date.now();
  return (leads as any[])
    .filter((l) => l.telefone && (l.esteira_ultimo_envio || (l.esteira_passo || 0) > 0))
    .map((l) => {
      const T = total(l.esteira_id);
      const noFim = T > 0 && (l.esteira_passo || 0) >= T && l.esteira_proximo && new Date(l.esteira_proximo).getTime() <= agora;
      return {
        lead: l as LeadAgente,
        esteira: ((esteiras || []).find((e: any) => e.id === l.esteira_id) || { nome: "Esteira" }) as EsteiraAgente,
        noFim: !!noFim,
      };
    });
}

/** Quantos terminaram a esteira e aguardam o agente (para mostrar na tela). */
export async function leadsNoFimDaEsteira() {
  return (await leadsParaVerificar()).filter((x) => x.noFim);
}

/**
 * Confere as conversas. forcar=true (botão) confere todo mundo; no automático pula quem foi
 * conferido nas últimas 2 horas (o fim da esteira é sempre conferido).
 */
export const agenteRodando = () => rodandoFim;

export async function rodarFimDasEsteiras(forcar = false): Promise<RelatorioAgente[]> {
  if (rodandoFim) {
    if (forcar) throw new Error("O agente já está conferindo as conversas — acompanhe o progresso na aba Agente.");
    return [];
  }
  if (!getAgenteAtivo()) return [];
  if (!(await checarExtensao()) || !agenteDisponivel()) throw new Error("Atualize o Inmovya Scale para a versão 1.5.0 (chrome://extensions → ↻) e recarregue esta página.");
  rodandoFim = true;
  const feitos: RelatorioAgente[] = [];
  const resumo: ResumoVerificacao = { em: new Date().toISOString(), conferidos: 0, responderam: 0, fim: 0, semResposta: [], erros: [] };
  let teveFila = false;
  try {
    const conferidos = lerConferidos();
    const todos = await leadsParaVerificar();
    const fila = todos.filter((x) => forcar || x.noFim || !conferidos[x.lead.id] || Date.now() - conferidos[x.lead.id] > 2 * 3600_000);
    teveFila = fila.length > 0 || forcar;
    while (isWhatsAppOcupado()) await new Promise((r) => setTimeout(r, 3000));
    setWhatsAppOcupado(true);
    try {
      const rels = await processarLote(
        fila.map((x) => ({ ...x, momento: "verificação" as const })),
        (atual, total, nome) => {
          progresso = { atual, total, nome };
          ouvintes.forEach((f) => f());
        }
      );
      rels.forEach((rel) => {
        resumo.conferidos++;
        marcarConferido(rel.leadId);
        const noFim = rel.momento === "fim da esteira";
        if (rel.erro && rel.classificacao === "sem_resposta") resumo.erros.push(`${rel.nome}: ${rel.erro}`);
        else if (rel.classificacao === "sem_resposta" && !noFim) resumo.semResposta.push(rel.nome);
        else {
          if (noFim && rel.classificacao === "sem_resposta") resumo.fim++;
          else resumo.responderam++;
          feitos.push(rel);
        }
      });
    } finally {
      setWhatsAppOcupado(false);
    }
  } finally {
    rodandoFim = false;
    progresso = null;
    ultimaRodada = new Date().toISOString();
    // rodada automática que só pulou gente já conferida não apaga o resumo anterior
    if (teveFila) {
      try {
        localStorage.setItem(RESUMO_KEY, JSON.stringify(resumo));
      } catch {
        /* ignore */
      }
    }
    ouvintes.forEach((f) => f());
  }
  return feitos;
}
