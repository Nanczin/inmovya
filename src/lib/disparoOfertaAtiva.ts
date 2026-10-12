// Disparo automático da Oferta Ativa: depois de classificar uma ligação, a mensagem do
// template escolhido entra numa fila e é enviada pelo Inmovya Scale em segundo plano
// (janela pequena, sem foco), com no mínimo 2 minutos entre um envio e outro.
// A fila fica fora da tela de Ligações, então continua rodando ao trocar de aba no Inmovya.
import {
  checarExtensao,
  enviarPeloWhatsApp,
  extensaoAtualizada,
  telefoneWhatsApp,
} from "@/lib/esteiras";
import { isWhatsAppOcupado, setWhatsAppOcupado } from "@/lib/etiquetasWhatsApp";

export interface ConfigDisparo {
  ativo: boolean;
  templateId: string;
  classificacoes: string[]; // classificações que disparam a mensagem
}

export const CLASSIFICACOES_DISPARO = [
  "Caixa Postal/Cliente Não Atendeu",
  "Cliente Interessado",
];

const CONFIG_KEY = "inmovya_oferta_disparo";
const PADRAO: ConfigDisparo = { ativo: false, templateId: "", classificacoes: ["Caixa Postal/Cliente Não Atendeu"] };

export const getConfigDisparo = (): ConfigDisparo => {
  try {
    const v = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (v && typeof v === "object") {
      return {
        ativo: !!v.ativo,
        templateId: String(v.templateId || ""),
        classificacoes: Array.isArray(v.classificacoes) ? v.classificacoes : PADRAO.classificacoes,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...PADRAO };
};

export const setConfigDisparo = (c: ConfigDisparo) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
};

// ---------- Fila ----------
export interface ItemDisparo {
  id: string;
  nome: string;
  telefone: string; // 55 + DDD + número
  texto: string;
  status: "na fila" | "enviando" | "enviado" | "erro";
  erro?: string;
  em?: string;
}

const INTERVALO_MIN_S = 120; // mínimo 2 min entre envios (evita bloqueio do WhatsApp)
const INTERVALO_MAX_S = 180;

let fila: ItemDisparo[] = [];
let rodando = false;
let ultimoEnvio = 0;
let proximoEm = 0;
const ouvintes = new Set<() => void>();
const montarEstado = () => ({
  itens: [...fila],
  pendentes: fila.filter((i) => i.status === "na fila" || i.status === "enviando").length,
  enviados: fila.filter((i) => i.status === "enviado").length,
  erros: fila.filter((i) => i.status === "erro").length,
  proximoEm,
});
let snapshot = montarEstado();
const avisar = () => {
  snapshot = montarEstado();
  ouvintes.forEach((f) => f());
};

export const assinarFila = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};

export const estadoFila = () => snapshot;

export const limparConcluidos = () => {
  fila = fila.filter((i) => i.status === "na fila" || i.status === "enviando");
  avisar();
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
// espera pelo relógio (o Chrome atrasa timers de abas escondidas)
const esperarAte = async (quando: number) => {
  while (Date.now() < quando) await dormir(Math.min(1000, quando - Date.now()));
};

const processar = async () => {
  if (rodando) return;
  rodando = true;
  try {
    while (true) {
      const item = fila.find((i) => i.status === "na fila");
      if (!item) break;
      // intervalo mínimo desde o último envio
      const espera = ultimoEnvio ? ultimoEnvio + (INTERVALO_MIN_S + Math.random() * (INTERVALO_MAX_S - INTERVALO_MIN_S)) * 1000 : 0;
      proximoEm = Math.max(espera, Date.now());
      avisar();
      await esperarAte(proximoEm);
      // a esteira (ou a leitura das etiquetas) tem prioridade: espera ela terminar
      while (isWhatsAppOcupado()) await dormir(2000);
      setWhatsAppOcupado(true);
      item.status = "enviando";
      avisar();
      try {
        await enviarPeloWhatsApp(item.telefone, item.texto, [], extensaoAtualizada("1.3.0"));
        item.status = "enviado";
        item.em = new Date().toISOString();
      } catch (e: any) {
        item.status = "erro";
        item.erro = e?.message || "Falha no envio";
      } finally {
        setWhatsAppOcupado(false);
        ultimoEnvio = Date.now();
        proximoEm = 0;
        avisar();
      }
    }
  } finally {
    rodando = false;
    proximoEm = 0;
    avisar();
  }
};

/** Coloca a mensagem na fila. Devolve um aviso se não der para enfileirar. */
export async function enfileirarDisparo(nome: string, telefone: string, texto: string): Promise<string | null> {
  const tel = telefoneWhatsApp(telefone);
  if (!tel) return "telefone inválido";
  if (!texto.trim()) return "mensagem vazia";
  if (fila.some((i) => i.telefone === tel && (i.status === "na fila" || i.status === "enviando"))) return null;
  const ok = await checarExtensao();
  if (!ok) return "Inmovya Scale não encontrado neste Chrome";
  fila.push({ id: crypto.randomUUID(), nome, telefone: tel, texto, status: "na fila" });
  avisar();
  processar();
  return null;
}
