import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  Eye,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailLog {
  id: string;
  provider: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  error_message?: string;
  lead_id?: number;
  sent_at: string;
}

export function EmailHistory() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  useEffect(() => {
    loadEmailHistory();
  }, []);

  useEffect(() => {
    filterEmails();
  }, [emails, searchTerm, statusFilter, providerFilter]);

  const loadEmailHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error loading email history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEmails = () => {
    let filtered = emails;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(email => 
        email.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(email => email.status === statusFilter);
    }

    // Filter by provider
    if (providerFilter !== "all") {
      filtered = filtered.filter(email => email.provider === providerFilter);
    }

    setFilteredEmails(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default",
      failed: "destructive",
      pending: "secondary"
    } as const;

    const labels = {
      success: "Enviado",
      failed: "Falhou",
      pending: "Pendente"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      gmail: "bg-red-100 text-red-800",
      skymail: "bg-blue-100 text-blue-800",
      resend: "bg-purple-100 text-purple-800"
    };

    return (
      <Badge 
        variant="outline" 
        className={colors[provider as keyof typeof colors] || "bg-gray-100 text-gray-800"}
      >
        {provider.charAt(0).toUpperCase() + provider.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p>Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Histórico de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por destinatário ou assunto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Enviados</SelectItem>
                <SelectItem value="failed">Falharam</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="skymail">Skymail</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email List */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredEmails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum email encontrado</p>
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <Card key={email.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(email.status)}
                          <span className="font-medium truncate">{email.recipient}</span>
                          {getProviderBadge(email.provider)}
                          {getStatusBadge(email.status)}
                        </div>
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(email.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          {email.error_message && (
                            <span className="text-red-500 truncate max-w-[200px]">
                              {email.error_message}
                            </span>
                          )}
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmail(email)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Mail className="w-5 h-5" />
                              Detalhes do Email
                            </DialogTitle>
                          </DialogHeader>
                          {selectedEmail && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-sm font-medium">Destinatário</Label>
                                  <p className="text-sm">{selectedEmail.recipient}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium">Status</Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    {getStatusIcon(selectedEmail.status)}
                                    {getStatusBadge(selectedEmail.status)}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium">Provedor</Label>
                                  <div className="mt-1">{getProviderBadge(selectedEmail.provider)}</div>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium">Data/Hora</Label>
                                  <p className="text-sm">
                                    {format(new Date(selectedEmail.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Assunto</Label>
                                <p className="text-sm mt-1">{selectedEmail.subject}</p>
                              </div>
                              {selectedEmail.error_message && (
                                <div>
                                  <Label className="text-sm font-medium text-red-600">Erro</Label>
                                  <p className="text-sm text-red-600 mt-1">{selectedEmail.error_message}</p>
                                </div>
                              )}
                              <div>
                                <Label className="text-sm font-medium">Conteúdo</Label>
                                <ScrollArea className="h-[200px] mt-2 p-3 border rounded-md bg-muted/50">
                                  <pre className="text-sm whitespace-pre-wrap">{selectedEmail.body}</pre>
                                </ScrollArea>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}