// 1º CONTATO AUTOMÁTICO: assim que um lead novo entra no Inmovya, o agente escreve a primeira
// mensagem com IA gratuita (Google Gemini) e o Inmovya Scale envia pelo WhatsApp Web, 24 horas por dia.
// Precisa deste Chrome aberto com o Inmovya (qualquer aba) e o Inmovya Scale instalado.
//
// Sem duplicidade, em 3 camadas:
//  1) banco: reservar_primeiro_contato() deixa só UM envio por lead (várias abas/computadores);
//  2) telefone: se outro lead com o mesmo número já recebeu o 1º contato, pula;
//  3) WhatsApp: antes de enviar, o Scale lê a conversa; se já existe mensagem sua, pula.
import { supabase } from "@/integrations/supabase/client";
import {
  checarExtensao,
  empreendimentoDoLead,
  enviarAgora,
  extensaoAtualizada,
  getMeuNome,
  montarMensagem,
  naVezDoWhatsApp,
  primeiroNome,
  saudacao,
  telefoneWhatsApp,
} from "@/lib/esteiras";
import { lerChaveGemini, perguntarGemini } from "@/lib/iaGratis";
import { getStageForStatus } from "@/lib/negociosStages";

// ---------- Configuração (fica neste navegador: é este computador que envia) ----------
export interface ConfigPrimeiroContato {
  ativo: boolean;
  ativadoEm: string | null; // só leads que chegarem depois disso (não dispara para a base antiga)
  usarIA: boolean;
  quais: "captura" | "todos"; // captura = Meta Ads, Bitrix/roleta e formulários; todos = inclusive cadastrados à mão
  instrucoes: string;
  mensagemReserva: string; // usada quando a IA não responder
}

export const INSTRUCOES_PADRAO =
  "Apresente-se pelo nome e diga que viu o cadastro do lead no empreendimento (se houver). " +
  "Seja cordial, humano e direto: no máximo 3 frases curtas e no máximo 1 emoji. " +
  "Termine com UMA pergunta simples para o lead responder, por exemplo se ele procura para morar ou para investir. " +
  "Se for tarde da noite ou de madrugada, diga que ele pode responder quando puder. " +
  "Se o lead já mandou mensagem, responda ao que ele disse.";

export const MENSAGEM_RESERVA_PADRAO =
  "Oi, {{nome}}, {{saudacao}}! Aqui é {{meu_nome}}, tudo bem? Vi seu cadastro no {{empreendimento}} e quero te ajudar. Você procura para morar ou para investir?";

const CONFIG_KEY = "inmovya_primeiro_contato";
const PADRAO: ConfigPrimeiroContato = {
  ativo: false,
  ativadoEm: null,
  usarIA: true,
  quais: "captura",
  instrucoes: INSTRUCOES_PADRAO,
  mensagemReserva: MENSAGEM_RESERVA_PADRAO,
};

export const getConfigPrimeiroContato = (): ConfigPrimeiroContato => {
  try {
    const v = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (v && typeof v === "object") {
      return {
        ativo: !!v.ativo,
        ativadoEm: v.ativadoEm || null,
        usarIA: v.usarIA !== false,
        quais: v.quais === "todos" ? "todos" : "captura",
        instrucoes: typeof v.instrucoes === "string" && v.instrucoes.trim() ? v.instrucoes : INSTRUCOES_PADRAO,
        mensagemReserva: typeof v.mensagemReserva === "string" && v.mensagemReserva.trim() ? v.mensagemReserva : MENSAGEM_RESERVA_PADRAO,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...PADRAO };
};

export const setConfigPrimeiroContato = (c: ConfigPrimeiroContato) => {
  const atual = getConfigPrimeiroContato();
  // ao ligar, vale só para os leads que chegarem a partir de agora
  const ativadoEm = c.ativo && (!atual.ativo || !c.ativadoEm) ? new Date().toISOString() : c.ativo ? c.ativadoEm : null;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, ativadoEm }));
  } catch {
    /* ignore */
  }
  avisar();
  if (c.ativo) agendarRodada(0);
};

