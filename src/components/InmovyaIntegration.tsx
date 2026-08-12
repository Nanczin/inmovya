import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { salvarConfiguracoes, carregarConfiguracoes, ConfiguracaoData } from "@/lib/supabase";
import { TaskerIntegration } from "./TaskerIntegration";
import { TaskerSetupGuide } from "./TaskerSetupGuide";
import { CampanhaManager } from "./CampanhaManager";

import { CallMonitor } from "./CallMonitor";
import { 
  Smartphone,
  Mic,
  PhoneCall,
  Monitor,
  Settings,
  Zap
} from "lucide-react";

interface TaskerConfig {
  ngrok_url: string;
  status: string;
  ultimaConexao: string;
}

export function InmovyaIntegration() {
  const { toast } = useToast();
  
  const [taskerConfig, setTaskerConfig] = useState<TaskerConfig>({
    ngrok_url: '',
    status: 'Desconectado',
    ultimaConexao: 'Nunca'
  });

  // Carregar configurações do banco
  useEffect(() => {
    const carregarConfigs = async () => {
      try {
        const { success, data } = await carregarConfiguracoes();
        if (success && data && data.tasker) {
          setTaskerConfig(data.tasker as any);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações Tasker:', error);
      }
    };
    carregarConfigs();
  }, []);

  // Salvar automaticamente quando taskerConfig muda
  useEffect(() => {
    const salvarTaskerConfig = async () => {
      try {
        // Carregar configurações existentes
        const { success: loadSuccess, data: existingData } = await carregarConfiguracoes();
        
        const configParaSalvar = loadSuccess && existingData ? {
          ...existingData,
          tasker: taskerConfig
        } : {
          tasker: taskerConfig,
          ia: {
            openai_key: '',
            modelo_gpt: 'gpt-3.5-turbo',
            temperatura: 0.7,
            max_tokens: 150
          },
          automacao: {
            intervalo_ligacoes: 30,
            tentativas_maximas: 3,
            horario_inicio: '09:00',
            horario_fim: '18:00',
            dias_semana: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            ativo: false
          },
          seguranca: {
            backup_automatico: true,
            retencao_dados: 30,
            logs_auditoria: true,
            ip_whitelist: false
          }
        };
        
        await salvarConfiguracoes(configParaSalvar as ConfiguracaoData);
        console.log('✅ Configuração Tasker salva automaticamente');
      } catch (error) {
        console.error('Erro ao salvar configuração Tasker:', error);
      }
    };

    const timeoutId = setTimeout(() => {
      salvarTaskerConfig();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [taskerConfig]);

  const validarConfiguracaoCompleta = async () => {
    toast({
      title: "Iniciando Validação",
      description: "Verificando todas as configurações...",
      variant: "default",
    });

    // Simular validação das configurações
    const validacoes = [
      { nome: "Conexão Ngrok", status: taskerConfig.status === 'Conectado' },
      { nome: "URL Ngrok", status: taskerConfig.ngrok_url !== '' }
    ];

    const todasValidas = validacoes.every(v => v.status);
    const falhas = validacoes.filter(v => !v.status);

    setTimeout(() => {
      if (todasValidas) {
        toast({
          title: "✅ Configuração Completa",
          description: "Todos os componentes estão configurados corretamente!",
          variant: "default",
        });
      } else {
        toast({
          title: "⚠️ Configuração Incompleta",
          description: `Pendências: ${falhas.map(f => f.nome).join(', ')}`,
          variant: "destructive",
        });
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">

      <div className="space-y-6">
        <TaskerIntegration 
          config={taskerConfig}
          onConfigChange={setTaskerConfig}
        />
        
        {/* Guia de Configuração */}
        <TaskerSetupGuide />
      </div>
    </div>
  );
}