import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Lead {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    status: string;
    empreendimento_id?: string; // Foreign key
    tags?: string[];
    dataCadastro?: string; // Mapped from created_at
    origem?: string;
    created_at?: string;
    observacoes?: string;
    temperatura?: 'quente' | 'morno' | 'frio';
    ultimo_contato?: string;
    // Helper fields that might be joined
    empreendimento?: {
        nome: string;
    };
    journey_map_data?: {
        nodes: any[];
        edges?: any[];
    };
}

interface LeadsContextType {
    leads: Lead[];
    getLeadById: (id: string) => Lead | undefined;
    updateLead: (id: string, newData: Partial<Lead>) => void;
    addLead: (lead: Lead) => void;
    deleteLead: (id: string) => void;
    setAllLeads: (leads: Lead[]) => void;
    refreshLeads: () => Promise<void>;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export function LeadsProvider({ children }: { children: ReactNode }) {
    const [leads, setLeads] = useState<Lead[]>([]);

    const fetchLeads = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('leads')
                .select(`
                    *,
                    empreendimento:empreendimentos(nome)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching leads:', error);
                return;
            }

            if (data) {
                setLeads(data);
            }
        } catch (error) {
            console.error('Unexpected error fetching leads:', error);
        }
    };

    useEffect(() => {
        fetchLeads();

        // Setup realtime subscription
        const channel = supabase
            .channel('public:leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchLeads();
            })
            .subscribe();

        const handleRefresh = () => fetchLeads();
        window.addEventListener('refreshLeads', handleRefresh);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('refreshLeads', handleRefresh);
        };
    }, []);

    const getLeadById = useCallback((id: string) => {
        return leads.find(l => l.id === id);
    }, [leads]);

    const updateLead = useCallback((id: string, newData: Partial<Lead>) => {
        setLeads(currentLeads =>
            currentLeads.map(lead =>
                lead.id === id ? { ...lead, ...newData } : lead
            )
        );
    }, []);

    const addLead = useCallback((lead: Lead) => {
        setLeads(currentLeads => [lead, ...currentLeads]);
    }, []);

    const deleteLead = useCallback((id: string) => {
        setLeads(currentLeads => currentLeads.filter(lead => lead.id !== id));
    }, []);

    const setAllLeads = useCallback((newLeads: Lead[]) => {
        setLeads(newLeads);
    }, []);

    const refreshLeads = async () => {
        await fetchLeads();
    };

    const value = {
        leads,
        getLeadById,
        updateLead,
        addLead,
        deleteLead,
        setAllLeads,
        refreshLeads
    };

    return (
        <LeadsContext.Provider value={value}>
            {children}
        </LeadsContext.Provider>
    );
}

export function useLeads() {
    const context = useContext(LeadsContext);
    if (context === undefined) {
        throw new Error('useLeads must be used within a LeadsProvider');
    }
    return context;
}
