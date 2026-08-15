import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { LeadTimeline } from "@/components/LeadTimeline";
import { EmailComposer } from "@/components/EmailComposer";
import { LeadFilters } from "@/components/LeadFilters";
import { LeadJourneyMap } from "@/components/journey-map";
import { TaskDialog } from "@/components/dialogs/TaskDialog";
import { useLeads } from "@/context/LeadsContext";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { findBestSheetData } from "@/utils/excelUtils";
import { formatCurrency } from "@/utils/formatUtils";
import {
  Plus,
  Upload,
  Search,
  Filter,
  MessageCircle,
  Mail,
  Eye,
  MoreHorizontal,
  UserPlus,
  Download,
  Edit,
  Trash2,
  Clock,
  Network,
  HelpCircle,
  FileText,
  AlertTriangle,
  Flame,
  ThermometerSun,
  Snowflake,
  Bell,
  PhoneOutgoing,
  CalendarPlus,
  Phone,
  Loader2
} from "lucide-react";

export function LeadsModule({ initialLeadId }: { initialLeadId?: string }) {
  const { leads, refreshLeads } = useLeads();
  const { addNotification } = useNotifications();



  // Polling para verificar lembretes vencidos
  // Task polling moved to global TaskNotificationPoller component


  const lastProcessedLeadId = useRef<string | null>(null);
  const formatPhone = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Apply formatting based on length
    if (digits.length <= 2) {
      return `(${digits}`;
    } else if (digits.length <= 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length <= 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else {
      // Limit to 11 digits
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isJourneyMapOpen, setIsJourneyMapOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportHelpOpen, setIsImportHelpOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [selectedLeadsIds, setSelectedLeadsIds] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedLeadForTask, setSelectedLeadForTask] = useState<any>(null);
  const [editLead, setEditLead] = useState({
    nome: "",
    telefone: "",
    email: "",
    origem: "",
    interesse: [] as string[],
    observacoes: "",
    tags: [] as string[],
    renda: "",
    profissao: "",
    possuiEntrada: "",
    valorEntrada: "",
    status: "",
    tagsRaw: undefined as string | undefined
  });
  const [activeFilters, setActiveFilters] = useState({
    status: [] as string[],
    origem: [] as string[],
    etapa: [] as string[],
    interesse: [] as string[],
    tags: [] as string[],
    dataInicio: "",
    dataFim: ""
  });
  const [newLead, setNewLead] = useState({
    nome: "",
    telefone: "",
    email: "",
    origem: "",
    interesse: [] as string[],
    observacoes: "",
    tags: [] as string[],
    renda: "",
    profissao: "",
    possuiEntrada: "",
    valorEntrada: "",
    status: "Novo",
    tagsRaw: undefined as string | undefined
  });

  // Estados para dados reais
  // const [leadsReais, setLeadsReais] = useState<any[]>([]); // REMOVIDO: Usar do Contexto
  const [empreendimentos, setEmpreendimentos] = useState<any[]>([]);

  const [funnelStages, setFunnelStages] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("inmovya_funnel_stages");
    const defaultStages = [
      { id: "1", name: "Novo" },
      { id: "2", name: "Contatado" },
      { id: "3", name: "Interessado" },
      { id: "4", name: "Visita Agendada" },
      { id: "5", name: "Proposta" },
      { id: "6", name: "Fechado" }
    ];
    if (saved) {
      try {
        setFunnelStages(JSON.parse(saved));
      } catch (e) {
        setFunnelStages(defaultStages);
      }
    } else {
      setFunnelStages(defaultStages);
    }
  }, []);

  const [statsReais, setStatsReais] = useState({
    total: 0,
    novosHoje: 0,
    interessados: 0,
    aguardando: 0
  });
  const [loading, setLoading] = useState(true);



  // Estado para o Dialog de Importação Simplificado
  const [importDialogState, setImportDialogState] = useState<{
    isOpen: boolean;
    file: File | null;
    data: any[];
    listName: string;
  }>({
    isOpen: false,
    file: null,
    data: [],
    listName: ""
  });



  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para carregar empreendimentos
  const carregarEmpreendimentos = async () => {
    try {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, status')
        // .eq('status', 'Ativo') // Descomentar se quiser filtrar por Ativo apenas
        .order('nome');

      if (error) {
        console.error('Erro ao carregar empreendimentos:', error);
        return;
      }

      setEmpreendimentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar empreendimentos:', error);
    }
  };

  // Calcular estatísticas sempre que 'leads' do contexto mudar
  useEffect(() => {
    if (!leads || !Array.isArray(leads)) {
      setLoading(false);
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const total = leads.length;
    const novosHoje = leads.filter(lead => {
      if (!lead.created_at && !lead.dataCadastro) return false;
      const dataLead = new Date(lead.created_at || lead.dataCadastro!);
      dataLead.setHours(0, 0, 0, 0);
      return dataLead.getTime() === hoje.getTime();
    }).length;

    const interessados = leads.filter(lead =>
      lead.status === 'Interessado' || lead.status === 'Qualificado' || lead.status === 'Proposta'
    ).length;

    const aguardando = leads.filter(lead =>
      lead.status === 'Novo' || lead.status === 'Pendente' || lead.status === 'Visita Agendada'
    ).length;

    setStatsReais({
      total,
      novosHoje,
      interessados,
      aguardando
    });

    setLoading(false);
  }, [leads]);

  // Carregar dados auxiliares ao inicializar
  useEffect(() => {
    carregarEmpreendimentos();
    refreshLeads(); // Garante dados frescos
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Novo": return "bg-primary text-primary-foreground";
      case "Contatado": return "bg-accent text-accent-foreground";
      case "Interessado": return "bg-success text-success-foreground";
      case "Não Atendeu": return "bg-warning text-warning-foreground";
      case "Descartado": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  }



  const applyFilters = (filters: any) => {
    setActiveFilters(filters);

    // Mostrar toast com filtros aplicados
    const filterCount = Object.values(filters).flat().filter(Boolean).length;
    toast({
      title: "Filtros aplicados",
      description: `${filterCount} filtro(s) ativo(s)`,
    });
  };

  const getActiveFiltersCount = () => {
    return activeFilters.status.length +
      activeFilters.origem.length +
      activeFilters.etapa.length +
      activeFilters.interesse.length +
      activeFilters.tags.length +
      (activeFilters.dataInicio ? 1 : 0) +
      (activeFilters.dataFim ? 1 : 0);
  };

  // Função para obter todas as tags disponíveis dos leads
  const getAvailableTags = () => {
    if (!leads || !Array.isArray(leads)) return [];
    const allTags = leads.flatMap(lead => lead.tags || []);
    return [...new Set(allTags)].sort();
  };

  const filteredLeads = (leads && Array.isArray(leads) ? leads : []).filter(lead => {
    // Filtro por busca textual
    const matchesSearch = lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.telefone && lead.telefone.includes(searchTerm));

    if (!matchesSearch) return false;

    // Filtros específicos
    if (activeFilters.status.length > 0 && !activeFilters.status.includes(lead.status)) {
      return false;
    }

    if (activeFilters.origem.length > 0 && lead.origem && !activeFilters.origem.includes(lead.origem)) {
      return false;
    }

    // Filtro por empreendimento
    if (activeFilters.interesse.length > 0 && lead.empreendimento?.nome && !activeFilters.interesse.includes(lead.empreendimento.nome)) {
      return false;
    }

    // Filtro por tags
    if (activeFilters.tags.length > 0) {
      const leadTags = lead.tags || [];
      const hasMatchingTag = activeFilters.tags.some(tag => leadTags.includes(tag));
      if (!hasMatchingTag) return false;
    }



    // Filtro por data de cadastro
    if (activeFilters.dataInicio) {
      const leadDate = new Date(lead.created_at);
      const startDate = new Date(activeFilters.dataInicio);
      if (leadDate < startDate) return false;
    }

    if (activeFilters.dataFim) {
      const leadDate = new Date(lead.created_at);
      const endDate = new Date(activeFilters.dataFim);
      if (leadDate > endDate) return false;
    }

    return true;
  });

  const handleCreateLead = async () => {
    // Validação básica
    if (!newLead.nome || !newLead.telefone || !newLead.email) {
      toast({
        title: "Erro de validação",
        description: "Nome, telefone e email são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar leads.",
          variant: "destructive",
        });
        return;
      }

      // Salvar no Supabase com user_id
      const { error } = await supabase
        .from('leads')
        .insert([{
          nome: newLead.nome,
          telefone: newLead.telefone,
          email: newLead.email,
          origem: newLead.origem || null,
          observacoes: newLead.observacoes || null,
          ultimo_contato: new Date().toISOString(),
          empreendimento_id: newLead.interesse.length > 0 ? newLead.interesse[0] : null,
          status: newLead.status || 'Novo',
          tags: [
            ...newLead.tags,
            ...newLead.interesse.map(id => {
              const emp = empreendimentos.find(e => e.id === id);
              return emp ? `Interesse: ${emp.nome}` : null;
            }).filter(Boolean) as string[],
            // Campos extras como tags
            newLead.renda ? `Renda: ${newLead.renda}` : null,
            newLead.profissao ? `Profissão: ${newLead.profissao}` : null,
            newLead.possuiEntrada ? `Entrada: ${newLead.possuiEntrada === 'sim' ? (newLead.valorEntrada ? `Sim (${newLead.valorEntrada})` : 'Sim') : 'Não'}` : null
          ].filter(Boolean) as string[],
          user_id: user.id
        }]);

      if (error) {
        throw error;
      }

      toast({
        title: "Lead criado com sucesso!",
        description: `${newLead.nome} foi adicionado à lista de leads.`,
      });

      // Resetar formulário e fechar dialog
      setNewLead({
        nome: "",
        telefone: "",
        email: "",
        origem: "",
        interesse: [],
        observacoes: "",
        tags: [],
        tagsRaw: "",
        renda: "",
        profissao: "",
        possuiEntrada: "",
        valorEntrada: "",
        status: "Novo"
      });
      setIsDialogOpen(false);

      // Recarregar a lista de leads
      refreshLeads();

    } catch (error) {
      console.error('Erro ao criar lead:', JSON.stringify(error, null, 2));
      toast({
        title: "Erro ao criar lead",
        description: "Houve um problema ao salvar o lead. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleWhatsApp = (lead: any) => {
    const phoneNumber = lead.telefone.replace(/\D/g, ''); // Remove non-digits
    const message = `Olá ${lead.nome}, tudo bem? Sou da equipe de vendas da Inmovya e gostaria de conversar com você sobre seu interesse no ${lead.interesse}.`;
    const whatsappUrl = `https://web.whatsapp.com/send?phone=55${phoneNumber}&text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');

    toast({
      title: "Abrindo WhatsApp",
      description: `Iniciando conversa com ${lead.nome}`,
    });
  };

  const handleEmail = (lead: any) => {
    setSelectedLead(lead);
    setIsEmailOpen(true);
  };

  const handleViewTimeline = (lead: any) => {
    setSelectedLead(lead);
    setIsTimelineOpen(true);
  };

  const handleViewJourneyMap = (lead: any) => {
    // Open in new tab
    const url = `/journey/${lead.id}`;
    window.open(url, '_blank');
  };

  const handleCreateTask = (lead: any) => {
    setSelectedLeadForTask(lead);
    setIsTaskDialogOpen(true);
  };

  const handleEditLead = (lead: any) => {
    setSelectedLead(lead);

    // Recuperar interesses a partir do ID principal e das tags
    const interessePrincipal = lead.empreendimento_id ? [lead.empreendimento_id] : [];

    // Procurar nas tags por "Interesse: Nome"
    const tagsInteresse = (lead.tags || [])
      .filter((t: string) => t.startsWith("Interesse: "))
      .map((t: string) => t.replace("Interesse: ", ""));

    const interessesDasTags = empreendimentos
      .filter(emp => tagsInteresse.includes(emp.nome))
      .map(emp => emp.id);

    // Combinar e remover duplicatas
    const todosInteresses = [...new Set([...interessePrincipal, ...interessesDasTags])];

    // Filtrar tags normais (sem ser de interesse) para o campo de tags
    // Filtrar tags normais (sem ser de interesse ou campos extras) para o campo de tags
    const tagsExtrasPrefixes = ["Interesse: ", "Renda: ", "Profissão: ", "Entrada: "];
    const tagsNormais = (lead.tags || []).filter((t: string) => !tagsExtrasPrefixes.some(prefix => t.startsWith(prefix)));

    // Extrair campos extras das tags
    const rendaTag = (lead.tags || []).find((t: string) => t.startsWith("Renda: "));
    const profissaoTag = (lead.tags || []).find((t: string) => t.startsWith("Profissão: "));
    const entradaTag = (lead.tags || []).find((t: string) => t.startsWith("Entrada: "));

    setEditLead({
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email,
      origem: lead.origem || "",
      interesse: todosInteresses,
      observacoes: lead.observacoes || "",
      tags: tagsNormais,
      renda: rendaTag ? rendaTag.replace("Renda: ", "") : "",
      profissao: profissaoTag ? profissaoTag.replace("Profissão: ", "") : "",
      possuiEntrada: entradaTag ? (entradaTag.includes("Sim") ? "sim" : "nao") : "",
      valorEntrada: entradaTag && entradaTag.includes("(") ? entradaTag.split("(")[1].replace(")", "") : "",
      status: lead.status || "Novo",
      tagsRaw: tagsNormais.join(', ')
    });
    setIsEditDialogOpen(true);
  };

  // Handle initialLeadId to auto-open edit dialog
  useEffect(() => {
    if (!initialLeadId) return;
    if (!leads || !Array.isArray(leads) || leads.length === 0) return;
    if (!empreendimentos || !Array.isArray(empreendimentos) || empreendimentos.length === 0) return;
    if (initialLeadId === lastProcessedLeadId.current) return;

    const lead = leads.find(l => l.id === initialLeadId);
    if (lead) {
      handleEditLead(lead);
      lastProcessedLeadId.current = initialLeadId;
    }
  }, [initialLeadId, leads, empreendimentos]);

  const handleDeleteLead = (lead: any) => {
    setSelectedLead(lead);
    setIsDeleteDialogOpen(true);
  };

  const handleRegisterContact = async (lead: any) => {
    try {
      const now = new Date().toISOString();

      // Atualizar Lead (ultimo_contato)
      const { error: leadError } = await supabase
        .from('leads')
        .update({ ultimo_contato: now })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // Adicionar Timeline
      const { error: timelineError } = await supabase
        .from('lead_timeline')
        .insert({
          lead_id: lead.id,
          type: 'contact',
          title: 'Contato Realizado',
          description: 'Contato registrado manualmente através da lista de leads.',
          author: 'Usuário'
        });

      if (timelineError) {
        // Se falhar timeline, não é critico, mas logar
        console.error("Erro ao salvar timeline:", timelineError);
      }

      toast({
        title: "Contato registrado",
        description: `Último contato atualizado para ${lead.nome}.`,
        variant: "default"
      });

      // Atualizar lista
      refreshLeads();

    } catch (error) {
      console.error('Error registering contact:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar contato.",
        variant: "destructive"
      });
    }
  };

  const confirmEdit = async () => {
    // Validação básica
    if (!editLead.nome || !editLead.telefone || !editLead.email) {
      toast({
        title: "Erro de validação",
        description: "Nome, telefone e email são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedLead) return;

    try {
      // Verificar se as observações foram alteradas
      const observacoesAlteradas = editLead.observacoes !== selectedLead.observacoes;

      console.log('=== DEBUGGING TIMELINE ===');
      console.log('Observações alteradas:', observacoesAlteradas);
      console.log('Observações antigas:', selectedLead.observacoes);
      console.log('Observações novas:', editLead.observacoes);
      console.log('Lead ID:', selectedLead.id);

      // Atualizar no banco de dados Supabase
      const { error } = await supabase
        .from('leads')
        .update({
          nome: editLead.nome,
          telefone: editLead.telefone,
          email: editLead.email,
          origem: editLead.origem || null,
          observacoes: editLead.observacoes || null,
          status: editLead.status || 'Novo',
          // Se tiver empreendimentos selecionados, salvar o primeiro como empreendimento_id
          empreendimento_id: editLead.interesse.length > 0 ? editLead.interesse[0] : null,
          // Salvar interesses como tags para persistir múltiplos
          tags: [
            ...editLead.tags,
            ...editLead.interesse.map(id => {
              const emp = empreendimentos.find(e => e.id === id);
              return emp ? `Interesse: ${emp.nome}` : null;
            }).filter(Boolean) as string[],
            // Campos extras como tags
            editLead.renda ? `Renda: ${editLead.renda}` : null,
            editLead.profissao ? `Profissão: ${editLead.profissao}` : null,
            editLead.possuiEntrada ? `Entrada: ${editLead.possuiEntrada === 'sim' ? (editLead.valorEntrada ? `Sim (${editLead.valorEntrada})` : 'Sim') : 'Não'}` : null
          ].filter(Boolean) as string[],
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedLead.id);

      if (error) {
        console.error('Erro ao atualizar lead:', JSON.stringify(error, null, 2));
        toast({
          title: "Erro ao atualizar lead",
          description: "Não foi possível salvar as alterações. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Sempre adicionar entrada na timeline quando há observações (seja nova ou atualizada)
      if (editLead.observacoes && editLead.observacoes.trim()) {
        console.log('Adicionando à timeline...');
        try {
          const { data: timelineData, error: timelineError } = await supabase
            .from('lead_timeline')
            .insert({
              lead_id: selectedLead.id,
              type: 'note',
              title: observacoesAlteradas ? 'Observações atualizadas' : 'Observações',
              description: editLead.observacoes.trim(),
              author: 'Usuário' // TODO: Pegar do contexto de autenticação
            })
            .select();

          if (timelineError) {
            console.error('Erro ao adicionar timeline:', timelineError);
            toast({
              title: "Aviso",
              description: "Lead atualizado, mas não foi possível adicionar à timeline.",
              variant: "default",
            });
          } else {
            console.log('Timeline adicionada com sucesso:', timelineData);
          }
        } catch (timelineError) {
          console.error('Erro inesperado ao adicionar timeline:', timelineError);
        }
      } else {
        console.log('Nenhuma observação para adicionar à timeline');
      }

      toast({
        title: "Lead atualizado com sucesso!",
        description: `As informações de ${editLead.nome} foram atualizadas.`,
      });

      setIsEditDialogOpen(false);

      // Recarregar a lista de leads para mostrar as alterações
      refreshLeads();

    } catch (error) {
      console.error('Erro inesperado ao atualizar lead:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedLead) return;

    try {
      // Deletar do banco de dados Supabase
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', selectedLead.id);

      if (error) {
        console.error('Erro ao excluir lead:', error);
        toast({
          title: "Erro ao excluir lead",
          description: "Não foi possível excluir o lead. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Atualizar a lista via contexto
      refreshLeads();

      toast({
        title: "Lead excluído com sucesso!",
        description: `${selectedLead.nome} foi removido da lista de leads.`,
      });
    } catch (error) {
      console.error('Erro inesperado ao excluir lead:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };



  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadsIds(prev =>
      prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]
    );
  };

  const handleSelectAllLeads = (checked: boolean) => {
    if (checked) {
      setSelectedLeadsIds(filteredLeads.map(l => l.id));
    } else {
      setSelectedLeadsIds([]);
    }
  };

  const confirmBulkDelete = async () => {
    try {
      if (selectedLeadsIds.length === 0) return;

      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', selectedLeadsIds);

      if (error) {
        throw error;
      }

      toast({
        title: "Leads excluídos",
        description: `${selectedLeadsIds.length} leads foram removidos com sucesso.`,
      });

      setSelectedLeadsIds([]);
      refreshLeads();
    } catch (error) {
      console.error('Erro ao excluir leads em massa:', error);
      toast({
        title: "Erro na exclusão",
        description: "Não foi possível excluir os leads selecionados.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (!isCsv && !isExcel) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo válido (.csv, .xlsx, .xls).",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Lendo arquivo...",
      description: `Processando arquivo: ${file.name}`,
    });

    try {
      const parseSuccess = (data: any[]) => {
        if (!data || data.length === 0) {
          toast({
            title: "Arquivo vazio",
            description: "Não foi possível encontrar dados no arquivo.",
            variant: "destructive",
          });
          return;
        }

        // Processar importação diretamente
        const listName = file.name.split('.')[0].replace(/[-_]/g, ' ');
        processImportData(data, listName);
      };

      if (isCsv) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            parseSuccess(results.data);
          },
          error: (error) => {
            console.error('Erro ao ler CSV:', error);
            toast({ title: "Erro ao ler arquivo", description: error.message, variant: "destructive" });
          }
        });
      } else if (isExcel) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = await findBestSheetData(workbook);
            parseSuccess(jsonData);
          } catch (error) {
            console.error('Erro ao processar Excel:', error);
            toast({
              title: "Erro na leitura",
              description: "Não foi possível ler o arquivo Excel.",
              variant: "destructive"
            });
          }
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('Erro geral na importação:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao processar o arquivo.",
        variant: "destructive",
      });
    }

    // Reset do input para permitir selecionar o mesmo arquivo novamente
    event.target.value = '';
  };

  const processImportData = async (data: any[], listName: string) => {
    if (!data || data.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        return;
      }

      // Lógica de Detecção Automática - TODOS OS CAMPOS
      const headers = Object.keys(data[0] || {});
      const normalize = (str: string) => (str || "").toLowerCase().trim();

      const findColumn = (keywords: string[]) => {
        const normalizedKeywords = keywords.map(k => normalize(k));
        return headers.find(h => normalizedKeywords.some(k => normalize(h).includes(k))) || "";
      };

      // Detectar todas as colunas possíveis
      const colNome = findColumn(["nome", "name", "cliente", "lead", "pessoa", "usuario", "consumidor"]);
      const colEmail = findColumn(["email", "e-mail", "mail", "eletronico", "correio"]);
      const colTelefone = findColumn(["telefone", "celular", "whatsapp", "phone", "tel", "cel", "contato", "mobile"]);
      const colOrigem = findColumn(["origem", "source", "fonte", "canal", "midia"]);
      const colRenda = findColumn(["renda", "salario", "income", "renda mensal", "rendimento"]);
      const colProfissao = findColumn(["profissao", "profissão", "ocupacao", "ocupação", "cargo", "profession"]);
      const colEntrada = findColumn(["entrada", "possui entrada", "tem entrada", "down payment", "sinal", "tem sinal"]);
      let colValorEntrada = findColumn([
        "valor entrada", "valor da entrada", "valor de entrada",
        "entrada valor", "valor", "vlr entrada", "vl entrada",
        "down payment value", "valor sinal", "quanto de entrada",
        "quanto entrada", "entrada quanto", "entrada $", "entrada r$",
        "valor do sinal", "vl sinal", "vlr sinal", "sinal valor",
        "entrada (r$)", "entrada (valor)", "entrada reais"
      ]);
      const colInteresse = findColumn(["interesse", "empreendimento", "projeto", "imovel", "imóvel", "property"]);
      const colObservacoes = findColumn(["observacoes", "observações", "obs", "notas", "notes", "comentarios", "comentários"]);
      const colTags = findColumn(["tags", "etiquetas", "labels", "categorias"]);

      // Debug: mostrar colunas detectadas
      console.log('📊 Colunas detectadas:', {
        Nome: colNome,
        Email: colEmail,
        Telefone: colTelefone,
        Origem: colOrigem,
        Renda: colRenda,
        Profissão: colProfissao,
        Entrada: colEntrada,
        'Valor Entrada': colValorEntrada,
        Interesse: colInteresse,
        Observações: colObservacoes,
        Tags: colTags
      });

      // Fallback: Se não encontrou coluna de valor entrada, mas encontrou coluna "entrada",
      // tentar usar a próxima coluna se ela parecer conter valores numéricos
      if (!colValorEntrada && colEntrada && data.length > 0) {
        const indexEntrada = headers.indexOf(colEntrada);
        if (indexEntrada >= 0 && indexEntrada < headers.length - 1) {
          const proximaColuna = headers[indexEntrada + 1];
          // Verificar se a próxima coluna tem valores que parecem numéricos
          const primeiroValor = data[0][proximaColuna];
          if (primeiroValor && /[\d]/.test(primeiroValor.toString())) {
            colValorEntrada = proximaColuna;
            console.log(`💡 Detectado automaticamente "${proximaColuna}" como coluna de Valor Entrada (próxima a "${colEntrada}")`);
          }
        }
      }



      if (!colNome && !colEmail && !colTelefone) {
        toast({
          title: "Colunas não identificadas",
          description: "Não foi possível identificar colunas de Nome, Email ou Telefone automaticamente.",
          variant: "destructive",
        });
        return;
      }

      const leadsToInsert = data.map(row => {
        const nome = colNome ? row[colNome] : "";
        const email = colEmail ? row[colEmail] : "";
        const telefoneRaw = colTelefone ? row[colTelefone] : "";
        const origem = colOrigem ? row[colOrigem] : listName;
        let renda = colRenda ? row[colRenda] : "";
        const profissao = colProfissao ? row[colProfissao] : "";
        let entrada = colEntrada ? row[colEntrada] : "";
        let valorEntrada = colValorEntrada ? row[colValorEntrada] : "";

        // Função para formatar valores monetários para padrão brasileiro
        const formatarValorMonetario = (valor: string): string => {
          if (!valor) return "";

          // Extrair apenas números do valor
          const apenasNumeros = valor.toString().replace(/[^\d]/g, '');
          if (!apenasNumeros) return valor; // Se não tem números, retorna original

          // Converter para número
          const numero = parseInt(apenasNumeros);

          // Formatar para padrão brasileiro
          return `R$ ${numero.toLocaleString('pt-BR')}`;
        };

        // Se a coluna "entrada" contém um valor monetário, extrair
        if (entrada && !valorEntrada) {
          const entradaStr = entrada.toString();
          // Verificar se tem valor monetário na mesma célula (ex: "Sim - R$ 50.000")
          const matchValor = entradaStr.match(/R?\$?\s*[\d.,]+/i);
          if (matchValor) {
            valorEntrada = matchValor[0];
          }
        }

        // Formatar renda para padrão brasileiro
        if (renda) {
          renda = formatarValorMonetario(renda);
        }

        // Formatar valor da entrada para padrão brasileiro
        if (valorEntrada) {
          valorEntrada = formatarValorMonetario(valorEntrada);
        }

        const interesse = colInteresse ? row[colInteresse] : "";
        const observacoes = colObservacoes ? row[colObservacoes] : "";
        const tagsRaw = colTags ? row[colTags] : "";

        if (!nome && !email && !telefoneRaw) return null;

        const finalNome = nome || (email ? email.split('@')[0] : (telefoneRaw || 'Lead Importado'));

        // Formatar telefone
        const cleanPhone = telefoneRaw ? String(telefoneRaw).replace(/\D/g, '') : '';
        const formattedPhone = cleanPhone ? (
          cleanPhone.length > 10 ? `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7, 11)}` :
            cleanPhone.length > 9 ? `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}` :
              cleanPhone
        ) : '';

        // Construir array de tags
        const tags = [`Importação: ${listName}`];

        // Matching inteligente de empreendimento
        let empreendimentoId = null;
        if (interesse) {
          const interesseNormalizado = interesse.toString().toLowerCase().trim();

          // Tentar encontrar empreendimento por matching parcial
          const empreendimentoEncontrado = empreendimentos.find(emp => {
            const nomeEmp = emp.nome.toLowerCase();

            // Match exato
            if (nomeEmp === interesseNormalizado) return true;

            // Match parcial - interesse contém parte do nome do empreendimento
            if (nomeEmp.includes(interesseNormalizado) || interesseNormalizado.includes(nomeEmp)) return true;

            // Match por palavras-chave (split por espaços e verifica se alguma palavra bate)
            const palavrasInteresse = interesseNormalizado.split(/\s+/);
            const palavrasEmp = nomeEmp.split(/\s+/);

            // Se alguma palavra do interesse (com mais de 3 caracteres) está no nome do empreendimento
            const temPalavraComum = palavrasInteresse.some(palavra =>
              palavra.length > 3 && palavrasEmp.some(palavraEmp =>
                palavraEmp.includes(palavra) || palavra.includes(palavraEmp)
              )
            );

            return temPalavraComum;
          });

          if (empreendimentoEncontrado) {
            empreendimentoId = empreendimentoEncontrado.id;
            // Adicionar tag com o nome completo do empreendimento encontrado
            tags.push(`Interesse: ${empreendimentoEncontrado.nome}`);
          } else {
            // Se não encontrou, adicionar como tag apenas
            tags.push(`Interesse: ${interesse}`);
          }
        }

        // Adicionar renda como tag se existir
        if (renda) {
          tags.push(`Renda: ${renda}`);
        }

        // Adicionar profissão como tag se existir
        if (profissao) {
          tags.push(`Profissão: ${profissao}`);
        }

        // Adicionar entrada como tag se existir
        if (entrada) {
          const entradaTexto = entrada.toString().toLowerCase();
          if (entradaTexto.includes('sim') || entradaTexto.includes('yes') || entradaTexto === '1') {
            if (valorEntrada) {
              tags.push(`Entrada: Sim (${valorEntrada})`);
            } else {
              tags.push(`Entrada: Sim`);
            }
          } else if (entradaTexto.includes('nao') || entradaTexto.includes('não') || entradaTexto.includes('no') || entradaTexto === '0') {
            tags.push(`Entrada: Não`);
          }
        }

        // Adicionar tags personalizadas da planilha
        if (tagsRaw) {
          const customTags = tagsRaw.toString().split(',').map((t: string) => t.trim()).filter(Boolean);
          tags.push(...customTags);
        }

        return {
          nome: finalNome,
          email: email || '',
          telefone: formattedPhone,
          origem: origem || listName,
          status: 'novo',
          user_id: user.id,
          empreendimento_id: empreendimentoId, // Vincula ao empreendimento se encontrado
          observacoes: observacoes || '',
          tags: tags
        };
      }).filter(Boolean);

      if (leadsToInsert.length === 0) {
        toast({ title: "Aviso", description: "Nenhum lead válido encontrado.", variant: "warning" });
        return;
      }

      // Inserir em lotes
      const batchSize = 50;
      let successCount = 0;
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('leads').insert(batch);
        if (!error) successCount += batch.length;
      }

      toast({
        title: "Importação concluída",
        description: `${successCount} leads importados para a lista "${listName}".`,
      });


      refreshLeads();

    } catch (error) {
      console.error("Erro na importação:", error);
      toast({ title: "Erro", description: "Falha ao processar importação.", variant: "destructive" });
    }
  };



  const handleExportCSV = () => {
    // Cabeçalhos do CSV com formatação
    const headers = ['Nome', 'Telefone', 'Email', 'Projeto', 'Renda', 'Profissão', 'Entrada', 'Observações'];

    // Calcular largura máxima para cada coluna
    const maxWidths = headers.map((header, index) => {
      const columnData = filteredLeads.map(lead => {
        const tags = lead.tags || [];
        const renda = tags.find((t: string) => t.startsWith("Renda: "))?.replace("Renda: ", "") || '';
        const profissao = tags.find((t: string) => t.startsWith("Profissão: "))?.replace("Profissão: ", "") || '';
        const entrada = tags.find((t: string) => t.startsWith("Entrada: "))?.replace("Entrada: ", "") || '';

        switch (index) {
          case 0: return lead.nome || '';
          case 1: return lead.telefone || '';
          case 2: return lead.email || '';
          case 3: return lead.empreendimento?.nome || 'N/A';
          case 4: return renda;
          case 5: return profissao;
          case 6: return entrada;
          case 7: return lead.observacoes || '';
          default: return '';
        }
      });

      const maxDataLength = Math.max(...columnData.map(data => data.length));
      return Math.max(header.length, maxDataLength, 10);
    });

    // Função para formatar linha com espaçamento
    const formatRow = (row: string[]) => {
      return row.map((cell, index) => {
        const cellStr = String(cell || '').slice(0, maxWidths[index]);
        return cellStr.padEnd(maxWidths[index]);
      }).join(' | ');
    };

    // Criar separador
    const separator = maxWidths.map(width => '-'.repeat(width)).join('-+-');

    // Formatar dados
    const formattedHeaders = formatRow(headers);
    const formattedData = filteredLeads.map(lead => {
      const tags = lead.tags || [];
      const renda = tags.find((t: string) => t.startsWith("Renda: "))?.replace("Renda: ", "") || '';
      const profissao = tags.find((t: string) => t.startsWith("Profissão: "))?.replace("Profissão: ", "") || '';
      const entrada = tags.find((t: string) => t.startsWith("Entrada: "))?.replace("Entrada: ", "") || '';

      return formatRow([
        lead.nome || '',
        lead.telefone || '',
        lead.email || '',
        lead.empreendimento?.nome || 'N/A',
        renda,
        profissao,
        entrada,
        lead.observacoes || ''
      ]);
    });

    // Combinar tudo
    const csvContent = [
      formattedHeaders,
      separator,
      ...formattedData
    ].join('\n');

    // Criar e baixar o arquivo
    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `leads_formatado_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída!",
      description: `${filteredLeads.length} leads foram exportados formatados por coluna.`,
    });
  };



  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:gap-4 lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" className="shadow-elegant w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={newLead.nome}
                    onChange={(e) => setNewLead({ ...newLead, nome: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={newLead.telefone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setNewLead({ ...newLead, telefone: formatted });
                    }}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="seuemail@inmovya.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="origem">Origem</Label>
                  <Input
                    id="origem"
                    value={newLead.origem}
                    onChange={(e) => setNewLead({ ...newLead, origem: e.target.value })}
                    placeholder="Ex: Facebook, Indicação, Google..."
                  />
                </div>

                {/* Novos Campos Opcionais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="renda">Renda Mensal (Opcional)</Label>
                    <Input
                      id="renda"
                      value={newLead.renda}
                      onChange={(e) => {
                        const formatted = formatCurrency(e.target.value);
                        setNewLead({ ...newLead, renda: formatted });
                      }}
                      placeholder="Ex: R$ 5.000,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profissao">Profissão (Opcional)</Label>
                    <Input
                      id="profissao"
                      value={newLead.profissao}
                      onChange={(e) => setNewLead({ ...newLead, profissao: e.target.value })}
                      placeholder="Ex: Médico"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Etapa do Funil</Label>
                  <Select value={newLead.status} onValueChange={(value) => setNewLead({ ...newLead, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa do funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {funnelStages.map(stage => (
                        <SelectItem key={`new-${stage.id}`} value={stage.name}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entrada">Possui Entrada? (Opcional)</Label>
                  <div className="flex gap-2">
                    <Select value={newLead.possuiEntrada} onValueChange={(value) => setNewLead({ ...newLead, possuiEntrada: value })}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>

                    {newLead.possuiEntrada === 'sim' && (
                      <Input
                        placeholder="Valor (R$)"
                        value={newLead.valorEntrada}
                        onChange={(e) => {
                          const formatted = formatCurrency(e.target.value);
                          setNewLead({ ...newLead, valorEntrada: formatted });
                        }}
                        className="flex-1"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interesse">Empreendimentos de Interesse</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {empreendimentos.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum empreendimento cadastrado</div>
                    ) : (
                      empreendimentos.map((empreendimento) => (
                        <div key={empreendimento.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`interesse-${empreendimento.id}`}
                            checked={newLead.interesse.includes(empreendimento.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewLead({
                                  ...newLead,
                                  interesse: [...newLead.interesse, empreendimento.id]
                                });
                              } else {
                                setNewLead({
                                  ...newLead,
                                  interesse: newLead.interesse.filter(id => id !== empreendimento.id)
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`interesse-${empreendimento.id}`}
                            className="text-sm font-normal cursor-pointer flex items-center gap-2"
                          >
                            {empreendimento.nome}
                            <Badge variant="outline" className="text-xs">
                              {empreendimento.status}
                            </Badge>
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  {newLead.interesse.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {newLead.interesse.length} empreendimento(s) selecionado(s)
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={newLead.observacoes}
                    onChange={(e) => setNewLead({ ...newLead, observacoes: e.target.value })}
                    placeholder="Observações adicionais..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags/Etiquetas</Label>
                  <Input
                    id="tags"
                    value={newLead.tagsRaw !== undefined ? newLead.tagsRaw : newLead.tags.join(', ')}
                    onChange={(e) => {
                      const val = e.target.value;
                      const tagsArray = val.split(',').map(tag => tag.trim()).filter(tag => tag);
                      setNewLead({ ...newLead, tags: tagsArray, tagsRaw: val });
                    }}
                    placeholder="Digite as tags separadas por vírgula"
                  />
                  <div className="text-xs text-muted-foreground">
                    Separe múltiplas tags com vírgula. Ex: vip, interessado, follow-up
                  </div>
                  {newLead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newLead.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateLead} className="flex-1">
                    Criar Lead
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-1 col-span-2 sm:col-span-1 w-full sm:w-auto">
              <Button variant="success" onClick={handleImportCSV} className="flex-1 sm:flex-initial sm:w-auto">
                <Upload className="w-4 h-4 mr-2" />
                <span className="inline">Importar CSV</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsImportHelpOpen(true)} title="Ajuda sobre Importação">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Bulk Actions */}
            {selectedLeadsIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                className="col-span-2 sm:col-span-1 w-full sm:w-auto animate-in fade-in"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir ({selectedLeadsIds.length})
              </Button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={handleExportCSV} className="col-span-2 sm:col-span-1 w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              <span className="inline">Exportar</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full lg:w-80"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setIsFiltersOpen(true)}
            className="relative w-full sm:w-auto"
          >
            <Filter className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Filtros</span>
            <span className="sm:hidden">Filtrar</span>
            {getActiveFiltersCount() > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 text-xs flex items-center justify-center"
              >
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-3 lg:p-4">
            <div className="text-xl lg:text-2xl font-bold text-primary">
              {loading ? "..." : statsReais.total.toLocaleString()}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">Total de Leads</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 lg:p-4">
            <div className="text-xl lg:text-2xl font-bold text-accent">
              {loading ? "..." : statsReais.novosHoje.toLocaleString()}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">Novos Hoje</div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Gerenciamento de Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Cards View */}
          <div className="block lg:hidden">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">
                Carregando leads...
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                Nenhum lead encontrado
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className="shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox
                            checked={selectedLeadsIds.includes(lead.id)}
                            onCheckedChange={() => handleToggleSelectLead(lead.id)}
                            className="mt-1 h-4 w-4 min-w-[16px] min-h-[16px] shrink-0 rounded-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-foreground truncate">{lead.nome}</h4>
                            <Badge className={`${getStatusColor(lead.status)} text-xs mt-1`}>
                              {lead.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewJourneyMap(lead)}
                            title="Mapa da Jornada"
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50"
                          >
                            <Network className="w-4 h-4" strokeWidth={2.5} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTimeline(lead)}
                            title="Ver Timeline"
                            className="bg-primary/5 hover:bg-primary/10 text-primary"
                          >
                            <Clock className="w-3 h-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50">
                              <DropdownMenuItem onClick={() => handleWhatsApp(lead)}>
                                <MessageCircle className="w-4 h-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEmail(lead)}>
                                <Mail className="w-4 h-4 mr-2" />
                                Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditLead(lead)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteLead(lead)} className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Tel:</span> {lead.telefone || 'N/A'}
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Email:</span> {lead.email || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Origem:</span> {lead.origem || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Cadastro:</span> {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <span className="font-medium">Projetos:</span>{' '}
                          {(() => {
                            const primary = lead.empreendimento?.nome;
                            const tagInterests = (lead.tags || [])
                              .filter((t: string) => t.startsWith("Interesse: "))
                              .map((t: string) => t.replace("Interesse: ", ""));
                            const allInterests = Array.from(new Set([primary, ...tagInterests].filter(Boolean)));

                            return allInterests.length > 0 ? allInterests.join(', ') : 'N/A';
                          })()}
                        </div>
                      </div>
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {lead.tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 w-[40px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        className="h-4 w-4 min-w-[16px] min-h-[16px] rounded-sm"
                        style={{ width: '16px', height: '16px' }}
                        checked={filteredLeads.length > 0 && selectedLeadsIds.length === filteredLeads.length}
                        onCheckedChange={(checked) => handleSelectAllLeads(checked as boolean)}
                      />
                    </div>
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Contato</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Origem</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Tags</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Interesse</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Cadastro</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      Carregando leads...
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      Nenhum lead encontrado
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            className="h-4 w-4 min-w-[16px] min-h-[16px] rounded-sm"
                            style={{ width: '16px', height: '16px' }}
                            checked={selectedLeadsIds.includes(lead.id)}
                            onCheckedChange={() => handleToggleSelectLead(lead.id)}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{lead.nome}</div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="text-sm text-foreground">{lead.telefone || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[150px]">{lead.email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{lead.origem || 'N/A'}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={`${getStatusColor(lead.status)} text-xs`}>
                          {lead.status}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {lead.tags && lead.tags.length > 0 ? (
                            lead.tags.slice(0, 2).map((tag: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          {lead.tags && lead.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{lead.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 max-w-[180px]">
                          {(() => {
                            const primary = lead.empreendimento?.nome;
                            const tagInterests = (lead.tags || [])
                              .filter((t: string) => t.startsWith("Interesse: "))
                              .map((t: string) => t.replace("Interesse: ", ""));
                            const allInterests = Array.from(new Set([primary, ...tagInterests].filter(Boolean)));

                            if (allInterests.length === 0) return <span className="text-sm text-foreground">N/A</span>;

                            return allInterests.map((interest, idx) => (
                              <div key={idx} className="text-sm text-foreground truncate" title={interest as string}>
                                {interest}
                              </div>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewJourneyMap(lead)}
                            title="Mapa da Jornada"
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50"
                          >
                            <Network className="w-4 h-4" strokeWidth={2.5} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegisterContact(lead)}
                            title="Registrar Contato"
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200/50"
                          >
                            <PhoneOutgoing className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateTask(lead)}
                            title="Criar Lembrete"
                            className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTimeline(lead)}
                            title="Ver Timeline"
                            className="bg-primary/5 hover:bg-primary/10 text-primary"
                          >
                            <Clock className="w-4 h-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50">
                              <DropdownMenuItem onClick={() => handleEmail(lead)}>
                                <Mail className="w-4 h-4 mr-2" />
                                Enviar Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleWhatsApp(lead)}>
                                <MessageCircle className="w-4 h-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditLead(lead)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteLead(lead)} className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Dialog */}
      <LeadTimeline
        leadId={selectedLead?.id}
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
      />

      {/* Email Composer Dialog */}
      <EmailComposer
        lead={selectedLead}
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
      />

      {/* Filters Dialog */}
      <LeadFilters
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApplyFilters={applyFilters}
        activeFilters={activeFilters}
        empreendimentos={empreendimentos}
        availableTags={getAvailableTags()}
        availableOrigins={Array.from(new Set(leads.map(l => l.origem).filter(Boolean))) as string[]}
      />

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome *</Label>
              <Input
                id="edit-nome"
                value={editLead.nome}
                onChange={(e) => setEditLead({ ...editLead, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-telefone">Telefone *</Label>
              <Input
                id="edit-telefone"
                value={editLead.telefone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setEditLead({ ...editLead, telefone: formatted });
                }}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editLead.email}
                onChange={(e) => setEditLead({ ...editLead, email: e.target.value })}
                placeholder="seuemail@inmovya.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-origem">Origem</Label>
              <Input
                id="edit-origem"
                value={editLead.origem}
                onChange={(e) => setEditLead({ ...editLead, origem: e.target.value })}
                placeholder="Ex: Facebook, Indicação, Google..."
              />
            </div>

            {/* Novos Campos Opcionais - Edição */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-renda">Renda Mensal (Opcional)</Label>
                <Input
                  id="edit-renda"
                  value={editLead.renda}
                  onChange={(e) => {
                    const formatted = formatCurrency(e.target.value);
                    setEditLead({ ...editLead, renda: formatted });
                  }}
                  placeholder="Ex: R$ 5.000,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-profissao">Profissão (Opcional)</Label>
                <Input
                  id="edit-profissao"
                  value={editLead.profissao}
                  onChange={(e) => setEditLead({ ...editLead, profissao: e.target.value })}
                  placeholder="Ex: Médico"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Etapa do Funil</Label>
              <Select value={editLead.status} onValueChange={(value) => setEditLead({ ...editLead, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {funnelStages.map(stage => (
                    <SelectItem key={`edit-${stage.id}`} value={stage.name}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-entrada">Possui Entrada? (Opcional)</Label>
              <div className="flex gap-2">
                <Select value={editLead.possuiEntrada} onValueChange={(value) => setEditLead({ ...editLead, possuiEntrada: value })}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>

                {editLead.possuiEntrada === 'sim' && (
                  <Input
                    placeholder="Valor (R$)"
                    value={editLead.valorEntrada}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setEditLead({ ...editLead, valorEntrada: formatted });
                    }}
                    className="flex-1"
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-interesse">Empreendimentos de Interesse</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {empreendimentos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum empreendimento cadastrado</div>
                ) : (
                  empreendimentos.map((empreendimento) => (
                    <div key={empreendimento.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-interesse-${empreendimento.id}`}
                        className="h-4 w-4 min-w-[16px] min-h-[16px] rounded-sm shrink-0"
                        style={{ width: '16px', height: '16px' }}
                        checked={editLead.interesse.includes(empreendimento.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditLead({
                              ...editLead,
                              interesse: [...editLead.interesse, empreendimento.id]
                            });
                          } else {
                            setEditLead({
                              ...editLead,
                              interesse: editLead.interesse.filter(id => id !== empreendimento.id)
                            });
                          }
                        }}
                      />
                      <Label
                        htmlFor={`edit-interesse-${empreendimento.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        {empreendimento.nome}
                        <Badge variant="outline" className="text-xs">
                          {empreendimento.status}
                        </Badge>
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {editLead.interesse.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {editLead.interesse.length} empreendimento(s) selecionado(s)
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-observacoes">Observações</Label>
              <Textarea
                id="edit-observacoes"
                value={editLead.observacoes}
                onChange={(e) => setEditLead({ ...editLead, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags/Etiquetas</Label>
              <Input
                id="edit-tags"
                value={editLead.tagsRaw !== undefined ? editLead.tagsRaw : editLead.tags.join(', ')}
                onChange={(e) => {
                  const val = e.target.value;
                  const tagsArray = val.split(',').map(tag => tag.trim()).filter(tag => tag);
                  setEditLead({ ...editLead, tags: tagsArray, tagsRaw: val });
                }}
                placeholder="Digite as tags separadas por vírgula"
              />
              <div className="text-xs text-muted-foreground">
                Separe múltiplas tags com vírgula. Ex: vip, interessado, follow-up
              </div>
              {editLead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {editLead.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={confirmEdit} className="flex-1">
                Salvar Alterações
              </Button>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>

            {/* Ações Rápidas */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                Ações Rápidas
              </Label>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200"
                  onClick={() => handleWhatsApp(selectedLead)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200"
                  onClick={() => handleEmail(selectedLead)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>

              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{selectedLead?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão em Massa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedLeadsIds.length}</strong> leads selecionados?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBulkDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir Selecionados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mapa da Jornada do Lead */}
      <LeadJourneyMap
        leadId={selectedLead?.id}
        isOpen={isJourneyMapOpen}
        onClose={() => setIsJourneyMapOpen(false)}
      />





      {/* Task Dialog */}
      {selectedLeadForTask && (
        <TaskDialog
          isOpen={isTaskDialogOpen}
          onClose={() => setIsTaskDialogOpen(false)}
          lead={selectedLeadForTask}
        />
      )}

      {/* Import Help Dialog */}
      <Dialog open={isImportHelpOpen} onOpenChange={setIsImportHelpOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Instruções de Importação</DialogTitle>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/30">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <span className="text-xl">📢</span> Formatação da Planilha
            </h5>
            <p className="mb-3">Sua planilha pode conter as seguintes colunas (o sistema detecta automaticamente):</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-3">
              <ul className="list-disc list-inside space-y-1 text-xs font-medium opacity-90">
                <li><strong>Nome</strong> * (obrigatório)</li>
                <li><strong>Telefone/Celular</strong> *</li>
                <li><strong>Email</strong></li>
                <li><strong>Origem</strong></li>
                <li><strong>Renda/Renda Mensal</strong></li>
                <li><strong>Profissão</strong></li>
              </ul>
              <ul className="list-disc list-inside space-y-1 text-xs font-medium opacity-90">
                <li><strong>Entrada</strong> (Sim/Não)</li>
                <li><strong>Valor Entrada</strong></li>
                <li><strong>Interesse/Empreendimento</strong></li>
                <li><strong>Observações</strong></li>
                <li><strong>Tags</strong> (separadas por vírgula)</li>
              </ul>
            </div>
            <div className="space-y-2 text-xs opacity-80 border-t border-amber-200/50 pt-3">
              <p><strong>* Requisito:</strong> Pelo menos Nome OU Telefone deve estar preenchido.</p>
              <p>💡 <strong>Entrada:</strong> Pode ser "Sim/Não" em uma coluna e o valor (ex: 50000) em outra coluna "Valor Entrada", ou tudo junto na mesma coluna (ex: "Sim - R$ 50.000"). O sistema detecta automaticamente colunas adjacentes.</p>
              <p>💰 <strong>Valores:</strong> Renda e Valor Entrada são formatados automaticamente para R$ XX.XXX (ex: 50000 vira R$ 50.000,00).</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsImportHelpOpen(false)}>Entendi</Button>
          </div>
        </DialogContent>
      </Dialog>


    </div >
  );
}