// ---------- Estado (para a tela) ----------
export type StatusContato = "enviando" | "enviado" | "pulado" | "erro" | "ignorado";
export interface RegistroContato {
  leadId: string;
  nome: string;
  telefone: string;
  status: StatusContato;
  detalhe: string;
  texto?: string;
  via?: string;
  em: string;
}

const LOG_KEY = "inmovya_primeiro_contato_log";
const lerLog = (): RegistroContato[] => {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

interface Estado {
  log: RegistroContato[];
  aviso: string; // problema que impede o envio (extensão, SQL, nome...)
  verificadoEm: string | null;
  proximoEnvioEm: number; // ms; 0 = livre
  atual: string; // lead sendo atendido agora
}

// "enviando" que sobrou de uma página fechada/recarregada no meio do envio
const logInicial = lerLog().map((r) =>
  r.status === "enviando" ? { ...r, status: "erro" as const, detalhe: `${r.detalhe} — interrompido (página recarregada ou fechada); tento de novo sozinho` } : r
);
let estado: Estado = { log: logInicial, aviso: "", verificadoEm: null, proximoEnvioEm: 0, atual: "" };
const ouvintes = new Set<() => void>();
const avisar = () => {
  estado = { ...estado };
  ouvintes.forEach((f) => f());
};
const mudar = (p: Partial<Estado>) => {
  estado = { ...estado, ...p };
  ouvintes.forEach((f) => f());
};

export const assinarPrimeiroContato = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
export const lerEstadoPrimeiroContato = () => estado;

const registrar = (r: RegistroContato) => {
  const log = [r, ...estado.log.filter((x) => !(x.leadId === r.leadId && x.status === "enviando"))].slice(0, 50);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* ignore */
  }
  mudar({ log });
};

export const limparLogPrimeiroContato = () => {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
  mudar({ log: [] });
};

// ---------- Quais leads ----------
export interface LeadContato {
  id: string;
  nome: string | null;
  telefone: string | null;
  origem: string | null;
  tags: string[] | null;
  observacoes: string | null;
  status: string | null;
  created_at: string;
  primeiro_contato_status: string | null;
  primeiro_contato_tentativas: number | null;
  primeiro_contato_em: string | null;
}

/** Lead que chegou pela captura automática (Meta Ads, Bitrix/roleta, formulários). */
export const ehLeadDaCaptura = (lead: Pick<LeadContato, "origem" | "tags">) => {
  const tags = (lead.tags || []).map((t) => String(t).toLowerCase());
  const origem = String(lead.origem || "").toLowerCase();
  return (
    tags.includes("meta ads") ||
    tags.includes("bitrix") ||
    tags.includes("roleta") ||
    ["roleta", "facebook", "instagram", "formulário", "formulario"].includes(origem)
  );
};

const fonteDoLead = (lead: Pick<LeadContato, "origem" | "tags">) => {
  const tags = (lead.tags || []).map((t) => String(t).toLowerCase());
  if (tags.includes("meta ads")) return `anúncio no ${lead.origem || "Facebook/Instagram"}`;
  if (tags.includes("bitrix") || String(lead.origem).toLowerCase() === "roleta") return "cadastro recebido pelo Bitrix";
  return lead.origem || "cadastro";
};

const TAG_CONTATO = "1º contato automático";
const ETAPA_APOS_CONTATO = "Primeiro impacto"; // coluna em Negócios
const TENTATIVAS_MAX = 3;
const INTERVALO_MIN_S = 60; // entre um 1º contato e outro (evita bloqueio quando chegam vários juntos)
const INTERVALO_MAX_S = 120;
const MAX_DIAS = 3; // não procura leads com mais de 3 dias

// ---------- Mensagem ----------
export interface MensagemWA {
  dir: "in" | "out";
  texto: string;
  tipo?: string;
}

const textoValido = (t: unknown): t is string => {
  if (typeof t !== "string") return false;
  const s = t.trim();
  return s.length >= 15 && s.length <= 700 && !/\{\{|\}\}|\[[^\]]*\]|<[^>]+>/.test(s);
};

