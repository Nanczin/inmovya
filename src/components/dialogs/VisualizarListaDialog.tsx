import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye,
  Search,
  Download,
  Filter,
  Users,
  FileSpreadsheet,
  Calendar,
  TrendingUp,
  Edit,
  Trash2,
  Check,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Lista {
  id: string;
  nome: string;
  origem: string;
  total_contatos: number;
  validados: number;
  duplicados: number;
  invalidos: number;
  created_at: string;
  updated_at: string;
  campanhas_ativas: number;
  taxa_entrega: number;
  status: string;
  descricao: string;
  configuracoes?: any;
  metadados?: any;
}

interface VisualizarListaDialogProps {
  children: React.ReactNode;
  lista: Lista;
}

// Não gerar dados fictícios - usar apenas informações reais da lista
const getContactsInfo = (lista: Lista) => {
  // Retornar apenas metadados disponíveis, sem inventar contatos
  return {
    hasRealData: false, // Indica que não temos dados reais dos contatos individuais
    totalContacts: lista.total_contatos,
    validContacts: lista.validados,
    duplicateContacts: lista.duplicados,
    invalidContacts: lista.invalidos
  };
};

export function VisualizarListaDialog({ children, lista }: VisualizarListaDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  
  const [contatos, setContatos] = useState<any[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editDados, setEditDados] = useState({ nome: '', telefone: '', email: '' });
  const { toast } = useToast();

  const carregarContatos = async () => {
    setLoadingContatos(true);
    try {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('lista_id', lista.id)
        .order('nome')
        .limit(200); // Limit to 200 for performance
      
      if (error) throw error;
      setContatos(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao carregar contatos.", variant: "destructive" });
    } finally {
      setLoadingContatos(false);
    }
  };

  useEffect(() => {
    if (open) {
      carregarContatos();
    } else {
      setContatos([]);
      setEditandoId(null);
    }
  }, [open, lista.id]);

  const iniciarEdicao = (contato: any) => {
    setEditandoId(contato.id);
    setEditDados({ nome: contato.nome, telefone: contato.telefone, email: contato.email || '' });
  };

  const salvarEdicao = async (id: string) => {
    try {
      const { error } = await supabase.from('contatos').update({
        nome: editDados.nome,
        telefone: editDados.telefone,
        email: editDados.email
      }).eq('id', id);
      if (error) throw error;
      
      setContatos(contatos.map(c => c.id === id ? { ...c, ...editDados } : c));
      setEditandoId(null);
      toast({ title: "Sucesso", description: "Contato atualizado." });
    } catch(e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao atualizar contato.", variant: "destructive" });
    }
  };

  const excluirContato = async (id: string) => {
    if (!confirm('Deseja realmente excluir este contato?')) return;
    try {
      const { error } = await supabase.from('contatos').delete().eq('id', id);
      if (error) throw error;
      
      setContatos(contatos.filter(c => c.id !== id));
      toast({ title: "Sucesso", description: "Contato excluído." });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao excluir contato.", variant: "destructive" });
    }
  };

  const contactsInfo = getContactsInfo(lista);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Válido": return "bg-success text-success-foreground";
      case "Duplicado": return "bg-warning text-warning-foreground";
      case "Inválido": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Eye className="w-5 h-5" />
            <span className="truncate">Visualizar Lista: {lista.nome}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados da Lista</TabsTrigger>
            <TabsTrigger value="analise">Análise e Estatísticas</TabsTrigger>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm sm:text-base">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-medium break-all">{lista.nome}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="font-medium">{lista.origem}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className={
                      lista.status === "Ativa" ? "bg-success text-success-foreground" :
                      lista.status === "Premium" ? "bg-primary text-primary-foreground" :
                      lista.status === "Pausada" ? "bg-warning text-warning-foreground" :
                      "bg-destructive text-destructive-foreground"
                    }>
                      {lista.status}
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Criada em:</span>
                    <span className="font-medium">{new Date(lista.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Atualizada em:</span>
                    <span className="font-medium">{new Date(lista.updated_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Dados do Arquivo {lista.configuracoes?.tipo === 'excel' ? 'Excel' : lista.configuracoes?.tipo === 'csv' ? 'CSV' : 'Importado'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm sm:text-base">
                  {lista.total_contatos > 0 ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Total Processado:</span>
                        <span className="font-bold text-primary">{lista.total_contatos.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Válidos:</span>
                        <span className="font-bold text-success">{lista.validados.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Duplicados:</span>
                        <span className="font-bold text-warning">{lista.duplicados.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Inválidos:</span>
                        <span className="font-bold text-destructive">{lista.invalidos || (lista.total_contatos - lista.validados - lista.duplicados)}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Taxa de Aproveitamento:</span>
                        <span className="font-bold">{((lista.validados / lista.total_contatos) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Campanhas Ativas:</span>
                        <span className="font-bold">{lista.campanhas_ativas}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <span className="text-muted-foreground">Nenhum dado de importação disponível</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {lista.descricao && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Descrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm sm:text-base break-words">{lista.descricao}</p>
                </CardContent>
              </Card>
            )}

            {lista.configuracoes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Configurações de Importação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm sm:text-base">
                  {lista.configuracoes.tipo && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Tipo de arquivo:</span>
                      <span className="font-medium uppercase">{lista.configuracoes.tipo}</span>
                    </div>
                  )}
                  {lista.configuracoes.separador && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Separador:</span>
                      <span className="font-medium">{lista.configuracoes.separador === ',' ? 'Vírgula' : lista.configuracoes.separador === ';' ? 'Ponto e vírgula' : 'Tab'}</span>
                    </div>
                  )}
                  {lista.configuracoes.temCabecalho !== undefined && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Cabeçalho:</span>
                      <span className="font-medium">{lista.configuracoes.temCabecalho ? 'Sim' : 'Não'}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {lista.metadados && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Metadados do Arquivo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm sm:text-base">
                  {lista.metadados.arquivoOriginal && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Arquivo original:</span>
                      <span className="font-medium break-all">{lista.metadados.arquivoOriginal}</span>
                    </div>
                  )}
                  {lista.metadados.tamanhoArquivo && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Tamanho:</span>
                      <span className="font-medium">{(lista.metadados.tamanhoArquivo / 1024).toFixed(1)} KB</span>
                    </div>
                  )}
                  {lista.metadados.dataImportacao && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Data de importação:</span>
                      <span className="font-medium">{new Date(lista.metadados.dataImportacao).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analise" className="space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Qualidade dos Dados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Válidos</span>
                      <span className="font-medium">{lista.total_contatos > 0 ? ((lista.validados / lista.total_contatos) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-success h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${lista.total_contatos > 0 ? (lista.validados / lista.total_contatos) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                    Duplicação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Duplicados</span>
                      <span className="font-medium">{lista.total_contatos > 0 ? ((lista.duplicados / lista.total_contatos) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-warning h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${lista.total_contatos > 0 ? (lista.duplicados / lista.total_contatos) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                    Taxa de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-accent">{lista.taxa_entrega}%</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Estimativa real</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Recomendações Baseadas em Dados Reais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lista.duplicados > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">Duplicados detectados</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Execute a limpeza de dados para remover {lista.duplicados.toLocaleString('pt-BR')} contatos duplicados
                      </div>
                    </div>
                  </div>
                )}
                
                {lista.invalidos > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">Contatos inválidos encontrados</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {lista.invalidos.toLocaleString('pt-BR')} contatos precisam de revisão ou remoção
                      </div>
                    </div>
                  </div>
                )}

                {lista.taxa_entrega >= 80 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-success mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">Excelente qualidade de dados</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Esta lista está pronta para campanhas de marketing
                      </div>
                    </div>
                  </div>
                )}

                {lista.taxa_entrega < 50 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">Baixa qualidade de dados</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Recomendamos revisar e limpar os dados antes de usar em campanhas
                      </div>
                    </div>
                  </div>
                )}

                {lista.total_contatos === 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-muted">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">Lista vazia</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Esta lista não possui contatos. Importe um arquivo ou adicione contatos manualmente.
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contatos" className="space-y-4 overflow-y-auto max-h-[70vh]">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Contatos da Lista
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingContatos ? (
                  <div className="text-center py-4">Carregando contatos...</div>
                ) : contatos.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">Nenhum contato encontrado.</div>
                ) : (
                  <div className="space-y-3">
                    {contatos.map(contato => (
                      <div key={contato.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-muted/50 border gap-3">
                        {editandoId === contato.id ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                            <Input 
                              value={editDados.nome} 
                              onChange={e => setEditDados({...editDados, nome: e.target.value})}
                              placeholder="Nome"
                            />
                            <Input 
                              value={editDados.telefone} 
                              onChange={e => setEditDados({...editDados, telefone: e.target.value})}
                              placeholder="Telefone"
                            />
                            <Input 
                              value={editDados.email} 
                              onChange={e => setEditDados({...editDados, email: e.target.value})}
                              placeholder="Email"
                            />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <div className="font-medium">{contato.nome}</div>
                            <div className="text-sm text-muted-foreground flex gap-3">
                              <span>{contato.telefone}</span>
                              {contato.email && <span>• {contato.email}</span>}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                          {editandoId === contato.id ? (
                            <>
                              <Button size="sm" variant="default" onClick={() => salvarEdicao(contato.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(contato)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => excluirContato(contato.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}