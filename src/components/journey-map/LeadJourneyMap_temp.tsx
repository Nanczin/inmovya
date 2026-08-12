import { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  NodeTypes,
  ReactFlowInstance,
  Handle,
  Position,
  MarkerType,
  addEdge,
  Connection,
  NodeResizer,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath
} from 'reactflow';
import { Checkbox } from "@/components/ui/checkbox";
import 'reactflow/dist/style.css';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X,
  Eye,
  Building2,
  Network,
  Home,
  Calendar,
  Trash2,
  MessageSquare,
  MessageCircle,
  Clock,
  DollarSign,
  User,
  Mail,
  Phone,
  Save,
  Bed,
  Bath,
  Car,
  Ruler,
  Check,
  Info as InfoIcon,
  Percent,
  TrendingUp,
  Star,
  Filter,
  MoreHorizontal,
  Bell
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/utils/formatUtils";
import { emailMarketing } from '@/lib/emailService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadTimeline } from '../LeadTimeline';
import { useLeads } from '../../context/LeadsContext';
import { useProperties } from '../../context/PropertiesContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";

// --- HELPER FUNCTIONS & EMAIL UTILS ---

const openEmailClient = (provider: 'default' | 'gmail' | 'outlook' | 'yahoo', email: string, message: string) => {
  if (!email) {
    alert('Lead sem email!');
    return;
  }
  const subject = encodeURIComponent("Follow-up");
  const body = encodeURIComponent(message || '');

  let url = "";

  switch (provider) {
    case 'gmail':
      url = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
      window.open(url, '_blank');
      break;
    case 'outlook':
      url = `https://outlook.office.com/mail/deeplink/compose?to=${email}&subject=${subject}&body=${body}`;
      window.open(url, '_blank');
      break;
    case 'yahoo':
      url = `https://compose.mail.yahoo.com/?to=${email}&subject=${subject}&body=${body}`;
      window.open(url, '_blank');
      break;
    default:
      url = `mailto:${email}?subject=Follow-up&body=${body}`;
      window.open(url, '_self');
      break;
  }
};

// --- HELPER FUNCTIONS FOR FUZZY MATCH ---

const normalizeKey = (str: string): string => {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, "") // Remove marcas de acento
    .trim();
};

// Mantido para uso no EditDrawer (busca textual se necessário)
const findPropertyMatch = (rawInteresse: string, properties: any[]) => {
  if (!rawInteresse) return null;

  const normalizedInput = normalizeKey(rawInteresse);

  // 1. Tentativa Direta (Exact Match no nome)
  const exactMatch = properties.find(p => normalizeKey(p.name) === normalizedInput);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. Tentativa Fuzzy (Partial Match)
  const fuzzyMatch = properties.find(p => {
    const normalizedName = normalizeKey(p.name);
    return normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName);
  });

  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  return null;
}

// --- CUSTOM NODES DEFINITION ---

const LeadNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-primary p-4 min-w-[240px] text-center relative hover:shadow-xl transition-all cursor-pointer group">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
        LEAD
      </div>
      <div className="mb-3 flex justify-center mt-2">
        <div className="bg-primary/10 p-3 rounded-full group-hover:bg-primary/20 transition-colors">
          <User className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="font-bold text-slate-800 text-lg leading-tight">{data.name}</div>

      <div className="mt-3 space-y-1 text-left bg-slate-50 p-2 rounded-lg border border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Mail className="w-3 h-3 text-slate-400" />
          <span className="truncate">{data.email}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Phone className="w-3 h-3 text-slate-400" />
          <span>{data.phone}</span>
        </div>

        <div className="pt-2 mt-2 border-t border-slate-200/60 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700 min-w-[60px]">Profissão:</span>
            <span className="truncate">{data.profissao || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700 min-w-[60px]">Renda:</span>
            <span>{data.renda || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700 min-w-[60px]">Entrada:</span>
            <span className="capitalize">{data.entradatxt || '-'}</span>
          </div>
        </div>

        {data.description && (
          <div className="pt-2 mt-2 border-t border-slate-200/60 text-xs text-slate-500 italic text-left">
            "{data.description}"
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !w-3 !h-3 !border-2 !border-white !-bottom-1.5"
      />

      {/* Timeline Action Button - Fixed on Node */}
      <div
        className="absolute -right-5 top-10 bg-white rounded-full p-2.5 shadow-md border-2 border-indigo-100 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400 hover:scale-110 transition-all z-50 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (data.onOpenTimeline) data.onOpenTimeline();
        }}
        title="Ver Histórico Completo"
      >
        <MessageSquare className="w-5 h-5" />
      </div>
    </div >
  );
};