const limparTexto = (t: string) =>
  t
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function gerarMensagem(
  lead: Pick<LeadContato, "nome" | "origem" | "tags" | "observacoes">,
  cfg: ConfigPrimeiroContato,
  conversa: MensagemWA[] = []
): Promise<{ texto: string; via: string; aviso?: string }> {
  const nome = lead.nome || "";
  // sem nome do lead: "Oi, , boa noite" vira "Oi, boa noite"
  const reserva = () =>
    montarMensagem(cfg.mensagemReserva, nome, lead.observacoes)
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/,(\s*,)+/g, ",")
      .trim();
  if (!cfg.usarIA) return { texto: reserva(), via: "mensagem reserva" };

  const chave = await lerChaveGemini();
  if (!chave) return { texto: reserva(), via: "mensagem reserva", aviso: "sem chave do Gemini" };

  const agora = new Date();
  const doLead = conversa.filter((m) => m.dir === "in").map((m) => m.texto || `(${m.tipo || "mídia"})`).slice(-5);
  const projeto = empreendimentoDoLead(lead.observacoes, nome);
  const prompt = [
    "Você escreve a PRIMEIRA mensagem de WhatsApp de um corretor de imóveis para um lead que acabou de chegar.",
    "",
    "Instruções do corretor:",
    cfg.instrucoes.trim(),
    "",
    "Dados:",
    `- Nome do corretor: ${getMeuNome() || "(não informado — não invente um nome)"}`,
    `- Primeiro nome do lead: ${primeiroNome(nome) || "(sem nome — cumprimente sem usar nome)"}`,
    `- Empreendimento de interesse: ${projeto || "não informado (fale em imóveis, sem inventar um empreendimento)"}`,
    `- De onde veio: ${fonteDoLead(lead)}`,
    `- Observações do cadastro: ${String(lead.observacoes || "").replace(/\s+/g, " ").slice(0, 400) || "nenhuma"}`,
    `- Agora: ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (saudação do horário: "${saudacao(agora)}")`,
    doLead.length ? `- O lead já escreveu no WhatsApp: ${doLead.map((t) => `"${t}"`).join(" / ")}` : "- O lead ainda não escreveu nada no WhatsApp.",
    "",
    "Regras fixas: português do Brasil; não invente preço, condição de pagamento, endereço, metragem, prazo de entrega nem promessas;",
    "não use colchetes, chaves nem campos para preencher; no máximo 450 caracteres; escreva só a mensagem, sem assinatura.",
    'Responda apenas com JSON: {"mensagem": "texto da mensagem"}',
  ].join("\n");

  try {
    const r = await perguntarGemini(chave, prompt, 0.8);
    const texto = limparTexto(String(r?.mensagem ?? ""));
    if (textoValido(texto)) return { texto, via: "IA (Gemini)" };
    return { texto: reserva(), via: "mensagem reserva", aviso: "a IA devolveu um texto fora do padrão" };
  } catch (e: any) {
    return { texto: reserva(), via: "mensagem reserva", aviso: e?.message || "IA indisponível" };
  }
}

// ---------- WhatsApp: ler a conversa (Scale já sabe fazer isso) ----------
const lerConversaAgora = (phone: string) =>
  new Promise<MensagemWA[]>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu ao abrir a conversa."));
    }, 540000); // número sem WhatsApp: o Scale tenta por ~8 min; esperar tudo evita abrir outra janela por cima
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      event.detail?.ok
        ? resolve(Array.isArray(event.detail.mensagens) ? event.detail.mensagens : [])
        : reject(new Error(event.detail?.error || "Não consegui ler a conversa no WhatsApp."));
    };
    window.addEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_AGENT", { detail: { op: "read", phone, background: true, token } }));
  });

// ---------- Banco ----------
const ehErroDeColuna = (e: any) =>
  /primeiro_contato|reservar_primeiro_contato|column|function .* does not exist|schema cache/i.test(`${e?.message || ""} ${e?.details || ""}`) ||
  ["42703", "42883", "PGRST202", "PGRST204"].includes(e?.code);

const AVISO_SQL = "Falta preparar o banco: rode o arquivo supabase/primeiro_contato.sql no SQL Editor do Supabase (uma vez).";

const ultimos8 = (t?: string | null) => String(t || "").replace(/\D/g, "").slice(-8);

async function marcar(leadId: string, campos: Record<string, any>) {
  const { error } = await supabase.from("leads").update(campos as any).eq("id", leadId);
  if (error) console.error("1º contato: não consegui gravar no lead", error);
}

