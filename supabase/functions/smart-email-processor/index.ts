import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailQueueItem {
  id: string
  user_id: string
  recipient_email: string
  recipient_name: string
  subject: string
  body: string
  attempts: number
  max_attempts: number
  scheduled_for: string
  status: string
  gmail_account_id?: string
  priority: number
}

interface GmailAccount {
  id: string
  email: string
  app_password: string
  current_count: number
  daily_limit: number
  status: string
  is_active: boolean
  last_reset_date: string
}

// Sistema inteligente de throttling por provedor
const PROVIDER_LIMITS = {
  gmail: {
    perHour: 100,
    perDay: 450,
    burstLimit: 10, // máximo em rajada
    cooldownAfterBurst: 300000, // 5 minutos em ms
    retryDelay: 60000, // 1 minuto
    errorCooldown: 900000, // 15 minutos após erro
  },
  outlook: {
    perHour: 200,
    perDay: 1000,
    burstLimit: 20,
    cooldownAfterBurst: 180000, // 3 minutos
    retryDelay: 45000,
    errorCooldown: 600000, // 10 minutos
  }
}

class SmartEmailProcessor {
  private supabase: any
  private processing = false
  private accountCooldowns = new Map<string, number>()
  private burstCounters = new Map<string, { count: number; resetTime: number }>()

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  async processEmailQueue() {
    if (this.processing) {
      console.log('⏳ Processamento já em andamento, pulando...')
      return { message: 'Processamento já em andamento' }
    }

    this.processing = true
    console.log('🚀 Iniciando processamento inteligente da fila de emails')

    try {
      // Resetar contadores diários se necessário
      await this.resetDailyCounters()

      // Reativar contas em erro que já passaram do cooldown
      await this.reactivateErrorAccounts()

      // Buscar emails pendentes ordenados por prioridade
      const { data: emailQueue, error: queueError } = await this.supabase
        .from('email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100)

      if (queueError) {
        throw new Error(`Erro ao buscar fila: ${queueError.message}`)
      }

      if (!emailQueue || emailQueue.length === 0) {
        console.log('📭 Nenhum email pendente na fila')
        return { message: 'Nenhum email pendente', processed: 0 }
      }

      console.log(`📧 Encontrados ${emailQueue.length} emails pendentes`)

      // Buscar contas Gmail ativas
      const { data: gmailAccounts, error: accountsError } = await this.supabase
        .from('gmail_accounts')
        .select('*')
        .eq('is_active', true)

      if (accountsError) {
        throw new Error(`Erro ao buscar contas: ${accountsError.message}`)
      }

      if (!gmailAccounts || gmailAccounts.length === 0) {
        console.log('❌ Nenhuma conta Gmail ativa disponível')
        return { error: 'Nenhuma conta ativa disponível' }
      }

      let processed = 0
      let errors = 0

      // Processar apenas 1 email por execução para evitar sobrecarga
      const email = emailQueue[0] // Pegar apenas o primeiro email
      
      try {
        const account = await this.selectBestAccount(gmailAccounts)

        if (!account) {
          console.log('⏸️ Todas as contas estão em cooldown, pausando processamento')
          return { error: 'Nenhuma conta disponível no momento' }
        }

        const delay = this.calculateDelay(account)
        if (delay > 0) {
          console.log(`⏱️ Aguardando ${delay}ms antes do envio`)
          await this.sleep(delay)
        }

        const success = await this.sendEmail(email, account)

        if (success) {
          processed = 1
          await this.updateEmailStatus(email.id, 'sent')
          await this.incrementAccountUsage(account.id)
          this.updateBurstCounter(account.id)
          
          console.log(`✅ Email enviado para ${email.recipient_email} via ${account.email}`)
        } else {
          errors = 1
          await this.handleEmailFailure(email)
          await this.handleAccountError(account.id)
        }

      } catch (error) {
        console.error(`❌ Erro ao processar email ${email.id}:`, error)
        errors = 1
        await this.handleEmailFailure(email)
      }

      console.log(`🎯 Processamento concluído: ${processed} enviados, ${errors} erros`)

      return {
        message: 'Processamento concluído',
        processed,
        errors,
        remaining: emailQueue.length - processed - errors
      }

    } catch (error) {
      console.error('💥 Erro no processamento:', error)
      return { error: error.message }
    } finally {
      this.processing = false
    }
  }

  private async selectBestAccount(accounts: GmailAccount[]): Promise<GmailAccount | null> {
    const now = Date.now()

    // Filtrar contas não disponíveis
    const availableAccounts = accounts.filter(account => {
      // Verificar se está em cooldown
      const cooldownUntil = this.accountCooldowns.get(account.id) || 0
      if (now < cooldownUntil) {
        return false
      }

      // Verificar se não atingiu limite diário
      if (account.current_count >= account.daily_limit) {
        return false
      }

      // Verificar se não está em erro
      if (account.status === 'error') {
        return false
      }

      return true
    })

    if (availableAccounts.length === 0) {
      return null
    }

    // Selecionar conta com menor uso atual (load balancing)
    availableAccounts.sort((a, b) => {
      const usageA = a.current_count / a.daily_limit
      const usageB = b.current_count / b.daily_limit
      return usageA - usageB
    })

    return availableAccounts[0]
  }

  private calculateDelay(account: GmailAccount): number {
    const burstData = this.burstCounters.get(account.id)
    const provider = account.email.includes('@gmail.com') ? 'gmail' : 'outlook'
    const limits = PROVIDER_LIMITS[provider]

    // Se atingiu limite de rajada, aplicar cooldown
    if (burstData && burstData.count >= limits.burstLimit) {
      const timeSinceReset = Date.now() - burstData.resetTime
      if (timeSinceReset < limits.cooldownAfterBurst) {
        return limits.cooldownAfterBurst - timeSinceReset
      }
    }

    // Calcular delay baseado no uso atual
    const usage = account.current_count / account.daily_limit
    let baseDelay = 2000 // 2 segundos base

    if (usage > 0.8) {
      baseDelay = 10000 // 10 segundos se usando >80%
    } else if (usage > 0.6) {
      baseDelay = 5000 // 5 segundos se usando >60%
    } else if (usage > 0.4) {
      baseDelay = 3000 // 3 segundos se usando >40%
    }

    // Adicionar jitter aleatório para evitar padrões
    const jitter = Math.random() * 1000
    return baseDelay + jitter
  }

  private updateBurstCounter(accountId: string) {
    const now = Date.now()
    const current = this.burstCounters.get(accountId) || { count: 0, resetTime: now }

    // Reset contador se passou mais de 1 hora
    if (now - current.resetTime > 3600000) {
      this.burstCounters.set(accountId, { count: 1, resetTime: now })
    } else {
      this.burstCounters.set(accountId, { count: current.count + 1, resetTime: current.resetTime })
    }
  }

  private async sendEmail(email: EmailQueueItem, account: GmailAccount): Promise<boolean> {
    try {
      console.log(`📤 Enviando email para ${email.recipient_email} via ${account.email}`)

      const client = new SMTPClient({
        connection: {
          hostname: 'smtp.gmail.com',
          port: 587,
          tls: true,
          auth: {
            username: account.email,
            password: account.app_password,
          },
        },
      })

      await client.send({
        from: account.email,
        to: email.recipient_email,
        subject: email.subject,
        content: email.body,
        html: email.body,
      })

      await client.close()

      // Log de sucesso
      await this.supabase.from('email_logs').insert({
        user_id: email.user_id,
        provider: 'gmail',
        recipient: email.recipient_email,
        subject: email.subject,
        body: email.body,
        status: 'success',
        sent_at: new Date().toISOString(),
      })

      return true

    } catch (error) {
      console.error(`❌ Erro ao enviar email via ${account.email}:`, error)

      // Log de erro
      await this.supabase.from('email_logs').insert({
        user_id: email.user_id,
        provider: 'gmail',
        recipient: email.recipient_email,
        subject: email.subject,
        body: email.body,
        status: 'failed',
        error_message: error.message,
        sent_at: new Date().toISOString(),
      })

      return false
    }
  }

  private async handleEmailFailure(email: EmailQueueItem) {
    const newAttempts = email.attempts + 1

    if (newAttempts >= email.max_attempts) {
      // Marcar como falhou definitivamente
      await this.updateEmailStatus(email.id, 'failed')
      console.log(`💀 Email ${email.id} falhou definitivamente após ${newAttempts} tentativas`)
    } else {
      // Reagendar para retry com backoff exponencial
      const delay = Math.min(300000 * Math.pow(2, newAttempts), 3600000) // max 1 hora
      const retryAt = new Date(Date.now() + delay).toISOString()

      await this.supabase
        .from('email_queue')
        .update({
          attempts: newAttempts,
          scheduled_for: retryAt,
          status: 'pending'
        })
        .eq('id', email.id)

      console.log(`🔄 Email ${email.id} reagendado para retry em ${delay / 1000} segundos`)
    }
  }

  private async handleAccountError(accountId: string) {
    // Marcar conta como erro e definir cooldown
    await this.supabase
      .from('gmail_accounts')
      .update({ status: 'error' })
      .eq('id', accountId)

    // Cooldown de 15 minutos
    this.accountCooldowns.set(accountId, Date.now() + 900000)
    console.log(`⚠️ Conta ${accountId} marcada como erro, cooldown aplicado`)
  }

  private async reactivateErrorAccounts() {
    const now = Date.now()

    // Buscar contas em erro há mais de 15 minutos
    const fifteenMinutesAgo = new Date(now - 900000).toISOString()

    const { data: errorAccounts } = await this.supabase
      .from('gmail_accounts')
      .select('id, updated_at')
      .eq('status', 'error')
      .lt('updated_at', fifteenMinutesAgo)

    if (errorAccounts && errorAccounts.length > 0) {
      const accountIds = errorAccounts.map(acc => acc.id)

      await this.supabase
        .from('gmail_accounts')
        .update({ status: 'active' })
        .in('id', accountIds)

      console.log(`🔄 Reativadas ${accountIds.length} contas que estavam em erro`)
    }
  }

  private async resetDailyCounters() {
    const today = new Date().toISOString().split('T')[0]

    const { data: accounts } = await this.supabase
      .from('gmail_accounts')
      .select('id, last_reset_date')
      .neq('last_reset_date', today)

    if (accounts && accounts.length > 0) {
      const accountIds = accounts.map(acc => acc.id)

      await this.supabase
        .from('gmail_accounts')
        .update({
          current_count: 0,
          last_reset_date: today,
          status: 'active'
        })
        .in('id', accountIds)

      console.log(`🔄 Reset contadores diários para ${accountIds.length} contas`)
    }
  }

  private async updateEmailStatus(emailId: string, status: string) {
    await this.supabase
      .from('email_queue')
      .update({ status, sent_at: new Date().toISOString() })
      .eq('id', emailId)
  }

  private async incrementAccountUsage(accountId: string) {
    await this.supabase.rpc('increment_gmail_usage', { p_account_id: accountId })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const processor = new SmartEmailProcessor(supabaseClient)
    const result = await processor.processEmailQueue()

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
    console.error('💥 Erro na função:', error)
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