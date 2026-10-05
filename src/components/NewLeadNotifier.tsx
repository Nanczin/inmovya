import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";

// Avisa na hora quando entra um lead novo vindo da captura automática
// (Bitrix/roleta ou Meta Ads): alerta na tela, som, sininho e aviso do sistema.

const isAutoLead = (lead: any) => {
  const tags: string[] = Array.isArray(lead?.tags) ? lead.tags.map((t: any) => String(t).toLowerCase()) : [];
  const origem = String(lead?.origem || "").toLowerCase();
  return origem === "roleta" || tags.includes("roleta") || tags.includes("meta ads");
};

const playChime = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1175, 1568];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => ctx.close?.(), 1500);
  } catch {
    // sem som não é problema
  }
};

const resumo = (lead: any) => {
  const fonte = String(lead?.origem || "").toLowerCase() === "roleta" ? "Roleta (Bitrix)" : "Meta Ads";
  const obs = String(lead?.observacoes || "").split("\n")[0].replace(/Bitrix #\d+/g, "").trim();
  return [fonte, lead?.telefone, obs].filter(Boolean).join(" · ").slice(0, 160);
};

export function NewLeadNotifier() {
  const { addNotification, subscribeToPush } = useNotifications();
  const seen = useRef<Set<string>>(new Set());

  // Pede permissão de notificação com um clique (navegadores exigem o clique)
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    const t = setTimeout(() => {
      toast("Ative os avisos de lead novo", {
        description: "Para ser avisado na hora, mesmo com o Inmovya fechado.",
        duration: 30000,
        action: {
          label: "Ativar",
          onClick: async () => {
            const perm = await Notification.requestPermission();
            if (perm === "granted") {
              await subscribeToPush();
              toast.success("Avisos de lead novo ativados");
            }
          },
        },
      });
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    const stop = () => {
      if (channel) supabase.removeChannel(channel);
      channel = null;
      currentUserId = null;
    };

    const start = (userId: string) => {
      if (currentUserId === userId && channel) return;
      stop();
      currentUserId = userId;

      // Garante que este aparelho está inscrito para receber push com o app fechado
      if ("Notification" in window && Notification.permission === "granted") {
        subscribeToPush().catch(() => undefined);
      }

      channel = supabase
        .channel(`new-lead-notifier-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "leads", filter: `user_id=eq.${userId}` },
          (payload) => {
            const lead: any = payload.new;
            if (!lead?.id || seen.current.has(lead.id) || !isAutoLead(lead)) return;
            seen.current.add(lead.id);

            const titulo = `🔥 Lead novo: ${lead.nome || "sem nome"}`;
            const texto = resumo(lead);

            playChime();
            toast(titulo, {
              description: texto,
              duration: 60000,
              action: {
                label: "Abrir",
                onClick: () => {
                  window.location.href = `/?leadId=${lead.id}`;
                },
              },
            });
            addNotification({
              type: "info",
              title: titulo,
              message: texto,
              leadId: lead.id,
              tag: `lead-${lead.id}`,
            });
          }
        )
        .subscribe();
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) start(user.id);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) start(session.user.id);
      else stop();
    });

    return () => {
      authSub.subscription.unsubscribe();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
