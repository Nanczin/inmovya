// 1º contato: quais etiquetas do WhatsApp o lead novo recebe, por origem (pode ser mais de uma).
// A escolha fica na extensão Inmovya Scale deste Chrome (é ela quem etiqueta depois de enviar).
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Tag, X } from "lucide-react";

type Cfg = { bitrix: string[]; meta: string[]; midrah: string[]; outros: string[]; todos: string[] };
type Existente = { nome: string; cor: string | null };

const LINHAS: { k: keyof Cfg; nome: string }[] = [
  { k: "bitrix", nome: "Bitrix" },
  { k: "meta", nome: "Meta Ads" },
  { k: "midrah", nome: "Midrah" },
  { k: "outros", nome: "Cadastro à mão" },
  { k: "todos", nome: "Todos" },
];
// filtros do próprio WhatsApp que aparecem junto das etiquetas (não são etiquetas de verdade)
const NAO_ETIQUETA = new Set(["nao lidas", "não lidas", "favoritos", "grupos", "unread", "favourites", "favorites", "groups"]);

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

export function EtiquetasPrimeiroContato({ mostrarMidrah = true, mostrarOutros = true }: { mostrarMidrah?: boolean; mostrarOutros?: boolean }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [existentes, setExistentes] = useState<Existente[] | null>(null);
  const [semExtensao, setSemExtensao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const ler = useCallback(async () => {
    const r = await falar();
    setSemExtensao(!r);
    if (r) {
      setCfg(r.cfg);
      setExistentes(r.existentes ? r.existentes.filter((e) => !NAO_ETIQUETA.has(e.nome.trim().toLowerCase())) : null);
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
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 2000);
    } else setSemExtensao(true);
  };
  const tirar = (k: keyof Cfg, nome: string) => cfg && gravar({ ...cfg, [k]: cfg[k].filter((x) => x.toLowerCase() !== nome.toLowerCase()) });
  const por = (k: keyof Cfg, nome: string) => {
    const n = nome.trim();
    if (!cfg || !n || cfg[k].some((x) => x.toLowerCase() === n.toLowerCase())) return;
    gravar({ ...cfg, [k]: [...cfg[k], n] });
  };
  const existe = (nome: string) => !existentes || existentes.some((e) => e.nome.toLowerCase() === nome.toLowerCase());

  const linhas = LINHAS.filter((l) => (l.k !== "midrah" || mostrarMidrah) && (l.k !== "outros" || mostrarOutros));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Etiqueta no WhatsApp
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : salvo ? <span className="text-success font-semibold">salvo ✓</span> : null}
          <button type="button" onClick={ler} title="Ler as etiquetas do WhatsApp de novo" className="p-1 rounded hover:bg-muted">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
      {semExtensao && !cfg ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">Recarregue o Inmovya Scale (1.32) em chrome://extensions e atualize esta página.</p>
      ) : !cfg ? (
        <p className="text-xs text-muted-foreground">Lendo…</p>
      ) : (
        <div className="rounded-md border divide-y">
          {linhas.map(({ k, nome }) => {
            const escolhidas = cfg[k];
            const opcoes = (existentes || []).filter((e) => !escolhidas.some((x) => x.toLowerCase() === e.nome.toLowerCase()));
            return (
              <div key={k} className="flex items-center gap-2 px-2.5 py-1.5 min-h-10">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{nome}</span>
                <div className="flex-1 flex flex-wrap items-center gap-1">
                  {escolhidas.map((e) => (
                    <span
                      key={e}
                      className={`inline-flex items-center gap-1 rounded-full pl-2 pr-1 h-6 text-xs font-semibold ${existe(e) ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}
                      title={existe(e) ? "" : "Esta etiqueta não existe no seu WhatsApp"}
                    >
                      {e}
                      <button type="button" onClick={() => tirar(k, e)} aria-label={`Tirar ${e}`} className="rounded-full p-0.5 hover:bg-black/10">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(ev) => por(k, ev.target.value)}
                    aria-label={`Adicionar etiqueta para ${nome}`}
                    className="h-6 rounded-full border border-dashed bg-transparent px-2 text-xs text-muted-foreground cursor-pointer max-w-[130px]"
                  >
                    <option value="">+ etiqueta</option>
                    {opcoes.map((o) => (
                      <option key={o.nome} value={o.nome}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {cfg && !existentes && <p className="text-[11px] text-muted-foreground">Abra o WhatsApp Web e clique em ↻ para listar as suas etiquetas.</p>}
    </div>
  );
}
