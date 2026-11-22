// Painel de um compromisso com vários leads nas observações
// (ex.: "Esteira 20% - follow-up: Sandro, Sebastião André, Alexandre Queiroz").
// Cada lead reconhecido vira um botão que abre o WhatsApp dele, com "feito" ao lado.
// Quando todos estiverem feitos, o compromisso é concluído sozinho.
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Check, ExternalLink, MessageCircle, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LeadAchado } from "@/lib/agendaIrPara";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  quando: string;
  descricao?: string | null;
  achados: LeadAchado[];
  feitos: string[];
  concluido: boolean;
  destino?: { nome: string; icone: ReactNode } | null;
  onIrPara?: () => void;
  onWhatsApp: (lead: LeadAchado) => void;
  onAlternarFeito: (leadId: string) => void;
  onEditar: () => void;
};

const final = (tel?: string) => {
  const d = String(tel || "").replace(/\D/g, "");
  return d ? `…${d.slice(-4)}` : "sem telefone";
};

export function CompromissoLeads({ aberto, onFechar, titulo, quando, descricao, achados, feitos, concluido, destino, onIrPara, onWhatsApp, onAlternarFeito, onEditar }: Props) {
  const nFeitos = achados.filter((a) => feitos.includes(a.id)).length;
  const pct = achados.length ? Math.round((nFeitos / achados.length) * 100) : 0;
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={concluido ? "line-through text-muted-foreground" : ""}>{titulo}</DialogTitle>
          <DialogDescription>{format(parseISO(quando), "dd/MM 'às' HH:mm")} · {achados.length} leads reconhecidos nas observações</DialogDescription>
        </DialogHeader>

        {destino && onIrPara && (
          <Button className="w-full h-11 justify-center" onClick={onIrPara}>
            {destino.icone} <span className="ml-2">Ir para: {destino.nome}</span>
            <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
          </Button>
        )}

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {nFeitos} de {achados.length} feitos
            </span>
            {concluido && <span className="font-semibold text-success">Compromisso concluído</span>}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <ul className="grid gap-1.5">
          {achados.map((a) => {
            const ok = feitos.includes(a.id);
            return (
              <li key={a.id} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${ok ? "bg-muted/40" : "bg-card"}`}>
                <button
                  type="button"
                  onClick={() => onAlternarFeito(a.id)}
                  aria-label={ok ? `Desmarcar ${a.nome}` : `Marcar ${a.nome} como feito`}
                  title={ok ? "Desmarcar" : "Marcar como feito"}
                  className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                    ok ? "bg-success border-success text-success-foreground" : "border-muted-foreground/40 hover:border-success"
                  }`}
                >
                  {ok && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
                <button
                  type="button"
                  onClick={() => onWhatsApp(a)}
                  className="flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-success/10 transition-colors"
                  title="Abrir o WhatsApp deste lead"
                >
                  <MessageCircle className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                  <span className={`text-sm font-semibold truncate ${ok ? "line-through text-muted-foreground" : ""}`}>{a.nome}</span>
                  {a.repetido && <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{final(a.telefone)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {achados.some((a) => a.repetido) && (
          <p className="text-[11px] text-muted-foreground">Nomes iguais aparecem com o final do telefone: abra o certo.</p>
        )}

        {descricao && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Ver observações</summary>
            <div className="mt-1.5 whitespace-pre-wrap rounded-md border bg-muted/30 p-2">{descricao}</div>
          </details>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onEditar}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar compromisso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
