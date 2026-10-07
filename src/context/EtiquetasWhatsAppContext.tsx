// Sincronização das etiquetas do WhatsApp como função do Inmovya (Inmovya -> WhatsApp).
// Vale para qualquer tela: mudou a etapa do lead (Negócios, Leads, esteira, fim automático),
// a etiqueta da conversa é acertada pela extensão Inmovya Scale. No automático, roda sozinha
// enquanto o Inmovya estiver aberto no Chrome com a extensão.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLeads, Lead } from "@/context/LeadsContext";
import { checarExtensao, extensaoAtualizada, telefoneWhatsApp } from "@/lib/esteiras";
import {
  chaveEtiquetas,
  etiquetarNoWhatsApp,
  etiquetasDoLead,
  isWhatsAppOcupado,
  registrarEtiquetas,
  setWhatsAppOcupado,
} from "@/lib/etiquetasWhatsApp";

const AUTO_KEY = "inmovya_etiquetas_auto";
const VERSAO_MINIMA = "1.2.6";
const INTERVALO_MS = 4000; // entre uma conversa e outra
const ESPERA_MUDANCA_MS = 20000; // espera o lead "assentar" depois de mudar de etapa

type LeadComEtiqueta = Lead & { wa_etiqueta?: string | null };
export type PendenteEtiqueta = { lead: LeadComEtiqueta; etiquetas: string[] };

interface EtiquetasWhatsAppValue {
  pendentes: PendenteEtiqueta[];
  automatico: boolean;
  setAutomatico: (v: boolean) => void;
  rodando: boolean;
  progresso: { feitos: number; total: number } | null;
  falhas: { nome: string; erro: string }[];
  extensaoPronta: boolean | null;
  sincronizarAgora: () => Promise<void>;
  parar: () => void;
}

const Ctx = createContext<EtiquetasWhatsAppValue | null>(null);

export const useEtiquetasWhatsApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEtiquetasWhatsApp fora do EtiquetasWhatsAppProvider");
  return v;
};

const lerAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
};

export function EtiquetasWhatsAppProvider({ children }: { children: ReactNode }) {
  const { leads, refreshLeads } = useLeads();
  const [automatico, setAutomaticoState] = useState(lerAuto);
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [falhas, setFalhas] = useState<{ nome: string; erro: string }[]>([]);
  const [extensaoPronta, setExtensaoPronta] = useState<boolean | null>(null);
  const pararRef = useRef(false);
  const rodandoRef = useRef(false);
  // quem falhou nesta sessão não é tentado de novo no automático (só no "Sincronizar agora")
  const falhouRef = useRef<Set<string>>(new Set());
  // quando cada lead apareceu como pendente (para não etiquetar no meio de uma edição)
  const vistoEmRef = useRef<Map<string, number>>(new Map());

  const setAutomatico = (v: boolean) => {
    setAutomaticoState(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const pendentes = useMemo<PendenteEtiqueta[]>(
    () =>
      ((leads || []) as LeadComEtiqueta[])
        .map((lead) => ({ lead, etiquetas: etiquetasDoLead(lead) }))
        .filter(({ lead, etiquetas }) => {
          const atual = lead.wa_etiqueta ?? null;
          if (atual === null && !etiquetas.length) return false; // nunca etiquetado e fora do funil: não mexe
          return chaveEtiquetas(etiquetas) !== atual && !!telefoneWhatsApp(lead.telefone);
        }),
    [leads]
  );

  useEffect(() => {
    const agora = Date.now();
    const ids = new Set(pendentes.map((p) => p.lead.id));
    pendentes.forEach((p) => !vistoEmRef.current.has(p.lead.id) && vistoEmRef.current.set(p.lead.id, agora));
    Array.from(vistoEmRef.current.keys()).forEach((id) => !ids.has(id) && vistoEmRef.current.delete(id));
  }, [pendentes]);

  const verificarExtensao = useCallback(async () => {
    const ok = (await checarExtensao()) && extensaoAtualizada(VERSAO_MINIMA);
    setExtensaoPronta(ok);
    return ok;
  }, []);

  const processar = useCallback(
    async (lista: PendenteEtiqueta[], manual: boolean) => {
      if (rodandoRef.current || !lista.length) return;
      if (!(await verificarExtensao())) return;
      rodandoRef.current = true;
      pararRef.current = false;
      setRodando(true);
      const novasFalhas: { nome: string; erro: string }[] = [];
      try {
        for (let i = 0; i < lista.length; i++) {
          if (pararRef.current) break;
          // a esteira está enviando: espera ela terminar
          while (isWhatsAppOcupado() && !pararRef.current) await new Promise((r) => setTimeout(r, 2000));
          if (pararRef.current) break;
          const { lead, etiquetas } = lista[i];
          setProgresso({ feitos: i, total: lista.length });
          setWhatsAppOcupado(true);
          try {
            await etiquetarNoWhatsApp(lead.telefone || "", etiquetas);
            await registrarEtiquetas(lead.id, etiquetas);
            falhouRef.current.delete(lead.id);
          } catch (err: any) {
            falhouRef.current.add(lead.id);
            novasFalhas.push({ nome: lead.nome, erro: err?.message || "falha" });
          } finally {
            setWhatsAppOcupado(false);
          }
          if (i < lista.length - 1) await new Promise((r) => setTimeout(r, INTERVALO_MS));
        }
      } finally {
        rodandoRef.current = false;
        setRodando(false);
        setProgresso(null);
        setFalhas((f) => (manual ? novasFalhas : [...novasFalhas, ...f].slice(0, 30)));
        if (novasFalhas.length) console.warn("Etiquetas do WhatsApp não aplicadas:", novasFalhas);
        await refreshLeads();
      }
    },
    [refreshLeads, verificarExtensao]
  );

  const sincronizarAgora = useCallback(async () => {
    falhouRef.current.clear();
    await processar(pendentes, true);
  }, [pendentes, processar]);

  const parar = () => {
    pararRef.current = true;
  };

  // Automático: confere a cada 30 s se há etiqueta para acertar
  useEffect(() => {
    if (!automatico) return;
    const tick = () => {
      if (rodandoRef.current || isWhatsAppOcupado()) return;
      const agora = Date.now();
      const prontos = pendentes.filter(
        (p) => !falhouRef.current.has(p.lead.id) && agora - (vistoEmRef.current.get(p.lead.id) ?? agora) >= ESPERA_MUDANCA_MS
      );
      if (prontos.length) processar(prontos, false);
    };
    tick();
    const t = window.setInterval(tick, 30000);
    return () => window.clearInterval(t);
  }, [automatico, pendentes, processar]);

  useEffect(() => {
    verificarExtensao();
  }, [verificarExtensao]);

  return (
    <Ctx.Provider
      value={{ pendentes, automatico, setAutomatico, rodando, progresso, falhas, extensaoPronta, sincronizarAgora, parar }}
    >
      {children}
    </Ctx.Provider>
  );
}
