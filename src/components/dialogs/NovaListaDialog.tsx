import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Upload, 
  FileSpreadsheet, 
  Database, 
  TrendingUp, 
  Edit,
  Mail,
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NovaListaDialogProps {
  children: React.ReactNode;
  onListaCreated: (lista: any) => void;
}

export function NovaListaDialog({ children, onListaCreated }: NovaListaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState(1); // 1: Dados Básicos, 2: Origem, 3: Configurações
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    origem: "",
    configuracoes: {
      validarEmails: true,
      removerDuplicados: true,
      formatarNomes: true,
      notificarPorEmail: false
    },
    metadados: {
      tags: [],
      categoria: "",
      prioridade: "normal"
    }
  });

  const { toast } = useToast();

  const origensDisponiveis = [
    {
      id: "csv",
      nome: "Importação CSV",
      descricao: "Carregar lista a partir de arquivo CSV",
      icon: <FileSpreadsheet className="w-5 h-5" />,
      color: "text-primary"
    },
    {
      id: "excel",
      nome: "Importação Excel",
      descricao: "Carregar lista a partir de arquivo Excel",
      icon: <FileSpreadsheet className="w-5 h-5" />,
      color: "text-primary"
    },
    {
      id: "crm",
      nome: "CRM Externo",
      descricao: "Sincronizar com sistema CRM",
      icon: <Database className="w-5 h-5" />,
      color: "text-accent"
    },
    {
      id: "landing",
      nome: "Landing Page",
      descricao: "Capturar leads de página específica",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-success"
    },
    {
      id: "manual",
      nome: "Entrada Manual",
      descricao: "Adicionar contatos manualmente",
      icon: <Edit className="w-5 h-5" />,
      color: "text-warning"
    },
    {
      id: "api",
      nome: "API/Webhooks",
      descricao: "Integração via API externa",
      icon: <Mail className="w-5 h-5" />,
      color: "text-purple-500"
    }
  ];

  const categorias = [
    "Leads Qualificados",
    "Prospects Frios",
    "Clientes Ativos",
    "Reativação",
    "VIP/Premium",
    "Blacklist",
    "Teste/Desenvolvimento"
  ];

  const prioridades = [
    { valor: "baixa", label: "Baixa", color: "text-muted-foreground" },
    { valor: "normal", label: "Normal", color: "text-foreground" },
    { valor: "alta", label: "Alta", color: "text-warning" },
    { valor: "urgente", label: "Urgente", color: "text-destructive" }
  ];

  const handleProximaEtapa = () => {
    if (etapa === 1) {
      if (!formData.nome.trim()) {
        toast({
          variant: "destructive",
          title: "Nome obrigatório",
          description: "Digite um nome para a lista"
        });
        return;
      }
    }
    
    if (etapa === 2) {
      if (!formData.origem) {
        toast({
          variant: "destructive",
          title: "Origem obrigatória",
          description: "Selecione como os contatos serão adicionados"
        });
        return;
      }
    }

    setEtapa(prev => prev + 1);
  };

  const handleCriarLista = async () => {
    setLoading(true);

    try {
      const novaLista = {
        nome: formData.nome,
        descricao: formData.descricao,
        origem: origensDisponiveis.find(o => o.id === formData.origem)?.nome || "Manual",
        totalContatos: 0,
        validados: 0,
        duplicados: 0,
        invalidos: 0,
        campanhasAtivas: 0,
        taxa_entrega: 0,
        status: "Ativa",
        configuracoes: formData.configuracoes,
        metadados: formData.metadados
      };

      onListaCreated(novaLista);
      setOpen(false);
      resetForm();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao criar a lista"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      origem: "",
      configuracoes: {
        validarEmails: true,
        removerDuplicados: true,
        formatarNomes: true,
        notificarPorEmail: false
      },
      metadados: {
        tags: [],
        categoria: "",
        prioridade: "normal"
      }
    });
    setEtapa(1);
  };

  const renderEtapa1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
        <h3 className="text-lg font-semibold">Informações Básicas</h3>
      </div>

      <div>
        <Label htmlFor="nome">Nome da Lista *</Label>
        <Input
          id="nome"
          placeholder="Ex: Leads Qualificados - Fevereiro 2024"
          value={formData.nome}
          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          placeholder="Descreva o propósito desta lista..."
          value={formData.descricao}
          onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
          className="min-h-[80px]"
        />
      </div>

      <div>
        <Label htmlFor="categoria">Categoria</Label>
        <Select 
          value={formData.metadados.categoria} 
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            metadados: { ...prev.metadados, categoria: value }
          }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((categoria) => (
              <SelectItem key={categoria} value={categoria}>
                {categoria}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="prioridade">Prioridade</Label>
        <Select 
          value={formData.metadados.prioridade} 
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            metadados: { ...prev.metadados, prioridade: value }
          }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a prioridade" />
          </SelectTrigger>
          <SelectContent>
            {prioridades.map((prioridade) => (
              <SelectItem key={prioridade.valor} value={prioridade.valor}>
                <span className={prioridade.color}>{prioridade.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderEtapa2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
        <h3 className="text-lg font-semibold">Origem dos Contatos</h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {origensDisponiveis.map((origem) => (
          <Card 
            key={origem.id} 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              formData.origem === origem.id 
                ? 'ring-2 ring-primary shadow-md' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => setFormData(prev => ({ ...prev, origem: origem.id }))}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${origem.color}`}>
                  {origem.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{origem.nome}</div>
                  <div className="text-sm text-muted-foreground">{origem.descricao}</div>
                </div>
                {formData.origem === origem.id && (
                  <CheckCircle className="w-5 h-5 text-primary" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {formData.origem && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary mt-0.5" />
            <div className="text-sm">
              <strong>Configure a origem selecionada:</strong>
            </div>
          </div>
          
          {formData.origem === 'csv' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="csv-upload">Selecione o arquivo CSV</Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  placeholder="Escolha um arquivo CSV..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Formato aceito: .csv com colunas Nome, Email, Telefone
              </p>
            </div>
          )}
          
          {formData.origem === 'excel' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="excel-upload">Selecione o arquivo Excel</Label>
                <Input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  placeholder="Escolha um arquivo Excel..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Formato aceito: .xlsx ou .xls com colunas Nome, Email, Telefone
              </p>
            </div>
          )}
          
          {formData.origem === 'crm' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="crm-url">URL da API do CRM</Label>
                <Input
                  id="crm-url"
                  placeholder="https://api.seucrm.com/contacts"
                />
              </div>
              <div>
                <Label htmlFor="crm-token">Token de Acesso</Label>
                <Input
                  id="crm-token"
                  type="password"
                  placeholder="Digite o token de acesso..."
                />
              </div>
            </div>
          )}
          
          {formData.origem === 'landing' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="landing-url">URL da Landing Page</Label>
                <Input
                  id="landing-url"
                  placeholder="https://seusite.com/landing"
                />
              </div>
              <div>
                <Label htmlFor="landing-form">ID do Formulário</Label>
                <Input
                  id="landing-form"
                  placeholder="contact-form-1"
                />
              </div>
            </div>
          )}
          
          {formData.origem === 'manual' && (
            <div className="space-y-3">
              <p className="text-sm">
                A lista será criada vazia. Você poderá adicionar contatos manualmente após a criação.
              </p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm text-success">Pronto para criar a lista</span>
              </div>
            </div>
          )}
          
          {formData.origem === 'api' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="webhook-url">URL do Webhook</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://seusite.com/webhook"
                  readOnly
                  value="https://sua-api.supabase.co/functions/v1/webhook-contatos"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use esta URL para enviar contatos via POST request
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderEtapa3 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
        <h3 className="text-lg font-semibold">Configurações</h3>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-medium">Processamento Automático</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Validar Emails</div>
                <div className="text-sm text-muted-foreground">Verificar formato e validade dos emails</div>
              </div>
              <Switch
                checked={formData.configuracoes.validarEmails}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    configuracoes: { ...prev.configuracoes, validarEmails: checked }
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Remover Duplicados</div>
                <div className="text-sm text-muted-foreground">Identificar e remover contatos duplicados</div>
              </div>
              <Switch
                checked={formData.configuracoes.removerDuplicados}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    configuracoes: { ...prev.configuracoes, removerDuplicados: checked }
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Formatar Nomes</div>
                <div className="text-sm text-muted-foreground">Padronizar capitalização dos nomes</div>
              </div>
              <Switch
                checked={formData.configuracoes.formatarNomes}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    configuracoes: { ...prev.configuracoes, formatarNomes: checked }
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Notificar por Email</div>
                <div className="text-sm text-muted-foreground">Enviar notificações sobre a lista</div>
              </div>
              <Switch
                checked={formData.configuracoes.notificarPorEmail}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    configuracoes: { ...prev.configuracoes, notificarPorEmail: checked }
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h4 className="font-medium mb-3">Resumo da Lista</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome:</span>
              <span className="font-medium">{formData.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Origem:</span>
              <span className="font-medium">
                {origensDisponiveis.find(o => o.id === formData.origem)?.nome}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categoria:</span>
              <span className="font-medium">{formData.metadados.categoria || "Não definida"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prioridade:</span>
              <span className="font-medium">
                {prioridades.find(p => p.valor === formData.metadados.prioridade)?.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Nova Lista de Contatos
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step === etapa 
                      ? 'bg-primary text-primary-foreground' 
                      : step < etapa 
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {step < etapa ? <CheckCircle className="w-4 h-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-8 h-0.5 ${
                      step < etapa ? 'bg-success' : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          {etapa === 1 && renderEtapa1()}
          {etapa === 2 && renderEtapa2()}
          {etapa === 3 && renderEtapa3()}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-border">
          <div>
            {etapa > 1 && (
              <Button variant="outline" onClick={() => setEtapa(prev => prev - 1)}>
                Anterior
              </Button>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            
            {etapa < 3 ? (
              <Button onClick={handleProximaEtapa}>
                Próximo
              </Button>
            ) : (
              <Button onClick={handleCriarLista} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar Lista
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}