// 1º CONTATO AUTOMÁTICO: assim que um lead novo entra no Inmovya, o agente escreve a primeira
// mensagem com IA gratuita (Google Gemini) e envia pelo WhatsApp Web, 24 horas por dia.
//
// Quem trabalha é o INMOVYA SCALE (inmovya-scale/agente-primeiro-contato.js): ele acorda a cada minuto e roda
// mesmo com o Inmovya fechado — basta o Chrome aberto (pode estar minimizado) e o WhatsApp Web conectado.
// Esta parte do Inmovya só guarda as configurações no banco (agente_config), entrega o token do agente
// para a extensão, mostra o histórico e faz o "Testar envio".
//
// Sem duplicidade, em 3 camadas (no banco e na extensão):
//  1) agente_reservar(): só UM envio por lead (vários computadores/abas);
//  2) telefone: se outro lead com o mesmo número já recebeu o 1º contato, pula;
//  3) WhatsApp: antes de enviar, a extensão lê a conversa; se já existe mensagem sua, pula.
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import {
  checarExtensao,
  empreendimentoDoLead,
  enviarAgora,
  extensaoAtualizada,
  getMeuNome,
  montarMensagem,
  naVezDoWhatsApp,
  primeiroNome,
  setMeuNome,
  saudacao,
  telefoneWhatsApp,
} from "@/lib/esteiras";
import { lerChaveGemini, perguntarGemini } from "@/lib/iaGratis";

export const VERSAO_SCALE_AGENTE = "1.6.1"; // 1.6.1: salva o contato e marca a etiqueta da origem

// ---------- Configuração (no banco: a extensão lê de lá) ----------
export interface ConfigPrimeiroContato {
  ativo: boolean;
  ativadoEm: string | null; // só leads que chegarem depois disso (não dispara para a base antiga)
  usarIA: boolean;
  quais: "captura" | "todos"; // captura = Meta Ads, Bitrix/roleta e formulários; todos = inclusive cadastrados à mão
  instrucoes: string;
  mensagemReserva: string; // usada quando a IA não responder
  meuNome: string;
}

export interface SinalAgente {
  ultimoSinal: string | null; // última vez que a extensão conferiu
  aviso: string | null;
  temToken: boolean;
}

export const INSTRUCOES_PADRAO =
  "Apresente-se pelo nome e diga que viu o cadastro do lead no empreendimento (se houver). " +
  "Seja cordial, humano e direto: no máximo 3 frases curtas e no máximo 1 emoji. " +
  "Termine com UMA pergunta simples para o lead responder, por exemplo se ele procura para morar ou para investir. " +
  "Se for tarde da noite ou de madrugada, diga que ele pode responder quando puder. " +
  "Se o lead já mandou mensagem, responda ao que ele disse.";

export const MENSAGEM_RESERVA_PADRAO =
  "Oi, {{nome}}, {{saudacao}}! Aqui é {{meu_nome}}, tudo bem? Vi seu cadastro no {{empreendimento}} e quero te ajudar. Você procura para morar ou para investir?";

const PADRAO: ConfigPrimeiroContato = {
  ativo: false,
  ativadoEm: null,
  usarIA: true,
  quais: "captura",
  instrucoes: INSTRUCOES_PADRAO,
  mensagemReserva: MENSAGEM_RESERVA_PADRAO,
  meuNome: "",
};

// configuração antiga (antes ficava só neste navegador): vira o ponto de partida
const ANTIGA_KEY = "inmovya_primeiro_contato";
const configAntiga = (): Partial<ConfigPrimeiroContato> => {
  try {
    const v = JSON.parse(localStorage.getItem(ANTIGA_KEY) || "null");
    if (!v || typeof v !== "object") return {};
    return {
      usarIA: v.usarIA !== false,
      quais: v.quais === "todos" ? "todos" : "captura",
      ...(v.instrucoes ? { instrucoes: v.instrucoes } : {}),
      ...(v.mensagemReserva ? { mensagemReserva: v.mensagemReserva } : {}),
    };
  } catch {
    return {};
  }
};

export const ERRO_SQL_AGENTE = "Falta preparar o banco: rode o arquivo supabase/agente_extensao.sql no SQL Editor do Supabase (uma vez).";
const ehErroDeTabela = (e: any) =>
  /agente_config|relation .* does not exist|schema cache|could not find the table/i.test(`${e?.message || ""} ${e?.details || ""}`) ||
  ["42P01", "PGRST205", "PGRST204"].includes(e?.code);

let tokenAtual: string | null = null;

