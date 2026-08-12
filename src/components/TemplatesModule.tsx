
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
    MessageSquare,
    Mail,
    Plus,
    Trash2,
    Edit,
    Copy,
    Search,

    FileText,
    Upload,
    Paperclip,
    X,
    Loader2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Template {
    id: string;
    nome: string;
    tipo: 'whatsapp' | 'email';
    conteudo: string;
    assunto?: string; // Apenas para email
    categoria?: string;
    created_at?: string;
    arquivo_url?: string;
    arquivo_nome?: string;
}

export function TemplatesModule() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("todos");

    // Estados do Dialog (Criar/Editar)
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [formData, setFormData] = useState<Partial<Template>>({
        tipo: 'whatsapp',
        nome: '',
        conteudo: '',
        assunto: '',
        categoria: 'Geral',
        arquivo_url: '',
        arquivo_nome: ''
    });
    const [isUploading, setIsUploading] = useState(false);

    const categorias = [
        "Geral", "Primeiro Contato", "Follow-up", "Agendamento", "Proposta", "Pós-venda"
    ];

    const variaveisDisponiveis = [
        { codigo: "{{nome}}", descricao: "Nome Completo" },
        { codigo: "{{primeiro_nome}}", descricao: "Pequeno Nome" },
        { codigo: "{{telefone}}", descricao: "Telefone do Cliente" },
        { codigo: "{{email}}", descricao: "Email do Cliente" },
        { codigo: "{{empreendimento}}", descricao: "Empreendimento de Interesse" },
        { codigo: "{{vendedor}}", descricao: "Nome do Vendedor" },
    ];

    useEffect(() => {
        carregarTemplates();
    }, []);

    const carregarTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('mensagem_templates')
                .select('*')
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn("Erro ao buscar templates, tentando local storage.", error);
                const local = loadFromLocalStorage();
                setTemplates(local);
            } else {
                setTemplates(data || []);
                // Atualizar cache local
                saveToLocalStorage(data || []);
            }
        } catch (error) {
            console.error("Erro ao carregar templates:", error);
            const local = loadFromLocalStorage();
            setTemplates(local);
        } finally {
            setLoading(false);
        }
    };

    const MOCK_TEMPLATES: Template[] = [
        { id: '1', nome: 'Boas-vindas WhatsApp', tipo: 'whatsapp', conteudo: 'Olá {{nome}}, tudo bem? Sou {{vendedor}} da Inmovia Project. Vi seu interesse no {{empreendimento}}.', categoria: 'Primeiro Contato' },
        { id: '2', nome: 'Email Apresentação', tipo: 'email', assunto: 'Apresentação {{empreendimento}}', conteudo: 'Olá {{nome}},\n\nSegue em anexo a apresentação do {{empreendimento}}.\n\nAtenciosamente,\n{{vendedor}}', categoria: 'Geral' },
    ];

    const saveToLocalStorage = (newTemplates: Template[]) => {
        localStorage.setItem('inmovya_templates_local', JSON.stringify(newTemplates));
    };

    const loadFromLocalStorage = (): Template[] => {
        const saved = localStorage.getItem('inmovya_templates_local');
        return saved ? JSON.parse(saved) : [];
    };

    const resetForm = () => {
        setFormData({
            tipo: 'whatsapp',
            nome: '',
            conteudo: '',
            assunto: '',
            categoria: 'Geral',
            arquivo_url: '',
            arquivo_nome: ''
        });
        setEditingTemplate(null);
    };

    const handleOpenDialog = (template?: Template) => {
        if (template) {
            setEditingTemplate(template);
            setFormData(template);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.nome || (!formData.conteudo && !formData.arquivo_url)) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha o nome e o conteúdo da mensagem (ou anexe um arquivo).",
                variant: "destructive"
            });
            return;
        }

        try {
            const templateToSave = {
                nome: formData.nome,
                tipo: formData.tipo,
                conteudo: formData.conteudo,
                assunto: formData.tipo === 'email' ? formData.assunto : null,
                categoria: formData.categoria,
                arquivo_url: formData.arquivo_url || null,
                arquivo_nome: formData.arquivo_nome || null,
                user_id: (await supabase.auth.getUser()).data.user?.id
            };

            if (editingTemplate) {
                // Update
                const { error } = await supabase
                    .from('mensagem_templates')
                    .update(templateToSave)
                    .eq('id', editingTemplate.id);

                if (error) {
                    // Fallback update local
                    console.warn("Erro ao atualizar no DB, atualizando localmente", error);
                    setTemplates(prev => {
                        const updated = prev.map(t => t.id === editingTemplate.id ? { ...t, ...templateToSave } : t);
                        saveToLocalStorage(updated);
                        return updated;
                    });
                } else {
                    setTemplates(prev => {
                        const updated = prev.map(t => t.id === editingTemplate.id ? { ...t, ...templateToSave } : t);
                        saveToLocalStorage(updated); // Sync
                        return updated;
                    });
                }
                toast({ title: "Template atualizado!" });
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('mensagem_templates')
                    .insert(templateToSave)
                    .select()
                    .single();

                if (error || !data) {
                    // Fallback para mock se tabela não existir com localStorage
                    const newMock = { ...templateToSave, id: Date.now().toString() } as Template;
                    setTemplates(prev => {
                        const newTemplates = [newMock, ...prev];
                        saveToLocalStorage(newTemplates);
                        return newTemplates;
                    });
                } else {
                    setTemplates(prev => {
                        const newTemplates = [data, ...prev];
                        saveToLocalStorage(newTemplates);
                        return newTemplates;
                    });
                }

                toast({ title: "Template criado!" });
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Erro ao salvar template:", error);

            // Fallback visual para user não ficar travado
            const newMock = { ...formData, id: Date.now().toString() } as Template;
            setTemplates(prev => {
                const newTemplates = [newMock, ...prev];
                saveToLocalStorage(newTemplates);
                return newTemplates;
            });
            setIsDialogOpen(false);
            toast({ title: "Template salvo localmente (offline)" });
        }
    };

    // State for delete confirmation
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    const checkDelete = (id: string) => {
        setTemplateToDelete(id);
    };

    const confirmDelete = async () => {
        if (!templateToDelete) return;

        const id = templateToDelete;

        try {
            const { error } = await supabase.from('mensagem_templates').delete().eq('id', id);

            // Delete local em qualquer caso (se DB falhar ou funcionar)
            setTemplates(prev => {
                const filtered = prev.filter(t => t.id !== id);
                saveToLocalStorage(filtered);
                return filtered;
            });

            if (error) {
                console.error("Erro ao excluir do DB:", error);
                // toast({ title: "Erro ao excluir do banco (removido localmente)" });
            }

            toast({ title: "Template excluído" });
        } catch (error) {
            console.error("Erro ao excluir:", error);
            // Delete local
            setTemplates(prev => {
                const filtered = prev.filter(t => t.id !== id);
                saveToLocalStorage(filtered);
                return filtered;
            });
            toast({ title: "Template excluído (local)" });
        } finally {
            setTemplateToDelete(null);
        }
    };

    const filteredTemplates = templates.filter(t => {
        const matchSearch = t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = activeTab === 'todos' ? true : t.tipo === activeTab;
        return matchSearch && matchType;
    });

    const insertVariable = (variable: string) => {
        setFormData(prev => ({
            ...prev,
            conteudo: (prev.conteudo || '') + ' ' + variable
        }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            // Upload para o bucket 'empreendimentos' (padronizado com email marketing)
            const filePath = `template_files/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('empreendimentos')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Erro upload bucket:", uploadError);
                toast({ title: "Erro no upload", description: "Verifique as permissões do bucket 'empreendimentos'.", variant: "destructive" });
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('empreendimentos')
                .getPublicUrl(filePath);

            setFormData(prev => ({
                ...prev,
                arquivo_url: publicUrl,
                arquivo_nome: file.name
            }));

            toast({ title: "Arquivo anexado com sucesso!" });

        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: "Erro ao fazer upload", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const removeFile = () => {
        setFormData(prev => ({
            ...prev,
            arquivo_url: '',
            arquivo_nome: ''
        }));
    };

    // Global Paste Listener when Dialog is Open
    useEffect(() => {
        if (!isDialogOpen) return;

        const onGlobalPaste = (e: ClipboardEvent) => {
            // If we are focused on an input/textarea, let normal paste happen (unless it's a file)
            // But usually file paste overrides text paste if a file is present.
            // However, we want to capture file paste ANYWHERE in the dialog.
            if (e.clipboardData?.files.length || e.clipboardData?.items.length) {
                // Check if it's a file
                let hasFile = false;
                if (e.clipboardData.files.length > 0) hasFile = true;
                else {
                    for (let i = 0; i < e.clipboardData.items.length; i++) {
                        if (e.clipboardData.items[i].kind === 'file') {
                            hasFile = true;
                            break;
                        }
                    }
                }

                if (hasFile) {
                    // Manually trigger our react handler logic
                    handlePasteSync(e);
                }
            }
        };

        window.addEventListener('paste', onGlobalPaste);
        return () => window.removeEventListener('paste', onGlobalPaste);
    }, [isDialogOpen, formData]); // formData dependency ensuring closure freshness if needed (state setters used)

    const handlePasteSync = async (e: ClipboardEvent | React.ClipboardEvent) => {
        // Try to get file from files array or items list
        let file: File | null = null;
        // @ts-ignore
        const clipboardData = e.clipboardData || (window as any).clipboardData;

        if (!clipboardData) return;

        if (clipboardData.files.length > 0) {
            file = clipboardData.files[0];
        } else if (clipboardData.items.length > 0) {
            for (let i = 0; i < clipboardData.items.length; i++) {
                const item = clipboardData.items[i];
                if (item.kind === 'file') {
                    file = item.getAsFile();
                    break;
                }
            }
        }

        if (file) {
            e.preventDefault(); // Prevent default paste behavior
            // ... upload logic ...
            setIsUploading(true);
            try {
                // If pasted file has generic 'image.png' name or similar, we might want to keep extension
                // but some pasted files (like raw audio) might lose name.
                // We use type to guess extension if name is generic "image.png" or empty
                let fileExt = file.name.split('.').pop() || '';
                if (!fileExt || fileExt === file.name) {
                    // Very basic mime mapping fallback
                    if (file.type.includes('audio')) fileExt = 'mp3';
                    else if (file.type.includes('video')) fileExt = 'mp4';
                    else if (file.type === 'image/gif') fileExt = 'gif'; // Preservar GIF
                    else if (file.type.includes('image')) fileExt = 'png';
                    else if (file.type.includes('pdf')) fileExt = 'pdf';
                    else fileExt = 'bin';
                }

                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `template_files/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('empreendimentos')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error("Erro upload bucket:", uploadError);
                    toast({ title: "Erro no upload", description: "Verifique as permissões do bucket.", variant: "destructive" });
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('empreendimentos')
                    .getPublicUrl(filePath);

                setFormData(prev => ({
                    ...prev,
                    arquivo_url: publicUrl,
                    arquivo_nome: file?.name || fileName
                }));

                toast({ title: "Arquivo colado e anexado!" });

            } catch (error) {
                console.error("Paste upload error:", error);
                toast({ title: "Erro ao colar arquivo", variant: "destructive" });
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            setIsUploading(true);
            // Reusing upload logic (copy-paste for safety/simplicity in this context or extract)
            try {
                const fileExt = file.name.split('.').pop() || 'bin';
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `template_files/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('empreendimentos')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error("Drop upload error:", uploadError);
                    toast({ title: "Erro no upload", description: "Erro ao enviar arquivo arrastado.", variant: "destructive" });
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('empreendimentos')
                    .getPublicUrl(filePath);

                setFormData(prev => ({
                    ...prev,
                    arquivo_url: publicUrl,
                    arquivo_nome: file.name
                }));
                toast({ title: "Arquivo anexado!" });
            } catch (err) {
                console.error(err);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        Templates de Mensagens
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie modelos prontos para WhatsApp e Email para padronizar sua comunicação.
                    </p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="shadow-lg hover:shadow-xl transition-all">
                    <Plus className="mr-2 h-4 w-4" /> Novo Template
                </Button>
            </div>

            <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar templates..."
                                className="pl-9 bg-background/50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Tabs defaultValue="todos" value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 md:w-[400px] h-auto">
                                <TabsTrigger value="todos" className="py-2 sm:py-1.5">Todos</TabsTrigger>
                                <TabsTrigger value="whatsapp" className="flex items-center gap-2 py-2 sm:py-1.5">
                                    <MessageSquare className="h-4 w-4" /> WhatsApp
                                </TabsTrigger>
                                <TabsTrigger value="email" className="flex items-center gap-2 py-2 sm:py-1.5">
                                    <Mail className="h-4 w-4" /> Email
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTemplates.map((template) => (
                            <Card key={template.id} className="group relative overflow-hidden border-border/60 hover:border-primary/50 transition-all duration-300 hover:shadow-md">
                                <div className={`absolute top-0 left-0 w-1 h-full ${template.tipo === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <CardHeader className="pb-3 pl-5">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <Badge variant="outline" className={`${template.tipo === 'whatsapp' ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 bg-blue-50'} text-[10px] uppercase tracking-wider mb-1`}>
                                                {template.tipo === 'whatsapp' ? <><MessageSquare className="w-3 h-3 mr-1 inline" /> WhatsApp</> : <><Mail className="w-3 h-3 mr-1 inline" /> Email</>}
                                            </Badge>
                                            <CardTitle className="text-lg font-medium line-clamp-1" title={template.nome}>
                                                {template.nome}
                                            </CardTitle>
                                            {template.categoria && (
                                                <span className="text-xs text-muted-foreground block">{template.categoria}</span>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pl-5 pb-4">
                                    {template.tipo === 'email' && template.assunto && (
                                        <div className="mb-2 text-sm font-medium text-foreground/80 border-b border-border/50 pb-1">
                                            Assunto: <span className="text-muted-foreground font-normal">{template.assunto}</span>
                                        </div>
                                    )}
                                    {template.conteudo ? (
                                        <p className="text-sm text-muted-foreground line-clamp-3 min-h-[60px] bg-muted/30 p-2 rounded-md italic">
                                            "{template.conteudo}"
                                        </p>
                                    ) : (
                                        <div className="min-h-[60px] flex items-center justify-center bg-muted/10 p-2 rounded-md border border-dashed border-muted">
                                            <span className="text-xs text-muted-foreground italic opacity-70">Sem texto (Apenas arquivo)</span>
                                        </div>
                                    )}

                                    {template.arquivo_nome && (
                                        <div className="mt-2 flex items-center gap-2 overflow-hidden">
                                            <div className="flex-1 flex items-center text-xs text-blue-600 bg-blue-50 p-1.5 rounded px-2 border border-blue-100 truncate">
                                                <Paperclip className="h-3 w-3 mr-2 shrink-0" />
                                                <span className="truncate" title={template.arquivo_nome}>{template.arquivo_nome}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 mt-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenDialog(template)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive z-10" onClick={() => checkDelete(template.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {filteredTemplates.length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>Nenhum template encontrado.</p>
                                <Button variant="link" onClick={() => handleOpenDialog()}>Criar o primeiro template</Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent
                    className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-input scrollbar-track-transparent outline-none focus:outline-none"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                >
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
                        <DialogDescription>
                            Crie modelos padronizados para agilizar seu atendimento.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Mensagem</Label>
                                <Select
                                    value={formData.tipo}
                                    onValueChange={(val: any) => setFormData({ ...formData, tipo: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select
                                    value={formData.categoria}
                                    onValueChange={(val) => setFormData({ ...formData, categoria: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categorias.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Nome do Template</Label>
                            <Input
                                placeholder="Ex: Boas-vindas Lead Quente"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            />
                        </div>

                        {formData.tipo === 'email' && (
                            <div className="space-y-2">
                                <Label>Assunto do Email</Label>
                                <Input
                                    placeholder="Ex: Apresentação do Empreendimento..."
                                    value={formData.assunto}
                                    onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                                />
                            </div>
                        )}

                        <Tabs defaultValue="write" className="w-full">
                            <div className="flex justify-between items-center mb-2">
                                <Label>Conteúdo da Mensagem {formData.arquivo_url && <span className="text-[10px] font-normal text-muted-foreground">(Opcional se houver anexo)</span>}</Label>
                                <TabsList className="h-8">
                                    <TabsTrigger value="write" className="text-xs h-7">Escrever</TabsTrigger>
                                    <TabsTrigger value="preview" className="text-xs h-7">Visualizar</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-2">
                                {variaveisDisponiveis.map(v => (
                                    <Badge
                                        key={v.codigo}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-primary/20 transition-colors"
                                        onClick={() => insertVariable(v.codigo)}
                                        title={`Clique para inserir: ${v.descricao}`}
                                    >
                                        {v.codigo}
                                    </Badge>
                                ))}
                            </div>

                            <TabsContent value="write" className="mt-0">
                                <Textarea
                                    placeholder="Digite sua mensagem ou código HTML aqui..."
                                    className="min-h-[200px] resize-y font-mono text-sm"
                                    value={formData.conteudo}
                                    onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground text-right mt-1">
                                    {formData.conteudo?.length || 0} caracteres
                                </p>
                            </TabsContent>

                            <TabsContent value="preview" className="mt-0">
                                <ScrollArea className="h-[200px] w-full rounded-md border border-input bg-background/50 p-4">
                                    {formData.tipo === 'email' ? (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: formData.conteudo?.replace(/\n/g, '<br/>') || '' }}
                                        />
                                    ) : (
                                        <div className="whitespace-pre-wrap text-sm">
                                            {formData.conteudo}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="space-y-2">
                        <Label>Anexo (Opcional)</Label>
                        <div className="flex items-center gap-4">
                            {!formData.arquivo_url ? (
                                <div className="flex-1">
                                    <Label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 w-full text-center">
                                        <Upload className="mr-2 h-4 w-4" />
                                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Selecionar Arquivo (Imagem, GIF, Vídeo, Áudio)"}
                                    </Label>
                                    <Input id="file-upload" type="file" accept="image/*,video/*,audio/*,application/pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 bg-muted p-2 rounded-md flex-1">
                                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm truncate flex-1">{formData.arquivo_nome}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={removeFile}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            O link do arquivo será anexado à mensagem. Você também pode <strong>colar (Ctrl+V)</strong> ou <strong>arrastar</strong> um arquivo aqui. GIFs animados são suportados!
                        </p>
                    </div>


                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>{editingTemplate ? 'Salvar Alterações' : 'Criar Template'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTemplateToDelete(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
