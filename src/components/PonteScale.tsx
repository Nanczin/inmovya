// Ponte Inmovya ⇄ cartão do lead no WhatsApp Web (Inmovya Scale).
// O cartão dentro da conversa pede coisas ("quem é esse telefone?", "coloca na esteira X", "muda a etapa")
// e esta ponte faz no Inmovya, com o seu login. Não aparece nada na tela e não envia mensagem a ninguém.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { colocarNaEsteira, tirarDaEsteira } from "@/lib/esteiras";
import { NEGOCIO_STAGES } from "@/lib/negociosStages";

const CAMPOS = "id, nome, telefone, email, status, tags, origem, observacoes, esteira_id, esteira_passo, esteira_proximo, created_at";
const dig = (t?: string | null) => String(t || "").replace(/\D/g, "");
const ult8 = (t?: string | null) => dig(t).slice(-8);
const emailDeExemplo = (tel?: string | null) => `${dig(tel) || Date.now()}@sememail.inmovya.com`;

async function usuario() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login no Inmovya.");
  return user;
}

// guarda por 60 s (o cartão pede a cada conversa aberta)
let cacheEsteiras: { em: number; v: any[] } | null = null;
async function esteirasComPassos() {
  if (cacheEsteiras && Date.now() - cacheEsteiras.em < 60000) return cacheEsteiras.v;
  const v = await buscarEsteiras();
  cacheEsteiras = { em: Date.now(), v };
  return v;
}
async function buscarEsteiras() {
  const [e, p] = await Promise.all([
    supabase.from("esteiras").select("*").order("nome"),
    supabase.from("esteira_passos").select("*").order("ordem"),
  ]);
  if (e.error) throw e.error;
  const passos = (p.data as any[]) || [];
  return ((e.data as any[]) || []).map((x) => ({
    id: x.id,
    nome: x.nome,
    passos: passos.filter((s) => s.esteira_id === x.id).length,
  }));
}

async function acharPorTelefone(telefone: string) {
  const user = await usuario();
  const k = ult8(telefone);
  if (k.length < 8) return [];
  // o telefone pode estar salvo com máscara: filtra pelos 4 últimos no banco e confere os 8 aqui
  const { data, error } = await supabase.from("leads").select(CAMPOS).eq("user_id", user.id).ilike("telefone", `%${k.slice(-4)}%`).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []).filter((l) => ult8(l.telefone) === k);
}

