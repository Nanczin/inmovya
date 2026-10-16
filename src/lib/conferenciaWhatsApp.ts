// CONFERÊNCIA WhatsApp × Inmovya — grátis, sem IA.
// As etiquetas do WhatsApp Business são a verdade: o Inmovya é que é ajustado.
//
// Como lê (só com o que o Inmovya Scale já sabe fazer):
//  1) as etiquetas do WhatsApp e quem está em cada uma (nome do contato), na aba do WhatsApp Web;
//  2) cada lead pelo TELEFONE (busca do WhatsApp, numa janelinha) → nome do contato no WhatsApp.
// Juntando os dois, cada lead fica com as etiquetas do contato dele — casado pelo telefone, não pelo nome do Inmovya.
import { supabase } from "@/integrations/supabase/client";
import { checarExtensao, extensaoAtualizada, naVezDoWhatsApp, telefoneWhatsApp } from "@/lib/esteiras";
import { getStageForStatus } from "@/lib/negociosStages";

const semAcento = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‪-‮]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

const ultimos8 = (t?: string | null) => String(t || "").replace(/\D/g, "").slice(-8);

// ---------- Etiquetas ----------
// nome da etiqueta no WhatsApp → chave
const chaveDaEtiqueta = (nome: string) => {
  const n = semAcento(nome).replace(/\s+/g, "");
  if (n === "fechado" || n === "vendeu") return "fechado";
  if (n === "70%" || n === "75%" || n === "70" || n === "75") return "70";
  if (n === "50%" || n === "50") return "50";
  if (n === "20%" || n === "20") return "20";
  if (n === "lead" || n === "leads") return "lead";
  if (n === "bitrix") return "bitrix";
  if (n === "nutricao") return "nutricao";
  return null;
};

// etiqueta de funil → etapa do Negócios (a de maior peso vence)
const FUNIL: { chave: string; status: string; peso: number }[] = [
  { chave: "fechado", status: "Fechado", peso: 4 },
  { chave: "70", status: "70%", peso: 3 },
  { chave: "50", status: "50%", peso: 2 },
  { chave: "20", status: "20%", peso: 1 },
];

const PROSPECCAO = new Set(["validacao", "primeiro-impacto", "p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
const FORA_DO_FUNIL = new Set(["lista-fria", "perdido"]);

// ---------- Tipos ----------
export type Situacao = "ok" | "divergente" | "excluir" | "nao_achado" | "observacao";

export interface Correcao {
  status?: string; // nova etapa (ex.: "50%", "Nenhuma")
  addTags?: string[];
}

export interface ItemConferencia {
  leadId: string;
  nome: string;
  telefone: string;
  statusInmovya: string | null;
  nomeWhatsApp: string;
  etiquetas: string[]; // como estão no WhatsApp
  situacao: Situacao;
  motivo: string;
  correcao?: Correcao;
  corrigido?: boolean;
  erroCorrecao?: string;
}

export interface Relatorio {
  feitoEm: string;
  escopo: Escopo;
  total: number;
  itens: ItemConferencia[];
  foraDoInmovya: { nome: string; etiqueta: string; leadComMesmoNome?: string }[]; // na etiqueta do WhatsApp, sem lead conferido
  contagemEtiquetas: Record<string, number>;
  erro?: string;
}

export type Escopo = "funil" | "todos";

export interface ConfigConferencia {
  escopo: Escopo;
  automatica: boolean;
  hora: string; // "07:00"
  ultimoDia: string | null; // dia em que a automática já rodou (yyyy-mm-dd)
}

// ---------- Config e relatório (ficam neste navegador) ----------
const CONFIG_KEY = "inmovya_conferencia_wa";
const RELATORIO_KEY = "inmovya_conferencia_wa_relatorio";

export const getConfigConferencia = (): ConfigConferencia => {
  try {
    const v = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (v && typeof v === "object")
      return {
        escopo: v.escopo === "todos" ? "todos" : "funil",
        automatica: !!v.automatica,
        hora: /^\d{2}:\d{2}$/.test(v.hora) ? v.hora : "07:00",
        ultimoDia: v.ultimoDia || null,
      };
  } catch {
    /* ignore */
  }
  return { escopo: "funil", automatica: false, hora: "07:00", ultimoDia: null };
};

export const setConfigConferencia = (c: ConfigConferencia) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
  mudar({});
};

const lerRelatorio = (): Relatorio | null => {
  try {
    return JSON.parse(localStorage.getItem(RELATORIO_KEY) || "null");
  } catch {
    return null;
  }
};
const guardarRelatorio = (r: Relatorio | null) => {
  try {
    if (r) localStorage.setItem(RELATORIO_KEY, JSON.stringify(r));
    else localStorage.removeItem(RELATORIO_KEY);
  } catch {
    /* ignore */
  }
};

// ---------- Estado (para a tela) ----------
interface Estado {
  rodando: boolean;
  fase: string; // "lendo as etiquetas...", "conferindo 40 de 120..."
  feitos: number;
  total: number;
  relatorio: Relatorio | null;
}
let estado: Estado = { rodando: false, fase: "", feitos: 0, total: 0, relatorio: lerRelatorio() };
const ouvintes = new Set<() => void>();
const mudar = (p: Partial<Estado>) => {
  estado = { ...estado, ...p };
  ouvintes.forEach((f) => f());
};
export const assinarConferencia = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
export const lerEstadoConferencia = () => estado;

let pararPedido = false;
export const pararConferencia = () => {
  pararPedido = true;
  mudar({ fase: "parando..." });
};

// ---------- Inmovya Scale ----------
// Para cada telefone: busca a conversa, abre e lê no seletor de etiquetas do cabeçalho quais estão MARCADAS.
// add/remove vazios = só leitura (nenhuma etiqueta é alterada no WhatsApp).
interface ResultadoBusca {
  ok: boolean;
  encontrado?: boolean;
  etiquetas?: string[]; // marcadas na conversa
  info?: { nome: string; etiquetas?: string[] };
  error?: string;
}

const buscarTelefonesAgora = (itens: { id: string; phone: string }[]) =>
  new Promise<Record<string, ResultadoBusca>>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu à busca no WhatsApp."));
    }, 90_000 + itens.length * 25_000);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      if (!event.detail?.ok) return reject(new Error(event.detail?.error || "Falha na busca no WhatsApp."));
      const out: Record<string, ResultadoBusca> = {};
      (event.detail.resultados || []).forEach((r: any) => (out[r.id] = r));
      resolve(out);
    };
    window.addEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
    window.dispatchEvent(
      new CustomEvent("INMOVYA_AGENT", {
        detail: { op: "batch", background: true, token, itens: itens.map((i) => ({ id: i.id, op: "labels", phone: i.phone, add: [], remove: [] })) },
      })
    );
  });

