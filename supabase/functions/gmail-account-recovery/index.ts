import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { action } = await req.json()

    let result

    switch (action) {
      case 'reset_all_active':
        // Reativar todas as contas e resetar contadores
        const { error: resetError } = await supabaseClient
          .from('gmail_accounts')
          .update({
            status: 'active',
            current_count: 0,
            last_reset_date: new Date().toISOString().split('T')[0]
          })
          .eq('is_active', true)

        if (resetError) throw resetError

        result = { 
          message: 'Todas as contas foram reativadas e contadores resetados',
          action: 'reset_all_active'
        }
        break

      case 'reactivate_error_accounts':
        // Reativar apenas contas em erro há mais de 15 minutos
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        const { data: reactivatedAccounts, error: reactivateError } = await supabaseClient
          .from('gmail_accounts')
          .update({ status: 'active' })
          .eq('status', 'error')
          .eq('is_active', true)
          .lt('updated_at', fifteenMinutesAgo)
          .select('email')

        if (reactivateError) throw reactivateError

        result = { 
          message: `${reactivatedAccounts?.length || 0} contas foram reativadas`,
          reactivated: reactivatedAccounts?.map(acc => acc.email) || [],
          action: 'reactivate_error_accounts'
        }
        break

      case 'reset_daily_counters':
        // Resetar apenas contadores diários
        const today = new Date().toISOString().split('T')[0]

        const { data: resetCounters, error: countersError } = await supabaseClient
          .from('gmail_accounts')
          .update({
            current_count: 0,
            last_reset_date: today
          })
          .neq('last_reset_date', today)
          .eq('is_active', true)
          .select('email')

        if (countersError) throw countersError

        result = { 
          message: `Contadores resetados para ${resetCounters?.length || 0} contas`,
          reset: resetCounters?.map(acc => acc.email) || [],
          action: 'reset_daily_counters'
        }
        break

      case 'get_status':
        // Obter status detalhado das contas
        const { data: accounts, error: statusError } = await supabaseClient
          .from('gmail_accounts')
          .select('*')
          .eq('is_active', true)
          .order('email')

        if (statusError) throw statusError

        const stats = accounts?.reduce((acc, account) => {
          acc[account.status] = (acc[account.status] || 0) + 1
          acc.total_capacity += account.daily_limit
          acc.used_capacity += account.current_count
          return acc
        }, { 
          active: 0, 
          error: 0, 
          limit_reached: 0, 
          total_capacity: 0, 
          used_capacity: 0 
        }) || {}

        result = {
          accounts: accounts?.map(acc => ({
            email: acc.email,
            status: acc.status,
            usage: `${acc.current_count}/${acc.daily_limit}`,
            usage_percent: Math.round((acc.current_count / acc.daily_limit) * 100),
            last_reset: acc.last_reset_date
          })),
          summary: stats,
          action: 'get_status'
        }
        break

      default:
        throw new Error('Ação inválida. Use: reset_all_active, reactivate_error_accounts, reset_daily_counters, ou get_status')
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
    console.error('💥 Erro na recuperação de contas:', error)
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