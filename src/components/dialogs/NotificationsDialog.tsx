
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/useNotifications";
import { useLeads } from "@/context/LeadsContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  MailCheck,
  PhoneOutgoing
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NotificationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (module: string, id?: string) => void;
}

export function NotificationsDialog({ isOpen, onClose, onNavigate }: NotificationsDialogProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsActioned,
    markAllAsRead,
    clearAll,
    removeNotification
  } = useNotifications();
  const { getLeadById } = useLeads();

  const { toast } = useToast();

  const handleRegisterContact = async (notification: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.leadId) return;

    try {
      const now = new Date().toISOString();

      // Atualizar Lead (ultimo_contato)
      const { error: leadError } = await supabase
        .from('leads')
        .update({ ultimo_contato: now })
        .eq('id', notification.leadId);

      if (leadError) throw leadError;

      // Determinar o tipo de evento na timeline baseado na notificação
      const isReminder = notification.title.toLowerCase().includes('lembrete');
      const timelineTitle = isReminder ? 'Lembrete Concluído' : 'Contato Realizado';
      const timelineDesc = isReminder
        ? `Lembrete marcado como feito: "${notification.message}"`
        : 'Contato registrado através da notificação de follow-up.';

      // Adicionar Timeline
      await supabase
        .from('lead_timeline')
        .insert({
          lead_id: notification.leadId,
          type: 'contact', // Mantemos contact para indicar ação realizada
          title: timelineTitle,
          description: timelineDesc,
          author: 'Usuário'
        });

      // Se for lembrete, atualizar o status da tarefa para concluído
      if (isReminder) {
        // Find and update pending tasks for this lead
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('lead_id', notification.leadId)
          .eq('status', 'pending');
      }

      // NÒO marcar notificação como lida automaticamente (pedido do usuário)
      // markAsRead(notification.id);

      // Mark as Actioned locally so button disappears
      markAsActioned(notification.id);

      // Forçar atualização da lista de leads
      window.dispatchEvent(new Event('refreshLeads'));

      toast({
        title: "Contato registrado",
        description: "O último contato foi atualizado com sucesso.",
        variant: "default"
      });

    } catch (error) {
      console.error('Error registering contact:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar contato.",
        variant: "destructive"
      });
    }
  };

  const [activeTab, setActiveTab] = useState("all");

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      case 'system':
        return <Bell className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === "unread") return !notification.read;
    return true;
  });

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleClearAll = () => {
    clearAll();
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const renderList = (emptyIcon: React.ReactNode, emptyText: string) => {
    if (filteredNotifications.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4">
          {emptyIcon}
          <p className="text-sm text-muted-foreground mt-3">{emptyText}</p>
        </div>
      );
    }

    return (
      <ul className="space-y-2 sm:space-y-3">
        {filteredNotifications.map((notification) => {
          const leadName = notification.leadId ? getLeadById(notification.leadId)?.nome : undefined;
          return (
            <li key={notification.id}>
              <div
                role="button"
                tabIndex={0}
                className={`group rounded-lg border p-3 sm:p-4 cursor-pointer transition-colors ${!notification.read
                  ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                  : 'bg-card hover:bg-muted/50'
                  }`}
                onClick={() => {
                  if (notification.taskId && onNavigate) {
                    onNavigate('view-task', notification.taskId);
                    onClose();
                  } else if (notification.leadId && onNavigate) {
                    onNavigate('leads', notification.leadId);
                    onClose();
                  }
                }}
              >
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h4 className="flex-1 min-w-0 text-sm font-medium leading-snug break-words line-clamp-2">
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <span className="mt-1.5 w-2 h-2 bg-primary rounded-full shrink-0" aria-label="Não lida" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mt-1 -mr-1 h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        title="Excluir notificação"
                        aria-label="Excluir notificação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {notification.message && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words line-clamp-3">
                        {notification.message}
                      </p>
                    )}

                    {leadName && (
                      <p className="text-xs sm:text-sm font-medium text-foreground mt-1.5 truncate">
                        Lead: {leadName}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-[11px] sm:text-xs text-muted-foreground mr-auto whitespace-nowrap">
                        {new Date(notification.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {notification.leadId && !notification.actioned && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 sm:h-7 px-2.5 text-xs bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                          onClick={(e) => handleRegisterContact(notification, e)}
                          title="Marcar que o contato foi realizado"
                        >
                          <PhoneOutgoing className="w-3.5 h-3.5 mr-1" />
                          Feito
                        </Button>
                      )}
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 sm:h-7 px-2.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                        >
                          <MailCheck className="w-3.5 h-3.5 mr-1" />
                          <span className="hidden min-[400px]:inline">Marcar como lida</span>
                          <span className="min-[400px]:hidden">Lida</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden w-[calc(100vw-1rem)] max-w-2xl h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[85vh] rounded-lg">
        <DialogHeader className="shrink-0 space-y-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b text-left">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
            <Bell className="w-5 h-5 shrink-0" />
            Notificações
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </DialogTitle>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="h-8 text-xs"
                >
                  <MailCheck className="w-4 h-4 mr-1 shrink-0" />
                  <span className="hidden sm:inline">Marcar todas como lidas</span>
                  <span className="sm:hidden">Ler todas</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-8 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1 shrink-0" />
                <span className="hidden sm:inline">Limpar todas</span>
                <span className="sm:hidden">Limpar</span>
              </Button>
            </div>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 w-full">
          <div className="shrink-0 px-4 pt-3 sm:px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                Todas ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs sm:text-sm">
                Não lidas ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="flex-1 min-h-0 mt-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4 data-[state=inactive]:hidden">
            {renderList(<Bell className="w-10 h-10 text-muted-foreground" />, "Nenhuma notificação encontrada")}
          </TabsContent>

          <TabsContent value="unread" className="flex-1 min-h-0 mt-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4 data-[state=inactive]:hidden">
            {renderList(<CheckCircle className="w-10 h-10 text-green-500" />, "Todas as notificações foram lidas!")}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
