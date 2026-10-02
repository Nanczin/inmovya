// Etapas da aba Negócios e mapeamento com o campo "status" dos leads.
// O status salvo no Supabase continua sendo o mesmo campo usado em Leads/Funil,
// então 20%, 50%, 70% e Fechado ficam consistentes entre as abas.

export type NegocioPhaseId =
  | "entrada"
  | "prospeccao"
  | "diagnostico"
  | "proposta"
  | "forecast"
  | "vendeu"
  | "perdido";

export interface NegocioPhase {
  id: NegocioPhaseId;
  label: string; // título do grupo acima das colunas
  tab: string; // rótulo na barra de fases
  accent: string; // cor da borda superior das colunas
}

export interface NegocioStage {
  id: string;
  name: string; // nome exibido na coluna
  value: string; // valor gravado em leads.status
  phase: NegocioPhaseId;
  aliases?: string[]; // outros status que caem nesta coluna
}

export const NEGOCIO_PHASES: NegocioPhase[] = [
  { id: "entrada", label: "Entrada", tab: "Validação", accent: "#ea580c" },
  { id: "prospeccao", label: "Prospecção", tab: "Prospecção", accent: "#0d9488" },
  { id: "diagnostico", label: "Diagnóstico", tab: "Diagnóstico", accent: "#0d9488" },
  { id: "proposta", label: "Apresentar proposta", tab: "Apresentar proposta", accent: "#1e3a8a" },
  { id: "forecast", label: "Forecast", tab: "Forecast", accent: "#1e3a8a" },
  { id: "vendeu", label: "Vendeu", tab: "Vendeu", accent: "#16a34a" },
  { id: "perdido", label: "Perdido", tab: "Perdido", accent: "#ea580c" },
];

export const VALIDACAO_STAGE_ID = "validacao";
export const PRIMEIRO_IMPACTO_STAGE_ID = "primeiro-impacto";
export const PERDIDO_STAGE_ID = "perdido";

export const NEGOCIO_STAGES: NegocioStage[] = [
  { id: VALIDACAO_STAGE_ID, name: "Validação", value: "Validação", phase: "entrada", aliases: ["novo"] },

  { id: PRIMEIRO_IMPACTO_STAGE_ID, name: "Primeiro impacto", value: "Primeiro impacto", phase: "prospeccao" },
  { id: "p1", name: "P1", value: "P1", phase: "prospeccao" },
  { id: "p2", name: "P2", value: "P2", phase: "prospeccao" },
  { id: "p3", name: "P3", value: "P3", phase: "prospeccao" },
  { id: "p4", name: "P4", value: "P4", phase: "prospeccao" },
  { id: "p5", name: "P5", value: "P5", phase: "prospeccao" },
  { id: "p6", name: "P6", value: "P6", phase: "prospeccao" },
  { id: "p7", name: "P7", value: "P7", phase: "prospeccao" },
  { id: "respondeu", name: "Respondeu", value: "Respondeu", phase: "prospeccao" },
  { id: "lista-fria", name: "Lista fria", value: "Lista fria", phase: "prospeccao" },

  { id: "diagnostico", name: "Diagnóstico", value: "Diagnóstico", phase: "diagnostico" },

  { id: "visita", name: "Visita", value: "Visita", phase: "proposta", aliases: ["visita agendada"] },
  { id: "fluxo-pagamento", name: "Fluxo de pagamento", value: "Fluxo de pagamento", phase: "proposta" },
  { id: "proposta", name: "Proposta", value: "Proposta", phase: "proposta" },
  { id: "envio-cnh", name: "Envio de CNH", value: "Envio de CNH", phase: "proposta" },

  { id: "20", name: "20%", value: "20%", phase: "forecast", aliases: ["20"] },
  { id: "50", name: "50%", value: "50%", phase: "forecast", aliases: ["50"] },
  { id: "70", name: "70%", value: "70%", phase: "forecast", aliases: ["70", "75%", "75"] },
  { id: "documentacao", name: "Documentação completa", value: "Documentação completa", phase: "forecast" },
  { id: "fluxo-incorporadora", name: "Fluxo de pagamento incorporadora", value: "Fluxo de pagamento incorporadora", phase: "forecast" },
  { id: "contrato-enviado", name: "Contrato enviado", value: "Contrato enviado", phase: "forecast" },
  { id: "contrato-aberto", name: "Contrato aberto", value: "Contrato aberto", phase: "forecast" },
  { id: "objecoes-contrato", name: "Objeções de contrato", value: "Objeções de contrato", phase: "forecast" },
  { id: "90", name: "90%", value: "90%", phase: "forecast", aliases: ["90"] },
  { id: "contrato-assinado", name: "Contrato assinado", value: "Contrato assinado", phase: "forecast" },
  { id: "ato-pagamento", name: "Ato de pagamento", value: "Ato de pagamento", phase: "forecast" },

  // "Vendeu" grava "Fechado" para manter a etiqueta igual ao WhatsApp/Scale
  { id: "vendeu", name: "Vendeu", value: "Fechado", phase: "vendeu", aliases: ["vendeu", "vendido", "ganho"] },

  { id: PERDIDO_STAGE_ID, name: "Perdido", value: "Perdido", phase: "perdido", aliases: ["descartado"] },
];

export const normalizeStatus = (status?: string | null) =>
  (status || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const stageLookup = new Map<string, NegocioStage>();
NEGOCIO_STAGES.forEach((stage) => {
  [stage.name, stage.value, ...(stage.aliases || [])].forEach((key) => {
    const k = normalizeStatus(key);
    if (k && !stageLookup.has(k)) stageLookup.set(k, stage);
  });
});

/** Retorna a etapa de Negócios correspondente ao status do lead (ou undefined). */
export const getStageForStatus = (status?: string | null): NegocioStage | undefined =>
  stageLookup.get(normalizeStatus(status));

// Etapas que entram no Funil: 20%, 50%, 70% e Fechado
export const FUNIL_TIERS: { stageId: string; name: string; color: string }[] = [
  { stageId: "20", name: "20%", color: "#3b82f6" },
  { stageId: "50", name: "50%", color: "#0ea5e9" },
  { stageId: "70", name: "70%", color: "#14b8a6" },
  { stageId: "vendeu", name: "Fechado", color: "#22c55e" },
];

export const getFunilTier = (status?: string | null) => {
  const stage = getStageForStatus(status);
  if (!stage) return undefined;
  return FUNIL_TIERS.find((t) => t.stageId === stage.id);
};