async function todasAsTags() {
  const user = await usuario();
  const { data } = await supabase.from("leads").select("tags").eq("user_id", user.id).not("tags", "is", null).limit(2000);
  const s = new Set<string>();
  ((data as any[]) || []).forEach((l) => (Array.isArray(l.tags) ? l.tags : []).forEach((t: string) => t && s.add(String(t))));
  return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function tarefasDoLead(leadId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, status")
    .eq("lead_id", leadId)
    .neq("status", "completed")
    .order("due_date", { ascending: true })
    .limit(5);
  if (error) throw error;
  return data || [];
}

async function lerLead(id: string) {
  const { data, error } = await supabase.from("leads").select(CAMPOS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function atender(op: string, d: any, irPara: (url: string) => void) {
  switch (op) {
    case "resumo": {
      // versão leve para o botão da conversa: etapa e esteira do lead (se existir)
      const [leads, esteiras] = await Promise.all([acharPorTelefone(d.telefone), esteirasComPassos()]);
      const l = leads[0];
      if (!l) return { existe: false };
      const e = esteiras.find((x: any) => x.id === l.esteira_id);
      return { existe: true, status: l.status, esteira: e ? e.nome : null, passo: e ? (Number(l.esteira_passo) || 0) + 1 : null };
    }
    case "lead": {
      const [leads, esteiras, tags] = await Promise.all([acharPorTelefone(d.telefone), esteirasComPassos(), todasAsTags()]);
      return { leads, esteiras, tags, etapas: NEGOCIO_STAGES.map((s) => ({ nome: s.name, valor: s.value })) };
    }
    case "etapa": {
      const { error } = await supabase.from("leads").update({ status: String(d.status) }).eq("id", d.id);
      if (error) throw error;
      return { lead: await lerLead(d.id) };
    }
    case "esteira": {
      cacheEsteiras = null;
      if (d.esteiraId) await colocarNaEsteira([d.id], d.esteiraId);
      else await tirarDaEsteira([d.id]);
      return { lead: await lerLead(d.id) };
    }
    case "tags": {
      const tags = Array.from(new Set(((d.tags as string[]) || []).map((t) => String(t).trim()).filter(Boolean)));
      const { error } = await supabase.from("leads").update({ tags }).eq("id", d.id);
      if (error) throw error;
      return { lead: await lerLead(d.id) };
    }
    case "observacao": {
      const { error } = await supabase.from("leads").update({ observacoes: String(d.observacoes ?? "") }).eq("id", d.id);
      if (error) throw error;
      return { lead: await lerLead(d.id) };
    }
    case "cadastrar": {
      const user = await usuario();
      const ja = await acharPorTelefone(d.telefone);
      if (ja.length) return { lead: ja[0], jaExistia: true };
      const { data, error } = await supabase
        .from("leads")
        .insert({
          nome: String(d.nome || "").trim() || dig(d.telefone),
          telefone: dig(d.telefone),
          email: emailDeExemplo(d.telefone),
          status: d.status || "20%",
          origem: "WhatsApp",
          user_id: user.id,
        } as any)
        .select(CAMPOS)
        .single();
      if (error) throw error;
      return { lead: data };
    }
    case "tarefas": {
      // próximos compromissos pendentes deste lead (Agenda)
      return { tarefas: await tarefasDoLead(d.id) };
    }
    case "tarefa": {
      // agenda um compromisso para o lead (aparece na Agenda; "Ir para" = WhatsApp do lead)
      const user = await usuario();
      const quando = new Date(String(d.quando || ""));
      if (isNaN(quando.getTime())) throw new Error("Data ou hora inválida.");
      const titulo = String(d.titulo || "").trim();
      if (!titulo) throw new Error("Escreva o que é para fazer.");
      const dados = { user_id: user.id, lead_id: d.id, title: titulo, description: String(d.descricao || ""), due_date: quando.toISOString(), status: "pending" };
      let { data, error } = await supabase.from("tasks").insert({ ...dados, acao_tipo: "whatsapp", acao_alvo: d.id } as any).select("id").single();
      if (error && /acao_tipo|acao_alvo/i.test(String(error.message || ""))) ({ data, error } = await supabase.from("tasks").insert(dados).select("id").single());
      if (error) throw error;
      const dataTxt = quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      await supabase.from("lead_timeline").insert({
        lead_id: d.id,
        type: "note",
        title: `Lembrete Agendado: ${titulo}`,
        description: `Para ${dataTxt} (agendado pelo WhatsApp).`,
        author: "Usuário",
        metadata: { task_date: quando.toISOString(), task_id: (data as any)?.id },
      } as any);
      return { tarefas: await tarefasDoLead(d.id) };
    }
    case "tarefaFeita": {
      const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", d.tarefaId);
      if (error) throw error;
      return { tarefas: await tarefasDoLead(d.id) };
    }
    case "abrir": {
      // com uma esteira rodando nesta aba, não troca de tela (abre outra aba do Inmovya)
      let rodando = false;
      try {
        rodando = !!localStorage.getItem("inmovya_esteira_rodada");
      } catch {
        /* ignore */
      }
      if (rodando) return { abrirEmNovaAba: `/leads?lead=${encodeURIComponent(d.id)}` };
      irPara(`/leads?lead=${encodeURIComponent(d.id)}`);
      return { ok: true };
    }
    default:
      throw new Error("pedido desconhecido");
  }
}

export function PonteScale() {
  const navigate = useNavigate();
  useEffect(() => {
    const ouvir = async (ev: Event) => {
      const { token, op, dados } = ((ev as CustomEvent).detail || {}) as any;
      if (!token) return;
      const responder = (r: any) => window.dispatchEvent(new CustomEvent("INMOVYA_SCALE_RESPOSTA", { detail: { token, ...r } }));
      try {
        const r = await atender(op, dados || {}, (url) => navigate(url));
        responder({ ok: true, dados: r });
        if (op !== "lead" && op !== "abrir") window.dispatchEvent(new Event("refreshLeads"));
      } catch (e: any) {
        responder({ ok: false, erro: e?.message || String(e) });
      }
    };
    window.addEventListener("INMOVYA_SCALE_PEDIDO", ouvir);
    // avisa a extensão que a ponte está pronta nesta aba
    window.dispatchEvent(new CustomEvent("INMOVYA_SCALE_PRONTA"));
    return () => window.removeEventListener("INMOVYA_SCALE_PEDIDO", ouvir);
  }, [navigate]);
  return null;
}
