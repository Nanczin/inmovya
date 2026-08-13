import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Filter,
  Phone,
  Clock,
  User,
  ThumbsUp,
  ThumbsDown,
  PhoneOff,
  MessageSquare,
  Calendar,
  Play,
  Pause,
  Download,
  BarChart3,
  Mail,
  MapPin,
  Building,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  Target
} from "lucide-react";

interface Lista {
  id: string;
  nome: string;
  descricao: string;
  total_contatos: number;
  status: string;
  created_at: string;
  configuracoes?: any;
}

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  status: string;
  dados_extras: any;
  lista_id: string;
}

interface Empreendimento {
  id: string;
  nome: string;
  cidade: string;
  status: string;
}

const classificacoes = [
  "Cliente Interessado",
  "Deny List",
  "Caixa Postal/Cliente Não Atendeu",
  "Número não existe"
];

const interessesCliente = [
  "Tem Interesse",
  "Já Comprou",
  "Não Quer Mais Contato",
  "Corretor"
];

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '-';

  // Remove all non-numeric characters and any separators like ; or ,
  let cleanPhone = phone.replace(/[^\d]/g, '');

  console.log('Original phone:', phone, 'Cleaned phone:', cleanPhone);

  // Remove leading country code if present (55 for Brazil)
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    cleanPhone = cleanPhone.substring(2);
  }

  // Format for Brazilian phone numbers (11 digits for mobile with 9)
  if (cleanPhone.length === 11) {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
  }
  // Format for Brazilian phone numbers (10 digits for landline)
  else if (cleanPhone.length === 10) {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
  }
  // For 9 digit numbers, assume it's missing the area code, add a default one
  else if (cleanPhone.length === 9) {
    return `(11) ${cleanPhone.slice(0, 5)}-${cleanPhone.slice(5)}`;
  }
  // For 8 digit numbers, assume it's missing the area code, add a default one
  else if (cleanPhone.length === 8) {
    return `(11) ${cleanPhone.slice(0, 4)}-${cleanPhone.slice(4)}`;
  }

  // Return original if doesn't match expected patterns
  return cleanPhone || phone;
};

const extractDataFromImportedFormat = (contato: Contato, lista?: Lista) => {
  // Se os dados principais já estiverem populados corretamente, usar eles
  // Verificação básica para garantir que não são strings vazias ou inválidas
  const temTelefoneValido = contato.telefone && contato.telefone.length >= 8;
  const temEmailValido = contato.email && contato.email.includes('@');

  if (temTelefoneValido || temEmailValido) {
    return {
      nome: contato.nome || 'Nome não informado',
      telefone: contato.telefone || '',
      email: contato.email || null
    };
  }

  // Se o contato tem dados_extras com dados_originais, usar eles
  if (contato.dados_extras?.dados_originais?.[0]) {
    const dadosOriginais = contato.dados_extras.dados_originais[0];
    const partes = dadosOriginais.split(';');

    // Usar mapeamento da lista se disponível
    if (lista?.configuracoes?.mapeamento) {
      const mapeamento = lista.configuracoes.mapeamento;
      return {
        nome: partes[mapeamento.nome] || 'Nome não informado',
        telefone: partes[mapeamento.telefone] || '',
        email: partes[mapeamento.email] || null
      };
    }

    // Fallback para ordem padrão se não houver mapeamento
    if (partes.length >= 2) {
      return {
        nome: partes[0] || 'Nome não informado',
        telefone: partes[1] || '',
        email: partes[2] || null
      };
    }
  }

  // Se não tem dados_extras, tentar extrair do campo nome que pode conter dados com separadores
  if (contato.nome && contato.nome.includes(';')) {
    const partes = contato.nome.split(';').filter(parte => parte.trim() !== '');

    // Usar mapeamento da lista se disponível
    if (lista?.configuracoes?.mapeamento) {
      const mapeamento = lista.configuracoes.mapeamento;
      return {
        nome: partes[mapeamento.nome] || 'Nome não informado',
        telefone: partes[mapeamento.telefone] || '',
        email: partes[mapeamento.email] || null
      };
    }

    // Se tem apenas um item (telefone entre separadores), assumir que é telefone
    if (partes.length === 1) {
      return {
        nome: 'Nome não informado',
        telefone: partes[0],
        email: null
      };
    }

    // Se tem múltiplos itens, assumir ordem: nome, telefone, email
    return {
      nome: partes[0] || 'Nome não informado',
      telefone: partes[1] || '',
      email: partes[2] || null
    };
  }

  // Usar dados como estão se não conseguir extrair
  return {
    nome: contato.nome || 'Nome não informado',
    telefone: contato.telefone || '',
    email: contato.email || null
  };
};

