import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailDispatchRequest {
  campaignId?: string
  emailIds?: string[]
  action: 'start' | 'pause' | 'resume' | 'cancel' | 'process_queue' | 'switch_account' | 'start_continuous'
}

interface GmailAccount {
  id: string
  email: string
  app_password: string
  daily_limit: number
  current_count: number
  status: string
}

interface QueuedEmail {
  id: string
  recipient_email: string
  recipient_name: string
  subject: string
  body: string
  template_data: any
  attempts: number
  max_attempts: number
  image_attachments?: string[]
}

interface Campaign {
  id: string
  delay_min: number
  delay_max: number
  batch_size: number
  batch_pause: number
  status: string
}

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function replacePlaceholders(text: string, data: any): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match
  })
}

async function sendEmailViaGmail(
  account: GmailAccount, 
  email: QueuedEmail
): Promise<{ success: boolean; error?: string; shouldSwitchAccount?: boolean }> {
  try {
    console.log(`Sending email via ${account.email} to ${email.recipient_email}`)
    
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: account.email,
          password: (account.app_password || '').replace(/\s/g, ''),
        },
      },
    })

    // Replace placeholders in subject and body
    const processedSubject = replacePlaceholders(email.subject, email.template_data)
    const processedBody = replacePlaceholders(email.body, email.template_data)

    // Check if body contains HTML tags
    const containsHTML = /<[^>]+>/.test(processedBody)
    
    // Prepare images section if attachments exist
    let imagesHTML = ''
    if (email.image_attachments && email.image_attachments.length > 0) {
      const imageElements = email.image_attachments
        .map(url => `<img src="${url}" alt="Anexo da campanha" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;" />`)
        .join('')
      imagesHTML = `<div style="margin: 20px 0;">${imageElements}</div>`
    }

    let htmlContent = ''
    let textContent = ''

    if (containsHTML) {
      // Se já contém HTML, melhore o processamento
      htmlContent = processedBody
      
      // Adicione imagens no final do HTML se existirem
      if (imagesHTML) {
        // Se tem </body>, insira antes dele
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${imagesHTML}</body>`)
        } else {
          htmlContent += imagesHTML
        }
      }
      
      // Garanta DOCTYPE e meta tags para melhor renderização
      if (!htmlContent.includes('<!DOCTYPE')) {
        htmlContent = `<!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>${processedSubject}</title>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>`
      }
      
      // Para texto simples, remova as tags HTML
      textContent = processedBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    } else {
      // Se é texto simples, crie um template HTML responsivo e profissional
      textContent = processedBody
      htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${processedSubject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .content { padding: 40px 30px; color: #333; line-height: 1.6; font-size: 16px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 20px; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 20px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      ${processedBody.replace(/\n/g, '<br>')}
      ${imagesHTML}
    </div>
  </div>
</body>
</html>`
    }
    
    await client.send({
      from: account.email,
      to: email.recipient_email,
      subject: processedSubject,
      content: textContent,
      html: htmlContent,
    })

    await client.close()
    return { success: true }
  } catch (error) {
    console.error(`Error sending email via ${account.email}:`, error)
    
    // Check for daily limit exceeded error specifically
    const errorMessage = error.message || ''
    const isDailyLimitError = errorMessage.includes('Daily user sending limit exceeded')
    const shouldSwitchAccount = isDailyLimitError || 
                               errorMessage.includes('Username and Password not accepted') || 
                               errorMessage.includes('BadCredentials') ||
                               errorMessage.includes('Authentication failed')
    
    return { 
      success: false, 
      error: errorMessage,
      shouldSwitchAccount 
    }
  }
}

