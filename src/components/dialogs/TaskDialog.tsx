
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";

interface TaskDialogProps {
    isOpen: boolean;
    onClose: () => void;
    lead: any;
}

export function TaskDialog({ isOpen, onClose, lead }: TaskDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [time, setTime] = useState("09:00");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { addNotification } = useNotifications();

    const handleSave = async () => {
        if (!title || !date || !time) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha o título, data e hora.",
                variant: "destructive"
            });
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
                return;
            }

            // Combine date and time
            const dateTime = new Date(date);
            const [hours, minutes] = time.split(':').map(Number);
            dateTime.setHours(hours, minutes, 0, 0);

            const { data: taskData, error } = await supabase
                .from('tasks')
                .insert({
                    user_id: user.id,
                    lead_id: lead.id,
                    title,
                    description,
                    due_date: dateTime.toISOString(),
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Add to Lead Timeline
            await supabase
                .from('lead_timeline')
                .insert({
                    lead_id: lead.id,
                    type: 'note',
                    title: `Lembrete Agendado: ${title}`,
                    description: `Para ${format(dateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}.${description ? ' ' + description : ''}`,
                    author: 'Usuário',
                    metadata: {
                        task_date: dateTime.toISOString(),
                        task_id: taskData.id
                    }
                });

            toast({
                title: "Lembrete criado",
                description: `Lembrete agendado para ${format(dateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`
            });



            onClose();
            setTitle("");
            setDescription("");

        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao criar lembrete",
                description: "Ocorreu um erro ao salvar.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Criar Lembrete para {lead?.nome}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">Título</Label>
                        <Input
                            id="title"
                            placeholder="Ex: Ligar novamente"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Data</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "P", { locale: ptBR }) : <span>Selecione</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="time">Hora</Label>
                            <Input
                                id="time"
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Detalhes adicionais..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Lembrete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