const PropertyNode = ({ data }: { data: any }) => {
  return (
    <div className={`bg-white rounded-xl shadow-md border overflow-hidden w-[240px] transition-all cursor-pointer group border-slate-200 hover:ring-2 hover:ring-primary/50`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white !-top-1.5"
      />



      <div className="h-32 bg-slate-100 overflow-hidden relative group-hover:brightness-105 transition-all">
        {data.image ? (
          <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-8 h-8 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
          <div className="text-white font-bold text-sm shadow-black drop-shadow-md">{data.name}</div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs text-slate-600 leading-tight">
          {data.address}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <DollarSign className="w-3 h-3 text-green-600" />
          <span>{data.price}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !w-3 !h-3 !border-2 !border-white !-bottom-1.5"
      />
    </div>
  );
};

const StatusNode = ({ data }: { data: any }) => {
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('novo')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s.includes('agendada') || s.includes('visita')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s.includes('venda') || s.includes('proposta')) return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className={`rounded-lg border-2 p-3 min-w-[150px] shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-all ${getStatusColor(data.label)}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-2 !h-2 !-top-1.5"
      />

      <div className="bg-white/50 p-1.5 rounded-full">
        <Calendar className="w-4 h-4" />
      </div>
      <div className="text-xs font-bold uppercase tracking-wide">
        {data.label}
      </div>
    </div>
  );
};

// --- FOLLOW UP NODE --- //

const FollowUpNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-slate-50 rounded-lg shadow-sm border border-purple-200 p-3 min-w-[220px] max-w-[260px] flex items-start gap-3 cursor-pointer hover:shadow-md transition-all group relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-400 !w-2 !h-2 !-top-1.5"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-400 !w-2 !h-2 !-left-1.5"
      />

      <div className="bg-purple-100 p-2 rounded-full text-purple-600 group-hover:bg-purple-200 transition-colors shrink-0 mt-1">
        <Filter className="w-4 h-4" />
      </div>

      <div className="flex flex-col text-left w-full min-w-0">
        <div className="flex justify-between items-start w-full gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Funil</span>
            <span className="text-sm font-semibold text-slate-700 block leading-tight truncate" title={data.label}>{data.label}</span>
          </div>
          {data.isGlobal && (
            <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap shrink-0">
              Global
            </span>
          )}
        </div>

        <div className="space-y-2 mt-3 w-full">
          {/* Email Message Block */}
          {data.message && (
            <div className="bg-white p-2.5 rounded border border-blue-100 relative group/email shadow-sm">
              <div className="flex items-center gap-1.5 mb-2 border-b border-blue-50 pb-1.5">
                <Mail className="w-3 h-3 text-blue-500" />
                <span className="text-[9px] font-bold text-blue-600 uppercase">Email</span>
              </div>
              <span className="text-[10px] text-slate-600 italic line-clamp-3 leading-tight block mb-2 break-words" title={data.message}>
                "{data.message}"
              </span>
              <div className="flex gap-1 justify-end border-t border-slate-50 pt-1.5">
                <button
                  className="p-1.5 hover:bg-blue-50 rounded text-blue-500 transition-colors flex items-center gap-1 text-[10px] font-medium"
                  title="Enviar Email Agora"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!data.leadEmail) { alert('Lead sem email!'); return; }
                    window.open(`mailto:${data.leadEmail}?subject=${encodeURIComponent(data.subject || 'Follow-up')}&body=${encodeURIComponent(data.message)}`);
                  }}
                >
                  <Mail className="w-3 h-3" />
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp Message Block */}
          {data.whatsappMessage && (
            <div className="bg-white p-2.5 rounded border border-green-100 relative group/whatsapp shadow-sm">
              <div className="flex items-center gap-1.5 mb-2 border-b border-green-50 pb-1.5">
                <MessageCircle className="w-3 h-3 text-green-500" />
                <span className="text-[9px] font-bold text-green-600 uppercase">WhatsApp</span>
              </div>
              <span className="text-[10px] text-slate-600 italic line-clamp-3 leading-tight block mb-2 break-words" title={data.whatsappMessage}>
                "{data.whatsappMessage}"
              </span>
              <div className="flex gap-1 justify-end border-t border-slate-50 pt-1.5">
                <button
                  className="p-1.5 hover:bg-green-50 rounded text-green-500 transition-colors flex items-center gap-1 text-[10px] font-medium"
                  title="Enviar WhatsApp Agora"
                  onClick={(e) => {
                    e.stopPropagation();
                    const phone = data.leadPhone ? data.leadPhone.replace(/\D/g, '') : '';
                    if (!phone) { alert('Lead sem telefone!'); return; }
                    window.open(`https://web.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(data.whatsappMessage)}`, '_blank');
                  }}
                >
                  <MessageCircle className="w-3 h-3" />
                  Enviar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-400 !w-2 !h-2 !-bottom-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-400 !w-2 !h-2 !-right-1.5"
      />
    </div>
  );
};

// --- TEXT NODE --- //
const TextNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const fontSize = data.fontSize ? `${data.fontSize}px` : '14px';

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={50}
        isVisible={selected}
        lineClassName="border-blue-400 border-2 dashed"
        handleClassName="h-4 w-4 bg-blue-500 border border-white rounded shadow-md z-50"
      />
      <div className="h-full w-full relative group">
        {/* Target Handles - Always functional, visible on hover */}
        <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3 !-top-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto" />
        <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-3 !h-3 !-left-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto" />

        {/* Source Handles - Always functional, visible on hover */}
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-3 !h-3 !-right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto" />
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3 !-bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto" />

        <div
          className={`h-full w-full text-slate-700 bg-white/80 backdrop-blur-sm border rounded p-3 shadow-sm whitespace-pre-wrap break-words hover:bg-white transition-all hover:shadow-md cursor-pointer relative flex items-center justify-center ${data.isGlobal ? 'border-amber-400 ring-1 ring-amber-100' : 'border-slate-300/50 hover:border-slate-400'}`}
          style={{ fontSize }}
        >
          {data.isGlobal && (
            <div className="absolute -top-2.5 right-2 bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border border-amber-200">
              Global
            </div>
          )}
          {data.label || 'Novo Texto'}
        </div>
      </div>
    </>
  );
};


// --- TIMELINE NODE --- //
const TimelineNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-full w-12 h-12 shadow-md border-2 border-indigo-200 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer group hover:border-indigo-500">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !w-2 !h-2"
      />

      <div className="text-indigo-600 group-hover:text-indigo-700">
        <MessageSquare className="w-5 h-5" />
      </div>

      {/* Floating Label */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
        Ver Histórico
      </div>
    </div>
  );
};

