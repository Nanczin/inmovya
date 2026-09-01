import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TaskViewDialogProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskViewDialog({ taskId, onClose }: TaskViewDialogProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    const fetchTask = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle();

        if (error) throw error;
        if (data) setTask(data);
      } catch (err) {
        console.error("Error fetching task:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  return (
    <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        {loading ? (
          <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : task ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <CalendarPlus className="w-5 h-5" />
                {task.title}
              </DialogTitle>
              <DialogDescription>
                Agendado para: {new Date(task.due_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-md border">
              {task.description || "Nenhuma descrição informada para este lembrete."}
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-muted-foreground">Tarefa não encontrada.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
