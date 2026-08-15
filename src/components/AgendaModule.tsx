import { useState, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, parseISO, addDays, startOfDay, endOfDay, addWeeks, subWeeks, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CheckCircle2, Clock, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AgendaTaskDialog } from "@/components/dialogs/AgendaTaskDialog";
import { useLeads } from "@/context/LeadsContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function AgendaModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  
  const { toast } = useToast();
  const { leads } = useLeads();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let startDate, endDate;
      
      if (view === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        startDate = startOfWeek(monthStart);
        endDate = endOfWeek(monthEnd);
      } else if (view === 'week') {
        startDate = startOfWeek(currentDate, { locale: ptBR });
        endDate = endOfWeek(currentDate, { locale: ptBR });
      } else {
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
      }

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('due_date', startDate.toISOString())
        .lte('due_date', endDate.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os compromissos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentDate, view]);

  const toggleTaskStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;
      
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      
      toast({
        title: newStatus === 'completed' ? "Tarefa concluída" : "Tarefa reaberta",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tarefa.",
        variant: "destructive"
      });
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
      toast({
        title: "Excluído",
        description: "Compromisso excluído com sucesso."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir.",
        variant: "destructive"
      });
    } finally {
      setTaskToDelete(null);
    }
  };

  const nextDate = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const prevDate = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const today = () => setCurrentDate(new Date());

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsDialogOpen(true);
  };

  const getLeadName = (leadId: string | null) => {
    if (!leadId) return null;
    const lead = leads.find(l => l.id === leadId);
    return lead ? lead.nome : "Lead Desconhecido";
  };

  const renderTaskItem = (task: Task, isLarge = false) => {
    const isCompleted = task.status === 'completed';
    const leadName = getLeadName(task.lead_id);
    const taskTime = format(parseISO(task.due_date), "HH:mm");

    const content = (
      <div 
        className={`text-xs p-1.5 rounded border flex ${isLarge ? 'flex-row p-4' : 'items-start'} justify-between gap-1 group/item cursor-pointer hover:brightness-95 transition-all ${
          isCompleted 
            ? "bg-muted border-transparent text-muted-foreground" 
            : task.lead_id 
              ? "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300" 
              : "bg-orange-50 border-orange-100 text-orange-700 dark:bg-orange-950 dark:border-orange-900 dark:text-orange-300"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setTaskToEdit(task);
          setIsDialogOpen(true);
        }}
      >
        <div className="flex-1 truncate">
          <div className={`flex items-center gap-2 ${isLarge ? 'mb-1 text-sm' : ''}`}>
             <span className="font-semibold">{taskTime}</span>
             <span className={`${isCompleted ? "line-through" : ""} font-medium truncate`}>
               {task.title}
             </span>
          </div>
          {leadName && (
            <div className={`${isLarge ? 'text-xs mt-1' : 'text-[10px]'} opacity-80 truncate`}>
              {leadName}
            </div>
          )}
          {isLarge && task.description && (
            <div className="text-xs mt-2 opacity-70 whitespace-pre-wrap">
              {task.description}
            </div>
          )}
        </div>
        <div className={`flex items-center ${!isLarge ? 'opacity-0 group-hover/item:opacity-100' : ''} transition-opacity gap-1`}>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`${isLarge ? 'h-8 w-8' : 'h-5 w-5'} hover:bg-background/50 text-blue-500 hover:text-blue-600`}
            onClick={(e) => {
              e.stopPropagation();
              setTaskToEdit(task);
              setIsDialogOpen(true);
            }}
            title="Editar"
          >
            <Pencil className={`${isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`${isLarge ? 'h-8 w-8' : 'h-5 w-5'} hover:bg-background/50`}
            onClick={(e) => toggleTaskStatus(task, e)}
            title={isCompleted ? "Reabrir" : "Concluir"}
          >
            <CheckCircle2 className={`${isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'} ${isCompleted ? 'text-green-500' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`${isLarge ? 'h-8 w-8' : 'h-5 w-5'} hover:bg-destructive/10 hover:text-destructive`}
            onClick={(e) => {
              e.stopPropagation();
              setTaskToDelete(task.id);
            }}
            title="Excluir"
          >
            <Trash2 className={`${isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />
          </Button>
        </div>
      </div>
    );

    if (isLarge) {
      return <div key={task.id}>{content}</div>;
    }

    return (
      <Tooltip key={task.id}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-semibold">{task.title}</p>
            <p className="text-muted-foreground">{format(parseISO(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            {leadName && <p className="text-xs mt-1 text-blue-500">Lead: {leadName}</p>}
            {task.description && <p className="text-xs mt-2 italic max-w-[200px] break-words">{task.description}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold capitalize">
            {view === 'day' 
              ? format(currentDate, "dd 'de' MMMM yyyy", { locale: ptBR })
              : view === 'week'
                ? `Semana de ${format(startOfWeek(currentDate, { locale: ptBR }), "dd/MM")} a ${format(endOfWeek(currentDate, { locale: ptBR }), "dd/MM")}`
                : format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={prevDate}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={today}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={nextDate}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[300px]">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => handleDayClick(new Date())}>
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate, { locale: ptBR });

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-medium text-sm py-2 text-muted-foreground uppercase">
          {format(addMonths(startDate, i), "EEEE", { locale: ptBR }).split('-')[0]}
        </div>
      );
    }
    return <div className="grid grid-cols-7 border-b">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        
        // Find tasks for this day
        const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), cloneDay));

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[120px] p-2 border-b border-r relative group transition-colors hover:bg-muted/30 cursor-pointer ${
              !isSameMonth(day, monthStart)
                ? "bg-muted/10 text-muted-foreground"
                : isSameDay(day, new Date())
                ? "bg-primary/5"
                : "bg-background"
            }`}
            onClick={() => handleDayClick(cloneDay)}
          >
            <div className="flex justify-between items-start mb-1">
              <span
                className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                  isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {formattedDate}
              </span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-[80px] w-full">
              <div className="flex flex-col gap-1 pb-2">
                <TooltipProvider>
                  {dayTasks.map(task => {
                    const isCompleted = task.status === 'completed';
                    const leadName = getLeadName(task.lead_id);
                    const taskTime = format(parseISO(task.due_date), "HH:mm");
                    
                    return (
                      <Tooltip key={task.id}>
                        <TooltipTrigger asChild>
                          <div 
                            className={`text-xs p-1.5 rounded border flex items-start justify-between gap-1 group/item ${
                              isCompleted 
                                ? "bg-muted border-transparent text-muted-foreground" 
                                : task.lead_id 
                                  ? "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300" 
                                  : "bg-orange-50 border-orange-100 text-orange-700 dark:bg-orange-950 dark:border-orange-900 dark:text-orange-300"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Could open view/edit modal here
                            }}
                          >
                            <div className="flex-1 truncate">
                              <span className="font-semibold mr-1">{taskTime}</span>
                              <span className={isCompleted ? "line-through" : ""}>
                                {task.title}
                              </span>
                              {leadName && (
                                <div className="text-[10px] opacity-80 truncate">
                                  {leadName}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 hover:bg-background/50"
                                onClick={(e) => toggleTaskStatus(task, e)}
                              >
                                <CheckCircle2 className={`h-3.5 w-3.5 ${isCompleted ? 'text-green-500' : ''}`} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTaskToDelete(task.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-semibold">{task.title}</p>
                            <p className="text-muted-foreground">{format(parseISO(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            {leadName && <p className="text-xs mt-1 text-blue-500">Lead: {leadName}</p>}
                            {task.description && <p className="text-xs mt-2 italic max-w-[200px] break-words">{task.description}</p>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </ScrollArea>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 border-l" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="flex flex-col border-t">{rows}</div>;
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate, { locale: ptBR });
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDate, i));
    }

    return (
      <div className="flex flex-col">
        <div className="grid grid-cols-7 border-b">
          {days.map((day, i) => (
            <div key={i} className="text-center font-medium text-sm py-2 text-muted-foreground uppercase border-r">
              {format(day, "EEEE", { locale: ptBR }).split('-')[0]}
              <div className={`text-xl mt-1 ${isSameDay(day, new Date()) ? "text-primary font-bold" : "text-foreground"}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[500px]">
          {days.map((day, i) => {
            const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), day));
            return (
              <div 
                key={i} 
                className={`p-2 border-r relative group transition-colors hover:bg-muted/30 cursor-pointer ${isSameDay(day, new Date()) ? "bg-primary/5" : "bg-background"}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 mt-8">
                  <TooltipProvider>
                    {dayTasks.map(task => renderTaskItem(task))}
                  </TooltipProvider>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), currentDate));
    return (
      <div className="min-h-[500px] p-6 bg-background rounded-md border">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-muted-foreground">Compromissos do dia</h3>
          <Button variant="outline" onClick={() => handleDayClick(currentDate)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar neste dia
          </Button>
        </div>
        {dayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
            <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
            <p>Nenhum compromisso para este dia.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            {dayTasks.map(task => renderTaskItem(task, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 p-8 pt-6 h-screen overflow-y-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Agenda
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus compromissos e lembretes de leads
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-muted/60">
        <CardContent className="p-6">
          {renderHeader()}
          <div className="rounded-md border bg-card">
            {view === 'month' && renderDays()}
            {loading ? (
              <div className="min-h-[500px] flex items-center justify-center text-muted-foreground">
                <div className="flex items-center gap-2 animate-pulse">
                  <Clock className="h-5 w-5" />
                  Carregando agenda...
                </div>
              </div>
            ) : (
              <>
                {view === 'month' && renderCells()}
                {view === 'week' && renderWeekView()}
                {view === 'day' && renderDayView()}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <AgendaTaskDialog 
        isOpen={isDialogOpen} 
        onClose={() => { setIsDialogOpen(false); setTaskToEdit(null); }} 
        onSuccess={fetchTasks}
        selectedDate={selectedDate}
        taskToEdit={taskToEdit}
      />

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este compromisso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
