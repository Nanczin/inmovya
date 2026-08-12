import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Eye,
  Copy
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  placeholders: any;
  created_at: string;
  updated_at: string;
}

interface EmailTemplatesProps {
  onSelectTemplate?: (template: EmailTemplate) => void;
}

export function EmailTemplates({ onSelectTemplate }: EmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    placeholders: {} as Record<string, string>
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading email templates:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os templates.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const extractPlaceholders = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map(match => match.slice(2, -2).trim()) : [];
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome, assunto e corpo do template.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');

      // Extract placeholders from subject and body
      const subjectPlaceholders = extractPlaceholders(formData.subject);
      const bodyPlaceholders = extractPlaceholders(formData.body);
      const allPlaceholders = [...new Set([...subjectPlaceholders, ...bodyPlaceholders])];
      
      const placeholderObj = allPlaceholders.reduce((acc, placeholder) => {
        acc[placeholder] = formData.placeholders[placeholder] || '';
        return acc;
      }, {} as Record<string, string>);

      const templateData = {
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        placeholders: placeholderObj,
        user_id: user.id,
      };

      let result;
      if (editingTemplate) {
        result = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('email_templates')
          .insert(templateData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({
        title: editingTemplate ? "Template atualizado!" : "Template criado!",
        description: `Template "${formData.name}" ${editingTemplate ? 'atualizado' : 'criado'} com sucesso.`,
      });

      await loadTemplates();
      handleClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o template. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders || {}
    });
    setIsOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Template excluído!",
        description: "Template foi removido com sucesso.",
      });

      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o template.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: '',
      placeholders: {}
    });
  };

  const handleUseTemplate = (template: EmailTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      toast({
        title: "Template selecionado",
        description: `Template "${template.name}" foi aplicado.`,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          <p>Carregando templates...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Templates de Email</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {editingTemplate ? 'Editar Template' : 'Criar Template'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Primeiro Contato"
                />
              </div>

              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Ex: Bem-vindo(a) - {{nome_cliente}}"
                />
              </div>

              <div className="space-y-2">
                <Label>Corpo do Email</Label>
                <Textarea
                  value={formData.body}
                  onChange={(e) => setFormData({...formData, body: e.target.value})}
                  className="min-h-[200px]"
                  placeholder="Olá {{nome_cliente}},&#10;&#10;Obrigado pelo seu interesse em {{empreendimento}}.&#10;&#10;Atenciosamente,&#10;Equipe Inmovya"
                />
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Placeholders disponíveis:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{'{{nome_cliente}}'}</Badge>
                  <Badge variant="outline">{'{{empreendimento}}'}</Badge>
                  <Badge variant="outline">{'{{telefone}}'}</Badge>
                  <Badge variant="outline">{'{{email}}'}</Badge>
                  <Badge variant="outline">{'{{data_contato}}'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use {'{{placeholder}}'} no texto para criar campos dinâmicos
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  {editingTemplate ? 'Atualizar' : 'Criar'} Template
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Nenhum template encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie seu primeiro template para agilizar o envio de emails
                </p>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-medium">{template.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {template.subject}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(template.placeholders || {}).map((placeholder) => (
                        <Badge key={placeholder} variant="secondary" className="text-xs">
                          {'{{' + placeholder + '}}'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onSelectTemplate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUseTemplate(template)}
                        title="Usar template"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewTemplate(template)}
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Prévia do Template</DialogTitle>
                        </DialogHeader>
                        {previewTemplate && (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm font-medium">Nome</Label>
                              <p className="text-sm mt-1">{previewTemplate.name}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Assunto</Label>
                              <p className="text-sm mt-1">{previewTemplate.subject}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Conteúdo</Label>
                              <ScrollArea className="h-[200px] mt-2 p-3 border rounded-md bg-muted/50">
                                <pre className="text-sm whitespace-pre-wrap">{previewTemplate.body}</pre>
                              </ScrollArea>
                            </div>
                            {Object.keys(previewTemplate.placeholders || {}).length > 0 && (
                              <div>
                                <Label className="text-sm font-medium">Placeholders</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {Object.keys(previewTemplate.placeholders || {}).map((placeholder) => (
                                    <Badge key={placeholder} variant="outline">
                                      {'{{' + placeholder + '}}'}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      title="Excluir"
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}