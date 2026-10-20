import { supabase } from "@/integrations/supabase/client";

// Leads que terminaram a esteira e caíram em Perdido: tira as etiquetas no WhatsApp (pelo Inmovya Scale)
// e exclui do Inmovya. Lead do Bitrix apagado não volta pela captura (fica marcado como visto no banco).

const telefoneWA = (t?: string | null) => {
  let d = String(t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return d;
};

type ItemLote = { id: string; op: "labels"; phone: string; add: string[]; remove: string[] };

const loteNoWhatsApp = (itens: ItemLote[]) =>
  new Promise<Record<string, any>>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu. Confira se o WhatsApp Web está aberto neste Chrome."));
    }, 90_000 + itens.length * 30_000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      if (!event.detail?.ok) return reject(new Error(event.detail?.error || "Falha no WhatsApp."));
      const out: Record<string, any> = {};
      (event.detail.resultados || []).forEach((r: any) => (out[r.id] = r));
      resolve(out);
    };
    window.addEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_AGENT", { detail: { op: "batch", background: true, token, itens } }));
  });

export interface ResultadoLimpeza {
  excluidos: number;
  etiquetasTiradas: number;
  naoAchadosNoWhatsApp: string[];
  falhasWhatsApp: string[];
}

export async function limparPerdidos(
  leads: { id: string; nome: string | null; telefone: string | null }[],
  opcoes: { tirarEtiquetas: boolean; aoProgredir?: (fase: string) => void }
): Promise<ResultadoLimpeza> {
  const r: ResultadoLimpeza = { excluidos: 0, etiquetasTiradas: 0, naoAchadosNoWhatsApp: [], falhasWhatsApp: [] };
  const nomeDe = (id: string) => leads.find((l) => l.id === id)?.nome || "Lead";
  const falhouIds = new Set<string>();

  if (opcoes.tirarEtiquetas) {
    const comTel = leads.filter((l) => telefoneWA(l.telefone).length >= 12);
    // lotes de 10 para não deixar uma janela aberta tempo demais
    for (let i = 0; i < comTel.length; i += 10) {
      const bloco = comTel.slice(i, i + 10);
      opcoes.aoProgredir?.(`Lendo as etiquetas no WhatsApp (${Math.min(i + bloco.length, comTel.length)} de ${comTel.length})…`);
      const lidos = await loteNoWhatsApp(bloco.map((l) => ({ id: l.id, op: "labels", phone: telefoneWA(l.telefone), add: [], remove: [] })));
      const tirar: ItemLote[] = [];
      for (const l of bloco) {
        const x = lidos[l.id];
        if (!x?.ok) { r.falhasWhatsApp.push(nomeDe(l.id)); falhouIds.add(l.id); }
        else if (x.encontrado === false) r.naoAchadosNoWhatsApp.push(nomeDe(l.id));
        else if ((x.etiquetas || []).length) tirar.push({ id: l.id, op: "labels", phone: telefoneWA(l.telefone), add: [], remove: x.etiquetas });
      }
      if (tirar.length) {
        opcoes.aoProgredir?.(`Tirando as etiquetas de ${tirar.length} conversa(s)…`);
        const feitos = await loteNoWhatsApp(tirar);
        tirar.forEach((t) => {
          if (feitos[t.id]?.ok) r.etiquetasTiradas++;
          else { r.falhasWhatsApp.push(nomeDe(t.id)); falhouIds.add(t.id); }
        });
      }
    }
  }

  // não exclui quem deu erro no WhatsApp (para você tentar de novo)
  const apagar = leads.filter((l) => !falhouIds.has(l.id)).map((l) => l.id);
  opcoes.aoProgredir?.(`Excluindo ${apagar.length} lead(s) do Inmovya…`);
  for (let i = 0; i < apagar.length; i += 200) {
    const { error } = await supabase.from("leads").delete().in("id", apagar.slice(i, i + 200));
    if (error) throw error;
  }
  r.excluidos = apagar.length;
  return r;
}
