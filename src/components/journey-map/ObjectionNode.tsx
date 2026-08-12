import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  AlertTriangle, 
  DollarSign, 
  MapPin, 
  Ruler, 
  Clock,
  Building,
  Car,
  TreePine
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ObjectionNodeData {
  label: string;
  category: 'price' | 'location' | 'size' | 'timing' | 'structure' | 'parking' | 'area' | 'other';
  count?: number;
}

function ObjectionNode({ data, selected }: NodeProps<ObjectionNodeData>) {
  const getConfig = () => {
    switch (data.category) {
      case 'price':
        return {
          icon: DollarSign,
          color: 'text-red-500',
          bg: 'bg-red-500/10 border-red-500/50'
        };
      case 'location':
        return {
          icon: MapPin,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10 border-orange-500/50'
        };
      case 'size':
        return {
          icon: Ruler,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10 border-yellow-500/50'
        };
      case 'timing':
        return {
          icon: Clock,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10 border-blue-500/50'
        };
      case 'structure':
        return {
          icon: Building,
          color: 'text-purple-500',
          bg: 'bg-purple-500/10 border-purple-500/50'
        };
      case 'parking':
        return {
          icon: Car,
          color: 'text-cyan-500',
          bg: 'bg-cyan-500/10 border-cyan-500/50'
        };
      case 'area':
        return {
          icon: TreePine,
          color: 'text-green-500',
          bg: 'bg-green-500/10 border-green-500/50'
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'text-gray-500',
          bg: 'bg-gray-500/10 border-gray-500/50'
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 shadow-md cursor-pointer transition-all duration-200',
        config.bg,
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 !bg-destructive border-2 border-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-2 h-2 !bg-destructive border-2 border-background"
      />

      <div className="flex items-center gap-2">
        <div className={cn('p-1.5 rounded-full', config.bg)}>
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground block">{data.label}</span>
          {data.count && data.count > 1 && (
            <span className="text-xs text-muted-foreground">{data.count} ocorrências</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ObjectionNode);
