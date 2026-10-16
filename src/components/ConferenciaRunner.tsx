import { useEffect } from "react";
import { toast } from "sonner";
import { resumoRelatorio, talvezConferirAutomatico } from "@/lib/conferenciaWhatsApp";

// Conferência WhatsApp × Inmovya automática: uma vez por dia, no horário escolhido (só gera o relatório; não corrige sozinha).
export function ConferenciaRunner() {
  useEffect(() => {
    const tentar = async () => {
      const r = await talvezConferirAutomatico().catch(() => null);
      if (!r) return;
      if (r.erro) {
        toast.error("Conferência com o WhatsApp não terminou", { description: r.erro, duration: 60000 });
        return;
      }
      const s = resumoRelatorio(r);
      const pendencias = s.divergentes + s.excluir;
      toast(pendencias ? `Conferência: ${pendencias} pendência(s) com o WhatsApp` : "Conferência: tudo batendo com o WhatsApp ✅", {
        description: `${s.ok} ok · ${s.divergentes} divergente(s) · ${s.excluir} para excluir · ${s.naoAchados} não achado(s). Veja em Negócios → Conferir com WhatsApp.`,
        duration: 60000,
      });
    };
    const t = window.setInterval(tentar, 60_000);
    const primeira = window.setTimeout(tentar, 20_000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(primeira);
    };
  }, []);
  return null;
}
