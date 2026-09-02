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
        const checkTemperatureAlerts = () => {
            if (!leads || leads.length === 0) return;

            try {
                const notifiedTempAlerts = JSON.parse(localStorage.getItem('notified_temp_alerts') || '{}');
                let updatedStorage = false;

                leads.forEach(lead => {
                    if (!lead.temperatura || lead.temperatura === 'sem-classificacao') return;

                    const lastContactStr = lead.ultimo_contato || lead.created_at;
                    if (!lastContactStr) return;

                    const lastContact = new Date(lastContactStr);
                    if (isNaN(lastContact.getTime())) return;

                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - lastContact.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let targetDays: number | null = null;

                    // Rules: quente 7 days, morno 15 days, frio 180 days
                    if (lead.temperatura === 'quente') targetDays = 7;
                    else if (lead.temperatura === 'morno') targetDays = 15;
                    else if (lead.temperatura === 'frio') targetDays = 180;

                    if (targetDays !== null) {
                        // Create a unique key based on lead id, their last contact time, and the threshold
                        // If they are contacted again, a new lastContactStr will be generated
                        const alertKey = `${lead.id}_${lastContactStr}_${targetDays}`;
                        if (!notifiedTempAlerts[alertKey]) {
                            console.log(`🔔 [GLOBAL POLLING] Scheduling temp follow-up TASK for lead: ${lead.nome}`);

                            // Immediately mark as scheduled locally to prevent duplicate spawn
                            notifiedTempAlerts[alertKey] = true;
                            updatedStorage = true;

                            supabase.auth.getUser().then(({ data: { user } }) => {
                                if (user) {
                                    const dueDate = new Date(lastContact.getTime() + targetDays * 24 * 60 * 60 * 1000);

                                    supabase.from('tasks').insert({
                                        user_id: user.id,
                                        lead_id: lead.id,
                                        title: `Lembrete de Follow-up (Temperatura ${lead.temperatura})`,
                                        description: `O lead "${lead.nome}" precisa de follow-up (a cada ${targetDays} dias).`,
                                        due_date: dueDate.toISOString(),
                                        status: 'pending'
                                    }).then(({ error }) => {
                                        if (error) {
                                            console.error("❌ Error scheduling temp follow-up task:", error);
                                        } else {
                                            console.log("✅ Temperature remind task scheduled successfully.");
                                        }
                                    });
                                }
                            });
                        }
                    }
                });

                if (updatedStorage) {
                    localStorage.setItem('notified_temp_alerts', JSON.stringify(notifiedTempAlerts));
                }
            } catch (err) {
                console.error("❌ [GLOBAL POLLING] Temperature polling error:", err);
            }
        };

        const checkDueTasks = async () => {
            try {
                const now = new Date();
                console.log('🔍 [GLOBAL POLLING] Checking for due tasks at:', now.toLocaleTimeString('pt-BR'));

                const { data: dueTasks, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('status', 'pending')
                    .lte('due_date', now.toISOString());

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
                            title: `Lembrete: ${task.title} - ${leadName}`,
                            message: `Este lembrete venceu às ${new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
                            leadId: task.lead_id
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
        checkTemperatureAlerts();

        // Then check every 5 seconds
        const intervalId = setInterval(() => {
            checkDueTasks();
            checkTemperatureAlerts();
        }, 5000);

        return () => clearInterval(intervalId);
    }, [leads, addNotification]);

    // This component doesn't render anything
    return null;
}
