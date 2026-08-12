import { Node, Edge } from 'reactflow';

// Tipos dos dados dos nós
export interface LeadNodeData {
  label: string;
  status: string;
  temperature: 'hot' | 'warm' | 'cold';
  phone?: string;
  email?: string;
}

export interface PropertyNodeData {
  label: string;
  thumb?: string;
  location?: string;
  status?: 'interested' | 'visited' | 'proposal' | 'rejected';
}

export interface StatusNodeData {
  label: string;
  type: 'visit_scheduled' | 'visited' | 'proposal' | 'approved' | 'rejected' | 'pending' | 'liked' | 'disliked';
  date?: string;
}

export interface ObjectionNodeData {
  label: string;
  category: 'price' | 'location' | 'size' | 'timing' | 'structure' | 'parking' | 'area' | 'other';
  count?: number;
}

export interface TouchpointNodeData {
  label: string;
  type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'video_call' | 'first_contact';
  date?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
}

// Interface para a jornada completa do lead
export interface LeadJourneyData {
  nodes: Node[];
  edges: Edge[];
}

// Função para gerar dados mockados para demonstração
export function generateMockJourneyData(leadId: string, leadName: string): LeadJourneyData {
  const nodes: Node[] = [
    // Nó central do Lead
    {
      id: `lead-${leadId}`,
      type: 'leadNode',
      position: { x: 400, y: 50 },
      data: {
        label: leadName,
        status: 'Em Negociação',
        temperature: 'hot',
        phone: '(11) 99999-9999',
        email: 'cliente@email.com'
      }
    },
    
    // Touchpoint inicial
    {
      id: 'touchpoint-first',
      type: 'touchpointNode',
      position: { x: 150, y: 200 },
      data: {
        label: 'Primeiro Contato',
        type: 'first_contact',
        date: '15/01/2025',
        outcome: 'positive'
      }
    },

    // Reunião de alinhamento
    {
      id: 'touchpoint-meeting',
      type: 'touchpointNode',
      position: { x: 650, y: 200 },
      data: {
        label: 'Reunião Alinhamento',
        type: 'meeting',
        date: '18/01/2025',
        outcome: 'positive'
      }
    },

    // Imóvel 1
    {
      id: 'prop-1',
      type: 'propertyNode',
      position: { x: 100, y: 350 },
      data: {
        label: 'Modo Butantã',
        location: 'Butantã, SP',
        status: 'visited'
      }
    },

    // Status do imóvel 1
    {
      id: 'status-visited-1',
      type: 'statusNode',
      position: { x: 60, y: 520 },
      data: {
        label: 'Visitado',
        type: 'visited',
        date: '20/01/2025'
      }
    },

    // Gostou
    {
      id: 'status-liked-1',
      type: 'statusNode',
      position: { x: 60, y: 600 },
      data: {
        label: 'Gostou',
        type: 'liked'
      }
    },

    // Imóvel 2
    {
      id: 'prop-2',
      type: 'propertyNode',
      position: { x: 350, y: 350 },
      data: {
        label: 'Vista Alto do Ipiranga',
        location: 'Ipiranga, SP',
        status: 'rejected'
      }
    },

    // Status visita agendada imóvel 2
    {
      id: 'status-visited-2',
      type: 'statusNode',
      position: { x: 310, y: 520 },
      data: {
        label: 'Visitado',
        type: 'visited',
        date: '22/01/2025'
      }
    },

    // Objeção tamanho
    {
      id: 'objection-size',
      type: 'objectionNode',
      position: { x: 310, y: 620 },
      data: {
        label: 'Achou pequeno',
        category: 'size'
      }
    },

    // Imóvel 3
    {
      id: 'prop-3',
      type: 'propertyNode',
      position: { x: 600, y: 350 },
      data: {
        label: 'Reserva Cidade Jardim',
        location: 'Cidade Jardim, SP',
        status: 'proposal'
      }
    },

    // Visita agendada
    {
      id: 'status-scheduled-3',
      type: 'statusNode',
      position: { x: 560, y: 520 },
      data: {
        label: 'Visita Agendada',
        type: 'visit_scheduled',
        date: '25/01/2025'
      }
    },

    // Proposta enviada
    {
      id: 'status-proposal-3',
      type: 'statusNode',
      position: { x: 560, y: 600 },
      data: {
        label: 'Proposta Enviada',
        type: 'proposal',
        date: '26/01/2025'
      }
    },

    // Objeção preço (aglutinador)
    {
      id: 'objection-price',
      type: 'objectionNode',
      position: { x: 700, y: 700 },
      data: {
        label: 'Preço Alto',
        category: 'price',
        count: 2
      }
    }
  ];

  const edges: Edge[] = [
    // Lead -> Touchpoints
    {
      id: 'e-lead-touch1',
      source: `lead-${leadId}`,
      target: 'touchpoint-first',
      sourceHandle: 'left',
      animated: false,
      style: { stroke: 'hsl(var(--primary))' }
    },
    {
      id: 'e-lead-touch2',
      source: `lead-${leadId}`,
      target: 'touchpoint-meeting',
      sourceHandle: 'right',
      animated: false,
      style: { stroke: 'hsl(var(--primary))' }
    },

    // Lead -> Imóveis
    {
      id: 'e-lead-prop1',
      source: `lead-${leadId}`,
      target: 'prop-1',
      animated: true,
      style: { stroke: 'hsl(var(--accent))' }
    },
    {
      id: 'e-lead-prop2',
      source: `lead-${leadId}`,
      target: 'prop-2',
      animated: true,
      style: { stroke: 'hsl(var(--accent))' }
    },
    {
      id: 'e-lead-prop3',
      source: `lead-${leadId}`,
      target: 'prop-3',
      animated: true,
      style: { stroke: 'hsl(var(--accent))' }
    },

    // Imóvel 1 -> Status
    {
      id: 'e-prop1-status1',
      source: 'prop-1',
      target: 'status-visited-1',
      style: { stroke: 'hsl(var(--muted-foreground))' }
    },
    {
      id: 'e-status1-liked',
      source: 'status-visited-1',
      target: 'status-liked-1',
      style: { stroke: 'hsl(142 76% 36%)' }
    },

    // Imóvel 2 -> Status -> Objeção
    {
      id: 'e-prop2-status2',
      source: 'prop-2',
      target: 'status-visited-2',
      style: { stroke: 'hsl(var(--muted-foreground))' }
    },
    {
      id: 'e-status2-objection',
      source: 'status-visited-2',
      target: 'objection-size',
      style: { stroke: 'hsl(0 84% 60%)' },
      label: 'Motivo'
    },

    // Imóvel 3 -> Status chain
    {
      id: 'e-prop3-scheduled',
      source: 'prop-3',
      target: 'status-scheduled-3',
      style: { stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '5,5' },
      animated: true
    },
    {
      id: 'e-scheduled-proposal',
      source: 'status-scheduled-3',
      target: 'status-proposal-3',
      style: { stroke: 'hsl(270 50% 60%)' }
    },

    // Proposta -> Objeção preço
    {
      id: 'e-proposal-objection',
      source: 'status-proposal-3',
      target: 'objection-price',
      style: { stroke: 'hsl(0 84% 60%)', strokeDasharray: '5,5' },
      label: 'Negociando'
    }
  ];

  return { nodes, edges };
}

// Tipos de nós disponíveis
export const nodeTypes = {
  leadNode: 'leadNode',
  propertyNode: 'propertyNode', 
  statusNode: 'statusNode',
  objectionNode: 'objectionNode',
  touchpointNode: 'touchpointNode'
};
