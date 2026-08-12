import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Eye, 
  FileText, 
  XCircle,
  CalendarCheck,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusNodeData {
  label: string;
  type: 'visit_scheduled' | 'visited' | 'proposal' | 'approved' | 'rejected' | 'pending' | 'liked' | 'disliked';
  date?: string;
}

function StatusNode({ data, selected }: NodeProps<StatusNodeData>) {
  const getConfig = () => {
    switch (data.type) {
      case 'visit_scheduled':
        return {
          icon: CalendarCheck,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10 border-blue-500/50',
          dotColor: 'bg-blue-500'
        };
      case 'visited':
        return {
          icon: Eye,
          color: 'text-green-500',
          bg: 'bg-green-500/10 border-green-500/50',
          dotColor: 'bg-green-500'
        };
      case 'proposal':
        return {
          icon: FileText,
          color: 'text-purple-500',
          bg: 'bg-purple-500/10 border-purple-500/50',
          dotColor: 'bg-purple-500'
        };
      case 'approved':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10 border-emerald-500/50',
          dotColor: 'bg-emerald-500'
        };
      case 'rejected':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10 border-red-500/50',
          dotColor: 'bg-red-500'
        };
      case 'liked':
        return {
          icon: ThumbsUp,
          color: 'text-green-500',
          bg: 'bg-green-500/10 border-green-500/50',
          dotColor: 'bg-green-500'
        };
      case 'disliked':
        return {
          icon: ThumbsDown,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10 border-orange-500/50',
          dotColor: 'bg-orange-500'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-500',
          bg: 'bg-gray-500/10 border-gray-500/50',
          dotColor: 'bg-gray-500'
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 shadow-md cursor-pointer transition-all duration-200',
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
        <span className="text-sm font-medium text-foreground">{data.label}</span>
      </div>

      {data.date && (
        <div className="flex items-center gap-1 mt-1">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{data.date}</span>
        </div>
      )}
    </div>
  );
}

export default memo(StatusNode);
