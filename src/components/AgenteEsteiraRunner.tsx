import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLeads } from "@/context/LeadsContext";
import { getAgenteAtivo, rodarFimDasEsteiras } from "@/lib/agenteEsteira";

// Roda o agente do fim da esteira a cada 30 minutos enquanto o Inmovya estiver aberto.
export function AgenteEsteiraRunner() {
  const { toast } = useToast();
  const { refreshLeads } = useLeads();
  useEffect(() => {
    let parar = false;
    const rodar = async () => {
      if (parar || !getAgenteAtivo()) return;
      try {
        const r = await rodarFimDasEsteiras();
        if (!r.length) return;
        await refreshLeads();
        const conta = (c: string) => r.filter((x) => x.classificacao === c).length;
        toast({
          title: "Agente da esteira",
          description: `${r.length} lead(s): ${conta("sem_resposta")} para disparo, ${conta("positiva")} positiva(s), ${conta("negativa")} negativa(s), ${conta("neutra")} neutra(s). Veja em Esteiras → Agente.`,
        });
      } catch (e) {
        console.error("Agente da esteira:", e);
      }
    };
    const primeiro = window.setTimeout(rodar, 60_000);
    const t = window.setInterval(rodar, 30 * 60_000);
    return () => {
      parar = true;
      window.clearTimeout(primeiro);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
