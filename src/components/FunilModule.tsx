import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Edit2, Check, X, GripVertical, Info, Download, Filter as FilterIcon, Calendar as CalendarIcon, FileSpreadsheet, FileText, FileCode2 } from "lucide-react";
import { useLeads } from "@/context/LeadsContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export function FunilModule() {
    const { leads } = useLeads();
    const { toast } = useToast();

    // Default stages based on typical sales funnel
    const defaultStages = [
        { id: "1", name: "Novo", color: "#3b82f6" },
        { id: "2", name: "Contatado", color: "#0ea5e9" },
        { id: "3", name: "Interessado", color: "#06b6d4" },
        { id: "4", name: "Visita Agendada", color: "#14b8a6" },
        { id: "5", name: "Proposta", color: "#10b981" },
        { id: "6", name: "Fechado", color: "#22c55e" }
    ];

    const [stages, setStages] = useState<{ id: string; name: string; color?: string }[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [newStageName, setNewStageName] = useState("");

    // Date Filters
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    // Drag and Drop state
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleSort = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            let _stages = [...stages];
            const draggedItemContent = _stages.splice(dragItem.current, 1)[0];
            _stages.splice(dragOverItem.current, 0, draggedItemContent);

            dragItem.current = null;
            dragOverItem.current = null;
            setStages(_stages);
        }
    };

    // Load stages from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("inmovya_funnel_stages");
        if (saved) {
            try {
                setStages(JSON.parse(saved));
            } catch (e) {
                setStages(defaultStages);
            }
        } else {
            setStages(defaultStages);
        }
    }, []);

    // Save to localStorage whenever stages change
    useEffect(() => {
        if (stages.length > 0) {
            localStorage.setItem("inmovya_funnel_stages", JSON.stringify(stages));
        }
    }, [stages]);

    const handleAddStage = () => {
        if (!newStageName.trim()) return;
        const newStage = {
            id: Math.random().toString(36).substring(2, 9),
            name: newStageName.trim(),
            color: "#64748b" // default dark slate
        };
        setStages([...stages, newStage]);
        setNewStageName("");
    };

    const handleColorChange = (id: string, color: string) => {
        setStages(stages.map(s => s.id === id ? { ...s, color } : s));
    };

    const handleDeleteStage = (id: string) => {
        setStages(stages.filter(s => s.id !== id));
    };

    const handleEditStart = (stage: { id: string; name: string }) => {
        setEditingId(stage.id);
        setEditName(stage.name);
    };

    const handleEditSave = () => {
        if (!editName.trim() || !editingId) return;
        setStages(stages.map(s => s.id === editingId ? { ...s, name: editName.trim() } : s));
        setEditingId(null);
        setEditName("");
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditName("");
    };

    // Funnel calculations
    const calculateFunnelMetrics = () => {
        // First filter leads by date if set
        const filteredLeads = leads.filter(l => {
            if (!l.created_at) return true; // fallback
            const leadDate = new Date(l.created_at);

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (leadDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (leadDate > end) return false;
            }
            return true;
        });

        const totalLeads = filteredLeads.length;

        // Count leads by finding the closest match in stage names vs lead status
        const stageCounts = stages.map(stage => {
            const thisStageLeads = filteredLeads.filter(l =>
                l.status?.toLowerCase() === stage.name.toLowerCase()
            );
            return { ...stage, count: thisStageLeads.length, leads: thisStageLeads };
        });

        // Add "Others" for leads that don't match any stage
        const matchedCount = stageCounts.reduce((acc, curr) => acc + curr.count, 0);
        const othersCount = totalLeads - matchedCount;

        // Calculate progression percentages
        // A standard funnel usually calculates percentage from the layer above OR from Total
        // Here we calculate percentage from total to show absolute conversion rate

        // Also calculate drop-off from previous stage
        const enrichedStages = stageCounts.map((stage, index) => {
            const percentageOfTotal = totalLeads > 0 ? ((stage.count / totalLeads) * 100).toFixed(1) : "0.0";

            let percentageFromPrevious = "100.0";
            if (index > 0) {
                const prevCount = stageCounts[index - 1].count;
                if (prevCount === 0) {
                    percentageFromPrevious = stage.count > 0 ? "Infinite" : "0.0";
                } else {
                    percentageFromPrevious = ((stage.count / prevCount) * 100).toFixed(1);
                }
            }

            return {
                ...stage,
                percentageOfTotal,
                percentageFromPrevious,
                // Calculate a visual width for the funnel block
                // Min width 20% to stay readable, Max 100%
                widthPercentage: totalLeads > 0
                    ? Math.max(20, (stage.count / totalLeads) * 100)
                    : 100
            };
        });

        return { totalLeads, enrichedStages, othersCount };
    };

    const { totalLeads, enrichedStages, othersCount } = calculateFunnelMetrics();

    const getStageColor = (stageColor?: string) => {
        const base = stageColor || "#94a3b8"; // fallback slate-400
        return {
            base,
            alpha: `${base}e6` // slightly transparent
        };
    };

    const exportStageLeads = (stageName: string, format: 'xlsx' | 'csv' | 'xml') => {
        const dataset = generateDataset();
        const stageLeads = dataset[stageName] || [];

        if (stageLeads.length === 0) {
            toast({
                title: "Sem Dados",
                description: `A etapa "${stageName}" não possui leads no período selecionado.`,
                variant: 'destructive'
            });
            return;
        }

        const safeFilename = `Leads_${stageName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}`;

        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(stageLeads);
            XLSX.utils.book_append_sheet(wb, ws, stageName.substring(0, 31).replace(/[\[\]\*\\\/\?]/g, ''));
            XLSX.writeFile(wb, `${safeFilename}.xlsx`);
        } else if (format === 'csv') {
            const ws = XLSX.utils.json_to_sheet(stageLeads);
            // In Portuguese contexts Excel expects CSV to be separated by semicolons and need BOM for UTF-8
            const csv = '\ufeff' + XLSX.utils.sheet_to_csv(ws, { FS: ';' });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `${safeFilename}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (format === 'xml') {
            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<FunilLeads>\n  <Etapa nome="${stageName.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">\n`;
            stageLeads.forEach(lead => {
                xml += `    <Lead>\n`;
                Object.keys(lead).forEach(k => {
                    const safeKey = k.replace(/ /g, '_');
                    const safeVal = String(lead[k] || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    xml += `      <${safeKey}>${safeVal}</${safeKey}>\n`;
                });
                xml += `    </Lead>\n`;
            });
            xml += `  </Etapa>\n</FunilLeads>`;

            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `${safeFilename}.xml`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        toast({
            title: "Exportação Concluída",
            description: `Arquivo da etapa "${stageName}" baixado com sucesso!`,
        });
    };

    // --- Export Functions ---
    const cleanPhone = (phone?: string) => {
        if (!phone) return "";
        let digits = phone.replace(/\D/g, '');
        if (digits.length === 10 || digits.length === 11) {
            digits = '55' + digits;
        }
        return digits;
    };

    const generateDataset = () => {
        // Returns dataset mapped by stage
        const dataset: Record<string, any[]> = {};
        enrichedStages.forEach(stage => {
            // we attach the corresponding leads array in calculateFunnelMetrics
            dataset[stage.name] = stage.leads.map((l: any) => ({
                Nome: l.nome || "",
                "Número": cleanPhone(l.telefone),
                "Observações": l.observacoes || ""
            }));
        });

        // Unmapped leads (Others)
        const others = leads.filter(l => {
            // Also respecting date filters for 'Others' export
            if (!l.created_at) return true;
            const d = new Date(l.created_at);
            if (startDate && d < new Date(startDate)) return false;
            if (endDate && d > new Date(`${endDate}T23:59:59`)) return false;
            return true;
        }).filter(l => !stages.some(s => s.name.toLowerCase() === l.status?.toLowerCase()));

        if (others.length > 0) {
            dataset['Sem Etapa Correspondente'] = others.map((l: any) => ({
                Nome: l.nome || "",
                "Número": cleanPhone(l.telefone),
                "Observações": l.observacoes || ""
            }));
        }

        return dataset;
    };

    const downloadExcel = () => {
        const dataset = generateDataset();
        const wb = XLSX.utils.book_new();

        Object.keys(dataset).forEach(stageName => {
            // Excel sheet names cannot exceed 31 chars and no special chars like []
            const safeSheetName = stageName.substring(0, 31).replace(/[\[\]\*\\\/\?]/g, '');
            const rows = dataset[stageName];
            // if empty, add a dummy row
            const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Nenhum lead nesta etapa" }]);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        });

        XLSX.writeFile(wb, `Leads_Por_Funil_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const downloadCSV = () => {
        const dataset = generateDataset();
        // For CSV, concat all sheets and add a column for Stage
        let allRows: any[] = [];

        Object.keys(dataset).forEach(stageName => {
            const rows = dataset[stageName];
            rows.forEach(r => {
                allRows.push({
                    "Etapa do Funil": stageName,
                    ...r
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(allRows);
        const csv = XLSX.utils.sheet_to_csv(ws);

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Leads_Por_Funil_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadXML = () => {
        const dataset = generateDataset();
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<FunilLeads>\n`;

        Object.keys(dataset).forEach(stageName => {
            xml += `  <Etapa nome="${stageName.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">\n`;

            dataset[stageName].forEach(lead => {
                xml += `    <Lead>\n`;
                Object.keys(lead).forEach(k => {
                    const safeKey = k.replace(/ /g, '_');
                    const safeVal = String(lead[k] || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    xml += `      <${safeKey}>${safeVal}</${safeKey}>\n`;
                });
                xml += `    </Lead>\n`;
            });
            xml += `  </Etapa>\n`;
        });
        xml += `</FunilLeads>`;

        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Leads_Por_Funil_${new Date().toISOString().split('T')[0]}.xml`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Funil de Vendas</h2>
                    <p className="text-muted-foreground mt-1">
                        Visualize o fluxo de conversão e exporte seus leads segmentados por etapa.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center bg-white rounded-lg p-1 pr-2 border shadow-sm h-10 w-max transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <CalendarIcon className="w-4 h-4 ml-2 mr-2 text-slate-400" />
                        <Input
                            type="date"
                            className="relative h-8 border-0 shadow-none focus-visible:ring-0 text-sm text-slate-700 bg-transparent p-0 w-[105px] text-center cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-slate-300 font-light mx-2">-</span>
                        <Input
                            type="date"
                            className="relative h-8 border-0 shadow-none focus-visible:ring-0 text-sm text-slate-700 bg-transparent p-0 w-[105px] text-center cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        {(startDate || endDate) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => { setStartDate(''); setEndDate(''); }}>
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* FUNNEL CONFIGURATION (Sidebar) */}
                <Card className="lg:col-span-1 shadow-sm border-slate-200">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Etapas do Funil
                        </CardTitle>
                        <CardDescription>
                            As etapas são mapeadas usando o campo "status" dos seus leads.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Add new Stage */}
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder="Nova etapa (ex: Visita)"
                                value={newStageName}
                                onChange={(e) => setNewStageName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                                className="bg-slate-50 focus-visible:ring-1"
                            />
                            <Button onClick={handleAddStage} size="icon" className="shrink-0 bg-primary hover:bg-primary/90">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Drag and Drop notice */}
                        <p className="text-xs text-slate-400 mb-4 bg-slate-50 p-2 rounded border border-slate-100 flex items-center gap-2">
                            <GripVertical className="w-3.5 h-3.5 shrink-0" />
                            Arraste nas alças para reordenar a lista. O gráfico se ajusta sozinho!
                        </p>

                        {/* Stage List */}
                        <div className="space-y-3">
                            {stages.map((stage, index) => (
                                <div
                                    key={stage.id}
                                    draggable
                                    onDragStart={(e) => (dragItem.current = index)}
                                    onDragEnter={(e) => (dragOverItem.current = index)}
                                    onDragEnd={handleSort}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-white shadow-sm group hover:border-slate-300 hover:shadow-md transition-all cursor-move"
                                >
                                    <div className="bg-slate-50 p-1.5 rounded text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-100">
                                        <GripVertical className="w-4 h-4" />
                                    </div>

                                    <div className="flex-1 flex items-center justify-between">
                                        {editingId === stage.id ? (
                                            <div className="flex items-center gap-1 w-full">
                                                <Input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="h-8 text-sm"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleEditSave();
                                                        if (e.key === 'Escape') handleEditCancel();
                                                    }}
                                                />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleEditSave}>
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={handleEditCancel}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <label className="cursor-pointer flex items-center shrink-0">
                                                        <input
                                                            type="color"
                                                            value={stage.color || "#94a3b8"}
                                                            onChange={(e) => handleColorChange(stage.id, e.target.value)}
                                                            className="w-0 h-0 opacity-0 absolute pointer-events-none"
                                                        />
                                                        <div
                                                            className="w-5 h-5 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110"
                                                            style={{ backgroundColor: stage.color || "#94a3b8" }}
                                                            title="Clique para mudar a cor"
                                                        />
                                                    </label>
                                                    <span className="font-medium text-slate-700">{stage.name}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => handleEditStart(stage)}>
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDeleteStage(stage.id)}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {stages.length === 0 && (
                                <div className="text-center p-6 border border-dashed rounded-lg text-slate-400 bg-slate-50">
                                    Nenhuma etapa configurada
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* FUNNEL VISUALIZATION */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200 overflow-hidden bg-white/50 backdrop-blur-sm">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6 flex flex-row items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-xl">Representação Visual</CardTitle>
                            <Badge variant="outline" className="bg-white w-fit">Total: {totalLeads} Leads no Período</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-10 pb-12 px-8">
                        {totalLeads === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                                    <FilterIcon className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-600">Nenhum lead encontrado</h3>
                                <p className="max-w-xs mt-2">Ajuste os filtros de período, pois não encontramos correspondência.</p>
                            </div>
                        ) : stages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                                <Info className="w-10 h-10 text-primary/40 mb-4" />
                                <h3 className="text-lg font-medium text-slate-600">Configure as etapas</h3>
                                <p className="max-w-xs mt-2">Adicione pelo menos uma etapa para gerar o gráfico.</p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center py-4 sm:py-8">
                                <div className="relative w-full max-w-[500px] aspect-[4/5] sm:aspect-square flex flex-col filter drop-shadow-2xl">
                                    <div
                                        className="absolute inset-0 flex flex-col overflow-hidden transition-all duration-500 bg-slate-100 rounded-sm"
                                        style={{ clipPath: 'polygon(0% 0%, 100% 0%, 65% 100%, 35% 100%)' }}
                                    >
                                        {enrichedStages.map((stage, index) => {
                                            const colors = getStageColor(stage.color);
                                            return (
                                                <div
                                                    key={stage.id}
                                                    className="flex-1 w-full relative group transition-all duration-300 hover:brightness-110 border-b border-white/20 last:border-b-0"
                                                    style={{ background: `linear-gradient(135deg, ${colors.base} 0%, ${colors.alpha} 100%)` }}
                                                >
                                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                    {/* Central Clickable Export Overlay */}
                                                    <div className="absolute inset-0 z-20 flex items-center justify-start pl-[20%] opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="secondary" size="sm" className="hidden sm:flex shadow-xl gap-2 hover:bg-white text-slate-700 font-semibold bg-white/95 cursor-pointer">
                                                                    <Download className="w-4 h-4 text-primary" />
                                                                    Exportar Leads: {stage.name}
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start">
                                                                <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => exportStageLeads(stage.name, 'xlsx')} className="cursor-pointer gap-2">
                                                                    <FileSpreadsheet className="w-4 h-4 text-green-600" /> Como Excel (.xlsx)
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => exportStageLeads(stage.name, 'csv')} className="cursor-pointer gap-2">
                                                                    <FileText className="w-4 h-4 text-slate-600" /> Como CSV
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => exportStageLeads(stage.name, 'xml')} className="cursor-pointer gap-2">
                                                                    <FileCode2 className="w-4 h-4 text-orange-500" /> Como XML
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                                                        <span className="text-white/95 font-bold text-[10px] sm:text-[13px] tracking-widest uppercase drop-shadow-md">
                                                            {stage.name}
                                                        </span>
                                                        <div className="flex items-baseline justify-center gap-1 sm:mt-0.5">
                                                            <span className="text-white font-black text-2xl sm:text-5xl leading-none drop-shadow-md">
                                                                {stage.count}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mt-1 sm:mt-2">
                                                            <span className="bg-black/20 text-white text-[9px] sm:text-xs px-2 py-0.5 rounded-full backdrop-blur-sm border border-black/10">
                                                                {stage.percentageOfTotal}% do total
                                                            </span>
                                                            {index > 0 && (
                                                                <span className="bg-white/25 text-white shadow-sm text-[9px] sm:text-xs px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/20 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    {stage.percentageFromPrevious}% conv.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Unmapped Leads Info */}
                                {othersCount > 0 && (
                                    <div className="mt-8 pt-6 border-t border-slate-100 w-full flex justify-center fade-in">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge variant="secondary" className="px-4 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-help transition-colors border-0">
                                                        <Info className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                                        {othersCount} leads sem correspondência de etapa
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs text-center p-3">
                                                    <p>Estes leads possuem um status que não corresponde ao nome de nenhuma etapa configurada acima.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
