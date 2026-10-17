import { useEffect, useMemo, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  parseISO,
  addDays,
  startOfDay,
  isToday,
  isTomorrow,
  isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Pencil, User, CalendarDays, List, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AgendaTaskDialog } from "@/components/dialogs/AgendaTaskDialog";
import { useLeads } from "@/context/LeadsContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  lead_id: string | null;
}

const feito = (t: Task) => t.status === "completed";

/** Nome do dia como as pessoas falam: Hoje, Amanhã, "sexta, 20 de out." */
const nomeDoDia = (d: Date) => {
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEEE, d 'de' MMM", { locale: ptBR });
};

export function AgendaModule({ initialTaskId }: { initialTaskId?: string }) {
  const [mes, setMes] = useState(new Date());
  const [diaEscolhido, setDiaEscolhido] = useState<Date>(new Date());
  const [visao, setVisao] = useState<"lista" | "mes">(() => {
    try {
      return (localStorage.getItem("inmovya_agenda_visao") as "lista" | "mes") || "lista";
    } catch {
      return "lista";
    }
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [atrasados, setAtrasados] = useState<Task[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dataNova, setDataNova] = useState<Date>(new Date());
  const [paraExcluir, setParaExcluir] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<Task | null>(null);
  const [inicialFeito, setInicialFeito] = useState(false);
  const [verFeitos, setVerFeitos] = useState(false);

  const { toast } = useToast();
  const { leads } = useLeads();

  const mudarVisao = (v: "lista" | "mes") => {
    setVisao(v);
    try {
      localStorage.setItem("inmovya_agenda_visao", v);
    } catch {
      /* ignore */
    }
  };

  const carregar = async () => {
    setCarregando(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const inicio = startOfWeek(startOfMonth(mes), { locale: ptBR });
      const fim = endOfWeek(endOfMonth(mes), { locale: ptBR });
      const hoje = startOfDay(new Date());
      const [doMes, pendentes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .gte("due_date", inicio.toISOString())
          .lte("due_date", fim.toISOString())
          .order("due_date", { ascending: true }),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .neq("status", "completed")
          .lt("due_date", hoje.toISOString())
          .order("due_date", { ascending: true })
          .limit(100),
      ]);
      if (doMes.error) throw doMes.error;
      setTasks((doMes.data as Task[]) || []);
      setAtrasados((pendentes.data as Task[]) || []);
    } catch (error) {
      console.error("Erro ao carregar a agenda:", error);
      toast({ title: "Não consegui carregar a agenda", description: "Confira a internet e tente de novo.", variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  useEffect(() => {
    if (initialTaskId && !inicialFeito && tasks.length > 0) {
      const t = [...tasks, ...atrasados].find((x) => x.id === initialTaskId);
      if (t) {
        setEmEdicao(t);
        setDialogAberto(true);
        setInicialFeito(true);
      }
    }
  }, [initialTaskId, tasks, atrasados, inicialFeito]);

  const alternarFeito = async (task: Task) => {
    const novo = feito(task) ? "pending" : "completed";
    const atualizar = (lista: Task[]) => lista.map((t) => (t.id === task.id ? { ...t, status: novo } : t));
    setTasks(atualizar);
    setAtrasados((l) => (novo === "completed" ? l.filter((t) => t.id !== task.id) : atualizar(l)));
    const { error } = await supabase.from("tasks").update({ status: novo }).eq("id", task.id);
    if (error) {
      toast({ title: "Não consegui atualizar", description: error.message, variant: "destructive" });
      carregar();
    } else toast({ title: novo === "completed" ? "Compromisso concluído" : "Compromisso reaberto" });
  };

  const excluir = async () => {
    if (!paraExcluir) return;
    const { error } = await supabase.from("tasks").delete().eq("id", paraExcluir);
    if (error) toast({ title: "Não consegui excluir", description: error.message, variant: "destructive" });
    else {
      setTasks((l) => l.filter((t) => t.id !== paraExcluir));
      setAtrasados((l) => l.filter((t) => t.id !== paraExcluir));
      toast({ title: "Compromisso excluído" });
    }
    setParaExcluir(null);
  };

  const novo = (dia: Date) => {
    setEmEdicao(null);
    setDataNova(dia);
    setDialogAberto(true);
  };
  const editar = (t: Task) => {
    setEmEdicao(t);
    setDialogAberto(true);
  };

  const nomeLead = (id: string | null) => (id ? leads.find((l) => l.id === id)?.nome || "Lead" : null);

  // dias com compromisso no mês (para os pontinhos do calendário)
  const porDia = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const k = format(parseISO(t.due_date), "yyyy-MM-dd");
      m.set(k, [...(m.get(k) || []), t]);
    });
    return m;
  }, [tasks]);
  const doDia = (d: Date) => porDia.get(format(d, "yyyy-MM-dd")) || [];

  // Lista: do dia escolhido em diante (no mês exibido), agrupada por dia
  const grupos = useMemo(() => {
    const base = startOfDay(diaEscolhido);
    const m = new Map<string, { dia: Date; itens: Task[] }>();
    tasks
      .filter((t) => !isBefore(parseISO(t.due_date), base))
      .filter((t) => verFeitos || !feito(t))
      .forEach((t) => {
        const d = startOfDay(parseISO(t.due_date));
        const k = d.toISOString();
        if (!m.has(k)) m.set(k, { dia: d, itens: [] });
        m.get(k)!.itens.push(t);
      });
    return Array.from(m.values());
  }, [tasks, diaEscolhido, verFeitos]);

  const pendentesHoje = doDia(new Date()).filter((t) => !feito(t)).length;

  const Item = ({ t, compacto = false }: { t: Task; compacto?: boolean }) => {
    const lead = nomeLead(t.lead_id);
    const ok = feito(t);
    return (
      <div
        className={`group flex items-start gap-3 rounded-xl px-3 ${compacto ? "py-2" : "py-2.5"} hover:bg-muted/70 transition-colors cursor-pointer`}
        onClick={() => editar(t)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alternarFeito(t);
          }}
          aria-label={ok ? "Reabrir" : "Concluir"}
          title={ok ? "Reabrir" : "Concluir"}
          className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
            ok ? "bg-success border-success text-success-foreground" : "border-muted-foreground/40 hover:border-success"
          }`}
        >
          {ok && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>
        <div className="w-12 shrink-0 text-sm font-bold tabular-nums text-primary pt-px">{format(parseISO(t.due_date), "HH:mm")}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold leading-snug ${ok ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
          {lead && (
            <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <User className="w-3 h-3" /> {lead}
            </div>
          )}
          {!compacto && t.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</div>}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              editar(t);
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-destructive"
            title="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              setParaExcluir(t.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  // calendário (usado pequeno ao lado da lista e grande na visão do mês)
  const diasDoCalendario = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mes), { locale: ptBR });
    const fim = endOfWeek(endOfMonth(mes), { locale: ptBR });
    const out: Date[] = [];
    for (let d = ini; d <= fim; d = addDays(d, 1)) out.push(d);
    return out;
  }, [mes]);
  const semana = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(new Date(), { locale: ptBR }), i), "EEEEEE", { locale: ptBR }));

  const MiniCalendario = () => (
    <div>
      <div className="grid grid-cols-7 text-[11px] text-muted-foreground font-semibold mb-1">
        {semana.map((s, i) => (
          <div key={i} className="text-center py-1 capitalize">
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {diasDoCalendario.map((d) => {
          const itens = doDia(d);
          const pend = itens.filter((t) => !feito(t)).length;
          const sel = isSameDay(d, diaEscolhido);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setDiaEscolhido(d)}
              className={`relative h-9 rounded-lg text-sm tabular-nums transition-colors ${
                sel ? "bg-primary text-primary-foreground font-bold" : isToday(d) ? "text-primary font-bold hover:bg-muted" : isSameMonth(d, mes) ? "hover:bg-muted" : "text-muted-foreground/50 hover:bg-muted"
              }`}
            >
              {format(d, "d")}
              {itens.length > 0 && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${sel ? "bg-primary-foreground" : pend ? "bg-success" : "bg-muted-foreground/50"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const titulo = format(mes, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="max-w-6xl mx-auto">
      {/* barra de controle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMes(subMonths(mes, 1))} aria-label="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight capitalize min-w-[11ch] text-center">{titulo}</h2>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMes(addMonths(mes, 1))} aria-label="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              setMes(new Date());
              setDiaEscolhido(new Date());
            }}
          >
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-card p-0.5">
            <button
              type="button"
              onClick={() => mudarVisao("lista")}
              className={`px-3 h-8 rounded-md text-sm font-semibold inline-flex items-center gap-1.5 ${visao === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" /> Lista
            </button>
            <button
              type="button"
              onClick={() => mudarVisao("mes")}
              className={`px-3 h-8 rounded-md text-sm font-semibold inline-flex items-center gap-1.5 ${visao === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarDays className="w-4 h-4" /> Mês
            </button>
          </div>
          <Button className="h-9" onClick={() => novo(diaEscolhido)}>
            <Plus className="w-4 h-4 mr-1" /> Novo compromisso
          </Button>
        </div>
      </div>

      {visao === "lista" ? (
        <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            {atrasados.length > 0 && (
              <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-2">
                <h3 className="px-3 pt-2 pb-1 text-sm font-bold text-destructive inline-flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {atrasados.length} atrasado{atrasados.length > 1 ? "s" : ""}
                </h3>
                {atrasados.map((t) => (
                  <div key={t.id}>
                    <div className="px-3 pt-1 text-[11px] text-muted-foreground">{format(parseISO(t.due_date), "dd/MM")}</div>
                    <Item t={t} compacto />
                  </div>
                ))}
              </section>
            )}

            {carregando ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : grupos.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold">Nada marcado a partir de {nomeDoDia(diaEscolhido).toLowerCase()}</p>
                <p className="text-sm text-muted-foreground mt-1">Marque uma visita, ligação ou retorno para um lead.</p>
                <Button className="mt-4" onClick={() => novo(diaEscolhido)}>
                  <Plus className="w-4 h-4 mr-1" /> Novo compromisso
                </Button>
              </div>
            ) : (
              grupos.map((g) => (
                <section key={g.dia.toISOString()} className="rounded-2xl border bg-card p-2 shadow-card">
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <h3 className={`text-sm font-bold capitalize ${isToday(g.dia) ? "text-primary" : ""}`}>{nomeDoDia(g.dia)}</h3>
                    <button type="button" onClick={() => novo(g.dia)} className="text-muted-foreground hover:text-foreground" title="Novo neste dia">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {g.itens.map((t) => (
                    <Item key={t.id} t={t} />
                  ))}
                </section>
              ))
            )}
          </div>

          <aside className="rounded-2xl border bg-card p-4 shadow-card lg:sticky lg:top-4">
            <MiniCalendario />
            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hoje</span>
                <span className="font-bold tabular-nums">{pendentesHoje} pendente{pendentesHoje === 1 ? "" : "s"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Atrasados</span>
                <span className={`font-bold tabular-nums ${atrasados.length ? "text-destructive" : ""}`}>{atrasados.length}</span>
              </div>
              <label className="flex items-center gap-2 pt-1 text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={verFeitos} onChange={(e) => setVerFeitos(e.target.checked)} />
                Mostrar concluídos
              </label>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {semana.map((s, i) => (
              <div key={i} className="text-center py-2 text-xs font-semibold text-muted-foreground capitalize">
                {s}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {diasDoCalendario.map((d) => {
              const itens = doDia(d);
              const fora = !isSameMonth(d, mes);
              return (
                <div
                  key={d.toISOString()}
                  className={`min-h-[104px] border-b border-r p-1.5 cursor-pointer transition-colors hover:bg-muted/50 ${fora ? "bg-muted/25" : ""}`}
                  onClick={() => {
                    setDiaEscolhido(d);
                    mudarVisao("lista");
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs font-bold tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday(d) ? "bg-primary text-primary-foreground" : fora ? "text-muted-foreground/50" : ""
                      }`}
                    >
                      {format(d, "d")}
                    </span>
                    <button
                      type="button"
                      className="opacity-0 hover:opacity-100 focus:opacity-100 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        novo(d);
                      }}
                      title="Novo neste dia"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {itens.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          editar(t);
                        }}
                        className={`w-full text-left truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                          feito(t) ? "text-muted-foreground line-through" : "bg-primary/10 text-primary"
                        }`}
                        title={`${format(parseISO(t.due_date), "HH:mm")} ${t.title}`}
                      >
                        <span className="tabular-nums font-bold">{format(parseISO(t.due_date), "HH:mm")}</span> {t.title}
                      </button>
                    ))}
                    {itens.length > 3 && <div className="text-[11px] text-muted-foreground px-1.5">+{itens.length - 3} mais</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AgendaTaskDialog
        isOpen={dialogAberto}
        onClose={() => {
          setDialogAberto(false);
          setEmEdicao(null);
        }}
        onSuccess={carregar}
        selectedDate={dataNova}
        taskToEdit={emEdicao}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
            <AlertDialogDescription>Ele sai da sua agenda e não volta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
