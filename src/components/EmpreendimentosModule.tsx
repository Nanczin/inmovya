import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Search,
  Filter,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  Eye,
  Edit,
  MoreHorizontal,
  Image,
  Star,
  Home,
  Users,
  Car,
  Wifi,
  Shield,
  Utensils,
  Dumbbell,
  Trees,
  Camera,
  FileText,
  Trash2
} from "lucide-react";

// Utilitários para converter datas de "MMM/YYYY" <-> "YYYY-MM-01"
const PT_BR_MESES: Record<string, string> = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12'
};

function parseMesAnoToDate(input?: string | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  // Já está no formato de data?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;

  // Tenta converter formato MMM/YYYY para data
  const m = raw.toLowerCase().match(/^([a-zç]{3})\/(\d{4})$/);
  if (m) {
    const mesAbbr = m[1].toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '');
    const ano = m[2];
    const mm = PT_BR_MESES[mesAbbr as keyof typeof PT_BR_MESES];
    if (mm) return `${ano}-${mm}-01`;
  }

  // Se não conseguir converter, retorna null (será salvo como texto no campo data_lancamento)
  // Nota: Como o campo é do tipo date no banco, textos livres causarão erro
  // Vamos retornar null para que o campo fique nulo no banco e salvar o texto original em outro lugar
  return null;
}

function formatDateToMesAno(dateInput?: string | null): string {
  if (!dateInput) return '';
  const raw = ('' + dateInput).split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  const ano = m[1];
  const mes = parseInt(m[2], 10);
  const abbrs = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const abbr = abbrs[mes - 1] || '';
  return abbr ? `${abbr}/${ano}` : '';
}


