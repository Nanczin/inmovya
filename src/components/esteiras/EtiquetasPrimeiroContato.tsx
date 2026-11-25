// 1º contato: qual etiqueta do WhatsApp o lead recebe, conforme a ORIGEM (Bitrix, Meta Ads, Midrah, cadastro à mão).
// Aparece em linha, junto das opções de "Quais leads". A escolha fica na extensão Inmovya Scale deste Chrome.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type OrigemEtiqueta = "bitrix" | "meta" | "midrah" | "outros" | "todos";
type Cfg = Record<OrigemEtiqueta, string[]>;
type Existente = { nome: string; cor: string | null };

// filtros do próprio WhatsApp que aparecem junto das etiquetas (não são etiquetas de verdade)
const NAO_ETIQUETA = new Set(["nao lidas", "não lidas", "favoritos", "grupos", "unread", "favourites", "favorites", "groups"]);

const falar = (cfg?: Cfg) =>
  new Promise<{ cfg: Cfg; existentes: Existente[] | null; motivo?: string } | null>((resolve) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const ouvir = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d?.token !== token) return;
      window.clearTimeout(t);
      window.removeEventListener("INMOVYA_ETIQUETAS_1C_RESULT", ouvir);
      resolve(d?.ok ? { cfg: d.cfg, existentes: d.existentes, motivo: d.motivo || "" } : null);
    };
    const t = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_ETIQUETAS_1C_RESULT", ouvir);
      resolve(null);
    }, 8000);
    window.addEventListener("INMOVYA_ETIQUETAS_1C_RESULT", ouvir);
    window.dispatchEvent(new CustomEvent("INMOVYA_ETIQUETAS_1C", { detail: { token, cfg: cfg || null } }));
  });

// estado compartilhado entre as linhas (lê uma vez)
let estado: { cfg: Cfg | null; existentes: Existente[] | null; semExtensao: boolean; motivo: string } = { cfg: null, existentes: null, semExtensao: false, motivo: "" };
let carregando: Promise<void> | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
function carregar() {
  if (!carregando)
    carregando = falar().then((r) => {
      estado = r
        ? { cfg: r.cfg, existentes: r.existentes ? r.existentes.filter((e) => !NAO_ETIQUETA.has(e.nome.trim().toLowerCase())) : null, semExtensao: false, motivo: r.motivo || "" }
        : { ...estado, semExtensao: true };
      carregando = null;
      if (r?.cfg) guardarNoBanco(r.cfg);
      avisar();
    });
  return carregando;
}
// também guarda no banco, para o 1º contato na nuvem (quando o PC está desligado) usar as mesmas etiquetas
async function guardarNoBanco(cfg: Cfg) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("agente_config").update({ etiquetas_origem: cfg } as any).eq("user_id", user.id);
  } catch {
    /* coluna ainda não criada: tudo bem */
  }
}
async function gravar(novo: Cfg) {
  estado = { ...estado, cfg: novo };
  avisar();
  const r = await falar(novo);
  if (r) estado = { ...estado, cfg: r.cfg };
  avisar();
  guardarNoBanco(r ? r.cfg : novo);
}

/** Linha pequena: "etiqueta: [Bitrix ×] [+]" para uma origem. */
export function EtiquetaDaOrigem({ origem, className = "" }: { origem: OrigemEtiqueta; className?: string }) {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    ouvintes.add(f);
    if (!estado.cfg && !carregando) carregar();
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  const { cfg, existentes, semExtensao, motivo } = estado;
  if (!cfg) return null;
  void semExtensao;
  const escolhidas = cfg[origem] || [];
  const opcoes = (existentes || []).filter((e) => !escolhidas.some((x) => x.toLowerCase() === e.nome.toLowerCase()));
  const existe = (nome: string) => !existentes || existentes.some((e) => e.nome.toLowerCase() === nome.toLowerCase());
  const tirar = (nome: string) => gravar({ ...cfg, [origem]: escolhidas.filter((x) => x.toLowerCase() !== nome.toLowerCase()) });
  const por = (nome: string) => nome && gravar({ ...cfg, [origem]: [...escolhidas, nome] });
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 text-xs ${className}`}>
      {escolhidas.length === 0 && <span className="text-muted-foreground">nenhuma</span>}
      {escolhidas.map((e) => (
        <span
          key={e}
          className={`inline-flex items-center gap-0.5 rounded-full pl-1.5 pr-0.5 h-5 font-semibold ${existe(e) ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}
          title={existe(e) ? "" : "Esta etiqueta não existe no seu WhatsApp"}
        >
          {e}
          <button type="button" onClick={() => tirar(e)} aria-label={`Tirar ${e}`} className="rounded-full p-0.5 hover:bg-black/10">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {existentes ? (
        opcoes.length > 0 && (
          <select
            value=""
            onChange={(ev) => por(ev.target.value)}
            aria-label="Adicionar etiqueta"
            className="h-5 rounded-full border border-dashed bg-transparent px-1.5 text-[11px] text-muted-foreground cursor-pointer max-w-[110px]"
          >
            <option value="">+</option>
            {opcoes.map((o) => (
              <option key={o.nome} value={o.nome}>
                {o.nome}
              </option>
            ))}
          </select>
        )
      ) : origem !== "bitrix" ? null : (
        <button
          type="button"
          onClick={() => carregar()}
          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
          title="Depois de resolver, clique aqui para listar as suas etiquetas"
        >
          {motivo === "whatsapp_sem_f5"
            ? "aperte F5 na aba do WhatsApp e clique aqui"
            : motivo === "sem_whatsapp"
              ? "abra o WhatsApp Web e clique aqui"
              : "WhatsApp carregando… clique aqui"}
        </button>
      )}
    </span>
  );
}