const formatName = (name: string) => {
  if (!name) return '';

  // Convert to proper case (first letter of each word capitalized)
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function LigacoesModule() {
  const [listas, setListas] = useState<Lista[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [listaSelecionada, setListaSelecionada] = useState<string>("");
  const [contatoSelecionado, setContatoSelecionado] = useState<Contato | null>(null);
  const [showOfertaAtiva, setShowOfertaAtiva] = useState(false);
  const [showClientData, setShowClientData] = useState(false);
  const [mailingSelecionado, setMailingSelecionado] = useState("");
  const [empreendimentoSelecionado, setEmpreendimentoSelecionado] = useState("");
  const [classificacaoSelecionada, setClassificacaoSelecionada] = useState("");
  const [interesseCliente, setInteresseCliente] = useState("");
  const [descricaoCliente, setDescricaoCliente] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingCall, setLoadingCall] = useState(false);
  const [showContatosEsgotados, setShowContatosEsgotados] = useState(false);
  // Templates
  const [templatesDisponiveis, setTemplatesDisponiveis] = useState<any[]>([]);
  const [templateWhatsappId, setTemplateWhatsappId] = useState<string>("");
  const [templateEmailId, setTemplateEmailId] = useState<string>("");

  // Email Accounts
  const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
  const [selectedGmailAccount, setSelectedGmailAccount] = useState<string>("");
  const [isRequestingOffer, setIsRequestingOffer] = useState(false);
  const [showMetasDialog, setShowMetasDialog] = useState(false);
  const [metaLigacoes, setMetaLigacoes] = useState(200);
  const [ligacoesHoje, setLigacoesHoje] = useState(0);

  useEffect(() => {
    // Carregar preferências salvas
    const savedWhatsappTemplate = localStorage.getItem('default_template_whatsapp');
    const savedEmailTemplate = localStorage.getItem('default_template_email');
    const savedMetaLigacoes = localStorage.getItem('meta_ligacoes_diarias');
    
    if (savedWhatsappTemplate) setTemplateWhatsappId(savedWhatsappTemplate);
    if (savedEmailTemplate) setTemplateEmailId(savedEmailTemplate);
    if (savedMetaLigacoes) setMetaLigacoes(parseInt(savedMetaLigacoes, 10));

    const carregarProgressoDiario = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const { count, error } = await supabase
          .from('ligacoes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('data_ligacao', hoje.toISOString());
          
        if (!error && count !== null) {
          setLigacoesHoje(count);
        }
      } catch (err) {
        console.error("Erro ao carregar progresso:", err);
      }
    };
    carregarProgressoDiario();

    // Carregar templates com fallback robusto
    const fetchTemplates = async () => {
      let templatesFinais: any[] = [];

      // 1. Tentar carregar do Supabase
      try {
        const { data, error } = await supabase.from('mensagem_templates').select('*');
        if (data && !error) {
          templatesFinais = data;
        }
      } catch (err) {
        console.warn("Erro ao buscar templates do Supabase, tentando local...", err);
      }

      // 2. Se não veio do banco, tentar carregar do localStorage (onde o TemplatesModule salva como fallback)
      if (templatesFinais.length === 0) {
        const localTemplates = localStorage.getItem('inmovya_templates_local');
        if (localTemplates) {
          try {
            templatesFinais = JSON.parse(localTemplates);
          } catch (e) {
            console.error("Erro ao parsear templates locais", e);
          }
        }
      }

      // 3. Se ainda não tem nada, usar MOCK patterns padrão
      if (templatesFinais.length === 0) {
        templatesFinais = [
          { id: 'mock1', nome: 'Boas-vindas WhatsApp', tipo: 'whatsapp', conteudo: 'Olá {{nome}}, tudo bem? Sou corretor da Inmovia. Vi seu interesse no {{empreendimento}}.', categoria: 'Primeiro Contato' },
          { id: 'mock2', nome: 'Email Apresentação', tipo: 'email', assunto: 'Apresentação {{empreendimento}}', conteudo: 'Olá {{nome}},\n\nSegue em anexo a apresentação do {{empreendimento}}.', categoria: 'Geral' }
        ];
      }

      setTemplatesDisponiveis(templatesFinais);
    };
    fetchTemplates();

    carregarDados();

    // Carregar contas Gmail
    const loadGmailAccounts = async () => {
      const { data } = await supabase.from('gmail_accounts').select('*').eq('is_active', true).eq('status', 'active');
      if (data && data.length > 0) {
        setGmailAccounts(data);
        // Set default email account if saved or first available
        const savedAccount = localStorage.getItem('default_gmail_account_ligacoes');
        if (savedAccount && data.find(c => c.id === savedAccount)) {
          setSelectedGmailAccount(savedAccount);
        } else {
          setSelectedGmailAccount(data[0].id);
        }
      }
    };
    loadGmailAccounts();
  }, []);

  const handleSetDefaultTemplate = (type: 'whatsapp' | 'email', id: string) => {
    if (type === 'whatsapp') {
      setTemplateWhatsappId(id);
      localStorage.setItem('default_template_whatsapp', id);
    } else {
      setTemplateEmailId(id);
      localStorage.setItem('default_template_email', id);
    }
  };

  const getProcessedMessage = (templateId: string, contato: Contato, includeAttachmentLink: boolean = true) => {
    const template = templatesDisponiveis.find(t => t.id === templateId);
    if (!template) return '';

    let msg = template.conteudo;
    const dados = extractDataFromImportedFormat(contato, listas.find(l => l.id === listaSelecionada));

    // Substituir variáveis
    const primeiroNome = (dados.nome || '').split(' ')[0];
    msg = msg.replace(/{{nome}}/g, dados.nome || '');
    msg = msg.replace(/{{primeiro_nome}}/g, primeiroNome || '');
    msg = msg.replace(/{{telefone}}/g, dados.telefone || '');
    msg = msg.replace(/{{email}}/g, dados.email || '');
    msg = msg.replace(/{{empreendimento}}/g, empreendimentos.find(e => e.id === empreendimentoSelecionado)?.nome || 'Empreendimento');

    // Se tiver anexo, adicionar link no final da mensagem SOMENTE SE solicitado
    if (includeAttachmentLink && template.arquivo_url) {
      msg += `\n\n📄 Anexo: ${template.arquivo_url}`;
    }

    return encodeURIComponent(msg);
  };

  const getProcessedSubject = (templateId: string) => {
    const template = templatesDisponiveis.find(t => t.id === templateId);
    return template?.assunto ? encodeURIComponent(template.assunto) : '';
  };

  const salvarMetas = () => {
    localStorage.setItem('meta_ligacoes_diarias', metaLigacoes.toString());
    setShowMetasDialog(false);
    toast({
      title: "Metas salvas",
      description: "Suas metas diárias foram atualizadas."
    });
  };

  useEffect(() => {
    if (mailingSelecionado) {
      carregarContatos(mailingSelecionado);
    }
  }, [mailingSelecionado]);

  // Função para garantir atualização visual das listas
  const atualizarContagemListaLocal = (listaId: string, novoTotal: number) => {
    setListas(prevListas =>
      prevListas.map(lista =>
        lista.id === listaId
          ? { ...lista, total_contatos: novoTotal }
          : lista
      )
    );
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar listas de contatos
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: listasData, error: listasError } = await supabase
        .from('listas_contatos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (listasError) throw listasError;

      // Carregar empreendimentos
      const { data: empData, error: empError } = await supabase
        .from('empreendimentos')
        .select('id, nome, cidade, status')
        .select('id, nome, cidade, status')
        //.eq('status', 'Ativo') // Removendo filtro para garantir que carregue tudo por enquanto
        .eq('user_id', user?.id)
        .order('nome');

      console.log('Empreendimentos carregados:', empData);

      if (empError) throw empError;

      setListas(listasData || []);
      setEmpreendimentos(empData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar listas de contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarContatos = async (listaId: string) => {
    try {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('lista_id', listaId)
        .order('nome');

      if (error) throw error;
      setContatos(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contatos da lista",
        variant: "destructive"
      });
    }
  };

  const handleSelecionarLista = (listaId: string) => {
    setListaSelecionada(listaId);
    carregarContatos(listaId);
  };

  const handleClassificarContato = (contato: Contato) => {
    setContatoSelecionado(contato);
    setClassificacaoSelecionada(contato.dados_extras?.classificacao || "");
    setInteresseCliente(contato.dados_extras?.interesse || "");
    setDescricaoCliente(contato.dados_extras?.descricao || "");
    setShowClientData(true);
  };

  const handleResetarProgresso = (listaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const progressKey = `oferta_ativa_progress_${listaId}`;
    localStorage.removeItem(progressKey);
    toast({
      title: "Progresso Resetado",
      description: "A oferta ativa desta lista começará do início na próxima vez.",
      duration: 3000
    });
  };


  const handleSolicitarOferta = async (listaId: string) => {
    // Prevent duplicate calls
    if (isRequestingOffer) {
      console.log('Request already in progress, ignoring duplicate call');
      return;
    }

    setIsRequestingOffer(true);

    try {
      console.log('Solicitando oferta para lista:', listaId);

      // Carregar todos os contatos da lista e selecionar o próximo não processado
      const { data: contatosData, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('lista_id', listaId)
        .order('nome');

      if (error) throw error;

      console.log('Contatos carregados:', contatosData);

      // Recuperar o último contato processado desta lista
      const progressKey = `oferta_ativa_progress_${listaId}`;
      const lastProcessedId = localStorage.getItem(progressKey);

      // Encontrar o índice do último contato processado/visualizado
      let startIndex = 0;
      if (lastProcessedId) {
        const lastIndex = (contatosData || []).findIndex((c: any) => c.id === lastProcessedId);
        if (lastIndex !== -1) {
          // IMPORTANTE: Começar do PRÓPRIO índice (inclusive) para verificar se ele ainda precisa ser processado.
          // Se já estiver processado (ex: salvo como Interessado), o loop vai pular ele.
          // Se estiver "Caixa Postal" ou sem status, ele será exibido novamente (o que é o desejado ao dar refresh).
          startIndex = lastIndex;
          console.log(`Continuando de onde parou. Último visualizado: índice ${lastIndex}, retomando busca do índice ${startIndex}`);
        }
      }

      // Buscar o próximo contato não processado a partir do ponto de parada
      let proximoContato = null;

      // Primeiro, procurar a partir do ponto de parada até o final
      for (let i = startIndex; i < (contatosData || []).length; i++) {
        const c = contatosData![i];
        const dx = c.dados_extras || {};
        // Se for o contato salvo E ele ainda é válido (não processado ou caixa postal), mostramos ele.
        // Se ele foi finalizado (ex: virou lead), dx.classificacao será 'Cliente Interessado' (se não deletado), então o if falha e vai pro próximo.
        if (!(dx.classificacao) || dx.classificacao === "Caixa Postal/Cliente Não Atendeu") {
          proximoContato = c;
          break;
        }
      }

      // Se não encontrou, fazer um loop completo do início (caso todos após o ponto de parada estejam processados)
      if (!proximoContato && startIndex > 0) {
        console.log('Não encontrou após o ponto de parada, verificando do início...');
        for (let i = 0; i < startIndex; i++) {
          const c = contatosData![i];
          const dx = c.dados_extras || {};
          if (!(dx.classificacao) || dx.classificacao === "Caixa Postal/Cliente Não Atendeu") {
            proximoContato = c;
            break;
          }
        }
      }

      console.log('Próximo contato encontrado:', proximoContato);

      if (proximoContato) {
        const contato = proximoContato;
        console.log('Dados do contato selecionado:', {
          nome: contato.nome,
          telefone: contato.telefone,
          email: contato.email,
          dados_extras: contato.dados_extras
        });

        setContatoSelecionado(contato);
        setMailingSelecionado(listaId);
        setListaSelecionada(listaId);
        setInteresseCliente((contato.dados_extras as any)?.interesse || "");
        setClassificacaoSelecionada((contato.dados_extras as any)?.classificacao || "");
        setDescricaoCliente((contato.dados_extras as any)?.descricao || "");
        setShowClientData(true);

        // Salvar progresso IMEDIATAMENTE ao exibir o contato
        // Isso garante que ao atualizar a página, continue de onde estava
        localStorage.setItem(progressKey, contato.id);
        console.log(`Progresso salvo ao exibir contato: ${contato.id} na lista ${listaId}`);
      } else {
        console.log('Nenhum contato não processado encontrado');
        setShowContatosEsgotados(true);
        // Limpar o progresso se não há mais contatos
        localStorage.removeItem(progressKey);
      }
    } catch (error) {
      console.error('Erro ao carregar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contato da lista",
        variant: "destructive"
      });
    } finally {
      setIsRequestingOffer(false);
    }
  };

  const salvarInteresseEClassificacao = async (continuarParaProximo = false, forcedClassification?: string) => {
    if (!contatoSelecionado) return;

    // Obter usuário atual para vincular o lead
    const { data: { user } } = await supabase.auth.getUser();

    // Não impedimos o processo se não tiver user (para update), mas para criar Lead é crítico.
    // O ideal é checar antes de criar o Lead.

    try {
      // Determinar interesse automaticamente baseado na classificação
      let interesseAutomatico = "";
      let dadosExtrasAtualizados: any = {
        ...(contatoSelecionado.dados_extras || {}),
        descricao: descricaoCliente
      };

      let finalClassificacao = forcedClassification || classificacaoSelecionada || contatoSelecionado.dados_extras?.classificacao;

      if (classificacaoSelecionada === "Cliente Interessado") {
        interesseAutomatico = "Tem Interesse";
        if (empreendimentoSelecionado) {
          dadosExtrasAtualizados.empreendimento_interesse = empreendimentoSelecionado;
        }
      } else if (classificacaoSelecionada === "Deny List" || classificacaoSelecionada === "Número não existe") {
        interesseAutomatico = "Não Quer Mais Contato";
      } else if (classificacaoSelecionada === "Caixa Postal/Cliente Não Atendeu") {
        interesseAutomatico = ""; // Não define interesse para permitir retorno à oferta ativa

        // Lógica de contador de tentativas
        const tentativasAtuais = (dadosExtrasAtualizados.tentativas_caixa_postal || 0) + 1;
        dadosExtrasAtualizados.tentativas_caixa_postal = tentativasAtuais;

        if (tentativasAtuais >= 8) {
          finalClassificacao = "Deny List"; // Força exclusão da lista após 8 tentativas
          interesseAutomatico = "Não Quer Mais Contato";
          toast({
            title: "Contato Excluído",
            description: "Contato atingiu o limite de 8 tentativas de Caixa Postal e foi movido para Deny List.",
            variant: "destructive"
          });
        }
      }

      // Se for Deny List, não faz update, pois vamos deletar logo abaixo (ou faz update antes de deletar se quiser manter histórico, mas 'exclusão' implica sumir)
      // Mas a lógica atual faz update primeiro. Vamos manter o update para garantir, e depois fazemos delete se for deny list?
      // Ou melhor: Só faz update se NÃO for Deny List. Se for Deny List, pulamos o update de classificação e vamos direto pro delete no bloco final.

      // Se formos deletar o contato (Deny List ou Cliente Interessado), não precisamos atualizar antes
      // Isso evita chamadas redundantes e possíveis conflitos
      const vaiDeletar = finalClassificacao === "Deny List" || finalClassificacao === "Cliente Interessado" || finalClassificacao === "Número não existe";

      if (!vaiDeletar) {
        const { error } = await supabase
          .from('contatos')
          .update({
            dados_extras: {
              ...dadosExtrasAtualizados,
              interesse: interesseAutomatico,
              classificacao: finalClassificacao
            }
          })
          .eq('id', contatoSelecionado.id);

        if (error) throw error;
      }

      // Registrar a ligação explicitamente para métricas do Relatório
      try {
        await supabase.from('ligacoes').insert({
          numero_telefone: formatPhoneNumber(contatoSelecionado.telefone) || contatoSelecionado.telefone,
          status: 'realizada',
          resultado: finalClassificacao || 'Processado',
          duracao: 0,
          data_ligacao: new Date().toISOString(),
          user_id: user?.id
        } as any);
        
        setLigacoesHoje(prev => prev + 1);
      } catch (err) {
        console.error("Erro ao registrar estatística de ligação:", err);
      }

      // Se cliente tem interesse, cadastrar como lead
      const temInteresse = interesseAutomatico === "Tem Interesse" ||
        finalClassificacao === "Cliente Interessado";

      console.log('Debug lead creation:', {
        interesseAutomatico,
        classificacaoSelecionada: finalClassificacao,
        temInteresse,
        contatoNome: contatoSelecionado.nome
      });

      if (temInteresse) {
        // Verificar se já existe um lead com este telefone
        const { data: leadExistente } = await supabase
          .from('leads')
          .select('id')
          .eq('telefone', contatoSelecionado.telefone)
          .maybeSingle();

        if (!leadExistente) {
          console.log('Criando novo lead para:', contatoSelecionado.nome);
          // Criar novo lead
          const observacoesLead = `Lead criado automaticamente através de oferta ativa. Classificação: ${classificacaoSelecionada || 'N/A'}${descricaoCliente ? `\n\nDescrição do interesse: ${descricaoCliente}` : ''}`;

          const { data: novoLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              nome: contatoSelecionado.nome,
              telefone: formatPhoneNumber(contatoSelecionado.telefone),
              email: contatoSelecionado.email,
              status: 'novo',
              origem: listas.find(l => l.id === mailingSelecionado)?.nome || 'Mailing',
              observacoes: observacoesLead,
              empreendimento_id: empreendimentoSelecionado || null,
              user_id: user?.id
            })
            .select()
            .single();

          if (leadError) {
            console.error('Erro ao criar lead:', leadError);
          } else {
            console.log('Lead criado com sucesso para:', contatoSelecionado.nome);

            // Adicionar entrada na timeline do lead
            try {
              const { error: timelineError } = await supabase
                .from('lead_timeline')
                .insert({
                  lead_id: novoLead.id,
                  type: 'note',
                  title: 'Observações iniciais',
                  description: observacoesLead,
                  author: 'Sistema'
                });

              if (timelineError) {
                console.error('Erro ao adicionar à timeline:', timelineError);
              } else {
                console.log('Timeline atualizada com sucesso para:', contatoSelecionado.nome);
              }
            } catch (timelineError) {
              console.error('Erro ao processar timeline:', timelineError);
            }

            toast({
              title: "Lead cadastrado!",
              description: `${contatoSelecionado.nome} foi cadastrado na aba de leads`,
              variant: "default"
            });
          }
        } else {
          console.log('Lead já existe para o telefone:', contatoSelecionado.telefone);
        }
      }

      // Atualizar estado local

      // LOGICA DE EXCLUSÃO SE FOR DENY LIST OU CLIENTE INTERESSADO
      // Se virou Lead (Interessado), sai do mailing. Se é Deny List, sai do mailing.
      if (vaiDeletar) {
        // 1. Excluir contato da tabela contatos
        const { error: deleteError } = await supabase
          .from('contatos')
          .delete()
          .eq('id', contatoSelecionado.id);

        if (deleteError) {
          console.error('Erro ao excluir contato:', deleteError);
          toast({ title: 'Erro', description: 'Erro ao remover contato da lista', variant: 'destructive' });
        } else {
          // 2. Decrementar contador da lista
          // Como não temos RPC fácil, vamos atualizar a lista localmente e no banco se possível
          // O mais seguro é pegar o valor atual da lista e subtrair 1

          // Atualizar estado local de contatos (remover)
          setContatos(prev => prev.filter(c => c.id !== contatoSelecionado.id));

          // Atualizar contagem na lista
          if (mailingSelecionado) {
            const { data: listaAtual } = await supabase.from('listas_contatos').select('total_contatos').eq('id', mailingSelecionado).single();
            if (listaAtual) {
              const novoTotal = Math.max(0, listaAtual.total_contatos - 1);
              await supabase.from('listas_contatos').update({ total_contatos: novoTotal }).eq('id', mailingSelecionado);

              // Atualizar estado local das listas usando a função auxiliar para garantir re-render
              atualizarContagemListaLocal(mailingSelecionado, novoTotal);
            }
          }

          toast({
            title: "Contato Processado",
            description: (finalClassificacao === "Deny List" || finalClassificacao === "Número não existe")
              ? "Contato removido da lista permanentemente."
              : "Contato promovido a LEAD e removido desta lista de mailing."
          });
        }

      } else {
        // Atualizar estado local apenas (não excluído)
        setContatos(contatos.map(c =>
          c.id === contatoSelecionado.id
            ? {
              ...c,
              dados_extras: {
                ...c.dados_extras,
                interesse: interesseAutomatico,
                classificacao: finalClassificacao
              }
            }
            : c
        ));

        toast({
          title: "Sucesso",
          description: "Classificação do cliente salva com sucesso!"
        });
      }

      // Limpar estados
      setInteresseCliente("");
      setClassificacaoSelecionada("");
      setDescricaoCliente("");

      // Salvar o progresso - marcar este contato como o último processado
      if (mailingSelecionado && contatoSelecionado) {
        const progressKey = `oferta_ativa_progress_${mailingSelecionado}`;
        localStorage.setItem(progressKey, contatoSelecionado.id);
        console.log(`Progresso salvo: ${contatoSelecionado.id} na lista ${mailingSelecionado}`);
      }

      if (continuarParaProximo) {
        // Carregar próximo contato automaticamente
        await carregarProximoContato(contatoSelecionado.id);
      } else {
        // Comportamento original - fechar aba
        setShowClientData(false);
        setContatoSelecionado(null);
      }

      // Verificar se ainda há contatos NÃO processados nesta lista
      if (mailingSelecionado) {
        const { data: todosDaLista, error: errorContatos } = await supabase
          .from('contatos')
          .select('id, dados_extras')
          .eq('lista_id', mailingSelecionado);

        if (!errorContatos) {
          const restantes = (todosDaLista || []).filter((c: any) => {
            const dx = c.dados_extras || {};
            // Contato não processado: sem classificação OU classificado como "Caixa Postal/Cliente Não Atendeu"
            return !(dx.classificacao) || dx.classificacao === "Caixa Postal/Cliente Não Atendeu";
          }).length;
          if (restantes === 0) {
            setShowContatosEsgotados(true);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao salvar classificação:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar classificação do cliente",
        variant: "destructive"
      });
    }
  };

  const carregarProximoContato = async (excludedId?: string) => {
    if (!mailingSelecionado) return;

    try {
      // Buscar contatos da mesma lista
      const { data: contatosData, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('lista_id', mailingSelecionado)
        .order('nome');

      if (error) throw error;

      const todosContatos = contatosData || [];
      if (todosContatos.length === 0) {
        setShowContatosEsgotados(true);
        return;
      }

      // Filtrar apenas os válidos (Novos ou Caixa Postal)
      const validos = todosContatos.filter(c => {
        const dx = c.dados_extras || {};
        // Ignorar se já for finalizado (ex: Deny List), embora a query traga tudo, precisamos filtrar os "aptos"
        // Mas como Deny List/Interessado são deletados, não devem vir.
        // Se houver algum resíduo com outra classificação, ignoramos.
        return !dx.classificacao || dx.classificacao === "Caixa Postal/Cliente Não Atendeu";
      });

      if (validos.length === 0) {
        setShowContatosEsgotados(true);
        return;
      }

      // Ordenar por prioridade:
      // 1. Novos (sem classificação)
      // 2. Menor número de tentativas
      const sorted = validos.sort((a, b) => {
        const da = a.dados_extras || {};
        const db = b.dados_extras || {};

        const aIsNew = !da.classificacao;
        const bIsNew = !db.classificacao;

        // Prioridade para Novos
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;

        // Se ambos forem Caixa Postal, priorizar quem tem MENOS tentativas (fila de espera)
        if (!aIsNew && !bIsNew) {
          const triesA = da.tentativas_caixa_postal || 0;
          const triesB = db.tentativas_caixa_postal || 0;
          return triesA - triesB; // Crescente: 1 tentativa vem antes de 2
        }

        return 0; // Mantém ordem alfabética original se empatar
      });

      // Selecionar o primeiro da fila
      // Se o primeiro FOR o que acabamos de excluir (único restante ou empate e ordenação n deve mudar?), tentamos pegar o próximo
      let proximoContato = sorted[0];

      if (excludedId && proximoContato.id === excludedId && sorted.length > 1) {
        proximoContato = sorted[1];
      } else if (excludedId && proximoContato.id === excludedId && sorted.length === 1) {
        // Se só sobrou ele mesmo... mantemos ele.
      }

      if (proximoContato) {
        setContatoSelecionado(proximoContato);
        setInteresseCliente((proximoContato.dados_extras as any)?.interesse || "");
        setClassificacaoSelecionada((proximoContato.dados_extras as any)?.classificacao || "");

        // Atualizar progresso no localStorage
        const progressKey = `oferta_ativa_progress_${mailingSelecionado}`;
        localStorage.setItem(progressKey, proximoContato.id);
        console.log(`Progresso atualizado (próximo): ${proximoContato.id} na lista ${mailingSelecionado}`);

      } else {
        // Não há mais contatos para processar
        setShowContatosEsgotados(true);
        setShowClientData(false);
        setContatoSelecionado(null);
      }
    } catch (error) {
      console.error('Erro ao carregar próximo contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar próximo contato",
        variant: "destructive"
      });
    }
  };

  const handleSalvarEProximo = async () => {
    if (!contatoSelecionado) return;

    try {
      // Lógica Inteligente:
      // 1. Se o usuário selecionou uma classificação (ex: "Cliente Interessado"), usamos ela.
      // 2. Se NÃO selecionou nada, assumimos que é "Caixa Postal/Cliente Não Atendeu" (Comportamento padrão de pular)
      const usarCaixaPostalDefault = !classificacaoSelecionada;
      const classificacaoFinal = usarCaixaPostalDefault ? "Caixa Postal/Cliente Não Atendeu" : undefined;

      // Sempre salvar a classificação/interesse automático antes
      const telefone = contatoSelecionado.telefone;

      // Se classificacaoFinal for undefined, a função salvarInteresseEClassificacao usará o state classificacaoSelecionada
      await salvarInteresseEClassificacao(true, classificacaoFinal);



      toast({
        title: "Sucesso",
        description: "Processado com sucesso!"
      });

    } catch (error) {
      console.error('Erro ao processar próximo:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar ação",
        variant: "destructive"
      });
    }
  };

  const enviarOfertaAtiva = async () => {
    if (!contatoSelecionado || !empreendimentoSelecionado) return;

    try {
      // Aqui você pode implementar a lógica para enviar a oferta
      // Por exemplo, criar uma entrada na tabela de ligações ou campanhas

      toast({
        title: "Sucesso",
        description: "Oferta enviada com sucesso!"
      });

      setShowOfertaAtiva(false);
      setContatoSelecionado(null);
      setEmpreendimentoSelecionado("");
    } catch (error) {
      console.error('Erro ao enviar oferta:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar oferta",
        variant: "destructive"
      });
    }
  };

  const getClassificacaoColor = (classificacao: string | null) => {
    if (!classificacao) return "bg-muted text-muted-foreground";

    switch (classificacao) {
      case "Cliente Interessado": return "bg-success text-success-foreground";
      case "Corretor de Imóvel": return "bg-primary text-primary-foreground";
      case "Caixa Postal/Cliente Não Atendeu": return "bg-warning text-warning-foreground";
      case "Deny List": return "bg-destructive text-destructive-foreground";
      default: return "bg-accent text-accent-foreground";
    }
  };

  const filteredContatos = contatos.filter(contato =>
    contato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contato.telefone.includes(searchTerm) ||
    (contato.email && contato.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando listas de contatos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestão de Contatos por Mailing</h2>
          <p className="text-muted-foreground">Visualize e classifique seus contatos organizados por campanhas de mailing</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-3 rounded-lg shadow-sm border min-w-[250px]">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground font-medium">Meta Diária</span>
              <span className="font-bold">{ligacoesHoje} / {metaLigacoes}</span>
            </div>
            <Progress value={Math.min((ligacoesHoje / metaLigacoes) * 100, 100)} className="h-2" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMetasDialog(true)} className="flex-shrink-0" title="Definir Metas">
            <Target className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Metas Dialog */}
      <Dialog open={showMetasDialog} onOpenChange={setShowMetasDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Metas Diárias</DialogTitle>
            <DialogDescription>
              Configure suas metas para acompanhar seu desempenho.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meta de Ligações (Diária)</Label>
              <Input 
                type="number" 
                value={metaLigacoes} 
                onChange={(e) => setMetaLigacoes(Number(e.target.value) || 0)} 
                min={1} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowMetasDialog(false)}>Cancelar</Button>
            <Button onClick={salvarMetas}>Salvar Metas</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {listas.map((lista) => (
          <Card
            key={lista.id}
            className={`cursor-pointer transition-all duration-300 hover:shadow-elegant ${listaSelecionada === lista.id ? 'ring-2 ring-primary shadow-elegant' : 'shadow-card'
              }`}
            onClick={() => handleSelecionarLista(lista.id)}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground flex-shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">{lista.nome}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">{lista.descricao}</p>
                    <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                      <span className="text-muted-foreground">
                        {lista.total_contatos} contatos
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {lista.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 text-xs sm:text-sm"
                    disabled={isRequestingOffer}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSolicitarOferta(lista.id);
                    }}
                  >
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    {isRequestingOffer ? 'Carregando...' : 'Solicitar Oferta'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm px-2"
                    title="Resetar progresso e começar do início"
                    onClick={(e) => handleResetarProgresso(lista.id, e)}
                  >
                    <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>



      {/* Dialog - Dados do Cliente */}
      <Dialog open={showClientData} onOpenChange={setShowClientData}>
        <DialogContent className="max-w-5xl w-[95%] sm:w-full max-h-[98dvh] overflow-y-auto p-3 sm:p-6 gap-3 sm:gap-4">
          <DialogHeader>
            <DialogTitle className="sr-only">Dados do Cliente</DialogTitle>
            <DialogDescription className="sr-only">
              Visualizar e classificar informações do cliente selecionado
            </DialogDescription>
          </DialogHeader>
          {contatoSelecionado && (
            <div className="space-y-3 sm:space-y-6 animate-fade-in">
              {/* Header with Campaign Name and Progress */}
              <div className="flex flex-col sm:flex-row justify-between items-center border-b border-border pb-4 gap-4">
                <h2 className="text-base sm:text-lg font-semibold text-muted-foreground uppercase tracking-wider">
                  {listas.find(l => l.id === mailingSelecionado)?.nome || 'CAMPANHA OFICIAL'}
                </h2>
                
                {/* Progresso de Metas no Modal */}
                <div className="flex flex-col gap-1 w-full sm:w-48 bg-muted/30 p-2 rounded-md">
                  <div className="flex justify-between text-xs text-muted-foreground font-medium">
                    <span>Meta Diária</span>
                    <span>{ligacoesHoje} / {metaLigacoes}</span>
                  </div>
                  <Progress value={Math.min((ligacoesHoje / metaLigacoes) * 100, 100)} className="h-1.5" />
                </div>
              </div>

              {/* Customer Name and Classification Row */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                {/* Customer Info */}
                <div className="text-center lg:text-left flex-1">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    {extractDataFromImportedFormat(contatoSelecionado, listas.find(l => l.id === listaSelecionada)).nome}
                  </h1>
                  <p className="text-sm text-muted-foreground mb-4">
                    Dados importados do mailing - Linha {contatoSelecionado.dados_extras?.linha_original || 'N/A'}
                  </p>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-muted/20 rounded-lg border border-border/30">
                    {/* Telefone */}
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono">
                        {formatPhoneNumber(extractDataFromImportedFormat(contatoSelecionado, listas.find(l => l.id === listaSelecionada)).telefone)}
                      </span>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono break-all">
                        {extractDataFromImportedFormat(contatoSelecionado, listas.find(l => l.id === listaSelecionada)).email || 'Não informado'}
                      </span>
                    </div>

                    {/* Lista de origem */}
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {listas.find(l => l.id === listaSelecionada)?.nome || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions with Templates */}
                  <div className="flex flex-col gap-3 justify-center md:justify-start mt-2 p-3 bg-muted/10 rounded-md border border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações Rápidas</span>

                    {/* WhatsApp Action */}
                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-green-500/30 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 w-full xl:w-auto flex-shrink-0"
                        onClick={async () => {
                          const dados = extractDataFromImportedFormat(contatoSelecionado, listas.find(l => l.id === listaSelecionada));
                          const tel = dados.telefone.replace(/\D/g, '');
                          if (tel) {
                            // Processar mensagem
                            let rawMsg = decodeURIComponent(getProcessedMessage(templateWhatsappId, contatoSelecionado, false));
                            const template = templatesDisponiveis.find(t => t.id === templateWhatsappId);

                            // Se tiver anexo, verificar se é imagem/GIF para copiar
                            if (template?.arquivo_url) {
                              const isGif = template.arquivo_url.match(/\.gif$/i) != null;
                              const isImage = template.arquivo_url.match(/\.(jpeg|jpg|png|webp)$/i) != null;

                              if (isGif) {
                                // GIFs não podem ser copiados via Clipboard API (limitação do navegador)
                                // Mostrar toast informando que o link está disponível
                                toast({
                                  title: "GIF Detectado! 🎞️",
                                  description: "O link do GIF está na mensagem. Clique no link para abrir e arrastar para o WhatsApp, ou use Ctrl+V para colar o link.",
                                  duration: 6000,
                                  className: "bg-blue-50 border-blue-200"
                                });
                              } else if (isImage) {
                                // Copiar imagem estática para clipboard
                                try {
                                  toast({ title: "Preparando imagem...", description: "Baixando imagem para área de transferência..." });
                                  const response = await fetch(template.arquivo_url);
                                  const blob = await response.blob();

                                  // Verificar se o tipo é suportado
                                  if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/jpg' || blob.type === 'image/webp') {
                                    await navigator.clipboard.write([
                                      new ClipboardItem({
                                        [blob.type]: blob
                                      })
                                    ]);
                                    toast({
                                      title: "Imagem Copiada! 📷",
                                      description: "A imagem está na sua área de transferência. Basta pressionar CTRL+V na conversa do WhatsApp.",
                                      duration: 6000,
                                      className: "bg-green-50 border-green-200"
                                    });
                                  } else {
                                    throw new Error("Tipo de imagem não suportado");
                                  }
                                } catch (err) {
                                  console.error("Erro ao copiar imagem:", err);
                                  toast({
                                    title: "Link Disponível",
                                    description: "Use o link na mensagem para enviar a imagem.",
                                    variant: "default"
                                  });
                                }
                              }

                              // Adicionar link no texto (backup)
                              if (rawMsg) rawMsg += "\n\n";
                              rawMsg += `📄 Anexo: ${template.arquivo_url}`;
                            } else if (!rawMsg && template?.arquivo_url) {
                              rawMsg = `📄 Anexo: ${template.arquivo_url}`;
                            }

                            // Copiar mensagem de texto para clipboard
                            try {
                              await navigator.clipboard.writeText(rawMsg);
                            } catch (e) {
                              console.error("Erro ao copiar texto:", e);
                            }

                            // Abrir WhatsApp com o texto completo
                            const finalEncodedMsg = encodeURIComponent(rawMsg);
                            const url = `https://web.whatsapp.com/send?phone=55${tel}${finalEncodedMsg ? `&text=${finalEncodedMsg}` : ''}`;

                            setTimeout(() => {
                              window.open(url, '_blank');
                            }, 500);
                          } else {
                            toast({ title: "Erro", description: "Telefone não disponível", variant: "destructive" });
                          }
                        }}
                      >
                        <MessageSquare className="w-3 h-3 mr-1.5" />
                        WhatsApp
                      </Button>

                      <Select
                        value={templateWhatsappId}
                        onValueChange={(val) => handleSetDefaultTemplate('whatsapp', val)}
                      >
                        <SelectTrigger className="w-full xl:w-[180px] h-8 text-xs bg-background">
                          <SelectValue placeholder="Selecione Template" />
                        </SelectTrigger>
                        <SelectContent className="z-[60]" position="popper">
                          <SelectItem value="none">Sem template (Padrão)</SelectItem>
                          {templatesDisponiveis.filter(t => t.tipo === 'whatsapp').map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Email Action */}
                    <div className="flex flex-col gap-2 p-2 bg-blue-50/50 rounded border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30">
                      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2">
                        <Select
                          value={selectedGmailAccount}
                          onValueChange={(val) => {
                            setSelectedGmailAccount(val);
                            localStorage.setItem('default_gmail_account_ligacoes', val);
                          }}
                        >
                          <SelectTrigger className="w-full xl:w-[220px] h-8 text-xs bg-background">
                            <SelectValue placeholder="Selecione conta de envio..." />
                          </SelectTrigger>
                          <SelectContent className="z-[60]" position="popper">
                            {gmailAccounts.length === 0 && <SelectItem value="none" disabled>Nenhuma conta ativa</SelectItem>}
                            {gmailAccounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 w-full xl:w-auto flex-shrink-0"
                          onClick={async () => {
                            const dados = extractDataFromImportedFormat(contatoSelecionado, listas.find(l => l.id === listaSelecionada));
                            if (!dados.email || !dados.email.includes('@')) {
                              toast({ title: "Erro", description: "Email do cliente não disponível", variant: "destructive" });
                              return;
                            }

                            const template = templatesDisponiveis.find(t => t.id === templateEmailId);
                            const fromAccount = gmailAccounts.find(a => a.id === selectedGmailAccount);

                            // Se tiver conta selecionada e backend estiver pronto (simulado aqui), enviaria direto
                            // Por enquanto, manteremos mailto como fallback se não houver backend de disparo direto conectado nesta tela,
                            // mas a estrutura visual já está pronta.
                            // Vamos simular um disparo "real" se tiver conta.

                            if (fromAccount && template) {
                              toast({ title: "Processando...", description: "Preparando envio pelo sistema..." });

                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) throw new Error("Usuário não autenticado");

                                // 1. Tentar inserir na fila de envio
                                // Nota: Se 'campanha_id' for obrigatório no banco, isso pode falhar se passarmos null.
                                // Vamos tentar passar null primeiro. Se falhar, avisamos.
                                const { error: queueError } = await supabase
                                  .from('email_queue')
                                  .insert({
                                    user_id: user.id,
                                    // campanha_id: null, // Tentar null ou omitir se for opcional
                                    recipient_email: dados.email,
                                    recipient_name: dados.nome,
                                    subject: template.assunto ? template.assunto.replace(/{{nome}}/g, dados.nome || '') : 'Sem assunto',
                                    // O corpo precisa ser decodificado pois getProcessedMessage retorna URI encoded para mailto
                                    // Passamos false para não incluir o link no corpo, pois enviaremos como anexo
                                    body: decodeURIComponent(getProcessedMessage(templateEmailId, contatoSelecionado, false)),
                                    gmail_account_id: fromAccount.id,
                                    status: 'pending',
                                    created_at: new Date().toISOString(),
                                    attachments: template.arquivo_url ? [{
                                      filename: template.arquivo_nome || 'anexo',
                                      path: template.arquivo_url
                                    }] : []
                                  });

                                if (queueError) {
                                  console.error("Erro ao inserir na fila:", queueError);
                                  throw queueError;
                                }

                                // 2. Tentar acordar o dispatcher (opcional, mas bom pra envio imediato)
                                supabase.functions.invoke('gmail-dispatcher', {
                                  body: { action: 'process_queue' }
                                }).catch(err => console.warn("Dispatcher trigger failed", err));

                                toast({
                                  title: "Email na Fila!",
                                  description: `O email foi agendado para envio usando ${fromAccount.email}.`
                                });
                                return;

                              } catch (e: any) {
                                console.error("Falha no envio via sistema, usando fallback mailto", e);
                                toast({
                                  title: "Erro no envio automático",
                                  description: "Abrindo seu cliente de email padrão como fallback.",
                                  variant: "destructive"
                                });
                                // Fallback continua abaixo...
                              }
                            }

                            // Fallback Mailto
                            const subject = getProcessedSubject(templateEmailId);
                            const body = getProcessedMessage(templateEmailId, contatoSelecionado);
                            const mailtoUrl = `mailto:${dados.email}?subject=${subject}&body=${body}`;
                            window.open(mailtoUrl, '_blank');


                          }}
                        >
                          <Mail className="w-3 h-3 mr-1.5" />
                          Enviar Email
                        </Button>

                        <Select
                          value={templateEmailId}
                          onValueChange={(val) => handleSetDefaultTemplate('email', val)}
                        >
                          <SelectTrigger className="w-full lg:w-[180px] h-8 text-xs bg-background">
                            <SelectValue placeholder="Selecione Template" />
                          </SelectTrigger>
                          <SelectContent className="z-[60]" position="popper">
                            <SelectItem value="none">Sem template (Padrão)</SelectItem>
                            {templatesDisponiveis.filter(t => t.tipo === 'email').map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>


                  </div>

                  {/* Current Classification Badge */}
                  <div className="mt-3 space-y-2">
                    <span className="text-xs text-muted-foreground block mb-1">Classificação Atual:</span>
                    <Badge
                      className={`${getClassificacaoColor(contatoSelecionado.dados_extras?.classificacao)} text-xs`}
                    >
                      {contatoSelecionado.dados_extras?.classificacao || 'Não Classificado'}
                    </Badge>

                    {/* Contador de Tentativas de Caixa Postal */}
                    {(contatoSelecionado.dados_extras?.tentativas_caixa_postal || 0) > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground block mb-1">Tentativas de Caixa Postal:</span>
                        <Badge
                          className={`text-xs ${(contatoSelecionado.dados_extras?.tentativas_caixa_postal || 0) >= 7
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : (contatoSelecionado.dados_extras?.tentativas_caixa_postal || 0) >= 4
                              ? 'bg-orange-100 text-orange-700 border-orange-300'
                              : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                            }`}
                        >
                          {contatoSelecionado.dados_extras?.tentativas_caixa_postal || 0}x
                          {(contatoSelecionado.dados_extras?.tentativas_caixa_postal || 0) >= 7 && ' ⚠️ Próximo será Deny List'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Classification Section - Moved up */}
                <div className="lg:w-96 space-y-3 sm:space-y-4 p-3 sm:p-4 rounded-lg bg-gradient-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Classificação do Cliente</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Classificação</Label>
                      <Select value={classificacaoSelecionada} onValueChange={setClassificacaoSelecionada}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione uma classificação" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {classificacoes.map((classificacao) => (
                            <SelectItem
                              key={classificacao}
                              value={classificacao}
                              className="hover:bg-accent hover:text-accent-foreground"
                            >
                              {classificacao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Empreendimento - aparece apenas quando cliente tem interesse */}
                    {(classificacaoSelecionada === "Cliente Interessado") && (
                      <div className="space-y-4 pt-2 border-t border-border mt-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Empreendimento de Interesse</Label>
                          <Select value={empreendimentoSelecionado} onValueChange={setEmpreendimentoSelecionado}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione um empreendimento" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {empreendimentos.map((emp) => (
                                <SelectItem
                                  key={emp.id}
                                  value={emp.id}
                                  className="hover:bg-accent hover:text-accent-foreground"
                                >
                                  {emp.nome} ({emp.cidade})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Notas da Oferta Ativa (Sempre Visível) */}
                    <div className="space-y-2 pt-4 border-t border-border mt-4">
                      <Label className="text-sm font-medium">Notas / Anotações</Label>
                      <textarea
                        value={descricaoCliente}
                        onChange={(e) => setDescricaoCliente(e.target.value)}
                        placeholder="Adicione observações sobre a ligação, interesse do cliente, detalhes, etc..."
                        className="w-full min-h-[80px] p-3 text-sm border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {descricaoCliente.length}/500 caracteres
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 rounded-full bg-muted hover:bg-muted/80 transition-all duration-300 hover-scale"
                  onClick={() => salvarInteresseEClassificacao(false)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  SALVAR E SAIR DA OFERTA
                </Button>
                <Button
                  size="lg"
                  className="flex-1 rounded-full bg-success hover:bg-success/90 text-success-foreground transition-all duration-300 hover-scale"
                  onClick={handleSalvarEProximo}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  SALVAR E SOLICITAR NOVA OFERTA
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog - Contatos Esgotados */}
      <Dialog open={showContatosEsgotados} onOpenChange={setShowContatosEsgotados}>
        <DialogContent className="max-w-md w-full mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Oferta ativa esgotada
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Todos os contatos da oferta ativa já foram processados.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-6 p-4">
            <div className="mx-auto w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-warning" />
            </div>

            <p className="text-sm text-muted-foreground">
              Selecione outra lista para continuar enviando ofertas.
            </p>

            <Button
              onClick={() => setShowContatosEsgotados(false)}
              className="w-full"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}