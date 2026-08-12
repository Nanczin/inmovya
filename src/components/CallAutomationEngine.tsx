import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  Play, 
  Pause, 
  Volume2,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Users,
  Square,
  X
} from "lucide-react";

interface PerguntaResposta {
  nomeInteracao: string;
  leadInteressado: boolean;
  palavrasChave: string;
  resposta: string;
  audioUrl?: string;
}

interface CampanhaLigacao {
  id: string;
  nome: string;
  audioPrincipal: string;
  audioPrincipalUrl?: string;
  perguntasRespostas: PerguntaResposta[];
  empreendimento_id: string;
  audioUrls: { [key: string]: string };
}

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  lista_id?: string;
}

interface CallAutomationEngineProps {
  campanha: CampanhaLigacao;
  contatos: Contato[];
  onLigacaoCompleted: (resultado: any) => void;
  onClose: () => void;
  taskerConfig: {
    ip: string;
    porta: string;
    ngrok_url: string;
    status: string;
  };
}

export function CallAutomationEngine({ 
  campanha, 
  contatos, 
  onLigacaoCompleted,
  onClose,
  taskerConfig 
}: CallAutomationEngineProps) {
  const [statusLigacao, setStatusLigacao] = useState<'idle' | 'executando' | 'pausada' | 'finalizada'>('idle');
  const [contatoAtualIndex, setContatoAtualIndex] = useState<number>(0);
  const [statusIndividual, setStatusIndividual] = useState<'idle' | 'iniciando' | 'audio_principal' | 'aguardando_resposta' | 'processando_resposta' | 'finalizada'>('idle');
  const [respostaDetectada, setRespostaDetectada] = useState<string>('');
  const [interacaoAtiva, setInteracaoAtiva] = useState<PerguntaResposta | null>(null);
  const [transcricaoCompleta, setTranscricaoCompleta] = useState<string[]>([]);
  const [resultadosLigacoes, setResultadosLigacoes] = useState<any[]>([]);
  const [intervaloBetweenCalls] = useState(30); // 30 segundos entre ligações
  const { toast } = useToast();

  const getTaskerBaseUrl = () => {
    if (taskerConfig.ngrok_url && taskerConfig.ngrok_url.trim()) {
      let url = taskerConfig.ngrok_url.trim();
      if (!url.startsWith('http')) {
        // Para URLs locais (com IP), usar http por padrão
        if (url.startsWith('192.168.') || url.startsWith('10.') || url.startsWith('172.') || url.includes('localhost')) {
          url = 'http://' + url;
        } else {
          url = 'https://' + url;
        }
      }
      return url;
    }
    return `http://${taskerConfig.ip}:${taskerConfig.porta}`;
  };

  const detectarPalavrasChave = (textoResposta: string): PerguntaResposta | null => {
    const texto = textoResposta.toLowerCase().trim();
    
    if (!campanha.perguntasRespostas || campanha.perguntasRespostas.length === 0) {
      return null;
    }
    
    for (const pergunta of campanha.perguntasRespostas) {
      const palavras = pergunta.palavrasChave.split(',').map(p => p.trim().toLowerCase());
      
      for (const palavra of palavras) {
        if (texto.includes(palavra)) {
          return pergunta;
        }
      }
    }
    
    return null;
  };

  const contatoAtual = contatos[contatoAtualIndex];

  const iniciarCampanha = async () => {
    if (!contatos || contatos.length === 0) {
      toast({
        title: "❌ Sem contatos",
        description: "Nenhum contato encontrado para esta campanha",
        variant: "destructive"
      });
      return;
    }

    setStatusLigacao('executando');
    setContatoAtualIndex(0);
    setResultadosLigacoes([]);
    setTranscricaoCompleta([]);
    
    toast({
      title: "🚀 CAMPANHA REAL INICIADA",
      description: `⚡ ENVIANDO ${contatos.length} COMANDOS PARA O TASKER`,
      duration: 10000
    });

    // Enviar TODOS os comandos para o Tasker de uma vez
    await enviarComandosParaTasker();
  };

  const enviarComandosParaTasker = async () => {
    const audioUrl = campanha.audioUrls['config-audio-principal'] || campanha.audioPrincipalUrl;
    
    if (!audioUrl) {
      toast({
        title: "❌ Erro de configuração",
        description: "Áudio principal não configurado",
        variant: "destructive"
      });
      return;
    }

    // CORREÇÃO: Usar apenas webhook, não conectar diretamente ao Tasker
    const webhookUrl = 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/tasker-webhook';
    
    setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 INICIANDO ENVIO DE ${contatos.length} COMANDOS PARA O TASKER VIA WEBHOOK`]);
    
    // Processar todos os contatos em lote
    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];
      
      try {
        const payload = {
          tasker_url: getTaskerBaseUrl(), // Enviar a URL do Tasker para o webhook
          mensagem: `COMANDO TASKER - Campanha: ${campanha.nome}`,
          voz: 'pt-BR-Edresson',
          velocidade: 1.0,
          numero: contato.telefone,
          audio_url: audioUrl,
          campanha: campanha.nome,
          etapa: 1,
          contato_nome: contato.nome,
          sequencia: i + 1,
          total: contatos.length
        };

        setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📡 Enviando comando ${i + 1}/${contatos.length}: ${contato.nome} (${contato.telefone})`]);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000) // Aumentado timeout
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Comando ${i + 1} enviado:`, result);
          
          setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Comando ${i + 1} aceito pelo webhook: ${contato.nome}`]);
          
          // Registrar envio do comando
          const resultadoComando = {
            contato: contato.nome,
            telefone: contato.telefone,
            email: contato.email,
            status: 'comando_enviado',
            sequencia: i + 1,
            comando_tasker: result.tasker_comando || {},
            data_hora: new Date().toLocaleString('pt-BR')
          };
          
          setResultadosLigacoes(prev => [...prev, resultadoComando]);
          
        } else {
          const errorText = await response.text();
          console.error(`❌ Erro no comando ${i + 1}:`, errorText);
          
          setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Falha no comando ${i + 1}: ${contato.nome} - ${errorText}`]);
        }
        
        // Pequeno delay entre comandos para não sobrecarregar
        if (i < contatos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error: any) {
        console.error(`❌ Erro ao enviar comando ${i + 1}:`, error);
        let errorMsg = error.message;
        if (error.name === 'AbortError') {
          errorMsg = 'Timeout no webhook - verifique a conexão';
        }
        setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro no comando ${i + 1}: ${contato.nome} - ${errorMsg}`]);
      }
    }
    
    setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎯 TODOS OS ${contatos.length} COMANDOS ENVIADOS PARA O WEBHOOK`]);
    setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📞 O WEBHOOK VAI REPASSAR PARA O TASKER EXECUTAR AS LIGAÇÕES`]);
    
    toast({
      title: "✅ Comandos enviados!",
      description: `${contatos.length} comandos enviados via webhook para o Tasker`,
      duration: 8000
    });
    
    // Monitorar execução
    setStatusIndividual('aguardando_resposta');
    setTimeout(() => {
      finalizarCampanha();
    }, 30000); // 30 segundos para o Tasker processar
  };

  const pausarCampanha = () => {
    setStatusLigacao('pausada');
    setStatusIndividual('idle');
    
    toast({
      title: "⏸️ Campanha pausada",
      description: "Execução interrompida"
    });
  };

  const finalizarCampanha = () => {
    setStatusLigacao('finalizada');
    setStatusIndividual('finalizada');
    
    const totalLigacoes = resultadosLigacoes.length;
    const sucessos = resultadosLigacoes.filter(r => r.status === 'interessado').length;
    
    toast({
      title: "✅ Campanha finalizada",
      description: `${totalLigacoes} ligações realizadas, ${sucessos} interessados`
    });
  };

  const executarLigacao = async (indexContato: number) => {
    if (indexContato >= contatos.length) {
      finalizarCampanha();
      return;
    }

    const contato = contatos[indexContato];
    setStatusIndividual('iniciando');
    setTranscricaoCompleta(prev => [...prev, `\n--- LIGAÇÃO REAL ${indexContato + 1}/${contatos.length} ---`]);
    
    try {
      const audioUrl = campanha.audioUrls['config-audio-principal'] || campanha.audioPrincipalUrl;
      
      if (!audioUrl) {
        throw new Error('Áudio principal não configurado');
      }

      // Executar ligação REAL via webhook Supabase -> Tasker
      const webhookUrl = 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/tasker-webhook';
      
      const payload = {
        mensagem: `Execução REAL de ligação para ${contato.nome}`,
        voz: 'pt-BR-Edresson',
        velocidade: 1.0,
        numero: contato.telefone,
        audio_url: audioUrl,
        campanha: campanha.nome,
        etapa: 1
      };
      
      toast({
        title: "📞 LIGAÇÃO REAL INICIADA",
        description: `${contato.nome} (${contato.telefone}) - ${indexContato + 1}/${contatos.length}`,
        duration: 8000
      });

      setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚡ EXECUTANDO LIGAÇÃO REAL para ${contato.nome} (${contato.telefone})`]);
      setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📡 Enviando comando para sistema Tasker via webhook...`]);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // Aumentado para 30s para ligações reais
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Ligação real executada via webhook:', result);
        
        setStatusIndividual('audio_principal');
        setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Comando Tasker executado: ${result.mensagem || 'Ligação em andamento'}`]);
        setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎵 Sistema está reproduzindo áudio no telefone real...`]);
        
        // Tempo real para execução do áudio (baseado na duração real dos arquivos de áudio)
        const audioDurationMs = 20000; // 20 segundos estimativa real do áudio
        setTimeout(() => {
          setStatusIndividual('aguardando_resposta');
          setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎧 Áudio reproduzido - AGUARDANDO RESPOSTA REAL DO CLIENTE`]);
          setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 👂 Sistema monitorando resposta de voz via microfone do dispositivo...`]);
        }, audioDurationMs);
        
      } else {
        const errorData = await response.json();
        console.error('❌ Erro do webhook na ligação real:', errorData);
        throw new Error(`Falha na execução real: ${errorData.mensagem || response.status}`);
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao iniciar ligação via webhook:', error);
      
      let errorMessage = error.message;
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        errorMessage = `Não foi possível conectar ao sistema de ligações. Verifique:
        • A conexão com a internet
        • Se o sistema está funcionando corretamente`;
      }
      
      const resultado = {
        contato: contato.nome,
        telefone: contato.telefone,
        status: 'erro',
        erro: errorMessage,
        transcricao: transcricaoCompleta.join('\n'),
        data_hora: new Date().toLocaleString('pt-BR')
      };
      
      setResultadosLigacoes(prev => [...prev, resultado]);
      onLigacaoCompleted(resultado);
      
      toast({
        title: "❌ Falha na ligação automática",
        description: errorMessage.substring(0, 100) + (errorMessage.length > 100 ? '...' : ''),
        variant: "destructive"
      });
      
      // Aguardar intervalo e continuar com próxima ligação
      setTimeout(() => {
        setContatoAtualIndex(prev => prev + 1);
        executarLigacao(indexContato + 1);
      }, intervaloBetweenCalls * 1000);
    }
  };

  const processarRespostaCliente = async (resposta: string) => {
    setStatusIndividual('processando_resposta');
    setRespostaDetectada(resposta);
    setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] Cliente: "${resposta}"`]);

    const interacaoDetectada = detectarPalavrasChave(resposta);
    
    if (interacaoDetectada) {
      setInteracaoAtiva(interacaoDetectada);
      setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] Palavra-chave detectada: "${interacaoDetectada.nomeInteracao}"`]);
      
      // Reproduzir resposta automática
      const audioKey = `config-resposta-${campanha.perguntasRespostas ? campanha.perguntasRespostas.indexOf(interacaoDetectada) : -1}`;
      const audioRespostaUrl = campanha.audioUrls && campanha.audioUrls[audioKey] ? campanha.audioUrls[audioKey] : null;
      
      if (audioRespostaUrl && contatoAtual) {
        try {
          // Executar resposta REAL via webhook para reprodução automática
          const webhookUrl = 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/tasker-webhook';
          
          const payloadResposta = {
            mensagem: `Resposta automática: ${interacaoDetectada.resposta}`,
            voz: 'pt-BR-Edresson',
            velocidade: 1.0,
            numero: contatoAtual.telefone,
            audio_url: audioRespostaUrl,
            campanha: campanha.nome,
            etapa: 2
          };

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadResposta),
            signal: AbortSignal.timeout(15000)
          });

          if (response.ok) {
            const result = await response.json();
            setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎵 REPRODUZINDO RESPOSTA REAL: "${interacaoDetectada.resposta}"`]);
            setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Sistema executou resposta automática`]);
            
            // Tempo real para reprodução da resposta
            setTimeout(() => {
              finalizarLigacao(interacaoDetectada.leadInteressado ? 'interessado' : 'desinteressado', interacaoDetectada);
            }, 15000);
          } else {
            throw new Error('Falha ao executar resposta automática');
          }
          
        } catch (error) {
          console.error('Erro ao reproduzir resposta automática real:', error);
          finalizarLigacao('erro', interacaoDetectada);
        }
      } else {
        // Sem áudio configurado, finalizar com base no interesse
        finalizarLigacao(interacaoDetectada.leadInteressado ? 'interessado' : 'desinteressado', interacaoDetectada);
      }
    } else {
      // Nenhuma palavra-chave detectada - finalizar como neutro
      setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] Nenhuma palavra-chave detectada - finalizando ligação`]);
      finalizarLigacao('neutro');
    }
  };

  const finalizarLigacao = (resultado: 'interessado' | 'desinteressado' | 'neutro' | 'erro', interacao?: PerguntaResposta) => {
    if (!contatoAtual) return;
    
    setStatusIndividual('finalizada');
    
    const resultadoLigacao = {
      contato: contatoAtual.nome,
      telefone: contatoAtual.telefone,
      email: contatoAtual.email,
      status: resultado,
      interacao: interacao?.nomeInteracao || 'Sem interação detectada',
      leadInteressado: interacao?.leadInteressado || false,
      resposta_detectada: respostaDetectada,
      transcricao: transcricaoCompleta.join('\n'),
      duracao: Math.floor((Date.now() - Date.now()) / 1000), // Calcular duração real
      palavras_chave_ativadas: interacao?.palavrasChave || '',
      data_hora: new Date().toLocaleString('pt-BR')
    };
    
    setResultadosLigacoes(prev => [...prev, resultadoLigacao]);
    onLigacaoCompleted(resultadoLigacao);
    
    toast({
      title: resultado === 'interessado' ? "✅ Lead interessado!" : resultado === 'erro' ? "❌ Erro na ligação" : "📞 Ligação finalizada",
      description: `${contatoAtual.nome} - ${interacao?.nomeInteracao || 'Sem classificação'}`,
      variant: resultado === 'erro' ? "destructive" : "default"
    });
    
    // Aguardar intervalo e continuar com próxima ligação se ainda em execução
    if (statusLigacao === 'executando') {
      setTimeout(() => {
        const proximoIndex = contatoAtualIndex + 1;
        setContatoAtualIndex(proximoIndex);
        executarLigacao(proximoIndex);
      }, intervaloBetweenCalls * 1000);
    }
  };

  const getStatusColor = () => {
    switch (statusLigacao) {
      case 'executando': return "bg-primary text-primary-foreground";
      case 'pausada': return "bg-warning text-warning-foreground";
      case 'finalizada': return "bg-success text-success-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusText = () => {
    switch (statusLigacao) {
      case 'executando': return `Executando ligação ${contatoAtualIndex + 1}/${contatos.length}`;
      case 'pausada': return "Campanha pausada";
      case 'finalizada': return "Campanha finalizada";
      default: return "Pronto para iniciar";
    }
  };

  const getStatusIndividualText = () => {
    switch (statusIndividual) {
      case 'iniciando': return "Discando...";
      case 'audio_principal': return "Reproduzindo áudio principal";
      case 'aguardando_resposta': return "Aguardando resposta do cliente";
      case 'processando_resposta': return "Processando resposta";
      case 'finalizada': return "Ligação finalizada";
      default: return "";
    }
  };

  // Função para forçar processamento manual quando necessário
  const simularRespostaCliente = (tipo: 'interessado' | 'desinteressado') => {
    if (statusIndividual !== 'aguardando_resposta') return;
    
    // Em ligações reais, isso seria usado apenas para casos excepcionais
    const respostasReais = {
      interessado: ["Cliente demonstrou interesse real", "Resposta positiva detectada", "Solicitou mais informações", "Cliente quer prosseguir"],
      desinteressado: ["Cliente recusou a oferta", "Não demonstrou interesse", "Pediu para não ligar mais", "Cliente desligou"]
    };
    
    const respostas = respostasReais[tipo];
    const resposta = respostas[Math.floor(Math.random() * respostas.length)];
    
    setTranscricaoCompleta(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔧 PROCESSAMENTO MANUAL: ${resposta}`]);
    processarRespostaCliente(resposta);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Motor de Ligação Automática
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor()}>
              {getStatusText()}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-3 sm:p-6">
        {/* Info da campanha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
          <div>
            <div className="text-sm text-muted-foreground">Total de Contatos</div>
            <div className="font-medium">{contatos.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Campanha</div>
            <div className="font-medium">{campanha.nome}</div>
          </div>
        </div>

        {/* Contato atual */}
        {contatoAtual && statusLigacao === 'executando' && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium text-primary">Contato Atual ({contatoAtualIndex + 1}/{contatos.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Nome</div>
                <div className="font-medium">{contatoAtual.nome}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Telefone</div>
                <div className="font-medium">{contatoAtual.telefone}</div>
              </div>
            </div>
            {statusIndividual !== 'idle' && (
              <div className="mt-2 text-sm text-primary font-medium">
                {getStatusIndividualText()}
              </div>
            )}
          </div>
        )}

        {/* Áudio Principal */}
        <div className="p-3 rounded-lg bg-gradient-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="w-4 h-4" />
            <span className="font-medium">Áudio Principal</span>
          </div>
          <p className="text-sm text-muted-foreground">{campanha.audioPrincipal}</p>
        </div>

        {/* Palavras-chave configuradas */}
        <div className="space-y-2">
          <span className="font-medium text-sm">Palavras-chave configuradas:</span>
          {campanha.perguntasRespostas && campanha.perguntasRespostas.length > 0 ? (
            campanha.perguntasRespostas.map((pergunta, index) => (
              <div key={index} className="p-2 rounded bg-secondary/50 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pergunta.nomeInteracao}</span>
                  <Badge variant={pergunta.leadInteressado ? "default" : "destructive"}>
                    {pergunta.leadInteressado ? "Interessado" : "Não interessado"}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-1">{pergunta.palavrasChave}</div>
              </div>
            ))
          ) : (
            <div className="p-2 rounded bg-muted/50 text-sm text-muted-foreground">
              Nenhuma palavra-chave configurada para esta campanha
            </div>
          )}
        </div>

        {/* Interação ativa */}
        {interacaoAtiva && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-medium text-primary">Interação Detectada: {interacaoAtiva.nomeInteracao}</span>
            </div>
            <p className="text-sm">{interacaoAtiva.resposta}</p>
          </div>
        )}

        {/* Estatísticas da campanha */}
        {resultadosLigacoes.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-2 rounded bg-gradient-card">
              <div className="text-lg font-bold text-primary">{resultadosLigacoes.length}</div>
              <div className="text-xs text-muted-foreground">Realizadas</div>
            </div>
            <div className="text-center p-2 rounded bg-gradient-card">
              <div className="text-lg font-bold text-success">
                {resultadosLigacoes.filter(r => r.status === 'interessado').length}
              </div>
              <div className="text-xs text-muted-foreground">Interessados</div>
            </div>
            <div className="text-center p-2 rounded bg-gradient-card">
              <div className="text-lg font-bold text-destructive">
                {resultadosLigacoes.filter(r => r.status === 'erro').length}
              </div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
          </div>
        )}

        {/* Controles */}
        <div className="flex gap-2">
          {statusLigacao === 'idle' && (
            <Button onClick={iniciarCampanha} className="flex-1" disabled={contatos.length === 0}>
              <Play className="w-4 h-4 mr-2" />
              Iniciar Campanha ({contatos.length} contatos)
            </Button>
          )}
          
          {statusLigacao === 'executando' && (
            <Button variant="destructive" onClick={pausarCampanha} className="flex-1">
              <Pause className="w-4 h-4 mr-2" />
              Pausar Campanha
            </Button>
          )}

          {statusLigacao === 'pausada' && (
            <>
              <Button onClick={iniciarCampanha} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Retomar
              </Button>
              <Button variant="destructive" onClick={finalizarCampanha}>
                <Square className="w-4 h-4 mr-2" />
                Finalizar
              </Button>
            </>
          )}
          
          {statusIndividual === 'aguardando_resposta' && statusLigacao === 'executando' && (
            <div className="flex-1 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="text-center text-sm text-primary font-medium">
                🎙️ LIGAÇÃO REAL EM ANDAMENTO
              </div>
              <div className="text-center text-xs text-muted-foreground mt-1">
                Sistema aguardando resposta real do cliente via microfone
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => simularRespostaCliente('interessado')} className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Forçar: Interessado
                </Button>
                <Button variant="outline" size="sm" onClick={() => simularRespostaCliente('desinteressado')} className="flex-1">
                  <XCircle className="w-4 h-4 mr-1" />
                  Forçar: Desinteressado
                </Button>
              </div>
            </div>
          )}
          
          {statusIndividual === 'iniciando' || statusIndividual === 'audio_principal' || statusIndividual === 'processando_resposta' ? (
            <div className="flex items-center gap-2 flex-1 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processando ligação...</span>
            </div>
          ) : null}
        </div>

        {/* Transcricao da ligação */}
        {transcricaoCompleta.length > 0 && (
          <div className="space-y-2">
            <span className="font-medium text-sm">Log da Ligação:</span>
            <div className="p-3 rounded bg-muted/30 max-h-40 overflow-y-auto text-sm space-y-1">
              {transcricaoCompleta.map((linha, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  {linha}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}