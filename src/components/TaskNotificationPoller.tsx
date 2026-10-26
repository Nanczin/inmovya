import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { useLeads } from '@/context/LeadsContext';
import { mostrarLembretesNoPopup, type LembreteVencido } from '@/components/LembretesPopup';

/**
 * Global component that polls for due tasks and displays notifications
 * This runs in the background across all tabs/pages
 */
export function TaskNotificationPoller() {
    const { addNotification } = useNotifications();
    const { leads } = useLeads();

    useEffect(() => {
        // Lembretes automáticos de temperatura foram desativados (geravam excesso de avisos)
        const isTemperatureReminder = (title?: string | null) =>
            (title || '').startsWith('Lembrete de Follow-up (Temperatura');

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

                    const leadNames = new Map(leads.map(lead => [lead.id, lead.nome]));
                    const missingLeadIds = [...new Set(
                        dueTasks
                            .map(task => task.lead_id)
                            .filter((leadId): leadId is string => !!leadId && !leadNames.has(leadId))
                    )];

                    if (missingLeadIds.length > 0) {
                        const { data: missingLeads, error: missingLeadsError } = await supabase
                            .from('leads')
                            .select('id, nome')
                            .in('id', missingLeadIds);

                        if (missingLeadsError) {
                            console.error('❌ [GLOBAL POLLING] Error fetching reminder lead names:', missingLeadsError);
                        } else {
                            missingLeads?.forEach(lead => leadNames.set(lead.id, lead.nome));
                        }
                    }

                    const paraPopup: LembreteVencido[] = [];
                    for (const task of dueTasks) {
                        if (isTemperatureReminder(task.title)) continue;
                        if (notifiedTasks.includes(task.id)) {
                            console.log('⏭️ [GLOBAL POLLING] Skipping already notified task:', task.id);
                            continue;
                        }

                        // Find the associated lead to get the name
                        const leadName = task.lead_id
                            ? leadNames.get(task.lead_id) || 'Lead não encontrado'
                            : 'Sem lead associado';

                        console.log('🔔 [GLOBAL POLLING] Creating notification for task:', task.id, task.title);

                        addNotification({
                            type: 'warning',
                            title: `Lembrete: ${task.title} - ${leadName}`,
                            message: `Lead: ${leadName}. Este lembrete venceu às ${new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
                            leadId: task.lead_id
                        });

                        // Pop-up na tela: só para o que venceu agora há pouco (até 2 h), não para atrasados antigos
                        if (Date.now() - new Date(task.due_date).getTime() <= 2 * 60 * 60 * 1000) {
                            paraPopup.push({
                                id: task.id,
                                titulo: task.title,
                                descricao: task.description,
                                leadId: task.lead_id,
                                leadNome: task.lead_id ? leadName : null,
                                vence: task.due_date,
                            });
                        }

                        // Add to local storage to avoid notifying again
                        notifiedTasks.push(task.id);
                    }

                    localStorage.setItem('notified_tasks', JSON.stringify(notifiedTasks));
                    mostrarLembretesNoPopup(paraPopup);
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