/** Lê a configuração do agente no banco. */
export async function carregarConfigAgente(): Promise<{ cfg: ConfigPrimeiroContato; sinal: SinalAgente }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre no Inmovya.");
  const { data, error } = await supabase.from("agente_config" as any).select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw ehErroDeTabela(error) ? new Error(ERRO_SQL_AGENTE) : error;
  const r: any = data;
  tokenAtual = r?.token || null;
  const cfg: ConfigPrimeiroContato = r
    ? {
        ativo: !!r.ativo,
        ativadoEm: r.ativado_em || null,
        usarIA: r.usar_ia !== false,
        quais: r.quais === "todos" ? "todos" : "captura",
        instrucoes: r.instrucoes || INSTRUCOES_PADRAO,
        mensagemReserva: r.mensagem_reserva || MENSAGEM_RESERVA_PADRAO,
        meuNome: r.meu_nome || getMeuNome(),
      }
    : { ...PADRAO, ...configAntiga(), meuNome: getMeuNome() };
  return { cfg, sinal: { ultimoSinal: r?.ultimo_sinal || null, aviso: r?.aviso || null, temToken: !!r?.token } };
}

const novoToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

/** Salva a configuração no banco (depois chame entregarParaExtensao para a extensão receber o token). */
export async function salvarConfigAgente(c: ConfigPrimeiroContato) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre no Inmovya.");
  const anterior = await carregarConfigAgente().catch(() => null);
  // ao ligar, vale só para os leads que chegarem a partir de agora
  const ativadoEm = c.ativo ? (anterior?.cfg.ativo && c.ativadoEm ? c.ativadoEm : new Date().toISOString()) : null;
  const token = tokenAtual || novoToken();
  const gemini = await lerChaveGemini();
  const { error } = await supabase.from("agente_config" as any).upsert(
    {
      user_id: user.id,
      ativo: c.ativo,
      ativado_em: ativadoEm,
      usar_ia: c.usarIA,
      quais: c.quais,
      instrucoes: c.instrucoes,
      mensagem_reserva: c.mensagemReserva,
      meu_nome: c.meuNome.trim(),
      gemini_key: gemini || null,
      token,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "user_id" }
  );
  if (error) throw ehErroDeTabela(error) ? new Error(ERRO_SQL_AGENTE) : error;
  tokenAtual = token;
  setMeuNome(c.meuNome);
  return { ...c, ativadoEm };
}

/** Atualiza só a chave do Gemini no agente (quando ela muda na tela). */
export async function salvarChaveNoAgente(chave: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !tokenAtual) return;
  await supabase.from("agente_config" as any).update({ gemini_key: chave.trim() || null } as any).eq("user_id", user.id);
}

/** Entrega endereço do banco + token do agente para o Inmovya Scale deste Chrome. */
export const entregarParaExtensao = (rodarAgora = false) =>
  new Promise<boolean>((resolve) => {
    if (!tokenAtual) return resolve(false);
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENTE_CONFIG_RESULT", onResult as EventListener);
      resolve(false);
    }, 4000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_AGENTE_CONFIG_RESULT", onResult as EventListener);
      resolve(!!event.detail?.ok);
    };
    window.addEventListener("INMOVYA_AGENTE_CONFIG_RESULT", onResult as EventListener);
    window.dispatchEvent(
      new CustomEvent("INMOVYA_AGENTE_CONFIG", {
        detail: { token, config: { url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY, token: tokenAtual, rodarAgora } },
      })
    );
  });

/** Ao abrir o Inmovya: garante que a extensão deste Chrome tem o token (ex.: depois de reinstalar). */
export async function sincronizarAgenteComExtensao() {
  try {
    const { cfg } = await carregarConfigAgente();
    if (!cfg.ativo || !tokenAtual) return;
    if (!(await checarExtensao()) || !extensaoAtualizada(VERSAO_SCALE_AGENTE)) return;
    await entregarParaExtensao(false);
  } catch {
    /* sem SQL ou sem login: nada a fazer */
  }
}

// ---------- Histórico (gravado nos leads pela extensão) ----------
export interface RegistroContato {
  leadId: string;
  nome: string;
  telefone: string;
  status: string; // enviando | enviado | pulado | erro
  detalhe: string;
  texto?: string;
  tentativas: number;
  em: string;
}

export async function lerHistoricoAgente(): Promise<RegistroContato[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, primeiro_contato_status, primeiro_contato_em, primeiro_contato_msg, primeiro_contato_erro, primeiro_contato_tentativas, status")
    .eq("user_id", user.id)
    .not("primeiro_contato_status", "is", null)
    .order("primeiro_contato_em", { ascending: false })
    .limit(40);
  if (error) return [];
  return (data || []).map((l: any) => ({
    leadId: l.id,
    nome: l.nome || "Lead sem nome",
    telefone: l.telefone || "",
    status: l.primeiro_contato_status,
    detalhe:
      l.primeiro_contato_status === "enviado"
        ? `etapa agora: ${l.status || "Nenhuma"}`
        : l.primeiro_contato_status === "erro"
          ? `${l.primeiro_contato_erro || "falha no envio"} — tentativa ${l.primeiro_contato_tentativas} de 3${(l.primeiro_contato_tentativas || 0) < 3 ? " (tento de novo em uns 5 min)" : ""}`
          : l.primeiro_contato_status === "enviando"
            ? "a extensão está atendendo este lead agora"
            : l.primeiro_contato_erro || "",
    texto: l.primeiro_contato_msg || undefined,
    tentativas: l.primeiro_contato_tentativas || 0,
    em: l.primeiro_contato_em,
  }));
}

