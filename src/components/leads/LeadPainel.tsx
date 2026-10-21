import { useEffect, useState } from "react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Phone, Mail, Building2, CalendarClock, History, Plus, ExternalLink, Tag, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeads, Lead } from "@/context/LeadsContext";
import { NEGOCIO_STAGES, getStageForStatus } from "@/lib/negociosStages";
import { empreendimentoDoLead, tirarDaEsteira } from "@/lib/esteiras";
import { TaskDialog } from "@/components/dialogs/TaskDialog";
import { LeadTimeline } from "@/components/LeadTimeline";

interface Props {
  leadId: string | null;
  onClose: () => void;
  /** abre a ficha completa na aba Leads */
  onAbrirFicha?: (leadId: string) => void;
}

const whatsappDe = (tel?: string) => {
  const d = (tel || "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("55") && d.length > 11 ? d : `55${d}`;
};

/**
 * Ficha rápida do lead (painel lateral). Tudo vem do lead: dados, etapa, lembretes e observações.
 * Usada no Negócios para abrir o lead sem sair do quadro.
 */
export function LeadPainel({ leadId, onClose, onAbrirFicha }: Props) {
  const { getLeadById, updateLead, refreshLeads } = useLeads();
  const { toast } = useToast();
  const lead = leadId ? getLeadById(leadId) : undefined;
  const [obs, setObs] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [tarefaAberta, setTarefaAberta] = useState(false);
  const [historico, setHistorico] = useState(false);

  useEffect(() => {
    setObs(lead?.observacoes || "");
  }, [lead?.id, lead?.observacoes]);

  if (!lead) return null;

  const etapa = getStageForStatus(lead.status);
  const empreendimento = empreendimentoDoLead(lead.observacoes, lead.nome);
  const zap = whatsappDe(lead.telefone);
  const lembretes = [...(lead.tasks || [])].sort((a: any, b: any) => (a.due_date || "").localeCompare(b.due_date || ""));

  const mudarEtapa = async (value: string) => {
    const antes = lead.status;
    updateLead(lead.id, { status: value });
    const { error } = await supabase.from("leads").update({ status: value }).eq("id", lead.id);
    if (error) {
      updateLead(lead.id, { status: antes });
      toast({ title: "Não consegui mudar a etapa", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Etapa atualizada", description: `${lead.nome} → ${getStageForStatus(value)?.name || value}` });
      refreshLeads();
    }
  };

  // Tira do quadro de Negócios (e da esteira) e deixa só na base de leads, com a tag "base"
  const deixarNaBase = async () => {
    if (!window.confirm(`Tirar ${lead.nome || "este lead"} de Negócios e deixar só na base? Ele sai da esteira também. Para voltar, coloque numa etapa pela aba Leads ou por "Novo negócio".`)) return;
    const tags = Array.from(new Set([...(lead.tags || []), "base"]));
    const { error } = await supabase.from("leads").update({ status: "Nenhuma", tags } as any).eq("id", lead.id);
    if (error) {
      toast({ title: "Não consegui tirar de Negócios", description: error.message, variant: "destructive" });
      return;
    }
    await tirarDaEsteira([lead.id]).catch(() => {});
    toast({ title: "Lead só na base", description: `${lead.nome} saiu de Negócios. Continua na aba Leads.` });
    onClose();
    refreshLeads();
  };

  const salvarObs = async () => {
    if (obs === (lead.observacoes || "")) return;
    setSalvandoObs(true);
    const { error } = await supabase.from("leads").update({ observacoes: obs }).eq("id", lead.id);
    setSalvandoObs(false);
    if (error) toast({ title: "Não consegui salvar a observação", description: error.message, variant: "destructive" });
    else {
      updateLead(lead.id, { observacoes: obs });
      toast({ title: "Observação salva" });
    }
  };

  const linha = (Icon: typeof Phone, conteudo: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 break-words">{conteudo}</div>
    </div>
  );

  return (
    <>
      <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <div className="p-5 pb-4 border-b bg-gradient-to-b from-primary/[0.07] to-transparent">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-xl font-extrabold tracking-tight pr-6">{lead.nome || "Sem nome"}</SheetTitle>
              <SheetDescription className="text-sm">
                {empreendimento || "Buscando imóveis"}
                {lead.origem ? ` · veio de ${lead.origem}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap gap-2 mt-4">
              {zap && (
                <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => window.open(`https://wa.me/${zap}`, "_blank")}>
                  <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                </Button>
              )}
              {lead.telefone && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${lead.telefone}`}>
                    <Phone className="w-4 h-4 mr-1" /> Ligar
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setHistorico(true)}>
                <History className="w-4 h-4 mr-1" /> Histórico
              </Button>
              {onAbrirFicha && (
                <Button size="sm" variant="ghost" onClick={() => onAbrirFicha(lead.id)}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Ficha completa
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={deixarNaBase} title="Sai do quadro de Negócios e da esteira; continua na aba Leads">
                <Archive className="w-4 h-4 mr-1" /> Tirar de Negócios
              </Button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            <section>
              <label className="text-xs font-semibold text-muted-foreground">Etapa no Negócios</label>
              <Select value={etapa?.value || lead.status || ""} onValueChange={mudarEtapa}>
                <SelectTrigger className="mt-1.5 h-10 font-semibold">
                  <SelectValue placeholder="Sem etapa" />
                </SelectTrigger>
                <SelectContent className="max-h-[50vh]">
                  {NEGOCIO_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.value}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="divide-y">
              {lead.telefone && linha(Phone, <span className="tabular-nums">{lead.telefone}</span>)}
              {lead.email && linha(Mail, lead.email)}
              {empreendimento && linha(Building2, empreendimento)}
              {lead.created_at && linha(CalendarClock, <>Chegou em {format(parseISO(lead.created_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}</>)}
              {!!lead.tags?.length &&
                linha(
                  Tag,
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((t) => (
                      <span key={t} className="text-xs rounded-full bg-muted px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Lembretes</h3>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setTarefaAberta(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Novo
                </Button>
              </div>
              {lembretes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lembrete pendente.</p>
              ) : (
                <ul className="space-y-1.5">
                  {lembretes.map((t: any) => {
                    const atrasado = t.due_date && isBefore(parseISO(t.due_date), new Date());
                    return (
                      <li key={t.id} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="font-semibold">{t.title}</div>
                        {t.due_date && (
                          <div className={`text-xs tabular-nums ${atrasado ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {atrasado ? "Atrasado · " : ""}
                            {format(parseISO(t.due_date), "dd/MM 'às' HH:mm")}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-bold mb-2">Observações</h3>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} onBlur={salvarObs} rows={5} placeholder="Empreendimento, o que o lead busca, combinados…" />
              <p className="text-[11px] text-muted-foreground mt-1">{salvandoObs ? "Salvando…" : "Salva sozinho ao sair do campo."}</p>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {tarefaAberta && (
        <TaskDialog
          isOpen={tarefaAberta}
          onClose={() => {
            setTarefaAberta(false);
            refreshLeads();
          }}
          lead={lead}
        />
      )}
      <LeadTimeline leadId={historico ? lead.id : null} isOpen={historico} onClose={() => setHistorico(false)} />
    </>
  );
}

export type { Lead };
