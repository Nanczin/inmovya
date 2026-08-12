import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  Video,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TouchpointNodeData {
  label: string;
  type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'video_call' | 'first_contact';
  date?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
}

function TouchpointNode({ data, selected }: NodeProps<TouchpointNodeData>) {
  const getConfig = () => {
    switch (data.type) {
      case 'call':
        return {
          icon: Phone,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10 border-blue-500/30'
        };
      case 'email':
        return {
          icon: Mail,
          color: 'text-purple-500',
          bg: 'bg-purple-500/10 border-purple-500/30'
        };
      case 'whatsapp':
        return {
          icon: MessageSquare,
          color: 'text-green-500',
          bg: 'bg-green-500/10 border-green-500/30'
        };
      case 'meeting':
        return {
          icon: Users,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10 border-orange-500/30'
        };
      case 'video_call':
        return {
          icon: Video,
          color: 'text-cyan-500',
          bg: 'bg-cyan-500/10 border-cyan-500/30'
        };
      case 'first_contact':
        return {
          icon: Calendar,
          color: 'text-primary',
          bg: 'bg-primary/10 border-primary/30'
        };
      default:
        return {
          icon: MessageSquare,
          color: 'text-gray-500',
          bg: 'bg-gray-500/10 border-gray-500/30'
        };
    }
  };

  const getOutcomeDot = () => {
    switch (data.outcome) {
      case 'positive':
        return 'bg-green-500';
      case 'negative':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg border shadow-sm cursor-pointer transition-all duration-200',
        config.bg,
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 !bg-muted-foreground border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 !bg-muted-foreground border-2 border-background"
      />

      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', config.color)} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground block truncate">{data.label}</span>
          {data.date && (
            <span className="text-xs text-muted-foreground">{data.date}</span>
          )}
        </div>
        {data.outcome && (
          <div className={cn('w-2 h-2 rounded-full', getOutcomeDot())} />
        )}
      </div>
    </div>
  );
}

export default memo(TouchpointNode);
