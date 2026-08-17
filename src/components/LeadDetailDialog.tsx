import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LeadTimeline } from "./LeadTimeline";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Phone,
  Mail,
  Calendar,
  MapPin,
  Building,
  User,
  Save,
  Trash2
} from "lucide-react";

interface Lead {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  origem: string;
  status: string;
  etapa: string;
  interesse: string;
  cadastro: string;
  observacoes: string;
}

interface LeadDetailDialogProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  onDelete?: (leadId: number) => void;
}

export function LeadDetailDialog({ lead, isOpen, onClose, onSave, onDelete }: LeadDetailDialogProps) {
  const [editedLead, setEditedLead] = useState<Lead | null>(lead);
  const { toast } = useToast();

  const handleSave = () => {
    if (!editedLead) return;

    onSave(editedLead);
    toast({
      title: "Lead Atualizado",
      description: `Informações de ${editedLead.nome} foram salvas.`,
      variant: "default",
    });
    onClose();
  };

  const handleDelete = () => {
    if (!editedLead || !onDelete) return;

    onDelete(editedLead.id);
    toast({
      title: "Lead Removido",
      description: `${editedLead.nome} foi removido da lista.`,
      variant: "destructive",
    });
    onClose();
  };

  const makeCall = async () => {
    if (!editedLead) return;

    toast({
      title: "Ligação Iniciada",
      description: `Discando para ${editedLead.telefone}...`,
      variant: "default",
    });

    // Registrar a ligação na timeline
    try {
      const { error } = await supabase
        .from('lead_timeline')
        .insert({
          lead_id: editedLead.id,
          type: 'call',
          title: 'Ligação Realizada',
          description: `Ligação iniciada para o número ${editedLead.telefone}`,
          author: 'Usuário'
        });

      if (error) {
        console.error('Erro ao registrar ligação na timeline:', error);
      }
    } catch (err) {
      console.error('Erro inesperado ao registrar ligação:', err);
    }

    // Simular integração com Tasker
    console.log('Iniciando ligação via Tasker:', editedLead.telefone);
  };

  const sendEmail = () => {
    if (!editedLead) return;

    const subject = `Contato Inmovya - ${editedLead.interesse}`;
    const body = `Olá ${editedLead.nome},\n\nEspero que esteja bem! Estou entrando em contato sobre seu interesse em ${editedLead.interesse}.\n\nGostaria de agendar uma conversa para entender melhor suas necessidades?\n\nAguardo seu retorno!\n\nAtenciosamente,\nEquipe Inmovya`;
    
    const mailtoUrl = `mailto:${editedLead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);

    toast({
      title: "Email Preparado",
      description: "Cliente de email foi aberto com a mensagem.",
      variant: "default",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Novo": return "bg-primary text-primary-foreground";
      case "Contatado": return "bg-accent text-accent-foreground";
      case "Interessado": return "bg-success text-success-foreground";
      case "Não Atendeu": return "bg-warning text-warning-foreground";
      case "Descartado": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (!editedLead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Detalhes do Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={editedLead.nome}
                onChange={(e) => setEditedLead({...editedLead, nome: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={editedLead.telefone}
                onChange={(e) => setEditedLead({...editedLead, telefone: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editedLead.email}
                onChange={(e) => setEditedLead({...editedLead, email: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="origem">Origem</Label>
              <select
                id="origem"
                value={editedLead.origem}
                onChange={(e) => setEditedLead({...editedLead, origem: e.target.value})}
                className="w-full mt-1 p-2 border border-input rounded-md bg-background"
              >
                <option value="Site">Site</option>
                <option value="Facebook Ads">Facebook Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Indicação">Indicação</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Telefone">Telefone</option>
              </select>
            </div>
          </div>

          {/* Status e Etapa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={editedLead.status}
                onChange={(e) => setEditedLead({...editedLead, status: e.target.value})}
                className="w-full mt-1 p-2 border border-input rounded-md bg-background"
              >
                <option value="Novo">Novo</option>
                <option value="Contatado">Contatado</option>
                <option value="Interessado">Interessado</option>
                <option value="Não Atendeu">Não Atendeu</option>
                <option value="Descartado">Descartado</option>
              </select>
            </div>
            <div>
              <Label htmlFor="etapa">Etapa</Label>
              <select
                id="etapa"
                value={editedLead.etapa}
                onChange={(e) => setEditedLead({...editedLead, etapa: e.target.value})}
                className="w-full mt-1 p-2 border border-input rounded-md bg-background"
              >
                <option value="Nenhuma">Nenhuma</option>
                <option value="Primeiro Contato">Primeiro Contato</option>
                <option value="Qualificação">Qualificação</option>
                <option value="Apresentação">Apresentação</option>
                <option value="Negociação">Negociação</option>
                <option value="Fechamento">Fechamento</option>
                <option value="Pós-venda">Pós-venda</option>
              </select>
            </div>
          </div>

          {/* Interesse */}
          <div>
            <Label htmlFor="interesse">Empreendimento de Interesse</Label>
            <select
              id="interesse"
              value={editedLead.interesse}
              onChange={(e) => setEditedLead({...editedLead, interesse: e.target.value})}
              className="w-full mt-1 p-2 border border-input rounded-md bg-background"
            >
              <option value="Residencial Aurora">Residencial Aurora</option>
              <option value="Casas Condomínio Verde">Casas Condomínio Verde</option>
              <option value="Apartamentos Centro">Apartamentos Centro</option>
              <option value="Vila dos Pássaros">Vila dos Pássaros</option>
              <option value="Edifício Sunset">Edifício Sunset</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={editedLead.observacoes}
              onChange={(e) => setEditedLead({...editedLead, observacoes: e.target.value})}
              className="mt-1 min-h-[100px]"
              placeholder="Anotações sobre o lead, preferências, orçamento, etc."
            />
          </div>

          {/* Informações do Sistema */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Cadastrado em: {editedLead.cadastro}
              </span>
            </div>
            <Badge className={getStatusColor(editedLead.status)}>
              {editedLead.status}
            </Badge>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button variant="default" onClick={makeCall}>
              <Phone className="w-4 h-4 mr-2" />
              Ligar Agora
            </Button>
            <Button variant="outline" onClick={sendEmail}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar Email
            </Button>
            <Button variant="success" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
            {onDelete && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}