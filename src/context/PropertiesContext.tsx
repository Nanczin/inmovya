import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Property {
    id: string;
    name: string;
    address: string;
    image: string;
    price: string;
    status?: string;
    description?: string;
    amenities?: string[];
    details?: {
        bedrooms?: string;
        bathrooms?: string;
        parking?: string;
        area?: string;
        suites?: string;
    };
    commercial?: {
        delivery?: string;
        unitsTotal?: number;
        unitsSold?: number;
    };
}

interface PropertiesContextType {
    properties: Property[];
    addProperty: (property: Property) => void;
    refreshProperties: () => Promise<void>;
}

const PropertiesContext = createContext<PropertiesContextType | undefined>(undefined);

export function PropertiesProvider({ children }: { children: ReactNode }) {
    const [properties, setProperties] = useState<Property[]>([]);

    const formatCurrency = (value: number | null) => {
        if (!value) return 'Sob Consulta';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const fetchProperties = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setProperties([]);
                return;
            }

            const { data, error } = await supabase
                .from('empreendimentos')
                .select('*')
                .eq('user_id', user.id)
                .order('nome');

            if (error) {
                console.error('Error fetching properties:', error);
                return;
            }

            if (data) {
                const mappedProperties: Property[] = data.map(emp => ({
                    id: emp.id,
                    name: emp.nome,
                    address: emp.endereco || `${emp.cidade || ''} - ${emp.estado || ''}`.replace(/^ - /, ''),
                    image: emp.imagem_principal || '',
                    price: formatCurrency(emp.valor_inicial),
                    status: emp.status || '',
                    description: emp.descricao || '',
                    amenities: emp.comodidades || [],
                    diferenciais: emp.diferenciais || [],
                    precos_por_tipologia: emp.precos_por_tipologia || [],
                    plantas: emp.precos_por_tipologia || [],
                    tags: emp.tags || [],
                    details: {
                        bedrooms: emp.dormitorios?.toString() || '',
                        bathrooms: emp.banheiros?.toString() || '',
                        parking: emp.vagas?.toString() || '',
                        area: emp.area_privativa ? `${emp.area_privativa}m²` : '',
                        suites: emp.suites?.toString() || ''
                    },
                    commercial: {
                        delivery: emp.data_lancamento_texto || emp.data_lancamento,
                        unitsTotal: emp.unidades,
                        unitsSold: emp.vendidas
                    }
                }));
                setProperties(mappedProperties);
            }
        } catch (err) {
            console.error('Unexpected error fetching properties:', err);
        }
    };

    useEffect(() => {
        fetchProperties();

        // Subscribe to changes in empreendimentos table
        const channel = supabase
            .channel('public:empreendimentos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'empreendimentos' }, () => {
                fetchProperties();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addProperty = (property: Property) => {
        // This is mainly for client-side optimistic UI if needed, 
        // but since we rely on Supabase, the subscription handles updates.
        setProperties(currentProps => [...currentProps, property]);
    };

    const refreshProperties = async () => {
        await fetchProperties();
    };

    return (
        <PropertiesContext.Provider value={{ properties, addProperty, refreshProperties }}>
            {children}
        </PropertiesContext.Provider>
    );
}

export function useProperties() {
    const context = useContext(PropertiesContext);
    if (context === undefined) {
        throw new Error('useProperties must be used within a PropertiesProvider');
    }
    return context;
}
