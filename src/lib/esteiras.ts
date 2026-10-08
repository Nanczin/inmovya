// Esteiras de follow-up dentro do Inmovya.
// O Inmovya guarda esteiras, passos e em que passo cada lead está;
// a extensão Inmovya Scale apenas envia a mensagem no WhatsApp Web.
import { supabase } from "@/integrations/supabase/client";

export interface Esteira {
  id: string;
  nome: string;
  ordem: number;
  ao_concluir_tag: string | null;
  ao_concluir_etapa?: string | null; // coluna do Negócios para onde o lead vai ao terminar (ex.: "Perdido")
  ao_concluir_dias?: number | null; // dias sem resposta depois do último passo antes de finalizar
  etapa?: string | null; // etapa de Negócios ligada (ex.: "20%")
  scale_id?: string | null;
  created_at?: string;
}

/** Sugere a etapa de Negócios pelo nome da esteira do Scale (ex.: "Esteira 50%" -> "50%"). */
export const etapaPeloNome = (nome: string): string | null => {
  const n = String(nome || "").toLowerCase();
  if (/\b20\s*%?/.test(n)) return "20%";
  if (/\b50\s*%?/.test(n)) return "50%";
  if (/\b(70|75)\s*%?/.test(n)) return "70%";
  if (/\b90\s*%?/.test(n)) return "90%";
  return null;
};

export interface EsteiraPasso {
  id: string;
  esteira_id: string;
  ordem: number;
  titulo: string;
  mensagem: string;
  dias_espera: number;
  so_colar: boolean;
  scale_id?: string | null;
  anexos?: EsteiraAnexo[] | null;
  etapa?: string | null; // coluna do Negócios para onde o card vai quando este passo é enviado (ex.: "P3")
}

// ---------- Anexos (PDF, vídeo, imagem, áudio, documentos...) ----------
// Os arquivos ficam NO COMPUTADOR (não ocupam o banco do Inmovya).
// No banco fica só o nome; o "atalho" para o arquivo fica guardado neste navegador (Chrome/Edge).
export interface EsteiraAnexo {
  local_id?: string; // atalho do arquivo guardado neste computador
  path?: string; // (antigo) arquivo no Storage
  name: string;
  type: string;
  size: number;
  legenda?: string | null; // legenda própria do anexo (aceita {{nome}}, {{saudacao}}...)
  legenda_texto?: boolean; // usa o texto da mensagem escolhida como legenda deste anexo
  depois_de?: number | null; // vai depois da mensagem N (0 = 1ª parte separada por ===); vazio = no fim
}

/** Divide o texto do passo nas mensagens separadas por === (igual à extensão). */
export const partesDaMensagem = (texto: string) => {
  const t = String(texto || "").replace(/\r\n?/g, "\n");
  const partes = t.includes("\n\n===\n\n") ? t.split("\n\n===\n\n") : t.split("===");
  return partes.length ? partes : [""];
};

export const ANEXOS_BUCKET = "esteira-anexos";
export const ANEXO_MAX_MB = 40;