async function numeroJaContatado(lead: LeadContato, userId: string) {
  const k = ultimos8(lead.telefone);
  if (k.length < 8) return null;
  const { data } = await supabase
    .from("leads")
    .select("id, nome, telefone")
    .eq("user_id", userId)
    .eq("primeiro_contato_status", "enviado")
    .neq("id", lead.id)
    .ilike("telefone", `%${k.slice(-4)}%`);
  return (data || []).find((l: any) => ultimos8(l.telefone) === k) || null;
}

/** Se o gatilho do Negócios pôs o lead numa esteira no D1 (envio hoje), passa o D1 para amanhã. Devolve o nome da esteira. */
async function adiarD1ParaAmanha(leadId: string): Promise<string | null> {
  const { data: l } = await supabase.from("leads").select("esteira_id, esteira_passo").eq("id", leadId).maybeSingle();
  if (!(l as any)?.esteira_id || ((l as any).esteira_passo || 0) !== 0) return null;
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);
  // só muda a data: o gatilho não mexe quando a etapa não muda
  const { error } = await supabase.from("leads").update({ esteira_proximo: amanha.toISOString() } as any).eq("id", leadId);
  if (error) {
    console.error("1º contato: não consegui adiar o D1 da esteira", error);
    return null;
  }
  const { data: e } = await supabase.from("esteiras").select("nome").eq("id", (l as any).esteira_id).maybeSingle();
  return (e as any)?.nome || "da coluna";
}

// ---------- Enviar ----------
// A extensão tenta por até ~8 min antes de desistir; esperar tudo isso evita mandar de novo enquanto ela ainda tenta.
const ESPERA_ENVIO_MS = 10 * 60_000;

/**
 * Envia na janelinha em segundo plano; se a EXTENSÃO responder que falhou, tenta de novo numa aba normal.
 * Se a extensão não responder (tempo esgotado), NÃO tenta de novo aqui: ela pode ter enviado — a próxima
 * tentativa (5 min depois) relê a conversa antes.
 */
async function enviarComSegundaTentativa(tel: string, texto: string, avisar: (s: string) => void) {
  try {
    await enviarAgora(tel, texto, [], true, undefined, ESPERA_ENVIO_MS);
    return "janelinha" as const;
  } catch (e1: any) {
    if (e1?.semResposta) throw new Error(`a extensão não respondeu em ${ESPERA_ENVIO_MS / 60_000} min (o computador pode ter dormido/bloqueado a tela)`);
    avisar(`a janelinha falhou (${e1?.message || "erro"}) — tentando numa aba normal...`);
    try {
      await enviarAgora(tel, texto, [], false, undefined, ESPERA_ENVIO_MS);
      return "aba normal" as const;
    } catch (e2: any) {
      throw new Error(`janelinha: ${e1?.message || "erro"} · aba normal: ${e2?.message || "erro"}`);
    }
  }
}

// ---------- Teste (não grava nada no Inmovya) ----------
export interface PassoTeste {
  passo: string;
  ok: boolean | null; // null = em andamento
  detalhe?: string;
}

