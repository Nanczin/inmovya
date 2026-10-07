// Etiquetas do WhatsApp Business a partir do Inmovya (Inmovya -> WhatsApp).
// A etiqueta segue a etapa do funil (coluna do Negócios); quem terminou a esteira
// sem resposta e ficou com a tag "disparo" recebe a etiqueta "Lead".
import { supabase } from "@/integrations/supabase/client";
import { getStageForStatus } from "@/lib/negociosStages";
import { telefoneWhatsApp } from "@/lib/esteiras";

// Etiquetas que o Inmovya controla: as que não valem para o lead são tiradas da conversa.
// Outras etiquetas do contato (ex.: Nutrição) nunca são tiradas.
export const ETIQUETAS_DO_FUNIL = ["20%", "50%", "75%", "70%", "Fechado", "Lead"];

// coluna do Negócios -> nome da etiqueta no WhatsApp
const ETIQUETA_POR_ETAPA: Record<string, string> = {
  "20": "20%",
  "50": "50%",
  "70": "75%", // no WhatsApp a etiqueta é 75%
  vendeu: "Fechado",
};

const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function etiquetasDoLead(lead: { status?: string | null; tags?: string[] | null }): string[] {
  const tags = (lead.tags || []).map(semAcento);
  const out: string[] = [];
  const etapa = getStageForStatus(lead.status);
  const doFunil = etapa ? ETIQUETA_POR_ETAPA[etapa.id] : undefined;
  if (doFunil) out.push(doFunil);
  else if (tags.includes("disparo")) out.push("Lead");
  if (tags.includes("nutricao")) out.push("Nutrição");
  return out;
}

// Uma coisa por vez no WhatsApp: enquanto a esteira envia, a sincronização automática espera.
let whatsappOcupado = false;
export const isWhatsAppOcupado = () => whatsappOcupado;
export const setWhatsAppOcupado = (v: boolean) => {
  whatsappOcupado = v;
};

/** Chave para comparar com o que já foi aplicado (coluna leads.wa_etiqueta). */
export const chaveEtiquetas = (etiquetas: string[]) => [...etiquetas].sort().join(",");

export const pacoteEtiquetas = (etiquetas: string[]) => ({ set: etiquetas, managed: ETIQUETAS_DO_FUNIL });

/** Grava o que foi aplicado no WhatsApp. Sem isso o lead continuaria "pendente" para sempre. */
export async function registrarEtiquetas(leadId: string, etiquetas: string[]) {
  const { error } = await supabase.from("leads").update({ wa_etiqueta: chaveEtiquetas(etiquetas) } as any).eq("id", leadId);
  if (error) throw new Error(`Etiqueta aplicada, mas não registrada no Inmovya (rode supabase/whatsapp_etiquetas.sql): ${error.message}`);
}

/** Abre a conversa e só acerta as etiquetas (não envia mensagem). */
export const etiquetarNoWhatsApp = (telefone: string, etiquetas: string[]) =>
  new Promise<void>((resolve, reject) => {
    const phone = telefoneWhatsApp(telefone);
    if (!phone) return reject(new Error("Lead sem telefone."));
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
      reject(new Error("Tempo esgotado aguardando a extensão."));
    }, 90000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
      event.detail?.ok ? resolve() : reject(new Error(event.detail?.error || "Etiqueta não confirmada."));
    };
    window.addEventListener("INMOVYA_WHATSAPP_RESULT", onResult as EventListener);
    window.dispatchEvent(
      new CustomEvent("INMOVYA_OPEN_WHATSAPP", {
        detail: { phone, text: "", token, attachments: [], labels: pacoteEtiquetas(etiquetas), labelsOnly: true },
      })
    );
  });
