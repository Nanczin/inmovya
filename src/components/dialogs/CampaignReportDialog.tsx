import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export function CampaignReportDialog({ open, onOpenChange, campaign }: { open: boolean, onOpenChange: (open: boolean) => void, campaign: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && campaign?.id) {
      fetchMessages();
    }
  }, [open, campaign]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_campaign_messages')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: messages.length,
    pendentes: messages.filter(m => m.status === 'Pendente').length,
    enviadas: messages.filter(m => m.status === 'Enviada').length,
    entregues: messages.filter(m => m.status === 'Entregue').length,
    falhas: messages.filter(m => m.status === 'Falha').length,
  };

  const taxaEntrega = stats.total > 0 ? ((stats.entregues / stats.total) * 100).toFixed(1) : "0.0";
  const taxaErro = stats.total > 0 ? ((stats.falhas / stats.total) * 100).toFixed(1) : "0.0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório da Campanha: {campaign?.nome}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando relatório...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total Contatos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-blue-500">{stats.pendentes}</div>
                  <div className="text-xs text-muted-foreground">Pendentes</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-green-500">{stats.entregues}</div>
                  <div className="text-xs text-muted-foreground">Entregues ({taxaEntrega}%)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-red-500">{stats.falhas}</div>
                  <div className="text-xs text-muted-foreground">Falhas ({taxaErro}%)</div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Detalhes dos Envios</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="font-medium">{msg.nome || 'N/A'}</TableCell>
                        <TableCell>{msg.telefone}</TableCell>
                        <TableCell>
                          <Badge variant={msg.status === 'Entregue' ? 'default' : msg.status === 'Falha' ? 'destructive' : 'secondary'}>
                            {msg.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{msg.data_envio ? new Date(msg.data_envio).toLocaleString() : '-'}</TableCell>
                        <TableCell className="text-destructive text-xs">{msg.erro || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {messages.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum registro encontrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