/** Faz o caminho completo do 1º contato para um número (ler conversa → IA → enviar), mostrando cada passo. */
export async function testarEnvio(telefone: string, onPasso: (passos: PassoTeste[]) => void) {
  const passos: PassoTeste[] = [];
  const marcarPasso = (passo: string, ok: boolean | null, detalhe?: string) => {
    const i = passos.findIndex((p) => p.passo === passo);
    if (i >= 0) passos[i] = { passo, ok, detalhe };
    else passos.push({ passo, ok, detalhe });
    onPasso([...passos]);
  };
  const tel = telefoneWhatsApp(telefone);
  if (!tel || tel.length < 12) return marcarPasso("Telefone", false, "número inválido (use DDD + número)");
  marcarPasso("Telefone", true, tel);

  marcarPasso("Inmovya Scale", null);
  const ext = await checarExtensao();
  if (!ext) return marcarPasso("Inmovya Scale", false, "não encontrado neste Chrome");
  marcarPasso("Inmovya Scale", extensaoAtualizada("1.4.0"), extensaoAtualizada("1.4.0") ? "conectado" : "versão antiga: atualize em chrome://extensions");

  await naVezDoWhatsApp(async () => {
    marcarPasso("Ler a conversa no WhatsApp", null, "abrindo a janelinha...");
    let conversa: MensagemWA[] = [];
    try {
      conversa = await lerConversaAgora(tel);
      const suas = conversa.filter((m) => m.dir === "out").length;
      marcarPasso("Ler a conversa no WhatsApp", true, `${conversa.length} mensagem(ns) lida(s), ${suas} sua(s)${suas ? " — no agente real, este número seria pulado" : ""}`);
    } catch (e: any) {
      return marcarPasso("Ler a conversa no WhatsApp", false, e?.message || "falhou");
    }

    const cfg = getConfigPrimeiroContato();
    marcarPasso("Escrever a mensagem", null);
    const msg = await gerarMensagem({ nome: "Teste", origem: "Instagram", tags: ["Meta Ads"], observacoes: null }, cfg, conversa);
    marcarPasso("Escrever a mensagem", true, `${msg.via}${msg.aviso ? ` (${msg.aviso})` : ""}: ${msg.texto}`);

    marcarPasso("Enviar no WhatsApp", null, "enviando na janelinha...");
    try {
      const como = await enviarComSegundaTentativa(tel, msg.texto, (aviso) => marcarPasso("Enviar no WhatsApp", null, aviso));
      marcarPasso("Enviar no WhatsApp", true, `enviado (${como})`);
    } catch (e: any) {
      marcarPasso("Enviar no WhatsApp", false, e?.message || "falhou");
    }
  });
}

