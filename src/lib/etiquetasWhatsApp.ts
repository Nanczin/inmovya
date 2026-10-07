// Etiquetas do WhatsApp Business como referência (WhatsApp -> Inmovya).
// A extensão lê as etiquetas e os contatos de cada uma no WhatsApp Web; o Inmovya
// acerta a etapa do funil e as tags dos leads. O Inmovya nunca mexe nas etiquetas do WhatsApp.
import { supabase } from "@/integrations/supabase/client";
import { getStageForStatus } from "@/lib/negociosStages";

const semAcento = (s: string) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toLowerCase().trim();

// Uma coisa por vez no WhatsApp: enquanto a esteira envia, a leitura das etiquetas espera (e vice-versa).
let whatsappOcupado = false;
export const isWhatsAppOcupado = () => whatsappOcupado;
export const setWhatsAppOcupado = (v: boolean) => {
  whatsappOcupado = v;
};

// Etiqueta do WhatsApp -> etapa do funil (status). A de maior peso vence se o contato tiver várias.
const ETAPA_POR_ETIQUETA: { chave: string; status: string; peso: number }[] = [
  { chave: "fechado", status: "Fechado", peso: 4 },
  { chave: "vendeu", status: "Fechado", peso: 4 },
  { chave: "75%", status: "70%", peso: 3 },
  { chave: "70%", status: "70%", peso: 3 },
  { chave: "50%", status: "50%", peso: 2 },
  { chave: "20%", status: "20%", peso: 1 },
];
const ETIQUETA_LEAD = "lead"; // fim da esteira: tag "disparo" e sai do funil
const ETIQUETA_NUTRICAO = "nutricao"; // tag "nutrição"

export interface EtiquetaWhatsApp {
  name: string;
  contacts: { name: string; chatId?: string }[];
}

export interface MudancaLead {
  leadId: string;
  nome: string;
  etiquetas: string[]; // etiquetas do contato no WhatsApp
  statusAtual: string | null;
  statusNovo?: string | null; // undefined = não muda; null = sai do funil
  tagsNovas: string[]; // tags a acrescentar
}

export interface PlanoSincronizacao {
  mudancas: MudancaLead[];
  jaCertos: number;
  naoEncontrados: { nome: string; etiquetas: string[] }[];
  ambiguos: { nome: string; etiquetas: string[] }[];
  totalContatos: number;
  lidoEm: string;
}

/** Pede à extensão para ler as etiquetas no WhatsApp Web (a aba do WhatsApp vem para a frente durante a leitura). */
export const lerEtiquetasDoWhatsApp = () =>
  new Promise<EtiquetaWhatsApp[]>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_WA_LABELS_RESULT", onResult as EventListener);
      reject(new Error("Tempo esgotado lendo as etiquetas do WhatsApp."));
    }, 10 * 60 * 1000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_WA_LABELS_RESULT", onResult as EventListener);
      if (event.detail?.ok) resolve(event.detail.labels || []);
      else reject(new Error(event.detail?.error || "Não consegui ler as etiquetas do WhatsApp."));
    };
    window.addEventListener("INMOVYA_WA_LABELS_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_READ_WA_LABELS", { detail: { token } }));
  });

type LeadBase = { id: string; nome: string; telefone?: string | null; status?: string | null; tags?: string[] | null };