const DB_NOME = "inmovya-anexos";
const abrirDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("arquivos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const idb = async <T,>(modo: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T>) => {
  const db = await abrirDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("arquivos", modo);
    const req = fn(tx.objectStore("arquivos"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const anexosLocaisSuportados = () => typeof (window as any).showOpenFilePicker === "function";

/** Abre a janela do computador para escolher arquivos (qualquer tipo). */
export async function escolherArquivosDoComputador(): Promise<EsteiraAnexo[]> {
  if (!anexosLocaisSuportados()) throw new Error("Use o Google Chrome (ou Edge) no computador para anexar arquivos.");
  let handles: any[] = [];
  try {
    handles = await (window as any).showOpenFilePicker({ multiple: true });
  } catch (err: any) {
    if (err?.name === "AbortError") return [];
    throw err;
  }
  const out: EsteiraAnexo[] = [];
  for (const h of handles) {
    const f: File = await h.getFile();
    if (f.size > ANEXO_MAX_MB * 1024 * 1024) throw new Error(`${f.name} tem mais de ${ANEXO_MAX_MB} MB.`);
    const local_id = crypto.randomUUID();
    await idb("readwrite", (st) => st.put(h, local_id));
    out.push({ local_id, name: f.name, type: f.type || "application/octet-stream", size: f.size });
  }
  return out;
}

export async function esquecerArquivoLocal(local_id: string) {
  await idb("readwrite", (st) => st.delete(local_id)).catch(() => {});
}

/** Pede ao Chrome a permissão de leitura (precisa ser chamado logo após um clique). */
export async function liberarArquivosLocais(anexos: EsteiraAnexo[]) {
  const faltando: string[] = [];
  for (const a of anexos) {
    if (!a.local_id) continue;
    const h: any = await idb("readonly", (st) => st.get(a.local_id!)).catch(() => null);
    if (!h) {
      faltando.push(a.name);
      continue;
    }
    let p = await h.queryPermission?.({ mode: "read" });
    if (p !== "granted") p = await h.requestPermission?.({ mode: "read" });
    if (p !== "granted") faltando.push(a.name);
  }
  return faltando;
}

const blobParaDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Lê os anexos do computador e devolve no formato que a extensão envia no WhatsApp. */
export async function prepararAnexosParaEnvio(anexos?: EsteiraAnexo[] | null, leadNome = "", totalPartes = 1, observacoes?: string | null) {
  const lista = Array.isArray(anexos) ? anexos : [];
  const out: { id: string; name: string; type: string; size: number; data: string; useCaption: boolean; caption: string; messageIndex: number }[] = [];
  const partesComLegenda = new Set<number>();
  for (const a of lista) {
    let blob: Blob | null = null;
    if (a.local_id) {
      const h: any = await idb("readonly", (st) => st.get(a.local_id!)).catch(() => null);
      if (!h) throw new Error(`O arquivo ${a.name} não está neste computador. Anexe de novo na esteira.`);
      try {
        blob = await h.getFile();
      } catch {
        throw new Error(`Não consegui abrir ${a.name} (foi movido, apagado ou sem permissão).`);
      }
    } else if (a.path) {
      const { data, error } = await supabase.storage.from(ANEXOS_BUCKET).download(a.path);
      if (error || !data) throw new Error(`Não foi possível baixar o anexo ${a.name}.`);
      blob = data;
    }
    if (!blob) continue;
    const data = await blobParaDataUrl(blob.type ? blob : new Blob([blob], { type: a.type }));
    const caption = (a.legenda || "").trim() ? montarMensagem(String(a.legenda), leadNome, observacoes) : "";
    const ultima = Math.max(0, totalPartes - 1);
    const messageIndex = Number.isInteger(a.depois_de) ? Math.min(Math.max(0, a.depois_de as number), ultima) : ultima;
    // só um anexo por mensagem pode levar o texto dela como legenda
    const useCaption = !caption && !!a.legenda_texto && !partesComLegenda.has(messageIndex);
    if (useCaption) partesComLegenda.add(messageIndex);
    out.push({ id: a.local_id || a.path || a.name, name: a.name, type: a.type, size: a.size, data, useCaption, caption, messageIndex });
  }
  return out;
}

export async function removerAnexoDoStorage(path: string) {
  await supabase.storage.from(ANEXOS_BUCKET).remove([path]);
}

export const tamanhoLegivel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Intervalo entre envios (regra: no mínimo 2 minutos, com variação)
export const INTERVALO_MIN_SEG = 120;
export const INTERVALO_MAX_SEG = 180;
export const intervaloAleatorio = () =>
  INTERVALO_MIN_SEG + Math.floor(Math.random() * (INTERVALO_MAX_SEG - INTERVALO_MIN_SEG + 1));

// ---------- Variáveis (mesmas do Scale) ----------
export const primeiroNome = (nome = "") => {
  const n = String(nome || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!n) return "";
  const p = n
    .split(" ")
    .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, ""))
    .find((part) => /\p{L}/u.test(part));
  const first = p || n.split(" ")[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};

export const saudacao = (d = new Date()) => {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "bom dia";
  if (h >= 12 && h < 18) return "boa tarde";
  return "boa noite";
};

const MEU_NOME_KEY = "inmovya_meu_nome";
export const getMeuNome = () => {
  try {
    return localStorage.getItem(MEU_NOME_KEY) || "";
  } catch {
    return "";
  }
};
export const setMeuNome = (v: string) => {
  try {
    localStorage.setItem(MEU_NOME_KEY, v);
  } catch {
    /* ignore */
  }
};

// Texto usado no {{empreendimento}} quando a descrição do lead não traz o empreendimento
export const EMPREENDIMENTO_PADRAO = "imóveis";

const semAcentoEmp = (s: string) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").toLowerCase().trim();

// Textos que ocupam o campo mas não são um projeto (ex.: "Informar empreendimento", "não informado", "-")
const naoEhProjeto = (texto: string) => {
  const t = semAcentoEmp(texto);
  if (!t) return true;
  if (/^(informar|informe|preencher|definir|a definir|sem|nenhum|qual|cadastrar)( o| um)? (empreendimento|empreendimentos|projeto|imovel|produto)$/.test(t)) return true;
  if (/^(empreendimento|projeto|imovel) (nao informado|a definir|indefinido)$/.test(t)) return true;
  return /^(n a|na|nao informado|nao informou|a definir|indefinido|nenhum|sem|null|undefined|empreendimento|projeto)$/.test(t);
};

/**
 * Nome do projeto que o lead procura, lido da descrição (observações) do lead.
 * - "Empreendimento: X" em qualquer linha -> X
 * - Cadastro do Bitrix ("692363: Nome do Lead | Nurban Vila Buarque | Bitrix #692363") -> só o projeto
 * - Senão, a primeira linha preenchida.
 * Textos automáticos ("Lead criado automaticamente...") e de preencher ("Informar empreendimento") não contam.
 */
export const empreendimentoDoLead = (observacoes?: string | null, leadNome = "") => {
  const linhas = String(observacoes || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const l of linhas) {
    const m = l.match(/^(?:empreendimento|empreendimentos|projeto|im[óo]vel|interesse)\s*[:\-–]\s*(.+)$/i);
    if (m && m[1].trim() && !naoEhProjeto(m[1])) return m[1].trim();
  }
  const primeira = linhas[0] || "";
  if (!primeira || /^lead criado automaticamente/i.test(primeira)) return "";
  if (primeira.includes("|")) {
    const nome = semAcentoEmp(leadNome);
    const partes = primeira
      .split("|")
      .map((p) => p.trim().replace(/[.;,]+$/, "").trim())
      .filter(Boolean)
      .filter((p) => !/^\d+\s*:/.test(p)) // "692363: Nome do lead"
      .filter((p) => !/\bbitrix\b/i.test(p) && !/#\s*\d+/.test(p)) // "Bitrix #692363"
      .filter((p) => !/^\d+$/.test(p))
      .filter((p) => !nome || semAcentoEmp(p) !== nome)
      .filter((p) => !naoEhProjeto(p));
    return partes[0] || "";
  }
  const projeto = primeira.replace(/[.;,]+$/, "");
  return naoEhProjeto(projeto) ? "" : projeto;
};

/**
 * Sem projeto, troca "{{empreendimento}}" por "imóveis" ajustando a palavra antes dele:
 * "cadastro no {{empreendimento}}" -> "cadastro buscando imóveis"; "interesse em/do/o..." -> "em/de/ imóveis".
 */
const semProjeto = (template: string) =>
  template
    .replace(/\b(n[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, `buscando ${EMPREENDIMENTO_PADRAO}`)
    .replace(/\b(d[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, `de ${EMPREENDIMENTO_PADRAO}`)
    .replace(/\b(pel[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, `por ${EMPREENDIMENTO_PADRAO}`)
    .replace(/(^|[^\p{L}])([oa]s?)\s+\{\{\s*empreendimento\s*\}\}/giu, `$1${EMPREENDIMENTO_PADRAO}`)
    .replace(/\{\{\s*empreendimento\s*\}\}/gi, EMPREENDIMENTO_PADRAO);

export const montarMensagem = (template: string, leadNome: string, observacoes?: string | null) => {
  if (!template) return "";
  const now = new Date();
  const projeto = empreendimentoDoLead(observacoes, leadNome);
  return (projeto ? template.replace(/\{\{\s*empreendimento\s*\}\}/gi, projeto) : semProjeto(template))
    .replace(/\{\{\s*(nome|primeiro_nome)\s*\}\}/gi, primeiroNome(leadNome))
    .replace(/\{\{\s*nome_completo\s*\}\}/gi, leadNome || "")
    .replace(/\{\{\s*saudacao\s*\}\}/gi, saudacao(now))
    .replace(/\{\{\s*meu_nome\s*\}\}/gi, getMeuNome())
    .replace(/\{\{\s*data\s*\}\}/gi, now.toLocaleDateString("pt-BR"))
    .replace(/\{\{\s*hora\s*\}\}/gi, now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
};

// Telefone para o WhatsApp: 55 + DDD + número
export const telefoneWhatsApp = (telefone?: string | null) => {
  let d = String(telefone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return d;
};

// ---------- Ponte com a extensão ----------
// versão do Inmovya Scale que respondeu por último (versões antigas não informam)
export let versaoExtensao: string | null = null;
const versaoNum = (v: string | null) => (v || "0").split(".").map((n) => parseInt(n) || 0);
export const extensaoAtualizada = (minima = "1.2.1") => {
  const a = versaoNum(versaoExtensao), b = versaoNum(minima);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return true;
};

export const checarExtensao = (timeoutMs = 1500) =>
  new Promise<boolean>((resolve) => {
    let done = false;
    const onReady = (ev?: Event) => {
      if (done) return;
      done = true;
      versaoExtensao = (ev as CustomEvent | undefined)?.detail?.version || null;
      window.removeEventListener("INMOVYA_EXTENSION_READY", onReady);
      resolve(true);
    };
    window.addEventListener("INMOVYA_EXTENSION_READY", onReady);
    window.dispatchEvent(new CustomEvent("INMOVYA_CHECK_EXTENSION"));
    setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener("INMOVYA_EXTENSION_READY", onReady);
      resolve(false);
    }, timeoutMs);
  });

// Intervalo entre as mensagens do MESMO envio (partes separadas por === e anexos)
const GAP_KEY = "inmovya_intervalo_mensagens";
export const getIntervaloMensagens = (): { min: number; max: number } => {
  try {
    const v = JSON.parse(localStorage.getItem(GAP_KEY) || "null");
    if (v && Number.isFinite(v.min) && Number.isFinite(v.max)) return { min: Math.max(0, v.min), max: Math.max(v.min, v.max) };
  } catch {
    /* ignore */
  }
  return { min: 10, max: 20 };
};
export const setIntervaloMensagens = (min: number, max: number) => {
  try {
    localStorage.setItem(GAP_KEY, JSON.stringify({ min: Math.max(0, min), max: Math.max(min, max) }));
  } catch {
    /* ignore */
  }
};

// Envio em segundo plano: a extensão abre o WhatsApp numa janela pequena, sem tirar o foco
const SEGUNDO_PLANO_KEY = "inmovya_esteira_segundo_plano";
export const getSegundoPlano = () => {
  try {
    return localStorage.getItem(SEGUNDO_PLANO_KEY) !== "0";
  } catch {
    return true;
  }
};
export const setSegundoPlano = (v: boolean) => {
  try {
    localStorage.setItem(SEGUNDO_PLANO_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
};

export const enviarPeloWhatsApp = (phone: string, text: string, attachments: any[] = [], background = false) =>
  new Promise<void>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
      reject(new Error("Tempo esgotado aguardando a confirmação da extensão."));
    }, 120000 + attachments.length * 60000 + (text.split("===").length + attachments.length) * getIntervaloMensagens().max * 1000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
      event.detail?.ok ? resolve() : reject(new Error(event.detail?.error || "O envio não foi confirmado."));
    };
    window.addEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_OPEN_WHATSAPP", {
        detail: {
          phone,
          text,
          token,
          attachments,
          gapMinMs: getIntervaloMensagens().min * 1000,
          gapMaxMs: getIntervaloMensagens().max * 1000,
          background,
        },
      }));
  });

// Lê os dados guardados no Scale (precisa da extensão atualizada)
export const lerDadosDoScale = (timeoutMs = 8000) =>
  new Promise<any>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_SCALE_DATA", onData as EventListener);
      reject(new Error("A extensão não respondeu. Atualize o Inmovya Scale (Recarregar em chrome://extensions) ou importe o arquivo de backup."));
    }, timeoutMs);
    const onData = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_SCALE_DATA", onData as EventListener);
      if (!event.detail?.ok) return reject(new Error(event.detail?.error || "Falha ao ler o Scale."));
      try {
        resolve(event.detail.json ? JSON.parse(event.detail.json) : event.detail.data);
      } catch (err) {
        reject(err);
      }
    };
    window.addEventListener("INMOVYA_SCALE_DATA", onData as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_SCALE_EXPORT", { detail: { token } }));
  });

