import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings,
  Play,
  Pause,
  Calendar,
  Clock,
  Phone
} from "lucide-react";

interface AutomationConfig {
  intervalo_ligacoes: number;
  tentativas_maximas: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: string[];
  ativo: boolean;
}

interface AutomationConfigProps {
  config: AutomationConfig;
  onConfigChange: (config: AutomationConfig) => void;
}

export function AutomationConfig({ config, onConfigChange }: AutomationConfigProps) {
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof AutomationConfig, value: any) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const toggleDia = (dia: string) => {
    const diasAtivos = config.dias_semana.includes(dia.toLowerCase()) 
      ? config.dias_semana.filter(d => d !== dia.toLowerCase())
      : [...config.dias_semana, dia.toLowerCase()];
    
    handleInputChange('dias_semana', diasAtivos);
  };

  const startAutomation = () => {
    if (!config.horario_inicio || !config.horario_fim) {
      toast({
        title: "Configuração Incompleta",
        description: "Configure os horários de início e fim.",
        variant: "destructive",
      });
      return;
    }

    if (config.dias_semana.length === 0) {
      toast({
        title: "Configuração Incompleta",
        description: "Selecione pelo menos um dia da semana.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    handleInputChange('ativo', true);
    
    toast({
      title: "Automação Iniciada",
      description: `Ligações serão feitas a cada ${config.intervalo_ligacoes} minutos.`,
      variant: "default",
    });

    // Simular logs de automação
    console.log('Automação iniciada com configurações:', config);
  };

  const stopAutomation = () => {
    setIsRunning(false);
    handleInputChange('ativo', false);
    
    toast({
      title: "Automação Pausada",
      description: "O sistema parou de fazer ligações automaticamente.",
      variant: "default",
    });
  };

  const testSchedule = () => {
    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const [horaInicio, minInicio] = config.horario_inicio.split(':').map(Number);
    const [horaFim, minFim] = config.horario_fim.split(':').map(Number);
    const inicioMin = horaInicio * 60 + minInicio;
    const fimMin = horaFim * 60 + minFim;

    const dentroHorario = horaAtual >= inicioMin && horaAtual <= fimMin;
    const diaAtivo = config.dias_semana.includes(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][agora.getDay()]);

    const status = dentroHorario && diaAtivo ? "Ativo" : "Inativo";
    const motivo = !dentroHorario ? "fora do horário" : "dia não configurado";

    toast({
      title: `Agendamento: ${status}`,
      description: status === "Ativo" 
        ? "O sistema faria ligações agora."
        : `Sistema inativo: ${motivo}.`,
      variant: status === "Ativo" ? "default" : "destructive",
    });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Automação de Ligações
          {isRunning && (
            <div className="flex items-center gap-1 text-success">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-sm">Ativo</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="intervalo">Intervalo entre Ligações (min)</Label>
            <Input 
              id="intervalo" 
              value={config.intervalo_ligacoes} 
              onChange={(e) => handleInputChange('intervalo_ligacoes', parseInt(e.target.value))}
              type="number" 
              min="1"
              max="60"
              className="mt-1" 
            />
          </div>
          <div>
            <Label htmlFor="tentativas">Tentativas Máximas</Label>
            <Input 
              id="tentativas" 
              value={config.tentativas_maximas} 
              onChange={(e) => handleInputChange('tentativas_maximas', parseInt(e.target.value))}
              type="number" 
              min="1"
              max="10"
              className="mt-1" 
            />
          </div>
          <div>
            <Label>Status da Automação</Label>
            <div className="flex items-center gap-2 mt-1">
              <Switch 
                checked={config.ativo}
                onCheckedChange={(checked) => {
                  handleInputChange('ativo', checked);
                  setIsRunning(checked);
                }}
              />
              <span className="text-sm text-muted-foreground">
                {config.ativo ? 'Habilitada' : 'Desabilitada'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <Label>Dias da Semana</Label>
          <div className="flex gap-1 mt-2 flex-wrap">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia, index) => (
              <Button 
                key={dia} 
                variant={config.dias_semana.includes(dia.toLowerCase()) ? "default" : "outline"} 
                size="sm" 
                className="w-12 h-8 text-xs"
                onClick={() => toggleDia(dia)}
              >
                {dia}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="hora-inicio">Horário de Início</Label>
            <Input 
              id="hora-inicio" 
              value={config.horario_inicio} 
              onChange={(e) => handleInputChange('horario_inicio', e.target.value)}
              type="time" 
              className="mt-1" 
            />
          </div>
          <div>
            <Label htmlFor="hora-fim">Horário de Fim</Label>
            <Input 
              id="hora-fim" 
              value={config.horario_fim} 
              onChange={(e) => handleInputChange('horario_fim', e.target.value)}
              type="time" 
              className="mt-1" 
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button 
            variant={isRunning ? "destructive" : "success"}
            onClick={isRunning ? stopAutomation : startAutomation}
            disabled={!config.ativo}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pausar Automação
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Automação
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={testSchedule}>
            <Calendar className="w-4 h-4 mr-2" />
            Testar Agendamento
          </Button>
        </div>

        {isRunning && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 text-success">
              <Phone className="w-4 h-4" />
              <span className="font-medium">Sistema Ativo</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Próxima ligação em aproximadamente {config.intervalo_ligacoes} minutos.
              Máximo de {config.tentativas_maximas} tentativas por lead.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}