// ---------- Regras (as mesmas da auditoria) ----------
interface LeadBase {
  id: string;
  nome: string | null;
  telefone: string | null;
  status: string | null;
  tags: string[] | null;
  created_at: string;
}

const ehHoje = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const temTag = (lead: LeadBase, tag: string) => (lead.tags || []).some((t) => semAcento(t) === semAcento(tag));

function julgar(lead: LeadBase, etiquetas: string[]): Pick<ItemConferencia, "situacao" | "motivo" | "correcao"> {
  const chaves = new Set(etiquetas.map(chaveDaEtiqueta).filter(Boolean) as string[]);
  const etapa = getStageForStatus(lead.status);
  const etapaNome = lead.status && lead.status !== "Nenhuma" ? lead.status : "Nenhuma";
  const addTags: string[] = [];
  if (chaves.has("nutricao") && !temTag(lead, "nutrição")) addTags.push("nutrição");
  const com = (c: Correcao): Correcao | undefined => {
    const tags = Array.from(new Set([...(c.addTags || []), ...addTags]));
    const out: Correcao = { ...(c.status ? { status: c.status } : {}), ...(tags.length ? { addTags: tags } : {}) };
    return out.status || out.addTags ? out : undefined;
  };

  // 1) etiqueta de funil: a etapa tem que ser a mesma
  const funil = FUNIL.filter((f) => chaves.has(f.chave)).sort((a, b) => b.peso - a.peso)[0];
  if (funil) {
    if (getStageForStatus(funil.status)?.id !== etapa?.id)
      return { situacao: "divergente", motivo: `WhatsApp: ${funil.status} · Inmovya: ${etapaNome}`, correcao: com({ status: funil.status }) };
    return addTags.length
      ? { situacao: "divergente", motivo: "falta a tag nutrição", correcao: com({}) }
      : { situacao: "ok", motivo: `${funil.status} nos dois` };
  }

  // 2) Lead (fim da esteira): tag disparo e etapa Nenhuma
  if (chaves.has("lead")) {
    const precisaEtapa = !!etapa; // qualquer etapa do Negócios → Nenhuma
    const precisaTag = !temTag(lead, "disparo");
    if (precisaEtapa || precisaTag || addTags.length)
      return {
        situacao: "divergente",
        motivo: `WhatsApp: Lead · Inmovya: ${etapaNome}${precisaTag ? ", sem a tag disparo" : ""}`,
        correcao: com({ ...(precisaEtapa ? { status: "Nenhuma" } : {}), addTags: precisaTag ? ["disparo"] : [] }),
      };
    return { situacao: "ok", motivo: "Lead / disparo nos dois" };
  }

  // 3) só Bitrix: tem que estar na prospecção (Validação, Primeiro impacto, P1–P7)
  if (chaves.has("bitrix")) {
    if (etapa && PROSPECCAO.has(etapa.id))
      return addTags.length ? { situacao: "divergente", motivo: "falta a tag nutrição", correcao: com({}) } : { situacao: "ok", motivo: `Bitrix · ${etapaNome}` };
    return { situacao: "divergente", motivo: `WhatsApp: Bitrix · Inmovya: ${etapaNome} (deveria estar na prospecção — confira)`, correcao: com({}) };
  }

  // 4) sem etiqueta de funil no WhatsApp
  if (etapa && PROSPECCAO.has(etapa.id)) {
    if (ehHoje(lead.created_at)) return { situacao: "observacao", motivo: "cadastrado hoje e ainda sem etiqueta no WhatsApp" };
    return { situacao: "excluir", motivo: `saiu da Bitrix e está sem etiqueta no WhatsApp (Inmovya: ${etapaNome})` };
  }
  if (!etapa || FORA_DO_FUNIL.has(etapa.id))
    return addTags.length ? { situacao: "divergente", motivo: "falta a tag nutrição", correcao: com({}) } : { situacao: "ok", motivo: "fora do funil nos dois" };
  return { situacao: "divergente", motivo: `WhatsApp: sem etiqueta · Inmovya: ${etapaNome} (confira)`, correcao: com({}) };
}

