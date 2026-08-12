import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLeads } from "@/context/LeadsContext";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  Plus,
  Send,
  User,
  Building,
  Trash2,
  AlertTriangle
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'status_change';
  title: string;
  description: string;
  created_at: string;
  author: string;
  metadata?: {
    duration?: string;
    outcome?: string;
    previousStatus?: string;
    newStatus?: string;
    task_date?: string;
    task_id?: string;
    taskStatus?: string;
  };
}

interface LeadTimelineProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadTimeline({ leadId, isOpen, onClose }: LeadTimelineProps) {
  const [newNote, setNewNote] = useState("");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { getLeadById } = useLeads();

  const lead = leadId ? getLeadById(leadId) : null;

  // Carregar eventos da timeline do lead
  useEffect(() => {
    if (!lead?.id || !isOpen) return;

    const loadTimelineEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('lead_timeline')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch associated tasks to get their status
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('lead_id', lead.id);

        const taskStatusMap: Record<string, string> = {};
        if (tasksData) {
          tasksData.forEach(task => {
            taskStatusMap[task.id] = task.status;
          });
        }

        const timelineEvents: TimelineEvent[] = (data || []).map(item => {
          const metadata = item.metadata as TimelineEvent['metadata'] || {};
          // Inject current task status if this event is linked to a task
          if (metadata.task_id && taskStatusMap[metadata.task_id]) {
            metadata.taskStatus = taskStatusMap[metadata.task_id];
          }

          return {
            id: item.id,
            type: item.type as TimelineEvent['type'],
            title: item.title,
            description: item.description || '',
            created_at: item.created_at,
            author: item.author,
            metadata: metadata
          };
        });

        // REMOVED: Auto-sync logic caused deleted notes to reappear.
        // Legacy 'observacoes' should be manually managed or migrated once, not synchronized on every view.

        setEvents(timelineEvents);
      } catch (error) {
        console.error('Erro ao carregar timeline:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o histórico do lead.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTimelineEvents();

    const handleRefresh = () => loadTimelineEvents();
    window.addEventListener('refreshLeads', handleRefresh);

    return () => {
      window.removeEventListener('refreshLeads', handleRefresh);
    };
  }, [lead?.id, isOpen, toast]); // Dependency on lead.id handles updates if lead changes

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'note': return <MessageSquare className="w-4 h-4" />;
      case 'status_change': return <User className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-primary';
      case 'email': return 'bg-accent';
      case 'meeting': return 'bg-success';
      case 'note': return 'bg-muted';
      case 'status_change': return 'bg-warning';
      default: return 'bg-muted';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead?.id) return;

    try {
      const { data, error } = await supabase
        .from('lead_timeline')
        .insert({
          lead_id: lead.id,
          type: 'note',
          title: 'Nova anotação',
          description: newNote.trim(),
          author: 'Usuário' // TODO: Pegar do contexto de autenticação
        })
        .select()
        .single();

      if (error) throw error;

      const newEvent: TimelineEvent = {
        id: data.id,
        type: data.type as TimelineEvent['type'],
        title: data.title,
        description: data.description || '',
        created_at: data.created_at,
        author: data.author,
        metadata: data.metadata as TimelineEvent['metadata']
      };

      setEvents(prev => [newEvent, ...prev]);
      setNewNote("");

      toast({
        title: "Nota adicionada",
        description: "Nova anotação foi registrada na timeline do cliente.",
      });
    } catch (error) {
      console.error('Erro ao adicionar nota:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a anotação.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('lead_timeline')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      setEvents(prev => prev.filter(event => event.id !== eventId));
      toast({
        title: "Evento removido",
        description: "O evento foi excluído do histórico do cliente.",
      });
    } catch (error) {
      console.error('Erro ao deletar evento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o evento.",
        variant: "destructive",
      });
    }
  };

  const handleClearAllHistory = async () => {
    if (!lead?.id) return;

    try {
      const { error } = await supabase
        .from('lead_timeline')
        .delete()
        .eq('lead_id', lead.id);

      if (error) throw error;

      setEvents([]);
      toast({
        title: "Histórico limpo",
        description: "Todo o histórico do cliente foi removido.",
      });
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      toast({
        title: "Erro",
        description: "Não foi possível limpar o histórico do cliente.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timeline - {lead.nome}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {lead.interesse} • {lead.telefone}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Adicionar nova nota */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="font-medium">Adicionar nova anotação</span>
            </div>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Digite sua anotação sobre este cliente..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button onClick={handleAddNote} size="sm">
                <Send className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setNewNote("")}>
                Limpar
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border"></div>

            <div className="space-y-6">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum evento no histórico</p>
                </div>
              ) : (
                events.map((event, index) => {
                  // Always use created_at for display (when the event was actually created)
                  // task_date is for scheduled tasks, not for timeline display
                  const { date, time } = formatTimestamp(event.created_at);

                  console.log(`📅 ${event.title}: ${date} ${time} (created_at: ${event.created_at})`);

                  return (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className={`w-12 h-12 rounded-full ${getEventColor(event.type)} flex items-center justify-center text-white flex-shrink-0 relative z-10`}>
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-card rounded-lg border p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-medium text-foreground ${event.metadata?.taskStatus === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                {event.title}
                              </h4>
                              {event.metadata?.taskStatus === 'completed' && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                  Feito
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                                <div>{date}</div>
                                <div>{time}</div>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="w-5 h-5 text-destructive" />
                                      Excluir evento
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir este evento do histórico? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteEvent(event.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {event.description}
                          </p>

                          {/* Metadata */}
                          {event.metadata && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {event.metadata.duration && (
                                <Badge variant="secondary" className="text-xs">
                                  Duração: {event.metadata.duration}
                                </Badge>
                              )}
                              {event.metadata.outcome && (
                                <Badge variant="secondary" className="text-xs">
                                  Resultado: {event.metadata.outcome}
                                </Badge>
                              )}
                              {event.metadata.previousStatus && event.metadata.newStatus && (
                                <Badge variant="secondary" className="text-xs">
                                  {event.metadata.previousStatus} → {event.metadata.newStatus}
                                </Badge>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            Por: {event.author}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-2 pt-4 border-t">
          {events.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Limpar Histórico
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Limpar todo o histórico
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir todo o histórico deste cliente? Esta ação removerá todos os eventos e não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllHistory}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Limpar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={onClose} className="flex-1">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}