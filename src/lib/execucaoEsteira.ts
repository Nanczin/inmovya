// Estado da rodada de envio da esteira FORA da tela: continua valendo ao trocar de aba no Inmovya,
// para mostrar o andamento em qualquer tela e poder parar o envio.
export type EstadoItem = "pendente" | "enviando" | "enviado" | "erro" | "pulado";
export type MapaEstado = Record<string, { s: EstadoItem; erro?: string; colado?: boolean }>;

interface Execucao {
  rodando: boolean;
  estado: MapaEstado;
  contagem: number; // segundos até o próximo envio
  emPausa: boolean;
  total: number;
  feitos: number;
  atual: string; // nome do lead sendo enviado
}

let atual: Execucao = { rodando: false, estado: {}, contagem: 0, emPausa: false, total: 0, feitos: 0, atual: "" };
let parar = false;
const ouvintes = new Set<() => void>();
const mudar = (p: Partial<Execucao>) => {
  atual = { ...atual, ...p };
  ouvintes.forEach((f) => f());
};

export const assinarExecucao = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
export const lerExecucao = () => atual;

export const setRodandoEsteira = (v: boolean) => mudar(v ? { rodando: true } : { rodando: false, contagem: 0, emPausa: false, atual: "" });
export const setContagemEsteira = (n: number) => mudar({ contagem: n });
export const setEmPausaEsteira = (v: boolean) => mudar({ emPausa: v });
export const setProgressoEsteira = (feitos: number, total: number, nome = "") => mudar({ feitos, total, atual: nome });
export const setEstadoEsteira = (f: MapaEstado | ((s: MapaEstado) => MapaEstado)) =>
  mudar({ estado: typeof f === "function" ? (f as any)(atual.estado) : f });

export const pedirParadaEsteira = () => {
  parar = true;
  ouvintes.forEach((f) => f());
};
export const deveParar = () => parar;
export const limparParada = () => {
  parar = false;
};
