import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { diasUteisDoMes, lerMetasLocal, metaPorDia, normalizarMetas, type Metas } from "@/components/ArenaModule";

// "Definir metas" — o mesmo nas telas Arena e Ligações (as metas são uma só).
// Do dia: ligações, interações, leads e negociações. Do mês: documentos, vendas e visitas.
export const CAMPOS_METAS: [keyof Metas, string, string][] = [
  ["diaLigacoes", "📞 Ligações", "por dia"],
  ["diaInteracoes", "💬 Interações", "por dia"],
  ["diaInteressados", "🎯 Leads", "por dia"],
  ["diaNegociacoes", "🤝 Negociações", "por dia"],
  ["mesDocumentacoes", "📄 Documentos", "no mês"],
  ["mesVendas", "🏆 Vendas", "no mês"],
  ["mesVisitas", "🏠 Visitas", "no mês"],
];

/** Lê as metas (banco, se houver; senão as deste navegador). */
export async function carregarMetas(): Promise<Metas> {
  const local = lerMetasLocal();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return local;
    const { data } = await supabase.from("arena_metas" as any).select("metas").eq("user_id", user.id).maybeSingle();
    return (data as any)?.metas ? normalizarMetas((data as any).metas) : local;
  } catch {
    return local;
  }
}

/** Guarda as metas neste navegador e no banco (vale em qualquer computador). */
export async function salvarMetas(m: Metas) {
  try {
    localStorage.setItem("inmovya_arena_metas", JSON.stringify(m));
    localStorage.setItem("meta_ligacoes_diarias", String(m.diaLigacoes));
  } catch {
    /* ignora */
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("arena_metas" as any).upsert({ user_id: user.id, metas: m, updated_at: new Date().toISOString() } as any, { onConflict: "user_id" });
  window.dispatchEvent(new CustomEvent("inmovya-metas-salvas", { detail: m }));
}

export function DefinirMetasDialog({ open, onOpenChange, onSalvo }: { open: boolean; onOpenChange: (v: boolean) => void; onSalvo?: (m: Metas) => void }) {
  const { toast } = useToast();
  const [m, setM] = useState<Metas | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setM(lerMetasLocal());
    carregarMetas().then(setM);
  }, [open]);

  const salvar = async () => {
    if (!m) return;
    setSalvando(true);
    try {
      await salvarMetas(m);
      onSalvo?.(m);
      toast({ title: "Metas salvas" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Não consegui salvar as metas", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Definir metas</DialogTitle>
          <DialogDescription>
            As do mês aparecem quebradas por dia ({diasUteisDoMes()} dias úteis neste mês, segunda a sábado). Leads = ligações classificadas como Cliente
            Interessado.
          </DialogDescription>
        </DialogHeader>
        {m && (
          <div className="grid gap-2">
            {CAMPOS_METAS.map(([k, rot, quando]) => (
              <label key={k} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className="flex-1 text-sm font-semibold">
                  {rot} <span className="font-normal text-muted-foreground">{quando}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {String(k).startsWith("mes")
                      ? `≈ ${metaPorDia(m[k])}`
                      : `≈ ${(m[k] * diasUteisDoMes()).toLocaleString("pt-BR")} no mês`}
                  </span>
                </span>
                <Input
                  type="number"
                  min={0}
                  className="w-24 text-right"
                  value={m[k]}
                  onChange={(e) => setM({ ...m, [k]: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!m || salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
