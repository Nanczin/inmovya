
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/useNotifications";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] p-4 sm:p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </DialogTitle>

            <div className="flex flex-wrap items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs"
                >
                  <MailCheck className="w-4 h-4 mr-1" />
                  Marcar todas como lidas
                </Button>
              )}

              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar todas
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">
              Todas ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Não lidas ({unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma notificação encontrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredNotifications.map((notification, index) => (
                    <div key={notification.id}>
                      <div
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${!notification.read
                          ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                          : 'bg-card hover:bg-muted/50'
                          }`}
                        onClick={() => {
                          if (notification.leadId) {
                            if (notification.taskId && onNavigate) { onNavigate('view-task', notification.taskId); onClose(); } else if (notification.leadId && onNavigate) { onNavigate('leads', notification.leadId); onClose(); }
                          }
                          // handleMarkAsRead(notification.id);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <h4 className="text-sm font-medium truncate">
                                {notification.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                {notification.leadId && !notification.actioned && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                                    onClick={(e) => handleRegisterContact(notification, e)}
                                    title="Marcar que o contato foi realizado"
                                  >
                                    <PhoneOutgoing className="w-3 h-3 mr-1" />
                                    Feito
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification.id);
                                  }}
                                >
                                  Marcar como lida
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeNotification(notification.id);
                                  }}
                                  title="Excluir notificação"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                                )}
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>

                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.timestamp).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {index < filteredNotifications.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unread" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">Todas as notificações foram lidas!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredNotifications.map((notification, index) => (
                    <div key={notification.id}>
                      <div
                        className="p-4 rounded-lg border bg-primary/5 border-primary/20 hover:bg-primary/10 cursor-pointer transition-colors"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-medium truncate">
                                {notification.title}
                              </h4>
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                            </div>

                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>

                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.timestamp).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {index < filteredNotifications.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}






