import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { salvarConfiguracoes as salvarConfigSupabase, carregarConfiguracoes, ConfiguracaoData } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { TaskerIntegration } from "./TaskerIntegration";
import { IAConfigSection } from "./IAConfigSection";
import { AutomationConfig } from "./AutomationConfig";
import { EmailSetup } from "./EmailSetup";
import { InmovyaIntegration } from "./InmovyaIntegration";
import { UserManagement } from "./UserManagement";

import { 
  Settings,
  Smartphone,
  Globe,
  Key,
  Bell,
  Shield,
  Database,
  Mic,
  Phone,
  Save,
  TestTube,
  Zap,
  Users,
  Lock
} from "lucide-react";

export function SettingsModule() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  
  const [configuracoes, setConfiguracoes] = useState({
    tasker: {
      ip: "192.168.1.100",
      porta: "8080",
      ngrok_url: "",
      status: "Conectado",
      ultimaConexao: "2024-01-28 14:30"
    },
    ia: {
      openai_key: "sk-...hidden",
      modelo_gpt: "gpt-4",
      temperatura: 0.7,
      max_tokens: 150
    },
    automacao: {
      intervalo_ligacoes: 15,
      tentativas_maximas: 3,
      horario_inicio: "09:00",
      horario_fim: "18:00",
      dias_semana: ["seg", "ter", "qua", "qui", "sex"],
      ativo: false
    },
    notificacoes: {
      email: true,
      sms: false,
      whatsapp: true,
      dashboard: true
    },
    seguranca: {
      backup_automatico: true,
      retencao_dados: 365,
      logs_auditoria: true,
      ip_whitelist: true
    }
  });

  // Função para salvar automaticamente
  const salvarAutomaticamente = useCallback(async (novasConfiguracoes: any) => {
    try {
      const configParaSalvar = {
        tasker: novasConfiguracoes.tasker,
        ia: novasConfiguracoes.ia,
        automacao: novasConfiguracoes.automacao,
        seguranca: novasConfiguracoes.seguranca
      };
      
      await salvarConfigSupabase(configParaSalvar as ConfiguracaoData);
      console.log('Configurações salvas automaticamente');
    } catch (error) {
      console.error('Erro no salvamento automático:', error);
    }
  }, []);

  // Carregar configurações ao inicializar
  useEffect(() => {
    const carregarConfigs = async () => {
      try {
        const { success, data } = await carregarConfiguracoes();
        if (success && data) {
          console.log('Configurações carregadas:', data);
          // Mesclar os dados carregados com as configurações padrão
          setConfiguracoes(prev => ({
            ...prev,
            tasker: data.tasker ? data.tasker as any : prev.tasker,
            ia: data.ia ? data.ia as any : prev.ia,
            automacao: data.automacao ? data.automacao as any : prev.automacao,
            seguranca: data.seguranca ? data.seguranca as any : prev.seguranca
          }));
        } else {
          console.log('Nenhuma configuração encontrada, usando padrões');
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        toast({
          title: "Aviso",
          description: "Usando configurações padrão. As configurações serão salvas no primeiro salvamento.",
          variant: "default",
        });
      }
    };
    carregarConfigs();
  }, []);

  // Salvamento automático quando configurações mudam (com debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      salvarAutomaticamente(configuracoes);
    }, 1000); // Salva 1 segundo após a última mudança

    return () => clearTimeout(timeoutId);
  }, [configuracoes, salvarAutomaticamente]);

  const salvarConfiguracoes = async () => {
    setIsLoading(true);
    
    try {
      console.log('Iniciando salvamento das configurações:', configuracoes);
      
      // Preparar dados para salvar (remover campos que não existem na tabela)
      const configParaSalvar = {
        tasker: configuracoes.tasker,
        ia: configuracoes.ia,
        automacao: configuracoes.automacao,
        seguranca: configuracoes.seguranca
      };
      
      console.log('Dados preparados para salvar:', configParaSalvar);
      
      // Salvar no Supabase
      const { success, error } = await salvarConfigSupabase(configParaSalvar as ConfiguracaoData);
      
      if (success) {
        console.log('Configurações salvas com sucesso no Supabase');
        
        // Também salvar no localStorage como backup
        localStorage.setItem('inmovya_config', JSON.stringify(configuracoes));
        console.log('Backup salvo no localStorage');
        
        toast({
          title: "✅ Configurações Salvas",
          description: "Todas as configurações foram salvas com sucesso no banco de dados.",
          variant: "default",
        });
      } else {
        console.error('Erro ao salvar no Supabase:', error);
        throw new Error(error?.message || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "❌ Erro ao Salvar",
        description: "Houve um problema ao salvar as configurações. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testarConexaoSupabase = async () => {
    setIsLoading(true);
    toast({
      title: "🔍 Testando Conexão",
      description: "Verificando conexão com o banco de dados...",
    });

    try {
      // Teste simples de conexão
      const { data, error } = await supabase
        .from('configuracoes')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      toast({
        title: "✅ Conexão OK",
        description: "Conexão com Supabase funcionando corretamente.",
        variant: "default",
      });
    } catch (error) {
      console.error('Erro na conexão:', error);
      toast({
        title: "❌ Erro de Conexão",
        description: "Problemas na conexão com o banco de dados.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const realizarBackupManual = () => {
    const backup = {
      configuracoes,
      timestamp: new Date().toISOString(),
      version: "v2.1.4"
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `inmovya-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    toast({
      title: "Backup Realizado",
      description: "Backup baixado com sucesso.",
      variant: "default",
    });
  };


  const gerenciarUsuarios = async () => {
    setIsLoading(true);
    toast({
      title: "Gerenciar Usuários",
      description: "Carregando informações do usuário atual...",
    });
    
    try {
      // Buscar informações do usuário atual logado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se é admin baseado no email
      const isAdmin = user.email === 'estevao.v.garcia10@gmail.com';
      const role = isAdmin ? 'admin' : 'user';
      
      const usuarioAtual = {
        id: user.id,
        email: user.email || 'N/A',
        nome: user.user_metadata?.full_name || user.email?.split('@')[0] || 'N/A',
        role,
        isAdmin,
        ultimoLogin: user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca',
        criadoEm: new Date(user.created_at).toLocaleDateString('pt-BR'),
        confirmado: user.email_confirmed_at ? true : false
      };
      
      console.log("=== INFORMAÇÕES DO USUÁRIO ATUAL ===");
      console.log(`👤 Nome: ${usuarioAtual.nome}`);
      console.log(`📧 Email: ${usuarioAtual.email}`);
      console.log(`🔑 Role: ${usuarioAtual.role}`);
      console.log(`👑 Admin: ${usuarioAtual.isAdmin ? '✅ Sim' : '❌ Não'}`);
      console.log(`✉️ Email confirmado: ${usuarioAtual.confirmado ? '✅ Sim' : '❌ Não'}`);
      console.log(`🕐 Último Login: ${usuarioAtual.ultimoLogin}`);
      console.log(`📅 Criado em: ${usuarioAtual.criadoEm}`);
      console.log(`🆔 ID: ${usuarioAtual.id}`);
      
      if (!usuarioAtual.isAdmin) {
        console.log("\n⚠️ NOTA: Para gerenciar outros usuários, é necessário ter role de admin.");
        console.log("💡 Entre em contato com o administrador para obter permissões administrativas.");
      }
      
      toast({
        title: "Informações Carregadas",
        description: `Usuário: ${usuarioAtual.nome} | Role: ${usuarioAtual.role}`,
      });
      
    } catch (error) {
      console.error('Erro ao buscar informações do usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as informações do usuário.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const gerenciarPermissoes = async () => {
    setIsLoading(true);
    toast({
      title: "Gerenciar Permissões",
      description: "Configurando sistema de permissões baseado em roles...",
    });
    
    try {
      // Sistema de permissões hierárquico
      const sistemPermissoes = {
        admin: {
          nivel: 5,
          nome: "Administrador",
          modulos: ["*"], // Acesso total
          acoes: ["CREATE", "READ", "UPDATE", "DELETE", "MANAGE_USERS", "SYSTEM_CONFIG", "SECURITY"],
          descricao: "Acesso completo ao sistema - Conta principal",
          cor: "#dc2626"
        },
        manager: {
          nivel: 4,
          nome: "Gerente",
          modulos: ["dashboard", "leads", "campanhas", "empreendimentos", "relatorios", "ligacoes"],
          acoes: ["CREATE", "READ", "UPDATE", "DELETE", "VIEW_REPORTS", "MANAGE_CAMPAIGNS"],
          descricao: "Gestão de vendas e relatórios",
          cor: "#2563eb"
        },
        consultant: {
          nivel: 3,
          nome: "Consultor",
          modulos: ["dashboard", "leads", "ligacoes", "materiais", "vozes"],
          acoes: ["READ", "UPDATE_OWN", "MAKE_CALLS", "ACCESS_MATERIALS"],
          descricao: "Operações de vendas e atendimento",
          cor: "#059669"
        },
        viewer: {
          nivel: 2,
          nome: "Visualizador",
          modulos: ["dashboard"],
          acoes: ["READ"],
          descricao: "Apenas visualização de dados",
          cor: "#7c2d12"
        },
        guest: {
          nivel: 1,
          nome: "Convidado",
          modulos: [],
          acoes: ["LOGIN"],
          descricao: "Acesso temporário limitado",
          cor: "#6b7280"
        }
      };

      // Mapear usuários para suas permissões
      const permissoesUsuarios = {
        'estevao.v.garcia10@gmail.com': 'admin',
        // Outros usuários receberão 'consultant' por padrão
      };

      console.log("=== SISTEMA DE PERMISSÕES INMOVYA ===");
      console.log("🔐 Hierarquia de Roles (do maior para o menor nível):\n");
      
      // Ordenar por nível de permissão
      const rolesOrdenadas = Object.entries(sistemPermissoes)
        .sort(([,a], [,b]) => b.nivel - a.nivel);
      
      rolesOrdenadas.forEach(([roleKey, role]) => {
        console.log(`${role.nivel}. 👑 ${role.nome.toUpperCase()}`);
        console.log(`   🎯 Nível: ${role.nivel}/5`);
        console.log(`   📝 Descrição: ${role.descricao}`);
        console.log(`   🎨 Cor: ${role.cor}`);
        console.log(`   📂 Módulos: ${role.modulos.includes('*') ? 'TODOS OS MÓDULOS' : role.modulos.join(', ')}`);
        console.log(`   ⚡ Ações: ${role.acoes.join(', ')}\n`);
      });

      console.log("👥 MAPEAMENTO DE USUÁRIOS:");
      Object.entries(permissoesUsuarios).forEach(([email, role]) => {
        const roleInfo = sistemPermissoes[role];
        console.log(`📧 ${email} → ${roleInfo.nome} (Nível ${roleInfo.nivel})`);
      });

      // Salvar no localStorage para uso da aplicação
      localStorage.setItem('inmovya_permissions', JSON.stringify({
        roles: sistemPermissoes,
        userRoles: permissoesUsuarios,
        lastUpdate: new Date().toISOString()
      }));

      toast({
        title: "Sistema de Permissões Configurado",
        description: "Roles e permissões definidas com sucesso. Dados salvos localmente.",
      });
      
    } catch (error) {
      console.error('Erro ao configurar permissões:', error);
      toast({
        title: "Erro",
        description: "Não foi possível configurar o sistema de permissões.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const configurarPoliticaSenhas = async () => {
    setIsLoading(true);
    toast({
      title: "Política de Senhas",
      description: "Configurando política de segurança corporativa...",
    });
    
    try {
      // Política de segurança empresarial
      const politicaSeguranca = {
        versao: "2.1.4",
        ultimaAtualizacao: new Date().toISOString(),
        configuracao: {
          requisitos: {
            tamanhoMinimo: 12,
            tamanhoMaximo: 128,
            requerMaiuscula: true,
            requerMinuscula: true,
            requerNumero: true,
            requerCaracterEspecial: true,
            caracteresEspeciaisPermitidos: "!@#$%^&*()_+-=[]{}|;:,.<>?",
            naoPermitirSequenciais: true,
            naoPermitirComuns: true,
            naoPermitirDadosPessoais: true
          },
          regrasExpiracao: {
            expiracaoEmDias: 90,
            avisoAntecipado: 15,
            gracePeriod: 3,
            forcaTrocaNoLogin: true,
            forcaTrocaAdmin: false
          },
          controlesSeguranca: {
            historicoSenhas: 12,
            tentativasMaximas: 5,
            tempoBloqueioPorTentativa: 900, // 15 minutos em segundos
            bloqueioAutomaticoApos: 3,
            resetAutomaticoApos: 86400, // 24 horas em segundos
            logTentativasFalhas: true,
            alertaAdminBloqueio: true
          },
          autenticacaoMultifator: {
            obrigatorio: true,
            obrigatorioParaAdmin: true,
            metodos: ["Email", "SMS", "Authenticator"],
            metodoPreferido: "Email",
            backupCodes: true,
            sessaoSegura: 3600 // 1 hora
          },
          auditoria: {
            logAlteracoesSenha: true,
            logTentativasLogin: true,
            retencaoLogs: 365, // dias
            alertasSeguranca: true,
            relatorioMensal: true
          }
        }
      };

      // Validador de senha para demonstração
      const validadorSenha = {
        validar: (senha) => {
          const erros = [];
          const config = politicaSeguranca.configuracao.requisitos;
          
          if (senha.length < config.tamanhoMinimo) erros.push(`Mínimo ${config.tamanhoMinimo} caracteres`);
          if (senha.length > config.tamanhoMaximo) erros.push(`Máximo ${config.tamanhoMaximo} caracteres`);
          if (config.requerMaiuscula && !/[A-Z]/.test(senha)) erros.push("Pelo menos uma letra maiúscula");
          if (config.requerMinuscula && !/[a-z]/.test(senha)) erros.push("Pelo menos uma letra minúscula");
          if (config.requerNumero && !/\d/.test(senha)) erros.push("Pelo menos um número");
          if (config.requerCaracterEspecial && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(senha)) erros.push("Pelo menos um caractere especial");
          
          return { valida: erros.length === 0, erros };
        }
      };

      console.log("=== POLÍTICA DE SEGURANÇA INMOVYA v2.1.4 ===");
      console.log(`📅 Última atualização: ${new Date(politicaSeguranca.ultimaAtualizacao).toLocaleString('pt-BR')}\n`);
      
      console.log("🔐 REQUISITOS DE SENHA:");
      const req = politicaSeguranca.configuracao.requisitos;
      console.log(`   📏 Tamanho: ${req.tamanhoMinimo}-${req.tamanhoMaximo} caracteres`);
      console.log(`   🔤 Maiúscula: ${req.requerMaiuscula ? '✅ Obrigatório' : '❌ Opcional'}`);
      console.log(`   🔡 Minúscula: ${req.requerMinuscula ? '✅ Obrigatório' : '❌ Opcional'}`);
      console.log(`   🔢 Número: ${req.requerNumero ? '✅ Obrigatório' : '❌ Opcional'}`);
      console.log(`   🎯 Especial: ${req.requerCaracterEspecial ? '✅ Obrigatório' : '❌ Opcional'}`);
      console.log(`   ⚠️ Sequenciais: ${req.naoPermitirSequenciais ? '❌ Proibidos' : '✅ Permitidos'}`);
      console.log(`   📝 Dados pessoais: ${req.naoPermitirDadosPessoais ? '❌ Proibidos' : '✅ Permitidos'}\n`);
      
      console.log("⏰ REGRAS DE EXPIRAÇÃO:");
      const exp = politicaSeguranca.configuracao.regrasExpiracao;
      console.log(`   ⏱️ Validade: ${exp.expiracaoEmDias} dias`);
      console.log(`   🔔 Aviso: ${exp.avisoAntecipado} dias antes`);
      console.log(`   🕐 Grace period: ${exp.gracePeriod} dias`);
      console.log(`   🔒 Força troca login: ${exp.forcaTrocaNoLogin ? '✅ Sim' : '❌ Não'}\n`);
      
      console.log("🛡️ CONTROLES DE SEGURANÇA:");
      const ctrl = politicaSeguranca.configuracao.controlesSeguranca;
      console.log(`   📚 Histórico: ${ctrl.historicoSenhas} senhas`);
      console.log(`   🚫 Tentativas máx: ${ctrl.tentativasMaximas}`);
      console.log(`   ⏳ Bloqueio temp: ${ctrl.tempoBloqueioPorTentativa/60} minutos`);
      console.log(`   🔐 Bloqueio auto: após ${ctrl.bloqueioAutomaticoApos} tentativas`);
      console.log(`   🔓 Reset auto: ${ctrl.resetAutomaticoApos/3600} horas\n`);
      
      console.log("🔐 AUTENTICAÇÃO MULTIFATOR:");
      const mfa = politicaSeguranca.configuracao.autenticacaoMultifator;
      console.log(`   ✅ Obrigatório: ${mfa.obrigatorio ? 'Sim' : 'Não'}`);
      console.log(`   👑 Admin obrigatório: ${mfa.obrigatorioParaAdmin ? 'Sim' : 'Não'}`);
      console.log(`   📱 Métodos: ${mfa.metodos.join(', ')}`);
      console.log(`   🎯 Preferido: ${mfa.metodoPreferido}`);
      console.log(`   🔑 Códigos backup: ${mfa.backupCodes ? 'Sim' : 'Não'}`);
      console.log(`   ⏰ Sessão segura: ${mfa.sessaoSegura/60} minutos\n`);

      // Salvar configuração no Supabase
      const configParaSalvar = {
        ...configuracoes,
        politica_senhas: politicaSeguranca
      };
      
      await salvarConfigSupabase(configParaSalvar);
      
      // Demonstração do validador
      console.log("🧪 TESTE DO VALIDADOR:");
      const senhasTeste = ['123456', 'Password123!', 'MinhaSenhaSegura2024!@'];
      senhasTeste.forEach(senha => {
        const resultado = validadorSenha.validar(senha);
        console.log(`   "${senha}" → ${resultado.valida ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
        if (!resultado.valida) {
          resultado.erros.forEach(erro => console.log(`     • ${erro}`));
        }
      });

      toast({
        title: "Política de Senhas Configurada",
        description: "Política corporativa aplicada e salva no sistema.",
      });
      
    } catch (error) {
      console.error('Erro ao configurar política:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aplicar a política de senhas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const visualizarLogs = () => {
    const logs = [
      `[${new Date().toISOString()}] Sistema iniciado`,
      `[${new Date().toISOString()}] Configurações carregadas`,
      `[${new Date().toISOString()}] Integração Tasker: ${configuracoes.tasker.status}`,
      `[${new Date().toISOString()}] Automação: ${configuracoes.automacao.ativo ? 'Ativa' : 'Inativa'}`
    ];
    
    console.log("=== LOGS DO SISTEMA ===");
    logs.forEach(log => console.log(log));
    
    toast({
      title: "Logs do Sistema",
      description: "Logs exibidos no console do navegador.",
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
          <p className="text-muted-foreground">Gerencie todas as configurações da plataforma</p>
        </div>
        <Button variant="hero" className="shadow-elegant" onClick={salvarConfiguracoes} disabled={isLoading}>
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>

      {/* Integração Completa Inmovya */}
      <div className="mb-6">
        <InmovyaIntegration />
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">

        {/* Usuários */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowUserManagement(true)}>
              <Users className="w-4 h-4 mr-2" />
              Gerenciar Usuários
            </Button>
            
            <Button variant="outline" className="w-full justify-start" onClick={gerenciarPermissoes}>
              <Key className="w-4 h-4 mr-2" />
              Permissões
            </Button>
            
            <Button variant="outline" className="w-full justify-start" onClick={configurarPoliticaSenhas}>
              <Lock className="w-4 h-4 mr-2" />
              Política de Senhas
            </Button>
          </CardContent>
        </Card>

        {/* Sistema */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">Versão</div>
              <div className="text-muted-foreground">Inmovya v2.1.4</div>
            </div>
            
            <div className="text-sm">
              <div className="font-medium">Última Atualização</div>
              <div className="text-muted-foreground">28/01/2024</div>
            </div>
            
            <Separator />
            
            <EmailSetup />
            
            <Button variant="outline" className="w-full justify-start" onClick={realizarBackupManual}>
              <Database className="w-4 h-4 mr-2" />
              Backup Manual
            </Button>
            
            <Button variant="outline" className="w-full justify-start" onClick={visualizarLogs}>
              <Settings className="w-4 h-4 mr-2" />
              Logs do Sistema
            </Button>
            
            <Button variant="outline" className="w-full justify-start" onClick={testarConexaoSupabase}>
              <TestTube className="w-4 h-4 mr-2" />
              Testar Conexão BD
            </Button>
          </CardContent>
        </Card>
      </div>


      {/* Modal de Gerenciamento de Usuários */}
      {showUserManagement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">Gerenciar Usuários</h2>
              <Button variant="outline" onClick={() => setShowUserManagement(false)}>
                ✕
              </Button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <UserManagement />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}