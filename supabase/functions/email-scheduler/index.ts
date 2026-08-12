import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações de agendamento inteligente
const SCHEDULE_CONFIG = {
  // Intervalos baseados na carga atual
  lowLoad: 30000,    // 30 segundos quando pouca carga
  mediumLoad: 60000,  // 1 minuto quando carga média
  highLoad: 120000,   // 2 minutos quando carga alta
  
  // Limites para determinar carga
  lowLoadThreshold: 50,     // < 50 emails pendentes = carga baixa
  mediumLoadThreshold: 200, // < 200 emails pendentes = carga média
}

class EmailScheduler {
  private supabase: any
  private isRunning = false
  private intervalId: number | null = null

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  async start() {
    if (this.isRunning) {
      return { message: 'Agendador já está executando' }
    }

    this.isRunning = true
    console.log('🕐 Iniciando agendador inteligente de emails')

    // Primeira execução imediata
    await this.processEmails()

    // Agendar próximas execuções
    await this.scheduleNext()

    return { message: 'Agendador iniciado com sucesso' }
  }

  async stop() {
    this.isRunning = false
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
    console.log('⏹️ Agendador parado')
    return { message: 'Agendador parado' }
  }

  async getStatus() {
    const { data: queueStats } = await this.supabase
      .from('email_queue')
      .select('status')
      .eq('status', 'pending')

    const { data: accountStats } = await this.supabase
      .from('gmail_accounts')
      .select('status, current_count, daily_limit')
      .eq('is_active', true)

    const pendingCount = queueStats?.length || 0
    const activeAccounts = accountStats?.filter(acc => acc.status === 'active')?.length || 0
    const totalCapacity = accountStats?.reduce((sum, acc) => sum + (acc.daily_limit - acc.current_count), 0) || 0

    return {
      isRunning: this.isRunning,
      pendingEmails: pendingCount,
      activeAccounts,
      remainingCapacity: totalCapacity,
      currentLoad: this.calculateLoadLevel(pendingCount),
      nextProcessIn: this.calculateInterval(pendingCount)
    }
  }

  private async processEmails() {
    if (!this.isRunning) return

    try {
      console.log('🔄 Executando processamento de emails...')

      // Chamar a função de processamento
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/smart-email-processor`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          }
        }
      )

      const result = await response.json()
      
      if (result.error) {
        console.error('❌ Erro no processamento:', result.error)
      } else {
        console.log(`✅ Processamento concluído: ${result.processed || 0} emails enviados`)
      }

    } catch (error) {
      console.error('💥 Erro ao chamar processador:', error)
    }
  }

  private async scheduleNext() {
    if (!this.isRunning) return

    // Verificar carga atual
    const { data: queueData } = await this.supabase
      .from('email_queue')
      .select('id')
      .eq('status', 'pending')

    const pendingCount = queueData?.length || 0
    const interval = this.calculateInterval(pendingCount)

    console.log(`⏰ Próximo processamento em ${interval / 1000} segundos (${pendingCount} emails pendentes)`)

    this.intervalId = setTimeout(async () => {
      await this.processEmails()
      await this.scheduleNext()
    }, interval)
  }

  private calculateInterval(pendingCount: number): number {
    if (pendingCount < SCHEDULE_CONFIG.lowLoadThreshold) {
      return SCHEDULE_CONFIG.lowLoad
    } else if (pendingCount < SCHEDULE_CONFIG.mediumLoadThreshold) {
      return SCHEDULE_CONFIG.mediumLoad
    } else {
      return SCHEDULE_CONFIG.highLoad
    }
  }

  private calculateLoadLevel(pendingCount: number): string {
    if (pendingCount < SCHEDULE_CONFIG.lowLoadThreshold) {
      return 'low'
    } else if (pendingCount < SCHEDULE_CONFIG.mediumLoadThreshold) {
      return 'medium'
    } else {
      return 'high'
    }
  }
}

let globalScheduler: EmailScheduler | null = null

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Inicializar scheduler global se não existir
    if (!globalScheduler) {
      globalScheduler = new EmailScheduler(supabaseClient)
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'status'

    let result
    switch (action) {
      case 'start':
        result = await globalScheduler.start()
        break
      case 'stop':
        result = await globalScheduler.stop()
        break
      case 'status':
        result = await globalScheduler.getStatus()
        break
      default:
        result = { error: 'Ação inválida. Use: start, stop, ou status' }
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )

  } catch (error) {
    console.error('💥 Erro no agendador:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})