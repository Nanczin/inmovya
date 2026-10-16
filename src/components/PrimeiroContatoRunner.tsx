import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sincronizarAgenteComExtensao } from "@/lib/primeiroContato";

// O 1º contato automático roda no Inmovya Scale (com o Inmovya fechado). Ao abrir o Inmovya,
// só garante que a extensão deste Chrome tem o token do agente (ex.: depois de reinstalar a extensão).
export function PrimeiroContatoRunner() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      sincronizarAgenteComExtensao();
    }, 4000);
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") sincronizarAgenteComExtensao();
    });
    return () => {
      window.clearTimeout(t);
      authSub.subscription.unsubscribe();
    };
  }, []);
  return null;
}
