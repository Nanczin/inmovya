import { supabase } from '@/integrations/supabase/client'

export interface ConfiguracaoData {
  id?: string
  user_id?: string
  tasker: {
    ip: string
    porta: string
    ngrok_url: string
    status: string
    ultimaConexao: string
  }
  ia: {
    openai_key: string
    modelo_gpt: string
    temperatura: number
    max_tokens: number
  }
  automacao: {
    intervalo_ligacoes: number
    tentativas_maximas: number
    horario_inicio: string
    horario_fim: string
    dias_semana: string[]
    ativo: boolean
  }
  seguranca: {
    backup_automatico: boolean
    retencao_dados: number
    logs_auditoria: boolean
    ip_whitelist: boolean
  }
  created_at?: string
  updated_at?: string
}

export async function salvarConfiguracoes(configuracoes: ConfiguracaoData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    // Verificar se já existe uma configuração para este usuário
    const { data: existingConfig } = await supabase
      .from('configuracoes')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const configData = {
      ...configuracoes,
      user_id: user.id,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingConfig) {
      // Atualizar registro existente
      result = await supabase
        .from('configuracoes')
        .update(configData)
        .eq('id', existingConfig.id)
        .select()
    } else {
      // Inserir novo registro
      result = await supabase
        .from('configuracoes')
        .insert(configData)
        .select()
    }

    if (result.error) throw result.error
    return { success: true, data: result.data }
  } catch (error) {
    console.error('Erro ao salvar configurações:', error)
    return { success: false, error }
  }
}

export async function carregarConfiguracoes() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error)
    return { success: false, error }
  }
}