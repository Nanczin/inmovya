import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SincronizarWhatsAppButton } from "@/components/EtiquetasWhatsAppMenu";
import { useLeads, Lead } from "@/context/LeadsContext";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Phone, Plus, Search, MessageCircle, ExternalLink, Wand2, ArrowRight, History, CheckSquare, Square, MoveRight, Workflow } from "lucide-react";
import { LeadTimeline } from "@/components/LeadTimeline";
import { colocarNaEsteira, tirarDaEsteira, moverParaPasso } from "@/lib/esteiras";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
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
  getStatusNormalization,
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
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seleção múltipla para mover vários negócios de uma vez
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [bulkMoving, setBulkMoving] = useState(false);
  const [esteirasLista, setEsteirasLista] = useState<{ id: string; nome: string; etapa?: string | null; ao_concluir_etapa?: string | null }[]>([]);
  const [passosLista, setPassosLista] = useState<{ id: string; esteira_id: string; ordem: number; titulo: string; etapa?: string | null }[]>([]);
  const [bulkEsteira, setBulkEsteira] = useState<string>("");

  // Esteiras ligadas às etapas (para mostrar no quadro)
  useEffect(() => {
    supabase
      .from("esteiras")
      .select("*")
      .order("ordem")
      .then(({ data, error }) => !error && setEsteirasLista((data as any) || []));
    supabase
      .from("esteira_passos")
      .select("*")
      .order("ordem")
      .then(({ data, error }) => !error && setPassosLista((data as any) || []));
  }, [selectMode]);

  const setLeadPasso = async (lead: Lead, esteiraId: string, indice: number) => {
    try {
      const ps = (passosLista as any[]).filter((p) => p.esteira_id === esteiraId).sort((a, b) => a.ordem - b.ordem);
      await moverParaPasso([lead.id], esteiraId, indice, ps);
      const est = esteirasLista.find((e) => e.id === esteiraId);
      toast({ title: "Lead na esteira", description: `${lead.nome} → ${est?.nome || ""} · ${ps[indice]?.titulo || `Passo ${indice + 1}`} (envio hoje)` });
      await refreshLeads();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const setLeadEsteira = async (lead: Lead, esteiraId: string | null) => {
    try {
      if (esteiraId) await colocarNaEsteira([lead.id], esteiraId);
      else await tirarDaEsteira([lead.id]);
      const nome = esteiraId ? esteirasLista.find((e) => e.id === esteiraId)?.nome : null;
      toast({
        title: esteiraId ? "Esteira definida" : "Saiu da esteira",
        description: esteiraId ? `${lead.nome} em ${nome}, começando no D1.` : lead.nome,
      });
      await refreshLeads();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const infoEsteira = (lead: Lead) => {
    const l = lead as Lead & { esteira_id?: string | null; esteira_passo?: number | null; esteira_proximo?: string | null };
    if (!l.esteira_id) return null;
    const est = esteirasLista.find((e) => e.id === l.esteira_id);
    if (!est) return null;
    const ps = passosLista.filter((p) => p.esteira_id === est.id).sort((a, b) => a.ordem - b.ordem);
    const idx = Math.min(l.esteira_passo || 0, Math.max(ps.length - 1, 0));
    const prox = l.esteira_proximo ? new Date(l.esteira_proximo) : null;
    const hoje = !prox || prox.getTime() <= new Date().setHours(23, 59, 59, 999);
    const aguardando = ps.length > 0 && (l.esteira_passo || 0) >= ps.length;
    return {
      nome: est.nome,
      passo: aguardando ? `sem resposta → ${est.ao_concluir_etapa || "fim"}` : ps[idx]?.titulo || `Passo ${idx + 1}`,
      total: ps.length,
      idx,
      quando: hoje ? "hoje" : prox!.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      hoje,
    };
  };

  const putSelectedInEsteira = async () => {
    if (!bulkEsteira || selectedIds.size === 0) return;
    setBulkMoving(true);
    try {
      const ids = Array.from(selectedIds);
      await colocarNaEsteira(ids, bulkEsteira);
      const nome = esteirasLista.find((e) => e.id === bulkEsteira)?.nome || "esteira";
      toast({ title: "Leads na esteira", description: `${ids.length} lead(s) em ${nome}, começando no D1. Envie pela aba Esteiras.` });
      await refreshLeads();
      exitSelectMode();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setBulkMoving(false);
    }
  };
  const [newDeal, setNewDeal] = useState({
    nome: "",
    telefone: "",
    email: "",
    origem: "",
    observacoes: "",
    stageId: VALIDACAO_STAGE_ID,
  });

  // Distribui os leads pelas etapas
  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    NEGOCIO_STAGES.forEach((s) => (map[s.id] = []));

    const term = normalizeStatus(search);
    const digits = search.replace(/\D/g, "");

    (leads || []).forEach((lead) => {
      if (term) {
        const hay = normalizeStatus(`${lead.nome} ${lead.email} ${lead.observacoes || ""}`);
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

  const toggleSelected = (leadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleColumn = (stageLeads: Lead[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = stageLeads.length > 0 && stageLeads.every((l) => next.has(l.id));
      stageLeads.forEach((l) => (allSelected ? next.delete(l.id) : next.add(l.id)));
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkTarget("");
  };

  // Esc sai do modo de seleção
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitSelectMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode]);

  const moveSelected = async () => {
    if (!bulkTarget || selectedIds.size === 0) return;
    const stage = stageById(bulkTarget);
    const ids = Array.from(selectedIds).filter((id) => {
      const lead = leads.find((l) => l.id === id);
      return lead && getStageForStatus(lead.status)?.id !== stage.id;
    });
    if (ids.length === 0) {
      toast({ title: "Nada para mover", description: `Os selecionados já estão em ${stage.name}.` });
      return;
    }

    setBulkMoving(true);
    const previous = new Map(ids.map((id) => [id, leads.find((l) => l.id === id)?.status]));
    ids.forEach((id) => updateLead(id, { status: stage.value }));
    try {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase.from("leads").update({ status: stage.value }).in("id", chunk);
        if (error) throw error;
      }
      toast({ title: "Negócios movidos", description: `${ids.length} lead(s) → ${stage.name}` });
      exitSelectMode();
    } catch (err: any) {
      console.error("Erro ao mover negócios:", err);
      previous.forEach((status, id) => updateLead(id, { status: status || "" }));
      toast({ title: "Erro ao mover", description: err?.message || "Tente novamente.", variant: "destructive" });
      await refreshLeads();
    } finally {
      setBulkMoving(false);
    }
  };

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
      const { error } = await supabase.from("leads").insert([
        {
          nome: newDeal.nome.trim(),
          telefone: newDeal.telefone.trim(),
          email: newDeal.email.trim(),
          origem: newDeal.origem.trim() || null,
          observacoes: newDeal.observacoes.trim() || null,
          status: stage.value,
          user_id: user.id,
        },
      ]);
      if (error) throw error;
      toast({ title: "Negócio criado", description: `${newDeal.nome} em ${stage.name}` });
      setIsNewOpen(false);
      setNewDeal({ nome: "", telefone: "", email: "", origem: "", observacoes: "", stageId: VALIDACAO_STAGE_ID });
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

  // Padronização: leads com status antigo/alternativo (ex.: "75%", "Novo")
  const [isNormalizeOpen, setIsNormalizeOpen] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const normalizationGroups = useMemo(() => {
    const groups: Record<string, { from: string; to: string; toName: string; ids: string[] }> = {};
    (leads || []).forEach((lead) => {
      const stage = getStatusNormalization(lead.status);
      if (!stage) return;
      const key = `${lead.status}→${stage.value}`;
      if (!groups[key]) groups[key] = { from: lead.status, to: stage.value, toName: stage.name, ids: [] };
      groups[key].ids.push(lead.id);
    });
    return Object.values(groups).sort((a, b) => b.ids.length - a.ids.length);
  }, [leads]);
  const normalizationTotal = normalizationGroups.reduce((acc, g) => acc + g.ids.length, 0);

  // Status que não correspondem a nenhuma etapa (ficam na Validação)
  const unmatchedStatuses = useMemo(() => {
    const counts: Record<string, number> = {};
    (leads || []).forEach((lead) => {
      if (!lead.status || getStageForStatus(lead.status)) return;
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const applyNormalization = async () => {
    setNormalizing(true);
    try {
      for (const group of normalizationGroups) {
        for (let i = 0; i < group.ids.length; i += 200) {
          const chunk = group.ids.slice(i, i + 200);
          const { error } = await supabase.from("leads").update({ status: group.to }).in("id", chunk);
          if (error) throw error;
        }
      }
      toast({ title: "Etapas padronizadas", description: `${normalizationTotal} lead(s) atualizados.` });
      setIsNormalizeOpen(false);
      await refreshLeads();
    } catch (err: any) {
      console.error("Erro ao padronizar etapas:", err);
      toast({ title: "Erro ao padronizar", description: err?.message || "Tente novamente.", variant: "destructive" });
      await refreshLeads();
    } finally {
      setNormalizing(false);
    }
  };

  const visiblePhases = NEGOCIO_PHASES.filter((p) => activePhase === "all" || p.id === activePhase);

  const renderCard = (lead: Lead, isValidacao: boolean) => {
    const isSelected = selectedIds.has(lead.id);
    return (
    <div
      key={lead.id}
      draggable={!selectMode}
      onDragStart={(e) => {
        e.dataTransfer.setData("leadId", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={selectMode ? () => toggleSelected(lead.id) : undefined}
      className={`shrink-0 min-w-0 bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow ${
        selectMode ? "cursor-pointer select-none" : "cursor-grab active:cursor-grabbing"
      } ${isSelected ? "border-blue-500 ring-2 ring-blue-400/60 bg-blue-50/40" : "border-slate-200"}`}
    >
      <div className="flex items-start gap-1 min-w-0">
        {selectMode && (
          <span className="shrink-0 -ml-0.5 mr-0.5 text-blue-700" aria-hidden>
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            if (selectMode) return; // no modo seleção o clique marca o card
            e.stopPropagation();
            openLead(lead);
          }}
          className="flex-1 min-w-0 font-semibold text-[13px] text-slate-900 leading-tight text-left hover:underline truncate block"
          title={lead.nome}
        >
          {lead.nome || "Sem nome"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTimelineLeadId(lead.id);
          }}
          className="shrink-0 -mt-0.5 -mr-1 p-1 rounded text-slate-400 hover:text-blue-800 hover:bg-blue-50"
          title="Ver histórico (timeline)"
          aria-label="Ver histórico do lead"
        >
          <History className="w-3.5 h-3.5" />
        </button>
        {!selectMode && esteirasLista.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 -mt-0.5 -mr-1 p-1 rounded text-slate-400 hover:text-green-700 hover:bg-green-50"
                title="Escolher esteira"
                aria-label="Escolher esteira do lead"
              >
                <Workflow className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-xs">Esteira deste lead</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {esteirasLista.map((est) => {
                const atual = (lead as any).esteira_id === est.id;
                const ps = passosLista.filter((p) => p.esteira_id === est.id).sort((a, b) => a.ordem - b.ordem);
                const passoAtual = atual ? (lead as any).esteira_passo || 0 : -1;
                return (
                  <DropdownMenuSub key={est.id}>
                    <DropdownMenuSubTrigger className="text-sm">
                      {atual ? "✓ " : ""}
                      {est.nome}
                      {est.etapa ? <span className="ml-auto pl-2 text-[10px] text-muted-foreground">{est.etapa}</span> : null}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[60vh] overflow-y-auto">
                      <DropdownMenuLabel className="text-[11px] text-muted-foreground">Em qual dia da esteira?</DropdownMenuLabel>
                      {ps.length === 0 && (
                        <DropdownMenuItem disabled className="text-sm">
                          Esteira sem passos
                        </DropdownMenuItem>
                      )}
                      {ps.map((p, i) => (
                        <DropdownMenuItem key={p.id} disabled={i === passoAtual} onSelect={() => setLeadPasso(lead, est.id, i)} className="text-sm">
                          {i === passoAtual ? "✓ " : ""}
                          {p.titulo || `Passo ${i + 1}`}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })}
              {(lead as any).esteira_id && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setLeadEsteira(lead, null)} className="text-sm text-red-600">
                    Tirar da esteira
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-2 min-w-0">
        {lead.origem && (
          <span className={`max-w-full truncate text-[10px] px-1.5 py-0.5 rounded border ${origemBadgeClass(lead.origem)}`} title={lead.origem}>{lead.origem}</span>
        )}
      </div>

      {lead.telefone && (
        <div className="flex items-center gap-1.5 text-[12px] text-slate-700 mt-2 min-w-0">
          <Phone className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.telefone}</span>
        </div>
      )}
      {lead.email && <div className="text-[11px] text-slate-500 truncate mt-1" title={lead.email}>{lead.email}</div>}
      {lead.observacoes && (
        <div className="text-[11px] text-slate-500 mt-2 line-clamp-2 break-words" title={lead.observacoes}>
          {lead.observacoes}
        </div>
      )}
      {(() => {
        const est = infoEsteira(lead);
        if (!est) return null;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!selectMode) onNavigate?.("esteiras");
            }}
            className={`mt-2 w-full flex items-center gap-1 rounded border px-1.5 py-1 text-[10.5px] text-left ${
              est.hoje ? "bg-green-50 border-green-200 text-green-800" : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
            title="Abrir Esteiras"
          >
            <Workflow className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {est.nome} · {est.passo}{est.passo.startsWith("sem resposta") ? ` em ${est.quando}` : ` (${est.idx + 1}/${est.total || 1}) · ${est.hoje ? "envio hoje" : `próx. ${est.quando}`}`}
            </span>
          </button>
        );
      })()}
      <div className="text-[11px] text-slate-500 mt-2">Chegou {formatChegou(lead.created_at)}</div>

      {selectMode ? null : isValidacao ? (
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          <Button size="sm" className="h-8 min-w-0 px-1 gap-1 whitespace-nowrap bg-blue-800 hover:bg-blue-900 text-white text-[11px]" onClick={() => handleValidar(lead)}>
            <Check className="w-3 h-3 shrink-0" />
            <span className="truncate">Validar</span>
          </Button>
          <Button size="sm" variant="outline" className="h-8 min-w-0 px-1 gap-1 whitespace-nowrap text-[11px]" onClick={() => handleDescartar(lead)}>
            <X className="w-3 h-3 shrink-0" />
            <span className="truncate">Descartar</span>
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-1 mt-2">
          <button type="button" onClick={() => handleWhatsApp(lead)} className="p-1 rounded hover:bg-green-50 text-green-600" title="WhatsApp">
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => openLead(lead)} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Abrir lead">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
    );
  };

  const renderColumn = (stage: NegocioStage, accent: string) => {
    const stageLeads = leadsByStage[stage.id] || [];
    const isValidacao = stage.id === VALIDACAO_STAGE_ID;
    return (
      <div
        key={stage.id}
        className={`flex-shrink-0 w-[calc(100vw-56px)] max-w-[280px] sm:w-[240px] snap-start rounded-lg bg-slate-100/80 border-t-2 flex flex-col max-h-[calc(100dvh-260px)] min-h-[160px] transition-colors ${
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
        <div className="px-2.5 pt-2.5 pb-2">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[13px] text-slate-900 truncate" title={stage.name}>{stage.name}</span>
              <span className="text-[10px] font-medium bg-white border border-slate-200 rounded-full px-1.5 leading-4 text-slate-600">
                {stageLeads.length}
              </span>
            </div>
            {selectMode ? (
              stageLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleColumn(stageLeads)}
                  className="text-[11px] font-medium text-blue-700 hover:underline shrink-0"
                >
                  {stageLeads.every((l) => selectedIds.has(l.id)) ? "Desmarcar" : "Todos"}
                </button>
              )
            ) : !isValidacao && (
              <button type="button" onClick={() => openNewInStage(stage.id)} className="text-slate-400 hover:text-slate-700" title={`Novo negócio em ${stage.name}`}>
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          {isValidacao && (
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">Leads novos das campanhas. Valide para entrar no funil.</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden pl-2 pr-1.5 pb-2 flex flex-col gap-2 [scrollbar-gutter:stable] [scrollbar-width:thin]">
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
          <p className="text-sm text-muted-foreground">
            {selectMode
              ? "Toque nos cards para selecionar e escolha a etapa na barra de baixo."
              : "Arraste os cards entre as etapas ou use “Selecionar vários” para mover em lote."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar negócio..." className="pl-8 h-9 w-full sm:w-56" />
          </div>
          <SincronizarWhatsAppButton className="h-9" />
          {normalizationTotal > 0 && (
            <Button variant="outline" className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setIsNormalizeOpen(true)}>
              <Wand2 className="w-4 h-4 mr-1" /> Padronizar etapas ({normalizationTotal})
            </Button>
          )}
          <Button
            variant={selectMode ? "secondary" : "outline"}
            className="h-9"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            {selectMode ? <X className="w-4 h-4 mr-1" /> : <CheckSquare className="w-4 h-4 mr-1" />}
            {selectMode ? "Cancelar seleção" : "Selecionar vários"}
          </Button>
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
      <div className={`flex gap-4 overflow-x-auto min-w-0 snap-x snap-mandatory sm:snap-none overscroll-x-contain ${selectMode ? "pb-28" : "pb-4"}`}>
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

      {/* Barra de ação da seleção múltipla */}
      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-5xl rounded-xl border bg-white shadow-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:min-w-[150px]">
              <span className="text-sm font-semibold">
                {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
              </span>
              {selectedIds.size > 0 && (
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setSelectedIds(new Set())}>
                  Limpar
                </button>
              )}
            </div>
            <div className="flex flex-1 gap-2 min-w-0">
              <Select value={bulkTarget} onValueChange={setBulkTarget}>
                <SelectTrigger className="h-10 flex-1 min-w-0">
                  <SelectValue placeholder="Mover para a etapa..." />
                </SelectTrigger>
                <SelectContent className="max-h-[50vh]">
                  {NEGOCIO_PHASES.map((p) => (
                    <div key={p.id}>
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{p.label}</div>
                      {NEGOCIO_STAGES.filter((s) => s.phase === p.id).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="h-10 shrink-0 bg-blue-800 hover:bg-blue-900 text-white"
                disabled={!bulkTarget || selectedIds.size === 0 || bulkMoving}
                onClick={moveSelected}
              >
                <MoveRight className="w-4 h-4 mr-1" />
                {bulkMoving ? "Movendo..." : "Mover"}
              </Button>
            </div>
            {esteirasLista.length > 0 && (
              <div className="flex flex-1 gap-2 min-w-0">
                <Select value={bulkEsteira} onValueChange={setBulkEsteira}>
                  <SelectTrigger className="h-10 flex-1 min-w-0">
                    <SelectValue placeholder="Pôr na esteira..." />
                  </SelectTrigger>
                  <SelectContent>
                    {esteirasLista.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-10 shrink-0"
                  disabled={!bulkEsteira || selectedIds.size === 0 || bulkMoving}
                  onClick={putSelectedInEsteira}
                >
                  Pôr
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Novo negócio */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Novo negócio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nome *</Label>
              <Input value={newDeal.nome} onChange={(e) => setNewDeal({ ...newDeal, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Telefone *</Label>
                <Input value={newDeal.telefone} onChange={(e) => setNewDeal({ ...newDeal, telefone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="grid gap-1.5">
                <Label>Origem</Label>
                <Input value={newDeal.origem} onChange={(e) => setNewDeal({ ...newDeal, origem: e.target.value })} placeholder="roleta, Instagram..." />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail *</Label>
              <Input value={newDeal.email} onChange={(e) => setNewDeal({ ...newDeal, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Etapa</Label>
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
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={newDeal.observacoes} onChange={(e) => setNewDeal({ ...newDeal, observacoes: e.target.value })} placeholder="Interesse do lead..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-blue-800 hover:bg-blue-900 text-white">
              {saving ? "Salvando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Padronizar etapas */}
      <Dialog open={isNormalizeOpen} onOpenChange={setIsNormalizeOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Padronizar etapas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Estes leads estão gravados com nomes antigos ou alternativos. Ao aplicar, o status passa a ser o mesmo nas abas Leads, Funil e Negócios.
          </p>
          <div className="space-y-2">
            {normalizationGroups.map((g) => (
              <div key={`${g.from}-${g.to}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{g.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium truncate">{g.toName === g.to ? g.to : `${g.toName} (${g.to})`}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{g.ids.length} lead(s)</span>
              </div>
            ))}
          </div>
          {unmatchedStatuses.length > 0 && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              <span className="font-medium text-foreground">Sem etapa correspondente (não serão alterados, ficam na Validação):</span>{" "}
              {unmatchedStatuses.map(([st, n]) => `${st} (${n})`).join(", ")}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNormalizeOpen(false)} disabled={normalizing}>Cancelar</Button>
            <Button onClick={applyNormalization} disabled={normalizing} className="bg-blue-800 hover:bg-blue-900 text-white">
              {normalizing ? "Aplicando..." : `Aplicar em ${normalizationTotal} lead(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Timeline / histórico do lead */}
      <LeadTimeline
        leadId={timelineLeadId}
        isOpen={!!timelineLeadId}
        onClose={() => setTimelineLeadId(null)}
      />
    </div>
  );
}
