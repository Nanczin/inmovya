import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { useLeads } from '@/context/LeadsContext';

/**
 * Global component that polls for due tasks and displays notifications
 * This runs in the background across all tabs/pages
 */
export function TaskNotificationPoller() {
    const { addNotification } = useNotifications();
    const { leads } = useLeads();

    useEffect(() => {
        const checkDueTasks = async () => {
            try {
                const now = new Date();
                console.log('🔍 [GLOBAL POLLING] Checking for due tasks at:', now.toLocaleTimeString('pt-BR'));

                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const { data: dueTasks, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('status', 'pending')
                    .lte('due_date', now.toISOString())
                    .gte('due_date', yesterday.toISOString());

                if (error) {
                    console.error("❌ [GLOBAL POLLING] Error checking tasks:", error);
                    return;
                }

                console.log(`📋 [GLOBAL POLLING] Found ${dueTasks?.length || 0} due tasks`);

                if (dueTasks && dueTasks.length > 0) {
                    const notifiedTasks = JSON.parse(localStorage.getItem('notified_tasks') || '[]');
                    console.log('📌 [GLOBAL POLLING] Already notified:', notifiedTasks.length, 'tasks');

                    for (const task of dueTasks) {
                        if (notifiedTasks.includes(task.id)) {
                            console.log('⏭️ [GLOBAL POLLING] Skipping already notified task:', task.id);
                            continue;
                        }

                        // Find the associated lead to get the name
                        const associatedLead = leads.find(l => l.id === task.lead_id);
                        const leadName = associatedLead ? associatedLead.nome : 'Lead';

                        console.log('🔔 [GLOBAL POLLING] Creating notification for task:', task.id, task.title);

                        addNotification({
                            type: 'warning',
                            title: 'Lembrete Vencido',
                            message: `Lembrete "${task.title}" para ${leadName} venceu às ${new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
                            leadId: task.lead_id,
                            taskId: task.id
                        });

                        // Add to local storage to avoid notifying again
                        notifiedTasks.push(task.id);
                    }

                    localStorage.setItem('notified_tasks', JSON.stringify(notifiedTasks));
                    console.log('✅ [GLOBAL POLLING] Updated notified tasks list');
                }
            } catch (err) {
                console.error("❌ [GLOBAL POLLING] Task polling error:", err);
            }
        };

        // Check immediately on mount
        checkDueTasks();

        // Then check every 5 seconds
        const intervalId = setInterval(() => {
            checkDueTasks();
        }, 5000);

        return () => clearInterval(intervalId);
    }, [leads, addNotification]);

    // This component doesn't render anything
    return null;
}

