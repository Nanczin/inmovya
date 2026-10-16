import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { agendarRodada, getConfigPrimeiroContato } from "@/lib/primeiroContato";

// Roda o agente de 1º contato em qualquer tela do Inmovya: lead novo entrou → atende em segundos.
// A cada minuto também confere se ficou algum para trás (computador desligado, erro, etc.).
export function PrimeiroContatoRunner() {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let userAtual: string | null = null;

    const parar = () => {
      if (channel) supabase.removeChannel(channel);
      channel = null;
      userAtual = null;
    };

    const iniciar = (userId: string) => {
      if (userAtual === userId && channel) return;
      parar();
      userAtual = userId;
      channel = supabase
        .channel(`primeiro-contato-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads", filter: `user_id=eq.${userId}` }, () => {
          if (getConfigPrimeiroContato().ativo) agendarRodada(3000);
        })
        .subscribe();
      if (getConfigPrimeiroContato().ativo) agendarRodada(5000);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) iniciar(user.id);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) iniciar(session.user.id);
      else parar();
    });

    const intervalo = window.setInterval(() => {
      if (userAtual && getConfigPrimeiroContato().ativo) agendarRodada(0);
    }, 60_000);

    return () => {
      window.clearInterval(intervalo);
      authSub.subscription.unsubscribe();
      parar();
    };
  }, []);

  return null;
}
