// Piloto automático das esteiras: envia a fila do dia sozinho nos horários escolhidos
// e, antes de cada envio, confere se o lead já respondeu (aí tira da esteira e manda para Respondeu).
// Roda neste navegador: precisa do Inmovya aberto numa aba do Chrome com o Inmovya Scale e o WhatsApp Web.
import { supabase } from "@/integrations/supabase/client";
import { naVezDoWhatsApp } from "@/lib/esteiras";

export interface ConfigPiloto {
  ativo: boolean;
  horarios: string[]; // "HH:MM"
  soDiasUteis: boolean;
  checarResposta: boolean; // ler a conversa antes de enviar
}

const CHAVE = "inmovya_piloto_esteiras";
const CHAVE_FEITOS = "inmovya_piloto_feitos";
export const JANELA_MIN = 45; // começa até 45 min depois do horário (ex.: computador acordou atrasado)

export const PILOTO_PADRAO: ConfigPiloto = { ativo: false, horarios: ["10:10", "13:00"], soDiasUteis: true, checarResposta: true };

const horaValida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export const lerPiloto = (): ConfigPiloto => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (!v) return { ...PILOTO_PADRAO };
    return {
      ativo: !!v.ativo,
      horarios: Array.isArray(v.horarios) ? Array.from(new Set<string>(v.horarios.filter(horaValida))).sort() : PILOTO_PADRAO.horarios,
      soDiasUteis: v.soDiasUteis !== false,
      checarResposta: v.checarResposta !== false,
    };
  } catch {
    return { ...PILOTO_PADRAO };
  }
};

export const salvarPiloto = (c: ConfigPiloto) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...c, horarios: Array.from(new Set<string>(c.horarios.filter(horaValida))).sort() }));
  } catch {
    /* sem armazenamento */
  }
};

const hojeChave = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const minutosDoDia = (h: string) => parseInt(h.slice(0, 2)) * 60 + parseInt(h.slice(3, 5));
const ehDiaUtil = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

const lerFeitos = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_FEITOS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** Horário que deve rodar agora (dentro da janela e ainda não rodado hoje), ou null. */
export const horarioDaVez = (c: ConfigPiloto, agora = new Date()): string | null => {
  if (!c.ativo) return null;
  if (c.soDiasUteis && !ehDiaUtil(agora)) return null;
  const min = agora.getHours() * 60 + agora.getMinutes();
  const feitos = new Set(lerFeitos());
  return c.horarios.find((h) => min >= minutosDoDia(h) && min < minutosDoDia(h) + JANELA_MIN && !feitos.has(`${hojeChave(agora)} ${h}`)) || null;
};

export const marcarHorarioFeito = (h: string, agora = new Date()) => {
  try {
    const hoje = hojeChave(agora);
    const lista = lerFeitos().filter((k) => k.startsWith(hoje)); // guarda só os de hoje
    lista.push(`${hoje} ${h}`);
    localStorage.setItem(CHAVE_FEITOS, JSON.stringify(lista));
  } catch {
    /* ignore */
  }
};

/** Próximo envio automático, para mostrar na tela ("hoje 13:00", "seg 10:10"). */
export const proximoEnvio = (c: ConfigPiloto, agora = new Date()): string | null => {
  if (!c.ativo || !c.horarios.length) return null;
  const feitos = new Set(lerFeitos());
  for (let dia = 0; dia < 8; dia++) {
    const d = new Date(agora);
    d.setDate(d.getDate() + dia);
    if (c.soDiasUteis && !ehDiaUtil(d)) continue;
    for (const h of c.horarios) {
      if (dia === 0) {
        const min = agora.getHours() * 60 + agora.getMinutes();
        if (min >= minutosDoDia(h) + JANELA_MIN || feitos.has(`${hojeChave(agora)} ${h}`)) continue;
      }
      const rotulo = dia === 0 ? "hoje" : dia === 1 ? "amanhã" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return `${rotulo} às ${h}`;
    }
  }
  return null;
};

type MensagemConversa = { dir: "in" | "out"; texto?: string; tipo?: string; data?: string | null; hora?: string | null };

/** Lê as últimas mensagens da conversa pelo Inmovya Scale (abre o WhatsApp numa janelinha). */
const lerConversaAgora = (phone: string, timeoutMs = 60000) =>
  new Promise<MensagemConversa[]>((resolve, reject) => {
    const token = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      reject(new Error("O Inmovya Scale não respondeu a leitura da conversa."));
    }, timeoutMs);
    const onResult = (event: CustomEvent) => {
      if (event.detail?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
      event.detail?.ok ? resolve(event.detail.mensagens || []) : reject(new Error(event.detail?.error || "Não consegui ler a conversa."));
    };
    window.addEventListener("INMOVYA_AGENT_RESULT", onResult as EventListener);
    window.dispatchEvent(new CustomEvent("INMOVYA_AGENT", { detail: { op: "read", phone, background: true, rapido: true, token } }));
  });

/** true = a última mensagem da conversa é do lead (respondeu depois do último envio). null = não deu para saber. */
export async function leadRespondeu(phone: string): Promise<boolean | null> {
  if (!phone) return null;
  try {
    const msgs = await naVezDoWhatsApp(() => lerConversaAgora(phone));
    const ultima = [...msgs].reverse().find((m) => m && (m.dir === "in" || m.dir === "out"));
    if (!ultima) return null;
    return ultima.dir === "in";
  } catch {
    return null; // na dúvida, segue o envio normal
  }
}

/** Lead respondeu: sai da esteira e vai para a coluna Respondeu do Negócios. */
export async function marcarRespondeu(leadId: string) {
  const { error } = await supabase
    .from("leads")
    .update({ status: "Respondeu", esteira_id: null, esteira_passo: 0, esteira_proximo: null })
    .eq("id", leadId);
  if (error) throw error;
}

/** Aviso do sistema (aparece mesmo com o Inmovya atrás de outras janelas), se a pessoa permitiu. */
export const avisar = (titulo: string, corpo: string) => {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(titulo, { body: corpo, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
};
export const pedirPermissaoDeAviso = async () => {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
  } catch {
    /* ignore */
  }
};
