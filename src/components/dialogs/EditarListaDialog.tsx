import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Lista {
  id: number;
  nome: string;
  origem: string;
  totalContatos: number;
  validados: number;
  duplicados: number;
  criadaEm: string;
  ultimaAtualizacao: string;
  campanhasAtivas: number;
  taxa_entrega: number;
  status: string;
  descricao: string;
}

interface EditarListaDialogProps {
  children: React.ReactNode;
  lista: Lista;
  onListaUpdated: (listaAtualizada: Lista) => void;
}

export function EditarListaDialog({ children, lista, onListaUpdated }: EditarListaDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: lista.nome,
    descricao: lista.descricao,
    status: lista.status
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const listaAtualizada = {
      ...lista,
      ...formData,
      ultimaAtualizacao: new Date().toISOString().split('T')[0]
    };

    onListaUpdated(listaAtualizada);
    
    toast({
      title: "Lista atualizada!",
      description: `As informações da lista "${formData.nome}" foram salvas com sucesso.`,
      variant: "default",
    });
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Lista de Contatos</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Lista</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Digite o nome da lista"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva o propósito desta lista"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Pausada">Pausada</SelectItem>
                <SelectItem value="Bloqueada">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          </div>


          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
            <div>
              <Label className="text-sm text-muted-foreground">Total de Contatos</Label>
              <div className="text-lg font-semibold">{(lista.totalContatos || 0).toLocaleString()}</div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Contatos Válidos</Label>
              <div className="text-lg font-semibold text-success">{(lista.validados || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}