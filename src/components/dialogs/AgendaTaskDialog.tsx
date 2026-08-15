import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeads } from "@/context/LeadsContext";

interface AgendaTaskDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    selectedDate?: Date;
    taskToEdit?: {
        id: string;
        title: string;
        description: string;
        due_date: string;
        lead_id: string | null;
        status: string;
    } | null;
}

export function AgendaTaskDialog({ isOpen, onClose, onSuccess, selectedDate, taskToEdit }: AgendaTaskDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState<Date | undefined>(selectedDate || new Date());
    const [time, setTime] = useState("09:00");
    const [selectedLeadId, setSelectedLeadId] = useState<string>("none");
    const [loading, setLoading] = useState(false);
    
    const { toast } = useToast();
    const { leads } = useLeads();

    useEffect(() => {
        if (isOpen) {
            if (taskToEdit) {
                setTitle(taskToEdit.title);
                setDescription(taskToEdit.description || "");
                const taskDate = new Date(taskToEdit.due_date);
                setDate(taskDate);
                setTime(format(taskDate, "HH:mm"));
                setSelectedLeadId(taskToEdit.lead_id || "none");
            } else {
                setTitle("");
                setDescription("");
                setDate(selectedDate || new Date());
                setTime("09:00");
                setSelectedLeadId("none");
            }
        }
    }, [isOpen, taskToEdit, selectedDate]);

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

            const leadIdToSave = selectedLeadId === "none" ? null : selectedLeadId;

            if (taskToEdit) {
                const { error } = await supabase
                    .from('tasks')
                    .update({
                        user_id: user.id,
                        lead_id: leadIdToSave,
                        title,
                        description,
                        due_date: dateTime.toISOString(),
                    })
                    .eq('id', taskToEdit.id);

                if (error) throw error;
                
                toast({
                    title: "Compromisso atualizado",
                    description: `Agendado para ${format(dateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`
                });
            } else {
                const { data: taskData, error } = await supabase
                    .from('tasks')
                    .insert({
                        user_id: user.id,
                        lead_id: leadIdToSave,
                        title,
                        description,
                        due_date: dateTime.toISOString(),
                        status: 'pending'
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Add to Lead Timeline if a lead was selected
                if (leadIdToSave) {
                    await supabase
                        .from('lead_timeline')
                        .insert({
                            lead_id: leadIdToSave,
                            type: 'note',
                            title: `Lembrete Agendado: ${title}`,
                            description: `Para ${format(dateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}.${description ? ' ' + description : ''}`,
                            author: 'Usuário',
                            metadata: {
                                task_date: dateTime.toISOString(),
                                task_id: taskData.id
                            }
                        });
                }

                toast({
                    title: "Compromisso criado",
                    description: `Agendado para ${format(dateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`
                });
            }

            if (onSuccess) onSuccess();
            handleClose();

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao salvar",
                description: error?.message || "Não foi possível salvar o compromisso.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle("");
        setDescription("");
        setDate(selectedDate || new Date());
        setTime("09:00");
        setSelectedLeadId("none");
        onClose();
    };

    // Update internal date state when selectedDate prop changes
    // But be careful with dependencies to avoid infinite loops
    // In this simple case, we just rely on handleClose to reset
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{taskToEdit ? "Editar Compromisso" : "Novo Compromisso"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título *</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Reunião, Ligar para cliente..."
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="lead">Vincular a um Lead (Opcional)</Label>
                        <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um Lead" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhum (Compromisso Pessoal)</SelectItem>
                                {leads.map(lead => (
                                    <SelectItem key={lead.id} value={lead.id}>
                                        {lead.nome} {lead.empreendimento ? `- ${lead.empreendimento}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Data *</Label>
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
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="time">Hora *</Label>
                            <Input
                                id="time"
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Observações</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Detalhes adicionais..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