// ---------- Rodar ----------
const LOTE = 20;

export async function rodarConferencia(origem: "manual" | "automatica" = "manual"): Promise<Relatorio | null> {
  if (estado.rodando) return null;
  pararPedido = false;
  const cfg = getConfigConferencia();
  mudar({ rodando: true, fase: "preparando...", feitos: 0, total: 0 });
  const relatorio: Relatorio = { feitoEm: new Date().toISOString(), escopo: cfg.escopo, total: 0, itens: [], foraDoInmovya: [], contagemEtiquetas: {} };
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Entre no Inmovya para conferir.");
    if (!(await checarExtensao())) throw new Error("Inmovya Scale não encontrado neste Chrome.");
    if (!extensaoAtualizada("1.5.0")) throw new Error("Atualize o Inmovya Scale (chrome://extensions → Recarregar). A conferência precisa da versão 1.5.0 ou mais nova.");

    const { data, error } = await supabase.from("leads").select("id, nome, telefone, status, tags, created_at").eq("user_id", user.id);
    if (error) throw error;
    const todos = (data || []) as LeadBase[];
    const leads = todos.filter((l) => {
      if (ultimos8(l.telefone).length < 8) return false;
      if (cfg.escopo === "todos") return true;
      const e = getStageForStatus(l.status);
      return !!e && !FORA_DO_FUNIL.has(e.id);
    });
    relatorio.total = leads.length;

    // Cada lead pelo telefone, em lotes numa janelinha do WhatsApp (entre um lote e outro o 1º contato automático pode passar).
    // Não usa o menu de etiquetas do WhatsApp (mudou de lugar e a leitura antiga falhava): lê direto na conversa.
    mudar({ fase: `conferindo 0 de ${leads.length} pelo telefone...`, total: leads.length });
    for (let i = 0; i < leads.length && !pararPedido; i += LOTE) {
      const lote = leads.slice(i, i + LOTE);
      const r = await naVezDoWhatsApp(() => buscarTelefonesAgora(lote.map((l) => ({ id: l.id, phone: telefoneWhatsApp(l.telefone) }))));
      const falhas: string[] = [];
      for (const lead of lote) {
        const b = r[lead.id];
        const base = { leadId: lead.id, nome: lead.nome || "Lead sem nome", telefone: lead.telefone || "", statusInmovya: lead.status };
        if (b?.ok === true && b.encontrado === false) {
          relatorio.itens.push({ ...base, nomeWhatsApp: "", etiquetas: [], situacao: "nao_achado", motivo: "número não encontrado nas conversas do WhatsApp" });
          continue;
        }
        if (!b?.ok) {
          falhas.push(b?.error || "sem resposta");
          relatorio.itens.push({
            ...base,
            nomeWhatsApp: b?.info?.nome || "",
            etiquetas: [],
            situacao: "observacao",
            motivo: `não consegui ler as etiquetas: ${b?.error || "sem resposta do WhatsApp"}`,
          });
          continue;
        }
        const lista = Array.from(
          new Set([...(b.etiquetas || []), ...(b.info?.etiquetas || [])].map((e) => String(e).trim()).filter((e) => chaveDaEtiqueta(e)))
        );
        lista.forEach((e) => (relatorio.contagemEtiquetas[e] = (relatorio.contagemEtiquetas[e] || 0) + 1));
        relatorio.itens.push({ ...base, nomeWhatsApp: b.info?.nome || "", etiquetas: lista, ...julgar(lead, lista) });
      }
      // o 1º lote inteiro falhou com o mesmo problema: para logo (não adianta passar 1 hora errando)
      if (i === 0 && falhas.length === lote.length && lote.length >= 3) {
        throw new Error(`Não consegui ler as etiquetas nas conversas do WhatsApp: ${falhas[0]}`);
      }
      mudar({ feitos: Math.min(i + LOTE, leads.length), fase: `conferindo ${Math.min(i + LOTE, leads.length)} de ${leads.length} pelo telefone...` });
    }
    if (pararPedido) relatorio.erro = "Conferência interrompida: o relatório mostra só o que deu tempo de conferir.";
  } catch (e: any) {
    relatorio.erro = e?.message || "Falha na conferência";
  } finally {
    const ordem: Record<Situacao, number> = { divergente: 0, excluir: 1, nao_achado: 2, observacao: 3, ok: 4 };
    relatorio.itens.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR"));
    guardarRelatorio(relatorio);
    if (origem === "automatica") setConfigConferencia({ ...getConfigConferencia(), ultimoDia: hojeISO() });
    mudar({ rodando: false, fase: "", relatorio });
  }
  return relatorio;
}

