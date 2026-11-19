// Varredura de respostas: pega todos os leads que estão em esteira e pergunta ao WhatsApp Web
// (pelo Inmovya Scale) quem mandou mensagem depois do último envio. Quem respondeu sai da esteira
// e vai para a coluna Respondeu. Pega também respostas que chegaram com o WhatsApp Web fechado.
import { supabase } from "@/integrations/supabase/client";
import { travaResposta } from "@/lib/trava";

export type ResultadoVarredura = { ok: boolean; conferidos: number; sairam: string[]; erro?: string };

const perguntarAoWhatsApp = (itens: { telefone: string; desde: number }[], timeoutMs = 40000, tipo: "resposta" | "enviado" = "resposta") =>
  new Promise<{ telefone: string; quando: number }[]>((resolve, reject) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const onResult = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_VARRER_RESPOSTAS_RESULT", onResult);
      d.ok ? resolve(d.respondidos || []) : reject(new Error(d.error || "não consegui ler o WhatsApp"));
    };
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_VARRER_RESPOSTAS_RESULT", onResult);
      reject(new Error("O Inmovya Scale não respondeu (precisa da versão 1.20.0 e do WhatsApp Web aberto)."));
    }, timeoutMs);
    window.addEventListener("INMOVYA_VARRER_RESPOSTAS_RESULT", onResult);
    window.dispatchEvent(new CustomEvent("INMOVYA_VARRER_RESPOSTAS", { detail: { token, itens, tipo } }));
  });

const digitos = (t?: string | null) => String(t || "").replace(/\D/g, "");

/** Um lead só, pelo WhatsApp Web já aberto (sem abrir janela): true/false; null = não deu para saber. */
export async function respondeuNoWhatsAppAberto(telefone: string, desdeMs: number): Promise<boolean | null> {
  const tel = digitos(telefone);
  if (tel.length < 10) return null;
  try {
    const r = await perguntarAoWhatsApp([{ telefone: tel, desde: desdeMs || 0 }], 15000);
    return r.some((x) => digitos(x.telefone).slice(-8) === tel.slice(-8));
  } catch {
    return null;
  }
}

let rodando = false;

export async function varrerRespostas(): Promise<ResultadoVarredura> {
  if (rodando) return { ok: true, conferidos: 0, sairam: [] };
  rodando = true;
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("id, nome, telefone, created_at, esteira_ultimo_envio")
      .not("esteira_id", "is", null);
    if (error) return { ok: false, conferidos: 0, sairam: [], erro: error.message };
    const leads = (data || []).filter((l: any) => digitos(l.telefone).length >= 10);
    if (!leads.length) return { ok: true, conferidos: 0, sairam: [] };

    // "respondeu" = mensagem dele depois do último envio da esteira (ou, se ainda não recebeu passo, depois de entrar)
    const desde = (l: any) => new Date(l.esteira_ultimo_envio || l.created_at || 0).getTime() || 0;
    const respondidos = await perguntarAoWhatsApp(leads.map((l: any) => ({ telefone: digitos(l.telefone), desde: desde(l) })));
    const ult8 = (t: string) => digitos(t).slice(-8);
    const quem = new Set(respondidos.map((r) => ult8(r.telefone)));
    // trava de engajamento: quem respondeu conta como "respondeu" no termômetro
    travaResposta(respondidos.map((r: any) => ({ telefone: digitos(r.telefone), quando: Number(r.quando) || Date.now() })));

    const sairam: string[] = [];
    for (const l of leads as any[]) {
      if (!quem.has(ult8(l.telefone))) continue;
      const { error: e2 } = await supabase
        .from("leads")
        .update({ status: "Respondeu", esteira_id: null, esteira_passo: 0, esteira_proximo: null })
        .eq("id", l.id);
      if (!e2) {
        sairam.push(l.nome);
        await supabase.from("lead_timeline").insert({
          lead_id: l.id,
          type: "note",
          title: "Respondeu no WhatsApp: saiu da esteira",
          description: "Conferência automática de respostas do Inmovya.",
          author: "Esteira",
        });
      }
    }
    return { ok: true, conferidos: leads.length, sairam };
  } catch (e: any) {
    return { ok: false, conferidos: 0, sairam: [], erro: e?.message || String(e) };
  } finally {
    rodando = false;
  }
}


/** Quem destes telefones já recebeu mensagem SUA hoje no WhatsApp (qualquer mensagem: 1º contato, manual, esteira).
 *  Devolve os últimos 8 dígitos. Sem WhatsApp aberto: conjunto vazio. */
export async function chamadosHojeNoWhatsApp(telefones: string[]): Promise<Set<string>> {
  const tels = Array.from(new Set(telefones.map(digitos).filter((t) => t.length >= 10)));
  if (!tels.length) return new Set();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  try {
    const r = await perguntarAoWhatsApp(tels.map((t) => ({ telefone: t, desde: inicio.getTime() })), 30000, "enviado");
    return new Set(r.map((x) => digitos(x.telefone).slice(-8)));
  } catch {
    return new Set();
  }
}
