import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  NodeResizer,
  SelectionMode
} from 'reactflow';
import { Checkbox } from "@/components/ui/checkbox";
import 'reactflow/dist/style.css';

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
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
  Bell,
  Type,
  Hand,
  RefreshCw,
  Copy,
  CalendarPlus
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
import { TaskDialog } from '../dialogs/TaskDialog';
import { useLeads } from '../../context/LeadsContext';
import { useProperties } from '../../context/PropertiesContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { useNotifications } from '@/hooks/useNotifications';


interface LeadJourneyMapProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'dialog' | 'page';
  addNotification?: (notification: any) => void;
}

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
        {/* Novos Campos Financeiros INTEGRADOS */}
        {(data.renda || data.profissao || data.entradatxt) && (
          <div className="pt-2 mt-2 border-t border-slate-200/60 flex flex-col gap-1">
            {data.profissao && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 min-w-[60px]">Profissão:</span>
                <span className="truncate">{data.profissao}</span>
              </div>
            )}
            {data.renda && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 min-w-[60px]">Renda:</span>
                <span>{data.renda}</span>
              </div>
            )}
            {data.entradatxt && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 min-w-[60px]">Entrada:</span>
                <span className="capitalize">{data.entradatxt}</span>
              </div>
            )}
          </div>
        )}

        {/* Description / Observacoes */}
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
  const { toast } = useToast();

  return (
    <div className="bg-slate-50 rounded-lg shadow-sm border border-purple-200 p-3 min-w-[220px] max-w-[260px] flex items-start gap-3 cursor-pointer hover:shadow-md transition-all group relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-400 !w-2 !h-2 !-top-1.5"
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
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!data.leadEmail) {
                      toast({ title: "Erro", description: "Lead sem email!", variant: "destructive" });
                      return;
                    }

                    try {
                      toast({ title: "Conectando...", description: "Verificando conta Gmail..." });

                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
                        return;
                      }

                      const { data: accounts } = await supabase.from('gmail_accounts')
                        .select('id, email')
                        .eq('user_id', user.id)
                        .eq('is_active', true)
                        .limit(1);

                      if (!accounts || accounts.length === 0) {
                        toast({ title: "Erro", description: "Nenhuma conta Gmail conectada. Vá em Integrações.", variant: "destructive" });
                        return;
                      }

                      const accountId = accounts[0].id;

                      const processedSubject = replacePlaceholders(data.subject || 'Follow-up', data.leadName, data.propertyNames || []);
                      const processedMessage = replacePlaceholders(data.message || '', data.leadName, data.propertyNames || []);
                      const htmlBody = processedMessage.replace(/\n/g, '<br>');

                      toast({ title: "Enviando", description: "Enviando email automaticamente..." });

                      const result = await emailMarketing({
                        to: data.leadEmail,
                        subject: processedSubject,
                        html: htmlBody,
                        name: data.leadName,
                        senderName: data.senderName,
                        accountId: accountId
                      });

                      if (result && result.success) {
                        toast({ title: "Sucesso", description: "Email enviado com sucesso!" });
                      } else {
                        toast({ title: "Erro", description: result?.error || "Falha ao enviar email.", variant: "destructive" });
                      }
                    } catch (err) {
                      console.error('Email send error:', err);
                      toast({ title: "Erro", description: "Erro interno ao enviar.", variant: "destructive" });
                    }
                  }}
                >
                  <Mail className="w-3 h-3" />
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp Message Block */}
          {(data.whatsappMessage || data.attachmentUrl) && (
            <div className="bg-white p-2.5 rounded border border-green-100 relative group/whatsapp shadow-sm">
              <div className="flex items-center gap-1.5 mb-2 border-b border-green-50 pb-1.5">
                <MessageCircle className="w-3 h-3 text-green-500" />
                <span className="text-[9px] font-bold text-green-600 uppercase">WhatsApp</span>
              </div>
              <span className="text-[10px] text-slate-600 italic line-clamp-3 leading-tight block mb-2 break-words" title={data.whatsappMessage}>
                "{data.whatsappMessage || (data.attachmentUrl ? '📎 Apenas Anexo' : '')}"
              </span>

              {data.attachmentName && (
                <div className="flex items-center gap-1.5 mt-2 mb-2 p-1.5 bg-green-50 rounded border border-green-100 text-[10px] text-green-700">
                  <span className="font-bold">📎 Anexo:</span>
                  <a href={data.attachmentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                    {data.attachmentName}
                  </a>
                </div>
              )}
              <div className="flex gap-1 justify-end border-t border-slate-50 pt-1.5">
                <button
                  className="p-1.5 hover:bg-green-50 rounded text-green-500 transition-colors flex items-center gap-1 text-[10px] font-medium"
                  title="Enviar WhatsApp Agora"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const phone = data.leadPhone ? data.leadPhone.replace(/\D/g, '') : '';
                    if (!phone) { alert('Lead sem telefone!'); return; }

                    // Se tiver anexo que é imagem (não GIF), copiar para clipboard
                    if (data.attachmentUrl) {
                      const isGif = data.attachmentUrl.match(/\.gif$/i) != null;
                      const isImage = data.attachmentUrl.match(/\.(jpeg|jpg|png|webp)$/i) != null;

                      if (isImage && !isGif) {
                        try {
                          const response = await fetch(data.attachmentUrl);
                          const blob = await response.blob();

                          // Verificar se o tipo é suportado pela Clipboard API
                          if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/jpg' || blob.type === 'image/webp') {
                            await navigator.clipboard.write([
                              new ClipboardItem({
                                [blob.type]: blob
                              })
                            ]);
                          }
                        } catch (err) {
                          console.error("Erro ao copiar imagem:", err);
                          // Silencioso - link está na mensagem como backup
                        }
                      }
                      // GIFs não podem ser copiados via Clipboard API (limitação do navegador)
                      // O link sempre vai na mensagem como backup
                    }

                    let finalMessage = data.whatsappMessage || '';
                    if (data.attachmentUrl && !finalMessage.includes(data.attachmentUrl)) {
                      finalMessage += `\n\n📎 Anexo: ${data.attachmentUrl}`;
                    }

                    const processedMessage = replacePlaceholders(finalMessage, data.leadName, data.propertyNames || []);

                    window.open(`https://web.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(processedMessage)}`, '_blank');
                  }}
                >
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
    </div >
  );
};

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

// --- GROUP NODE --- //
const GroupNode = ({ data, selected }: { data: any, selected: boolean }) => {
  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400 border-2 dashed"
        handleClassName="h-4 w-4 bg-blue-500 border border-white rounded shadow-md z-50"
      />
      <div className={`h-full w-full bg-slate-50/50 border-2 border-dashed rounded-lg p-4 relative transition-colors group ${selected ? 'border-blue-400 bg-blue-50/10' : 'border-slate-300 text-slate-400'}`}>
        <div className="absolute -top-3 left-4 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 rounded border border-slate-200 shadow-sm flex items-center gap-2">
          <MoreHorizontal className="w-3 h-3" />
          {data.label || 'Grupo'}
        </div>
        {/* Handles to allow connecting to the group itself if needed */}
        <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-3 !h-3 !-top-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-3 !h-3 !-bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
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

// Utility function to replace placeholders in messages
const replacePlaceholders = (text: string, leadName: string, propertyNames: string[]): string => {
  if (!text) return text;

  console.log('🔧 replacePlaceholders called with:', { leadName, propertyNames, text: text.substring(0, 100) });

  let result = text;

  // Extract first name only (before first space)
  const firstName = leadName.split(' ')[0] || leadName;

  console.log('🔧 First name extracted:', firstName);

  // Replace all variations of lead name placeholders
  const leadNameVariations = [
    /\[Nome do Cliente\]/gi,
    /\[Nome do Lead\]/gi,
    /\[Cliente\]/gi,
    /\[Nome\]/gi,
    /\[Lead\]/gi
  ];

  leadNameVariations.forEach(pattern => {
    const before = result;
    result = result.replace(pattern, firstName || '[Nome do Cliente]');
    if (before !== result) {
      console.log('🔧 Replaced pattern:', pattern, 'with:', firstName);
    }
  });

  // Replace all variations of property/project placeholders
  const propertyText = propertyNames.length > 0
    ? propertyNames.join(', ')
    : '[Empreendimento]';

  console.log('🔧 Property text to replace:', propertyText);

  const propertyVariations = [
    /\[Empreendimento\]/gi,
    /\[Projeto\]/gi,
    /\[Nome do Imóvel\]/gi,
    /\[Nome do Imovel\]/gi,
    /\[Imóvel\]/gi,
    /\[Imovel\]/gi,
    /\[Propriedade\]/gi
  ];

  propertyVariations.forEach(pattern => {
    const before = result;
    result = result.replace(pattern, propertyText);
    if (before !== result) {
      console.log('🔧 Replaced property pattern:', pattern, 'with:', propertyText);
    }
  });

  console.log('🔧 Final result:', result.substring(0, 100));

  return result;
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
        leadEmail: lead.email,
        leadName: lead.nome,
        propertyNames: interestIds
          .map((id: string) => properties.find((p: any) => p.id === id)?.name)
          .filter(Boolean),
      }
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
      style: {stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '4' },
  });
      */

  return { nodes, edges };
};

// --- SUBSIDIARY COMPONENTS ---