// ---------- Atender um lead ----------
async function atenderLead(lead: LeadContato, userId: string, cfg: ConfigPrimeiroContato): Promise<"enviado" | "pulado" | "erro" | "ignorado"> {
  const nome = lead.nome || "Lead sem nome";
  const base = { leadId: lead.id, nome, telefone: lead.telefone || "" };

  // 1) reserva no banco: só um envio por lead
  const { data: reservado, error: erroReserva } = await supabase.rpc("reservar_primeiro_contato" as any, { p_lead: lead.id } as any);
  if (erroReserva) {
    if (ehErroDeColuna(erroReserva)) mudar({ aviso: AVISO_SQL });
    throw erroReserva;
  }
  if (!reservado) return "ignorado"; // outra aba/computador já pegou

  const pular = async (motivo: string) => {
    await marcar(lead.id, { primeiro_contato_status: "pulado", primeiro_contato_erro: motivo, primeiro_contato_em: new Date().toISOString() });
    registrar({ ...base, status: "pulado", detalhe: motivo, em: new Date().toISOString() });
    return "pulado" as const;
  };

  const tel = telefoneWhatsApp(lead.telefone);
  if (!tel || tel.length < 12) return pular("telefone inválido para WhatsApp");

  // 2) mesmo número já recebeu o 1º contato em outro lead
  const outro = await numeroJaContatado(lead, userId);
  if (outro) return pular(`este número já recebeu o 1º contato (lead ${outro.nome || outro.id})`);

  registrar({ ...base, status: "enviando", detalhe: "conferindo o WhatsApp...", em: new Date().toISOString() });
  mudar({ atual: nome });

  try {
    // 3) conferir a conversa, gerar a mensagem e enviar — tudo na mesma vez do WhatsApp
    const resultado = await naVezDoWhatsApp(async () => {
      const conversa = await lerConversaAgora(tel);
      if (conversa.some((m) => m.dir === "out")) return { pulou: "já existe mensagem sua nesta conversa do WhatsApp" } as const;
      registrar({ ...base, status: "enviando", detalhe: cfg.usarIA ? "escrevendo a mensagem com IA..." : "enviando...", em: new Date().toISOString() });
      const msg = await gerarMensagem(lead, cfg, conversa);
      registrar({ ...base, status: "enviando", detalhe: "enviando no WhatsApp...", texto: msg.texto, via: msg.via, em: new Date().toISOString() });
      await enviarComSegundaTentativa(tel, msg.texto, (aviso) =>
        registrar({ ...base, status: "enviando", detalhe: aviso, texto: msg.texto, via: msg.via, em: new Date().toISOString() })
      );
      return { msg } as const;
    });

    if ("pulou" in resultado) return pular(resultado.pulou!);

    const { msg } = resultado;
    const agora = new Date().toISOString();
    const tags = Array.from(new Set([...(lead.tags || []), TAG_CONTATO]));
    // Negócios: sai da Validação (entrada) para Primeiro impacto; quem já foi movido para frente fica onde está
    const etapaAtual = getStageForStatus(lead.status);
    const mover = !etapaAtual || etapaAtual.phase === "entrada";
    await marcar(lead.id, {
      ...(mover ? { status: ETAPA_APOS_CONTATO } : {}),
      primeiro_contato_status: "enviado",
      primeiro_contato_em: agora,
      primeiro_contato_msg: msg.texto,
      primeiro_contato_erro: null,
      tags,
      ultimo_contato: agora,
    });
    // Regra do Negócios (gatilho lead_esteira_por_etapa no banco): ao entrar em Primeiro impacto o lead vai para
    // a esteira ligada a essa coluna, no D1, com envio para hoje. Como ele acabou de receber o 1º contato,
    // o D1 fica para amanhã (aparece na aba Hoje das Esteiras no dia seguinte).
    const esteiraNome = mover ? await adiarD1ParaAmanha(lead.id) : null;
    const { error: erroHistorico } = await supabase.from("lead_timeline").insert({
      lead_id: lead.id,
      type: "note",
      title: "1º contato automático enviado no WhatsApp",
      description: `${msg.texto}\n\n— escrito por: ${msg.via}${msg.aviso ? ` (${msg.aviso})` : ""}${
        mover ? `\nEtapa em Negócios: ${lead.status || "sem etapa"} → ${ETAPA_APOS_CONTATO}` : ""
      }${esteiraNome ? `\nEsteira ${esteiraNome}: D1 amanhã` : ""}`,
      author: "Agente",
    } as any);
    if (erroHistorico) console.error("1º contato: histórico não gravado", erroHistorico);
    const detalhe = [
      msg.aviso ? `${msg.via} — ${msg.aviso}` : msg.via,
      mover && `movido em Negócios para ${ETAPA_APOS_CONTATO}`,
      esteiraNome && `esteira ${esteiraNome}: D1 amanhã`,
    ]
      .filter(Boolean)
      .join(" · ");
    registrar({ ...base, status: "enviado", detalhe, texto: msg.texto, via: msg.via, em: agora });
    return "enviado";
  } catch (e: any) {
    const erro = e?.message || "falha no envio";
    const ultima = (lead.primeiro_contato_tentativas || 0) + 1 >= TENTATIVAS_MAX;
    await marcar(lead.id, { primeiro_contato_status: "erro", primeiro_contato_erro: erro, primeiro_contato_em: new Date().toISOString() });
    registrar({ ...base, status: "erro", detalhe: ultima ? `${erro} — desisti após ${TENTATIVAS_MAX} tentativas` : `${erro} — tento de novo em alguns minutos`, em: new Date().toISOString() });
    return "erro";
  } finally {
    mudar({ atual: "" });
  }
}

// ---------- Rodada: procura leads novos e atende um por vez ----------
let rodando = false;
let ultimoEnvio = 0;
const avisadosForaDaRegra = new Set<string>();
let timer: number | undefined;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function agendarRodada(emMs = 0) {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    rodadaPrimeiroContato().catch((e) => console.error("1º contato:", e));
  }, emMs);
}

const precisaAtender = (l: LeadContato) => {
  const s = l.primeiro_contato_status;
  const tent = l.primeiro_contato_tentativas || 0;
  const desde = l.primeiro_contato_em ? Date.now() - new Date(l.primeiro_contato_em).getTime() : Infinity;
  if (!s) return true;
  if (s === "erro") return tent < TENTATIVAS_MAX && desde > 5 * 60_000; // espera 5 min antes de tentar de novo
  if (s === "enviando") return tent < TENTATIVAS_MAX && desde > 15 * 60_000; // travou (aba fechada no meio)
  return false;
};

