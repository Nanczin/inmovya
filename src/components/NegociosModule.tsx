import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatUtils";
import { useLeads, Lead } from "@/context/LeadsContext";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Phone, Plus, Search, MessageCircle, Mail, Clock } from "lucide-react";
import {
  NEGOCIO_PHASES,
  NEGOCIO_STAGES,
  NegocioPhaseId,
  NegocioStage,
  VALIDACAO_STAGE_ID,
  PRIMEIRO_IMPACTO_STAGE_ID,
  PERDIDO_STAGE_ID,
  getStageForStatus,
  getFunilTier,
  normalizeStatus,
} from "@/lib/negociosStages";

interface NegociosModuleProps {
  onNavigate?: (module: string, params?: any) => void;
}

// Leads que já saíram do funil ativo (disparo / nutrição) e não têm etapa
// não vão para a Validação.
const OUT_OF_FUNNEL_TAGS = ["disparo", "nutricao"];

const formatChegou = (date?: string) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("pt-BR")}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const origemBadgeClass = (origem?: string) => {
  const o = normalizeStatus(origem);
  if (o.includes("instagram")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (o.includes("facebook")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (o.includes("google")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
};

export function NegociosModule({ onNavigate }: NegociosModuleProps) {
  const { leads, updateLead, refreshLeads } = useLeads();
  const { toast } = useToast();

  const [activePhase, setActivePhase] = useState<"all" | NegocioPhaseId>("all");
  const [search, setSearch] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyDeal = {
    nome: "",
    telefone: "",
    email: "",
    origem: "",
    renda: "",
    profissao: "",
    possuiEntrada: "",
    valorEntrada: "",
    interesse: [] as string[],
    observacoes: "",
    tagsRaw: "",
    stageId: VALIDACAO_STAGE_ID,
  };
  const [newDeal, setNewDeal] = useState(emptyDeal);
  const [empreendimentos, setEmpreendimentos] = useState<{ id: string; nome: string; status?: string }[]>([]);

  // Mesma lista de empreendimentos usada no cadastro de lead
  useEffect(() => {
    supabase
      .from("empreendimentos")
      .select("id, nome, status")
      .not("status", "in", '("Entregue","Inativo")')
      .order("nome")
      .then(({ data, error }) => {
        if (error) console.error("Erro ao carregar empreendimentos:", error);
        else setEmpreendimentos(data || []);
      });
  }, []);

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const dealTags = newDeal.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  // Distribui os leads pelas etapas
  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    NEGOCIO_STAGES.forEach((s) => (map[s.id] = []));

    const term = normalizeStatus(search);
    const digits = search.replace(/\D/g, "");

    (leads || []).forEach((lead) => {
      if (term) {
        const hay = normalizeStatus(`${lead.nome} ${lead.email} ${lead.observacoes || ""} ${lead.empreendimento?.nome || ""}`);
        const phoneMatch = digits.length >= 3 && (lead.telefone || "").replace(/\D/g, "").includes(digits);
        if (!hay.includes(term) && !phoneMatch) return;
      }

      const stage = getStageForStatus(lead.status);
      if (stage) {
        map[stage.id].push(lead);
        return;
      }

      // Sem etapa reconhecida → Validação (exceto quem já foi para disparo/nutrição)
      const tags = (lead.tags || []).map((t) => normalizeStatus(t));
      if (tags.some((t) => OUT_OF_FUNNEL_TAGS.includes(t))) return;
      map[VALIDACAO_STAGE_ID].push(lead);
    });

    return map;
  }, [leads, search]);

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    NEGOCIO_PHASES.forEach((p) => {
      counts[p.id] = NEGOCIO_STAGES.filter((s) => s.phase === p.id).reduce(
        (acc, s) => acc + (leadsByStage[s.id]?.length || 0),
        0
      );
    });
    return counts;
  }, [leadsByStage]);

  // Indicadores: "No funil" = 20%, 50%, 70% e Fechado (mesma regra da aba Funil)
  const noFunil = useMemo(() => (leads || []).filter((l) => getFunilTier(l.status)).length, [leads]);
  const ganhos = leadsByStage["vendeu"]?.length || 0;

  const moveLead = async (leadId: string, stage: NegocioStage) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (getStageForStatus(lead.status)?.id === stage.id) return;

    const previousStatus = lead.status;
    updateLead(leadId, { status: stage.value });

    const { error } = await supabase.from("leads").update({ status: stage.value }).eq("id", leadId);
    if (error) {
      console.error("Erro ao mover negócio:", error);
      updateLead(leadId, { status: previousStatus });
      toast({ title: "Erro ao mover", description: "Não foi possível alterar a etapa do lead.", variant: "destructive" });
      return;
    }
    toast({ title: "Etapa atualizada", description: `${lead.nome} → ${stage.name}` });
  };

  const stageById = (id: string) => NEGOCIO_STAGES.find((s) => s.id === id)!;

  const handleValidar = (lead: Lead) => moveLead(lead.id, stageById(PRIMEIRO_IMPACTO_STAGE_ID));
  const handleDescartar = (lead: Lead) => moveLead(lead.id, stageById(PERDIDO_STAGE_ID));

  const handleWhatsApp = (lead: Lead) => {
    const phone = (lead.telefone || "").replace(/\D/g, "");
    if (!phone) return;
    const full = phone.startsWith("55") && phone.length > 11 ? phone : `55${phone}`;
    window.open(`https://web.whatsapp.com/send?phone=${full}`, "_blank");
  };

  const openLead = (lead: Lead) => onNavigate?.("leads", { id: lead.id });

  const handleCreate = async () => {
    if (!newDeal.nome.trim() || !newDeal.telefone.trim() || !newDeal.email.trim()) {
      toast({ title: "Preencha nome, telefone e e-mail", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const stage = stageById(newDeal.stageId);
      // Mesmo formato do cadastro de lead (campos extras viram tags)
      const tags = [
        ...dealTags,
        ...newDeal.interesse.map((id) => {
          const emp = empreendimentos.find((e) => e.id === id);
          return emp ? `Interesse: ${emp.nome}` : null;
        }),
        newDeal.renda ? `Renda: ${newDeal.renda}` : null,
        newDeal.profissao ? `Profissão: ${newDeal.profissao}` : null,
        newDeal.possuiEntrada
          ? `Entrada: ${newDeal.possuiEntrada === "sim" ? (newDeal.valorEntrada ? `Sim (${newDeal.valorEntrada})` : "Sim") : "Não"}`
          : null,
      ].filter(Boolean) as string[];
      const { error } = await supabase.from("leads").insert([
        {
          nome: newDeal.nome.trim(),
          telefone: newDeal.telefone.trim(),
          email: newDeal.email.trim(),
          origem: newDeal.origem.trim() || null,
          observacoes: newDeal.observacoes.trim() || null,
          ultimo_contato: new Date().toISOString(),
          empreendimento_id: newDeal.interesse.length > 0 ? newDeal.interesse[0] : null,
          status: stage.value,
          tags,
          user_id: user.id,
        },
      ]);
      if (error) throw error;
      toast({ title: "Negócio criado", description: `${newDeal.nome} em ${stage.name}` });
      setIsNewOpen(false);
      setNewDeal(emptyDeal);
      refreshLeads();
    } catch (err: any) {
      console.error("Erro ao criar negócio:", err);
      toast({ title: "Erro ao criar negócio", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openNewInStage = (stageId: string) => {
    setNewDeal((d) => ({ ...d, stageId }));
    setIsNewOpen(true);
  };

  const visiblePhases = NEGOCIO_PHASES.filter((p) => activePhase === "all" || p.id === activePhase);

  const renderCard = (lead: Lead, isValidacao: boolean) => (
    <div
      key={lead.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("leadId", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group bg-white rounded-xl border border-slate-200 shadow-sm p-3 min-w-0 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md hover:border-slate-300 transition-all"
    >
      {/* Nome + WhatsApp */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => openLead(lead)}
          className="min-w-0 flex-1 font-semibold text-sm text-slate-900 leading-snug text-left hover:text-blue-800 truncate"
          title={lead.nome}
        >
          {lead.nome || "Sem nome"}
        </button>
        {lead.telefone && (
          <button
            type="button"
            onClick={() => handleWhatsApp(lead)}
            className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-green-600 hover:bg-green-50"
            title="Abrir no WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Etiquetas */}
      {(lead.origem || lead.empreendimento?.nome) && (
        <div className="flex flex-wrap gap-1 mt-2 min-w-0">
          {lead.origem && (
            <span
              className={`max-w-full truncate text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${origemBadgeClass(lead.origem)}`}
              title={lead.origem}
            >
              {lead.origem}
            </span>
          )}
          {lead.empreendimento?.nome && (
            <span
              className="max-w-full truncate text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-slate-50 text-slate-600 border-slate-200"
              title={lead.empreendimento.nome}
            >
              {lead.empreendimento.nome}
            </span>
          )}
        </div>
      )}

      {/* Contato */}
      <div className="mt-2 space-y-0.5">
        {lead.telefone && (
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Phone className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">{lead.telefone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0" title={lead.email}>
            <Mail className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      {lead.observacoes && (
        <div className="mt-2 text-[11px] leading-snug text-slate-600 bg-slate-50 rounded-md px-2 py-1.5 line-clamp-2 break-words" title={lead.observacoes}>
          {lead.observacoes}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
        <Clock className="w-3 h-3 shrink-0" />
        <span className="truncate">Chegou {formatChegou(lead.created_at)}</span>
      </div>

      {isValidacao && (
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
          <Button
            size="sm"
            className="h-8 px-2 min-w-0 whitespace-nowrap bg-blue-800 hover:bg-blue-900 text-white text-xs"
            onClick={() => handleValidar(lead)}
          >
            <Check className="w-3.5 h-3.5 mr-1 shrink-0" /> Validar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 min-w-0 whitespace-nowrap text-xs text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            onClick={() => handleDescartar(lead)}
          >
            <X className="w-3.5 h-3.5 mr-1 shrink-0" /> Descartar
          </Button>
        </div>
      )}
    </div>
  );

  const renderColumn = (stage: NegocioStage, accent: string) => {
    const stageLeads = leadsByStage[stage.id] || [];
    const isValidacao = stage.id === VALIDACAO_STAGE_ID;
    return (
      <div
        key={stage.id}
        className={`flex-shrink-0 w-[260px] rounded-xl bg-slate-100/80 border-t-2 flex flex-col max-h-[calc(100vh-260px)] min-h-[160px] transition-colors ${
          dragOverStage === stage.id ? "ring-2 ring-blue-400 bg-blue-50" : ""
        }`}
        style={{ borderTopColor: accent }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverStage !== stage.id) setDragOverStage(stage.id);
        }}
        onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverStage(null);
          const leadId = e.dataTransfer.getData("leadId");
          if (leadId) moveLead(leadId, stage);
        }}
      >
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[13px] text-slate-900 truncate" title={stage.name}>{stage.name}</span>
              <span className="text-[10px] font-medium bg-white border border-slate-200 rounded-full px-1.5 leading-4 text-slate-600">
                {stageLeads.length}
              </span>
            </div>
            {!isValidacao && (
              <button type="button" onClick={() => openNewInStage(stage.id)} className="text-slate-400 hover:text-slate-700" title={`Novo negócio em ${stage.name}`}>
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          {isValidacao && (
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">Leads novos das campanhas. Valide para entrar no funil.</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 pb-2.5 flex flex-col gap-2.5">
          {stageLeads.map((lead) => renderCard(lead, isValidacao))}
          {stageLeads.length === 0 && (
            <div className="h-24 flex items-center justify-center text-center text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-md px-2">
              Arraste um negócio para cá
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full min-w-0">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Negócios</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards entre as etapas para atualizar o funil.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar negócio..." className="pl-8 h-9 w-full sm:w-56" />
          </div>
          <Button className="h-9 bg-blue-800 hover:bg-blue-900 text-white" onClick={() => openNewInStage(VALIDACAO_STAGE_ID)}>
            <Plus className="w-4 h-4 mr-1" /> Novo negócio
          </Button>
        </div>
      </div>

      {/* Fases + indicadores */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-muted/50 border rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setActivePhase("all")}
            className={`text-xs px-3 py-1.5 rounded-md ${activePhase === "all" ? "bg-white shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Todas as fases
          </button>
          {NEGOCIO_PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePhase(p.id)}
              className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 ${activePhase === p.id ? "bg-white shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.tab}
              <span className="text-[10px] text-muted-foreground">{phaseCounts[p.id] || 0}</span>
            </button>
          ))}
        </div>
        <div className="flex border rounded-lg bg-white divide-x w-fit">
          <div className="px-4 py-1.5">
            <div className="text-[10px] text-muted-foreground">No funil</div>
            <div className="text-sm font-semibold">{noFunil}</div>
          </div>
          <div className="px-4 py-1.5">
            <div className="text-[10px] text-muted-foreground">Ganhos</div>
            <div className="text-sm font-semibold">{ganhos}</div>
          </div>
        </div>
      </div>

      {/* Quadro */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-w-0">
        {visiblePhases.map((phase) => {
          const stages = NEGOCIO_STAGES.filter((s) => s.phase === phase.id);
          return (
            <div key={phase.id} className="flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-slate-500">
                <span>{phase.label}</span>
                <span>{phaseCounts[phase.id] || 0}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="flex gap-2">{stages.map((s) => renderColumn(s, phase.accent))}</div>
            </div>
          );
        })}
      </div>

      {/* Novo negócio — mesmos campos do cadastro de lead */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="w-[95vw] max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo negócio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nd-nome">Nome *</Label>
              <Input id="nd-nome" value={newDeal.nome} onChange={(e) => setNewDeal({ ...newDeal, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nd-tel">Telefone *</Label>
                <Input id="nd-tel" value={newDeal.telefone} onChange={(e) => setNewDeal({ ...newDeal, telefone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nd-email">Email *</Label>
                <Input id="nd-email" type="email" value={newDeal.email} onChange={(e) => setNewDeal({ ...newDeal, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nd-origem">Origem</Label>
              <Input id="nd-origem" value={newDeal.origem} onChange={(e) => setNewDeal({ ...newDeal, origem: e.target.value })} placeholder="Ex: roleta, Facebook, Indicação..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nd-renda">Renda Mensal (Opcional)</Label>
                <Input id="nd-renda" value={newDeal.renda} onChange={(e) => setNewDeal({ ...newDeal, renda: formatCurrency(e.target.value) })} placeholder="Ex: R$ 5.000,00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nd-prof">Profissão (Opcional)</Label>
                <Input id="nd-prof" value={newDeal.profissao} onChange={(e) => setNewDeal({ ...newDeal, profissao: e.target.value })} placeholder="Ex: Médico" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Etapa do Funil</Label>
              <Select value={newDeal.stageId} onValueChange={(v) => setNewDeal({ ...newDeal, stageId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEGOCIO_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Possui Entrada? (Opcional)</Label>
              <div className="flex gap-2">
                <Select value={newDeal.possuiEntrada} onValueChange={(v) => setNewDeal({ ...newDeal, possuiEntrada: v })}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
                {newDeal.possuiEntrada === "sim" && (
                  <Input
                    className="flex-1"
                    placeholder="Valor (R$)"
                    value={newDeal.valorEntrada}
                    onChange={(e) => setNewDeal({ ...newDeal, valorEntrada: formatCurrency(e.target.value) })}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Empreendimentos de Interesse</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {empreendimentos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum empreendimento cadastrado</div>
                ) : (
                  empreendimentos.map((emp) => (
                    <div key={emp.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`nd-int-${emp.id}`}
                        checked={newDeal.interesse.includes(emp.id)}
                        onCheckedChange={(checked) =>
                          setNewDeal({
                            ...newDeal,
                            interesse: checked ? [...newDeal.interesse, emp.id] : newDeal.interesse.filter((id) => id !== emp.id),
                          })
                        }
                      />
                      <Label htmlFor={`nd-int-${emp.id}`} className="text-sm font-normal cursor-pointer flex items-center gap-2">
                        {emp.nome}
                        {emp.status && (
                          <Badge variant="outline" className="text-xs">
                            {emp.status}
                          </Badge>
                        )}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {newDeal.interesse.length > 0 && (
                <div className="text-xs text-muted-foreground">{newDeal.interesse.length} empreendimento(s) selecionado(s)</div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nd-obs">Observações</Label>
              <Textarea id="nd-obs" rows={3} value={newDeal.observacoes} onChange={(e) => setNewDeal({ ...newDeal, observacoes: e.target.value })} placeholder="Observações adicionais..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nd-tags">Tags/Etiquetas</Label>
              <Input id="nd-tags" value={newDeal.tagsRaw} onChange={(e) => setNewDeal({ ...newDeal, tagsRaw: e.target.value })} placeholder="Digite as tags separadas por vírgula" />
              <div className="text-xs text-muted-foreground">Separe múltiplas tags com vírgula. Ex: vip, interessado, follow-up</div>
              {dealTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {dealTags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-blue-800 hover:bg-blue-900 text-white">
              {saving ? "Salvando..." : "Criar negócio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