/** Compara o WhatsApp com os leads e monta o que precisa mudar no Inmovya (sem gravar). */
export function planejarSincronizacao(etiquetas: EtiquetaWhatsApp[], leads: LeadBase[]): PlanoSincronizacao {
  // contato -> etiquetas dele
  const porContato = new Map<string, { nome: string; telefone: string; etiquetas: string[] }>();
  etiquetas.forEach((et) =>
    (et.contacts || []).forEach((c) => {
      const telefone = String(c.chatId || "").split("@")[0].replace(/\D/g, "");
      const chave = telefone.length >= 8 ? `t:${telefone.slice(-8)}` : `n:${semAcento(c.name)}`;
      if (!chave || chave === "n:") return;
      const atual = porContato.get(chave) || { nome: c.name, telefone, etiquetas: [] };
      if (!atual.etiquetas.includes(et.name)) atual.etiquetas.push(et.name);
      porContato.set(chave, atual);
    })
  );

  const porTelefone = new Map<string, LeadBase>();
  const porNome = new Map<string, LeadBase[]>();
  leads.forEach((l) => {
    const t = String(l.telefone || "").replace(/\D/g, "");
    if (t.length >= 8) porTelefone.set(t.slice(-8), l);
    const n = semAcento(l.nome);
    if (n) porNome.set(n, [...(porNome.get(n) || []), l]);
  });

  const plano: PlanoSincronizacao = { mudancas: [], jaCertos: 0, naoEncontrados: [], ambiguos: [], totalContatos: porContato.size, lidoEm: new Date().toISOString() };

  porContato.forEach((c) => {
    let lead: LeadBase | undefined = c.telefone.length >= 8 ? porTelefone.get(c.telefone.slice(-8)) : undefined;
    if (!lead) {
      const candidatos = porNome.get(semAcento(c.nome)) || [];
      if (candidatos.length > 1) return void plano.ambiguos.push({ nome: c.nome, etiquetas: c.etiquetas });
      lead = candidatos[0];
    }
    if (!lead) return void plano.naoEncontrados.push({ nome: c.nome, etiquetas: c.etiquetas });

    const chaves = c.etiquetas.map(semAcento);
    const funil = ETAPA_POR_ETIQUETA.filter((e) => chaves.includes(e.chave)).sort((a, b) => b.peso - a.peso)[0];
    const tagsAtuais = (lead.tags || []).map(semAcento);
    const tagsNovas: string[] = [];
    let statusNovo: string | null | undefined;

    if (funil) {
      if (getStageForStatus(lead.status)?.value !== funil.status) statusNovo = funil.status;
    } else if (chaves.includes(ETIQUETA_LEAD)) {
      if (!tagsAtuais.includes("disparo")) tagsNovas.push("disparo");
      // sai do funil (20%, 50%, 70%) quando a etiqueta no WhatsApp é "Lead"
      if (["20", "50", "70"].includes(getStageForStatus(lead.status)?.id || "")) statusNovo = null;
    }
    if (chaves.includes(ETIQUETA_NUTRICAO) && !tagsAtuais.includes("nutricao")) tagsNovas.push("nutrição");

    if (statusNovo === undefined && !tagsNovas.length) plano.jaCertos++;
    else plano.mudancas.push({ leadId: lead.id, nome: lead.nome, etiquetas: c.etiquetas, statusAtual: lead.status ?? null, statusNovo, tagsNovas });
  });

  plano.mudancas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return plano;
}

/** Grava as mudanças no Inmovya. Devolve quantos leads foram atualizados e os erros. */
export async function aplicarSincronizacao(mudancas: MudancaLead[], leadsAtuais: LeadBase[]) {
  const erros: string[] = [];
  let feitos = 0;
  for (const m of mudancas) {
    const lead = leadsAtuais.find((l) => l.id === m.leadId);
    const update: Record<string, any> = {};
    if (m.statusNovo !== undefined) update.status = m.statusNovo;
    if (m.tagsNovas.length) update.tags = Array.from(new Set([...(lead?.tags || []), ...m.tagsNovas]));
    let { error } = await supabase.from("leads").update(update).eq("id", m.leadId);
    if (error && m.statusNovo === null) {
      // se o banco não aceitar etapa vazia, aplica só as tags
      const { status, ...semStatus } = update;
      ({ error } = Object.keys(semStatus).length
        ? await supabase.from("leads").update(semStatus).eq("id", m.leadId)
        : { error: null });
    }
    if (error) erros.push(`${m.nome}: ${error.message}`);
    else feitos++;
  }
  return { feitos, erros };
}
