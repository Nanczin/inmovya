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
import { ACOES, linkSeguro, type AcaoTipo } from "@/lib/agendaIrPara";
import { NEGOCIO_STAGES, NEGOCIO_PHASES } from "@/lib/negociosStages";

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
        acao_tipo?: string | null;
        acao_alvo?: string | null;
    } | null;
}

export function AgendaTaskDialog({ isOpen, onClose, onSuccess, selectedDate, taskToEdit }: AgendaTaskDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState<Date | undefined>(selectedDate || new Date());
    const [time, setTime] = useState("09:00");
    const [selectedLeadId, setSelectedLeadId] = useState<string>("none");
    const [loading, setLoading] = useState(false);
    // "Ir para": para onde o clique no compromisso leva
    const [acaoTipo, setAcaoTipo] = useState<string>("none");
    const [acaoAlvo, setAcaoAlvo] = useState<string>("");
    const [esteiras, setEsteiras] = useState<{ id: string; nome: string }[]>([]);
    
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
                setAcaoTipo(taskToEdit.acao_tipo || "none");
                setAcaoAlvo(taskToEdit.acao_alvo || "");
            } else {
                setTitle("");
                setDescription("");
                setDate(selectedDate || new Date());
                setTime("09:00");
                setSelectedLeadId("none");
                setAcaoTipo("none");
                setAcaoAlvo("");
            }
        }
    }, [isOpen, taskToEdit, selectedDate]);

    useEffect(() => {
        if (!isOpen || esteiras.length) return;
        supabase.from("esteiras").select("id, nome").order("nome").then(({ data }) => setEsteiras((data as any) || []));
    }, [isOpen, esteiras.length]);

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

            // "Ir para"
            const tipo = acaoTipo === "none" ? null : (acaoTipo as AcaoTipo);
            const precisaLead = ACOES.find((a) => a.id === tipo)?.precisaLead;
            if (precisaLead && !leadIdToSave) {
                toast({ title: "Escolha o lead", description: "Para ir ao WhatsApp ou à ficha, vincule o compromisso a um lead.", variant: "destructive" });
                return;
            }
            let alvo: string | null = null;
            if (tipo === "negocios" || tipo === "esteira") {
                if (!acaoAlvo) {
                    toast({ title: tipo === "esteira" ? "Escolha a esteira" : "Escolha a coluna", variant: "destructive" });
                    return;
                }
                alvo = acaoAlvo;
            } else if (tipo === "link") {
                alvo = linkSeguro(acaoAlvo);
                if (!alvo) {
                    toast({ title: "Link inválido", description: "Cole um endereço começando com https://", variant: "destructive" });
                    return;
                }
            } else if (precisaLead) alvo = leadIdToSave;
            const irPara = { acao_tipo: tipo, acao_alvo: alvo };
            // banco ainda sem as colunas novas (SQL não rodado): salva o resto e avisa
            const semColunas = (e: any) => /acao_tipo|acao_alvo/i.test(String(e?.message || ""));
            let avisoSql = false;

            if (taskToEdit) {
                const dados = {
                    user_id: user.id,
                    lead_id: leadIdToSave,
                    title,
                    description,
                    due_date: dateTime.toISOString(),
                };
                let { error } = await supabase.from('tasks').update({ ...dados, ...irPara } as any).eq('id', taskToEdit.id);
                if (error && semColunas(error)) {
                    avisoSql = !!tipo;
                    ({ error } = await supabase.from('tasks').update(dados).eq('id', taskToEdit.id));
                }

                if (error) throw error;
                
                toast({
                    title: "Compromisso atualizado",
                    description: `Agendado para ${format(dateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`
                });
            } else {
                const dados = {
                    user_id: user.id,
                    lead_id: leadIdToSave,
                    title,
                    description,
                    due_date: dateTime.toISOString(),
                    status: 'pending'
                };
                let { data: taskData, error } = await supabase.from('tasks').insert({ ...dados, ...irPara } as any).select().single();
                if (error && semColunas(error)) {
                    avisoSql = !!tipo;
                    ({ data: taskData, error } = await supabase.from('tasks').insert(dados).select().single());
                }

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

            if (avisoSql) {
                toast({
                    title: "Compromisso salvo, mas sem o \"Ir para\"",
                    description: "Falta rodar o SQL da Agenda no Supabase (supabase/agenda_ir_para.sql). Depois disso o \"Ir para\" passa a ser salvo.",
                    variant: "destructive",
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
            <DialogContent className="sm:max-w-[425px] max-h-[92vh] overflow-y-auto">
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
                                        {lead.nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Ir para (Opcional)</Label>
                        <Select value={acaoTipo} onValueChange={(v) => { setAcaoTipo(v); setAcaoAlvo(""); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ao clicar no compromisso…" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nada (padrão: WhatsApp do lead, se tiver)</SelectItem>
                                {ACOES.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {acaoTipo === "negocios" && (
                            <Select value={acaoAlvo} onValueChange={setAcaoAlvo}>
                                <SelectTrigger><SelectValue placeholder="Qual coluna? (ex.: P2, 20%)" /></SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {NEGOCIO_PHASES.map((ph) =>
                                        NEGOCIO_STAGES.filter((st) => st.phase === ph.id).map((st) => (
                                            <SelectItem key={st.id} value={st.id}>{ph.label} · {st.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                        {acaoTipo === "esteira" && (
                            <Select value={acaoAlvo} onValueChange={setAcaoAlvo}>
                                <SelectTrigger><SelectValue placeholder={esteiras.length ? "Qual esteira?" : "Carregando esteiras…"} /></SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {esteiras.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {acaoTipo === "link" && (
                            <Input value={acaoAlvo} onChange={(e) => setAcaoAlvo(e.target.value)} placeholder="https://… (ex.: a planilha da Midrah)" inputMode="url" />
                        )}
                        {(acaoTipo === "whatsapp" || acaoTipo === "lead") && selectedLeadId === "none" && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">Vincule um lead acima para este destino funcionar.</p>
                        )}
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