// --- CUSTOM EDGE WITH DELETE BUTTON ---
const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    // Visual update
    setEdges((edges) => edges.filter((e) => e.id !== id));
    // Trigger business logic callback if provided
    if (data?.onDelete) {
      data.onDelete();
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-white border border-red-200 text-red-500 rounded-full cursor-pointer flex items-center justify-center hover:bg-red-50 shadow-sm transition-all hover:scale-110 z-50"
            onClick={onEdgeClick}
            aria-label="Desconectar"
            title="Desconectar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};


// --- HELPER: Fetch Global Funnels ---
const fetchGlobalFunnels = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('id, journey_map_data') // updated_at is usually implicit but let's assume standard behavior or just rely on the order if DB supports common fields. Actually, to be safe on the sort, I must select it if I order by it? Not strictly in SQL but Supabase api often ok. I will just add the order.
      .eq('user_id', user.id)
      .not('journey_map_data', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching global funnels:', error);
      return [];
    }

    const globalFunnels: any[] = [];

    allLeads?.forEach((lead) => {
      const journeyData = lead.journey_map_data as any;
      if (journeyData?.nodes) {
        journeyData.nodes.forEach((node: any) => {
          // Check for Global Funnels OR Global Text Nodes
          const isGlobalFunnel = node.type === 'followUpNode' && node.data?.applyToAll === true;
          const isGlobalText = node.type === 'textNode' && node.data?.applyToAll === true;

          if (isGlobalFunnel || isGlobalText) {
            // Create a unique global entry
            const cleanLabel = (node.data.label || '').trim();
            if (!cleanLabel) return;

            const prefix = isGlobalFunnel ? 'global-funnel-' : 'global-text-';
            const globalId = `${prefix}${cleanLabel}`;

            // Avoid duplicates (same ID)
            if (!globalFunnels.find(gf => gf.id === globalId)) {
              globalFunnels.push({
                id: globalId,
                type: node.type, // Store type to distinguish later
                label: node.data.label,
                message: node.data.message, // Funnel specific
                whatsappMessage: node.data.whatsappMessage, // Funnel specific
                senderName: node.data.senderName, // Funnel specific
                subject: node.data.subject, // Funnel specific
                targetPropertyIds: node.data.targetPropertyIds,
                applyToAll: true,
                sourceLeadId: lead.id,
                // Capture canonical position
                position: node.position,
                // Text specific
                fontSize: node.data.fontSize
              });
            }
          }
        });
      }
    });

    return globalFunnels;
  } catch (err) {
    console.error('Exception fetching global funnels:', err);
    return [];
  }
};

// --- BUILDER LOGIC ---