// ---------- Avanço do lead na esteira ----------
const addDias = (dias: number) => new Date(Date.now() + Math.max(0, dias) * 86400000).toISOString();

type LeadAvanco = { id: string; nome: string; status?: string | null; tags?: string[] | null; esteira_passo?: number | null };

/** Calcula como o lead fica depois de enviar o passo (sem gravar). */
export function calcularAvanco(
  lead: LeadAvanco,
  esteira: Esteira,
  passos: EsteiraPasso[],
  passoEnviado: EsteiraPasso,
  opcoes: { proximoHoje?: boolean } = {}
) {
  const indice = passos.findIndex((p) => p.id === passoEnviado.id);
  const proximo = passos[indice + 1];
  const agora = new Date().toISOString();

  let update: Record<string, any>;
  let concluiu = false;
  // O card anda no Negócios junto com a esteira (ex.: enviou o passo 3 -> coluna P3)
  const etapaDoPasso = (passoEnviado.etapa || "").trim();
  if (proximo) {
    update = {
      ...(etapaDoPasso ? { status: etapaDoPasso } : {}),
      esteira_passo: indice + 1,
      // 2 esteiras no dia: depois da 1ª, o próximo passo fica para hoje mesmo
      // sem "2 esteiras hoje": vai sempre para o próximo dia (no mínimo 1 dia, mesmo se o passo estiver com 0)
      esteira_proximo: opcoes.proximoHoje ? new Date().toISOString() : addDias(Math.max(1, proximo.dias_espera ?? 1)),
      esteira_ultimo_envio: agora,
      ultimo_contato: agora,
    };
  } else if ((esteira.ao_concluir_dias || 0) > 0) {
    // último passo enviado: aguarda X dias sem resposta; depois o Inmovya finaliza sozinho
    // (move para a coluna escolhida, ex.: Perdido, e põe a etiqueta, ex.: disparo)
    update = {
      ...(etapaDoPasso ? { status: etapaDoPasso } : {}),
      esteira_passo: indice + 1,
      esteira_proximo: addDias(esteira.ao_concluir_dias || 1),
      esteira_ultimo_envio: agora,
      ultimo_contato: agora,
    };
  } else {
    concluiu = true;
    const novas = etiquetasDaEsteira(esteira);
    const tag = novas.join(",");
    const tags = Array.from(new Set([...(lead.tags || []), ...novas]));
    update = {
      esteira_id: null,
      esteira_passo: 0,
      esteira_proximo: null,
      esteira_ultimo_envio: agora,
      ultimo_contato: agora,
      tags,
      // Ao terminar: vai para a coluna escolhida (ex.: Lista fria); sem coluna escolhida,
      // regra antiga: sai do funil (etapa limpa) e fica com a etiqueta de disparo
      ...((esteira.ao_concluir_etapa || "").trim()
        ? { status: (esteira.ao_concluir_etapa || "").trim() }
        : etapaDoPasso
        ? { status: etapaDoPasso }
        : tag
        ? { status: null }
        : {}),
    };
  }
  return { update, concluiu, indice };
}

