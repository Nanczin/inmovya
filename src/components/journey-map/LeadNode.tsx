import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { User, Flame, Snowflake, ThermometerSun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadNodeData {
  label: string;
  status: string;
  temperature: 'hot' | 'warm' | 'cold';
  phone?: string;
  email?: string;
}

function LeadNode({ data, selected }: NodeProps<LeadNodeData>) {
  const getTemperatureIcon = () => {
    switch (data.temperature) {
      case 'hot':
        return <Flame className="w-4 h-4 text-red-500" />;
      case 'warm':
        return <ThermometerSun className="w-4 h-4 text-orange-500" />;
      case 'cold':
        return <Snowflake className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTemperatureColor = () => {
    switch (data.temperature) {
      case 'hot':
        return 'from-red-500/20 to-orange-500/20 border-red-500/50';
      case 'warm':
        return 'from-orange-500/20 to-yellow-500/20 border-orange-500/50';
      case 'cold':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/50';
    }
  };

  const getStatusColor = () => {
    switch (data.status.toLowerCase()) {
      case 'novo':
        return 'bg-blue-500';
      case 'em negociação':
      case 'negociação':
        return 'bg-yellow-500';
      case 'qualificado':
        return 'bg-green-500';
      case 'perdido':
        return 'bg-red-500';
      case 'convertido':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div
      className={cn(
        'px-6 py-4 rounded-2xl border-2 bg-gradient-to-br shadow-xl cursor-pointer transition-all duration-200',
        getTemperatureColor(),
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
      )}
    >
      {/* Handles para conexões */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-primary border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-primary border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-primary border-2 border-background"
      />

      <div className="flex flex-col items-center gap-3 min-w-[160px]">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>

        {/* Nome e temperatura */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground text-lg">{data.label}</span>
          {getTemperatureIcon()}
        </div>

        {/* Status badge */}
        <div className={cn('px-3 py-1 rounded-full text-xs font-medium text-white', getStatusColor())}>
          {data.status}
        </div>

        {/* Info adicional */}
        {data.phone && (
          <span className="text-xs text-muted-foreground">{data.phone}</span>
        )}
      </div>
    </div>
  );
}

export default memo(LeadNode);