export async function rodadaPrimeiroContato() {
  if (rodando) return;
  const cfg = getConfigPrimeiroContato();
  if (!cfg.ativo) return;
  rodando = true;
  try {
    // várias abas do Inmovya abertas: só uma trabalha por vez
    const locks = (navigator as any).locks;
    if (locks?.request) {
      await locks.request("inmovya-primeiro-contato", { ifAvailable: true }, async (lock: any) => {
        if (lock) await rodada(cfg);
      });
    } else {
      await rodada(cfg);
    }
  } finally {
    rodando = false;
    mudar({ verificadoEm: new Date().toISOString() });
  }
}

async function rodada(cfg: ConfigPrimeiroContato) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (!getMeuNome().trim()) {
    mudar({ aviso: "Preencha o seu nome no agente de 1º contato (ele se apresenta com esse nome)." });
    return;
  }
  const extensao = await checarExtensao();
  if (!extensao) {
    mudar({ aviso: "Inmovya Scale não encontrado neste Chrome. Os leads ficam esperando até ele voltar." });
    return;
  }
  if (!extensaoAtualizada("1.4.0")) {
    mudar({ aviso: "Atualize o Inmovya Scale (chrome://extensions → Recarregar). O 1º contato precisa da versão 1.4.0 ou mais nova." });
    return;
  }

  const limite = new Date(Date.now() - MAX_DIAS * 86400_000).toISOString();
  const desde = cfg.ativadoEm && cfg.ativadoEm > limite ? cfg.ativadoEm : limite;
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, origem, tags, observacoes, status, created_at, primeiro_contato_status, primeiro_contato_tentativas, primeiro_contato_em")
    .eq("user_id", user.id)
    .gte("created_at", desde)
    .or("primeiro_contato_status.is.null,primeiro_contato_status.eq.erro,primeiro_contato_status.eq.enviando")
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) {
    mudar({ aviso: ehErroDeColuna(error) ? AVISO_SQL : `Não consegui ler os leads: ${error.message}` });
    return;
  }
  mudar({ aviso: "" });

  const pendentes = ((data || []) as LeadContato[]).filter(precisaAtender);
  // fora da regra "Quais leads": não envia, mas mostra no histórico (uma vez por lead) para não parecer travado
  for (const l of pendentes) {
    if (cfg.quais === "todos" || ehLeadDaCaptura(l) || avisadosForaDaRegra.has(l.id)) continue;
    if (estado.log.some((x) => x.leadId === l.id && x.status === "ignorado")) continue; // já avisado antes de recarregar a página
    avisadosForaDaRegra.add(l.id);
    registrar({
      leadId: l.id,
      nome: l.nome || "Lead sem nome",
      telefone: l.telefone || "",
      status: "ignorado",
      detalhe: 'não veio da captura automática (ex.: cadastrado à mão). Para atender também esses, marque "Todos os leads novos".',
      em: new Date().toISOString(),
    });
  }
  const fila = pendentes.filter((l) => cfg.quais === "todos" || ehLeadDaCaptura(l));
  for (const lead of fila) {
    if (!getConfigPrimeiroContato().ativo) break; // desligaram no meio
    // intervalo entre um 1º contato e outro
    if (ultimoEnvio) {
      const proximo = ultimoEnvio + (INTERVALO_MIN_S + Math.random() * (INTERVALO_MAX_S - INTERVALO_MIN_S)) * 1000;
      mudar({ proximoEnvioEm: proximo });
      while (Date.now() < proximo && getConfigPrimeiroContato().ativo) await dormir(1000); // pelo relógio (aba escondida atrasa timers)
      mudar({ proximoEnvioEm: 0 });
      if (!getConfigPrimeiroContato().ativo) break;
    }
    try {
      const r = await atenderLead(lead, user.id, getConfigPrimeiroContato());
      if (r === "enviado" || r === "erro") ultimoEnvio = Date.now();
    } catch (e: any) {
      console.error("1º contato:", e);
      if (estado.aviso === AVISO_SQL) break;
    }
  }
}

/** Gera um exemplo de mensagem (sem enviar), para conferir o tom da IA. */
export async function exemploDeMensagem(cfg: ConfigPrimeiroContato) {
  return gerarMensagem(
    { nome: "Mariana Souza", origem: "Instagram", tags: ["Meta Ads"], observacoes: "Empreendimento: Residencial Jardim das Flores" },
    cfg
  );
}