export function EmpreendimentosModule() {
  const { toast } = useToast();

  // Função para formatar valores em moeda brasileira
  const formatCurrency = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    if (!numbers) return '';

    // Converte para número e formata
    const amount = parseInt(numbers) / 100;

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Função para exibir valores monetários de forma correta (display)
  const formatMoney = (value: number | null | undefined) => {
    if (!value && value !== 0) return 'Preço sob consulta';

    // Tratamento para 0, se quisermos mostrar "Sob Consulta" ao invés de R$ 0,00
    if (value === 0) return 'Preço sob consulta';

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const parseCurrencyToNumber = (value: string | undefined | null): number | null => {
    if (!value) return null;
    // Remove dots (thousand separators), replace comma with dot, then remove non-numeric chars except dot
    const cleanString = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const num = parseFloat(cleanString);
    return isNaN(num) ? null : num;
  };

  // Função para formatar área em m²
  const formatArea = (value: string): string => {
    // Remove tudo que não é número ou vírgula/ponto
    const numbers = value.replace(/[^\d.,]/g, '');

    if (!numbers) return '';

    // Adiciona " m²" ao final
    return `${numbers} m²`;
  };


  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string[]>([]);
  const [filtroTipologia, setFiltroTipologia] = useState<string[]>([]);
  const [filtroConstrutora, setFiltroConstrutora] = useState<string[]>([]);
  const [filtroTags, setFiltroTags] = useState<string[]>([]);
  const [isNewEmpreendimentoDialogOpen, setIsNewEmpreendimentoDialogOpen] = useState(false);
  const [isEditEmpreendimentoDialogOpen, setIsEditEmpreendimentoDialogOpen] = useState(false);
  const [isViewEmpreendimentoDialogOpen, setIsViewEmpreendimentoDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<any>(null);
  const [newEmpreendimentoData, setNewEmpreendimentoData] = useState({
    nome: "",
    localizacao: "",
    precoInicial: "",
    tipologia: "",
    status: "",
    unidades: "",
    construtora: "",
    entrega: "",
    descricao: "",
    cidade: "",
    estado: "",
    cep: "",
    bairro: ""
  });
  const [editEmpreendimentoData, setEditEmpreendimentoData] = useState({
    nome: "",
    localizacao: "",
    precoInicial: "",
    precoFinal: "",
    tipologia: "",
    status: "",
    unidades: "",
    vendidas: "",
    construtora: "",
    entrega: "",
    descricao: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    dormitorios: "",
    banheiros: "",
    vagas: "",
    areaPrivativa: "",
    areaComum: "",
    financiamento: [],
    comodidades: [],
    diferenciais: [],
    precosPorTipologia: [],
    imagens: [],
    documentos: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Estados para dados reais
  const [empreendimentos, setEmpreendimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Função para carregar empreendimentos do Supabase
  const carregarEmpreendimentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('empreendimentos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar empreendimentos:', error);
        return;
      }

      setEmpreendimentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar empreendimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados ao inicializar
  useEffect(() => {
    carregarEmpreendimentos();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pré-lançamento": return "bg-primary text-primary-foreground";
      case "Lançamento": return "bg-accent text-accent-foreground";
      case "Vendas": return "bg-success text-success-foreground";
      case "Planejamento": return "bg-warning text-warning-foreground";
      case "Entregue": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredEmpreendimentos = empreendimentos.filter(emp => {
    const matchesSearch = emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.endereco && emp.endereco.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filtroStatus.length === 0 || filtroStatus.includes(emp.status);
    const matchesTipologia = filtroTipologia.length === 0 || filtroTipologia.some(tipo =>
      emp.descricao && emp.descricao.toLowerCase().includes(tipo.toLowerCase())
    );
    const matchesConstrutora = filtroConstrutora.length === 0 || filtroConstrutora.includes(emp.construtora);

    const matchesTags = filtroTags.length === 0 || (emp.tags && Array.isArray(emp.tags) && filtroTags.some(tag => emp.tags.includes(tag)));

    return matchesSearch && matchesStatus && matchesTipologia && matchesConstrutora && matchesTags;
  });

  const clearFilters = () => {
    setFiltroStatus([]);
    setFiltroTipologia([]);
    setFiltroConstrutora([]);
    setFiltroTags([]);
  };

  const activeFiltersCount = filtroStatus.length + filtroTipologia.length + filtroConstrutora.length + filtroTags.length;

  // Funções para manejar seleção múltipla
  const toggleStatusFilter = (status: string) => {
    setFiltroStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleTipologiaFilter = (tipologia: string) => {
    setFiltroTipologia(prev =>
      prev.includes(tipologia)
        ? prev.filter(t => t !== tipologia)
        : [...prev, tipologia]
    );
  };

  const toggleConstrutoreFilter = (construtora: string) => {
    setFiltroConstrutora(prev =>
      prev.includes(construtora)
        ? prev.filter(c => c !== construtora)
        : [...prev, construtora]
    );
  };

  const toggleTagFilter = (tag: string) => {
    setFiltroTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Listas dinâmicas de filtros baseadas nos dados reais
  const availableStatus = useMemo(() => {
    const statusSet = new Set<string>();
    empreendimentos.forEach(emp => {
      if (emp.status) statusSet.add(emp.status);
    });
    return Array.from(statusSet).sort();
  }, [empreendimentos]);

  const availableTipologias = useMemo(() => {
    const tipologiaSet = new Set<string>();
    empreendimentos.forEach(emp => {
      if (emp.tipologia) tipologiaSet.add(emp.tipologia);
    });
    return Array.from(tipologiaSet).sort();
  }, [empreendimentos]);

  const availableConstrutoras = useMemo(() => {
    const construtoraSet = new Set<string>();
    empreendimentos.forEach(emp => {
      if (emp.construtora) construtoraSet.add(emp.construtora);
    });
    return Array.from(construtoraSet).sort();
  }, [empreendimentos]);

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    empreendimentos.forEach(emp => {
      if (emp.tags && Array.isArray(emp.tags)) {
        emp.tags.forEach((tag: string) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [empreendimentos]);

  const handleImportData = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validExtensions = ['.csv', '.xlsx', '.json'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV, XLSX ou JSON válido.",
        variant: "destructive",
      });
      return;
    }

    // Simular processamento do arquivo
    toast({
      title: "Importando dados...",
      description: `Processando arquivo: ${file.name}`,
    });

    // Simular delay de processamento
    setTimeout(() => {
      const randomEmpreendimentos = Math.floor(Math.random() * 10) + 5;
      toast({
        title: "Importação concluída!",
        description: `${randomEmpreendimentos} empreendimentos foram importados com sucesso.`,
      });
    }, 2500);

    // Reset do input
    event.target.value = '';
  };

  const handleMoreOptions = (empreendimento: any) => {
    // Implementar menu dropdown com opções adicionais
    toast({
      title: "Mais opções",
      description: `Menu de ações para ${empreendimento.nome}`,
    });
  };

  const handleEditEmpreendimento = (empreendimento: any) => {
    console.log('Editando empreendimento:', empreendimento);

    setSelectedEmpreendimento(empreendimento);

    // Normalizar a lista de características/preços
    // Garante que 'nome' e 'tipologia' estejam sincronizados para compatibilidade entre abas
    const rawList = empreendimento.precos_por_tipologia || [];
    const normalizedList = rawList.map((item: any) => ({
      ...item,
      nome: item.nome || item.tipologia || "",
      tipologia: item.tipologia || item.nome || ""
    }));

    setEditEmpreendimentoData({
      nome: empreendimento.nome || "",
      localizacao: empreendimento.endereco || empreendimento.localizacao || "",
      precoInicial: empreendimento.valor_inicial ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(empreendimento.valor_inicial) : "",
      precoFinal: empreendimento.valor_final ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(empreendimento.valor_final) : "",
      tipologia: empreendimento.tipologia || "",
      status: empreendimento.status || "",
      unidades: empreendimento.unidades?.toString() || "",
      vendidas: empreendimento.vendidas?.toString() || "",
      construtora: empreendimento.construtora || "",
      entrega: empreendimento.data_lancamento ? formatDateToMesAno(empreendimento.data_lancamento) : (empreendimento.entrega || ""),
      descricao: empreendimento.descricao || "",
      endereco: empreendimento.endereco || "",
      bairro: empreendimento.bairro || "",
      cidade: empreendimento.cidade || "",
      estado: empreendimento.estado || "",
      cep: empreendimento.cep || "",
      dormitorios: empreendimento.dormitorios || "",
      banheiros: empreendimento.banheiros || "",
      vagas: empreendimento.vagas || "",
      areaPrivativa: empreendimento.areaPrivativa || "",
      areaComum: empreendimento.areaComum || "",
      financiamento: empreendimento.financiamento || [],
      comodidades: empreendimento.comodidades || [],
      diferenciais: empreendimento.diferenciais || [],
      // Usar a lista normalizada para ambos os campos para manter consistência inicial
      precosPorTipologia: normalizedList,
      caracteristicas: normalizedList,
      tags: empreendimento.tags || [],
      imagens: empreendimento.imagens || [],
      documentos: empreendimento.documentos || []
    });
    setIsEditEmpreendimentoDialogOpen(true);
  };

  const addComodidade = () => {
    setEditEmpreendimentoData({
      ...editEmpreendimentoData,
      comodidades: [...editEmpreendimentoData.comodidades, ""]
    });
  };

  const removeComodidade = (index: number) => {
    const updated = editEmpreendimentoData.comodidades.filter((_, i) => i !== index);
    setEditEmpreendimentoData({ ...editEmpreendimentoData, comodidades: updated });
  };

  const updateComodidade = (index: number, value: string) => {
    const updated = editEmpreendimentoData.comodidades.map((item, i) =>
      i === index ? value : item
    );
    setEditEmpreendimentoData({ ...editEmpreendimentoData, comodidades: updated });
  };

  const addDiferencial = () => {
    setEditEmpreendimentoData({
      ...editEmpreendimentoData,
      diferenciais: [...editEmpreendimentoData.diferenciais, ""]
    });
  };

  const removeDiferencial = (index: number) => {
    const updated = editEmpreendimentoData.diferenciais.filter((_, i) => i !== index);
    setEditEmpreendimentoData({ ...editEmpreendimentoData, diferenciais: updated });
  };

  const updateDiferencial = (index: number, value: string) => {
    const updated = editEmpreendimentoData.diferenciais.map((item, i) =>
      i === index ? value : item
    );
    setEditEmpreendimentoData({ ...editEmpreendimentoData, diferenciais: updated });
  };

  const addFinanciamento = () => {
    setEditEmpreendimentoData({
      ...editEmpreendimentoData,
      financiamento: [...editEmpreendimentoData.financiamento, ""]
    });
  };

  const removeFinanciamento = (index: number) => {
    const updated = editEmpreendimentoData.financiamento.filter((_, i) => i !== index);
    setEditEmpreendimentoData({ ...editEmpreendimentoData, financiamento: updated });
  };

  const updateFinanciamento = (index: number, value: string) => {
    const updated = editEmpreendimentoData.financiamento.map((item, i) =>
      i === index ? value : item
    );
    setEditEmpreendimentoData({ ...editEmpreendimentoData, financiamento: updated });
  };

  // Funções unificadas para editar características/preços
  const addPrecoTipologia = () => {
    const novasCaracteristicas = editEmpreendimentoData.caracteristicas || [];
    setEditEmpreendimentoData({
      ...editEmpreendimentoData,
      caracteristicas: [
        ...novasCaracteristicas,
        { tipologia: "", nome: "", preco: "" } // Inicializa ambos nome e tipologia
      ]
    });
  };

  const removePrecoTipologia = (index: number) => {
    const updated = (editEmpreendimentoData.caracteristicas || []).filter((_, i) => i !== index);
    setEditEmpreendimentoData({ ...editEmpreendimentoData, caracteristicas: updated });
  };

  const updatePrecoTipologia = (index: number, field: string, value: string) => {
    const updated = (editEmpreendimentoData.caracteristicas || []).map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: value };
        // Sincronizar tipologia e nome
        if (field === 'tipologia') {
          newItem.nome = value;
        }
        return newItem;
      }
      return item;
    });
    setEditEmpreendimentoData({ ...editEmpreendimentoData, caracteristicas: updated });
  };

  // Funções para gerenciar plantas individuais (agora unificadas com preços)
  const addPlanta = () => {
    const novasCaracteristicas = editEmpreendimentoData.caracteristicas || [];
    setEditEmpreendimentoData({
      ...editEmpreendimentoData,
      caracteristicas: [
        ...novasCaracteristicas,
        {
          nome: "",
          tipologia: "", // Sync
          dormitorios: "",
          banheiros: "",
          vagas: "",
          areaPrivativa: "",
          areaTotal: ""
        }
      ]
    });
  };

  const removePlanta = (index: number) => {
    const updated = (editEmpreendimentoData.caracteristicas || []).filter((_, i) => i !== index);
    setEditEmpreendimentoData({ ...editEmpreendimentoData, caracteristicas: updated });
  };

  const updatePlanta = (index: number, field: string, value: string) => {
    const updated = (editEmpreendimentoData.caracteristicas || []).map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: value };
        // Sincronizar nome e tipologia
        if (field === 'nome') {
          newItem.tipologia = value;
        }
        return newItem;
      }
      return item;
    });
    setEditEmpreendimentoData({ ...editEmpreendimentoData, caracteristicas: updated });
  };

  // Funções para gerenciar tags
  const addTag = (tag: string) => {
    if (!tag.trim()) return;
    const currentTags = editEmpreendimentoData.tags || [];
    if (!currentTags.includes(tag.trim())) {
      setEditEmpreendimentoData({
        ...editEmpreendimentoData,
        tags: [...currentTags, tag.trim()]
      });
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = editEmpreendimentoData.tags || [];
    setEditEmpreendimentoData({
      ...editEmpreendimentoData,
      tags: currentTags.filter((tag: string) => tag !== tagToRemove)
    });
  };

  const handleSaveEditEmpreendimento = async () => {
    // Validação básica
    if (!editEmpreendimentoData.nome) {
      toast({
        title: "Erro de validação",
        description: "Nome do empreendimento é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedEmpreendimento) return;

    try {
      // Preparar dados completos para salvar
      const dadosCompletos = {
        // Informações básicas
        nome: editEmpreendimentoData.nome,
        endereco: editEmpreendimentoData.endereco || editEmpreendimentoData.localizacao || null,
        cidade: editEmpreendimentoData.cidade || null,
        estado: editEmpreendimentoData.estado || null,
        descricao: editEmpreendimentoData.descricao || null,
        status: editEmpreendimentoData.status || 'ativo',

        // CAMPOS CORRIGIDOS - Agora serão salvos!
        tipologia: editEmpreendimentoData.tipologia || null,
        construtora: editEmpreendimentoData.construtora || null,
        data_lancamento: parseMesAnoToDate(editEmpreendimentoData.entrega),
        data_lancamento_texto: editEmpreendimentoData.entrega || null,
        bairro: editEmpreendimentoData.bairro || null,
        cep: editEmpreendimentoData.cep || null,

        // Características numéricas
        unidades: editEmpreendimentoData.unidades ? parseInt(editEmpreendimentoData.unidades) : null,
        vendidas: editEmpreendimentoData.vendidas ? parseInt(editEmpreendimentoData.vendidas) : 0,
        dormitorios: editEmpreendimentoData.dormitorios || null,
        banheiros: editEmpreendimentoData.banheiros || null,
        vagas: editEmpreendimentoData.vagas || null,
        area_privativa: editEmpreendimentoData.areaPrivativa || null,
        area_comum: editEmpreendimentoData.areaComum || null,

        // Valores
        // Valores
        valor_inicial: parseCurrencyToNumber(editEmpreendimentoData.precoInicial),
        valor_final: parseCurrencyToNumber(editEmpreendimentoData.precoFinal),

        // Listas em formato JSON
        comodidades: editEmpreendimentoData.comodidades || [],
        diferenciais: editEmpreendimentoData.diferenciais || [],
        financiamento: editEmpreendimentoData.financiamento || [],
        // Unificar fonte de dados: usa caracteristicas como fonte da verdade
        precos_por_tipologia: editEmpreendimentoData.caracteristicas || [],
        tags: editEmpreendimentoData.tags || [],
        updated_at: new Date().toISOString()
      };

      console.log('Salvando empreendimento com dados completos:', {
        ...dadosCompletos,
        caracteristicas: {
          tipologia: editEmpreendimentoData.tipologia,
          unidades: editEmpreendimentoData.unidades,
          vendidas: editEmpreendimentoData.vendidas,
          dormitorios: editEmpreendimentoData.dormitorios,
          banheiros: editEmpreendimentoData.banheiros,
          vagas: editEmpreendimentoData.vagas,
          areaPrivativa: editEmpreendimentoData.areaPrivativa,
          areaComum: editEmpreendimentoData.areaComum,
          bairro: editEmpreendimentoData.bairro,
          cep: editEmpreendimentoData.cep,
          construtora: editEmpreendimentoData.construtora,
          localizacao: editEmpreendimentoData.localizacao
        },
        listas: {
          comodidades: editEmpreendimentoData.comodidades,
          diferenciais: editEmpreendimentoData.diferenciais,
          financiamento: editEmpreendimentoData.financiamento,
          precosPorTipologia: editEmpreendimentoData.precosPorTipologia
        }
      });

      // Tentar salvar com todos os dados (incluindo tags)
      let { error } = await supabase
        .from('empreendimentos')
        .update(dadosCompletos)
        .eq('id', selectedEmpreendimento.id);

      // Se der erro de coluna não encontrada (PGRST204) especificamente para 'tags',
      // tentamos salvar sem o campo tags para não perder as outras edições
      if (error && error.code === 'PGRST204' && error.message.includes("tags")) {
        console.warn("Coluna 'tags' não encontrada no banco (Schema Cache desatualizado?). Tentando salvar sem tags...");

        const dadosSemTags = { ...dadosCompletos };
        delete (dadosSemTags as any).tags;

        const retry = await supabase
          .from('empreendimentos')
          .update(dadosSemTags)
          .eq('id', selectedEmpreendimento.id);

        if (!retry.error) {
          toast({
            title: "Salvo parcialmente",
            description: "Empreendimento atualizado, mas as TAGS não foram salvas pois a coluna ainda não foi detectada no banco. Faça um 'Reload Schema Cache' no Supabase.",
            variant: "warning",
          });

          carregarEmpreendimentos();
          setIsEditEmpreendimentoDialogOpen(false);
          return;
        }

        // Se falhar mesmo sem tags, assumimos esse erro para mostrar abaixo
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao atualizar empreendimento:', error);
        console.error('Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast({
          title: "Erro ao atualizar empreendimento",
          description: `${error.message || 'Não foi possível salvar as alterações. Tente novamente.'}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Empreendimento atualizado!",
        description: `${editEmpreendimentoData.nome} foi atualizado com sucesso.`,
      });

      setIsEditEmpreendimentoDialogOpen(false);

      // Recarregar a lista de empreendimentos para mostrar as alterações
      carregarEmpreendimentos();

    } catch (error) {
      console.error('Erro inesperado ao atualizar empreendimento:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCreateNewEmpreendimento = () => {
    setNewEmpreendimentoData({
      nome: "",
      localizacao: "",
      precoInicial: "",
      tipologia: "",
      status: "",
      unidades: "",
      construtora: "",
      entrega: "",
      descricao: "",
      cidade: "",
      estado: "",
      cep: "",
      bairro: ""
    });
    setIsNewEmpreendimentoDialogOpen(true);
  };

  const handleSaveNewEmpreendimento = async () => {
    // Validação básica
    if (!newEmpreendimentoData.nome) {
      toast({
        title: "Erro de validação",
        description: "Nome do empreendimento é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar empreendimentos.",
          variant: "destructive",
        });
        return;
      }

      // Salvar no Supabase
      const { error } = await supabase
        .from('empreendimentos')
        .insert({
          user_id: user.id,
          nome: newEmpreendimentoData.nome,
          endereco: newEmpreendimentoData.localizacao || null,
          cidade: newEmpreendimentoData.cidade || null,
          estado: newEmpreendimentoData.estado || null,
          descricao: newEmpreendimentoData.descricao || null,
          bairro: newEmpreendimentoData.bairro || null,
          cep: newEmpreendimentoData.cep || null,
          valor_inicial: parseCurrencyToNumber(newEmpreendimentoData.precoInicial),
          status: newEmpreendimentoData.status || 'ativo',
          data_lancamento: parseMesAnoToDate(newEmpreendimentoData.entrega),
          data_lancamento_texto: newEmpreendimentoData.entrega || null
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Empreendimento criado!",
        description: `${newEmpreendimentoData.nome} foi criado com sucesso.`,
      });

      setIsNewEmpreendimentoDialogOpen(false);

      // Limpar formulário
      setNewEmpreendimentoData({
        nome: "",
        localizacao: "",
        precoInicial: "",
        tipologia: "",
        status: "",
        unidades: "",
        construtora: "",
        entrega: "",
        descricao: "",
        cidade: "",
        estado: "",
        cep: "",
        bairro: ""
      });

      // Recarregar lista
      carregarEmpreendimentos();

    } catch (error) {
      console.error('Erro ao criar empreendimento:', error);
      toast({
        title: "Erro ao criar empreendimento",
        description: "Houve um problema ao salvar o empreendimento. Tente novamente.",
        variant: "destructive",
      });
    }
  };



  // Função para upload de imagem
  const handleUploadImage = (empreendimento: any) => {
    setSelectedEmpreendimento(empreendimento);
    imageInputRef.current?.click();
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedEmpreendimento) return;

    setUploadingImage(true);
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedEmpreendimento.id}-${Date.now()}.${fileExt}`;
      const filePath = `empreendimentos/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('empreendimentos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública da imagem
      const { data: publicURL } = supabase.storage
        .from('empreendimentos')
        .getPublicUrl(filePath);

      // Atualizar o empreendimento com a nova imagem
      const { error: updateError } = await supabase
        .from('empreendimentos')
        .update({ imagem_principal: publicURL.publicUrl })
        .eq('id', selectedEmpreendimento.id);

      if (updateError) throw updateError;

      toast({
        title: "Imagem atualizada!",
        description: "A imagem do empreendimento foi atualizada com sucesso.",
      });

      // Recarregar empreendimentos
      carregarEmpreendimentos();

    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload da imagem.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      // Limpar o input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleViewEmpreendimento = (empreendimento: any) => {
    console.log('Visualizando empreendimento:', empreendimento);

    // Usar dados diretamente do banco de dados sem modificações desnecessárias
    const empreendimentoMapeado = {
      ...empreendimento,
      // Garantir que arrays JSON estejam disponíveis
      comodidades: empreendimento.comodidades || [],
      diferenciais: empreendimento.diferenciais || [],
      financiamento: empreendimento.financiamento || [],
      precos_por_tipologia: empreendimento.precos_por_tipologia || [],
      // Valores padrão para campos obrigatórios de exibição
      campanhasAtivas: 0 // Este campo não existe no banco, será sempre 0
    };

    setSelectedEmpreendimento(empreendimentoMapeado);
    setIsViewEmpreendimentoDialogOpen(true);
  };

  const handleDeleteEmpreendimento = (empreendimento: any) => {
    setSelectedEmpreendimento(empreendimento);
    setIsDeleteConfirmDialogOpen(true);
  };

  const confirmDeleteEmpreendimento = async () => {
    if (!selectedEmpreendimento) return;

    console.log('🗑️ Tentando excluir empreendimento:', {
      id: selectedEmpreendimento.id,
      nome: selectedEmpreendimento.nome
    });

    try {
      // PASSO 1: Desvincular leads vinculados a este empreendimento
      console.log('🔗 Buscando leads vinculados ao empreendimento...');

      const tagSearch = `Interesse: ${selectedEmpreendimento.nome}`;

      // Busca leads pelo ID
      const { data: leadsById, error: searchError1 } = await supabase
        .from('leads')
        .select('id, tags, empreendimento_id')
        .eq('empreendimento_id', selectedEmpreendimento.id);

      // Busca leads pela Tag
      const { data: leadsByTag, error: searchError2 } = await supabase
        .from('leads')
        .select('id, tags, empreendimento_id')
        .contains('tags', [tagSearch]);

      if (searchError1 || searchError2) {
        console.error('Erro ao buscar leads vinculados:', searchError1 || searchError2);
      } else {
        const allLinkedLeads: any[] = [];
        const seenIds = new Set();

        [...(leadsById || []), ...(leadsByTag || [])].forEach(lead => {
          if (!seenIds.has(lead.id)) {
            seenIds.add(lead.id);
            allLinkedLeads.push(lead);
          }
        });

        if (allLinkedLeads.length > 0) {
          console.log(`📋 Encontrados ${allLinkedLeads.length} leads vinculados. Desvinculando...`);

          // Desvincular cada lead
          for (const lead of allLinkedLeads) {
            // Remover a tag de interesse deste empreendimento
            const tagsAtualizadas = (lead.tags || []).filter(
              (tag: string) => !tag.startsWith(`Interesse: ${selectedEmpreendimento.nome}`)
            );

            const updates: any = { tags: tagsAtualizadas };
            if (lead.empreendimento_id === selectedEmpreendimento.id) {
              updates.empreendimento_id = null;
            }

            // Atualizar o lead removendo a vinculação
            const { error: updateError } = await supabase
              .from('leads')
              .update(updates)
              .eq('id', lead.id);

            if (updateError) {
              console.error(`Erro ao desvincular lead ${lead.id}:`, updateError);
            }
          }

          console.log('✅ Leads desvinculados com sucesso');
        } else {
          console.log('ℹ️ Nenhum lead vinculado encontrado');
        }
      }

      // PASSO 2: Agora podemos excluir o empreendimento
      console.log('🗑️ Excluindo empreendimento...');
      const { data, error } = await supabase
        .from('empreendimentos')
        .delete()
        .eq('id', selectedEmpreendimento.id);

      console.log('📊 Resultado da exclusão:', { data, error });

      if (error) {
        console.error('❌ Erro ao excluir empreendimento:', error);

        let errorMessage = "Não foi possível excluir o empreendimento.";
        if (error.message) {
          errorMessage = error.message;
        }

        toast({
          title: "Erro ao excluir empreendimento",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Empreendimento excluído com sucesso');

      const mensagemSucesso = leadsVinculados && leadsVinculados.length > 0
        ? `${selectedEmpreendimento.nome} foi excluído e ${leadsVinculados.length} lead(s) foram desvinculados.`
        : `${selectedEmpreendimento.nome} foi excluído com sucesso.`;

      toast({
        title: "Empreendimento excluído!",
        description: mensagemSucesso,
      });

      setIsDeleteConfirmDialogOpen(false);
      setSelectedEmpreendimento(null);

      // Recarregar a lista de empreendimentos
      await carregarEmpreendimentos();

    } catch (error) {
      console.error('💥 Erro inesperado ao excluir empreendimento:', error);
      toast({
        title: "Erro inesperado",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="hidden md:block text-2xl font-bold text-foreground">Empreendimentos</h2>
          <p className="text-muted-foreground">Gerencie seus projetos imobiliários</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <Button variant="hero" className="shadow-elegant w-full sm:w-auto" onClick={handleCreateNewEmpreendimento}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Empreendimento
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empreendimentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
            {availableStatus.length > 0 ? availableStatus.map((status) => (
              <DropdownMenuItem
                key={status}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleStatusFilter(status);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroStatus.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <span>{status}</span>
                </div>
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground text-sm">Nenhum status cadastrado</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Filtrar por Tipologia</DropdownMenuLabel>
            {availableTipologias.length > 0 ? availableTipologias.map((tipologia) => (
              <DropdownMenuItem
                key={tipologia}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTipologiaFilter(tipologia);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroTipologia.includes(tipologia)}
                    onCheckedChange={() => toggleTipologiaFilter(tipologia)}
                  />
                  <span>{tipologia}</span>
                </div>
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground text-sm">Nenhuma tipologia cadastrada</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Filtrar por Construtora</DropdownMenuLabel>
            {availableConstrutoras.length > 0 ? availableConstrutoras.map((construtora) => (
              <DropdownMenuItem
                key={construtora}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleConstrutoreFilter(construtora);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroConstrutora.includes(construtora)}
                    onCheckedChange={() => toggleConstrutoreFilter(construtora)}
                  />
                  <span>{construtora}</span>
                </div>
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground text-sm">Nenhuma construtora cadastrada</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Filtrar por Tags</DropdownMenuLabel>
            {availableTags.length > 0 ? availableTags.map((tag) => (
              <DropdownMenuItem
                key={tag}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTagFilter(tag);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroTags.includes(tag)}
                    onCheckedChange={() => toggleTagFilter(tag)}
                  />
                  <Badge variant="secondary" className="text-xs font-normal">
                    {tag}
                  </Badge>
                </div>
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground text-sm">Nenhuma tag cadastrada</span>
              </DropdownMenuItem>
            )}

            {activeFiltersCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive"
                  onClick={clearFilters}
                >
                  Limpar todos os filtros
                </DropdownMenuItem>
              </>
            )}

            {activeFiltersCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive"
                  onClick={clearFilters}
                >
                  Limpar todos os filtros
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{empreendimentos.length}</div>
                <div className="text-sm text-muted-foreground">Empreendimentos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning text-warning-foreground">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{empreendimentos.reduce((sum: number, emp: any) => sum + (emp.campanhasAtivas || 0), 0)}</div>
                <div className="text-sm text-muted-foreground">Campanhas Ativas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empreendimentos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredEmpreendimentos.map((emp) => (
          <Card key={emp.id} className="shadow-card hover:shadow-elegant transition-all duration-300 overflow-hidden">
            {/* Image Header */}
            <div className="relative h-48 bg-gradient-card flex items-center justify-center group cursor-pointer overflow-hidden">
              {emp.imagem_principal ? (
                <img
                  src={emp.imagem_principal}
                  alt={emp.nome}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Image className="w-16 h-16 mb-2" />
                  <span className="text-sm">Adicionar imagem</span>
                </div>
              )}
              <div className="absolute top-4 right-4">
                <Badge className={getStatusColor(emp.status)}>
                  {emp.status}
                </Badge>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleUploadImage(emp)}
                  className="bg-white/90 text-black hover:bg-white"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Alterar Imagem
                </Button>
              </div>
            </div>

            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{emp.nome}</CardTitle>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{emp.endereco || 'Endereço não informado'}</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Price and Type */}
              <div>
                <div className="text-2xl font-bold text-primary">
                  {formatMoney(emp.valor_inicial)}
                </div>
                <div className="text-sm text-muted-foreground">{emp.descricao || 'Empreendimento imobiliário'}</div>
              </div>

              {/* Key Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium">{emp.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cidade</div>
                  <div className="font-medium">{emp.cidade || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Lançamento</div>
                  <div className="font-medium">
                    {emp.data_lancamento_texto || (emp.data_lancamento ? new Date(emp.data_lancamento).toLocaleDateString('pt-BR') : 'A definir')}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Estado</div>
                  <div className="font-medium">{emp.estado || 'N/A'}</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {emp.descricao || 'Descrição não disponível'}
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="default" size="sm" className="flex-1" onClick={() => handleViewEmpreendimento(emp)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditEmpreendimento(emp)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteEmpreendimento(emp)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Empreendimento Dialog */}
      <Dialog open={isNewEmpreendimentoDialogOpen} onOpenChange={setIsNewEmpreendimentoDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Empreendimento</DialogTitle>
            <DialogDescription>
              Preencha as informações básicas do novo empreendimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-nome">Nome do Empreendimento</Label>
              <Input
                id="new-nome"
                value={newEmpreendimentoData.nome}
                onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, nome: e.target.value })}
                placeholder="Ex: Residencial Aurora"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-localizacao">Localização</Label>
              <Input
                id="new-localizacao"
                value={newEmpreendimentoData.localizacao}
                onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, localizacao: e.target.value })}
                placeholder="Digite o endereço completo"
              />
            </div>

            {/* Campos adicionais de localização */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-cidade">Cidade</Label>
                <Input
                  id="new-cidade"
                  value={newEmpreendimentoData.cidade}
                  onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, cidade: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-estado">Estado</Label>
                <Input
                  id="new-estado"
                  value={newEmpreendimentoData.estado}
                  onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, estado: e.target.value })}
                  placeholder="SP"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-cep">CEP</Label>
              <Input
                id="new-cep"
                value={newEmpreendimentoData.cep}
                onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, cep: e.target.value })}
                placeholder="01234-567"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-preco">Preço Inicial</Label>
                <Input
                  id="new-preco"
                  value={newEmpreendimentoData.precoInicial}
                  onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, precoInicial: e.target.value })}
                  placeholder="Ex: R$ 580.000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-unidades">Número de Unidades</Label>
                <Input
                  id="new-unidades"
                  type="number"
                  value={newEmpreendimentoData.unidades}
                  onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, unidades: e.target.value })}
                  placeholder="Ex: 120"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-tipologia">Tipologia</Label>
              <Input
                id="new-tipologia"
                value={newEmpreendimentoData.tipologia}
                onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, tipologia: e.target.value })}
                placeholder="Ex: Apartamentos 2 e 3 quartos"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-status">Status</Label>
                <Select value={newEmpreendimentoData.status} onValueChange={(value) => setNewEmpreendimentoData({ ...newEmpreendimentoData, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planejamento">Planejamento</SelectItem>
                    <SelectItem value="Pré-lançamento">Pré-lançamento</SelectItem>
                    <SelectItem value="Lançamento">Lançamento</SelectItem>
                    <SelectItem value="Vendas">Vendas</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-entrega">Previsão de Entrega</Label>
                <Input
                  id="new-entrega"
                  value={newEmpreendimentoData.entrega}
                  onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, entrega: e.target.value })}
                  placeholder="Ex: Dez/2025"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-construtora">Construtora</Label>
              <Input
                id="new-construtora"
                value={newEmpreendimentoData.construtora}
                onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, construtora: e.target.value })}
                placeholder="Ex: Construtora ABC"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-descricao">Descrição</Label>
              <Textarea
                id="new-descricao"
                value={newEmpreendimentoData.descricao}
                onChange={(e) => setNewEmpreendimentoData({ ...newEmpreendimentoData, descricao: e.target.value })}
                placeholder="Descreva as principais características do empreendimento..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsNewEmpreendimentoDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveNewEmpreendimento} className="flex-1">
              Criar Empreendimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Empreendimento Dialog */}
      <Dialog open={isEditEmpreendimentoDialogOpen} onOpenChange={setIsEditEmpreendimentoDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[900px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Editar Empreendimento - {selectedEmpreendimento?.nome}</DialogTitle>
            <DialogDescription>
              Edite todas as informações do empreendimento
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basicas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 h-auto gap-1 mb-2">
              <TabsTrigger value="basicas">Básicas</TabsTrigger>
              <TabsTrigger value="localizacao">Localização</TabsTrigger>
              <TabsTrigger value="caracteristicas">Características</TabsTrigger>
              <TabsTrigger value="comodidades">Comodidades</TabsTrigger>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
            </TabsList>

            <TabsContent value="basicas" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nome">Nome do Empreendimento</Label>
                  <Input
                    id="edit-nome"
                    value={editEmpreendimentoData.nome}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, nome: e.target.value })}
                    placeholder="Ex: Residencial Aurora"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-construtora">Construtora</Label>
                  <Input
                    id="edit-construtora"
                    value={editEmpreendimentoData.construtora}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, construtora: e.target.value })}
                    placeholder="Ex: Construtora ABC"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-descricao">Descrição Geral</Label>
                <Textarea
                  id="edit-descricao"
                  value={editEmpreendimentoData.descricao}
                  onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, descricao: e.target.value })}
                  placeholder="Descreva as principais características do empreendimento..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite uma tag e pressione Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget;
                          addTag(input.value);
                          input.value = '';
                        }
                      }}
                    />
                  </div>
                  {editEmpreendimentoData.tags && editEmpreendimentoData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {editEmpreendimentoData.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editEmpreendimentoData.status} onValueChange={(value) => setEditEmpreendimentoData({ ...editEmpreendimentoData, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planejamento">Planejamento</SelectItem>
                      <SelectItem value="Pré-lançamento">Pré-lançamento</SelectItem>
                      <SelectItem value="Lançamento">Lançamento</SelectItem>
                      <SelectItem value="Vendas">Vendas</SelectItem>
                      <SelectItem value="Entregue">Entregue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-entrega">Previsão de Entrega</Label>
                  <Input
                    id="edit-entrega"
                    value={editEmpreendimentoData.entrega || ""}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, entrega: e.target.value })}
                    placeholder="Ex: Dez/2025, A definir, Em breve"
                    type="text"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tipologia">Tipologia</Label>
                  <Input
                    id="edit-tipologia"
                    value={editEmpreendimentoData.tipologia}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, tipologia: e.target.value })}
                    placeholder="Ex: Apartamentos 2 e 3 quartos"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="localizacao" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-endereco">Endereço Completo</Label>
                <Input
                  id="edit-endereco"
                  value={editEmpreendimentoData.endereco}
                  onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, endereco: e.target.value })}
                  placeholder="Ex: Rua das Flores, 123"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-bairro">Bairro</Label>
                  <Input
                    id="edit-bairro"
                    value={editEmpreendimentoData.bairro}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, bairro: e.target.value })}
                    placeholder="Ex: Vila Madalena"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-cidade">Cidade</Label>
                  <Input
                    id="edit-cidade"
                    value={editEmpreendimentoData.cidade}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, cidade: e.target.value })}
                    placeholder="Ex: São Paulo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-estado">Estado</Label>
                  <Select value={editEmpreendimentoData.estado} onValueChange={(value) => setEditEmpreendimentoData({ ...editEmpreendimentoData, estado: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AC">Acre</SelectItem>
                      <SelectItem value="AL">Alagoas</SelectItem>
                      <SelectItem value="AP">Amapá</SelectItem>
                      <SelectItem value="AM">Amazonas</SelectItem>
                      <SelectItem value="BA">Bahia</SelectItem>
                      <SelectItem value="CE">Ceará</SelectItem>
                      <SelectItem value="DF">Distrito Federal</SelectItem>
                      <SelectItem value="ES">Espírito Santo</SelectItem>
                      <SelectItem value="GO">Goiás</SelectItem>
                      <SelectItem value="MA">Maranhão</SelectItem>
                      <SelectItem value="MT">Mato Grosso</SelectItem>
                      <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                      <SelectItem value="MG">Minas Gerais</SelectItem>
                      <SelectItem value="PA">Pará</SelectItem>
                      <SelectItem value="PB">Paraíba</SelectItem>
                      <SelectItem value="PR">Paraná</SelectItem>
                      <SelectItem value="PE">Pernambuco</SelectItem>
                      <SelectItem value="PI">Piauí</SelectItem>
                      <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                      <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                      <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                      <SelectItem value="RO">Rondônia</SelectItem>
                      <SelectItem value="RR">Roraima</SelectItem>
                      <SelectItem value="SC">Santa Catarina</SelectItem>
                      <SelectItem value="SP">São Paulo</SelectItem>
                      <SelectItem value="SE">Sergipe</SelectItem>
                      <SelectItem value="TO">Tocantins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-cep">CEP</Label>
                  <Input
                    id="edit-cep"
                    value={editEmpreendimentoData.cep}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, cep: e.target.value })}
                    placeholder="Ex: 01234-567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-localizacao">Localização (exibição)</Label>
                <Input
                  id="edit-localizacao"
                  value={editEmpreendimentoData.localizacao}
                  onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, localizacao: e.target.value })}
                  placeholder="Ex: Vila Madalena, São Paulo - SP"
                />
              </div>
            </TabsContent>

            <TabsContent value="caracteristicas" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-unidades">Total de Unidades</Label>
                  <Input
                    id="edit-unidades"
                    type="number"
                    value={editEmpreendimentoData.unidades}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, unidades: e.target.value })}
                    placeholder="Ex: 120"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-vendidas">Unidades Vendidas</Label>
                  <Input
                    id="edit-vendidas"
                    type="number"
                    value={editEmpreendimentoData.vendidas}
                    onChange={(e) => setEditEmpreendimentoData({ ...editEmpreendimentoData, vendidas: e.target.value })}
                    placeholder="Ex: 45"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Plantas / Tipologias</h3>
                    <p className="text-sm text-muted-foreground">Adicione as diferentes plantas disponíveis no empreendimento</p>
                  </div>
                  <Button variant="outline" onClick={addPlanta}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Planta
                  </Button>
                </div>

                {(editEmpreendimentoData.caracteristicas || []).map((planta, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Planta {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePlanta(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Nome da Planta</Label>
                        <Input
                          value={planta.nome}
                          onChange={(e) => updatePlanta(index, "nome", e.target.value)}
                          placeholder="Ex: Apartamento 2 Quartos com Suíte"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Dormitórios</Label>
                          <Input
                            value={planta.dormitorios}
                            onChange={(e) => updatePlanta(index, "dormitorios", e.target.value)}
                            placeholder="Ex: 2"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Banheiros</Label>
                          <Input
                            value={planta.banheiros}
                            onChange={(e) => updatePlanta(index, "banheiros", e.target.value)}
                            placeholder="Ex: 2"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Vagas</Label>
                          <Input
                            value={planta.vagas}
                            onChange={(e) => updatePlanta(index, "vagas", e.target.value)}
                            placeholder="Ex: 1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Área Privativa</Label>
                          <Input
                            value={planta.areaPrivativa}
                            onChange={(e) => {
                              const formatted = formatArea(e.target.value);
                              updatePlanta(index, "areaPrivativa", formatted);
                            }}
                            placeholder="Ex: 65 m²"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Área Total</Label>
                          <Input
                            value={planta.areaTotal}
                            onChange={(e) => {
                              const formatted = formatArea(e.target.value);
                              updatePlanta(index, "areaTotal", formatted);
                            }}
                            placeholder="Ex: 85 m²"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {(!editEmpreendimentoData.caracteristicas || editEmpreendimentoData.caracteristicas.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma planta adicionada</p>
                    <p className="text-sm">Clique em "Adicionar Planta" para começar</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comodidades" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Comodidades e Lazer</h3>
                    <p className="text-sm text-muted-foreground">Adicione as comodidades do empreendimento</p>
                  </div>
                  <Button variant="outline" onClick={addComodidade}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {editEmpreendimentoData.comodidades.map((comodidade, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={comodidade}
                      onChange={(e) => updateComodidade(index, e.target.value)}
                      placeholder="Ex: Piscina, Academia, Playground..."
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeComodidade(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {editEmpreendimentoData.comodidades.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma comodidade adicionada</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Diferenciais</h3>
                    <p className="text-sm text-muted-foreground">Adicione os diferenciais do empreendimento</p>
                  </div>
                  <Button variant="outline" onClick={addDiferencial}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {editEmpreendimentoData.diferenciais.map((diferencial, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={diferencial}
                      onChange={(e) => updateDiferencial(index, e.target.value)}
                      placeholder="Ex: Vista para o mar, Localização privilegiada..."
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDiferencial(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {editEmpreendimentoData.diferenciais.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum diferencial adicionado</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comercial" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-preco-inicial">Preço Inicial</Label>
                  <Input
                    id="edit-preco-inicial"
                    value={editEmpreendimentoData.precoInicial}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setEditEmpreendimentoData({ ...editEmpreendimentoData, precoInicial: formatted });
                    }}
                    placeholder="Ex: R$ 580.000,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-preco-final">Preço Final</Label>
                  <Input
                    id="edit-preco-final"
                    value={editEmpreendimentoData.precoFinal}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setEditEmpreendimentoData({ ...editEmpreendimentoData, precoFinal: formatted });
                    }}
                    placeholder="Ex: R$ 850.000,00"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Preços por Tipologia</h3>
                    <p className="text-sm text-muted-foreground">Adicione preços específicos para cada tipologia de unidade</p>
                  </div>
                  <Button variant="outline" onClick={addPrecoTipologia}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Preço
                  </Button>
                </div>

                {(editEmpreendimentoData.caracteristicas || []).map((item, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <Input
                      value={item.tipologia || item.nome}
                      onChange={(e) => updatePrecoTipologia(index, "tipologia", e.target.value)}
                      placeholder="Ex: Apartamento 2 quartos"
                      className="flex-1"
                    />
                    <div className="flex gap-2 items-center">
                      <Input
                        value={item.preco}
                        onChange={(e) => {
                          const formatted = formatCurrency(e.target.value);
                          updatePrecoTipologia(index, "preco", formatted);
                        }}
                        placeholder="Ex: R$ 450.000,00"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePrecoTipologia(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {(!editEmpreendimentoData.caracteristicas || editEmpreendimentoData.caracteristicas.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum preço por tipologia adicionado</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Opções de Financiamento</h3>
                    <p className="text-sm text-muted-foreground">Adicione as opções de financiamento disponíveis</p>
                  </div>
                  <Button variant="outline" onClick={addFinanciamento}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {editEmpreendimentoData.financiamento.map((opcao, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Textarea
                      value={opcao}
                      onChange={(e) => updateFinanciamento(index, e.target.value)}
                      placeholder="Ex: Financiamento próprio com entrada de 20% e saldo em 120x..."
                      className="flex-1"
                      rows={2}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFinanciamento(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {editEmpreendimentoData.financiamento.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma opção de financiamento adicionada</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4 mt-6 border-t border-border">
            <Button variant="outline" onClick={() => setIsEditEmpreendimentoDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveEditEmpreendimento} className="flex-1">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Empreendimento Dialog */}
      <Dialog open={isViewEmpreendimentoDialogOpen} onOpenChange={setIsViewEmpreendimentoDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Building2 className="w-6 h-6" />
              {selectedEmpreendimento?.nome}
            </DialogTitle>
            <DialogDescription>
              Visualização completa das informações do empreendimento
            </DialogDescription>
          </DialogHeader>

          {selectedEmpreendimento && (
            <Tabs defaultValue="resumo" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 h-auto gap-1 mb-2">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="plantas">Plantas</TabsTrigger>
                <TabsTrigger value="comodidades">Comodidades</TabsTrigger>
                <TabsTrigger value="comercial">Comercial</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="space-y-6 mt-4">
                {/* Header com imagem e status */}
                <div className="relative h-48 bg-gradient-card rounded-lg flex items-center justify-center overflow-hidden">
                  {selectedEmpreendimento?.imagem_principal ? (
                    <img
                      src={selectedEmpreendimento.imagem_principal}
                      alt={selectedEmpreendimento.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Image className="w-16 h-16 mb-2" />
                      <span className="text-sm">Sem imagem</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <Badge className={getStatusColor(selectedEmpreendimento.status)}>
                      {selectedEmpreendimento.status}
                    </Badge>
                  </div>
                </div>

                {/* Informações principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Localização</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium">{selectedEmpreendimento.endereco || selectedEmpreendimento.localizacao || 'Endereço não informado'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Construtora</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="font-medium">{selectedEmpreendimento.construtora}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Preço</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="font-bold text-primary text-lg">
                          {formatMoney(selectedEmpreendimento.valor_inicial)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Previsão de Entrega</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-medium">
                          {selectedEmpreendimento.data_lancamento_texto || selectedEmpreendimento.entrega || 'A definir'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-background rounded-lg border border-border">
                    <div className="text-2xl font-bold text-primary">{selectedEmpreendimento.unidades}</div>
                    <div className="text-sm text-muted-foreground">Total Unidades</div>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg border border-border">
                    <div className="text-2xl font-bold text-success">{selectedEmpreendimento.vendidas}</div>
                    <div className="text-sm text-muted-foreground">Vendidas</div>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg border border-border">
                    <div className="text-2xl font-bold text-warning">{selectedEmpreendimento.unidades - selectedEmpreendimento.vendidas}</div>
                    <div className="text-sm text-muted-foreground">Disponíveis</div>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg border border-border">
                    <div className="text-2xl font-bold text-accent">{selectedEmpreendimento.campanhasAtivas}</div>
                    <div className="text-sm text-muted-foreground">Campanhas</div>
                  </div>
                </div>

                {/* Descrição */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Descrição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedEmpreendimento.descricao}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="detalhes" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Home className="w-5 h-5" />
                        Tipologia
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedEmpreendimento.tipologia}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Status do Projeto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className={getStatusColor(selectedEmpreendimento.status)}>
                        {selectedEmpreendimento.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Informações Gerais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total de Unidades</div>
                        <div className="font-medium">{selectedEmpreendimento.unidades}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Unidades Vendidas</div>
                        <div className="font-medium text-success">{selectedEmpreendimento.vendidas}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Campanhas Ativas</div>
                        <div className="font-medium">{selectedEmpreendimento.campanhasAtivas}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">% Vendido</div>
                        <div className="font-medium">{Math.round((selectedEmpreendimento.vendidas / selectedEmpreendimento.unidades) * 100)}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="plantas" className="space-y-6 mt-4">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      Plantas / Tipologias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedEmpreendimento.precos_por_tipologia && selectedEmpreendimento.precos_por_tipologia.length > 0 ? (
                      <div className="grid gap-4">
                        {selectedEmpreendimento.precos_por_tipologia.map((planta: any, index: number) => (
                          <Card key={index} className="p-4 bg-background">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="font-semibold text-lg">{planta.nome || planta.tipologia || `Planta ${index + 1}`}</h4>
                                {planta.preco && (
                                  <Badge variant="secondary" className="text-sm">
                                    {planta.preco}
                                  </Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {planta.dormitorios && (
                                  <div>
                                    <div className="text-xs text-muted-foreground">Dormitórios</div>
                                    <div className="font-medium">{planta.dormitorios}</div>
                                  </div>
                                )}
                                {planta.banheiros && (
                                  <div>
                                    <div className="text-xs text-muted-foreground">Banheiros</div>
                                    <div className="font-medium">{planta.banheiros}</div>
                                  </div>
                                )}
                                {planta.vagas && (
                                  <div>
                                    <div className="text-xs text-muted-foreground">Vagas</div>
                                    <div className="font-medium">{planta.vagas}</div>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {planta.areaPrivativa && (
                                  <div>
                                    <div className="text-xs text-muted-foreground">Área Privativa</div>
                                    <div className="font-medium">{planta.areaPrivativa}</div>
                                  </div>
                                )}
                                {planta.areaTotal && (
                                  <div>
                                    <div className="text-xs text-muted-foreground">Área Total</div>
                                    <div className="font-medium">{planta.areaTotal}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma planta cadastrada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comodidades" className="space-y-6 mt-4">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Utensils className="w-5 h-5" />
                      Comodidades e Lazer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedEmpreendimento.comodidades && selectedEmpreendimento.comodidades.length > 0 ? (
                      <div className="grid gap-3">
                        {selectedEmpreendimento.comodidades.map((comodidade: string, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                            <Utensils className="w-4 h-4 text-primary" />
                            <span>{comodidade}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Utensils className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma comodidade cadastrada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="w-5 h-5" />
                      Diferenciais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedEmpreendimento.diferenciais && selectedEmpreendimento.diferenciais.length > 0 ? (
                      <div className="grid gap-3">
                        {selectedEmpreendimento.diferenciais.map((diferencial: string, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                            <Star className="w-4 h-4 text-primary" />
                            <span>{diferencial}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum diferencial cadastrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comercial" className="space-y-6 mt-4">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Informações Comerciais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Preço Inicial</div>
                        <div className="text-2xl font-bold text-primary">
                          {formatMoney(selectedEmpreendimento.valor_inicial)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Preço Final</div>
                        <div className="text-xl font-bold text-primary">
                          {selectedEmpreendimento.valor_final ? formatMoney(selectedEmpreendimento.valor_final) : 'Não informado'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tipologia</div>
                        <div className="font-medium">{selectedEmpreendimento.tipologia || 'Não informado'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Dormitórios</div>
                        <div className="font-medium">{selectedEmpreendimento.dormitorios || 'Não informado'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Banheiros</div>
                        <div className="font-medium">{selectedEmpreendimento.banheiros || 'Não informado'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Vagas</div>
                        <div className="font-medium">{selectedEmpreendimento.vagas || 'Não informado'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Área Privativa</div>
                        <div className="font-medium">{selectedEmpreendimento.area_privativa || 'Não informado'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Área Comum</div>
                        <div className="font-medium">{selectedEmpreendimento.area_comum || 'Não informado'}</div>
                      </div>
                    </div>

                    {selectedEmpreendimento.precos_por_tipologia && selectedEmpreendimento.precos_por_tipologia.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-3">Preços por Tipologia</h4>
                        <div className="grid gap-3">
                          {selectedEmpreendimento.precos_por_tipologia.map((preco: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-background rounded-lg border border-border">
                              <span className="font-medium">{preco.tipologia || preco.nome || `Opção ${index + 1}`}</span>
                              <span className="text-primary font-bold">{preco.preco}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Opções de Financiamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedEmpreendimento.financiamento && selectedEmpreendimento.financiamento.length > 0 ? (
                      <div className="grid gap-3">
                        {selectedEmpreendimento.financiamento.map((opcao: string, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                            <DollarSign className="w-4 h-4 text-primary" />
                            <span>{opcao}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma opção de financiamento cadastrada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex gap-3 pt-4 mt-6 border-t border-border">
            <Button variant="outline" onClick={() => setIsViewEmpreendimentoDialogOpen(false)} className="flex-1">
              Fechar
            </Button>
            <Button onClick={() => {
              setIsViewEmpreendimentoDialogOpen(false);
              handleEditEmpreendimento(selectedEmpreendimento);
            }} className="flex-1">
              <Edit className="w-4 h-4 mr-2" />
              Editar Empreendimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[400px] mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O empreendimento será permanentemente removido.
            </DialogDescription>
          </DialogHeader>

          {selectedEmpreendimento && (
            <div className="py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">
                  {selectedEmpreendimento.nome}
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {selectedEmpreendimento.localizacao}
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3 h-3" />
                    {selectedEmpreendimento.unidades} unidades - {selectedEmpreendimento.vendidas} vendidas
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsDeleteConfirmDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEmpreendimento} className="flex-1">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir Definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Input oculto para upload de imagens */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}