// ---------- Diagnóstico: leads novos dos últimos 3 dias e por que estão (ou não) na fila ----------
export type SituacaoFila = "na_fila" | "antes_de_ligar" | "desistiu" | "fora_da_regra" | "atendendo";
export interface LeadNaFila {
  id: string;
  nome: string;
  telefone: string;
  criadoEm: string;
  situacao: SituacaoFila;
  motivo: string;
}

const ehDaCaptura = (l: { tags: string[] | null; origem: string | null }) => {
  const tags = (l.tags || []).map((t) => String(t).toLowerCase());
  const origem = String(l.origem || "").toLowerCase();
  return tags.includes("meta ads") || tags.includes("bitrix") || tags.includes("roleta") || ["roleta", "facebook", "instagram", "formulário", "formulario"].includes(origem);
};

/** Mesmas regras do agente_pendentes (banco), para a tela explicar quem vai e quem não vai receber. */
export async function lerFilaAgente(cfg: ConfigPrimeiroContato): Promise<LeadNaFila[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const desde = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, origem, tags, created_at, primeiro_contato_status, primeiro_contato_tentativas, primeiro_contato_em, primeiro_contato_erro")
    .eq("user_id", user.id)
    .gte("created_at", desde)
    .or("primeiro_contato_status.is.null,primeiro_contato_status.eq.erro,primeiro_contato_status.eq.enviando")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return [];
  const ligadoEm = cfg.ativadoEm ? new Date(cfg.ativadoEm).getTime() : Infinity;
  return (data || []).map((l: any) => {
    const base = { id: l.id, nome: l.nome || "Lead sem nome", telefone: l.telefone || "", criadoEm: l.created_at };
    const tent = l.primeiro_contato_tentativas || 0;
    const s = l.primeiro_contato_status;
    if (s && tent >= 3) return { ...base, situacao: "desistiu" as const, motivo: `desistiu depois de 3 tentativas${l.primeiro_contato_erro ? `: ${l.primeiro_contato_erro}` : ""}` };
    if (cfg.quais !== "todos" && !ehDaCaptura(l)) return { ...base, situacao: "fora_da_regra" as const, motivo: 'não veio da captura automática (marque "Todos os leads novos" para incluir)' };
    if (new Date(l.created_at).getTime() < ligadoEm)
      return { ...base, situacao: "antes_de_ligar" as const, motivo: cfg.ativo ? "chegou antes de você ligar o agente" : "o agente está desligado" };
    const travado = s === "enviando" && l.primeiro_contato_em && Date.now() - new Date(l.primeiro_contato_em).getTime() > 15 * 60_000;
    if (s === "enviando" && !travado) return { ...base, situacao: "atendendo" as const, motivo: "a extensão está atendendo (ou travou — volta para a fila em 15 min)" };
    return { ...base, situacao: "na_fila" as const, motivo: s === "erro" ? `na fila de novo (tentativa ${tent + 1} de 3)` : "na fila — recebe em 1 a 2 minutos" };
  });
}

/** Põe o lead de volta na fila do zero (apaga as tentativas que falharam). */
export async function retentarLead(leadId: string) {
  const { error } = await supabase
    .from("leads")
    .update({ primeiro_contato_status: null, primeiro_contato_tentativas: 0, primeiro_contato_erro: null, primeiro_contato_em: null } as any)
    .eq("id", leadId);
  if (error) throw error;
}

/** Faz o agente atender também quem chegou antes de ligar (até 3 dias atrás). */
export async function incluirLeadsDesde(iso: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre no Inmovya.");
  const limite = new Date(Date.now() - 3 * 86400_000 + 60_000).toISOString();
  const { error } = await supabase
    .from("agente_config" as any)
    .update({ ativado_em: iso < limite ? limite : iso } as any)
    .eq("user_id", user.id);
  if (error) throw error;
}

// ---------- Mensagem (a extensão usa a mesma lógica) ----------
export interface MensagemWA {
  dir: "in" | "out";
  texto: string;
  tipo?: string;
}

type LeadMensagem = { nome: string | null; origem: string | null; tags: string[] | null; observacoes: string | null };

