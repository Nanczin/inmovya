// Agente da esteira: lê a conversa do lead no WhatsApp (pelo Inmovya Scale), um LLM analisa se a
// resposta foi positiva, negativa ou neutra, aplica as regras e guarda um relatório por lead.
//   • sem resposta no fim da esteira → tag "disparo" + sai do funil (Inmovya) e etiqueta Lead (WhatsApp)
//   • positiva → sobe para 50% (Inmovya e WhatsApp) e sai da esteira
//   • negativa / neutra → sai da esteira e avisa (você decide o resto)
import { supabase } from "@/integrations/supabase/client";
import { carregarConfiguracoes } from "@/lib/supabase";
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
  momento: "antes do envio" | "fim da esteira";
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
  relatorioCache = [r, ...lerRelatorio()].slice(0, 300);
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

export const agenteDisponivel = () => extensaoAtualizada("1.4.0");

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

const MODELOS_GEMINI = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

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
    if (resp.status === 404) {
      ultimoErro = `modelo ${modelo} indisponível`;
      continue; // tenta o próximo modelo
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
    const respostas = respostasDepois(conversa, lead.esteira_ultimo_envio);
    rel.respostas = respostas.map((m) => m.texto || `[${m.tipo}]`).slice(-10);

    if (!respostas.length) {
      rel.classificacao = "sem_resposta";
      if (momento === "antes do envio") {
        rel.resumo = "Não respondeu desde o último envio — segue a esteira.";
        return rel; // não entra no relatório (nada a fazer)
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

export const rotulo = (c: Classificacao) =>
  ({ sem_resposta: "Sem resposta → disparo", positiva: "Positiva → 50%", negativa: "Negativa", neutra: "Neutra" })[c];

// ---------- Fim da esteira (roda sozinho enquanto o Inmovya está aberto) ----------

let rodandoFim = false;
let ultimaRodada: string | null = null;
export const statusFim = () => ({ rodando: rodandoFim, ultimaRodada });

/** Leads que passaram do último passo e cujo prazo sem resposta venceu. */
export async function leadsNoFimDaEsteira() {
  const agora = new Date().toISOString();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, status, tags, observacoes, esteira_id, esteira_passo, esteira_proximo, esteira_ultimo_envio")
    .not("esteira_id", "is", null)
    .lte("esteira_proximo", agora);
  if (error || !leads?.length) return [];
  const ids = Array.from(new Set(leads.map((l: any) => l.esteira_id)));
  const [{ data: esteiras }, { data: passos }] = await Promise.all([
    supabase.from("esteiras").select("id, nome, ao_concluir_tag, ao_concluir_etapa").in("id", ids),
    supabase.from("esteira_passos").select("id, esteira_id").in("esteira_id", ids),
  ]);
  const total = (id: string) => (passos || []).filter((p: any) => p.esteira_id === id).length;
  return (leads as any[])
    .filter((l) => total(l.esteira_id) > 0 && (l.esteira_passo || 0) >= total(l.esteira_id) && l.telefone)
    .map((l) => ({ lead: l as LeadAgente, esteira: ((esteiras || []).find((e: any) => e.id === l.esteira_id) || { nome: "Esteira" }) as EsteiraAgente }));
}

/** Analisa quem terminou a esteira. Devolve os relatórios desta rodada. */
export async function rodarFimDasEsteiras(): Promise<RelatorioAgente[]> {
  if (rodandoFim || !getAgenteAtivo()) return [];
  if (!(await checarExtensao()) || !agenteDisponivel()) return [];
  rodandoFim = true;
  const feitos: RelatorioAgente[] = [];
  try {
    const fila = await leadsNoFimDaEsteira();
    for (const { lead, esteira } of fila) {
      while (isWhatsAppOcupado()) await new Promise((r) => setTimeout(r, 3000));
      setWhatsAppOcupado(true);
      try {
        feitos.push(await rodarAgente(lead, esteira, "fim da esteira"));
      } finally {
        setWhatsAppOcupado(false);
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  } finally {
    rodandoFim = false;
    ultimaRodada = new Date().toISOString();
    ouvintes.forEach((f) => f());
  }
  return feitos;
}
