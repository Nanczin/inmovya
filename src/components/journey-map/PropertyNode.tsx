import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyNodeData {
  label: string;
  thumb?: string;
  location?: string;
  status?: 'interested' | 'visited' | 'proposal' | 'rejected';
}

function PropertyNode({ data, selected }: NodeProps<PropertyNodeData>) {
  const getStatusStyle = () => {
    switch (data.status) {
      case 'interested':
        return 'border-blue-500/50 bg-blue-500/10';
      case 'visited':
        return 'border-green-500/50 bg-green-500/10';
      case 'proposal':
        return 'border-emerald-500/50 bg-emerald-500/10';
      case 'rejected':
        return 'border-red-500/50 bg-red-500/10';
      default:
        return 'border-muted bg-muted/30';
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border-2 shadow-lg cursor-pointer transition-all duration-200 overflow-hidden bg-card',
        getStatusStyle(),
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-accent border-2 border-background"
      />

      {/* Imagem do empreendimento */}
      <div className="w-40 h-24 bg-muted relative">
        {data.thumb ? (
          <img
            src={data.thumb}
            alt={data.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <h4 className="font-semibold text-sm text-foreground truncate">{data.label}</h4>
        {data.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{data.location}</span>
          </div>
        )}
        {/* Exibir plantas/características */}
        {(data as any).plantas && (data as any).plantas.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
            {(data as any).plantas.slice(0, 2).map((planta: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="font-medium">{planta.nome || `Planta ${idx + 1}`}</span>
                {planta.dormitorios && <span>• {planta.dormitorios} dorms</span>}
                {planta.areaPrivativa && <span>• {planta.areaPrivativa}</span>}
              </div>
            ))}
            {(data as any).plantas.length > 2 && (
              <div className="text-[10px] text-muted-foreground/70">
                +{(data as any).plantas.length - 2} plantas
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PropertyNode);