async function processEmailQueue(
  supabaseClient: any,
  userId: string,
  campaignId?: string,
  continuousMode: boolean = false
): Promise<{ processed: number; failed: number; paused: boolean; switchedAccount?: boolean }> {
  let processed = 0
  let failed = 0
  let emailsSentInBatch = 0
  let switchedAccount = false
  
  try {
    // First, reset all error accounts that might be stuck
    console.log('Resetting stuck Gmail accounts...')
    await supabaseClient
      .from('gmail_accounts')
      .update({ 
        status: 'active',
        current_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'error')

    // Reset daily counts if needed
    await supabaseClient.rpc('reset_gmail_daily_counts')

    // Get fresh campaign settings if specified
    let campaign: Campaign | null = null
    const refreshCampaignData = async () => {
      if (campaignId) {
        const { data: campaignData } = await supabaseClient
          .from('email_campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('user_id', userId)
          .single()
        
        campaign = campaignData
        
        // Check if campaign is paused or cancelled
        if (campaign?.status === 'paused' || campaign?.status === 'cancelled') {
          return { paused: true }
        }
      }
      return { paused: false }
    }

    const { paused } = await refreshCampaignData()
    if (paused) {
      return { processed: 0, failed: 0, paused: true, switchedAccount: false }
    }

    // Processar apenas 1 email por execução
    const MAX_PER_RUN = 1
    let emailsInCurrentBatch = 0
    
    while (emailsInCurrentBatch < MAX_PER_RUN) {
      // Refresh campaign data every 10 emails to get latest template updates
      if (processed > 0 && processed % 10 === 0) {
        const { paused } = await refreshCampaignData()
        if (paused) {
          console.log('Campaign was paused/cancelled during processing')
          break
        }
      }

      // Get next email to process (allow null scheduled_for or due items)
      const nowIso = new Date().toISOString()
      let query = supabaseClient
        .from('email_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)

      if (campaignId) {
        query = query.eq('campanha_id', campaignId)
      }

      const { data: emails, error: emailError } = await query

      if (emailError || !emails || emails.length === 0) {
        console.log('No more emails to process in this run')
        break
      }

      const email = emails[0] as QueuedEmail

      // Update email with latest campaign template if campaign exists
      if (campaign) {
        console.log('Updating email with fresh campaign template data')
        await supabaseClient
          .from('email_queue')
          .update({
            subject: campaign.template_subject,
            body: campaign.template_body,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)
        
        // Update local email object with fresh data
        email.subject = campaign.template_subject
        email.body = campaign.template_body
      }

      // Mark email as processing
      await supabaseClient
        .from('email_queue')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)

      // Get next available Gmail account with retry logic
      let accountId = null
      let retryCount = 0
      const maxRetries = 3

      while (!accountId && retryCount < maxRetries) {
        const { data: account } = await supabaseClient
          .rpc('get_next_gmail_account', { p_user_id: userId })
        
        if (account) {
          accountId = account
          break
        }

        retryCount++
        console.log(`Retry ${retryCount}: No available accounts, attempting to reset and retry...`)
        
        // Reset error accounts and try again
        await supabaseClient
          .from('gmail_accounts')
          .update({ 
            status: 'active',
            current_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .in('status', ['error', 'limit_reached'])

        // Wait a moment before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      if (!accountId) {
        console.log('No available Gmail accounts after retries - all limits reached')

        // If this is part of a campaign, try to switch to next account automatically
        if (campaignId) {
          console.log('Attempting automatic account switch for campaign:', campaignId)

          // Reset daily counts to potentially free up accounts
          await supabaseClient.rpc('reset_gmail_daily_counts')

          // Try to get account again after reset
          const { data: newAccountId } = await supabaseClient
            .rpc('get_next_gmail_account', { p_user_id: userId })

          if (newAccountId) {
            console.log('Successfully switched to new account:', newAccountId)
            switchedAccount = true

            // Continue processing with new account
            const { data: newAccount } = await supabaseClient
              .from('gmail_accounts')
              .select('*')
              .eq('id', newAccountId)
              .single()

            if (newAccount) {
              const result = await sendEmailViaGmail(newAccount, email)

              if (result.success) {
                // Mark as sent and increment account usage
                await Promise.all([
                  supabaseClient
                    .from('email_queue')
                    .update({ 
                      status: 'sent',
                      sent_at: new Date().toISOString(),
                      gmail_account_id: newAccount.id,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', email.id),

                  supabaseClient.rpc('increment_gmail_usage', { p_account_id: newAccount.id }),

                  // Log successful send
                  supabaseClient
                    .from('email_logs')
                    .insert({
                      user_id: userId,
                      provider: 'gmail',
                      recipient: email.recipient_email,
                      subject: email.subject,
                      body: email.body,
                      status: 'success',
                      sent_at: new Date().toISOString()
                    })
                ])

                processed++
                emailsSentInBatch++

                // Update campaign stats if applicable
                if (campaignId) {
                  const { data: currentCampaign } = await supabaseClient
                    .from('email_campaigns')
                    .select('sent_emails')
                    .eq('id', campaignId)
                    .single()

                  await supabaseClient
                    .from('email_campaigns')
                    .update({ 
                      sent_emails: (currentCampaign?.sent_emails || 0) + 1,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', campaignId)
                }

                console.log(`Email sent successfully to ${email.recipient_email} via ${newAccount.email} (switched account)`)
                emailsInCurrentBatch++
                continue
              }
            }
          }
        }

        // Mark email as pending and schedule for tomorrow
        await supabaseClient
          .from('email_queue')
          .update({ 
            status: 'pending',
            scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)
        break
      }

      // Get account details
      const { data: account } = await supabaseClient
        .from('gmail_accounts')
        .select('*')
        .eq('id', accountId)
        .single()

      if (!account) {
        console.error('Account not found:', accountId)
        failed++
        await supabaseClient
          .from('email_queue')
          .update({ 
            status: 'failed',
            error_message: 'Gmail account not found',
            attempts: email.attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)
        continue
      }

      // Attempt to send email
      const result = await sendEmailViaGmail(account, email)

      if (result.success) {
        // Mark as sent and increment account usage
        await Promise.all([
          supabaseClient
            .from('email_queue')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              gmail_account_id: account.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id),

          supabaseClient.rpc('increment_gmail_usage', { p_account_id: account.id }),

          // Log successful send
          supabaseClient
            .from('email_logs')
            .insert({
              user_id: userId,
              provider: 'gmail',
              recipient: email.recipient_email,
              subject: email.subject,
              body: email.body,
              status: 'success',
              sent_at: new Date().toISOString()
            })
        ])

        processed++
        emailsSentInBatch++
        emailsInCurrentBatch++

        // Update campaign stats if applicable
        if (campaignId) {
          // Use proper SQL increment instead of raw
          const { data: currentCampaign } = await supabaseClient
            .from('email_campaigns')
            .select('sent_emails')
            .eq('id', campaignId)
            .single()

          await supabaseClient
            .from('email_campaigns')
            .update({ 
              sent_emails: (currentCampaign?.sent_emails || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', campaignId)
        }

        console.log(`Email sent successfully to ${email.recipient_email} via ${account.email}`)
      } else {
        // Handle failure
        const newAttempts = email.attempts + 1
        const shouldRetry = newAttempts < email.max_attempts

        // If it's a daily limit or authentication error, mark account as having errors
        if (result.shouldSwitchAccount) {
          console.log(`Daily limit or auth failed for account ${account.email}, marking as error`)
          await supabaseClient
            .from('gmail_accounts')
            .update({ 
              status: 'error',
              updated_at: new Date().toISOString()
            })
            .eq('id', account.id)
            
          // Try to switch to another account automatically
          const { data: nextAccountId } = await supabaseClient
            .rpc('get_next_gmail_account', { p_user_id: userId })
            
          if (nextAccountId && nextAccountId !== account.id) {
            console.log(`Switching to account ${nextAccountId} automatically due to limit/auth error`)
            switchedAccount = true
            
            // Get new account details
            const { data: newAccount } = await supabaseClient
              .from('gmail_accounts')
              .select('*')
              .eq('id', nextAccountId)
              .single()
              
            if (newAccount) {
              // Try sending with new account
              const newResult = await sendEmailViaGmail(newAccount, email)
              
              if (newResult.success) {
                // Mark as sent with new account
                await Promise.all([
                  supabaseClient
                    .from('email_queue')
                    .update({ 
                      status: 'sent',
                      sent_at: new Date().toISOString(),
                      gmail_account_id: newAccount.id,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', email.id),
                  
                  supabaseClient.rpc('increment_gmail_usage', { p_account_id: newAccount.id }),
                  
                  // Log successful send
                  supabaseClient
                    .from('email_logs')
                    .insert({
                      user_id: userId,
                      provider: 'gmail',
                      recipient: email.recipient_email,
                      subject: email.subject,
                      body: email.body,
                      status: 'success',
                      sent_at: new Date().toISOString()
                    })
                ])

                processed++
                emailsSentInBatch++
                
                // Update campaign stats if applicable
                if (campaignId) {
                  const { data: currentCampaign } = await supabaseClient
                    .from('email_campaigns')
                    .select('sent_emails')
                    .eq('id', campaignId)
                    .single()
                  
                  await supabaseClient
                    .from('email_campaigns')
                    .update({ 
                      sent_emails: (currentCampaign?.sent_emails || 0) + 1,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', campaignId)
                }

                console.log(`Email sent successfully to ${email.recipient_email} via ${newAccount.email} (switched due to limit/auth error)`)        
                continue
              }
            }
          }
        }

        await Promise.all([
          supabaseClient
            .from('email_queue')
            .update({ 
              status: shouldRetry ? 'pending' : 'failed',
              error_message: result.error,
              attempts: newAttempts,
              scheduled_for: shouldRetry ? 
                new Date(Date.now() + (newAttempts * 5 * 60 * 1000)).toISOString() : // Retry in 5 minutes * attempt number
                null,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id),
          
          // Log failed send
          supabaseClient
            .from('email_logs')
            .insert({
              user_id: userId,
              provider: 'gmail',
              recipient: email.recipient_email,
              subject: email.subject,
              body: email.body,
              status: 'failed',
              error_message: result.error,
              sent_at: new Date().toISOString()
            })
        ])

        if (!shouldRetry) {
          failed++
          
          // Update campaign failed count if applicable
          if (campaignId) {
            const { data: currentCampaign } = await supabaseClient
              .from('email_campaigns')
              .select('failed_emails')
              .eq('id', campaignId)
              .single()
            
            await supabaseClient
              .from('email_campaigns')
              .update({ 
                failed_emails: (currentCampaign?.failed_emails || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', campaignId)
          }
        }

        console.log(`Email failed to ${email.recipient_email}: ${result.error}`)
      }

      // Add delay between emails if in campaign mode and if we have campaign settings
      if (campaign && processed > 0) {
        const delay = getRandomDelay(campaign.delay_min * 1000, campaign.delay_max * 1000)
        console.log(`Waiting ${delay / 1000} seconds before next email...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Check if we need a batch pause
      if (campaign && emailsSentInBatch >= campaign.batch_size) {
        console.log(`Batch of ${campaign.batch_size} emails sent. Pausing for ${campaign.batch_pause} seconds...`)
        await new Promise(resolve => setTimeout(resolve, campaign.batch_pause * 1000))
        emailsSentInBatch = 0
      }
    }

    // Check if campaign is complete
    if (campaignId) {
      const { data: remainingEmails } = await supabaseClient
        .from('email_queue')
        .select('id')
        .eq('campanha_id', campaignId)
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .limit(1)

      if (!remainingEmails || remainingEmails.length === 0) {
        console.log('Campaign completed - no more emails to send')
        await supabaseClient
          .from('email_campaigns')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId)
      }
    }

    return { processed, failed, paused: false, switchedAccount }
  } catch (error) {
    console.error('Error processing email queue:', error)
    return { processed, failed, paused: false, switchedAccount }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header missing')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    const { action, campaignId, emailIds } = await req.json() as EmailDispatchRequest

    let result: any = {}

    switch (action) {
      case 'start':
      case 'process_queue':
        result = await processEmailQueue(supabaseClient, user.id, campaignId)
        break
        
      case 'start_continuous':
        // Inicia processamento contínuo em background
        EdgeRuntime.waitUntil(
          (async () => {
            console.log('Iniciando disparo contínuo de emails...')
            let continuousResult
            do {
              continuousResult = await processEmailQueue(supabaseClient, user.id, undefined, true)
              console.log(`Lote processado: ${continuousResult.processed} enviados, ${continuousResult.failed} falharam`)
              
              // Pequena pausa entre verificações se não há emails
              if (continuousResult.processed === 0) {
                await new Promise(resolve => setTimeout(resolve, 30000)) // 30 segundos
              }
            } while (continuousResult.processed > 0 || continuousResult.failed > 0)
          })()
        )
        
        result = { message: 'Disparo contínuo iniciado em background' }
        break
        
      case 'pause':
        // Pause all processing emails back to pending
        await supabaseClient
          .from('email_queue')
          .update({ 
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('status', 'processing')

        // Also pause specific campaign if provided
        if (campaignId) {
          await supabaseClient
            .from('email_campaigns')
            .update({ 
              status: 'paused',
              updated_at: new Date().toISOString()
            })
            .eq('id', campaignId)
            .eq('user_id', user.id)
          
          result = { message: 'Campaign and queue paused successfully' }
        } else {
          result = { message: 'Email queue paused successfully' }
        }
        break
        
      case 'resume':
        if (campaignId) {
          await supabaseClient
            .from('email_campaigns')
            .update({ 
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', campaignId)
            .eq('user_id', user.id)
          
          result = await processEmailQueue(supabaseClient, user.id, campaignId)
        }
        break
        
      case 'cancel':
        if (campaignId) {
          await Promise.all([
            supabaseClient
              .from('email_campaigns')
              .update({ 
                status: 'cancelled',
                updated_at: new Date().toISOString()
              })
              .eq('id', campaignId)
              .eq('user_id', user.id),
            
            supabaseClient
              .from('email_queue')
              .update({ 
                status: 'cancelled',
                updated_at: new Date().toISOString()
              })
              .eq('campanha_id', campaignId)
              .eq('user_id', user.id)
              .in('status', ['pending', 'processing'])
          ])
          
          result = { message: 'Campaign cancelled successfully' }
        }
        break

      case 'switch_account':
        if (campaignId) {
          // Get current account being used by the campaign
          const { data: currentEmail } = await supabaseClient
            .from('email_queue')
            .select('gmail_account_id')
            .eq('campanha_id', campaignId)
            .not('gmail_account_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)

          let currentAccountId = null
          if (currentEmail && currentEmail.length > 0) {
            currentAccountId = currentEmail[0].gmail_account_id
            
            // Mark current account as having errors to avoid using it
            await supabaseClient
              .from('gmail_accounts')
              .update({ 
                status: 'error',
                current_count: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', currentAccountId)
              .eq('user_id', user.id)
            
            console.log(`Marked account ${currentAccountId} as having errors`)
          }
          
          // Reset daily counts to make other accounts available
          await supabaseClient.rpc('reset_gmail_daily_counts')
          
          // Get next available account (different from current)
          let { data: nextAccountId } = await supabaseClient
            .rpc('get_next_gmail_account', { p_user_id: user.id })
          
          // If we get the same account, try to find a different one
          if (nextAccountId === currentAccountId) {
            const { data: allAccounts } = await supabaseClient
              .from('gmail_accounts')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .neq('status', 'error')
              .neq('id', currentAccountId)
              .limit(1)
            
            if (allAccounts && allAccounts.length > 0) {
              nextAccountId = allAccounts[0].id
            }
          }
          
          if (nextAccountId && nextAccountId !== currentAccountId) {
            // Update the account status to active
            await supabaseClient
              .from('gmail_accounts')
              .update({ 
                status: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('id', nextAccountId)
            
            result = { 
              message: 'Successfully switched to next available Gmail account',
              accountId: nextAccountId,
              previousAccountId: currentAccountId
            }
          } else {
            throw new Error('No alternative Gmail accounts available for switching')
          }
        }
        break
        
      default:
        throw new Error('Invalid action')
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in Gmail dispatcher:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error'
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