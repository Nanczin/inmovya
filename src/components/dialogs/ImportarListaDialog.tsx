import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Database, X, CheckCircle, AlertCircle } from "lucide-react";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ImportarListaDialogProps {
  children: React.ReactNode;
  onListaImportada: (lista: any) => void;
}

export function ImportarListaDialog({ children, onListaImportada }: ImportarListaDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importStats, setImportStats] = useState({
    total: 0,
    validos: 0,
    duplicados: 0,
    invalidos: 0,
    amostraContatos: []
  });

  const [dados, setDados] = useState({
    nome: "",
    tipo: "csv",
    separador: ",",
    temCabecalho: true,
    mapeamento: {
      nome: 0,
      email: 1,
      telefone: 2
    }
  });

  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

      if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Formato não suportado",
          description: "Por favor, selecione um arquivo CSV ou Excel (.csv, .xls, .xlsx)",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
      setDados(prev => ({
        ...prev,
        nome: selectedFile.name.replace(/\.[^/.]+$/, ""),
        tipo: selectedFile.name.endsWith('.csv') ? 'csv' : 'excel'
      }));

      // Iniciar processamento imediato
      processarArquivo(selectedFile);
    }
  };

  const processarArquivo = async (arquivoInput?: File) => {
    const arquivoProcessar = arquivoInput || file;
    if (!arquivoProcessar) return;

    setImporting(true);
    setStep(3);
    setProgress(0);

    try {
      let contatos: any[] = [];
      let linhasData: any[][] = [];

      setProgress(10);

      // Ler arquivo (CSV ou Excel)
      if (arquivoProcessar.name.endsWith('.csv') || arquivoProcessar.type === 'text/csv') {
        await new Promise<void>((resolve, reject) => {
          Papa.parse(arquivoProcessar, {
            header: false,
            skipEmptyLines: true,
            encoding: 'UTF-8',
            complete: (results) => {
              linhasData = results.data as any[][];
              resolve();
            },
            error: reject
          });
        });
      } else {
        // Processar Excel
        const arrayBuffer = await arquivoProcessar.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const sheetName = workbook.SheetNames[0];
        linhasData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' }) as any[][];
      }

      setProgress(30);

      // Identificação Automática de Colunas e Mapeamento
      if (linhasData.length > 0) {
        // Assumir primeira linha como cabeçalho para detecção
        const headers = linhasData[0].map(h => String(h || "").toLowerCase().trim());

        const findColIndex = (terms: string[]) => headers.findIndex(h => terms.some(t => h.includes(t)));

        let idxNome = findColIndex(["nome", "name", "cliente", "lead", "pessoa", "contato"]);
        let idxEmail = findColIndex(["email", "mail", "e-mail"]);
        let idxTelefone = findColIndex(["telefone", "celular", "whatsapp", "phone", "tel", "cel", "mobile"]);

        // Estratégia de Fallback Inteligente
        if (idxNome === -1) idxNome = 0; // Se não achar nome, assume primeira coluna

        // Se não achou email, tentamos achar na primeira linha de dados
        if (idxEmail === -1 && linhasData.length > 1) {
          idxEmail = linhasData[1].findIndex(c => String(c).includes('@'));
        }

        // Se não achou telefone, tentamos achar na primeira linha de dados (apenas números)
        if (idxTelefone === -1 && linhasData.length > 1) {
          idxTelefone = linhasData[1].findIndex(c => {
             const str = String(c).replace(/\D/g, '');
             return str.length >= 8 && str.length <= 13;
          });
        }

        // Fallbacks finais se tudo falhar e assumindo a ordem: 0=Nome, 1=Telefone, 2=Email (Opcional)
        if (idxTelefone === -1) {
           idxTelefone = idxEmail === 1 ? 2 : 1;
        }

        // Se o email continuar não encontrado, deixamos como undefined (-1) ao invés de forçar coluna 1
        
        console.log(`Colunas detectadas: Nome=${idxNome}, Email=${idxEmail}, Tel=${idxTelefone}`);

        setDados(prev => ({
          ...prev,
          mapeamento: {
            nome: idxNome,
            email: idxEmail,
            telefone: idxTelefone
          }
        }));

        // Processar linhas (ignorando cabeçalho)
        const dadosLinhas = linhasData.slice(1);

        contatos = dadosLinhas.map((linha, index) => ({
          nome: (linha[idxNome] || '').toString().trim(),
          email: (linha[idxEmail] || '').toString().trim(),
          telefone: (linha[idxTelefone] || '').toString().trim(),
          linha: index + 2,
          dadosOriginais: linha
        }));
      }

      setProgress(60);

      // Filtrar vazios
      contatos = contatos.filter(c => c.nome && c.nome.length > 0);

      setProgress(70);

      // Normalizar Telefones (formato BR)
      contatos = contatos.map(contato => {
        if (!contato.telefone) return { ...contato, telefone: '' };

        let tel = contato.telefone.toString().replace(/[^\d]/g, '');
        // Adicionar DDD 11 se vier sem
        if (tel.length === 8 || tel.length === 9) tel = '11' + tel;
        // Remover 55 ou 0 inicial
        if (tel.length === 12 && tel.startsWith('55')) tel = tel.substring(2);
        if (tel.length === 13 && tel.startsWith('55')) tel = tel.substring(2);

        return { ...contato, telefone: tel };
      });

      setProgress(80);

      // Validação
      const contatosValidos = contatos.filter(c => {
        const nomeOk = c.nome && c.nome.length >= 2;
        const emailOk = !c.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email);
        const telOk = !c.telefone || (c.telefone.length >= 8 && c.telefone.length <= 13);
        return nomeOk && (emailOk || telOk);
      });

      setProgress(85);

      // Deduplicação
      const unicos = new Set();
      const duplicados: any[] = [];
      const semDuplicados: any[] = [];

      contatosValidos.forEach(c => {
        const ids = [
          c.telefone,
          c.email?.toLowerCase(),
          // c.nome?.toLowerCase() // Nome pode ser duplicado (homônimos), melhor não usar como chave única rígida
        ].filter(Boolean);

        // Se qualquer ID bater, é duplicado
        if (ids.some(id => unicos.has(id))) {
          duplicados.push(c);
        } else {
          ids.forEach(id => unicos.add(id));
          semDuplicados.push(c);
        }
      });

      setImportStats({
        total: contatos.length,
        validos: semDuplicados.length,
        duplicados: duplicados.length,
        invalidos: contatos.length - contatosValidos.length,
        amostraContatos: semDuplicados
      });

      setProgress(100);
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.error('Erro processamento:', error);
      toast({
        title: "Erro no processamento",
        description: "Falha ao ler o arquivo. Verifique o formato.",
        variant: "destructive",
      });
      setImportStats({ total: 0, validos: 0, duplicados: 0, invalidos: 0, amostraContatos: [] });
    } finally {
      setImporting(false);
      setStep(3); // Pular para resultado (era step 3 na visualização)
    }
  };

  const finalizarImportacao = async () => {
    const novaLista = {
      nome: dados.nome,
      descricao: `Lista importada do arquivo: ${file?.name}`,
      origem: "Importação CSV",
      total_contatos: importStats.total,
      validados: importStats.validos,
      duplicados: importStats.duplicados,
      invalidos: importStats.invalidos,
      campanhas_ativas: 0,
      taxa_entrega: importStats.total > 0 ? Math.floor((importStats.validos / importStats.total) * 100) : 0,
      status: "Ativa",
      configuracoes: {
        tipo: dados.tipo,
        separador: dados.separador,
        temCabecalho: dados.temCabecalho,
        mapeamento: dados.mapeamento
      },
      metadados: {
        arquivoOriginal: file?.name,
        dataImportacao: new Date().toISOString(),
        tamanhoArquivo: file?.size || 0,
        contatos: importStats.amostraContatos // Incluir os contatos processados
      }
    };

    onListaImportada(novaLista);

    // Toast específico sobre duplicados removidos
    if (importStats.duplicados > 0) {
      toast({
        title: "Lista importada com sucesso!",
        description: `${importStats.validos} contatos válidos salvos. ${importStats.duplicados} duplicados foram automaticamente removidos.`,
        variant: "default",
      });
    } else {
      toast({
        title: "Lista importada com sucesso!",
        description: `${importStats.validos} contatos válidos salvos sem duplicados.`,
        variant: "default",
      });
    }

    // Reset do estado
    setOpen(false);
    setStep(1);
    setFile(null);
    setProgress(0);
    setImportStats({ total: 0, validos: 0, duplicados: 0, invalidos: 0, amostraContatos: [] });
    setDados({
      nome: "",
      tipo: "csv",
      separador: ",",
      temCabecalho: true,
      mapeamento: { nome: 0, email: 1, telefone: 2 }
    });
  };

  const cancelarImportacao = () => {
    setOpen(false);
    setStep(1);
    setFile(null);
    setProgress(0);
    setImportStats({ total: 0, validos: 0, duplicados: 0, invalidos: 0, amostraContatos: [] });
    setDados({
      nome: "",
      tipo: "csv",
      separador: ",",
      temCabecalho: true,
      mapeamento: { nome: 0, email: 1, telefone: 2 }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Lista de Contatos
          </DialogTitle>
        </DialogHeader>

        {/* Passo 1: Seleção do arquivo */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Selecione o arquivo para importar</h3>
              <p className="text-muted-foreground text-sm">
                Aceito arquivos CSV, XLS e XLSX com contatos
              </p>
            </div>

            {/* Instruções de Formatação */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/30">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Importante para a Oferta Ativa (Ligações)
              </h5>
              <p className="mb-2">Para que os contatos apareçam perfeitamente na tela de <strong>Oferta Ativa</strong>, sua planilha deve ter cabeçalhos na 1ª linha contendo:</p>
              <ul className="list-disc list-inside space-y-1 text-xs font-medium opacity-90 mb-2">
                <li><strong>Nome</strong> (Obrigatório) - Nome do lead/cliente.</li>
                <li><strong>Telefone</strong>, <strong>Celular</strong> ou <strong>WhatsApp</strong> (Obrigatório) - O sistema formata os números automaticamente.</li>
                <li><strong>Email</strong> (Opcional).</li>
              </ul>
              <p className="text-xs opacity-80 mt-2">
                <strong>Dica de Ouro:</strong> O sistema tentará detectar essas 3 colunas automaticamente. Colunas extras na planilha (como Endereço ou Cidade) serão ignoradas na hora da ligação.
              </p>
            </div>

            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Clique para selecionar arquivo</div>
                  <div className="text-xs text-muted-foreground">ou arraste e solte aqui</div>
                </div>
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <div className="font-medium">CSV</div>
                <div className="text-xs text-muted-foreground">Arquivos separados por vírgula</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <Database className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <div className="font-medium">Excel</div>
                <div className="text-xs text-muted-foreground">Planilhas .xls e .xlsx</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                <div className="font-medium">Automático</div>
                <div className="text-xs text-muted-foreground">Detecção e validação</div>
              </div>
            </div>
          </div>
        )}

        {/* Passo 2: Configuração da importação */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              <div>
                <div className="font-medium">{file?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file?.size || 0 / 1024).toFixed(1)} KB • {dados.tipo.toUpperCase()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="ml-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da lista</Label>
                <Input
                  id="nome"
                  value={dados.nome}
                  onChange={(e) => setDados(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Digite o nome da lista"
                />
              </div>

              {dados.tipo === 'csv' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="separador">Separador</Label>
                    <Select value={dados.separador} onValueChange={(value) => setDados(prev => ({ ...prev, separador: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=",">Vírgula (,)</SelectItem>
                        <SelectItem value=";">Ponto e vírgula (;)</SelectItem>
                        <SelectItem value="\t">Tab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="cabecalho"
                      checked={dados.temCabecalho}
                      onChange={(e) => setDados(prev => ({ ...prev, temCabecalho: e.target.checked }))}
                    />
                    <Label htmlFor="cabecalho">Primeira linha é cabeçalho</Label>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-3">Mapeamento de colunas</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Nome (Coluna)</Label>
                    <Select value={dados.mapeamento.nome.toString()} onValueChange={(value) => setDados(prev => ({ ...prev, mapeamento: { ...prev.mapeamento, nome: parseInt(value) } }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Coluna A (1)</SelectItem>
                        <SelectItem value="1">Coluna B (2)</SelectItem>
                        <SelectItem value="2">Coluna C (3)</SelectItem>
                        <SelectItem value="3">Coluna D (4)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Email (Coluna)</Label>
                    <Select value={dados.mapeamento.email.toString()} onValueChange={(value) => setDados(prev => ({ ...prev, mapeamento: { ...prev.mapeamento, email: parseInt(value) } }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Coluna A (1)</SelectItem>
                        <SelectItem value="1">Coluna B (2)</SelectItem>
                        <SelectItem value="2">Coluna C (3)</SelectItem>
                        <SelectItem value="3">Coluna D (4)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Telefone (Coluna)</Label>
                    <Select value={dados.mapeamento.telefone.toString()} onValueChange={(value) => setDados(prev => ({ ...prev, mapeamento: { ...prev.mapeamento, telefone: parseInt(value) } }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Coluna A (1)</SelectItem>
                        <SelectItem value="1">Coluna B (2)</SelectItem>
                        <SelectItem value="2">Coluna C (3)</SelectItem>
                        <SelectItem value="3">Coluna D (4)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={cancelarImportacao} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={processarArquivo}
                disabled={!dados.nome || importing}
                className="flex-1"
              >
                Processar Arquivo
              </Button>
            </div>
          </div>
        )}

        {/* Passo 3: Progresso da importação */}
        {step === 3 && importing && (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary animate-pulse" />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Importando contatos...</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Processando arquivo e validando dados
              </p>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}% concluído</p>
            </div>

            {importStats.total > 0 && (
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{importStats.total.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Encontrados</div>
                </div>
                <div className="p-3 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success">{importStats.validos.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Válidos</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Passo 4: Resultado da importação */}
        {step === 3 && !importing && (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Importação concluída!</h3>
              <p className="text-muted-foreground text-sm">
                {importStats.total > 0 ?
                  `${importStats.total} registros processados do arquivo ${file?.name}` :
                  'Nenhum registro foi encontrado no arquivo'
                }
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold text-foreground">{importStats.total.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="p-3 bg-success/10 rounded-lg">
                <div className="text-xl font-bold text-success">{importStats.validos.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Válidos</div>
              </div>
              <div className="p-3 bg-warning/10 rounded-lg">
                <div className="text-xl font-bold text-warning">{importStats.duplicados.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Duplicados</div>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg">
                <div className="text-xl font-bold text-destructive">{importStats.invalidos.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Inválidos</div>
              </div>
            </div>

            {/* Amostra de contatos reais encontrados */}
            {importStats.amostraContatos && importStats.amostraContatos.length > 0 && (
              <div className="text-left bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2 text-center">Amostra dos contatos encontrados:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {importStats.amostraContatos.map((contato, index) => (
                    <div key={index} className="text-sm p-2 bg-background rounded border">
                      <div className="font-medium">{contato.nome}</div>
                      {contato.email && <div className="text-muted-foreground text-xs">{contato.email}</div>}
                      {contato.telefone && <div className="text-muted-foreground text-xs">{contato.telefone}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importStats.duplicados > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {importStats.duplicados} contatos duplicados foram automaticamente excluídos
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Os duplicados foram detectados por telefone, email ou nome e removidos da lista final
                </p>
              </div>
            )}

            {importStats.total === 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Nenhum contato foi encontrado no arquivo
                  </span>
                </div>
                <p className="text-xs text-red-700 mt-1">
                  Verifique se o arquivo está no formato correto e tem o mapeamento adequado
                </p>
              </div>
            )}

            <Button onClick={finalizarImportacao} className="w-full" disabled={importStats.total === 0}>
              {importStats.total > 0 ? 'Finalizar Importação' : 'Tentar Novamente'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}