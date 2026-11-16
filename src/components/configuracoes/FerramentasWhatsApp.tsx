// Liga/desliga o que aparece no WhatsApp Web (Inmovya Scale): Dinheiro na Mesa e Disparo.
// Desligado = o botão some da tela do WhatsApp. A escolha fica na extensão deste Chrome.
import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MessageCircle, RefreshCw } from "lucide-react";

type Ferramentas = { dnm: boolean; disparo: boolean };

const falarComExtensao = (ferramentas?: Partial<Ferramentas>) =>
  new Promise<Ferramentas | null>((resolve) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const onResult = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d?.token !== token) return;
      window.clearTimeout(timeout);
      window.removeEventListener("INMOVYA_FERRAMENTAS_RESULT", onResult);
      resolve(d?.ok ? d.ferramentas : null);
    };
    const timeout = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_FERRAMENTAS_RESULT", onResult);
      resolve(null);
    }, 3000);
    window.addEventListener("INMOVYA_FERRAMENTAS_RESULT", onResult);
    window.dispatchEvent(new CustomEvent("INMOVYA_FERRAMENTAS", { detail: { token, ferramentas } }));
  });

const ITENS: { campo: keyof Ferramentas; nome: string; desc: string }[] = [
  { campo: "dnm", nome: "💰 Dinheiro na Mesa", desc: "Oferta ativa em cima de uma etiqueta do WhatsApp." },
  { campo: "disparo", nome: "📣 Disparo", desc: "Envio de mensagens para uma etiqueta ou planilha, com proteção contra bloqueio." },
];

export function FerramentasWhatsApp() {
  const [f, setF] = useState<Ferramentas | null>(null);
  const [semExtensao, setSemExtensao] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const ler = useCallback(async () => {
    const r = await falarComExtensao();
    setSemExtensao(!r);
    setF(r);
  }, []);

  useEffect(() => {
    ler();
  }, [ler]);

  const mudar = async (campo: keyof Ferramentas, valor: boolean) => {
    setSalvando(true);
    setF((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    const r = await falarComExtensao({ [campo]: valor });
    if (r) setF(r);
    else setSemExtensao(true);
    setSalvando(false);
  };

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Ferramentas no WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Só aparece no WhatsApp Web o que estiver ligado aqui.</p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={ler} title="Conferir de novo">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      {semExtensao ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Não achei o Inmovya Scale neste navegador. Abra o Inmovya no Chrome com a extensão (versão 1.14.0 ou mais nova) e clique em conferir de novo.
        </p>
      ) : (
        <div className="divide-y">
          {ITENS.map((it) => (
            <label key={it.campo} className="flex items-center justify-between gap-4 py-3 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold">{it.nome}</span>
                <span className="block text-xs text-muted-foreground">{it.desc}</span>
              </span>
              <Switch checked={!!f?.[it.campo]} disabled={!f || salvando} onCheckedChange={(v) => mudar(it.campo, v)} aria-label={it.nome} />
            </label>
          ))}
          <p className="pt-3 text-xs text-muted-foreground">
            Ao ligar ou desligar, o botão aparece ou some no WhatsApp Web na hora. Um disparo em andamento continua visível até terminar.
          </p>
        </div>
      )}
    </section>
  );
}
