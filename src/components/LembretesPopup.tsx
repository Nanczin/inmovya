import { useEffect, useState } from "react";
import { BellRing, Check, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

// Pop-up "Você tem algo para fazer agora": abre na tela quando um lembrete/compromisso da agenda vence.
// Quem descobre os lembretes vencidos é o TaskNotificationPoller (que também põe o aviso no sininho);
// ele avisa este pop-up pelo evento "inmovya-lembrete-popup".

export interface LembreteVencido {
  id: string;
  titulo: string;
  descricao?: string | null;
  leadId?: string | null;
  leadNome?: string | null;
  vence: string; // ISO
}

export const EVENTO_LEMBRETE_POPUP = "inmovya-lembrete-popup";

export function mostrarLembretesNoPopup(itens: LembreteVencido[]) {
  if (!itens.length) return;
  window.dispatchEvent(new CustomEvent(EVENTO_LEMBRETE_POPUP, { detail: itens }));
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function tocarAviso() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.25].forEach((t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    /* navegador sem som liberado: só o pop-up */
  }
}

interface Props {
  onVerTarefa: (taskId: string) => void;
  onVerLead: (leadId: string) => void;
}

export function LembretesPopup({ onVerTarefa, onVerLead }: Props) {
  const [itens, setItens] = useState<LembreteVencido[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    const aoReceber = (e: Event) => {
      const novos = ((e as CustomEvent).detail || []) as LembreteVencido[];
      setItens((atual) => {
        const ids = new Set(atual.map((i) => i.id));
        const somar = novos.filter((n) => !ids.has(n.id));
        if (somar.length) tocarAviso();
        return [...atual, ...somar];
      });
    };
    window.addEventListener(EVENTO_LEMBRETE_POPUP, aoReceber);
    return () => window.removeEventListener(EVENTO_LEMBRETE_POPUP, aoReceber);
  }, []);

  const tirar = (id: string) => setItens((l) => l.filter((i) => i.id !== id));

  const concluir = async (item: LembreteVencido) => {
    setOcupado(item.id);
    const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", item.id);
    setOcupado(null);
    if (error) return toast({ title: "Não consegui concluir", description: error.message, variant: "destructive" });
    toast({ title: "Compromisso concluído" });
    tirar(item.id);
  };

  const adiar = async (item: LembreteVencido, minutos: number) => {
    setOcupado(item.id);
    const nova = new Date(Date.now() + minutos * 60000).toISOString();
    const { error } = await supabase.from("tasks").update({ due_date: nova }).eq("id", item.id);
    setOcupado(null);
    if (error) return toast({ title: "Não consegui adiar", description: error.message, variant: "destructive" });
    // deixa o lembrete avisar de novo no novo horário
    try {
      const avisados: string[] = JSON.parse(localStorage.getItem("notified_tasks") || "[]");
      localStorage.setItem("notified_tasks", JSON.stringify(avisados.filter((id) => id !== item.id)));
    } catch {
      /* sem localStorage */
    }
    toast({ title: `Adiado para ${hora(nova)}` });
    tirar(item.id);
  };

  const aberto = itens.length > 0;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && setItens([])}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {itens.length > 1 ? `Você tem ${itens.length} coisas para fazer agora` : "Você tem algo para fazer agora"}
          </DialogTitle>
          <DialogDescription>Chegou a hora deste{itens.length > 1 ? "s" : ""} compromisso{itens.length > 1 ? "s" : ""} da sua agenda.</DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {itens.map((item) => (
            <li key={item.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-snug break-words">{item.titulo}</p>
                  {item.leadNome && <p className="text-sm text-muted-foreground truncate">Lead: {item.leadNome}</p>}
                </div>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{hora(item.vence)}</span>
              </div>
              {item.descricao && <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">{item.descricao}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" disabled={ocupado === item.id} onClick={() => concluir(item)}>
                  <Check className="h-4 w-4 mr-1" /> Concluir
                </Button>
                <Button size="sm" variant="outline" disabled={ocupado === item.id} onClick={() => adiar(item, 10)}>
                  <Clock className="h-4 w-4 mr-1" /> Adiar 10 min
                </Button>
                <Button size="sm" variant="outline" disabled={ocupado === item.id} onClick={() => adiar(item, 60)}>
                  1 h
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    tirar(item.id);
                    if (item.leadId) onVerLead(item.leadId);
                    else onVerTarefa(item.id);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> {item.leadId ? "Abrir lead" : "Ver"}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={() => setItens([])}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
