// Trava de Engajamento — o Inmovya conversa com o Inmovya Scale (onde ficam o registro e as travas).
// Protege o número de bloqueio por mensagens sem resposta: mede quantos responderam em cada esteira
// e no disparo, dobra o intervalo ou pausa quando muita gente ignora, e pausa tudo em caso de alarme.
// O registro fica no Chrome (extensão), por 30 dias. O 1º contato não entra na conta.

export type TravaCfg = { ligada: boolean; verde: number; amarelo: number; cada: number; janelaMin: number };
export type TravaStatusCor = "verde" | "amarelo" | "vermelho" | "medindo";
export type TravaNumeros = { enviados: number; respondeuTotal: number; maduras: number; responderam: number; ignoraram: number; taxa: number | null };
export type TravaPausa = { ate?: number; motivo: string; em?: number } | null;
export type TravaOrigem = { nome: string; cfg: TravaCfg; numeros: TravaNumeros; status: TravaStatusCor; proximaMedicao: number; pausa: TravaPausa };
export type TravaStatus = {
  ok: boolean;
  teste: boolean;
  alarme: TravaPausa;
  global: TravaPausa;
  limiteDia: number;
  ignoradosHoje: number;
  geral: TravaNumeros;
  origens: Record<string, TravaOrigem>;
  agora: number;
};
export type TravaPode = { ok: boolean; pode: boolean; fator?: number; motivo?: string; tipo?: "alarme" | "global" | "origem"; status?: TravaStatusCor; numeros?: TravaNumeros };

export const TRAVA_PADRAO: TravaCfg = { ligada: true, verde: 40, amarelo: 20, cada: 10, janelaMin: 60 };
const CHAVE_CFG = "inmovya_trava_esteira";

/** Origem da trava para uma esteira (cada esteira tem o seu termômetro). */
export const origemEsteira = (esteiraId: string) => `esteira:${esteiraId}`;

export function normalizarTravaCfg(c?: Partial<TravaCfg> | null): TravaCfg {
  const n = (v: unknown, min: number, max: number, pad: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : pad;
  };
  const o = c || {};
  const r: TravaCfg = {
    ligada: o.ligada !== false,
    verde: n(o.verde, 1, 100, TRAVA_PADRAO.verde),
    amarelo: n(o.amarelo, 0, 100, TRAVA_PADRAO.amarelo),
    cada: n(o.cada, 3, 100, TRAVA_PADRAO.cada),
    janelaMin: n(o.janelaMin, 10, 1440, TRAVA_PADRAO.janelaMin),
  };
  if (r.amarelo > r.verde) r.amarelo = r.verde;
  return r;
}

function lerTodas(): Record<string, TravaCfg> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CFG) || "{}") || {};
  } catch {
    return {};
  }
}
export function getTravaEsteira(esteiraId: string): TravaCfg {
  return normalizarTravaCfg(lerTodas()[esteiraId]);
}
export function setTravaEsteira(esteiraId: string, cfg: Partial<TravaCfg>, nome?: string) {
  const todas = lerTodas();
  const n = normalizarTravaCfg({ ...getTravaEsteira(esteiraId), ...cfg });
  todas[esteiraId] = n;
  try {
    localStorage.setItem(CHAVE_CFG, JSON.stringify(todas));
  } catch {
    /* sem espaço: segue com o padrão */
  }
  falarTrava("cfg", { origem: origemEsteira(esteiraId), nome, cfg: n });
  return n;
}

/** Fala com a extensão. Devolve null se ela não responder (extensão antiga ou ausente): nesse caso nada trava. */
export function falarTrava<T = any>(op: string, dados: Record<string, unknown> = {}, timeoutMs = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const onResult = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d?.token !== token) return;
      window.clearTimeout(t);
      window.removeEventListener("INMOVYA_TRAVA_RESULT", onResult);
      resolve(d?.ok === false && !("pode" in (d || {})) ? null : (d as T));
    };
    const t = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_TRAVA_RESULT", onResult);
      resolve(null);
    }, timeoutMs);
    window.addEventListener("INMOVYA_TRAVA_RESULT", onResult);
    window.dispatchEvent(new CustomEvent("INMOVYA_TRAVA", { detail: { token, op, dados } }));
  });
}

export const travaPode = (esteiraId: string, nome: string) =>
  falarTrava<TravaPode>("pode", { origem: origemEsteira(esteiraId), nome, cfg: getTravaEsteira(esteiraId) });

export const travaRegistrar = (esteiraId: string, nome: string, telefone: string) =>
  falarTrava("registrar", { origem: origemEsteira(esteiraId), nome, cfg: getTravaEsteira(esteiraId), telefone });

/** Avisa a trava de quem respondeu (varredura e conferência antes do envio). */
export const travaResposta = (itens: { telefone: string; t?: number; quando?: number }[]) =>
  itens.length ? falarTrava("resposta", { itens }) : Promise.resolve(null);

/** Erro de envio: a extensão decide se conta (número sem WhatsApp não conta) e, se contar, pausa tudo. */
export const travaAlarme = (erro: string, semWhatsapp = false) => falarTrava("alarme", { erro, semWhatsapp });

export const travaStatus = (teste = false) => falarTrava<TravaStatus>("status", { teste });
export const travaRetomar = (alvo: string, teste = false) => falarTrava("retomar", { alvo, teste });
export const travaLimiteDia = (limiteDia: number) => falarTrava("cfg", { limiteDia });
export const travaTeste = (dados: { op: string; origem?: string; nome?: string; qtd?: number; responder?: number }) =>
  falarTrava<TravaStatus & { simulados?: number; depois?: TravaPode; primeiroContato?: TravaPode }>("teste", dados, 20000);