const fonteDoLead = (lead: Pick<LeadMensagem, "origem" | "tags">) => {
  const tags = (lead.tags || []).map((t) => String(t).toLowerCase());
  if (tags.includes("meta ads")) return `anúncio no ${lead.origem || "Facebook/Instagram"}`;
  if (tags.includes("bitrix") || String(lead.origem).toLowerCase() === "roleta") return "cadastro recebido pelo Bitrix";
  return lead.origem || "cadastro";
};

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

export async function gerarMensagem(lead: LeadMensagem, cfg: ConfigPrimeiroContato, conversa: MensagemWA[] = []): Promise<{ texto: string; via: string; aviso?: string }> {
  const nome = lead.nome || "";
  const meuNome = cfg.meuNome || getMeuNome();
  // sem nome do lead: "Oi, , boa noite" vira "Oi, boa noite"
  const reserva = () =>
    montarMensagem(cfg.mensagemReserva.replace(/\{\{\s*meu_nome\s*\}\}/gi, meuNome), nome, lead.observacoes)
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
    `- Nome do corretor: ${meuNome || "(não informado — não invente um nome)"}`,
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

/** Gera um exemplo de mensagem (sem enviar), para conferir o tom da IA. */
export async function exemploDeMensagem(cfg: ConfigPrimeiroContato) {
  return gerarMensagem({ nome: "Mariana Souza", origem: "Instagram", tags: ["Meta Ads"], observacoes: "Empreendimento: Residencial Jardim das Flores" }, cfg);
}

// ---------- Teste pelo Inmovya (não grava nada) ----------
const lerConversaAgora = (phone: string) =>
  new Promise<MensagemWA[]>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu ao abrir a conversa."));
    }, 540000);
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

/** Salva o contato com o nome e marca a etiqueta (o mesmo que a extensão faz depois do 1º contato). */
const salvarEEtiquetarAgora = (phone: string, nome: string, etiqueta: string) =>
  new Promise<any>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu."));
    }, 540000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      event.detail?.ok ? resolve(event.detail) : reject(new Error(event.detail?.error || "falhou"));
    };
    window.addEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_AGENT", { detail: { op: "save_label", phone, nome, etiqueta, background: true, token } }));
  });

const ESPERA_ENVIO_MS = 10 * 60_000;

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

export interface PassoTeste {
  passo: string;
  ok: boolean | null; // null = em andamento
  detalhe?: string;
}

/** Faz o caminho completo do 1º contato para um número (ler conversa → IA → enviar), mostrando cada passo. */
export async function testarEnvio(
  telefone: string,
  cfg: ConfigPrimeiroContato,
  onPasso: (passos: PassoTeste[]) => void,
  contato?: { nome: string; etiqueta: string } // opcional: testa também salvar o contato e marcar a etiqueta
) {
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
  const atual = extensaoAtualizada(VERSAO_SCALE_AGENTE);
  marcarPasso("Inmovya Scale", atual, atual ? "conectado" : `versão antiga: recarregue em chrome://extensions (precisa da ${VERSAO_SCALE_AGENTE})`);

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

    marcarPasso("Escrever a mensagem", null);
    const msg = await gerarMensagem({ nome: "Teste", origem: "Instagram", tags: ["Meta Ads"], observacoes: null }, cfg, conversa);
    marcarPasso("Escrever a mensagem", true, `${msg.via}${msg.aviso ? ` (${msg.aviso})` : ""}: ${msg.texto}`);

    marcarPasso("Enviar no WhatsApp", null, "enviando na janelinha...");
    try {
      const como = await enviarComSegundaTentativa(tel, msg.texto, (aviso) => marcarPasso("Enviar no WhatsApp", null, aviso));
      marcarPasso("Enviar no WhatsApp", true, `enviado (${como})`);
    } catch (e: any) {
      return marcarPasso("Enviar no WhatsApp", false, e?.message || "falhou");
    }

    if (!contato?.nome.trim()) return;
    marcarPasso("Salvar contato e etiqueta", null, "abrindo a conversa...");
    try {
      const r = await salvarEEtiquetarAgora(tel, contato.nome.trim(), contato.etiqueta);
      const naoExiste = (r?.etiqueta?.alteracoes || []).find((a: string) => /não existe/.test(a));
      const etiquetaOk = !naoExiste && r?.etiqueta?.ok !== false;
      marcarPasso(
        "Salvar contato e etiqueta",
        !!r?.contato?.salvo && etiquetaOk,
        [
          `contato: ${r?.contato?.motivo || (r?.contato?.salvo ? "salvo" : "não salvo")}`,
          `etiqueta ${contato.etiqueta}: ${naoExiste ? "não existe no seu WhatsApp Business" : etiquetaOk ? "marcada" : r?.etiqueta?.error || "não marcada"}`,
        ].join(" · ")
      );
    } catch (e: any) {
      marcarPasso("Salvar contato e etiqueta", false, e?.message || "falhou");
    }
  });
}