const EditDrawer = ({
  isOpen,
  onClose,
  data,
  lead,
  onSave,
  onDelete,
  addNotification
}: {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  lead?: any;
  onSave: (newData: any) => void;
  onDelete?: (nodeId: string, schema: string) => void;
  addNotification?: (notification: any) => void;
}) => {
  const { properties } = useProperties();

  // HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [formData, setFormData] = useState(data || {});

  // --- INTEGRATION STATE ---
  const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
  const [msgTemplates, setMsgTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const placeholdersAppliedRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && data?.schema === 'funnel') {
      // Load message templates
      supabase.from('mensagem_templates')
        .select('*')
        .order('nome')
        .then(({ data: tmpls }) => {
          if (tmpls) setMsgTemplates(tmpls);
        });

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

      // Only apply placeholder replacement when drawer first opens (not on every data change)
      const shouldApplyPlaceholders = !placeholdersAppliedRef.current;

      let processedMessage = data.message;
      let processedWhatsApp = data.whatsappMessage;

      if (shouldApplyPlaceholders && (data.message || data.whatsappMessage)) {
        // Get lead name and property names for placeholder replacement
        const leadName = lead?.nome || '';

        console.log('🔍 PLACEHOLDER DEBUG - Lead Name:', leadName);
        console.log('🔍 PLACEHOLDER DEBUG - Lead Object:', lead);

        // Get property names from connected nodes in the journey map
        const journeyData = (lead as any)?.journey_map_data;
        const propertyNames: string[] = [];

        console.log('🔍 PLACEHOLDER DEBUG - Journey Data:', journeyData);

        if (journeyData?.nodes && journeyData?.edges) {
          // Find all property nodes connected to the lead node
          const leadNodeId = 'lead-main'; // Changed from 'lead-node' to match actual ID
          const connectedPropertyIds = journeyData.edges
            .filter((edge: any) => edge.source === leadNodeId || edge.target === leadNodeId)
            .map((edge: any) => edge.source === leadNodeId ? edge.target : edge.source)
            .filter((id: string) => id.startsWith('prop-')); // Changed from 'property-' to 'prop-'

          console.log('🔍 PLACEHOLDER DEBUG - Connected Property IDs:', connectedPropertyIds);

          // Get the names of connected properties
          connectedPropertyIds.forEach((propId: string) => {
            const propNode = journeyData.nodes.find((n: any) => n.id === propId);
            console.log(`🔍 PLACEHOLDER DEBUG - Looking for node ${propId}:`, propNode);
            console.log(`🔍 PLACEHOLDER DEBUG - Node data:`, propNode?.data);
            console.log(`🔍 PLACEHOLDER DEBUG - Node data keys:`, Object.keys(propNode?.data || {}).join(', '));
            console.log(`🔍 PLACEHOLDER DEBUG - Node label:`, propNode?.data?.label);
            if (propNode?.data?.label) {
              propertyNames.push(propNode.data.label);
            }
          });
        }

        // Fallback: if no properties found in journey map, use tags
        if (propertyNames.length === 0) {
          console.log('🔍 PLACEHOLDER DEBUG - Using fallback (tags)');
          (lead?.tags || [])
            .filter((tag: string) => !tag.startsWith('Funnel:'))
            .forEach((tag: string) => {
              const prop = properties.find(p => p.nome === tag);
              if (prop) propertyNames.push(prop.nome);
            });
        }

        console.log('🔍 PLACEHOLDER DEBUG - Property Names:', propertyNames);
        console.log('🔍 PLACEHOLDER DEBUG - Original Message:', data.message);
        console.log('🔍 PLACEHOLDER DEBUG - Original WhatsApp:', data.whatsappMessage);

        processedMessage = data.message ? replacePlaceholders(data.message, leadName, propertyNames) : data.message;
        processedWhatsApp = data.whatsappMessage ? replacePlaceholders(data.whatsappMessage, leadName, propertyNames) : data.whatsappMessage;

        console.log('🔍 PLACEHOLDER DEBUG - Processed Message:', processedMessage);
        console.log('🔍 PLACEHOLDER DEBUG - Processed WhatsApp:', processedWhatsApp);

        placeholdersAppliedRef.current = true;
      }

      setFormData({
        ...data,
        // Garantir que plantas e diferenciais estejam disponíveis
        plantas: data.plantas || data.precos_por_tipologia || [],
        diferenciais: data.diferenciais || [],
        amenities: data.amenities || data.comodidades || [],
        // Apply placeholder replacement for messages (only first time)
        message: shouldApplyPlaceholders ? processedMessage : formData.message || data.message,
        whatsappMessage: shouldApplyPlaceholders ? processedWhatsApp : formData.whatsappMessage || data.whatsappMessage,
      });
    }
  }, [data, lead, properties]);

  // Reset the ref when drawer closes
  useEffect(() => {
    if (!isOpen) {
      placeholdersAppliedRef.current = false;
    }
  }, [isOpen]);

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
    } else if (internalData.schema === 'funnel' || internalData.schema === 'text') {
      // For funnel/text, we update the node data specifically, not the lead
      // This will be caught by the onSave wrapper to update node state
      return {
        ...internalData,
        label: internalData.label,
        message: internalData.message,
        whatsappMessage: internalData.whatsappMessage,
        senderName: internalData.senderName,
        subject: internalData.subject,
        fontSize: internalData.fontSize, // Added for textNode
        hasReminder: internalData.hasReminder,
        reminderMessage: internalData.reminderMessage,
        reminderDate: internalData.reminderDate,
        reminderTime: internalData.reminderTime,
        applyToAll: internalData.applyToAll // Include global flag
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

      // Pass raw form data if it's a funnel or text so we can update local state
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
                      {formData.commercial?.delivery === 'Entregue' ? 'Data de Entrega' : 'Previsão de Entrega'}
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
          </div>
        )}


      </div>

      <div className="p-4 border-t bg-slate-50 space-y-2">
        <Button onClick={handleSave} className="w-full gap-2">
          <Save className="w-4 h-4" />
          Salvar Alterações
        </Button>
        {onDelete && data.nodeId && (data.schema === 'funnel' || data.schema === 'text') && (
          <Button
            variant="ghost"
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 gap-2 text-xs"
            onClick={() => onDelete(data.nodeId, data.schema)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir {data.schema === 'funnel' ? 'Funil' : 'Texto'}
          </Button>
        )}
      </div>
    </div>
  );
};

const nodeTypes = {
  leadNode: LeadNode,
  propertyNode: PropertyNode,
  followUpNode: FollowUpNode,
  statusNode: StatusNode,
  timelineNode: TimelineNode,
  textNode: TextNode,
  groupNode: GroupNode
};

