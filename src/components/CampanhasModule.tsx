import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAutoTTS } from "@/hooks/useAutoTTS";
import { CallAutomationEngine } from "@/components/CallAutomationEngine";
import {
  Plus,
  Play,
  Pause,
  Square,
  Settings,
  BarChart3,
  Clock,
  Users,
  Phone,
  TrendingUp,
  Megaphone,
  Volume2,
  Trash2,
  HelpCircle,
  Shield,
  Download,
  Loader2,
  Library,
  Wifi
} from "lucide-react";

export function CampanhasModule() {
  const { toast } = useToast();
  const [selectedCampanha, setSelectedCampanha] = useState<any>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isNewCampanhaDialogOpen, setIsNewCampanhaDialogOpen] = useState(false);
  const [isRelatorioDialogOpen, setIsRelatorioDialogOpen] = useState(false);
  const [campanhaRelatorio, setCampanhaRelatorio] = useState<any>(null);

  // Estados para dados reais
  const [campanhasReais, setCampanhasReais] = useState<any[]>([]);
  const [empreendimentosReais, setEmpreendimentosReais] = useState<any[]>([]);
  const [listasContatos, setListasContatos] = useState<any[]>([]);
  const [statsReais, setStatsReais] = useState({
    campanhasAtivas: 0,
    leadsEmCampanhas: 0,
    ligacoesRealizadas: 0,
    conversoes: 0
  });
  const [loading, setLoading] = useState(true);
  const [piperEndpoint, setPiperEndpoint] = useState(() => {
    return localStorage.getItem('piperEndpoint') || "https://5b1bba496c80.ngrok-free.app";
  });

  const autoTTS = useAutoTTS({
    piperEndpoint,
    enableAudio: true
  });
  const [configData, setConfigData] = useState({
    nome: "",
    empreendimento: "",
    baseMailing: "",
    audioPrincipal: "",
    perguntasRespostas: [] as { pergunta: string; resposta: string; palavrasChave: string; nomeInteracao: string; leadInteressado: boolean }[]
  });
  const [newCampanhaData, setNewCampanhaData] = useState({
    nome: "",
    empreendimento: "",
    baseMailing: "",
    audioPrincipal: "",
    perguntasRespostas: [] as { pergunta: string; resposta: string; palavrasChave: string; nomeInteracao: string; leadInteressado: boolean }[]
  });
  const [audioUrls, setAudioUrls] = useState<{ [key: string]: string }>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<{ [key: string]: boolean }>({});
  const [selectedVoices, setSelectedVoices] = useState<{ [key: string]: string }>({});
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [availableAudios, setAvailableAudios] = useState<any[]>([]);
  const [campanhaExecutando, setCampanhaExecutando] = useState<string | null>(null);
  const [contatosParaCampanha, setContatosParaCampanha] = useState<any[]>([]);
  const [resultadosLigacoes, setResultadosLigacoes] = useState<any[]>([]);
  const [taskerConfig] = useState({
    ip: "192.168.1.100",
    porta: "1821",
    ngrok_url: "5b1bba496c80.ngrok-free.app",
    status: "Conectado"
  });

  // Carregar vozes disponíveis
  useEffect(() => {
    const carregarVozes = async () => {
      try {
        // Buscar vozes da biblioteca
        const audiosStorage = localStorage.getItem('audioLibrary');
        if (audiosStorage) {
          setAvailableAudios(JSON.parse(audiosStorage));
        }

        // Buscar vozes do Piper
        const response = await fetch(`${piperEndpoint}/voices`);
        if (response.ok) {
          const voices = await response.json();
          setAvailableVoices(voices);
        }
      } catch (error) {
        // Usar vozes padrão se não conseguir conectar
        setAvailableVoices([
          { id: 'pt_BR-faber-medium', name: 'Faber (Português BR - Médio)' },
          { id: 'pt_BR-cadu-medium', name: 'Cadu (Português BR - Médio)' },
          { id: 'pt_BR-jeff-medium', name: 'Jeff (Português BR - Médio)' }
        ]);
      }
    };

    carregarVozes();
  }, [piperEndpoint]);

  // Carregar dados reais do Supabase
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar campanhas reais
        const { data: campanhasData, error: campanhasError } = await supabase
          .from('campanhas')
          .select(`
            *,
            empreendimento:empreendimentos(nome)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (campanhasError) {
          console.error('Erro ao carregar campanhas:', campanhasError);
        } else {
          setCampanhasReais(campanhasData || []);
        }

        // Buscar empreendimentos reais
        const { data: empreendimentosData, error: empreendimentosError } = await supabase
          .from('empreendimentos')
          .select('*')
          .eq('user_id', user.id)
          .order('nome');

        if (empreendimentosError) {
          console.error('Erro ao carregar empreendimentos:', empreendimentosError);
        } else {
          console.log('Empreendimentos carregados:', empreendimentosData);
          setEmpreendimentosReais(empreendimentosData || []);
        }

        // Buscar listas de contatos reais
        const { data: listasData, error: listasError } = await supabase
          .from('listas_contatos')
          .select('*')
          .eq('status', 'Ativa')
          .eq('user_id', user.id)
          .order('nome');

        if (listasError) {
          console.error('Erro ao carregar listas de contatos:', listasError);
        } else {
          console.log('Listas de contatos carregadas:', listasData);
          setListasContatos(listasData || []);
        }

        // Buscar ligações para estatísticas
        const { data: ligacoesData, error: ligacoesError } = await supabase
          .from('ligacoes')
          .select('status, resultado')
          .eq('user_id', user.id);

        let ligacoesRealizadas = 0;
        let conversoes = 0;

        if (!ligacoesError && ligacoesData) {
          ligacoesRealizadas = ligacoesData.length;
          conversoes = ligacoesData.filter(ligacao =>
            ligacao.resultado === 'interessado' || ligacao.resultado === 'convertido'
          ).length;
        }

        // Calcular estatísticas reais
        const campanhasAtivas = (campanhasData || []).filter(campanha =>
          campanha.status === 'ativa'
        ).length;

        // Para leads em campanhas, vamos contar todos os leads por enquanto
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id);

        setStatsReais({
          campanhasAtivas,
          leadsEmCampanhas: leadsData?.length || 0,
          ligacoesRealizadas,
          conversoes
        });

      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados das campanhas.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativa": return "bg-success text-success-foreground";
      case "Pausada": return "bg-warning text-warning-foreground";
      case "Agendada": return "bg-primary text-primary-foreground";
      case "Finalizada": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusAction = (status: string, campanha: any) => {
    const isExecutando = campanhaExecutando === campanha.id;

    switch (status) {
      case "ativa":
        return isExecutando ? (
          <Button variant="destructive" size="sm" onClick={() => handlePausarCampanha(campanha.id)}>
            <Pause className="w-4 h-4 mr-1" />
            Pausar
          </Button>
        ) : (
          <Button variant="success" size="sm" onClick={() => handleIniciarCampanha(campanha)}>
            <Play className="w-4 h-4 mr-1" />
            Executar
          </Button>
        );
      case "rascunho":
        return (
          <Button variant="outline" size="sm" onClick={() => handleConfigureCampanha(campanha)}>
            <Settings className="w-4 h-4 mr-1" />
            Configurar
          </Button>
        );
      default:
        return (
          <Button variant="ghost" size="sm" onClick={() => handleConfigureCampanha(campanha)}>
            <Settings className="w-4 h-4" />
          </Button>
        );
    }
  };

  const handleIniciarCampanha = async (campanha: any) => {
    setCampanhaExecutando(campanha.id);
    setResultadosLigacoes([]);

    try {
      // Buscar contatos reais da lista de mailing associada à campanha
      const { data: contatos, error } = await supabase
        .from('contatos')
        .select(`
          id,
          nome,
          telefone,
          email,
          lista_id,
          listas_contatos!inner(nome, status)
        `)
        .eq('listas_contatos.status', 'Ativa')
        .eq('status', 'ativo');

      if (error) {
        console.error('Erro ao buscar contatos:', error);
        toast({
          title: "❌ Erro",
          description: "Erro ao buscar contatos para a campanha",
          variant: "destructive"
        });
        return;
      }

      if (!contatos || contatos.length === 0) {
        toast({
          title: "⚠️ Sem Contatos",
          description: "Nenhum contato ativo encontrado nas listas de mailing",
          variant: "destructive"
        });
        return;
      }

      // Mapear contatos para formato esperado pelo motor de automação
      const contatosFormatados = contatos.map(contato => ({
        id: contato.id,
        nome: contato.nome,
        telefone: contato.telefone,
        email: contato.email,
        lista_id: contato.lista_id
      }));

      setContatosParaCampanha(contatosFormatados);

      toast({
        title: "🚀 Campanha Iniciada",
        description: `Executando "${campanha.nome}" com ${contatosFormatados.length} contatos reais do mailing`,
      });
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast({
        title: "❌ Erro",
        description: "Erro inesperado ao iniciar campanha",
        variant: "destructive"
      });
    }
  };

  const handleLigacaoCompleted = async (resultado: any) => {
    const resultadoCompleto = {
      ...resultado,
      campanha: campanhasReais.find(c => c.id === campanhaExecutando)?.nome
    };

    setResultadosLigacoes(prev => [...prev, resultadoCompleto]);

    // Criar lead na base de dados se a ligação foi bem-sucedida
    try {
      const campanhaAtual = campanhasReais.find(c => c.id === campanhaExecutando);

      if (resultado.contato && campanhaAtual) {
        // Registrar a ligação na tabela ligacoes
        const { data: ligacaoData, error: ligacaoError } = await supabase
          .from('ligacoes')
          .insert({
            numero_telefone: resultado.telefone,
            status: resultado.status === 'erro' ? 'falhou' : 'concluida',
            resultado: resultado.interacao,
            transcricao: resultado.transcricao,
            duracao: resultado.duracao || 0
          })
          .select()
          .single();

        if (ligacaoError) {
          console.error('Erro ao salvar ligação:', ligacaoError);
        }

        // Se o lead demonstrou interesse, criar/atualizar na tabela leads
        if (resultado.leadInteressado && resultado.status !== 'erro') {
          const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .insert({
              nome: resultado.contato,
              telefone: resultado.telefone,
              email: resultado.email,
              empreendimento_id: campanhaAtual.empreendimento_id,
              origem: `Campanha: ${campanhaAtual.nome}`,
              status: 'interessado',
              observacoes: `Ligação automática - ${resultado.interacao}\nTranscrição: ${resultado.transcricao}`,
              data_contato: new Date().toISOString()
            })
            .select()
            .single();

          if (leadError) {
            console.error('Erro ao criar lead:', leadError);
            toast({
              title: "⚠️ Aviso",
              description: "Ligação concluída, mas erro ao salvar lead na base de dados",
              variant: "destructive"
            });
          } else {
            toast({
              title: "✅ Lead criado!",
              description: `${resultado.contato} registrado como interessado`,
              variant: "default"
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao processar resultado da ligação:', error);
    }
  };

  const handlePausarCampanha = (campanhaId: string) => {
    setCampanhaExecutando(null);
    setContatosParaCampanha([]);

    toast({
      title: "⏸️ Campanha Pausada",
      description: "Execução interrompida",
      variant: "default"
    });
  };

  const handleConfigureCampanha = (campanha: any) => {
    setSelectedCampanha(campanha);

    // Carregar dados existentes da campanha
    const conteudo = campanha.conteudo || {};
    setConfigData({
      nome: campanha.nome || "",
      empreendimento: campanha.empreendimento_id || "",
      baseMailing: conteudo.baseMailing || "",
      audioPrincipal: conteudo.audioPrincipal || "",
      perguntasRespostas: conteudo.perguntasRespostas || []
    });

    // Carregar URLs de áudio existentes
    if (conteudo.audioUrls) {
      setAudioUrls(conteudo.audioUrls);
    }

    setIsConfigDialogOpen(true);
  };

  const handleViewRelatorio = (campanha: any) => {
    setCampanhaRelatorio(campanha);
    setIsRelatorioDialogOpen(true);
  };

  const handlePararCampanha = (campanha: any) => {
    toast({
      title: "Campanha Parada",
      description: `A campanha "${campanha.nome}" foi parada com sucesso.`,
      variant: "destructive"
    });
    console.log('Parando campanha:', campanha.nome);
  };

  const handleSaveConfig = async () => {
    if (!selectedCampanha) return;

    try {
      const { error } = await supabase
        .from('campanhas')
        .update({
          nome: configData.nome,
          conteudo: {
            baseMailing: configData.baseMailing,
            audioPrincipal: configData.audioPrincipal,
            perguntasRespostas: configData.perguntasRespostas,
            audioUrls: audioUrls
          }
        })
        .eq('id', selectedCampanha.id);

      if (error) throw error;

      // Atualizar a lista local
      setCampanhasReais(prev =>
        prev.map(campanha =>
          campanha.id === selectedCampanha.id
            ? { ...campanha, nome: configData.nome, conteudo: { baseMailing: configData.baseMailing, audioPrincipal: configData.audioPrincipal, perguntasRespostas: configData.perguntasRespostas, audioUrls: audioUrls } }
            : campanha
        )
      );

      toast({
        title: "Configurações salvas!",
        description: `A campanha "${configData.nome}" foi atualizada com sucesso.`,
      });
      setIsConfigDialogOpen(false);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleCreateNewCampanha = () => {
    setNewCampanhaData({
      nome: "",
      empreendimento: "",
      baseMailing: "",
      audioPrincipal: "",
      perguntasRespostas: []
    });
    setIsNewCampanhaDialogOpen(true);
  };

  const addPerguntaRespostaConfig = () => {
    setConfigData({
      ...configData,
      perguntasRespostas: [...configData.perguntasRespostas, { pergunta: "", resposta: "", palavrasChave: "", nomeInteracao: "", leadInteressado: false }]
    });
  };

  const removePerguntaRespostaConfig = (index: number) => {
    const updated = configData.perguntasRespostas.filter((_, i) => i !== index);
    setConfigData({ ...configData, perguntasRespostas: updated });
  };

  const updatePerguntaRespostaConfig = (index: number, field: "pergunta" | "resposta" | "palavrasChave" | "nomeInteracao" | "leadInteressado", value: string | boolean) => {
    const updated = configData.perguntasRespostas.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setConfigData({ ...configData, perguntasRespostas: updated });
  };


  const addPerguntaResposta = () => {
    setNewCampanhaData({
      ...newCampanhaData,
      perguntasRespostas: [...newCampanhaData.perguntasRespostas, { pergunta: "", resposta: "", palavrasChave: "", nomeInteracao: "", leadInteressado: false }]
    });
  };

  const removePerguntaResposta = (index: number) => {
    const updated = newCampanhaData.perguntasRespostas.filter((_, i) => i !== index);
    setNewCampanhaData({ ...newCampanhaData, perguntasRespostas: updated });
  };

  const updatePerguntaResposta = (index: number, field: "pergunta" | "resposta" | "palavrasChave" | "nomeInteracao" | "leadInteressado", value: string | boolean) => {
    const updated = newCampanhaData.perguntasRespostas.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setNewCampanhaData({ ...newCampanhaData, perguntasRespostas: updated });
  };




  const generateAudio = async (text: string, key: string) => {
    if (!text.trim()) {
      toast({
        title: "Texto necessário",
        description: "Por favor, digite um texto antes de gerar o áudio.",
        variant: "destructive"
      });
      return;
    }

    const selectedVoice = selectedVoices[key] || availableVoices[0]?.id;
    if (!selectedVoice) {
      toast({
        title: "Voz não selecionada",
        description: "Por favor, selecione uma voz antes de gerar o áudio.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAudio({ ...isGeneratingAudio, [key]: true });

    try {
      // Verificar se o servidor Piper está acessível primeiro
      toast({
        title: "Conectando ao servidor...",
        description: `Tentando conectar em ${piperEndpoint}`
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const statusResponse = await fetch(`${piperEndpoint}/status`, {
        signal: controller.signal,
        method: 'GET'
      });

      clearTimeout(timeoutId);

      if (!statusResponse.ok) {
        throw new Error(`Servidor Piper retornou status ${statusResponse.status}`);
      }

      // Usar o autoTTS com tratamento de erro melhorado
      const response = await autoTTS.generateResponseWithAudio(text);

      if (response.audio_url) {
        // Fazer download e salvar no Supabase Storage
        try {
          const audioResponse = await fetch(response.audio_url);
          const audioBlob = await audioResponse.blob();
          const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;

          const { data: storageData, error: storageError } = await supabase.storage
            .from('audios')
            .upload(fileName, audioBlob, {
              contentType: 'audio/wav'
            });

          if (storageError) throw storageError;

          const { data: { publicUrl } } = supabase.storage
            .from('audios')
            .getPublicUrl(fileName);

          setAudioUrls({ ...audioUrls, [key]: publicUrl });

          // Salvar a voz na tabela vozes do Supabase com URL permanente
          await supabase
            .from('vozes')
            .insert([{
              nome: `Voz gerada - ${new Date().toLocaleString('pt-BR')}`,
              tipo: 'sintetica',
              arquivo_url: publicUrl,
              configuracoes: {
                texto_original: text,
                voz_utilizada: selectedVoice,
                piper_endpoint: piperEndpoint,
                gerada_em: new Date().toISOString(),
                contexto: key.includes('principal') ? 'Audio Principal' : 'Resposta Automatica'
              },
              ativa: true
            }]);

        } catch (storageError) {
          console.error('Erro ao salvar no storage:', storageError);
          // Fallback para URL original se storage falhar
          setAudioUrls({ ...audioUrls, [key]: response.audio_url });
        }

        toast({
          title: "✅ Áudio gerado com sucesso!",
          description: `Áudio criado usando Piper TTS e salvo na biblioteca`,
        });
      } else {
        throw new Error("Resposta vazia do servidor de TTS");
      }
    } catch (error: any) {
      console.error('Erro ao gerar áudio:', error);

      let errorMessage = "Verifique a configuração do servidor.";
      let errorTitle = "Erro ao gerar áudio";

      if (error.name === 'AbortError') {
        errorTitle = "Timeout na conexão";
        errorMessage = "O servidor demorou muito para responder. Verifique se a URL está correta.";
      } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        errorTitle = "Não foi possível conectar";
        errorMessage = `Servidor Piper inacessível em ${piperEndpoint}. Verifique se o servidor está rodando e a URL está correta.`;
      } else if (error.message.includes("Unexpected token")) {
        errorTitle = "Resposta inválida do servidor";
        errorMessage = "O servidor retornou HTML ao invés de JSON. Verifique se a URL do Piper está correta.";
      } else if (error.message.includes("status")) {
        errorTitle = "Erro do servidor";
        errorMessage = `Servidor Piper retornou erro: ${error.message}`;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAudio({ ...isGeneratingAudio, [key]: false });
    }
  };

  const useExistingAudio = async (audioUrl: string, key: string) => {
    setAudioUrls({ ...audioUrls, [key]: audioUrl });

    // Buscar informações do áudio na biblioteca local para melhor contexto
    const audioStorage = localStorage.getItem('audioLibrary');
    let audioInfo = null;
    if (audioStorage) {
      const audios = JSON.parse(audioStorage);
      audioInfo = audios.find((audio: any) => audio.audio_url === audioUrl);
    }

    // Salvar referência na tabela vozes se não existir
    try {
      const { data: existingVoz } = await supabase
        .from('vozes')
        .select('id')
        .eq('arquivo_url', audioUrl)
        .single();

      if (!existingVoz) {
        await supabase
          .from('vozes')
          .insert([{
            nome: audioInfo?.texto ? `${audioInfo.texto.substring(0, 50)}...` : `Voz reutilizada - ${new Date().toLocaleString('pt-BR')}`,
            tipo: 'sintetica',
            arquivo_url: audioUrl,
            configuracoes: {
              reutilizada_em: new Date().toISOString(),
              contexto: key.includes('principal') ? 'Audio Principal' : 'Resposta Automatica',
              fonte: 'biblioteca_local'
            },
            ativa: true
          }]);
      }
    } catch (error) {
      console.error('Erro ao salvar referência da voz:', error);
    }

    toast({
      title: "Áudio selecionado!",
      description: "Áudio da biblioteca adicionado com sucesso.",
    });
  };

  const handleSaveNewCampanha = async () => {
    if (!newCampanhaData.nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe um nome para a campanha.",
        variant: "destructive"
      });
      return;
    }

    if (!newCampanhaData.empreendimento) {
      toast({
        title: "Empreendimento obrigatório",
        description: "Por favor, selecione um empreendimento para a campanha.",
        variant: "destructive"
      });
      return;
    }

    try {
      const campanhaData = {
        nome: newCampanhaData.nome,
        empreendimento_id: newCampanhaData.empreendimento,
        tipo: 'ligacao',
        status: 'rascunho',
        descricao: `Campanha criada para ${empreendimentosReais.find(e => e.id === newCampanhaData.empreendimento)?.nome || ''}`,
        conteudo: {
          baseMailing: newCampanhaData.baseMailing,
          audioPrincipal: newCampanhaData.audioPrincipal,
          perguntasRespostas: newCampanhaData.perguntasRespostas,
          audioUrls: audioUrls
        }
      };

      const { data, error } = await supabase
        .from('campanhas')
        .insert([campanhaData])
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista de campanhas
      setCampanhasReais(prev => [data, ...prev]);

      toast({
        title: "Nova campanha criada!",
        description: `A campanha "${newCampanhaData.nome}" foi criada com sucesso.`,
      });

      setIsNewCampanhaDialogOpen(false);

      // Limpar formulário
      setNewCampanhaData({
        nome: "",
        empreendimento: "",
        baseMailing: "",
        audioPrincipal: "",
        perguntasRespostas: []
      });
      setAudioUrls({});
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast({
        title: "Erro ao criar campanha",
        description: "Não foi possível salvar a campanha. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const gerarRelatorioCompleto = () => {
    if (!campanhaRelatorio) return;

    const relatorioData = {
      campanha: campanhaRelatorio.nome,
      periodo: "Janeiro 2024",
      totalLeads: campanhaRelatorio.totalLeads,
      contatados: campanhaRelatorio.contatados,
      interessados: campanhaRelatorio.interessados,
      conversoes: campanhaRelatorio.conversoes,
      taxaContato: ((campanhaRelatorio.contatados / campanhaRelatorio.totalLeads) * 100).toFixed(1),
      taxaInteresse: ((campanhaRelatorio.interessados / campanhaRelatorio.contatados) * 100).toFixed(1),
      taxaConversao: ((campanhaRelatorio.conversoes / campanhaRelatorio.interessados) * 100).toFixed(1),
      tempoMedioLigacao: "2min 34s",
      melhorHorario: "14h - 16h",
      diasMaisEfetivos: "Terça e Quinta",
      custoPorLead: "R$ 12,50",
      custoAquisicao: "R$ 285,00",
      retornoInvestimento: "340%"
    };

    // Simular geração de relatório
    toast({
      title: "Gerando relatório...",
      description: "Processando dados da campanha...",
    });

    setTimeout(() => {
      toast({
        title: "Relatório gerado com sucesso!",
        description: "O relatório detalhado foi gerado e está pronto para download.",
      });

      // Simular download do relatório
      const dataStr = JSON.stringify(relatorioData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_${campanhaRelatorio.nome.replace(/\s+/g, '_')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Campanhas Ativas</h2>
          <p className="text-muted-foreground">Gerencie suas campanhas de ligações automáticas</p>
        </div>
        <Button variant="hero" className="shadow-elegant" onClick={handleCreateNewCampanha}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : statsReais.campanhasAtivas}
                </div>
                <div className="text-sm text-muted-foreground">Campanhas Ativas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-accent text-accent-foreground">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : statsReais.leadsEmCampanhas}
                </div>
                <div className="text-sm text-muted-foreground">Leads em Campanhas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success text-success-foreground">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : statsReais.ligacoesRealizadas}
                </div>
                <div className="text-sm text-muted-foreground">Ligações Realizadas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning text-warning-foreground">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : statsReais.conversoes}
                </div>
                <div className="text-sm text-muted-foreground">Conversões</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">Carregando campanhas...</div>
            </CardContent>
          </Card>
        ) : campanhasReais.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground mb-4">Nenhuma campanha encontrada</div>
              <Button variant="hero" onClick={handleCreateNewCampanha}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          campanhasReais.map((campanha) => (
            <Card key={campanha.id} className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{campanha.nome}</CardTitle>
                    <p className="text-muted-foreground mt-1">
                      {campanha.empreendimento?.nome || 'Sem empreendimento'} • Criada em {new Date(campanha.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(campanha.status)}>
                      {campanha.status}
                    </Badge>
                    {getStatusAction(campanha.status, campanha)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progresso da Campanha</span>
                    <span className="font-medium">{campanha.contatados}/{campanha.totalLeads} contatos</span>
                  </div>
                  <Progress value={(campanha.contatados / campanha.totalLeads) * 100} className="h-2" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-gradient-card">
                    <div className="text-2xl font-bold text-primary">{campanha.totalLeads}</div>
                    <div className="text-sm text-muted-foreground">Total Leads</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gradient-card">
                    <div className="text-2xl font-bold text-accent">{campanha.contatados}</div>
                    <div className="text-sm text-muted-foreground">Contatados</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gradient-card">
                    <div className="text-2xl font-bold text-success">{campanha.interessados}</div>
                    <div className="text-sm text-muted-foreground">Interessados</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gradient-card">
                    <div className="text-2xl font-bold text-warning">{campanha.conversoes}</div>
                    <div className="text-sm text-muted-foreground">Conversões</div>
                  </div>
                </div>

                {/* Campaign Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="font-medium">{campanha.status || 'Rascunho'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Tipo</div>
                      <div className="font-medium">{campanha.tipo || 'Email'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Período</div>
                      <div className="font-medium">
                        {campanha.data_inicio && campanha.data_fim
                          ? `${new Date(campanha.data_inicio).toLocaleDateString('pt-BR')} - ${new Date(campanha.data_fim).toLocaleDateString('pt-BR')}`
                          : 'Não definido'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfigureCampanha(campanha)}
                    className="flex-1"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleViewRelatorio(campanha)}
                    className="flex-1"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Relatório
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleIniciarCampanha(campanha)}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePausarCampanha(campanha)}
                    className="flex-1"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pausar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handlePararCampanha(campanha)}
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Parar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Configurar Campanha</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="ligacoes">Ligações</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="config-nome">Nome da Campanha</Label>
                <Input
                  id="config-nome"
                  value={configData.nome}
                  onChange={(e) => setConfigData({ ...configData, nome: e.target.value })}
                  placeholder="Nome da campanha"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="config-empreendimento">Empreendimento</Label>
                <Select value={configData.empreendimento} onValueChange={(value) => setConfigData({ ...configData, empreendimento: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o empreendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {empreendimentosReais.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="config-baseMailing">Base de Mailing</Label>
                <Select value={configData.baseMailing} onValueChange={(value) => setConfigData({ ...configData, baseMailing: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a base de mailing" />
                  </SelectTrigger>
                  <SelectContent>
                    {listasContatos.map((lista) => (
                      <SelectItem key={lista.id} value={lista.nome}>
                        {lista.nome} - {lista.total_contatos} contatos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="ligacoes" className="space-y-4 mt-4">
              {/* Configuração do Servidor Piper */}
              <Card className="p-4 bg-muted/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Servidor Piper TTS</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(`${piperEndpoint}/status`);
                          toast({
                            title: response.ok ? "Servidor conectado!" : "Servidor offline",
                            description: response.ok ? "Piper TTS está funcionando" : "Verifique a URL do servidor",
                            variant: response.ok ? "default" : "destructive"
                          });
                        } catch (error) {
                          toast({
                            title: "Erro de conexão",
                            description: "Não foi possível conectar ao servidor Piper",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <Wifi className="w-4 h-4 mr-2" />
                      Testar Conexão
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>URL do Servidor Piper</Label>
                    <Input
                      value={piperEndpoint}
                      onChange={(e) => {
                        const newEndpoint = e.target.value;
                        setPiperEndpoint(newEndpoint);
                        localStorage.setItem('piperEndpoint', newEndpoint);
                      }}
                      placeholder="https://seu-servidor-piper.ngrok-free.app"
                    />
                    <p className="text-xs text-muted-foreground">
                      Configure o servidor Piper TTS para geração de áudio. URL atual: {piperEndpoint}
                    </p>
                  </div>
                </div>
              </Card>
              {/* Áudio Principal */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Áudio Principal</h3>
                    <div className="flex gap-2">
                      <Select
                        value={selectedVoices["config-audio-principal"] || ""}
                        onValueChange={(value) => setSelectedVoices({ ...selectedVoices, "config-audio-principal": value })}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecionar voz" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAudio(configData.audioPrincipal || "", "config-audio-principal")}
                        disabled={!configData.audioPrincipal || isGeneratingAudio["config-audio-principal"]}
                      >
                        {isGeneratingAudio["config-audio-principal"] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Volume2 className="w-4 h-4 mr-2" />
                        )}
                        {isGeneratingAudio["config-audio-principal"] ? "Gerando..." : "Gerar Áudio"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do áudio principal da ligação</Label>
                    <Textarea
                      value={configData.audioPrincipal || ""}
                      onChange={(e) => setConfigData({ ...configData, audioPrincipal: e.target.value })}
                      placeholder="Ex: Olá, meu nome é João e estou ligando da Construtora XYZ. Estou entrando em contato para falar sobre o nosso novo empreendimento..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  {audioUrls["config-audio-principal"] && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Volume2 className="w-4 h-4 text-success" />
                      <span className="text-sm">Áudio disponível</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          try {
                            const audio = new Audio(audioUrls["config-audio-principal"]);
                            audio.play().catch(err => {
                              console.error('Erro ao reproduzir áudio:', err);
                              toast({
                                title: "Erro na reprodução",
                                description: "Não foi possível reproduzir o áudio",
                                variant: "destructive"
                              });
                            });
                          } catch (error) {
                            console.error('Erro ao criar objeto de áudio:', error);
                          }
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = audioUrls["config-audio-principal"];
                          a.download = "audio-principal.mp3";
                          a.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Perguntas com Palavras-chave */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Perguntas e Palavras-chave</h3>
                    <p className="text-sm text-muted-foreground">Configure perguntas com palavras-chave que ativam essas respostas</p>
                  </div>
                  <Button variant="outline" onClick={addPerguntaRespostaConfig}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Pergunta
                  </Button>
                </div>

                {configData.perguntasRespostas.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Pergunta {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePerguntaRespostaConfig(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome da Interação (Identificador nos relatórios)</Label>
                          <Input
                            value={item.nomeInteracao || ""}
                            onChange={(e) => updatePerguntaRespostaConfig(index, "nomeInteracao", e.target.value)}
                            placeholder="Ex: Pergunta sobre preço"
                          />
                          <p className="text-xs text-muted-foreground">
                            Nome que irá identificar esta interação nos relatórios
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Leads gerados nesta interação são considerados interessados?</Label>
                          <Select
                            value={item.leadInteressado ? "sim" : "nao"}
                            onValueChange={(value) => updatePerguntaRespostaConfig(index, "leadInteressado", value === "sim")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma opção" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Sim</SelectItem>
                              <SelectItem value="nao">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Palavras-chave (separadas por vírgula)</Label>
                        <Input
                          value={item.palavrasChave || ""}
                          onChange={(e) => updatePerguntaRespostaConfig(index, "palavrasChave", e.target.value)}
                          placeholder="Ex: preço, valor, custo, quanto custa"
                        />
                        <p className="text-xs text-muted-foreground">
                          Quando o cliente mencionar alguma dessas palavras, a resposta abaixo será ativada
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Resposta automática</Label>
                          <div className="flex gap-2">
                            <Select
                              value={selectedVoices[`config-resposta-${index}`] || ""}
                              onValueChange={(value) => setSelectedVoices({ ...selectedVoices, [`config-resposta-${index}`]: value })}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Voz" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVoices.map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateAudio(item.resposta, `config-resposta-${index}`)}
                              disabled={!item.resposta || isGeneratingAudio[`config-resposta-${index}`]}
                            >
                              {isGeneratingAudio[`config-resposta-${index}`] ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Volume2 className="w-4 h-4 mr-2" />
                              )}
                              {isGeneratingAudio[`config-resposta-${index}`] ? "Gerando..." : "Gerar"}
                            </Button>
                            {availableAudios.length > 0 && (
                              <Select
                                onValueChange={(value) => useExistingAudio(value, `config-resposta-${index}`)}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="Usar existente" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableAudios.map((audio) => (
                                    <SelectItem key={audio.id} value={audio.audio_url}>
                                      <div className="flex items-center gap-2">
                                        <Library className="w-3 h-3" />
                                        {audio.texto.substring(0, 30)}...
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                        <Textarea
                          value={item.resposta}
                          onChange={(e) => updatePerguntaRespostaConfig(index, "resposta", e.target.value)}
                          placeholder="Ex: Os valores dos nossos imóveis variam de R$ 250.000 a R$ 350.000, dependendo do tipo de unidade e andar..."
                          rows={3}
                          className="resize-none"
                        />
                        {audioUrls[`config-resposta-${index}`] && (
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                            <Volume2 className="w-4 h-4 text-success" />
                            <span className="text-sm">Áudio disponível</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                try {
                                  const audio = new Audio(audioUrls[`config-resposta-${index}`]);
                                  audio.play().catch(err => {
                                    console.error('Erro ao reproduzir áudio:', err);
                                    toast({
                                      title: "Erro na reprodução",
                                      description: "Não foi possível reproduzir o áudio",
                                      variant: "destructive"
                                    });
                                  });
                                } catch (error) {
                                  console.error('Erro ao criar objeto de áudio:', error);
                                }
                              }}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = audioUrls[`config-resposta-${index}`];
                                a.download = `resposta-${index + 1}.mp3`;
                                a.click();
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {configData.perguntasRespostas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma pergunta configurada</p>
                    <p className="text-sm">Adicione perguntas com palavras-chave para automatizar as respostas</p>
                  </div>
                )}
              </div>
            </TabsContent>

          </Tabs>

          <div className="flex gap-2 pt-4 mt-6 border-t border-border">
            <Button onClick={handleSaveConfig} className="flex-1">
              Salvar Configurações
            </Button>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Campaign Dialog */}
      <Dialog open={isNewCampanhaDialogOpen} onOpenChange={setIsNewCampanhaDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Campanha</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="ligacoes">Ligações</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new-nome">Nome da Campanha</Label>
                <Input
                  id="new-nome"
                  value={newCampanhaData.nome}
                  onChange={(e) => setNewCampanhaData({ ...newCampanhaData, nome: e.target.value })}
                  placeholder="Ex: Residencial Aurora - Pré-lançamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-empreendimento">Empreendimento</Label>
                <Select value={newCampanhaData.empreendimento} onValueChange={(value) => setNewCampanhaData({ ...newCampanhaData, empreendimento: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o empreendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {empreendimentosReais.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-baseMailing">Base de Mailing</Label>
                <Select value={newCampanhaData.baseMailing} onValueChange={(value) => setNewCampanhaData({ ...newCampanhaData, baseMailing: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a base de mailing" />
                  </SelectTrigger>
                  <SelectContent>
                    {listasContatos.map((lista) => (
                      <SelectItem key={lista.id} value={lista.nome}>
                        {lista.nome} - {lista.total_contatos} contatos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="ligacoes" className="space-y-4 mt-4">
              {/* Áudio Principal */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Áudio Principal</h3>
                    <div className="flex gap-2">
                      <Select
                        value={selectedVoices["new-audio-principal"] || ""}
                        onValueChange={(value) => setSelectedVoices({ ...selectedVoices, "new-audio-principal": value })}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecionar voz" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAudio(newCampanhaData.audioPrincipal || "", "new-audio-principal")}
                        disabled={!newCampanhaData.audioPrincipal || isGeneratingAudio["new-audio-principal"]}
                      >
                        {isGeneratingAudio["new-audio-principal"] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Volume2 className="w-4 h-4 mr-2" />
                        )}
                        {isGeneratingAudio["new-audio-principal"] ? "Gerando..." : "Gerar Áudio"}
                      </Button>
                      {availableAudios.length > 0 && (
                        <Select
                          onValueChange={(value) => useExistingAudio(value, "new-audio-principal")}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Usar áudio existente" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAudios.map((audio) => (
                              <SelectItem key={audio.id} value={audio.audio_url}>
                                <div className="flex items-center gap-2">
                                  <Library className="w-3 h-3" />
                                  {audio.texto.substring(0, 30)}...
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do áudio principal da ligação</Label>
                    <Textarea
                      value={newCampanhaData.audioPrincipal || ""}
                      onChange={(e) => setNewCampanhaData({ ...newCampanhaData, audioPrincipal: e.target.value })}
                      placeholder="Ex: Olá, meu nome é João e estou ligando da Construtora XYZ. Estou entrando em contato para falar sobre o nosso novo empreendimento..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  {audioUrls["new-audio-principal"] && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Volume2 className="w-4 h-4 text-success" />
                      <span className="text-sm">Áudio disponível</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          try {
                            const audio = new Audio(audioUrls["new-audio-principal"]);
                            audio.play().catch(err => {
                              console.error('Erro ao reproduzir áudio:', err);
                              toast({
                                title: "Erro na reprodução",
                                description: "Não foi possível reproduzir o áudio",
                                variant: "destructive"
                              });
                            });
                          } catch (error) {
                            console.error('Erro ao criar objeto de áudio:', error);
                          }
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = audioUrls["new-audio-principal"];
                          a.download = "audio-principal.mp3";
                          a.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Perguntas com Palavras-chave */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Perguntas e Palavras-chave</h3>
                    <p className="text-sm text-muted-foreground">Configure perguntas com palavras-chave que ativam essas respostas</p>
                  </div>
                  <Button variant="outline" onClick={addPerguntaResposta}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Pergunta
                  </Button>
                </div>

                {newCampanhaData.perguntasRespostas.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Pergunta {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePerguntaResposta(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome da Interação (Identificador nos relatórios)</Label>
                          <Input
                            value={item.nomeInteracao || ""}
                            onChange={(e) => updatePerguntaResposta(index, "nomeInteracao", e.target.value)}
                            placeholder="Ex: Pergunta sobre preço"
                          />
                          <p className="text-xs text-muted-foreground">
                            Nome que irá identificar esta interação nos relatórios
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Leads gerados nesta interação são considerados interessados?</Label>
                          <Select
                            value={item.leadInteressado ? "sim" : "nao"}
                            onValueChange={(value) => updatePerguntaResposta(index, "leadInteressado", value === "sim")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma opção" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Sim</SelectItem>
                              <SelectItem value="nao">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Palavras-chave (separadas por vírgula)</Label>
                        <Input
                          value={item.palavrasChave || ""}
                          onChange={(e) => updatePerguntaResposta(index, "palavrasChave", e.target.value)}
                          placeholder="Ex: preço, valor, custo, quanto custa"
                        />
                        <p className="text-xs text-muted-foreground">
                          Quando o cliente mencionar alguma dessas palavras, a resposta abaixo será ativada
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Resposta automática</Label>
                          <div className="flex gap-2">
                            <Select
                              value={selectedVoices[`new-resposta-${index}`] || ""}
                              onValueChange={(value) => setSelectedVoices({ ...selectedVoices, [`new-resposta-${index}`]: value })}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Voz" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVoices.map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateAudio(item.resposta, `new-resposta-${index}`)}
                              disabled={!item.resposta || isGeneratingAudio[`new-resposta-${index}`]}
                            >
                              {isGeneratingAudio[`new-resposta-${index}`] ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Volume2 className="w-4 h-4 mr-2" />
                              )}
                              {isGeneratingAudio[`new-resposta-${index}`] ? "Gerando..." : "Gerar"}
                            </Button>
                            {availableAudios.length > 0 && (
                              <Select
                                onValueChange={(value) => useExistingAudio(value, `new-resposta-${index}`)}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="Usar existente" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableAudios.map((audio) => (
                                    <SelectItem key={audio.id} value={audio.audio_url}>
                                      <div className="flex items-center gap-2">
                                        <Library className="w-3 h-3" />
                                        {audio.texto.substring(0, 30)}...
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                        <Textarea
                          value={item.resposta}
                          onChange={(e) => updatePerguntaResposta(index, "resposta", e.target.value)}
                          placeholder="Ex: Os valores dos nossos imóveis variam de R$ 250.000 a R$ 350.000, dependendo do tipo de unidade e andar..."
                          rows={3}
                          className="resize-none"
                        />
                        {audioUrls[`new-resposta-${index}`] && (
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                            <Volume2 className="w-4 h-4 text-success" />
                            <span className="text-sm">Áudio disponível</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                try {
                                  const audio = new Audio(audioUrls[`new-resposta-${index}`]);
                                  audio.play().catch(err => {
                                    console.error('Erro ao reproduzir áudio:', err);
                                    toast({
                                      title: "Erro na reprodução",
                                      description: "Não foi possível reproduzir o áudio",
                                      variant: "destructive"
                                    });
                                  });
                                } catch (error) {
                                  console.error('Erro ao criar objeto de áudio:', error);
                                }
                              }}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = audioUrls[`new-resposta-${index}`];
                                a.download = `resposta-${index + 1}.mp3`;
                                a.click();
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {newCampanhaData.perguntasRespostas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma pergunta configurada</p>
                    <p className="text-sm">Adicione perguntas com palavras-chave para automatizar as respostas</p>
                  </div>
                )}
              </div>
            </TabsContent>


          </Tabs>

          <div className="flex gap-2 pt-4 mt-6 border-t border-border">
            <Button onClick={handleSaveNewCampanha} className="flex-1">
              Criar Campanha
            </Button>
            <Button variant="outline" onClick={() => setIsNewCampanhaDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Relatório Detalhado Dialog */}
      <Dialog open={isRelatorioDialogOpen} onOpenChange={setIsRelatorioDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[1000px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Relatório Detalhado - {campanhaRelatorio?.nome}</DialogTitle>
          </DialogHeader>

          {campanhaRelatorio && (
            <div className="space-y-6">
              {/* Resumo Executivo */}
              <div className="p-6 bg-gradient-card rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Resumo Executivo</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{campanhaRelatorio.totalLeads}</div>
                    <div className="text-sm text-muted-foreground">Total de Leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{campanhaRelatorio.contatados}</div>
                    <div className="text-sm text-muted-foreground">Contatados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">{campanhaRelatorio.interessados}</div>
                    <div className="text-sm text-muted-foreground">Interessados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">{campanhaRelatorio.conversoes}</div>
                    <div className="text-sm text-muted-foreground">Conversões</div>
                  </div>
                </div>
              </div>

              {/* Métricas de Performance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Taxa de Conversão</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Taxa de Contato</span>
                          <span>{((campanhaRelatorio.contatados / campanhaRelatorio.totalLeads) * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={(campanhaRelatorio.contatados / campanhaRelatorio.totalLeads) * 100} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Taxa de Interesse</span>
                          <span>{((campanhaRelatorio.interessados / campanhaRelatorio.contatados) * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={(campanhaRelatorio.interessados / campanhaRelatorio.contatados) * 100} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Taxa de Conversão</span>
                          <span>{((campanhaRelatorio.conversoes / campanhaRelatorio.interessados) * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={(campanhaRelatorio.conversoes / campanhaRelatorio.interessados) * 100} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Análise Temporal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tempo Médio de Ligação:</span>
                        <span className="font-medium">2min 34s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Melhor Horário:</span>
                        <span className="font-medium">14h - 16h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dias Mais Efetivos:</span>
                        <span className="font-medium">Terça e Quinta</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total de Ligações:</span>
                        <span className="font-medium">{campanhaRelatorio.contatados + 45}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Análise Financeira */}
              <Card>
                <CardHeader>
                  <CardTitle>Análise Financeira</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-gradient-card rounded-lg">
                      <div className="text-xl font-bold text-primary">R$ 12,50</div>
                      <div className="text-sm text-muted-foreground">Custo por Lead</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-card rounded-lg">
                      <div className="text-xl font-bold text-success">R$ 285,00</div>
                      <div className="text-sm text-muted-foreground">Custo de Aquisição</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-card rounded-lg">
                      <div className="text-xl font-bold text-accent">340%</div>
                      <div className="text-sm text-muted-foreground">ROI Estimado</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detalhamento por Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Não Contatados</h4>
                        <div className="text-2xl font-bold text-muted-foreground">
                          {campanhaRelatorio.totalLeads - campanhaRelatorio.contatados}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {(((campanhaRelatorio.totalLeads - campanhaRelatorio.contatados) / campanhaRelatorio.totalLeads) * 100).toFixed(1)}% do total
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Sem Interesse</h4>
                        <div className="text-2xl font-bold text-destructive">
                          {campanhaRelatorio.contatados - campanhaRelatorio.interessados}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {(((campanhaRelatorio.contatados - campanhaRelatorio.interessados) / campanhaRelatorio.contatados) * 100).toFixed(1)}% dos contatados
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recomendações */}
              <Card>
                <CardHeader>
                  <CardTitle>Recomendações de Otimização</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-success mt-0.5" />
                      <div>
                        <div className="font-medium">Horário de Pico</div>
                        <div className="text-sm text-muted-foreground">
                          Concentre mais ligações entre 14h-16h para melhorar a taxa de contato
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Users className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Segmentação</div>
                        <div className="text-sm text-muted-foreground">
                          Considere segmentar a base para personalizar melhor o script
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Phone className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <div className="font-medium">Follow-up</div>
                        <div className="text-sm text-muted-foreground">
                          Implemente uma estratégia de re-contato para leads não atendidos
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Separator />

          <div className="flex gap-3 pt-4">
            <Button onClick={gerarRelatorioCompleto} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Exportar Relatório Completo
            </Button>
            <Button variant="outline" onClick={() => setIsRelatorioDialogOpen(false)} className="flex-1">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Motor de Ligação Automática */}
      {campanhaExecutando && contatosParaCampanha.length > 0 && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto">
            <CallAutomationEngine
              campanha={{
                id: campanhaExecutando,
                nome: campanhasReais.find(c => c.id === campanhaExecutando)?.nome || "Campanha",
                audioPrincipal: campanhasReais.find(c => c.id === campanhaExecutando)?.conteudo?.audioPrincipal || "Áudio principal da campanha",
                audioPrincipalUrl: campanhasReais.find(c => c.id === campanhaExecutando)?.conteudo?.audioUrls?.["config-audio-principal"] || "",
                perguntasRespostas: campanhasReais.find(c => c.id === campanhaExecutando)?.conteudo?.perguntasRespostas || [],
                empreendimento_id: campanhasReais.find(c => c.id === campanhaExecutando)?.empreendimento_id || "",
                audioUrls: campanhasReais.find(c => c.id === campanhaExecutando)?.conteudo?.audioUrls || {}
              }}
              contatos={contatosParaCampanha}
              onLigacaoCompleted={handleLigacaoCompleted}
              onClose={() => setCampanhaExecutando(null)}
              taskerConfig={taskerConfig}
            />
            <div className="mt-4 flex justify-center">
              <Button
                variant="destructive"
                onClick={() => handlePausarCampanha(campanhaExecutando)}
              >
                <Pause className="w-4 h-4 mr-2" />
                Parar Campanha
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resultados das Ligações */}
      {resultadosLigacoes.length > 0 && (
        <Card className="shadow-card mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Resultados das Ligações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resultadosLigacoes.map((resultado, index) => (
                <div key={index} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{resultado.contato} - {resultado.numero}</span>
                    <Badge className={resultado.status === 'interessado' ? 'bg-success text-success-foreground' :
                      resultado.status === 'erro' ? 'bg-destructive text-destructive-foreground' :
                        'bg-secondary text-secondary-foreground'}>
                      {resultado.interacao}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Resposta detectada: "{resultado.resposta_detectada}"</div>
                    <div>Data/Hora: {resultado.data_hora}</div>
                    {resultado.palavras_chave_ativadas && (
                      <div>Palavras-chave: {resultado.palavras_chave_ativadas}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
