// Esteiras de follow-up dentro do Inmovya.
// O Inmovya guarda esteiras, passos e em que passo cada lead está;
// a extensão Inmovya Scale apenas envia a mensagem no WhatsApp Web.
import { supabase } from "@/integrations/supabase/client";

export interface Esteira {
  id: string;
  nome: string;
  ordem: number;
  ao_concluir_tag: string | null;
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
}

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

export const montarMensagem = (template: string, leadNome: string) => {
  if (!template) return "";
  const now = new Date();
  return template
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
export const checarExtensao = (timeoutMs = 1500) =>
  new Promise<boolean>((resolve) => {
    let done = false;
    const onReady = () => {
      if (done) return;
      done = true;
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

export const enviarPeloWhatsApp = (phone: string, text: string) =>
  new Promise<void>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
      reject(new Error("Tempo esgotado aguardando a confirmação da extensão."));
    }, 120000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
      event.detail?.ok ? resolve() : reject(new Error(event.detail?.error || "O envio não foi confirmado."));
    };
    window.addEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_OPEN_WHATSAPP", { detail: { phone, text, token } }));
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

/** Registra o envio do passo atual e move o lead para o próximo passo (ou conclui a esteira). */
export async function avancarLead(
  lead: { id: string; nome: string; tags?: string[] | null; esteira_passo?: number | null },
  esteira: Esteira,
  passos: EsteiraPasso[],
  passoEnviado: EsteiraPasso,
  detalhe: string
) {
  const indice = passos.findIndex((p) => p.id === passoEnviado.id);
  const proximo = passos[indice + 1];
  const agora = new Date().toISOString();

  let update: Record<string, any>;
  let concluiu = false;
  if (proximo) {
    update = {
      esteira_passo: indice + 1,
      esteira_proximo: addDias(proximo.dias_espera ?? 1),
      esteira_ultimo_envio: agora,
      ultimo_contato: agora,
    };
  } else {
    concluiu = true;
    const tag = (esteira.ao_concluir_tag || "").trim();
    const tags = Array.from(new Set([...(lead.tags || []), ...(tag ? [tag] : [])]));
    update = {
      esteira_id: null,
      esteira_passo: 0,
      esteira_proximo: null,
      esteira_ultimo_envio: agora,
      ultimo_contato: agora,
      tags,
      // Regra: quem termina a esteira sai do funil (etapa limpa) e fica com a etiqueta de disparo
      ...(tag ? { status: null } : {}),
    };
  }

  let { error } = await supabase.from("leads").update(update).eq("id", lead.id);
  if (error && "status" in update) {
    // Se o banco não aceitar etapa vazia, mantém a etapa e só aplica o resto
    const { status, ...semStatus } = update;
    ({ error } = await supabase.from("leads").update(semStatus).eq("id", lead.id));
  }
  if (error) throw error;

  await supabase.from("lead_timeline").insert({
    lead_id: lead.id,
    type: "whatsapp",
    title: `Esteira ${esteira.nome} — ${passoEnviado.titulo || `Passo ${indice + 1}`}`,
    description: concluiu ? `${detalhe}\n\nEsteira concluída.` : detalhe,
    author: "Esteira",
  });

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

  // Leads: posiciona no passo em que estavam no Scale, prontos para envio
  const agora = new Date().toISOString();
  for (const l of plano.leads) {
    const esteiraId = idPorScale.get(l.scaleEsteiraId);
    if (!esteiraId) continue;
    const total = passosPorEsteira.get(l.scaleEsteiraId) || 0;
    const { error } = await supabase
      .from("leads")
      .update({ esteira_id: esteiraId, esteira_passo: Math.min(l.passoIndex, Math.max(0, total - 1)), esteira_proximo: agora })
      .eq("id", l.leadId);
    if (error) throw error;
  }
}
