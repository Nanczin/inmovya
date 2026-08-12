import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EditarListaDialog } from "@/components/dialogs/EditarListaDialog";
import { VisualizarListaDialog } from "@/components/dialogs/VisualizarListaDialog";
import { ImportarListaDialog } from "@/components/dialogs/ImportarListaDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Upload,
  Search,
  Filter,
  Mail,
  Users,
  Download,
  Eye,
  Edit,
  Trash2,
  FileSpreadsheet,
  Calendar,
  Database,
  TrendingUp,
  X,
  ChevronDown
} from "lucide-react";

interface MailingModuleProps {
  onModuleChange?: (module: string) => void;
}

export function MailingModule({ onModuleChange }: MailingModuleProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    periodo: "todos"
  });
  const [listas, setListas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    carregarListas();
  }, []);

  const carregarListas = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('listas_contatos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setListas(data || []);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as listas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLimparDados = async (listaId: number) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    toast({
      title: "Iniciando limpeza de dados",
      description: `Processando lista: ${lista.nome}`,
    });

    // Simular processo de limpeza
    setTimeout(() => {
      setListas(prev => prev.map(l => {
        if (l.id === listaId) {
          const duplicadosRemovidos = Math.floor(l.duplicados * 0.8);
          const invalidosRemovidos = Math.floor((l.total_contatos - l.validados) * 0.6);
          const novoTotal = l.total_contatos - duplicadosRemovidos - invalidosRemovidos;
          const novosValidados = l.validados + invalidosRemovidos;

          return {
            ...l,
            total_contatos: novoTotal,
            validados: novosValidados,
            duplicados: l.duplicados - duplicadosRemovidos,
            updated_at: new Date().toISOString(),
            taxa_entrega: Math.min(100, ((novosValidados / novoTotal) * 100))
          };
        }
        return l;
      }));

      toast({
        title: "Limpeza concluída!",
        description: `Dados da lista "${lista.nome}" foram otimizados`,
        variant: "default",
      });
    }, 2000);
  };

  const handleExportarLista = async (listaId: number) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    toast({
      title: "Iniciando exportação",
      description: `Preparando dados da lista: ${lista.nome}`,
    });

    // Simular processo de exportação
    setTimeout(() => {
      // Criar dados CSV simulados
      const csvHeader = "Nome,Email,Telefone,Status,Origem,Data_Criacao\n";
      const csvData = Array.from({ length: lista.validados }, (_, i) =>
        `Lead ${i + 1},lead${i + 1}@email.com,+55 11 9${String(i).padStart(4, '0')}-${String(i).padStart(4, '0')},Válido,${lista.origem},${new Date(lista.created_at).toLocaleDateString()}`
      ).join('\n');

      const csvContent = csvHeader + csvData;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${lista.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Exportação concluída!",
        description: `${lista.validados} contatos exportados com sucesso`,
        variant: "default",
      });
    }, 1500);
  };

  const handleSolicitarOfertaAtiva = async (listaId: string) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    if (lista.status === "Bloqueada") {
      toast({
        title: "Ação não permitida",
        description: "Não é possível solicitar ofertas para listas bloqueadas",
        variant: "destructive",
      });
      return;
    }

    if (onModuleChange) {
      toast({
        title: "Redirecionando",
        description: "Direcionando para gestão de ofertas ativas...",
        variant: "default",
      });

      setTimeout(() => {
        onModuleChange("ligacoes");
      }, 500);
    } else {
      toast({
        title: "Função não disponível",
        description: "Redirecionamento não configurado",
        variant: "destructive",
      });
    }
  };

  const handleVisualizarLista = (listaId: number) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    toast({
      title: "Visualizando lista",
      description: `Abrindo detalhes de: ${lista.nome}`,
    });

    // Simular abertura de modal ou navegação para detalhes
    console.log("Visualizar lista:", lista);
  };

  const handleEditarLista = (listaId: number) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    toast({
      title: "Editando lista",
      description: `Abrindo editor para: ${lista.nome}`,
    });

    // Simular abertura de modal de edição
    console.log("Editar lista:", lista);
  };

  const handleDownloadLista = (listaId: number) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    toast({
      title: "Preparando download",
      description: `Gerando arquivo da lista: ${lista.nome}`,
    });

    // Simular processo de download
    setTimeout(() => {
      const jsonData = {
        id: lista.id,
        nome: lista.nome,
        origem: lista.origem,
        total_contatos: lista.total_contatos,
        validados: lista.validados,
        duplicados: lista.duplicados,
        created_at: lista.created_at,
        updated_at: lista.updated_at,
        campanhas_ativas: lista.campanhas_ativas,
        taxa_entrega: lista.taxa_entrega,
        status: lista.status,
        descricao: lista.descricao
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `lista_${lista.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Download concluído!",
        description: `Arquivo da lista "${lista.nome}" baixado com sucesso`,
        variant: "default",
      });
    }, 1000);
  };

  const handleExcluirLista = async (listaId: string) => {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;

    if (lista.campanhas_ativas > 0) {
      toast({
        title: "Não é possível excluir",
        description: "Esta lista possui campanhas ativas. Finalize-as antes de excluir.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('listas_contatos')
        .delete()
        .eq('id', listaId);

      if (error) throw error;

      setListas(prev => prev.filter(l => l.id !== listaId));

      toast({
        title: "Lista excluída",
        description: `A lista "${lista.nome}" foi excluída com sucesso`,
      });
    } catch (error) {
      console.error('Erro ao excluir lista:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a lista",
        variant: "destructive",
      });
    }
  };

  const handleNovaLista = async (novaLista: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro de autenticação", description: "Faça login para criar listas.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from('listas_contatos')
        .insert({
          user_id: user.id,
          nome: novaLista.nome,
          descricao: novaLista.descricao,
          origem: novaLista.origem,
          total_contatos: novaLista.total_contatos || novaLista.totalContatos || 0,
          validados: novaLista.validados || 0,
          duplicados: novaLista.duplicados || 0,
          invalidos: novaLista.invalidos || 0,
          campanhas_ativas: novaLista.campanhas_ativas || novaLista.campanhasAtivas || 0,
          taxa_entrega: novaLista.taxa_entrega || 0,
          status: novaLista.status || 'Ativa',
          configuracoes: novaLista.configuracoes,
          metadados: novaLista.metadados
        })
        .select()
        .single();

      if (error) throw error;

      // Se temos contatos para inserir, salvá-los na tabela contatos
      if (novaLista.metadados?.contatos && novaLista.metadados.contatos.length > 0) {
        const contatosParaInserir = novaLista.metadados.contatos.map((contato: any) => ({
          user_id: user.id,
          nome: contato.nome,
          telefone: contato.telefone,
          email: contato.email || null,
          lista_id: data.id,
          status: 'ativo',
          dados_extras: {
            linha_original: contato.linha,
            dados_originais: contato.dadosOriginais
          }
        }));

        const { error: contatosError } = await supabase
          .from('contatos')
          .insert(contatosParaInserir);

        if (contatosError) {
          console.error('Erro ao inserir contatos:', contatosError);
          toast({
            title: "Aviso",
            description: "Lista criada, mas alguns contatos podem não ter sido salvos",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Lista criada com sucesso!",
            description: `A lista "${data.nome}" foi criada com ${contatosParaInserir.length} contatos`,
          });
        }
      } else {
        toast({
          title: "Lista criada com sucesso!",
          description: `A lista "${data.nome}" foi criada`,
        });
      }

      setListas(prev => [data, ...prev]);

    } catch (error) {
      console.error('Erro ao criar lista:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a lista",
        variant: "destructive",
      });
    }
  };

  const handleListaAtualizada = async (listaAtualizada: any) => {
    try {
      const { error } = await supabase
        .from('listas_contatos')
        .update({
          nome: listaAtualizada.nome,
          descricao: listaAtualizada.descricao,
          status: listaAtualizada.status,
          origem: listaAtualizada.origem,
          updated_at: new Date().toISOString()
        })
        .eq('id', listaAtualizada.id);

      if (error) throw error;

      setListas(prev => prev.map(l => l.id === listaAtualizada.id ? listaAtualizada : l));

      toast({
        title: "Lista salva!",
        description: `As alterações foram salvas no banco de dados`,
      });
    } catch (error) {
      console.error('Erro ao salvar lista:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativa": return "bg-success text-success-foreground";
      case "Premium": return "bg-primary text-primary-foreground";
      case "Bloqueada": return "bg-destructive text-destructive-foreground";
      case "Pausada": return "bg-warning text-warning-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getOrigemIcon = (origem: string) => {
    switch (origem) {
      case "Importação CSV": return <FileSpreadsheet className="w-4 h-4" />;
      case "CRM Externo": return <Database className="w-4 h-4" />;
      case "Landing Page": return <TrendingUp className="w-4 h-4" />;
      case "Manual": return <Edit className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const filteredListas = listas.filter(lista => {
    const matchesSearch = lista.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lista.origem.toLowerCase().includes(searchTerm.toLowerCase());



    let matchesPeriodo = true;
    if (filters.periodo && filters.periodo !== "todos") {
      const dataLista = new Date(lista.created_at);
      const agora = new Date();

      if (filters.periodo === "7d") {
        const diffTime = Math.abs(agora.getTime() - dataLista.getTime());
        matchesPeriodo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 7;
      }
      else if (filters.periodo === "30d") {
        const diffTime = Math.abs(agora.getTime() - dataLista.getTime());
        matchesPeriodo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 30;
      }
      else if (filters.periodo === "mes") {
        matchesPeriodo = dataLista.getMonth() === agora.getMonth() && dataLista.getFullYear() === agora.getFullYear();
      }
    }

    return matchesSearch && matchesPeriodo;
  });

  const clearFilters = () => {
    setFilters({
      periodo: "todos"
    });
    setShowFilters(false);
  };

  const totalContatos = listas.reduce((sum, lista) => sum + lista.total_contatos, 0);
  const totalValidados = listas.reduce((sum, lista) => sum + lista.validados, 0);
  const totalCampanhas = listas.reduce((sum, lista) => sum + lista.campanhas_ativas, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="hidden md:block text-2xl font-bold text-foreground">Listas de Contatos</h2>
          <p className="text-muted-foreground">Gerencie suas bases de dados e mailing lists</p>
        </div>
        <div className="flex gap-3">
          <ImportarListaDialog onListaImportada={handleNovaLista}>
            <Button variant="outline" className="shadow-card">
              <Upload className="w-4 h-4 mr-2" />
              Importar Lista
            </Button>
          </ImportarListaDialog>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar listas por nome ou origem..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full sm:absolute sm:top-full sm:right-0 sm:w-[600px] sm:max-w-[calc(100vw-2rem)] z-50 mt-2">
              <Card className="shadow-elegant">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <h3 className="text-lg font-semibold">Filtros Avançados</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-muted-foreground hover:text-foreground self-start sm:self-auto"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Período de Criação</label>
                      <Select value={filters.periodo || "todos"} onValueChange={(value) => setFilters(prev => ({ ...prev, periodo: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todo o período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todo o período</SelectItem>
                          <SelectItem value="7d">Últimos 7 dias</SelectItem>
                          <SelectItem value="30d">Últimos 30 dias</SelectItem>
                          <SelectItem value="mes">Este mês</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between text-sm text-muted-foreground gap-2">
                    <span>Mostrando {filteredListas.length} de {listas.length} listas</span>
                    <span>{filteredListas.reduce((sum, lista) => sum + lista.total_contatos, 0).toLocaleString()} contatos filtrados</span>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{listas.length}</div>
                <div className="text-sm text-muted-foreground">Listas Ativas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-accent text-accent-foreground">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{totalContatos.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Contatos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success text-success-foreground">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{totalValidados.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Validados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists Grid */}
      <div className="space-y-4">
        {filteredListas.map((lista) => (
          <Card key={lista.id} className="shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-xl">{lista.nome}</CardTitle>
                    <Badge className={getStatusColor(lista.status)}>
                      {lista.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{lista.descricao}</p>
                </div>
                <div className="flex gap-2">
                  <VisualizarListaDialog lista={lista}>
                    <Button
                      variant="ghost"
                      size="sm"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </VisualizarListaDialog>
                  <EditarListaDialog lista={lista} onListaUpdated={handleListaAtualizada}>
                    <Button
                      variant="ghost"
                      size="sm"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </EditarListaDialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadLista(lista.id)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExcluirLista(lista.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Qualidade dos Dados</span>
                  <span className="font-medium">{lista.validados}/{lista.total_contatos} válidos</span>
                </div>
                <Progress value={lista.total_contatos > 0 ? (lista.validados / lista.total_contatos) * 100 : 0} className="h-2" />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 rounded-lg bg-gradient-card">
                  <div className="text-2xl font-bold text-primary">{lista.total_contatos.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gradient-card">
                  <div className="text-2xl font-bold text-success">{lista.validados.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Válidos</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gradient-card">
                  <div className="text-2xl font-bold text-warning">{lista.duplicados}</div>
                  <div className="text-xs text-muted-foreground">Duplicados</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gradient-card">
                  <div className="text-2xl font-bold text-accent">{lista.campanhas_ativas}</div>
                  <div className="text-xs text-muted-foreground">Campanhas</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gradient-card">
                  <div className="text-2xl font-bold text-success">{lista.taxa_entrega}%</div>
                  <div className="text-xs text-muted-foreground">Entrega</div>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {getOrigemIcon(lista.origem)}
                  <div>
                    <div className="text-sm text-muted-foreground">Origem</div>
                    <div className="font-medium">{lista.origem}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Criada em</div>
                    <div className="font-medium">{new Date(lista.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Última Atualização</div>
                    <div className="font-medium">{new Date(lista.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <Button
                  variant="default"
                  className="w-full sm:flex-1"
                  onClick={() => handleSolicitarOfertaAtiva(lista.id)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Solicitar Oferta Ativa
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:flex-1"
                  onClick={() => handleExportarLista(lista.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Lista
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:flex-1"
                  onClick={() => handleLimparDados(lista.id)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Limpar Dados
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}