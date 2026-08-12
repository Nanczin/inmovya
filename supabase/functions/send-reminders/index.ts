import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Fetch tasks due in the last hour (or upcoming) that haven't been notified?
        // Simplified: Fetch tasks due today that are pending.
        // Ideally, this function runs every hour.
        const now = new Date();
        const startOfHour = new Date(now);
        startOfHour.setMinutes(0, 0, 0); // e.g. 14:00
        const endOfHour = new Date(now);
        endOfHour.setMinutes(59, 59, 999); // e.g. 14:59

        // OR: simpler logic for demo, just find pending tasks for today.
        const today = new Date().toISOString().split('T')[0];

        // Get tasks due today
        const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select('*, user:user_id(id)')
            // .eq('due_date', today) -- Need to refine this query based on exact schema
            .eq('status', 'pending')
            .is('completed_at', null)
            .limit(50);

        if (taskError) throw taskError;

        // Filter tasks that are actually due "now" or "today" if not specific time
        // For now, let's just attempt to notify for ANY pending task (limit 50) as a test
        // In production, refine the query: .gte('due_date', startOfHour) .lte('due_date', endOfHour)

        const results = [];

        for (const task of tasks) {
            // Find subscriptions for this user
            const { data: subs, error: subError } = await supabase
                .from('user_push_subscriptions')
                .select('*')
                .eq('user_id', task.user_id);

            if (subError || !subs) continue;

            const payload = JSON.stringify({
                title: `Lembrete: ${task.title}`,
                body: task.description || 'Você tem uma tarefa pendente.',
                icon: '/icons/icon-192x192.png',
                url: '/'
            });

            // Send to all devices
            for (const sub of subs) {
                try {
                    // VAPID details from Env
                    const vapidKeys = {
                        publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
                        privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!
                    };

                    webpush.setVapidDetails(
                        'mailto:admin@inmovya.com',
                        vapidKeys.publicKey,
                        vapidKeys.privateKey
                    );

                    await webpush.sendNotification(
                        sub.subscription,
                        payload
                    );
                    results.push({ task: task.id, status: 'sent', device: sub.id });
                } catch (err) {
                    console.error('Push error:', err);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription expired, delete it
                        await supabase.from('user_push_subscriptions').delete().eq('id', sub.id);
                    }
                    results.push({ task: task.id, status: 'error', error: err.message });
                }
            }
        }

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