function LeadJourneyMapInner({ leadId, isOpen, onClose, mode, addNotification }: LeadJourneyMapProps) {
  const { getLeadById, updateLead } = useLeads();
  const { properties } = useProperties();
  const { toast } = useToast();

  const lead = leadId ? getLeadById(leadId) : null;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [funnelPopoverOpen, setFunnelPopoverOpen] = useState(false);
  const [isHandMode, setIsHandMode] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]); // For Templates
  const [templateNamingOpen, setTemplateNamingOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  const nodeTypes = useMemo(() => ({
    leadNode: LeadNode,
    propertyNode: PropertyNode,
    statusNode: StatusNode,
    timelineNode: TimelineNode,
    followUpNode: FollowUpNode,
    textNode: TextNode
  }), []);

  const edgeTypes = useMemo(() => ({
    deletableEdge: DeletableEdge
  }), []);

  // DELETE LOGIC (Shared between edge button and keyboard)
  const handleRemoveInterest = useCallback((targetNodeId: string) => {
    if (!leadId || !lead) return;

    // Check if it's a property node
    if (!targetNodeId.startsWith('prop-')) return;

    const propertyId = targetNodeId.replace('prop-', '');

    // Current Interests
    const currentInterests = lead.interessesIds || [];

    if (!currentInterests.includes(propertyId)) return;

    // Remove ID
    const newInteressesIds = currentInterests.filter((id: string) => id !== propertyId);

    // Check main interest
    let newEmpreendimentoId = lead.empreendimento_id;
    if (newEmpreendimentoId === propertyId) {
      newEmpreendimentoId = newInteressesIds.length > 0 ? newInteressesIds[0] : null;
    }

    // Remove Tag
    const prop = properties.find(p => p.id === propertyId);
    let newTags = [...(lead.tags || [])];
    if (prop) {
      const tagToRemove = `Interesse: ${prop.name}`;
      newTags = newTags.filter(t => t !== tagToRemove);
    }

    const updates = {
      interessesIds: newInteressesIds,
      empreendimento_id: newEmpreendimentoId,
      tags: newTags
    };

    console.log("Removing Interest Node:", updates);
    updateLead(leadId, updates);

    // Persist
    supabase.from('leads').update(updates).eq('id', leadId).then(({ error }) => {
      if (error) console.error("Error removing interest node:", error);
    });

  }, [leadId, lead, properties, updateLead]);

  // --- TEMPLATES LOGIC ---
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('journey_node_templates').select('*').order('created_at', { ascending: false });
      if (data) setTemplates(data);
    };
    fetch();
  }, []);

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || selectedNodes.length === 0) {
      toast({ title: 'Nome inválido', description: 'Digite um nome para o modelo.', variant: 'destructive' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Calculate relative positions
    const minX = Math.min(...selectedNodes.map(n => n.position.x));
    const minY = Math.min(...selectedNodes.map(n => n.position.y));

    // 2. Serialize
    const nodesData = selectedNodes.map(n => ({
      type: n.type,
      position: { x: n.position.x - minX, y: n.position.y - minY },
      data: { ...n.data, selected: false } // Clone data
    }));

    const { error } = await supabase
      .from('journey_node_templates')
      .insert([{
        user_id: user.id,
        name: templateName,
        nodes_data: nodesData
      }]);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Modelo Salvo', description: 'Template criado com sucesso.' });
      setTemplateNamingOpen(false);
      setTemplateName("");
      // Refresh
      const { data } = await supabase.from('journey_node_templates').select('*').order('created_at', { ascending: false });
      if (data) setTemplates(data);
    }
  };

  const handleUseTemplate = useCallback((template: any) => {
    const startX = 250 + Math.random() * 50;
    const startY = 150 + Math.random() * 50;

    const newNodes = (template.nodes_data as any[]).map((tmplNode, i) => {
      const newNodeId = `${tmplNode.type}-${Date.now()}-${i}`;
      return {
        id: newNodeId,
        type: tmplNode.type,
        position: { x: startX + tmplNode.position.x, y: startY + tmplNode.position.y },
        data: {
          ...tmplNode.data,
          isGlobal: false
        }
      };
    });

    setNodes((prev) => {
      const updated = [...prev, ...newNodes];

      // TRIGGER SAVE to persist new nodes immediately
      // Otherwise a reload or tag update will wipe them out because they aren't in DB yet
      // We can reuse the main save logic or do a partial update here.
      // Reusing accessible logic:
      const journeyData = {
        nodes: updated.map(n => ({
          id: n.id, type: n.type, position: n.position, data: n.data
        })),
        edges: edges // We can't access updated edges state here easily, but usually templates don't add edges yet or we just save current
        // Better: Just update nodes in DB
      };

      supabase.from('leads').update({
        journey_map_data: { ...((lead as any)?.journey_map_data || {}), nodes: journeyData.nodes }
      }).eq('id', leadId).then(res => {
        if (res.error) console.error("Auto-save template error", res.error);
        else console.log("Template saved to DB");
      });

      return updated;
    });

    toast({ title: "Template Aplicado", description: `${newNodes.length} nodes adicionados.` });
    setFunnelPopoverOpen(false);
  }, [setNodes, toast, leadId, lead, edges]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length === 0) return;

    // Filter out crucial nodes if necessary (e.g. Lead Node)
    const nodesToDelete = selectedNodes.filter(n => n.type !== 'leadNode');

    if (nodesToDelete.length === 0) return;

    // Remove from UI immediately
    setNodes((nds) => nds.filter((n) => !nodesToDelete.some(dn => dn.id === n.id)));

    // Trigger any necessary side-effects (like deleting funnels from DB, etc.)
    // Note: ReactFlow onNodesDelete prop usually handles singular deletions, 
    // but for bulk actions we might need to manually trigger sync or rely on "Salvar"
    toast({ title: "Nodes Removidos", description: `${nodesToDelete.length} itens excluídos.` });
    setSelectedNodes([]); // Clear selection
  }, [selectedNodes, setNodes]);

  const handleDeleteTemplate = useCallback(async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template usage trigger

    // Optimistic Update
    setTemplates(prev => prev.filter(t => t.id !== templateId));

    const { error } = await supabase.from('journey_node_templates').delete().eq('id', templateId);

    if (error) {
      console.error("Error deleting template:", error);
      toast({ title: "Erro", description: "Falha ao excluir modelo.", variant: "destructive" });
      // Revert (reload would be simpler, but let's just warn for now)
    } else {
      toast({ title: "Modelo Excluído", description: "O modelo foi removido." });
    }
  }, [toast]);

  // DISCONNECT EDGE ONLY (Keeps Node)
  const handleDisconnectEdge = useCallback((targetNodeId: string) => {
    if (!leadId || !lead) return;

    if (!targetNodeId.startsWith('prop-')) return;
    const propertyId = targetNodeId.replace('prop-', '');

    const prop = properties.find(p => p.id === propertyId);
    if (!prop) return;

    // 1. Remove Tag ONLY
    const tagToRemove = `Interesse: ${prop.name}`;
    const newTags = (lead.tags || []).filter((t: string) => t !== tagToRemove);

    // 2. Unset Main Interest if connected
    let newEmpreendimentoId = lead.empreendimento_id;
    if (newEmpreendimentoId === propertyId) {
      newEmpreendimentoId = null;
    }

    const updates = {
      empreendimento_id: newEmpreendimentoId,
      tags: newTags
      // keeps interessesIds intact!
    };

    console.log("Disconnecting Edge:", updates);
    updateLead(leadId, updates);

    supabase.from('leads').update(updates).eq('id', leadId).then(({ error }) => {
      if (error) console.error("Error disconnecting edge:", error);
    });

  }, [leadId, lead, properties, updateLead]);

  // INIT & UPDATE ON LEAD CHANGE
  useEffect(() => {
    if (!lead || !properties) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Async function to fetch global funnels and build journey
    const initJourney = async () => {
      // const globalFunnels = await fetchGlobalFunnels(); // REMOVED

      console.log('🌍 Building Journey for Lead:', lead.nome);
      console.log('📂 Saved Data in Lead Object:', (lead as any).journey_map_data);

      const { nodes: builtNodes, edges: builtEdges } = buildJourneyData(lead, properties, []); // Empty globalFunnels as we removed them


      // 1. Enrich nodes with handlers
      const nodesWithHandlers = builtNodes.map(node => {
        if (node.type === 'leadNode') {
          return {
            ...node,
            data: {
              ...node.data,
              lead,
              onOpenTimeline: () => setTimelineOpen(true)
            }
          };
        }
        // Global funnels are now fully editable and movable in each lead's map
        return node;
      });

      // 2. Merge with Saved/Current Layout
      setNodes((currentNodes) => {
        const savedData = (lead as any).journey_map_data;
        console.log('📂 Saved Data from DB:', savedData);

        const mergedNodes = nodesWithHandlers.map(bn => {
          // Priority 1: Keep current position if exists (during live editing)
          const current = currentNodes.find(c => c.id === bn.id);
          if (current) {
            return {
              ...bn,
              position: current.position,
              // Also preserve current data to avoid losing edits during re-renders
              data: {
                ...bn.data,
                ...current.data,
                // CRITICAL: Force sync core lead fields from source if it's a Lead Node
                // Otherwise outdated 'current.data' will overwrite the fresh data from context
                ...(bn.data.schema === 'lead' ? {
                  name: bn.data.name,
                  email: bn.data.email,
                  phone: bn.data.phone,
                  renda: bn.data.renda,
                  profissao: bn.data.profissao,
                  entradatxt: bn.data.entradatxt,
                  valorEntrada: bn.data.valorEntrada,
                  possuiEntrada: bn.data.possuiEntrada
                } : {})
              }
            };
          }

          // Priority 2: Use saved position from DB
          if (savedData?.nodes) {
            const saved = savedData.nodes.find((s: any) => {
              // Match by ID first (most reliable)
              if (s.id === bn.id) return true;

              // Fallback: Match ONLY global funnels by label and type (for backward compatibility)
              // Text Nodes should NEVER be matched by label, only by ID
              if (bn.type === 'followUpNode') {
                return (
                  s.data?.label === bn.data?.label &&
                  s.type === bn.type &&
                  (s.data?.isGlobal || s.data?.applyToAll)
                );
              }
            });

            if (saved) {
              return {
                ...bn,
                id: saved.id, // ADOPT ID from saved state to ensure edges work
                position: saved.position,
                parentNode: saved.parentNode,
                extent: saved.extent,
                // Merge saved data with built data, prioritizing ALL saved custom fields
                data: {
                  ...bn.data,
                  ...saved.data,
                  // Explicitly preserve critical fields from saved data
                  message: saved.data?.message !== undefined ? saved.data.message : bn.data.message,
                  whatsappMessage: saved.data?.whatsappMessage !== undefined ? saved.data.whatsappMessage : bn.data.whatsappMessage,
                  senderName: saved.data?.senderName !== undefined ? saved.data.senderName : bn.data.senderName,
                  subject: saved.data?.subject !== undefined ? saved.data.subject : bn.data.subject,
                  targetPropertyIds: saved.data?.targetPropertyIds !== undefined ? saved.data.targetPropertyIds : bn.data.targetPropertyIds,
                  applyToAll: saved.data?.applyToAll !== undefined ? saved.data.applyToAll : bn.data.applyToAll,
                  hasReminder: saved.data?.hasReminder !== undefined ? saved.data.hasReminder : bn.data.hasReminder,
                  reminderMessage: saved.data?.reminderMessage || bn.data.reminderMessage,
                  reminderDate: saved.data?.reminderDate !== undefined ? saved.data.reminderDate : bn.data.reminderDate,
                  reminderTime: saved.data?.reminderTime !== undefined ? saved.data.reminderTime : bn.data.reminderTime,
                  originalMessage: saved.data?.originalMessage || bn.data.originalMessage,
                  leadPhone: lead.telefone,
                  leadEmail: lead.email,
                  leadName: lead.nome,
                  isGlobal: saved.data?.isGlobal !== undefined ? saved.data.isGlobal : bn.data.isGlobal
                }
              };
            }
          }

          // Default: Calculated position
          return bn;
        });

        // 2. Restore Extra Nodes (Groups, Text Nodes, Template Funnels)
        console.log('🚀 STARTING RESTORATION PROCESS');
        console.log('🚀 mergedNodes count:', mergedNodes.length);

        const savedNodes = savedData?.nodes || [];
        const extraNodes: Node[] = [];
        const processedIds = new Set(mergedNodes.map(n => n.id));

        console.log('🔍 DEBUG: Saved nodes from DB:', savedNodes);
        console.log('🔍 DEBUG: Already processed IDs:', Array.from(processedIds));

        savedNodes.forEach((saved: any) => {
          console.log(`🔍 Checking saved node: ${saved.id} (type: ${saved.type})`);

          if (!processedIds.has(saved.id)) {
            // It's a custom node (Group, Text, Funnel from Template) - Restore it fully
            if (['groupNode', 'textNode', 'followUpNode'].includes(saved.type)) {
              // Extra check for followUpNode: If it looks like a tag-generated ID (funnel-0, funnel-1), 
              // and it wasn't in builtNodes, it means the tag is gone. Don't restore it.
              if (saved.type === 'followUpNode' && saved.id.startsWith('funnel-')) {
                console.log(`⚠️ Skipping tag-generated funnel: ${saved.id}`);
                return;
              }

              console.log(`✅ Restoring custom node: ${saved.id} (type: ${saved.type})`);
              extraNodes.push({
                ...saved,
                data: {
                  ...saved.data,
                  leadPhone: lead.telefone,
                  leadEmail: lead.email,
                  leadName: lead.nome
                }
              });
              processedIds.add(saved.id);
            } else {
              console.log(`⚠️ Node type not in allowed list: ${saved.type}`);
            }
          } else {
            console.log(`⚠️ Node already processed: ${saved.id}`);
          }
        });

        // 3. Also keep unsaved local nodes (for live editing)
        currentNodes.forEach((curr) => {
          if (!processedIds.has(curr.id)) {
            if (['groupNode', 'textNode', 'followUpNode'].includes(curr.type)) {
              if (curr.type === 'followUpNode' && curr.id.startsWith('funnel-')) {
                return; // Skip tag-generated funnels
              }
              extraNodes.push(curr);
              processedIds.add(curr.id);
            }
          }
        });

        console.log('📦 Extra nodes to restore:', extraNodes);
        console.log('📊 Total nodes after merge:', [...mergedNodes, ...extraNodes].length);

        return [...mergedNodes, ...extraNodes];
      });

      // 2. Enrich edges
      const enrichedEdges = builtEdges.map(edge => ({
        ...edge,
        type: 'deletableEdge',
        data: { ...edge.data, onDelete: () => handleDisconnectEdge(edge.target) }
      }));

      // 3. Merge Saved/Custom Edges
      const savedData = (lead as any).journey_map_data;
      const savedEdges = savedData?.edges || [];

      // Filter out saved edges that conflict with built logic edges (by ID)
      // We only want to restore EXTRA manual connections
      const customEdges = savedEdges
        .filter((se: any) => !enrichedEdges.some((ee) => ee.id === se.id))
        .map((se: any) => ({
          ...se,
          type: 'deletableEdge', // FORCE DELETABLE TYPE
          data: { ...se.data, onDelete: () => { } } // Ensure handler exists (no-op for pure visual)
        }));

      setEdges([...enrichedEdges, ...customEdges]);
    };

    // Execute the async initialization
    initJourney();

  }, [lead, properties, handleDisconnectEdge]);






  // HANDLERS
  const onConnect = useCallback((params: Connection) => {
    if (!leadId || !lead) return;

    // Visual Connect (Use Deletable Edge)
    const newEdge = { ...params, type: 'deletableEdge', data: { onDelete: () => { } } };
    setEdges((eds) => addEdge(newEdge, eds));

    // Persist Connection
    const { source, target } = params;
    // Identify which is Property and which is Lead
    const isPropTarget = target?.startsWith('prop-');
    const isPropSource = source?.startsWith('prop-');

    let propertyId = null;

    if (isPropTarget && source === 'lead-main') {
      propertyId = target?.replace('prop-', '');
    } else if (isPropSource && target === 'lead-main') {
      propertyId = source?.replace('prop-', '');
    }

    if (propertyId) {
      const currentInterests = lead.interessesIds || [];

      // LOGIC: Ensure "Interest" (Node) exists AND "Tag" (Edge) exists

      // 1. Ensure Node Existence (Interest ID)
      let newInteressesIds = [...currentInterests];
      if (!newInteressesIds.includes(propertyId)) {
        newInteressesIds.push(propertyId);
      }

      // 2. Ensure Edge Existence (Tag)
      const prop = properties.find(p => p.id === propertyId);
      let newTags = [...(lead.tags || [])];

      if (prop) {
        const newTag = `Interesse: ${prop.name}`;
        if (!newTags.includes(newTag)) {
          newTags.push(newTag);
        }
      }

      let newEmpreendimentoId = lead.empreendimento_id;
      if (!newEmpreendimentoId) {
        newEmpreendimentoId = propertyId;
      }

      const updates = {
        interessesIds: newInteressesIds,
        empreendimento_id: newEmpreendimentoId,
        tags: newTags
      };

      updateLead(leadId, updates);

      supabase.from('leads').update(updates).eq('id', leadId).then(({ error }) => {
        if (error) console.error("Error connecting interest:", error);
      });
    }


  }, [setEdges, leadId, lead, properties, updateLead]);


  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(edge => {
      // Only trigger business logic disconnect if it connects Lead -> Property
      // And if the property actually exists
      const isPropTarget = edge.target?.startsWith('prop-');
      if (isPropTarget && edge.source === 'lead-main') {
        handleDisconnectEdge(edge.target);
      }
    });
  }, [handleDisconnectEdge]);

  const onNodesDelete = useCallback((deleted: Node[]) => {
    if (!leadId || !lead) return;

    // 1. Identify items to remove
    const deletedPropertyIds: string[] = [];
    const deletedGlobalFunnelIds: string[] = [];
    const deletedLocalFunnelLabels: string[] = [];

    deleted.forEach((node) => {
      if (node.type === 'propertyNode' && node.data.id) {
        deletedPropertyIds.push(node.data.id);
      } else if (node.type === 'followUpNode' || node.type === 'textNode') {
        if (node.data?.isGlobal) {
          deletedGlobalFunnelIds.push(node.id);
        } else if (node.data?.label) {
          deletedLocalFunnelLabels.push(node.data.label);
        }
      }
    });

    // 2. Prepare Updates
    let updates: any = {};
    let hasUpdates = false;
    let newTags = [...(lead.tags || [])];

    // Handle Properties
    if (deletedPropertyIds.length > 0) {
      // Logic to remove Property Tags and Main Interest
      let newEmpreendimentoId = lead.empreendimento_id;
      if (deletedPropertyIds.includes(lead.empreendimento_id || '')) {
        newEmpreendimentoId = null;
        updates.empreendimento_id = newEmpreendimentoId;
      }

      const propNames = properties
        .filter(p => deletedPropertyIds.includes(p.id))
        .map(p => `interesse: ${p.name.toLowerCase().trim()}`);

      newTags = newTags.filter(t => !propNames.includes(t.toLowerCase().trim()));
      hasUpdates = true;
    }

    // Handle Local Funnels
    if (deletedLocalFunnelLabels.length > 0) {
      const funnelTags = deletedLocalFunnelLabels.map(l => `Funnel: ${l}`);
      newTags = newTags.filter(t => !funnelTags.includes(t));
      hasUpdates = true;

      // CRITICAL FIX: Also remove from journey_map_data to prevent "zombie" nodes returning
      // This ensures that even if tag sync lags, the visual node is explicitly purged
      const currentJourneyData = (lead as any).journey_map_data || {};
      if (currentJourneyData.nodes) {
        const idsToRemove = deleted.map(n => n.id);
        updates.journey_map_data = {
          ...(updates.journey_map_data || currentJourneyData), // Preserve exclusion updates if any
          nodes: (updates.journey_map_data?.nodes || currentJourneyData.nodes).filter((n: any) => !idsToRemove.includes(n.id))
        };
      }
    }

    // Apply Tags Update if changed
    if (hasUpdates) {
      updates.tags = newTags;
    }

    // Handle Global Funnels
    if (deletedGlobalFunnelIds.length > 0) {
      const currentJourneyData = (lead as any).journey_map_data || {};
      const currentExcluded = currentJourneyData.excluded_global_funnels || [];
      const newExcluded = [...new Set([...currentExcluded, ...deletedGlobalFunnelIds])];

      updates.journey_map_data = {
        ...(updates.journey_map_data || currentJourneyData),
        excluded_global_funnels: newExcluded,
        // Also ensure visual consistency by removing from nodes list in DB if present
        nodes: (updates.journey_map_data?.nodes || currentJourneyData.nodes).filter((n: any) => !deletedGlobalFunnelIds.includes(n.id))
      };
      hasUpdates = true;

      // GLOBAL DELETE PROPAGATION: Check if we are deleting a Master Funnel/Text (applyToAll=true)
      // If so, we must remove it from ALL leads to truly "delete" it from the system.
      const masterFunnelsToDelete = deleted.filter(n => deletedGlobalFunnelIds.includes(n.id) && n.data?.applyToAll);

      if (masterFunnelsToDelete.length > 0) {
        // Run async clean up
        (async () => {
          console.log("🌍 Deleting Master Global Funnels from ALL leads...", masterFunnelsToDelete.map(n => n.data.label));
          const { data: allLeads } = await supabase
            .from('leads')
            .select('id, journey_map_data')
            .not('journey_map_data', 'is', null);

          if (allLeads) {
            const labelsToRemove = masterFunnelsToDelete.map(n => n.data.label);

            const cleanupPromises = allLeads.map(async (otherLead) => {
              const jData = otherLead.journey_map_data as any;
              let jDataNeedsUpdate = false;

              // 1. Remove Nodes
              let newNodes = jData.nodes || [];
              const initialNodeLength = newNodes.length;
              if (jData.nodes) {
                newNodes = jData.nodes.filter((n: any) => {
                  if ((n.type === 'followUpNode' || n.type === 'textNode') && n.data?.isGlobal && labelsToRemove.includes(n.data?.label)) {
                    return false;
                  }
                  return true;
                });
              }
              if (newNodes.length < initialNodeLength) jDataNeedsUpdate = true;

              // 2. Add to Blacklist (Exclusion) to prevent re-discovery
              let newExcluded = jData.excluded_global_funnels || [];
              const initialExcludedLength = newExcluded.length;
              labelsToRemove.forEach(label => {
                const globalId = `global-funnel-${label}`;
                if (!newExcluded.includes(globalId)) {
                  newExcluded.push(globalId);
                }
              });

              if (newExcluded.length > initialExcludedLength) {
                jDataNeedsUpdate = true;
              }

              if (jDataNeedsUpdate) {
                await supabase.from('leads').update({
                  journey_map_data: {
                    ...jData,
                    nodes: newNodes,
                    excluded_global_funnels: newExcluded
                  }
                }).eq('id', otherLead.id);
              }
            });

            await Promise.all(cleanupPromises);
            toast({
              title: "Funil Global Excluído",
              description: "O funil foi removido de todos os leads do sistema.",
              variant: "destructive"
            });
          }
        })();
      }
    }

    // 3. Execute Updates
    if (hasUpdates) {
      console.log('🗑️ Deleting Nodes & Persisting:', updates);
      updateLead(leadId, updates);
      supabase.from('leads').update(updates).eq('id', leadId).then(({ error }) => {
        if (error) console.error("Error deleting nodes:", error);
      });
    }

  }, [leadId, lead, properties, updateLead, nodes, edges]);



  // CLICK HANDLER
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    let drawerData = { ...node.data, nodeId: node.id };

    // Define Schema e injeta dados atuais para edição
    if (node.type === 'leadNode') {
      drawerData.title = 'Editar Contato';
      drawerData.schema = 'lead';

      // Injetar dados de interesse para o form (recuperar de todas as fontes)
      const interessePrincipal = lead.empreendimento_id ? [lead.empreendimento_id] : [];
      const tagsInteresse = (lead.tags || [])
        .filter((t: string) => t.startsWith("Interesse: "))
        .map((t: string) => t.replace("Interesse: ", ""));
      console.log('🔍 Drawer Loading Interests from tags:', tagsInteresse);
      const interessesDasTags = properties
        .filter((emp: any) => tagsInteresse.includes(emp.name))
        .map((emp: any) => emp.id);

      drawerData.selectedInterests = [...new Set([...interessePrincipal, ...interessesDasTags])];
    } else if (node.type === 'propertyNode') {
      drawerData.title = 'Detalhes do Imóvel';
      drawerData.schema = 'property';
      // Tenta encontrar a chave original para o select
      drawerData.interestKey = lead?.empreendimento_id;
      setSelectedNodeData(drawerData);
      setDrawerOpen(true);
      return; // Exit
    } else if (node.type === 'statusNode') {
      drawerData.title = 'Atualizar Fase';
      drawerData.schema = 'status';
      setSelectedNodeData(drawerData);
      setDrawerOpen(true);
      return; // Exit
    } else if (node.type === 'followUpNode' || node.type === 'textNode') {
      const isText = node.type === 'textNode';
      drawerData.title = isText ? 'Editar Texto' : 'Editar Funil';
      drawerData.schema = isText ? 'text' : 'funnel';
      // Inject contact info ensuring drawer has it for actions
      drawerData.leadPhone = lead.telefone;
      drawerData.leadEmail = lead.email;

      setSelectedNodeData(drawerData);
      setDrawerOpen(true);
      return; // Exit
    } else if (node.type === 'timelineNode') {
      // Open Timeline Dialog instead of Drawer
      setTimelineOpen(true);
      return;
    }

    // Fix: If leadNode, we also need to open drawer
    if (node.type === 'leadNode') {
      setSelectedNodeData(drawerData);
      setDrawerOpen(true);
    }

  }, [lead]);

  // SAVE HANDLER - CONTEXT UPDATE & PERSISTENCE
  const handleSaveNode = useCallback(async (updates: any) => {
    console.log('⚡ handleSaveNode called with:', JSON.stringify(updates, null, 2));

    // SPECIAL HANDLER FOR FUNNEL/TEXT NODES (Visual Only)
    if (updates.schema === 'funnel' || updates.schema === 'text') {
      console.log('💾 Saving Node:', updates);
      setNodes((nds) => {
        const newNodes = nds.map((n) => {
          if (n.id === updates.nodeId) {
            const updatedNode = {
              ...n,
              data: {
                ...n.data,
                label: updates.label,
                message: updates.message,
                whatsappMessage: updates.whatsappMessage,
                senderName: updates.senderName,
                subject: updates.subject,
                fontSize: updates.fontSize, // Added for textNode
                hasReminder: updates.hasReminder,
                reminderMessage: updates.reminderMessage,
                reminderDate: updates.reminderDate,
                reminderTime: updates.reminderTime,
                applyToAll: updates.applyToAll,
                targetPropertyIds: updates.targetPropertyIds, // Persist selection
                // Store original message when marking as global for the first time
                originalMessage: updates.applyToAll && !n.data.originalMessage
                  ? (updates.schema === 'text' ? updates.label : updates.message)
                  : n.data.originalMessage,
                leadPhone: n.data.leadPhone,
                leadEmail: n.data.leadEmail
              }
            };
            return updatedNode;
          }
          return n;
        });

        // AUTO-SAVE TO DB (Persist changes immediately)
        const journeyData = {
          nodes: newNodes.map(n => ({
            id: n.id,
            position: n.position,
            type: n.type,
            data: n.data
          })),
          edges: edges
        };

        // Fire and forget update
        supabase.from('leads').update({ journey_map_data: journeyData }).eq('id', leadId).then(res => {
          if (res.error) console.error("Error auto-saving node update:", res.error);
        });

        return newNodes;
      });


      // If this is a global funnel, handle it specially
      if (updates.applyToAll) {
        const isEditingExistingGlobal = updates.isGlobal; // Was already global
        // const messageChanged = updates.message !== updates.originalMessage;

        if (!isEditingExistingGlobal) {
          // Creating a NEW global funnel (or broadcasting a local one)
          console.log('🆕 Creating/Broadcasting global funnel...');

          // Generate a unique ID for the new global funnel
          const newGlobalFunnelId = `global-funnel-${updates.label}-${Date.now()}`;

          // Fetch ALL leads for in-memory filtering (Property ID or Tags)
          const { data: allLeads, error: fetchError } = await supabase
            .from('leads')
            .select('id, journey_map_data, empreendimento_id, tags')
            .not('journey_map_data', 'is', null);

          if (!fetchError && allLeads) {
            console.log(`✅ DEBUG: Leads candidates for update: ${allLeads.length}`);

            const updatePromises = allLeads.map(async (otherLead) => {
              // --- IN-MEMORY PROPERTY FILTER ---
              if (updates.targetPropertyIds && updates.targetPropertyIds.length > 0) {
                const leadPropId = otherLead.empreendimento_id;
                const leadTags = otherLead.tags || [];
                const targetIds = updates.targetPropertyIds;

                // 1. Direct ID Match
                const hasIdMatch = targetIds.some(id => String(id).trim() === String(leadPropId).trim());

                // 2. Tag Match (Interesse: Name)
                let hasTagMatch = false;
                if (!hasIdMatch) {
                  const targetNames = properties
                    .filter(p => targetIds.includes(p.id))
                    .map(p => `interesse: ${p.name.toLowerCase().trim()}`);

                  // Flexible check: tag contains property name or property name contains tag part
                  hasTagMatch = leadTags.some((t: string) => {
                    const tagLower = t.toLowerCase().trim();
                    return targetNames.some(targetName => tagLower.includes(targetName) || targetName.includes(tagLower));
                  });
                }

                if (!hasIdMatch && !hasTagMatch) {
                  return; // Skip this lead
                }
              }
              // --------------------------------
              const journeyData = otherLead.journey_map_data as any;
              if (journeyData?.nodes) {
                // Capture position from the current node being edited (source of truth)
                const sourceNode = nodes.find(n => n.id === updates.nodeId);
                const finalPosition = sourceNode?.position || { x: 100, y: 50 + (journeyData.nodes.length * 120) };

                // Add the NEW global funnel node (don't remove the old one)
                // BUT: If this is the SOURCE LEAD (creator), we must REPLACE the old local node with the new global one
                // to ensure ID consistency.
                let updatedNodes = [...journeyData.nodes];

                const newNode = {
                  id: newGlobalFunnelId,
                  type: updates.schema === 'text' ? 'textNode' : 'followUpNode',
                  position: finalPosition, // Use User-Defined Position
                  data: {
                    label: updates.label,
                    message: updates.message,
                    whatsappMessage: updates.whatsappMessage,
                    senderName: updates.senderName,
                    subject: updates.subject,
                    fontSize: updates.fontSize,
                    originalMessage: updates.schema === 'text' ? updates.label : updates.message,
                    hasReminder: updates.hasReminder,
                    reminderMessage: updates.reminderMessage,
                    reminderDate: updates.reminderDate,
                    reminderTime: updates.reminderTime,
                    applyToAll: true,
                    targetPropertyIds: updates.targetPropertyIds, // Persist selection in new node
                    isGlobal: true,
                    leadPhone: updates.leadPhone,
                    leadEmail: updates.leadEmail
                  }
                };

                if (otherLead.id === leadId) {
                  // This is the CREATOR lead. Replace the local node (old ID) with new Global Node.
                  console.log(`🔄 Swapping Local ID ${updates.nodeId} for Global ID ${newGlobalFunnelId} on Creator Lead`);
                  updatedNodes = updatedNodes.map(n => n.id === updates.nodeId ? newNode : n);

                  // Also update LOCAL STATE immediately to reflect this swap without reload
                  setNodes((nds) => nds.map((n) => n.id === updates.nodeId ? newNode : n));
                } else {
                  // For other leads, just append
                  updatedNodes.push(newNode);
                }

                await supabase
                  .from('leads')
                  .update({
                    journey_map_data: {
                      ...journeyData,
                      nodes: updatedNodes
                    }
                  })
                  .eq('id', otherLead.id);

                console.log(`✅ Added new global funnel to lead: ${otherLead.id}`);
              }
            });

            await Promise.all(updatePromises);
            console.log('🎉 New global funnel created across all leads!');

            toast({
              title: "Novo Funil Global Criado",
              description: "Uma nova mensagem global foi criada em todos os leads."
            });
          }
        } else {
          console.log('🌍 Updating global funnel across targeted leads...');

          // Fetch leads for in-memory filtering (Property ID or Tags)
          const { data: allLeads, error: fetchError } = await supabase
            .from('leads')
            .select('id, journey_map_data, empreendimento_id, tags')
            .not('journey_map_data', 'is', null);

          if (fetchError) {
            console.error('❌ DEBUG UPDATE: Error fetching leads:', fetchError);
          } else {
            console.log(`✅ DEBUG UPDATE: Leads fetched for update: ${allLeads?.length}`);
          }

          if (!fetchError && allLeads) {
            const updatePromises = allLeads.map(async (otherLead) => {
              const journeyData = otherLead.journey_map_data as any;
              const nodes = journeyData?.nodes || [];

              // 1. Check if lead ALREADY HAS this funnel (by ID or Label)
              const existingNodeIndex = nodes.findIndex((n: any) =>
                n.id === updates.nodeId ||
                (n.type === 'followUpNode' && n.data?.label === updates.label)
              );
              const hasFunnel = existingNodeIndex !== -1;

              // 2. Check Filter Criteria (Targeting)
              let matchesFilter = true;
              if (updates.targetPropertyIds && updates.targetPropertyIds.length > 0) {
                const leadPropId = otherLead.empreendimento_id;
                const leadTags = otherLead.tags || [];
                const targetIds = updates.targetPropertyIds;
                const hasIdMatch = targetIds.includes(leadPropId);

                let hasTagMatch = false;
                if (!hasIdMatch) {
                  const targetNames = properties
                    .filter(p => targetIds.includes(p.id))
                    .map(p => `interesse: ${p.name.toLowerCase()}`);
                  hasTagMatch = leadTags.some((t: string) => targetNames.includes(t.toLowerCase()));
                }
                matchesFilter = hasIdMatch || hasTagMatch;
              }

              // 3. Action Logic
              let newNodes = [...nodes];
              let shouldUpdateDB = false;

              if (hasFunnel) {
                // UPDATE EXISTING (Force sync content for ALL fields)
                console.log(`🔄 Force-updating existing global funnel for lead ${otherLead.id}`);

                // Get position from source node to sync layout
                const sourceNode = nodes.find(n => n.id === updates.nodeId);

                newNodes[existingNodeIndex] = {
                  ...newNodes[existingNodeIndex],
                  position: sourceNode ? sourceNode.position : newNodes[existingNodeIndex].position,
                  data: {
                    ...newNodes[existingNodeIndex].data,
                    label: updates.label,
                    message: updates.message,
                    whatsappMessage: updates.whatsappMessage,
                    senderName: updates.senderName,
                    subject: updates.subject,
                    applyToAll: updates.applyToAll,
                    targetPropertyIds: updates.targetPropertyIds, // Sync filters
                    // EXCLUDE REMINDER FIELDS FROM GLOBAL SYNC (Individual Reminders)
                    hasReminder: newNodes[existingNodeIndex].data.hasReminder,
                    reminderMessage: newNodes[existingNodeIndex].data.reminderMessage,
                    reminderDate: newNodes[existingNodeIndex].data.reminderDate,
                    reminderTime: newNodes[existingNodeIndex].data.reminderTime,
                    isGlobal: true, // Re-assert Global status
                    leadPhone: updates.leadPhone || newNodes[existingNodeIndex].data.leadPhone,
                    leadEmail: updates.leadEmail || newNodes[existingNodeIndex].data.leadEmail,
                    originalMessage: updates.originalMessage || newNodes[existingNodeIndex].data.originalMessage,
                    fontSize: updates.fontSize
                  }
                };
                shouldUpdateDB = true;

              } else if (matchesFilter) {
                // UPSERT (Create New) - Only if strict filter matches and not present
                console.log(`➕ Upserting new global funnel for lead ${otherLead.id}`);

                // Get position from source node if available, otherwise fallback to calculated
                const sourceNode = nodes.find(n => n.id === updates.nodeId);
                const newPosition = sourceNode ? sourceNode.position : { x: 100, y: 50 + (nodes.length * 120) };

                const newNode = {
                  id: `global-funnel-${updates.label}-${Date.now()}`, // Unique ID for this instance
                  type: updates.schema === 'text' ? 'textNode' : 'followUpNode',
                  position: newPosition,
                  data: {
                    label: updates.label,
                    message: updates.message,
                    whatsappMessage: updates.whatsappMessage,
                    senderName: updates.senderName,
                    subject: updates.subject,
                    fontSize: updates.fontSize,
                    originalMessage: updates.schema === 'text' ? updates.label : updates.message,
                    hasReminder: updates.hasReminder,
                    reminderMessage: updates.reminderMessage,
                    reminderDate: updates.reminderDate,
                    reminderTime: updates.reminderTime,
                    applyToAll: true,
                    targetPropertyIds: updates.targetPropertyIds,
                    isGlobal: true,
                    leadPhone: updates.leadPhone,
                    leadEmail: updates.leadEmail
                  }
                };
                newNodes.push(newNode);
                shouldUpdateDB = true;
              }

              if (shouldUpdateDB) {
                await supabase.from('leads').update({
                  journey_map_data: { ...journeyData, nodes: newNodes }
                }).eq('id', otherLead.id);
                // console.log(`✅ DB Update Success for lead: ${otherLead.id}`);
              }
            });

            await Promise.all(updatePromises);
            console.log('🎉 Global funnel updated across All leads!');

            toast({
              title: "Funil Global Atualizado",
              description: "A mensagem foi replicada para todos os leads alvo."
            });
          }
        }
      }

      setDrawerOpen(false);
      return; // Stop here, don't update Lead context
    }

    if (leadId && lead) {
      console.log('Updating Lead via Context & Supabase:', leadId, updates);

      const dbUpdates: any = {}; // Initialize early for shared access

      // --- 1. PREPARE OPTIMISTIC DATA ---
      // We need to calculate the new tags locally to update the UI immediately
      let newTags = [...(lead.tags || [])];

      // a) Financial Tags
      if (updates.renda !== undefined || updates.profissao !== undefined || updates.possuiEntrada !== undefined || updates.valorEntrada !== undefined) {
        const prefixes = ["Renda: ", "Profissão: ", "Entrada: "];
        newTags = newTags.filter(t => !prefixes.some(p => t.startsWith(p)));

        if (updates.renda) newTags.push(`Renda: ${updates.renda}`);
        if (updates.profissao) newTags.push(`Profissão: ${updates.profissao}`);

        if (updates.possuiEntrada) {
          let tagValue = updates.possuiEntrada === 'sim' ? 'Sim' : 'Não';
          // Adicionar valor ENTRE PARENTESES para coincidir com o parser do LeadsModule
          if (updates.possuiEntrada === 'sim' && updates.valorEntrada) {
            tagValue += ` (${updates.valorEntrada})`;
          }
          newTags.push(`Entrada: ${tagValue}`);
        }
      }

      // b) Interest Tags
      let newEmpreendimentoId = lead.empreendimento_id;

      // ALIAS: Ensure we handle selectedInterests (from Drawer) as interessesIds
      if (updates.selectedInterests !== undefined && updates.interessesIds === undefined) {
        updates.interessesIds = updates.selectedInterests;
      }

      if (updates.interessesIds !== undefined) {
        // Remove old interest tags and ensure we don't duplicate
        newTags = newTags.filter(t => !t.toLowerCase().startsWith("interesse: "));

        if (updates.interessesIds.length === 0) {
          newEmpreendimentoId = null;
        } else {
          // First selected becomes the main foreign key
          newEmpreendimentoId = updates.interessesIds[0];

          // Add tags for all selected interests
          const uniqueIds = [...new Set(updates.interessesIds)] as string[];
          uniqueIds.forEach((id) => {
            const p = properties.find(prop => prop.id === id);
            if (p) newTags.push(`Interesse: ${p.name}`);
          });
        }
      }

      const optimisticUpdate = {
        ...updates,
        tags: newTags,
        empreendimento_id: newEmpreendimentoId
      };

      // --- 2. APPLY OPTIMISTIC UPDATE ---
      updateLead(leadId, optimisticUpdate);
      setDrawerOpen(false);

      // --- 3. PERSIST TO DB ---
      try {
        // Use strict undefined checks to allow clearing fields (e.g. empty strings)
        if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.telefone !== undefined) dbUpdates.telefone = updates.telefone;
        if (updates.status !== undefined) dbUpdates.status = updates.status;

        // Always update tags and interest ID if they were recalculated, 
        // trusting our local logic over potentially stale state comparisons
        // Always update tags and interest ID if they were recalculated
        if (updates.renda !== undefined || updates.profissao !== undefined || updates.possuiEntrada !== undefined || updates.interessesIds !== undefined || updates.valorEntrada !== undefined) {
          dbUpdates.tags = newTags;
        }

        if (updates.interessesIds !== undefined) {
          dbUpdates.empreendimento_id = newEmpreendimentoId;
        }

        if (Object.keys(dbUpdates).length > 0) {
          const { error } = await supabase
            .from('leads')
            .update(dbUpdates)
            .eq('id', leadId);

          if (error) {
            console.error('Supabase update error:', error);
            toast({ title: "Erro", description: "Falha ao salvar banco de dados.", variant: "destructive" });
            throw error;
          }

          toast({ title: "Sucesso", description: "Informações do lead atualizadas." });

          // If status changed, add to timeline
          if (updates.status && updates.status !== lead.status) {
            const message = `Status atualizado para: ${updates.status}`;
            await supabase.from('lead_timeline').insert({
              lead_id: leadId,
              type: 'status_change',
              title: 'Mudança de Fase',
              description: message,
              author: 'Usuário',
              metadata: { newStatus: updates.status }
            });
          }
        }
      } catch (err: any) {
        console.error('Error persisting lead update:', err);
        toast({ title: "Erro", description: "Falha ao processar salvamento.", variant: "destructive" });
      }
    }
  }, [leadId, lead, updateLead, properties, nodes, edges]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setTimeout(() => instance.fitView(), 200);
  }, []);

  const safeLeadName = lead?.nome || 'Jornada do Cliente';

  // DOCUMENT TITLE FOR PAGE MODE
  useEffect(() => {
    if (mode === 'page' && lead?.nome) {
      document.title = `${lead.nome} | Jornada do Cliente`;
    }
  }, [mode, lead?.nome]);

  // HANDLE GROUPING
  const handleGroupNodes = useCallback(() => {
    // 1. Identify selected nodes that aren't already children of another group (unless we support nesting, which we can)
    // For simplicity, we grab all selected nodes.
    const selected = nodes.filter((n) => n.selected);

    if (selected.length < 1) {
      toast({ title: "Agrupamento", description: "Selecione pelo menos um nó para agrupar." });
      return;
    }

    // Filter out existing groups from selection to avoid 'group inside group' if simpler 
    // or allow it. Let's allow it but be careful with relative positions.
    // Ideally, we group items that share the same parent context.

    // 2. Calculate Bounding Box
    const xPositions = selected.map((n) => n.position.x);
    const yPositions = selected.map((n) => n.position.y);
    const widths = selected.map((n) => n.measured?.width || (n.width || 200));
    const heights = selected.map((n) => n.measured?.height || (n.height || 100));

    const xMin = Math.min(...xPositions);
    const yMin = Math.min(...yPositions);
    const xMax = Math.max(...selected.map((n, i) => xPositions[i] + widths[i]));
    const yMax = Math.max(...selected.map((n, i) => yPositions[i] + heights[i]));

    const padding = 30; // Extra space around
    const width = (xMax - xMin) + (padding * 2);
    const height = (yMax - yMin) + (padding * 2);

    const groupNodeId = `group-${Date.now()}`;
    const groupNode: Node = {
      id: groupNodeId,
      type: 'groupNode',
      position: { x: xMin - padding, y: yMin - padding },
      style: { width, height },
      data: { label: 'Novo Grupo' },
    };

    // 3. Update Children to be relative to Parent
    const updatedChildren = selected.map((n) => {
      // If node was already child of another group, we would need to handle that.
      // For now, assuming flat hierarchy -> group.

      // Calculate relative position
      const relativeX = n.position.x - groupNode.position.x;
      const relativeY = n.position.y - groupNode.position.y;

      return {
        ...n,
        parentNode: groupNodeId,
        extent: 'parent',
        position: { x: relativeX, y: relativeY },
        selected: false, // De-select children
        style: { ...n.style, zIndex: 10 } // Ensure on top
      };
    });

    const nonSelectedNodes = nodes.filter((n) => !selected.includes(n));

    // Add group node FIRST so it renders behind? React Flow renders in order. 
    // Groups should be rendered usually before children if z-index isn't managed?
    // Actually parentNode handles z-ordering.

    setNodes([...nonSelectedNodes, groupNode, ...updatedChildren]);

    toast({ title: "Grupo Criado", description: `${selected.length} itens agrupados.` });
  }, [nodes, setNodes, toast]);

  // ADD FUNNEL HANDLER
  const handleAddFunnel = () => {
    if (!newFunnelName.trim() || !lead) return;

    const newTag = `Funnel: ${newFunnelName.trim()}`;
    const newTags = [...(lead.tags || [])];
    if (!newTags.includes(newTag)) {
      newTags.push(newTag);
    }

    const updates = { tags: newTags };
    updateLead(leadId, updates);

    supabase.from('leads').update(updates).eq('id', leadId).then(({ error }) => {
      if (error) console.error("Error adding funnel:", error);
      toast({ title: "Funil Adicionado", description: `${newFunnelName} foi vinculado.` });
    });

    setFunnelPopoverOpen(false);
  };

  // ADD TEXT HANDLER
  const handleAddText = useCallback(() => {
    const newNode = {
      id: `text-${Date.now()}`,
      type: 'textNode',
      position: { x: 500, y: 100 },
      data: {
        schema: 'text',
        label: 'Novo Texto',
        fontSize: 14,
        isGlobal: false
      }
    };

    setNodes((nds) => {
      const newNodes = [...nds, newNode];

      // AUTO-SAVE TO DB
      const journeyData = {
        nodes: newNodes.map(n => ({
          id: n.id,
          position: n.position,
          type: n.type,
          data: n.data
        })),
        edges: edges
      };

      supabase.from('leads').update({ journey_map_data: journeyData }).eq('id', leadId).then(res => {
        if (res.error) console.error("Error auto-saving new text node:", res.error);
      });

      return newNodes;
    });

    toast({ title: "Texto Adicionado", description: "Novo bloco de texto criado." });
  }, [setNodes, toast, leadId, edges]);






  const Content = (
    <div className={`flex flex-col w-full bg-slate-50 overflow-hidden border shadow-xl relative ${mode === 'page' ? 'h-screen' : 'h-[85vh] rounded-lg'}`}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 border-b shrink-0 bg-white/95 backdrop-blur z-10 gap-4 md:gap-0">
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Jornada do Cliente</h2>
              <p className="text-sm text-slate-500 font-medium truncate max-w-[200px] md:max-w-none">{safeLeadName}</p>
            </div>
          </div>

          {mode !== 'page' && (
            <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden hover:bg-red-50 hover:text-red-500 transition-colors">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin scrollbar-thumb-slate-200">

          <Badge variant="outline" className="bg-white gap-2 px-3 py-1">
            <Building2 className="w-3 h-3" />
            {nodes.filter(n => n.type === 'propertyNode').length} {nodes.filter(n => n.type === 'propertyNode').length === 1 ? 'Imóvel' : 'Imóveis'}
          </Badge>

          <Button
            size="sm"
            className="bg-primary text-white hover:bg-primary/90 gap-2 shadow-sm ml-2"
            onClick={async () => {
              if (!leadId) return;

              console.log('🎯 Current nodes in state:', nodes);
              console.log('🎯 Current nodes count:', nodes.length);
              console.log('🎯 Node types:', nodes.map(n => ({ id: n.id, type: n.type })));

              const journeyData = {
                nodes: nodes.map(n => ({
                  id: n.id,
                  position: n.position,
                  type: n.type,
                  data: n.data // Include all node data (messages, labels, etc.)
                })),
                edges: edges // Save all edges to persist custom connections
              };

              console.log('💾 Saving Journey Data to DB:', journeyData);
              console.log('📦 Total nodes being saved:', journeyData.nodes.length);
              console.log('📝 Text nodes being saved:', journeyData.nodes.filter(n => n.type === 'textNode'));
              console.log('🔗 Funnel nodes being saved:', journeyData.nodes.filter(n => n.type === 'followUpNode'));

              const { error } = await supabase
                .from('leads')
                .update({ journey_map_data: journeyData } as any)
                .eq('id', leadId);

              if (error) {
                console.error("Error saving journey:", error);
                toast({
                  title: "Erro ao salvar",
                  description: "Não foi possível persistir o layout. erro: " + error.message,
                  variant: "destructive"
                });
              } else {
                toast({
                  title: "Jornada Salva",
                  description: "Posições e layout salvos com sucesso."
                });
              }
            }}
          >
            <Save className="w-4 h-4" />
            Salvar
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white text-amber-600 border-amber-200 hover:bg-amber-50 gap-2 shadow-sm"
            onClick={() => setIsTaskDialogOpen(true)}
          >
            <CalendarPlus className="w-4 h-4" />
            Lembrete
          </Button>



          {selectedNodes.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="bg-white gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 ml-2 animate-in fade-in zoom-in-50"
                onClick={() => setTemplateNamingOpen(true)}
              >
                <Copy className="w-4 h-4" />
                Salvar Modelo ({selectedNodes.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white gap-2 text-red-600 border-red-200 hover:bg-red-50 ml-2 animate-in fade-in zoom-in-50"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="w-4 h-4" />
                Excluir ({selectedNodes.length})
              </Button>
            </>
          )}

          <Popover open={funnelPopoverOpen} onOpenChange={setFunnelPopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="bg-white gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 ml-2">
                <Filter className="w-4 h-4" />
                Add Funil
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-slate-900">Adicionar Funil de Follow-up</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do Funil (ex: 30 dias)"
                    value={newFunnelName}
                    onChange={(e) => setNewFunnelName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="h-8" onClick={handleAddFunnel}>Add</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['Boas Vindas', 'Agendamento', 'Esfriamento', 'Pós-Venda'].map(s => (
                    <div
                      key={s}
                      className="text-[10px] bg-slate-50 border p-2 rounded cursor-pointer hover:bg-slate-100 text-center truncate"
                      onClick={() => setNewFunnelName(s)}
                    >
                      {s}
                    </div>
                  ))}
                </div>

                {/* TEMPLATES LIST */}
                {templates.length > 0 && (
                  <div className="pt-2 border-t">
                    <h4 className="font-medium text-sm text-slate-900 mb-2">Meus Modelos</h4>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                      {templates.map(t => (
                        <div
                          key={t.id}
                          className="text-xs bg-indigo-50 border border-indigo-100 p-2 rounded cursor-pointer hover:bg-indigo-100 flex items-center justify-between group"
                          onClick={() => handleUseTemplate(t)}
                        >
                          <span className="truncate flex-1 font-medium text-indigo-700">{t.name}</span>
                          <span className="text-[10px] text-indigo-400 mr-2">({t.nodes_data.length})</span>
                          <button
                            className="text-indigo-300 hover:text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-1"
                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                            title="Excluir Modelo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            variant={isHandMode ? "secondary" : "outline"}
            className={`gap-2 ml-2 ${isHandMode ? "bg-slate-200 text-slate-900 border-slate-300" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            onClick={() => setIsHandMode(!isHandMode)}
            title={isHandMode ? "Mover Mapa (Ativo)" : "Ativar Mover Mapa"}
          >
            <Hand className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 ml-2"
            onClick={handleAddText}
          >
            <Type className="w-4 h-4" />
            Add Texto
          </Button>



          {mode !== 'page' && (
            <Button variant="ghost" size="icon" onClick={onClose} className="hidden md:flex ml-2 hover:bg-red-50 hover:text-red-500 transition-colors">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* CANVAS */}
      <div className="flex-1 relative w-full min-h-0 bg-slate-100/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onSelectionChange={({ nodes: selected }) => {
            setSelectedNodes(selected);
          }}
          onInit={onInit}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          panOnScroll={true}
          selectionOnDrag={!isHandMode}
          panOnDrag={isHandMode ? true : [1, 2]}
          selectionMode={SelectionMode.Partial}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
          <Controls showInteractive={true} className="!bg-white !border-slate-200 !shadow-lg !rounded-xl !m-4" />
          <MiniMap
            className="!bg-white !border-slate-200 !rounded-xl !bottom-4 !right-4 !shadow-lg"
            nodeColor={(n) => {
              if (n.type === 'leadNode') return '#0f172a';
              if (n.type === 'propertyNode') return '#3b82f6';
              return '#10b981';
            }}
          />
        </ReactFlow>

        {/* INTEGRATED DRAWER */}
        <EditDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          data={selectedNodeData}
          lead={lead}
          addNotification={addNotification}
          onSave={handleSaveNode}
          onDelete={async (id, type) => {
            // Handle funnel deletion
            if (type === 'funnel') {
              const nodeToDelete = nodes.find(n => n.id === selectedNodeData.nodeId);
              const isGlobalFunnel = nodeToDelete?.data?.isGlobal || nodeToDelete?.data?.applyToAll;

              if (isGlobalFunnel) {
                // Delete from ALL leads
                console.log('🗑️ Deleting global funnel from all leads...');

                const { data: allLeads, error: fetchError } = await supabase
                  .from('leads')
                  .select('id, journey_map_data')
                  .not('journey_map_data', 'is', null);

                if (!fetchError && allLeads) {
                  const deletePromises = allLeads.map(async (otherLead) => {
                    const journeyData = otherLead.journey_map_data as any;
                    if (journeyData?.nodes) {
                      // Remove the global funnel node (Target specific ID OR any Source/Clone via Label match)
                      // This ensures we catch the "Patient Zero" node which likely has a different timestamped ID
                      const targetLabel = selectedNodeData.label;
                      const updatedNodes = journeyData.nodes.filter((node: any) => {
                        // 1. Exact ID Match 
                        if (node.id === selectedNodeData.nodeId) return false;

                        // 2. Logic Match (Same Global Funnel Definition)
                        // Checks for nodes that act as the source (applyToAll=true) with the same label
                        if (node.type === 'followUpNode' &&
                          node.data?.applyToAll &&
                          node.data?.label === targetLabel) {
                          return false;
                        }

                        return true;
                      });

                      if (updatedNodes.length !== journeyData.nodes.length) {
                        await supabase
                          .from('leads')
                          .update({
                            journey_map_data: {
                              ...journeyData,
                              nodes: updatedNodes
                            }
                          })
                          .eq('id', otherLead.id);
                      }
                    }
                  });

                  await Promise.all(deletePromises);

                  toast({
                    title: "Funil Global Excluído",
                    description: "O funil foi removido de todos os leads."
                  });

                  // Also remove from current lead persistence explicitly to ensure visual sync
                  const updatedNodes = nodes.filter(n => n.id !== selectedNodeData.nodeId);
                  setNodes(updatedNodes);

                  if (leadId) {
                    const currentJourneyData = (lead as any).journey_map_data || {};
                    await supabase
                      .from('leads')
                      .update({
                        journey_map_data: {
                          ...currentJourneyData,
                          nodes: updatedNodes.map(n => ({
                            id: n.id,
                            position: n.position,
                            type: n.type,
                            data: n.data
                          })),
                          edges // Edges are from state scope
                        }
                      })
                      .eq('id', leadId);
                  }

                  setDrawerOpen(false);
                  return;
                }
              } else {
                // Delete only from current lead (Local Funnel)
                // Delegate to onNodesDelete to handle Tags removal correctly
                console.log('�️ Deleting local funnel via onNodesDelete delegate...');

                onNodesDelete([nodeToDelete] as any);
                setNodes((nds) => nds.filter(n => n.id !== selectedNodeData.nodeId));

                toast({
                  title: "Funil Excluído",
                  description: "O funil foi removido deste lead."
                });

                setDrawerOpen(false);
                return;
              }
            }

            // Handle property deletion (existing logic)
            // 1. Trigger Visual Update (Remove from ReactFlow state)
            setNodes((nds) => nds.filter(n => n.id !== selectedNodeData.nodeId));

            // 2. Trigger Persistence Logic
            // Reuse the onNodesDelete logic but targeted
            const nodeToDelete = {
              id: selectedNodeData.nodeId,
              type: 'propertyNode',
              data: { ...selectedNodeData, id: selectedNodeData.id }
            };

            // We invoke the logic directly. 
            // Note: onNodesDelete expects an array of deleted nodes.
            onNodesDelete([nodeToDelete] as any);

            setDrawerOpen(false);
          }}
        />

        {/* INTEGRATED TIMELINE DIALOG */}
        <LeadTimeline
          leadId={leadId}
          isOpen={timelineOpen}
          onClose={() => setTimelineOpen(false)}
        />

        {/* TASK DIALOG FOR REMINDERS */}
        {lead && (
          <TaskDialog
            isOpen={isTaskDialogOpen}
            onClose={() => setIsTaskDialogOpen(false)}
            lead={lead}
          />
        )}

        {/* TEMPLATE NAMING DIALOG */}
        <Dialog open={templateNamingOpen} onOpenChange={setTemplateNamingOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Salvar Modelo</DialogTitle>
              <DialogDescription>
                Dê um nome para este modelo de {selectedNodes.length} nodes.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="templateName" className="sr-only">
                  Nome do Modelo
                </Label>
                <Input
                  id="templateName"
                  placeholder="Ex: Funil de Resgate"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="secondary" onClick={() => setTemplateNamingOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveTemplate}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );

  if (mode === 'page') {
    return Content;
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full p-0 gap-0 bg-transparent border-none shadow-none [&>button]:hidden focus:outline-none">
        <DialogTitle className="sr-only">Mapa - {safeLeadName}</DialogTitle>
        <DialogDescription className="sr-only">Visualização</DialogDescription>
        {Content}
      </DialogContent>
    </Dialog>
  );
}

export function LeadJourneyMap(props: LeadJourneyMapProps) {
  const { addNotification } = useNotifications();
  return (
    <ReactFlowProvider>
      <LeadJourneyMapInner {...props} addNotification={props.addNotification || addNotification} />
    </ReactFlowProvider>
  );
}

export default LeadJourneyMap;