/** Registra o envio do passo atual e move o lead para o próximo passo (ou conclui a esteira). */
export async function avancarLead(
  lead: LeadAvanco,
  esteira: Esteira,
  passos: EsteiraPasso[],
  passoEnviado: EsteiraPasso,
  detalhe: string,
  opcoes: { proximoHoje?: boolean } = {}
) {
  const { update, concluiu, indice } = calcularAvanco(lead, esteira, passos, passoEnviado, opcoes);

  let { error } = await supabase.from("leads").update(update).eq("id", lead.id);
  if (error && "status" in update) {
    // Se o banco não aceitar etapa vazia, mantém a etapa e só aplica o resto
    const { status, ...semStatus } = update;
    ({ error } = await supabase.from("leads").update(semStatus).eq("id", lead.id));
  }
  if (error) throw error;

  // a tabela só aceita call/email/meeting/note/status_change ("whatsapp" era recusado em silêncio)
  const { error: erroHistorico } = await supabase.from("lead_timeline").insert({
    lead_id: lead.id,
    type: "note",
    title: `Esteira ${esteira.nome} — ${passoEnviado.titulo || `Passo ${indice + 1}`}`,
    description: concluiu ? `${detalhe}\n\nEsteira concluída.` : detalhe,
    author: "Esteira",
  });
  if (erroHistorico) console.error("Histórico da esteira não gravado:", erroHistorico);

  return { concluiu };
}

