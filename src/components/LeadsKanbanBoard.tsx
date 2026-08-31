import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MessageCircle, Edit, Network, PhoneOutgoing, CalendarPlus, Trash2 } from "lucide-react";

interface LeadsKanbanBoardProps {
  leads: any[];
  stages: { id: string; name: string }[];
  getStatusColor: (status: string) => string;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onViewTimeline: (lead: any) => void;
  onViewJourneyMap: (lead: any) => void;
  onEditLead: (lead: any) => void;
  onRegisterContact: (lead: any) => void;
  onWhatsApp: (lead: any) => void;
  onScheduleTask: (lead: any) => void;
  onDeleteTask: (taskId: string) => void;
}

export function LeadsKanbanBoard({
  leads,
  stages,
  getStatusColor,
  onStatusChange,
  onViewTimeline,
  onViewJourneyMap,
  onEditLead,
  onRegisterContact,
  onWhatsApp,
  onScheduleTask
}: LeadsKanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) {
      onStatusChange(leadId, newStatus);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x">
      {stages.map(stage => {
        const stageLeads = leads.filter(l => (l.status || 'Novo') === stage.name);
        
        return (
          <div 
            key={stage.id} 
            className="flex-shrink-0 w-[300px] bg-muted/40 rounded-xl p-3 border border-border/50 flex flex-col gap-3 snap-start"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.name)}
          >
            <div className="flex items-center justify-between mb-1 px-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline" className={`${getStatusColor(stage.name)} bg-opacity-20 px-2.5 py-0.5 border-none shadow-sm`}>
                  {stage.name}
                </Badge>
              </h3>
              <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-1 rounded-full shadow-sm border border-border/50">
                {stageLeads.length}
              </span>
            </div>
            
            <div className="flex flex-col gap-3 min-h-[200px] h-full rounded-lg">
              {stageLeads.map(lead => {
                const pendingTasks = lead.tasks?.filter((t: any) => t.status === 'pending') || [];
                return (
                <Card 
                  key={lead.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-l-4 hover:border-l-primary/70 bg-card group"
                  style={{ borderLeftColor: 'var(--primary)' }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm leading-tight text-foreground truncate" title={lead.displayNome || lead.nome}>
                      {lead.displayNome || lead.nome}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 mb-3">
                    {lead.telefone && <div className="text-[11px] text-muted-foreground truncate">{lead.telefone}</div>}
                    {lead.origem && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {lead.origem}
                      </Badge>
                    )}
                    {lead.ultimo_contato && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1" title={`Último contato: ${new Date(lead.ultimo_contato).toLocaleString('pt-BR')}`}>
                        <PhoneOutgoing className="w-3 h-3" />
                        {formatDistanceToNow(new Date(lead.ultimo_contato), { addSuffix: true, locale: ptBR })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1" title={new Date(lead.created_at).toLocaleString('pt-BR')}>
                      <Clock className="w-3 h-3" />
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    
                    <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                       <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRegisterContact(lead); }} className="p-1.5 hover:bg-blue-100 rounded text-blue-700 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors" title="Registrar Contato">
                         <PhoneOutgoing className="w-3.5 h-3.5 pointer-events-none" />
                       </button>
                       <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWhatsApp(lead); }} className="p-1.5 hover:bg-green-100 rounded text-green-600 dark:hover:bg-green-900/30 dark:text-green-400 transition-colors" title="WhatsApp">
                         <MessageCircle className="w-3.5 h-3.5 pointer-events-none" />
                       </button>
                       <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewTimeline(lead); }} className="p-1.5 hover:bg-primary/10 rounded text-primary transition-colors" title="Timeline">
                         <Clock className="w-3.5 h-3.5 pointer-events-none" />
                       </button>
                       <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onScheduleTask(lead); }} className="p-1.5 hover:bg-orange-100 rounded text-orange-500 dark:hover:bg-orange-900/30 dark:text-orange-400 transition-colors" title="Criar Lembrete">
                         <CalendarPlus className="w-3.5 h-3.5 pointer-events-none" />
                       </button>
                       <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditLead(lead); }} className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors" title="Editar">
                         <Edit className="w-3.5 h-3.5 pointer-events-none" />
                       </button>
                    </div>
                  </div>
                {pendingTasks.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-orange-100 dark:border-orange-950/50">
                      {pendingTasks.map((task: any) => (
                        <div key={task.id} className="flex items-start gap-1.5 text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400 p-1.5 rounded-md" title={task.description}>
                          <CalendarPlus className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <div className="flex flex-col leading-tight flex-1">
                            <span className="font-medium truncate max-w-[190px]">{task.title}</span>
                            <span className="opacity-80">{new Date(task.due_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteTask(task.id); }} className="opacity-50 hover:opacity-100 hover:text-red-500 transition-colors p-1" title="Excluir lembrete">
                              <Trash2 className="w-3 h-3 pointer-events-none" />
                            </button>
                          </div>
                      ))}
                    </div>
                  )}
                </Card>
              );})} 
              {stageLeads.length === 0 && (
                <div className="text-center flex items-center justify-center h-24 text-xs text-muted-foreground/60 border-2 border-dashed border-border/50 rounded-lg bg-background/30">
                  Arraste leads para cá
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}





