const buildJourneyData = (lead: any, properties: any[], globalFunnels: any[] = []) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 1. Lead Node (Topo)
  const leadNodeId = 'lead-main';
  const leadX = 400; // Centro horizontal
  const leadY = 50;  // Topo

  nodes.push({
    id: leadNodeId,
    type: 'leadNode',
    position: { x: leadX, y: leadY },
    data: {
      schema: 'lead',
      name: lead?.nome || 'Cliente Novo',
      email: lead?.email || 'Sem email',
      phone: lead?.telefone || 'Sem telefone',
      // Campos extras injetados
      renda: lead?.renda || (lead?.tags?.find((t: string) => t.startsWith("Renda: "))?.replace("Renda: ", "")),
      profissao: lead?.profissao || (lead?.tags?.find((t: string) => t.startsWith("Profissão: "))?.replace("Profissão: ", "")),
      entradatxt: (() => {
        // Lógica de exibição da entrada (Sim/Não + Valor)
        if (lead?.possuiEntrada === 'sim') {
          const valorFormatado = lead?.valorEntrada
            ? lead.valorEntrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '';
          // Remove o símbolo R$ duplicado se a entrada já vier formatada ou apenas garante a formatação limpa
          // Se o valorEntrada for numérico (do banco) ou string (do input), toLocaleString ou formatação manual resolve
          // Assumindo que pode vir "5000" ou "R$ 5000"
          const valorLimpo = String(lead?.valorEntrada || '').replace(/\D/g, '');
          const valorFinal = valorLimpo
            ? (parseInt(valorLimpo) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '';

          return valorFinal ? `Sim, ${valorFinal}` : 'Sim';
        }

        if (lead?.possuiEntrada === 'nao') return 'Não';

        // Fallback para tags antigas
        return lead?.tags?.find((t: string) => t.startsWith("Entrada: "))?.replace("Entrada: ", "");
      })(),
      // Ensure raw value is available for editing
      valorEntrada: lead?.valorEntrada || (() => {
        const tag = lead?.tags?.find((t: string) => t.startsWith("Entrada: Sim ("));
        if (tag) {
          // Extract "R$ 50.000" from "Entrada: Sim (R$ 50.000)"
          // "Entrada: Sim (" is 14 chars length? No.
          // "Entrada: " is 9 chars. "Sim (" is 5 chars. Total 14.
          // so we start at index 14.
          return tag.substring(14, tag.length - 1);
        }
        return '';
      })(),
      possuiEntrada: lead?.possuiEntrada || (() => {
        const tag = lead?.tags?.find((t: string) => t.startsWith("Entrada: "));
        if (tag) {
          if (tag.includes("Sim")) return 'sim';
          if (tag.includes("Não") || tag.includes("Nao")) return 'nao';
        }
        return '';
      })(),
      description: lead?.observacoes
    }
  });

  // 2. Property Nodes (Horizontally Distributed)
  const interessePrincipal = lead.empreendimento_id ? [lead.empreendimento_id] : [];

  // Procurar nas tags por "Interesse: Nome"
  const tagsInteresse = (lead.tags || [])
    .filter((t: string) => t.toLowerCase().startsWith("interesse: "))
    .map((t: string) => t.substring(11).trim()); // Remove "Interesse: " and trim

  const interessesDasTags = properties
    .filter((emp: any) => {
      const empName = emp.name.toLowerCase().trim();
      return tagsInteresse.some(tagName => tagName.toLowerCase() === empName || tagName.toLowerCase().includes(empName) || empName.includes(tagName.toLowerCase()));
    })
    .map((emp: any) => emp.id);

  // Combinar e remover duplicatas
  const allInterestIds = [...new Set([...interessePrincipal, ...interessesDasTags])];

  // Combine ALL sources of interest (DB array + Tags + Main Project) to ensure nothing is missed
  const interestIds = [...new Set([
    ...(lead?.interessesIds || []),
    ...allInterestIds
  ])];

  const propsY = 350; // Nível vertical dos imóveis
  const nodeWidth = 260; // Largura aproximada + gap
  const startX = leadX - ((interestIds.length - 1) * nodeWidth) / 2;

  let propertyNodeIds: string[] = [];

  interestIds.forEach((interestId: string, index: number) => {
    // Busca Exata pelo ID
    const property = properties.find((p: any) => p.id === interestId);

    if (property) {
      const propNodeId = `prop-${property.id}`;
      propertyNodeIds.push(propNodeId);

      const xPos = startX + (index * nodeWidth);

      nodes.push({
        id: propNodeId,
        type: 'propertyNode',
        position: { x: xPos, y: propsY },
        data: {
          schema: 'property',
          ...property, // Injeta tudo: name, address, price, image
          isMainInterest: false,
          // Adicionar informações das plantas
          plantas: property.precos_por_tipologia || property.caracteristicas || []
        }
      });

      // Automatic Edge Creation (Logic-Driven)
      // Connects logic (Tags/ID) to Visuals
      const hasTag = (lead.tags || []).includes(`Interesse: ${property.name}`);
      const isMain = lead.empreendimento_id === interestId;

      if (hasTag || isMain) {
        edges.push({
          id: `e-${leadNodeId}-${propNodeId}`,
          source: leadNodeId,
          target: propNodeId,
          type: 'deletableEdge', // Allows easy disconnection via clicking "X"
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }
        });
      }
    }
  });

  // 3. Follow Up Funnels (Vertical Stack below Lead)
  const funnelTags = (lead.tags || [])
    .filter((t: string) => t.startsWith("Funnel: "))
    .map((t: string) => t.replace("Funnel: ", ""));

  const leadNodeWidth = 240;
  const funnelStartX = leadX - 300;

  // Add local funnels from tags
  funnelTags.forEach((funnelName: string, index: number) => {
    const funnelNodeId = `funnel-${index}`;
    nodes.push({
      id: funnelNodeId,
      type: 'followUpNode',
      position: { x: funnelStartX, y: leadY + (index * 120) },
      data: {
        schema: 'funnel',
        label: funnelName,
        leadPhone: lead.telefone,
        leadEmail: lead.email
      }
    });
  });

  // Add global funnels (from other leads with applyToAll: true)
  // EVITAR DUPLICIDADE: Filtrar globais que já existem localmente nas tags
  const uniqueGlobalFunnels = globalFunnels.filter((gf: any) => !funnelTags.includes(gf.label));

  let globalFunnelIndex = 0;
  uniqueGlobalFunnels.forEach((globalFunnel: any) => {
    // FILTER: Check if this global funnel targets specific properties
    if (globalFunnel.targetPropertyIds && globalFunnel.targetPropertyIds.length > 0) {
      // Logic: Only show if the lead generally matches ONE of the target properties
      const leadInterests = interestIds.map(id => String(id).trim()); // Normalize to strings and trim
      const targetIds = globalFunnel.targetPropertyIds.map((id: string) => String(id).trim()); // Normalize to strings and trim

      const hasMatch = targetIds.some((targetId) => leadInterests.includes(targetId));

      let hasTagMatch = false;
      if (!hasMatch) {
        // Fallback: Check by Name against Tags
        // Resolve Target IDs to Names
        const targetNames = properties
          .filter((p: any) => targetIds.includes(String(p.id).trim()))
          .map((p: any) => p.name.toLowerCase().trim());

        const leadTags = (lead.tags || []).map((t: string) => t.toLowerCase().trim());

        hasTagMatch = leadTags.some(tag =>
          targetNames.some(name => tag.includes(name) || name.includes(tag.replace('interesse:', '').trim()))
        );
      }

      console.log(`Funnel "${globalFunnel.label}": ID Match: ${hasMatch}, Tag Name Match: ${hasTagMatch}`);

      // If no match found (neither ID nor Name), SKIP this funnel for this lead
      if (!hasMatch && !hasTagMatch) return;
    }

    const globalFunnelNodeId = globalFunnel.id;

    // STRICT DEDUPLICATION: Check if this node ID OR Label already exists
    // consistently handles "already added via Local Tags" or "Duplicate Global"
    const alreadyExists = nodes.some(n =>
      n.id === globalFunnelNodeId ||
      // Match by Label + Type to prevent duplicates
      (n.type === globalFunnel.type && n.data?.label === globalFunnel.label)
    );

    if (alreadyExists) return;

    // Determine type-specific data
    const isTextNode = globalFunnel.type === 'textNode';
    const nodeType = isTextNode ? 'textNode' : 'followUpNode';
    const nodeSchema = isTextNode ? 'text' : 'funnel';

    const yOffset = (funnelTags.length + globalFunnelIndex) * 120; // Position after local funnels
    globalFunnelIndex++;

    const nodeData = {
      schema: nodeSchema,
      label: globalFunnel.label,
      targetPropertyIds: globalFunnel.targetPropertyIds,
      applyToAll: true,
      isGlobal: true, // Mark as global for UI indication
    };

    if (isTextNode) {
      Object.assign(nodeData, {
        fontSize: globalFunnel.fontSize
      });
    } else {
      // Add Funnel specific data
      Object.assign(nodeData, {
        message: globalFunnel.message,
        whatsappMessage: globalFunnel.whatsappMessage,
        senderName: globalFunnel.senderName,
        subject: globalFunnel.subject,
        originalMessage: globalFunnel.message,
        leadPhone: lead.telefone,
        leadEmail: lead.email
      });
    }

    nodes.push({
      id: globalFunnel.id,
      type: isTextNode ? 'textNode' : 'followUpNode',
      position: globalFunnel.position, // Use canonical position from master
      data: nodeData,
      width: globalFunnel.width,   // Restore dimensions
      height: globalFunnel.height, // Restore dimensions
      style: globalFunnel.style    // Restore style (e.g. width/height in style prop)
    });
  });



  // AUTOMATIC FUNNEL EDGE DISABLED
  /*
  edges.push({
    id: `e-${leadNodeId}-${funnelNodeId}`,
    source: leadNodeId,
    target: funnelNodeId,
    type: 'default', // Simple line
    animated: true,
    style: { stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '4' },
  });
  */

  // Final Deduplication of Nodes (Safety Net - ID AND Label)
  const uniqueNodes: any[] = [];
  const validIds = new Set();
  const validLabels = new Set();

  nodes.forEach(n => {
    let isDuplicate = false;

    // 1. Check ID
    if (validIds.has(n.id)) isDuplicate = true;

    // 2. Check Label (for followUpNodes only) to prevent visual stacking
    if (!isDuplicate && n.type === 'followUpNode' && n.data?.label) {
      if (validLabels.has(n.data.label)) isDuplicate = true;
    }

    if (!isDuplicate) {
      uniqueNodes.push(n);
      validIds.add(n.id);
      if (n.type === 'followUpNode' && n.data?.label) {
        validLabels.add(n.data.label);
      }
    }
  });

  return { nodes: uniqueNodes, edges };
};

