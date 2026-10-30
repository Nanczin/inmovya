// 1º CONTATO AUTOMÁTICO: assim que um lead novo entra no Inmovya, o agente escreve a primeira
// mensagem (a SUA mensagem pronta, com spintax — sem IA) e envia pelo WhatsApp Web, 24 horas por dia.
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
import { spin } from "@/lib/spintax";
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

export const VERSAO_SCALE_AGENTE = "1.6.5"; // 1.6.5: sem IA — sua mensagem com spintax; sincroniza o contato com o celular

// ---------- Configuração (no banco: a extensão lê de lá) ----------
export interface ConfigPrimeiroContato {
  ativo: boolean;
  ativadoEm: string | null; // só leads que chegarem depois disso (não dispara para a base antiga)
  usarIA: boolean; // sempre false: o 1º contato usa só a sua mensagem com spintax
  quais: "captura" | "todos"; // captura = Meta Ads, Bitrix/roleta e formulários; todos = inclusive cadastrados à mão
  instrucoes: string; // (antigo, da IA; não é mais usado)
  mensagemReserva: string; // a SUA mensagem do 1º contato, com spintax {Oi|Olá} e variáveis {{nome}}
  meuNome: string;
  incluirMidrah: boolean; // também manda para os leads do Midrah (quando o envio do Midrah falha)
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
  "{Oi|Olá|Oii}, {{nome}}, {{saudacao}}! {Aqui é|Quem fala é|Sou} {{meu_nome}}, {tudo bem|tudo certo|tudo bom}? {Vi|Recebi} seu cadastro no {{empreendimento}} e {quero te ajudar|posso te ajudar|vou te ajudar}. {Você procura|Você está procurando|Você busca} para morar ou para investir?";

const PADRAO: ConfigPrimeiroContato = {
  ativo: false,
  ativadoEm: null,
  usarIA: false,
  quais: "captura",
  instrucoes: INSTRUCOES_PADRAO,
  mensagemReserva: MENSAGEM_RESERVA_PADRAO,
  meuNome: "",
  incluirMidrah: false,
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
        usarIA: false, // sem IA no 1º contato
        quais: r.quais === "todos" ? "todos" : "captura",
        instrucoes: r.instrucoes || INSTRUCOES_PADRAO,
        mensagemReserva: r.mensagem_reserva || MENSAGEM_RESERVA_PADRAO,
        meuNome: r.meu_nome || getMeuNome(),
        incluirMidrah: !!r.incluir_midrah,
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
  const { error } = await supabase.from("agente_config" as any).upsert(
    {
      user_id: user.id,
      ativo: c.ativo,
      ativado_em: ativadoEm,
      usar_ia: false, // sem IA: a extensão usa só a sua mensagem com spintax
      quais: c.quais,
      instrucoes: c.instrucoes,
      mensagem_reserva: c.mensagemReserva,
      meu_nome: c.meuNome.trim(),
      ...(c.incluirMidrah || (anterior?.cfg as any)?.incluirMidrah ? { incluir_midrah: !!c.incluirMidrah } : {}),
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
    await carregarConfigAgente();
    // entrega o token SEMPRE (mesmo com o 1º contato desligado): o robô de anúncios e o
    // Dinheiro na Mesa (oferta ativa nas etiquetas do WhatsApp) usam o mesmo token.
    // Com o 1º contato desligado o banco não devolve lead nenhum para enviar.
    if (!tokenAtual) return;
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
    .neq("primeiro_contato_status", "na_fila") // os escolhidos aparecem na lista da fila, não aqui
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
export type SituacaoFila = "na_fila" | "escolhido" | "antes_de_ligar" | "desistiu" | "fora_da_regra" | "atendendo" | "tirado";
export const TIRADO_DA_FILA = "tirado da fila por você";
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
  const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, origem, tags, created_at, primeiro_contato_status, primeiro_contato_tentativas, primeiro_contato_em, primeiro_contato_erro")
    .eq("user_id", user.id)
    .gte("created_at", desde)
    .or("primeiro_contato_status.is.null,primeiro_contato_status.eq.erro,primeiro_contato_status.eq.enviando,primeiro_contato_status.eq.na_fila,primeiro_contato_status.eq.pulado")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  const ligadoEm = cfg.ativadoEm ? new Date(cfg.ativadoEm).getTime() : Infinity;
  const tresDias = Date.now() - 3 * 86400_000;
  const lista = (data || []).filter((l: any) => l.primeiro_contato_status !== "pulado" || l.primeiro_contato_erro === TIRADO_DA_FILA);
  return lista.map((l: any) => {
    const base = { id: l.id, nome: l.nome || "Lead sem nome", telefone: l.telefone || "", criadoEm: l.created_at };
    const tent = l.primeiro_contato_tentativas || 0;
    const s = l.primeiro_contato_status;
    if (s === "pulado") return { ...base, situacao: "tirado" as const, motivo: "você tirou da fila — não será chamado" };
    if (s === "na_fila") return { ...base, situacao: "escolhido" as const, motivo: cfg.ativo ? "você escolheu atender — recebe em 1 a 2 minutos" : "você escolheu atender — ligue o agente para enviar" };
    // já entrou na fila alguma vez (automático ou escolhido): tenta de novo até 3 vezes
    if (s && tent >= 3) return { ...base, situacao: "desistiu" as const, motivo: `desistiu depois de 3 tentativas${l.primeiro_contato_erro ? `: ${l.primeiro_contato_erro}` : ""} — selecione e clique em Atender para tentar de novo` };
    if (s === "enviando") {
      const travado = l.primeiro_contato_em && Date.now() - new Date(l.primeiro_contato_em).getTime() > 15 * 60_000;
      return travado
        ? { ...base, situacao: "na_fila" as const, motivo: `o envio travou — volta para a fila (tentativa ${tent + 1} de 3)` }
        : { ...base, situacao: "atendendo" as const, motivo: "a extensão está atendendo agora" };
    }
    if (s === "erro")
      return { ...base, situacao: "na_fila" as const, motivo: `falhou${l.primeiro_contato_erro ? ` (${l.primeiro_contato_erro})` : ""} — tenta de novo em uns 5 min (tentativa ${tent + 1} de 3)` };
    // nunca entrou na fila: valem as regras automáticas
    if (new Date(l.created_at).getTime() < tresDias)
      return { ...base, situacao: "antes_de_ligar" as const, motivo: "chegou há mais de 3 dias (o agente sozinho não chama) — selecione para atender" };
    const midrah = String(l.origem || "").toLowerCase() === "midrah";
    if (midrah && !cfg.incluirMidrah) return { ...base, situacao: "fora_da_regra" as const, motivo: 'Midrah — o próprio Midrah faz o 1º contato (ligue "Enviar também para os leads do Midrah" para o Inmovya mandar)' };
    if (cfg.quais !== "todos" && !midrah && !ehDaCaptura(l)) return { ...base, situacao: "fora_da_regra" as const, motivo: 'não veio da captura automática (selecione para atender, ou marque "Todos os leads novos")' };
    if (new Date(l.created_at).getTime() < ligadoEm)
      return { ...base, situacao: "antes_de_ligar" as const, motivo: cfg.ativo ? "chegou antes de você ligar o agente — selecione para atender" : "o agente está desligado" };
    return { ...base, situacao: "na_fila" as const, motivo: "na fila — recebe em 1 a 2 minutos" };
  });
}

/** Você escolhe atender: entra na fila do zero (apaga as tentativas que falharam), mesmo fora das regras automáticas. */
export async function colocarNaFila(leadIds: string[]) {
  if (!leadIds.length) return;
  const { error } = await supabase
    .from("leads")
    .update({ primeiro_contato_status: "na_fila", primeiro_contato_tentativas: 0, primeiro_contato_erro: null, primeiro_contato_em: null } as any)
    .in("id", leadIds);
  if (error) throw error;
}

/** Você tira da fila: o agente não chama esses leads (dá para pôr de volta depois). */
export async function tirarDaFila(leadIds: string[]) {
  if (!leadIds.length) return;
  const { error } = await supabase
    .from("leads")
    .update({ primeiro_contato_status: "pulado", primeiro_contato_erro: TIRADO_DA_FILA, primeiro_contato_em: new Date().toISOString() } as any)
    .in("id", leadIds)
    .or("primeiro_contato_status.is.null,primeiro_contato_status.neq.enviado"); // nunca mexe em quem já recebeu
  if (error) throw error;
}

export const LIMPO_DA_FILA = "fila limpa por você";

/** Limpa a fila inteira: ninguém que ainda não recebeu será chamado e a lista fica vazia (quem já recebeu não muda). */
export async function limparFila(leadIds: string[]) {
  if (!leadIds.length) return;
  for (let i = 0; i < leadIds.length; i += 200) {
    const { error } = await supabase
      .from("leads")
      .update({ primeiro_contato_status: "pulado", primeiro_contato_erro: LIMPO_DA_FILA, primeiro_contato_em: new Date().toISOString() } as any)
      .in("id", leadIds.slice(i, i + 200))
      .or("primeiro_contato_status.is.null,primeiro_contato_status.neq.enviado");
    if (error) throw error;
  }
}

/**
 * Exclui da BASE DE LEADS do Inmovya quem você apagou da fila do 1º contato.
 * Nunca apaga quem já recebeu o 1º contato. Lead do Bitrix apagado não volta pela captura
 * (o banco guarda que foi apagado).
 */
export async function excluirDaFilaEDaBase(leadIds: string[]) {
  let excluidos = 0;
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data, error } = await supabase
      .from("leads")
      .delete()
      .in("id", leadIds.slice(i, i + 200))
      .or("primeiro_contato_status.is.null,primeiro_contato_status.neq.enviado")
      .select("id");
    if (error) throw error;
    excluidos += data?.length || 0;
  }
  return excluidos;
}

export const retentarLead = (leadId: string) => colocarNaFila([leadId]);

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

export { spin, contarVariacoes, spintaxValido, gerarSpintax } from "@/lib/spintax";

/** Monta a mensagem do 1º contato: sua mensagem pronta + spintax + variáveis (sem IA). */
export async function gerarMensagem(lead: LeadMensagem, cfg: ConfigPrimeiroContato): Promise<{ texto: string; via: string; aviso?: string }> {
  const meuNome = cfg.meuNome || getMeuNome();
  const texto = montarMensagem(spin(cfg.mensagemReserva).replace(/\{\{\s*meu_nome\s*\}\}/gi, meuNome), lead.nome || "", lead.observacoes)
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,(\s*,)+/g, ",") // sem nome do lead: "Oi, , boa noite" vira "Oi, boa noite"
    .trim();
  return { texto, via: "sua mensagem (spintax)" };
}

/** Exemplos de mensagem (sem enviar), para conferir as variações. */
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
    const msg = await gerarMensagem({ nome: "Teste", origem: "Instagram", tags: ["Meta Ads"], observacoes: null }, cfg);
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
