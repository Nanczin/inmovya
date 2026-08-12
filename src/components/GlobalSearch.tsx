import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  User,
  Phone,
  Mail,
  Building,
  Calendar,
  BarChart3,
  Users,
  FileText,
  Settings,
  ArrowRight
} from "lucide-react";

interface SearchResult {
  id: string;
  type: 'lead' | 'campanha' | 'empreendimento' | 'material' | 'relatorio';
  title: string;
  subtitle: string;
  module: string;
  icon: React.ReactNode;
  badge?: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (module: string, id?: string) => void;
}

export function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchData = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const searchResults: SearchResult[] = [];

      // Buscar leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .or(`nome.ilike.%${query}%,email.ilike.%${query}%,telefone.ilike.%${query}%`)
        .limit(3);

      if (leads) {
        leads.forEach(lead => {
          searchResults.push({
            id: lead.id,
            type: 'lead',
            title: lead.nome,
            subtitle: `${lead.email || 'Sem email'} • ${lead.telefone || 'Sem telefone'}`,
            module: 'leads',
            icon: <User className="w-4 h-4" />,
            badge: lead.status
          });
        });
      }

      // Buscar campanhas
      const { data: campanhas } = await supabase
        .from('campanhas')
        .select('*')
        .or(`nome.ilike.%${query}%,descricao.ilike.%${query}%`)
        .limit(3);

      if (campanhas) {
        campanhas.forEach(campanha => {
          searchResults.push({
            id: campanha.id,
            type: 'campanha',
            title: campanha.nome,
            subtitle: campanha.descricao || 'Sem descrição',
            module: 'campanhas',
            icon: <BarChart3 className="w-4 h-4" />,
            badge: campanha.status
          });
        });
      }

      // Buscar empreendimentos
      const { data: empreendimentos } = await supabase
        .from('empreendimentos')
        .select('*')
        .or(`nome.ilike.%${query}%,descricao.ilike.%${query}%,cidade.ilike.%${query}%`)
        .limit(2);

      if (empreendimentos) {
        empreendimentos.forEach(emp => {
          searchResults.push({
            id: emp.id,
            type: 'empreendimento',
            title: emp.nome,
            subtitle: `${emp.cidade || 'Sem cidade'} • ${emp.descricao || 'Sem descrição'}`,
            module: 'empreendimentos',
            icon: <Building className="w-4 h-4" />,
            badge: emp.status
          });
        });
      }

      setResults(searchResults.slice(0, 8));
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchData(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'lead': return 'Lead';
      case 'campanha': return 'Campanha';
      case 'empreendimento': return 'Empreendimento';
      case 'material': return 'Material';
      case 'relatorio': return 'Relatório';
      default: return '';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'lead': return 'bg-primary text-primary-foreground';
      case 'campanha': return 'bg-accent text-accent-foreground';
      case 'empreendimento': return 'bg-success text-success-foreground';
      case 'material': return 'bg-warning text-warning-foreground';
      case 'relatorio': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onNavigate) {
      onNavigate(result.module, result.id);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>

      <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Busca Global
          </DialogTitle>
        </DialogHeader>

        <div className="px-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar leads, campanhas, empreendimentos..."
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {searchTerm && (
            <div className="mt-4">
              {isSearching ? (
                <div className="text-center py-8 text-muted-foreground">
                  Buscando...
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-3">
                    {results.length} resultado(s) encontrado(s)
                  </div>
                  {results.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground truncate">
                              {result.title}
                            </h4>
                            {result.badge && (
                              <Badge variant="secondary" className="text-xs">
                                {result.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`text-xs ${getTypeColor(result.type)}`}>
                              {getTypeLabel(result.type)}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum resultado encontrado</p>
                  <p className="text-sm">Tente termos diferentes</p>
                </div>
              )}
            </div>
          )}

          {!searchTerm && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Busque por leads, campanhas, empreendimentos e mais...
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Leads</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Busque por nome, email ou telefone
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="font-medium">Campanhas</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Encontre campanhas ativas e pausadas
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4" />
                    <span className="font-medium">Empreendimentos</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Localize projetos e informações
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">Materiais</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Acesse plantas, preços e documentos
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}