// ---------- Corrigir (o Inmovya segue o WhatsApp) ----------
export async function corrigirItens(leadIds: string[]) {
  const rel = estado.relatorio;
  if (!rel) return { feitos: 0, erros: [] as string[] };
  const erros: string[] = [];
  let feitos = 0;
  for (const item of rel.itens) {
    if (!leadIds.includes(item.leadId) || !item.correcao || item.corrigido) continue;
    const { data: atual } = await supabase.from("leads").select("tags").eq("id", item.leadId).maybeSingle();
    const update: Record<string, any> = {};
    if (item.correcao.status) update.status = item.correcao.status;
    if (item.correcao.addTags?.length) update.tags = Array.from(new Set([...(((atual as any)?.tags as string[]) || []), ...item.correcao.addTags]));
    if (!Object.keys(update).length) continue;
    // a mudança de etapa segue as regras do Negócios (o banco põe/tira da esteira ligada à coluna)
    const { error } = await supabase.from("leads").update(update).eq("id", item.leadId);
    if (error) {
      item.erroCorrecao = error.message;
      erros.push(`${item.nome}: ${error.message}`);
      continue;
    }
    await supabase.from("lead_timeline").insert({
      lead_id: item.leadId,
      type: "note",
      title: "Conferência com o WhatsApp — corrigido",
      description: [
        item.motivo,
        update.status && `Etapa: ${item.statusInmovya || "Nenhuma"} → ${update.status}`,
        item.correcao.addTags?.length && `Tags: + ${item.correcao.addTags.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
      author: "Conferência",
    } as any);
    item.corrigido = true;
    item.erroCorrecao = undefined;
    feitos++;
  }
  guardarRelatorio(rel);
  mudar({ relatorio: { ...rel, itens: [...rel.itens] } });
  window.dispatchEvent(new Event("refreshLeads"));
  return { feitos, erros };
}

export const podeCorrigirSozinho = (i: ItemConferencia) => !!i.correcao && !i.corrigido;

// ---------- Automática (uma vez por dia, no horário escolhido) ----------
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Chamado a cada minuto: roda a conferência automática se passou do horário e ainda não rodou hoje. */
export async function talvezConferirAutomatico(): Promise<Relatorio | null> {
  const cfg = getConfigConferencia();
  if (!cfg.automatica || estado.rodando || cfg.ultimoDia === hojeISO()) return null;
  const [h, m] = cfg.hora.split(":").map(Number);
  const agora = new Date();
  if (agora.getHours() * 60 + agora.getMinutes() < h * 60 + m) return null;
  // várias abas abertas: só uma roda
  const locks = (navigator as any).locks;
  let resultado: Relatorio | null = null;
  const rodar = async () => {
    if (getConfigConferencia().ultimoDia === hojeISO()) return;
    resultado = await rodarConferencia("automatica");
  };
  if (locks?.request) await locks.request("inmovya-conferencia-wa", { ifAvailable: true }, async (lock: any) => lock && (await rodar()));
  else await rodar();
  return resultado;
}

export const resumoRelatorio = (r: Relatorio) => {
  const c = (s: Situacao) => r.itens.filter((i) => i.situacao === s).length;
  return { ok: c("ok"), divergentes: c("divergente"), excluir: c("excluir"), naoAchados: c("nao_achado"), observacoes: c("observacao") };
};
