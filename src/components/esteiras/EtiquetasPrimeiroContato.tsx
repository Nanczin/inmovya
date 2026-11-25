// 1º contato: quais etiquetas do WhatsApp o lead novo recebe, por origem (pode ser mais de uma).
// A escolha fica na extensão Inmovya Scale deste Chrome (é ela quem etiqueta depois de enviar).
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Tag, X } from "lucide-react";

type Cfg = { bitrix: string[]; meta: string[]; midrah: string[]; outros: string[]; todos: string[] };
type Existente = { nome: string; cor: string | null };

const LINHAS: { k: keyof Cfg; nome: string; desc: string }[] = [
  { k: "bitrix", nome: "Bitrix (roleta)", desc: "leads que chegam pelo Bitrix" },
  { k: "meta", nome: "Meta Ads", desc: "Facebook e Instagram" },
  { k: "midrah", nome: "Midrah", desc: "quando o 1º contato do Midrah está ligado" },
  { k: "outros", nome: "Outras origens", desc: "cadastrados à mão, importados, formulários" },
  { k: "todos", nome: "Todos os leads", desc: "além das de cima, qualquer origem recebe (ex.: 20%)" },
];

const falar = (cfg?: Cfg) =>
  new Promise<{ cfg: Cfg; existentes: Existente[] | null } | null>((resolve) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const ouvir = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d?.token !== token) return;
      window.clearTimeout(t);
      window.removeEventListener("INMOVYA_ETIQUETAS_1C_RESULT", ouvir);
      resolve(d?.ok ? { cfg: d.cfg, existentes: d.existentes } : null);
    };
    const t = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_ETIQUETAS_1C_RESULT", ouvir);
      resolve(null);
    }, 8000);
    window.addEventListener("INMOVYA_ETIQUETAS_1C_RESULT", ouvir);
    window.dispatchEvent(new CustomEvent("INMOVYA_ETIQUETAS_1C", { detail: { token, cfg: cfg || null } }));
  });

export function EtiquetasPrimeiroContato() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [existentes, setExistentes] = useState<Existente[] | null>(null);
  const [semExtensao, setSemExtensao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [digitando, setDigitando] = useState<Record<string, string>>({});

  const ler = useCallback(async () => {
    const r = await falar();
    setSemExtensao(!r);
    if (r) {
      setCfg(r.cfg);
      setExistentes(r.existentes);
    }
  }, []);
  useEffect(() => {
    ler();
  }, [ler]);

  const gravar = async (novo: Cfg) => {
    setCfg(novo);
    setSalvando(true);
    setSalvo(false);
    const r = await falar(novo);
    setSalvando(false);
    if (r) {
      setCfg(r.cfg);
      setExistentes(r.existentes || existentes);
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 2500);
    } else setSemExtensao(true);
  };
  const alternar = (k: keyof Cfg, nome: string) => {
    if (!cfg) return;
    const tem = cfg[k].some((x) => x.toLowerCase() === nome.toLowerCase());
    gravar({ ...cfg, [k]: tem ? cfg[k].filter((x) => x.toLowerCase() !== nome.toLowerCase()) : [...cfg[k], nome] });
  };
  const adicionarDigitada = (k: keyof Cfg) => {
    const nome = (digitando[k] || "").trim();
    if (!nome || !cfg) return;
    setDigitando((d) => ({ ...d, [k]: "" }));
    if (!cfg[k].some((x) => x.toLowerCase() === nome.toLowerCase())) gravar({ ...cfg, [k]: [...cfg[k], nome] });
  };
  const existe = (nome: string) => !existentes || existentes.some((e) => e.nome.toLowerCase() === nome.toLowerCase());
  const corDe = (nome: string) => existentes?.find((e) => e.nome.toLowerCase() === nome.toLowerCase())?.cor || "hsl(var(--muted-foreground))";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-primary" aria-hidden="true" /> Etiquetas que o lead recebe no WhatsApp
          </h3>
          <p className="text-xs text-muted-foreground">
            Depois do 1º contato, o Inmovya Scale salva o contato e põe estas etiquetas. Escolha por origem — pode marcar mais de uma.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {salvando ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> salvando…
            </span>
          ) : salvo ? (
            <span className="text-success font-semibold">Salvo ✓</span>
          ) : null}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={ler} title="Ler de novo as etiquetas do WhatsApp">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {semExtensao && !cfg ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Não achei o Inmovya Scale 1.32 neste Chrome. Recarregue a extensão em chrome://extensions e atualize esta página.
        </p>
      ) : !cfg ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Lendo…
        </p>
      ) : (
        <>
          {!existentes && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Abra o WhatsApp Web neste Chrome e clique em ↻ para ver a lista das suas etiquetas. Enquanto isso, dá para digitar o nome.
            </p>
          )}
          <div className="divide-y">
            {LINHAS.map(({ k, nome, desc }) => {
              const escolhidas = cfg[k];
              const outras = (existentes || []).filter((e) => !escolhidas.some((x) => x.toLowerCase() === e.nome.toLowerCase()));
              return (
                <div key={k} className="py-2.5 grid gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">{nome}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {escolhidas.length === 0 && <span className="text-xs text-muted-foreground">nenhuma etiqueta</span>}
                    {escolhidas.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => alternar(k, e)}
                        title="Tirar"
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-xs font-semibold border ${
                          existe(e) ? "bg-primary text-primary-foreground border-primary" : "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: corDe(e) }} aria-hidden="true" />
                        {e}
                        {!existe(e) && <span className="font-normal">(não existe no WhatsApp)</span>}
                        <X className="w-3 h-3 opacity-70" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  {outras.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {outras.map((e) => (
                        <button
                          key={e.nome}
                          type="button"
                          onClick={() => alternar(k, e.nome)}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-xs font-medium border bg-muted/50 hover:bg-muted"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: e.cor || "hsl(var(--muted-foreground))" }} aria-hidden="true" />+ {e.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  {!existentes && (
                    <div className="flex gap-1.5">
                      <Input
                        value={digitando[k] || ""}
                        onChange={(ev) => setDigitando((d) => ({ ...d, [k]: ev.target.value }))}
                        onKeyDown={(ev) => ev.key === "Enter" && adicionarDigitada(k)}
                        placeholder="Nome da etiqueta (igual ao WhatsApp)"
                        className="h-8 text-xs max-w-xs"
                      />
                      <Button size="sm" variant="outline" className="h-8" onClick={() => adicionarDigitada(k)}>
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Vale para os próximos leads. O contato também é salvo com o nome do lead, como já acontece hoje.</p>
        </>
      )}
    </div>
  );
}