// --- SUBSIDIARY COMPONENTS ---

const EditDrawer = ({
  isOpen,
  onClose,
  data,
  lead,
  onSave,
  onDelete
}: {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  lead?: any;
  onSave: (newData: any) => void;
  onDelete?: (nodeId: string, schema: string) => void;
}) => {
  const { properties } = useProperties();

  // HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [formData, setFormData] = useState(data || {});

  // --- INTEGRATION STATE ---
  const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && data?.schema === 'funnel') {
      supabase.auth.getUser().then(({ data: { user } }) => {
        supabase.from('gmail_accounts')
          .select('id, email')
          .eq('user_id', user?.id)
          .eq('is_active', true)
          .then(({ data: accounts }) => {
            if (accounts) setGmailAccounts(accounts);
          });
      });
    }
  }, [isOpen, data]);

  const handleSystemEmail = async (accountId: string) => {
    try {
      if (!formData.leadEmail) {
        toast({ title: "Erro", description: "Lead sem email cadastrado.", variant: "destructive" });
        return;
      }

      toast({ title: "Enviando...", description: "Processando envio via sistema..." });

      // Attempt to send
      // Check for HTML content to support custom templates
      const rawMessage = formData.message || '';
      const hasHtmlTags = /<[a-z][\s\S]*>/i.test(rawMessage);
      const htmlBody = hasHtmlTags ? rawMessage : rawMessage.replace(/\n/g, '<br>');

      const result = await emailMarketing({
        to: formData.leadEmail,
        subject: formData.subject || "Follow-up",
        html: htmlBody,
        name: lead?.nome || 'Cliente',
        senderName: formData.senderName?.replace(/['"]/g, ''),
        accountId
      });

      // Validar resultado
      if (result && result.success) {
        toast({ title: "Email Enviado", description: "Mensagem enviada com sucesso!" });
      } else {
        const errorMsg = result?.error || result?.message || "O serviço de e-mail retornou falha.";
        console.error("Email service returned failure:", result);
        toast({
          title: "Erro no Envio",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Critical error sending email:", error);
      toast({
        title: "Erro de Sistema",
        description: "Falha na comunicação: " + (error.message || 'Erro desconhecido'),
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (data) {
      console.log('🔍 Drawer Data:', data);
      console.log('📦 Plantas:', data.plantas || data.precos_por_tipologia);
      console.log('⭐ Diferenciais:', data.diferenciais);

      setFormData({
        ...data,
        // Garantir que plantas e diferenciais estejam disponíveis
        plantas: data.plantas || data.precos_por_tipologia || [],
        diferenciais: data.diferenciais || [],
        amenities: data.amenities || data.comodidades || []
      });
    }
  }, [data]);

  // Early return AFTER all hooks
  if (!isOpen || !data) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const mapInternalToLeadKeys = (internalData: any) => {
    // Mapeia dados do formulário interno de volta para o schema do LEAD
    const updates: any = {};
    // Fallback: Check for schema OR presence of lead-specific fields (robustness)
    if (internalData.schema === 'lead' || (!internalData.schema && (internalData.email !== undefined || internalData.name !== undefined))) {
      updates.nome = internalData.name;
      updates.email = internalData.email;
      updates.telefone = internalData.phone;
      updates.renda = internalData.renda;
      updates.profissao = internalData.profissao;
      // Map correctly back to DB fields using robust check
      updates.possuiEntrada = (internalData.entradatxt === 'Sim' || internalData.possuiEntrada === 'sim') ? 'sim' : ((internalData.entradatxt === 'Não' || internalData.possuiEntrada === 'nao') ? 'nao' : '');
      updates.valorEntrada = internalData.valorEntrada;

      // Interesses são passados como array
      if (internalData.selectedInterests) {
        // IDs já estão no formato correto, passar direto
        updates.interessesIds = internalData.selectedInterests;
      }
    } else if (internalData.schema === 'status') {
      updates.status = internalData.label;
    } else if (internalData.schema === 'property') {
      // Se mudou o empreendimento (via Select), o 'interesse' muda
      // Adaptação para array de IDs
      const selectedProp = properties.find(p => p.id === internalData.selectedInterestKey);
      updates.interessesIds = selectedProp ? [selectedProp.id] : [];
    } else if (internalData.schema === 'funnel') {
      // For funnel, we update the node data specifically, not the lead
      // This will be caught by the onSave wrapper to update node state
      return {
        ...internalData,
        label: internalData.label,
        message: internalData.message,
        whatsappMessage: internalData.whatsappMessage,
        senderName: internalData.senderName,
        subject: internalData.subject,
        applyToAll: internalData.applyToAll, // Include global flag
        hasReminder: internalData.hasReminder, // Reminder Toggle
        reminderMessage: internalData.reminderMessage, // Reminder Content
        reminderDays: internalData.reminderDays // Reminder Offset
      };
    }
    return updates;
  };

  const handleSave = async () => {
    try {
      console.log('📝 EditDrawer Saving:', formData);

      // Prepara dados para o Context updater
      const updates = mapInternalToLeadKeys(formData);

      // Adicionamos a Selected Key se vier do Select de Property
      if (formData.schema === 'property' && formData.updatedRegistryKey) {
        updates.interessesIds = [formData.updatedRegistryKey];
      }

      // Pass raw form data if it's a funnel so we can update local state
      if (formData.schema === 'funnel' || formData.schema === 'text') {
        // Sanitize targetPropertyIds to ensure it's an array
        const payload = {
          ...formData,
          isGlobal: formData.isGlobal || formData.applyToAll, // Critical: Ensure we know it's global
          targetPropertyIds: Array.isArray(formData.targetPropertyIds) ? formData.targetPropertyIds : []
        };
        await onSave(payload);
      } else {
        await onSave(updates);
      }
    } catch (error: any) {
      console.error('❌ Criticial: Failed to save in EditDrawer:', error);
      toast({
        title: "Erro",
        description: "Falha ao processar salvamento: " + (error.message || error),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[350px] bg-white shadow-2xl border-l border-slate-100 z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-slate-800">{data.title || 'Editar Detalhes'}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-slate-200">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* --- FORMULÁRIO DE LEAD --- */}
        {data.schema === 'lead' && (
          <>
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  // Remove all non-digits
                  const digits = value.replace(/\D/g, '');

                  // Apply formatting: (xx) xxxxx-xxxx
                  let formatted = digits;
                  if (digits.length > 0) {
                    if (digits.length <= 2) {
                      formatted = `(${digits}`;
                    } else if (digits.length <= 7) {
                      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                    } else {
                      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
                    }
                  }

                  handleChange('phone', formatted);
                }}
                maxLength={15}
                placeholder="(11) 98765-4321"
              />
            </div>

            <div className="pt-4 border-t mt-4 mb-2">
              <Label className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3 block">Dados Financeiros</Label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-2">
                  <Label className="text-xs">Profissão</Label>
                  <Input
                    className="h-8 text-sm"
                    value={formData.profissao || ''}
                    onChange={(e) => handleChange('profissao', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Renda Mensal</Label>
                  <Input
                    className="h-8 text-sm"
                    value={formData.renda || ''}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      handleChange('renda', formatted);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-2">
                  <Label className="text-xs">Possui Entrada?</Label>
                  <Select
                    value={(formData.possuiEntrada === 'sim' || formData.entradatxt === 'Sim' || formData.entradatxt === 'sim') ? 'Sim' : ((formData.possuiEntrada === 'nao' || formData.entradatxt === 'Não' || formData.entradatxt === 'nao') ? 'Não' : '')}
                    onValueChange={(val) => {
                      handleChange('entradatxt', val);
                      // Update underlying field too for consistency
                      handleChange('possuiEntrada', val === 'Sim' ? 'sim' : 'nao');

                      // Clear value if choosing No
                      if (val === 'Não') handleChange('valorEntrada', '');
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.possuiEntrada === 'sim' || formData.entradatxt === 'Sim' || formData.entradatxt === 'sim' || formData.entradatxt?.startsWith('Sim,')) && (
                  <div className="space-y-2">
                    <Label className="text-xs">Valor da Entrada</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="R$ 0,00"
                      value={formData.valorEntrada || ''}
                      onChange={(e) => {
                        const formatted = formatCurrency(e.target.value);
                        handleChange('valorEntrada', formatted);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t mt-2">
              <Label className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3 block">Empreendimentos de Interesse</Label>
              <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-2 bg-slate-50">
                {properties.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum empreendimento cadastrado</div>
                ) : (
                  properties.map((prop) => (
                    <div key={prop.id} className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-slate-200 hover:border-primary/50 transition-all shadow-sm">
                      <Checkbox
                        id={`drawer-interest-${prop.id}`}
                        className="h-4 w-4 min-w-[16px] min-h-[16px] rounded-sm border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0 transition-all"
                        style={{ width: '16px', height: '16px' }}
                        checked={(formData.selectedInterests || []).includes(prop.id)}
                        onCheckedChange={(checked) => {
                          const currentSelected = formData.selectedInterests || [];
                          let newSelected;
                          if (checked) {
                            newSelected = [...currentSelected, prop.id];
                          } else {
                            newSelected = currentSelected.filter((id: string) => id !== prop.id);
                          }
                          handleChange('selectedInterests', newSelected);
                        }}
                      />
                      <Label
                        htmlFor={`drawer-interest-${prop.id}`}
                        className="text-sm cursor-pointer flex items-center justify-between w-full font-medium text-slate-700"
                      >
                        <span className="truncate pr-2">{prop.name}</span>
                        {prop.status && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-100 text-slate-600 border-slate-200 whitespace-nowrap">
                            {prop.status}
                          </Badge>
                        )}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* --- DETALHES DO IMÓVEL COM ABAS --- */}
        {data.schema === 'property' && (
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4 h-9">
              <TabsTrigger value="resumo" className="text-[10px] px-1">Resumo</TabsTrigger>
              <TabsTrigger value="detalhes" className="text-[10px] px-1">Detalhes</TabsTrigger>
              <TabsTrigger value="plantas" className="text-[10px] px-1">Plantas</TabsTrigger>
              <TabsTrigger value="comod" className="text-[10px] px-1">Comod.</TabsTrigger>
              <TabsTrigger value="comercial" className="text-[10px] px-1">Comercial</TabsTrigger>
            </TabsList>

            {/* ABA RESUMO */}
            <TabsContent value="resumo" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 relative shadow-sm">
                {formData.image ? (
                  <img src={formData.image} alt={formData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <Home className="w-10 h-10" />
                  </div>
                )}
                {formData.status && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-white/90 text-slate-800 hover:bg-white shadow-sm backdrop-blur-sm border-0">
                      {formData.status}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 leading-tight">{formData.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{formData.address}</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 font-semibold">
                <DollarSign className="w-4 h-4" />
                <span className="text-md">{formData.price}</span>
                <span className="text-[10px] text-green-600 font-normal ml-auto">Valor Inicial</span>
              </div>

              {formData.description && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed border border-slate-100 max-h-40 overflow-y-auto">
                  {formData.description}
                </div>
              )}
            </TabsContent>

            {/* ABA DETALHES */}
            <TabsContent value="detalhes" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center gap-1">
                  <Bed className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{formData.details?.bedrooms || '-'}</span>
                  <span className="text-[10px] text-slate-500 uppercase">Dormitórios</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center gap-1">
                  <Bath className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{formData.details?.bathrooms || '-'}</span>
                  <span className="text-[10px] text-slate-500 uppercase">Banheiros</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center gap-1">
                  <Car className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{formData.details?.parking || '-'}</span>
                  <span className="text-[10px] text-slate-500 uppercase">Vagas</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center gap-1">
                  <Ruler className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{formData.details?.area || '-'}</span>
                  <span className="text-[10px] text-slate-500 uppercase">Área Priv.</span>
                </div>
              </div>
            </TabsContent>

            {/* ABA PLANTAS */}
            <TabsContent value="plantas" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {formData.plantas && formData.plantas.length > 0 ? (
                <div className="space-y-3">
                  {formData.plantas.map((planta: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="font-semibold text-sm text-slate-800 mb-2">
                        {planta.nome || `Planta ${idx + 1}`}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {planta.dormitorios && (
                          <div>
                            <span className="text-slate-500">Dorms:</span>
                            <span className="ml-1 font-medium text-slate-700">{planta.dormitorios}</span>
                          </div>
                        )}
                        {planta.banheiros && (
                          <div>
                            <span className="text-slate-500">Banh:</span>
                            <span className="ml-1 font-medium text-slate-700">{planta.banheiros}</span>
                          </div>
                        )}
                        {planta.vagas && (
                          <div>
                            <span className="text-slate-500">Vagas:</span>
                            <span className="ml-1 font-medium text-slate-700">{planta.vagas}</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                        {planta.areaPrivativa && (
                          <div>
                            <span className="text-slate-500">Área Priv:</span>
                            <span className="ml-1 font-medium text-slate-700">{planta.areaPrivativa}</span>
                          </div>
                        )}
                        {planta.areaTotal && (
                          <div>
                            <span className="text-slate-500">Área Total:</span>
                            <span className="ml-1 font-medium text-slate-700">{planta.areaTotal}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">Nenhuma planta cadastrada.</div>
              )}
            </TabsContent>

            {/* ABA COMODIDADES */}
            <TabsContent value="comod" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-4">
                {/* Comodidades */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase">Comodidades</h4>
                  {formData.amenities && formData.amenities.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {formData.amenities.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 p-2 bg-slate-50 rounded border border-slate-100">
                          <Check className="w-3 h-3 text-green-500" />
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-xs">Nenhuma comodidade cadastrada.</div>
                  )}
                </div>

                {/* Diferenciais */}
                {formData.diferenciais && formData.diferenciais.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase">Diferenciais</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {formData.diferenciais.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 p-2 bg-amber-50 rounded border border-amber-100">
                          <Star className="w-3 h-3 text-amber-500" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ABA COMERCIAL */}
            <TabsContent value="comercial" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-600 font-medium">
                      {formData.status === 'Entregue' ? 'Data de Entrega' : 'Previsão de Entrega'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {formData.commercial?.delivery || 'Não informado'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-slate-700">Desempenho de Vendas</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Vendidas: {formData.commercial?.unitsSold || 0}</span>
                    <span>Total: {formData.commercial?.unitsTotal || 0}</span>
                  </div>
                  {/* Simple Progress Bar */}
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, ((formData.commercial?.unitsSold || 0) / (formData.commercial?.unitsTotal || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-xs">
                  <div className="flex items-center gap-2 mb-1 font-bold">
                    <InfoIcon className="w-4 h-4" />
                    Informações Importantes
                  </div>
                  <p className="leading-relaxed opacity-90">
                    Para tabelas de preços atualizadas e condições especiais de pagamento, consulte o módulo de Empreendimentos ou entre em contato com o gestor.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* --- FORMULÁRIO DE STATUS --- */}
        {data.schema === 'status' && (
          <div className="space-y-2">
            <Label>Fase Atual</Label>
            <Select
              value={formData.label || ''}
              onValueChange={(val) => handleChange('label', val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Visita Agendada">Visita Agendada</SelectItem>
                <SelectItem value="Visitado">Visitado</SelectItem>
                <SelectItem value="Proposta">Proposta</SelectItem>
                <SelectItem value="Venda Fechada">Venda Fechada</SelectItem>
                <SelectItem value="Perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* --- FORMULÁRIO DE FUNIL --- */}
        {data.schema === 'funnel' && (
          <div className="space-y-4">
            {/* REMINDER TOGGLE */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-blue-900">🔔 Lembrete ao Conectar</Label>
                <p className="text-[10px] text-blue-600">
                  Criar tarefa quando imóvel conectar
                </p>
              </div>
              <Checkbox
                checked={formData.hasReminder || false}
                onCheckedChange={(checked) => handleChange('hasReminder', checked)}
                className="data-[state=checked]:bg-blue-600 border-blue-400"
              />
            </div>

            {formData.hasReminder && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-blue-900">Mensagem do Lembrete</Label>
                <Input
                  className="bg-blue-50/50 border-blue-200"
                  value={formData.reminderMessage || ''}
                  placeholder="Ex: Ligar para verificar interesse"
                  onChange={(e) => handleChange('reminderMessage', e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-blue-900 text-xs">Agendar para</Label>
                    <Select
                      value={formData.reminderDays ? String(formData.reminderDays) : "0"}
                      onValueChange={(v) => handleChange('reminderDays', parseInt(v))}
                    >
                      <SelectTrigger className="mt-1 bg-white border-blue-200 text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No mesmo dia</SelectItem>
                        <SelectItem value="1">1 dia após</SelectItem>
                        <SelectItem value="2">2 dias após</SelectItem>
                        <SelectItem value="3">3 dias após</SelectItem>
                        <SelectItem value="7">Uma semana após</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}


            <div className="space-y-2">
              <Label>Nome do Funil</Label>
              <Input
                value={formData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do Remetente (Exibição)</Label>
              <Input
                value={formData.senderName || ''}
                placeholder="Ex: Seu Nome ou Empresa"
                onChange={(e) => handleChange('senderName', e.target.value.replace(/['"]/g, ''))}
              />
            </div>
            <div className="space-y-2">
              <Label>Assunto do Email</Label>
              <Input
                value={formData.subject || ''}
                placeholder="Assunto da mensagem..."
                onChange={(e) => handleChange('subject', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex justify-between items-center">
                Mensagem do Email
                <span className="text-[10px] text-muted-foreground font-normal bg-slate-100 px-1.5 py-0.5 rounded">Suporta HTML</span>
              </Label>
              <Textarea
                className="min-h-[100px] text-xs resize-none"
                placeholder="Escreva a mensagem a ser enviada..."
                value={formData.message || ''}
                onChange={(e) => handleChange('message', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem do WhatsApp</Label>
              <Textarea
                className="min-h-[80px] text-xs resize-none"
                placeholder="Mensagem para envio via WhatsApp..."
                value={formData.whatsappMessage || ''}
                onChange={(e) => handleChange('whatsappMessage', e.target.value)}
              />

              {/* TEST REMINDER BUTTON */}
              {formData.hasReminder && (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      const reminderMsg = formData.reminderMessage || `Lembrete: ${formData.label}`;
                      const daysOffset = formData.reminderDays || 0;
                      const dueDate = new Date();
                      dueDate.setDate(dueDate.getDate() + daysOffset);

                      const payload = {
                        title: reminderMsg,
                        description: `Lembrete de teste criado manualmente para o funil "${formData.label}"`,
                        lead_id: leadId,
                        user_id: lead.user_id,
                        due_date: dueDate.toISOString(),
                        status: 'pending',
                        priority: 'high',
                        type: 'reminder'
                      };

                      supabase.from('tasks').insert([payload]).then(({ error }) => {
                        if (!error) {
                          toast({
                            title: "🔔 Lembrete de Teste Criado",
                            description: `Tarefa agendada para ${daysOffset === 0 ? 'hoje' : `${daysOffset} dia(s)`}: ${reminderMsg}`
                          });
                        } else {
                          toast({
                            title: "Erro ao criar lembrete",
                            description: error.message,
                            variant: "destructive"
                          });
                        }
                      });
                    }}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Testar Lembrete Agora
                  </Button>
                </div>
              )}

              {/* DRAWER ACTION BUTTONS */}
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => {
                    const phone = formData.leadPhone ? formData.leadPhone.replace(/\D/g, '') : '';
                    if (!phone) { alert('Lead sem telefone!'); return; }
                    const msg = formData.whatsappMessage || formData.message || '';
                    window.open(`https://web.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                >
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Mail className="w-3 h-3" />
                      Email
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Enviar via Sistema (Inmovya)</DropdownMenuLabel>
                    {gmailAccounts.length > 0 ? (
                      gmailAccounts.map((acc: any) => (
                        <DropdownMenuItem key={acc.id} onClick={() => handleSystemEmail(acc.id)}>
                          <span className="truncate max-w-[200px] font-medium">{acc.email}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground">Nenhuma conta ativa</div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Apps Externos</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => openEmailClient('default', formData.leadEmail, formData.message)}>
                      App Padrão
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEmailClient('gmail', formData.leadEmail, formData.message)}>
                      Gmail
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEmailClient('outlook', formData.leadEmail, formData.message)}>
                      Outlook Web
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEmailClient('yahoo', formData.leadEmail, formData.message)}>
                      Yahoo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>


          </div>
        )}

        {/* --- FORMULÁRIO DE TEXTO (NOVO) --- */}
        {data.schema === 'text' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conteúdo do Texto</Label>
              <Textarea
                value={formData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                rows={8}
                className="bg-white min-h-[150px]"
                placeholder="Digite seu texto aqui..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tamanho da Fonte ({formData.fontSize || 14}px)</Label>
              <input
                type="range"
                min="10"
                max="48"
                step="2"
                className="w-full"
                value={formData.fontSize || 14}
                onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              />
            </div>