/** Coloca leads numa esteira, começando no primeiro passo (D1), com envio para agora. */
export async function colocarNaEsteira(leadIds: string[], esteiraId: string) {
  for (let i = 0; i < leadIds.length; i += 200) {
    const chunk = leadIds.slice(i, i + 200);
    const { error } = await supabase
      .from("leads")
      .update({ esteira_id: esteiraId, esteira_passo: 0, esteira_proximo: new Date().toISOString() })
      .in("id", chunk);
    if (error) throw error;
  }
}

/** Coloca o lead num passo escolhido da esteira (ex.: D3), com envio para hoje. */
export async function moverParaPasso(leadIds: string[], esteiraId: string, indice: number, passos?: EsteiraPasso[]) {
  // Se o passo anterior tem coluna no Negócios (ex.: P2), o card vai para ela (já "recebeu" até ali)
  const anterior = passos && indice > 0 ? passos[indice - 1] : null;
  const etapa = (anterior?.etapa || "").trim();
  for (let i = 0; i < leadIds.length; i += 200) {
    const chunk = leadIds.slice(i, i + 200);
    const { error } = await supabase
      .from("leads")
      .update({
        esteira_id: esteiraId,
        esteira_passo: Math.max(0, indice),
        esteira_proximo: new Date().toISOString(),
        ...(etapa ? { status: etapa } : {}),
      })
      .in("id", chunk);
    if (error) throw error;
  }
}

