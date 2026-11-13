// Fica rodando em qualquer tela do Inmovya: quando o Inmovya Scale avisa que um lead mandou mensagem
// no WhatsApp, o lead sai da esteira na hora e vai para a coluna Respondeu do Negócios.
// (Inmovya Scale 1.12.0+. Se o Inmovya estiver fechado, a extensão guarda e entrega quando abrir.)
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/context/LeadsContext";
import { useToast } from "@/hooks/use-toast";
import { avisar } from "@/lib/pilotoAutomatico";

type Resposta = { telefone: string; t: number };

/** DDD + últimos 8 dígitos: casa número com ou sem 55 e com ou sem o 9 da frente. */
const chave = (tel?: string | null) => {
  let d = String(tel || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return "";
  return d.slice(0, 2) + d.slice(-8);
};

export function RespostasWhatsApp() {
  const { refreshLeads } = useLeads();
  const { toast } = useToast();
  const ocupado = useRef(false);
  // funções guardadas em ref: o efeito liga uma vez só
  const refreshRef = useRef(refreshLeads);
  refreshRef.current = refreshLeads;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const processar = async (itens: Resposta[]) => {
      if (ocupado.current || !itens?.length) return;
      ocupado.current = true;
      try {
        const { data, error } = await supabase
          .from("leads")
          .select("id, nome, telefone, esteira_id")
          .not("esteira_id", "is", null);
        if (error) return; // tenta de novo no próximo aviso
        const porChave = new Map<string, { id: string; nome: string }[]>();
        (data || []).forEach((l: any) => {
          const k = chave(l.telefone);
          if (k) porChave.set(k, [...(porChave.get(k) || []), l]);
        });
        const sairam: string[] = [];
        for (const it of itens) {
          for (const l of porChave.get(chave(it.telefone)) || []) {
            const { error: e2 } = await supabase
              .from("leads")
              .update({ status: "Respondeu", esteira_id: null, esteira_passo: 0, esteira_proximo: null })
              .eq("id", l.id);
            if (!e2) sairam.push(l.nome);
          }
        }
        // avisos já tratados (mesmo de quem não estava em esteira) saem da fila da extensão
        window.dispatchEvent(new CustomEvent("INMOVYA_RESPOSTAS_OK", { detail: { telefones: itens.map((i) => i.telefone) } }));
        if (sairam.length) {
          const nomes = sairam.join(", ");
          toastRef.current({ title: "Lead respondeu: saiu da esteira", description: `${nomes} foi para Respondeu.` });
          avisar("Lead respondeu", `${nomes} respondeu no WhatsApp e saiu da esteira.`);
          refreshRef.current();
        }
      } finally {
        ocupado.current = false;
      }
    };
    const onRespostas = (ev: Event) => processar(((ev as CustomEvent).detail?.itens || []) as Resposta[]);
    window.addEventListener("INMOVYA_RESPOSTAS", onRespostas);
    // ao abrir e a cada minuto, pede à extensão o que chegou enquanto o Inmovya estava fechado
    const buscar = () => window.dispatchEvent(new CustomEvent("INMOVYA_RESPOSTAS_BUSCAR"));
    const t0 = window.setTimeout(buscar, 2500);
    const t = window.setInterval(buscar, 60000);
    return () => {
      window.removeEventListener("INMOVYA_RESPOSTAS", onRespostas);
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, []);

  return null;
}
