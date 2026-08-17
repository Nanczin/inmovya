import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  X,
  RotateCcw
} from "lucide-react";

interface FilterState {
  status: string[];
  origem: string[];
  etapa: string[];
  interesse: string[];
  tags: string[];
  dataInicio: string;
  dataFim: string;
}

interface LeadFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  activeFilters: FilterState;
  empreendimentos: any[];
  availableTags: string[];
  availableOrigins: string[];
  availableStages: string[];
}

export function LeadFilters({ isOpen, onClose, onApplyFilters, activeFilters, empreendimentos, availableTags, availableOrigins, availableStages = [] }: LeadFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(activeFilters);

  // Usar empreendimentos do banco de dados
  const interesseOptions = empreendimentos.map(emp => emp.nome);

  const handleCheckboxChange = (category: keyof FilterState, value: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      [category]: checked
        ? [...(prev[category] as string[]), value]
        : (prev[category] as string[]).filter(item => item !== value)
    }));
  };

  const handleDateChange = (field: 'dataInicio' | 'dataFim', value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      origem: [],
      etapa: [],
      interesse: [],
      tags: [],
      dataInicio: "",
      dataFim: ""
    });
  };

  const applyFilters = () => {
    onApplyFilters(filters);
    onClose();
  };

  const getActiveFiltersCount = () => {
    return filters.status.length +
      filters.origem.length +
      filters.etapa.length +
      filters.interesse.length +
      filters.tags.length +
      (filters.dataInicio ? 1 : 0) +
      (filters.dataFim ? 1 : 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Leads
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()} filtro(s) ativo(s)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Origem */}
          <div>
            <Label className="text-base font-medium">Origem</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {availableOrigins.length === 0 ? (
                <div className="col-span-2 text-sm text-muted-foreground p-2">
                  Nenhuma origem encontrada
                </div>
              ) : (
                availableOrigins.map((origem) => (
                  <div key={origem} className="flex items-center space-x-2">
                    <Checkbox
                      id={`origem-${origem}`}
                      checked={filters.origem.includes(origem)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('origem', origem, checked as boolean)
                      }
                    />
                    <Label htmlFor={`origem-${origem}`} className="text-sm">
                      {origem}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Etapa do Funil */}
          <div>
            <Label className="text-base font-medium">Etapa do Funil</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {availableStages.length === 0 ? (
                <div className="col-span-2 text-sm text-muted-foreground p-2">
                  Nenhuma etapa encontrada
                </div>
              ) : (
                availableStages.map((etapa) => (
                  <div key={etapa} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${etapa}`}
                      checked={filters.status.includes(etapa)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('status', etapa, checked as boolean)
                      }
                    />
                    <Label htmlFor={`status-${etapa}`} className="text-sm">
                      {etapa}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Interesse */}
          <div>
            <Label className="text-base font-medium">Empreendimento de Interesse</Label>
            <div className="grid grid-cols-1 gap-3 mt-2 max-h-40 overflow-y-auto">
              {interesseOptions.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2">
                  Nenhum empreendimento cadastrado
                </div>
              ) : (
                interesseOptions.map((interesse) => (
                  <div key={interesse} className="flex items-center space-x-2">
                    <Checkbox
                      id={`interesse-${interesse}`}
                      checked={filters.interesse.includes(interesse)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('interesse', interesse, checked as boolean)
                      }
                    />
                    <Label htmlFor={`interesse-${interesse}`} className="text-sm">
                      {interesse}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label className="text-base font-medium">Tags</Label>
            <div className="grid grid-cols-2 gap-3 mt-2 max-h-40 overflow-y-auto">
              {availableTags.length === 0 ? (
                <div className="col-span-2 text-sm text-muted-foreground p-2">
                  Nenhuma tag encontrada nos leads
                </div>
              ) : (
                availableTags.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={filters.tags.includes(tag)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('tags', tag, checked as boolean)
                      }
                    />
                    <Label htmlFor={`tag-${tag}`} className="text-sm">
                      {tag}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>



          {/* Período de Cadastro */}
          <div>
            <Label className="text-base font-medium">Período de Cadastro</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Label htmlFor="dataInicio" className="text-sm">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => handleDateChange('dataInicio', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dataFim" className="text-sm">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => handleDateChange('dataFim', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={applyFilters} className="flex-1">
              <Filter className="w-4 h-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={clearAllFilters}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpar Tudo
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}