export async function tirarDaEsteira(leadIds: string[]) {
  for (let i = 0; i < leadIds.length; i += 200) {
    const chunk = leadIds.slice(i, i + 200);
    const { error } = await supabase
      .from("leads")
      .update({ esteira_id: null, esteira_passo: 0, esteira_proximo: null })
      .in("id", chunk);
    if (error) throw error;
  }
}

// ---------- Importação do Scale ----------
const semAcento = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export interface PlanoImportacao {
  esteiras: { scaleId: string; nome: string; passos: { scaleId: string; titulo: string; mensagem: string; soColar: boolean; anexos: number }[] }[];
  leads: { leadId: string; leadNome: string; scaleEsteiraId: string; passoIndex: number }[];
  semCorrespondencia: string[];
  concluidos: number;
  anexosIgnorados: number;
}

/** Monta o que será importado a partir do backup do Scale (sem gravar nada). */
export function planejarImportacao(
  backup: any,
  leads: { id: string; nome: string; telefone?: string | null }[]
): PlanoImportacao {
  const src = backup?.backupVersion && backup?.data ? backup.data : backup || {};
  const categories: any[] = Array.isArray(src.categories) ? src.categories : [];
  const replies: any[] = Array.isArray(src.replies) ? src.replies : [];
  const waLabels: any[] = Array.isArray(src.waLabels) ? src.waLabels : [];
  const catAssign: Record<string, string> = src.leadCategoryAssignments || {};
  const stageAssign: Record<string, string> = src.leadStageAssignments || {};

  let anexosIgnorados = 0;
  const esteiras = categories.map((c) => {
    const passos = replies
      .filter((r) => r.categoryId === c.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((r) => {
        const anexos = Array.isArray(r.attachments) ? r.attachments.length : 0;
        anexosIgnorados += anexos;
        return { scaleId: String(r.id), titulo: String(r.title || ""), mensagem: String(r.message || ""), soColar: !!r.pasteOnly, anexos };
      });
    return { scaleId: String(c.id), nome: String(c.name || "Esteira"), passos };
  });

  // Contatos conhecidos pelo Scale (chave -> nome / telefone do chatId)
  const contatos = new Map<string, { nome: string; telefone: string }>();
  waLabels.forEach((l) =>
    (Array.isArray(l.contacts) ? l.contacts : []).forEach((ct: any) => {
      const nomeNorm = semAcento(ct.name || "");
      const key = ct.chatId || nomeNorm;
      if (!key) return;
      const tel = String(ct.chatId || "").split("@")[0].replace(/\D/g, "");
      contatos.set(key, { nome: ct.name || "", telefone: tel });
    })
  );

  const porTelefone = new Map<string, { id: string; nome: string }>();
  const porNome = new Map<string, { id: string; nome: string }[]>();
  leads.forEach((l) => {
    const t = String(l.telefone || "").replace(/\D/g, "");
    if (t.length >= 8) porTelefone.set(t.slice(-8), l);
    const n = semAcento(l.nome);
    if (n) porNome.set(n, [...(porNome.get(n) || []), l]);
  });

  const resultado: PlanoImportacao["leads"] = [];
  const semCorrespondencia: string[] = [];
  let concluidos = 0;

  Object.entries(catAssign).forEach(([leadKey, catId]) => {
    const esteira = esteiras.find((e) => e.scaleId === catId);
    if (!esteira) return;
    const stage = stageAssign[`${catId}:${leadKey}`] || "unassigned";
    if (stage === "completed") {
      concluidos++;
      return;
    }
    const idx = esteira.passos.findIndex((p) => p.scaleId === stage);
    const passoIndex = idx >= 0 ? idx : 0;

    const contato = contatos.get(leadKey);
    const tel = (contato?.telefone || String(leadKey).split("@")[0]).replace(/\D/g, "");
    let lead = tel.length >= 8 ? porTelefone.get(tel.slice(-8)) : undefined;
    if (!lead) {
      const candidatos = porNome.get(semAcento(contato?.nome || leadKey)) || [];
      if (candidatos.length === 1) lead = candidatos[0];
    }
    if (!lead) {
      semCorrespondencia.push(contato?.nome || leadKey);
      return;
    }
    resultado.push({ leadId: lead.id, leadNome: lead.nome, scaleEsteiraId: esteira.scaleId, passoIndex });
  });

  return { esteiras, leads: resultado, semCorrespondencia, concluidos, anexosIgnorados };
}

/** Grava as esteiras/passos e posiciona os leads. Esteiras já importadas (mesmo scale_id) são atualizadas. */
export async function executarImportacao(plano: PlanoImportacao) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: existentes } = await supabase.from("esteiras").select("id, scale_id").eq("user_id", user.id);
  const idPorScale = new Map<string, string>();
  (existentes || []).forEach((e: any) => e.scale_id && idPorScale.set(e.scale_id, e.id));

  const passosPorEsteira = new Map<string, number>();
  for (const [i, e] of plano.esteiras.entries()) {
    let esteiraId = idPorScale.get(e.scaleId);
    if (esteiraId) {
      await supabase.from("esteiras").update({ nome: e.nome, ordem: i }).eq("id", esteiraId);
      // liga à etapa de Negócios se o nome indicar (só se ainda não estiver ligada)
      const etapa = etapaPeloNome(e.nome);
      if (etapa) await supabase.from("esteiras").update({ etapa }).eq("id", esteiraId).is("etapa", null);
      await supabase.from("esteira_passos").delete().eq("esteira_id", esteiraId);
    } else {
      const { data, error } = await supabase
        .from("esteiras")
        .insert({ nome: e.nome, ordem: i, scale_id: e.scaleId, user_id: user.id, ao_concluir_tag: "disparo", etapa: etapaPeloNome(e.nome) })
        .select("id")
        .single();
      if (error) throw error;
      esteiraId = data.id;
      idPorScale.set(e.scaleId, esteiraId!);
    }
    if (e.passos.length) {
      const { error } = await supabase.from("esteira_passos").insert(
        e.passos.map((p, ordem) => ({
          esteira_id: esteiraId,
          user_id: user.id,
          ordem,
          titulo: p.titulo || `D${ordem + 1}`,
          mensagem: p.mensagem,
          so_colar: p.soColar,
          dias_espera: ordem === 0 ? 0 : 1,
          scale_id: p.scaleId,
        }))
      );
      if (error) throw error;
    }
    passosPorEsteira.set(e.scaleId, e.passos.length);
  }

  // Leads: posiciona no passo em que estavam no Scale. O Scale já avança o lead ao enviar,
  // então o passo importado é o de amanhã (com "agora" o lead recebia 2 passos no mesmo dia).
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);
  const proximoEnvio = amanha.toISOString();
  for (const l of plano.leads) {
    const esteiraId = idPorScale.get(l.scaleEsteiraId);
    if (!esteiraId) continue;
    const total = passosPorEsteira.get(l.scaleEsteiraId) || 0;
    const { error } = await supabase
      .from("leads")
      .update({ esteira_id: esteiraId, esteira_passo: Math.min(l.passoIndex, Math.max(0, total - 1)), esteira_proximo: proximoEnvio })
      .eq("id", l.leadId);
    if (error) throw error;
  }
}

/** Finaliza quem terminou a esteira e não respondeu no prazo (também roda sozinho no banco a cada 30 min). */
export async function finalizarEsteirasVencidas() {
  const { data, error } = await supabase.rpc("finalizar_esteiras_vencidas" as any);
  if (error) return 0;
  return Number(data) || 0;
}

/** Etiquetas que a esteira coloca ao terminar (várias, separadas por vírgula no banco). */
export const etiquetasDaEsteira = (e: { ao_concluir_tag?: string | null }) =>
  Array.from(new Set(String(e.ao_concluir_tag || "").split(",").map((t) => t.trim()).filter(Boolean)));

// Leads marcados para fazer 2 esteiras hoje (guardado neste navegador, vale só para o dia)
const DOIS_KEY = () => `inmovya_dois_hoje_${new Date().toLocaleDateString("pt-BR")}`;
export const getDoisHoje = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DOIS_KEY()) || "[]"));
  } catch {
    return new Set();
  }
};
export const setDoisHoje = (ids: Set<string>) => {
  try {
    localStorage.setItem(DOIS_KEY(), JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
};
export const enviadoHoje = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const hoje = new Date();
  return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
};
