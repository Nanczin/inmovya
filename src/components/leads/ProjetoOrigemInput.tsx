// Campo "Projeto de origem" com a lista dos projetos já cadastrados nos leads,
// para não nascer "Sync Ibirapuera", "sync ibirapuera" e "Sync Ibira" como projetos diferentes.
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useLeads } from "@/context/LeadsContext";
import { Check, ChevronDown, Plus } from "lucide-react";

const normal = (t: string) =>
  (t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ProjetoOrigemInput({ id, value, onChange, placeholder }: Props) {
  const { leads } = useLeads();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const fecharTimer = useRef<number>();

  // projetos já usados (a grafia mais usada de cada um), com quantos leads têm
  const projetos = useMemo(() => {
    const grupos = new Map<string, Map<string, number>>();
    (leads || []).forEach((l: any) => {
      const p = String(l.projeto_origem || "").trim();
      if (!p) return;
      const k = normal(p);
      const g = grupos.get(k) || new Map<string, number>();
      g.set(p, (g.get(p) || 0) + 1);
      grupos.set(k, g);
    });
    return Array.from(grupos.entries())
      .map(([k, g]) => {
        const grafias = Array.from(g.entries()).sort((a, b) => b[1] - a[1]);
        return { chave: k, nome: grafias[0][0], total: grafias.reduce((s, x) => s + x[1], 0) };
      })
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [leads]);

  const q = normal(value);
  const exato = projetos.find((p) => p.chave === q);
  const sugestoes = useMemo(() => {
    if (!q) return projetos.slice(0, 30);
    const palavras = q.split(" ");
    return projetos.filter((p) => palavras.every((w) => p.chave.includes(w))).slice(0, 30);
  }, [projetos, q]);

  const escolher = (nome: string) => {
    onChange(nome);
    setAberto(false);
    setAtivo(-1);
  };

  // ao sair do campo: mesmo nome com outra grafia vira o já cadastrado
  const aoSair = () => {
    fecharTimer.current = window.setTimeout(() => {
      setAberto(false);
      if (exato && exato.nome !== value) onChange(exato.nome);
    }, 150);
  };

  const novo = !!q && !exato;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
          placeholder={placeholder || "Escolha um projeto já cadastrado ou digite um novo"}
          onFocus={() => setAberto(true)}
          onBlur={aoSair}
          onChange={(e) => {
            onChange(e.target.value);
            setAberto(true);
            setAtivo(-1);
          }}
          onKeyDown={(e) => {
            if (!aberto && (e.key === "ArrowDown" || e.key === "ArrowUp")) setAberto(true);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo((a) => Math.min(a + 1, sugestoes.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, -1));
            } else if (e.key === "Enter" && aberto && ativo >= 0 && sugestoes[ativo]) {
              e.preventDefault();
              escolher(sugestoes[ativo].nome);
            } else if (e.key === "Escape") {
              setAberto(false);
            }
          }}
          className="pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver projetos cadastrados"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            setAberto((v) => !v);
          }}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {aberto && (sugestoes.length > 0 || novo) && (
        <div role="listbox" className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md py-1">
          {sugestoes.map((p, i) => {
            const sel = exato?.chave === p.chave;
            return (
              <button
                key={p.chave}
                type="button"
                role="option"
                aria-selected={sel}
                onMouseDown={(e) => {
                  e.preventDefault();
                  window.clearTimeout(fecharTimer.current);
                  escolher(p.nome);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === ativo ? "bg-muted" : "hover:bg-muted"}`}
              >
                <Check className={`w-4 h-4 shrink-0 ${sel ? "opacity-100 text-primary" : "opacity-0"}`} />
                <span className="flex-1 truncate">{p.nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">{p.total} lead{p.total === 1 ? "" : "s"}</span>
              </button>
            );
          })}
          {novo && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-t mt-1">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>
                Novo projeto: <b className="text-foreground">{value.trim()}</b>. Confira se não é o mesmo de um da lista com outro nome.
              </span>
            </div>
          )}
        </div>
      )}
      {exato && exato.nome !== value && !aberto && (
        <p className="mt-1 text-xs text-muted-foreground">Vai usar “{exato.nome}”, que já está cadastrado.</p>
      )}
    </div>
  );
}

/** Grafia já cadastrada para o mesmo projeto (ignora acento, maiúscula e pontuação); senão, o texto limpo. */
export function grafiaCadastrada(valor: string | null | undefined, leads: any[] | null | undefined): string | null {
  const v = String(valor || "").replace(/\s+/g, " ").trim();
  if (!v) return null;
  const k = normal(v);
  const contagem = new Map<string, number>();
  (leads || []).forEach((l: any) => {
    const p = String(l?.projeto_origem || "").trim();
    if (p && normal(p) === k) contagem.set(p, (contagem.get(p) || 0) + 1);
  });
  if (!contagem.size) return v;
  return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1])[0][0];
}
