import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  Save,
  Flame,
  Snowflake,
  ThermometerSun,
  Calendar,
  Loader2
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  status?: string;
  observacoes?: string;
  origem?: string;
  empreendimento?: {
    id: string;
    nome: string;
    imagem_principal?: string;
  };
}

interface LeadDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  lead: Lead | null;
}

export function LeadDetailDrawer({ isOpen, onClose, data, lead }: LeadDetailDrawerProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nome: lead?.nome || '',
    telefone: lead?.telefone || '',
    email: lead?.email || '',
    status: lead?.status || 'Novo',
    observacoes: lead?.observacoes || ''
  });

  const [loading, setLoading] = useState(false);
  const defaultStages = [
    { id: "1", name: "Novo" },
    { id: "2", name: "Contatado" },
    { id: "3", name: "Interessado" },
    { id: "4", name: "Visita Agendada" },
    { id: "5", name: "Proposta" },
    { id: "6", name: "Fechado" }
  ];

  const [funnelStages, setFunnelStages] = useState<{ id: string; name: string }[]>(() => {
    const saved = localStorage.getItem("inmovya_funnel_stages");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultStages;
      }
    }
    return defaultStages;
  });

  // Carregar os estágios do funil e resetar o formData quando o lead mudar
  useEffect(() => {
    const loadStages = () => {
      const saved = localStorage.getItem("inmovya_funnel_stages");
      if (saved) {
        try {
          setFunnelStages(JSON.parse(saved));
        } catch (e) {
          setFunnelStages(defaultStages);
        }
      } else {
        setFunnelStages(defaultStages);
      }
    };

    window.addEventListener('funnelStagesUpdated', loadStages);
    return () => window.removeEventListener('funnelStagesUpdated', loadStages);
  }, []);

  useEffect(() => {

    if (lead) {
      setFormData({
        nome: lead.nome || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        status: lead.status || 'Novo',
        observacoes: lead.observacoes || ''
      });
    }
  }, [lead]);

  const handleSave = async () => {
    if (!lead || !lead.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          nome: formData.nome,
          telefone: formData.telefone,
          email: formData.email,
          status: formData.status,
          observacoes: formData.observacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Alterações salvas",
        description: "Os dados do lead e a Etapa do Funil foram atualizados com sucesso.",
      });

      // Update the canvas nodes globally
      window.dispatchEvent(new Event('refreshLeads'));
      onClose();
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as informações do lead no mapa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!data) return null;

  // Renderização condicional baseada no tipo de nó
  const renderContent = () => {
    if (data.type === 'lead') {
      return (
        <div className="space-y-6">
          {/* Avatar e info principal */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{data.label}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="gap-1">
                  {data.temperature === 'hot' && <Flame className="w-3 h-3 text-red-500" />}
                  {data.temperature === 'warm' && <ThermometerSun className="w-3 h-3 text-orange-500" />}
                  {data.temperature === 'cold' && <Snowflake className="w-3 h-3 text-blue-500" />}
                  {data.temperature === 'hot' ? 'Quente' : data.temperature === 'warm' ? 'Morno' : 'Frio'}
                </Badge>
                <Badge>{data.status}</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Formulário de edição */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do lead"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Etapa do Funil (Status)</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa do funil" />
                </SelectTrigger>
                <SelectContent>
                  {funnelStages.map(stage => (
                    <SelectItem key={`drawer-${stage.id}`} value={stage.name}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Anotações sobre o lead..."
                rows={4}
              />
            </div>
          </div>

          <Separator />

          {/* Empreendimento associado */}
          {lead?.empreendimento && (
            <div className="space-y-2">
              <Label>Empreendimento de Interesse</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{lead.empreendimento.nome}</p>
                  <p className="text-xs text-muted-foreground">Ver detalhes do empreendimento</p>
                </div>
              </div>
            </div>
          )}

          {/* Botão salvar */}
          <Button onClick={handleSave} className="w-full gap-2" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        </div>
      );
    }

    // Tipo Property
    if (data.type === 'property') {
      return (
        <div className="space-y-6">
          <div className="aspect-video rounded-lg bg-muted overflow-hidden">
            {data.thumb ? (
              <img src={data.thumb} alt={data.label} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-xl">{data.label}</h3>
            {data.location && (
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                <span>{data.location}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-semibold">Status do Lead com este Imóvel</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <Calendar className="w-3 h-3" />
                Visitado em 20/01/2025
              </Badge>
              <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">
                Interesse confirmado
              </Badge>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2">
            <Building2 className="w-4 h-4" />
            Ver Empreendimento Completo
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {data.type === 'lead' ? 'Detalhes do Lead' : 'Detalhes do Imóvel'}
          </SheetTitle>
          <SheetDescription>
            {data.type === 'lead'
              ? 'Visualize e edite as informações do lead'
              : 'Informações sobre o interesse neste imóvel'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
