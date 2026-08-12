import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Search,
  Filter,
  FileText,
  Image,
  Video,
  Download,
  Eye,
  Edit,
  Share,
  Tag,
  Calendar,
  File as FileIcon,
  ChevronDown,
  Trash2,
  Folder,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Home,

  RefreshCw,
  FolderInput,
  Loader2
} from "lucide-react";

export function MateriaisModule() {
  const [searchTerm, setSearchTerm] = useState("");

  const compressPDF = async (file: File): Promise<File> => {
    // Compressão desativada a pedido do usuário
    return file;
  };
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string[]>([]);
  const [filtroEmpreendimento, setFiltroEmpreendimento] = useState<string[]>([]);
  const [filtroTags, setFiltroTags] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedFolderToMove, setSelectedFolderToMove] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [targetFormat, setTargetFormat] = useState<"PNG" | "JPG">("PNG");
  const [converting, setConverting] = useState(false);
  const [empreendimentos, setEmpreendimentos] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    nome: "",
    tipo: "",
    categoria: "",
    empreendimento: "",
    descricao: "",
    tags: ""
  });
  const [editMaterial, setEditMaterial] = useState({
    nome: "",
    tipo: "",
    categoria: "",
    empreendimento: "",
    descricao: "",
    tags: ""
  });
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Folder States
  const [folders, setFolders] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isEditFolderDialogOpen, setIsEditFolderDialogOpen] = useState(false);
  const [isDeleteFolderDialogOpen, setIsDeleteFolderDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [editFolderName, setEditFolderName] = useState("");

  // Função para carregar empreendimentos
  const carregarEmpreendimentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, status')
        .eq('user_id', user.id)
        .order('nome');

      if (error) {
        console.error('Erro ao carregar empreendimentos:', error);
        toast({
          title: "Erro ao carregar empreendimentos",
          description: "Não foi possível carregar a lista de empreendimentos.",
          variant: "destructive",
        });
        return;
      }

      setEmpreendimentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar empreendimentos:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao carregar os empreendimentos.",
        variant: "destructive",
      });
    }
  };

  // Função para carregar pastas
  const carregarPastas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('material_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      if (error) {
        console.error('Erro ao carregar pastas:', error);
        return;
      }

      setFolders(data || []);
    } catch (error) {
      console.error('Erro ao buscar pastas:', error);
    }
  };

  // Função para carregar materiais
  const carregarMateriais = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('materiais')
        .select(`
          *,
          empreendimentos(nome)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar materiais:', error);
        toast({
          title: "Erro ao carregar materiais",
          description: "Não foi possível carregar a lista de materiais.",
          variant: "destructive",
        });
        return;
      }

      setMateriais(data || []);
    } catch (error) {
      console.error('Erro ao buscar materiais:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao carregar os materiais.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados ao inicializar
  useEffect(() => {
    carregarEmpreendimentos();
    carregarMateriais();
    carregarPastas();
  }, []);

  // Handlers para as funcionalidades dos botões
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('material_folders')
        .insert({
          user_id: user.id,
          nome: newFolderName.trim(),
          parent_id: currentFolder
        });

      if (error) throw error;

      toast({
        title: "Pasta criada",
        description: `Pasta "${newFolderName}" criada com sucesso.`,
      });

      setNewFolderName("");
      setIsFolderDialogOpen(false);
      carregarPastas();
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      toast({
        title: "Erro ao criar pasta",
        description: "Não foi possível criar a pasta.",
        variant: "destructive"
      });
    }
  };

  const handleEditFolder = (folder: any) => {
    setSelectedFolder(folder);
    setEditFolderName(folder.nome);
    setIsEditFolderDialogOpen(true);
  };

  const confirmEditFolder = async () => {
    if (!editFolderName.trim() || !selectedFolder) return;
    try {
      const { error } = await supabase
        .from('material_folders')
        .update({ nome: editFolderName.trim() })
        .eq('id', selectedFolder.id);

      if (error) throw error;
      toast({ title: "Pasta atualizada", description: `Pasta "${editFolderName}" atualizada com sucesso.` });
      setIsEditFolderDialogOpen(false);
      carregarPastas();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar a pasta.", variant: "destructive" });
    }
  };

  const handleDeleteFolder = (folder: any) => {
    setSelectedFolder(folder);
    setIsDeleteFolderDialogOpen(true);
  };

  const confirmDeleteFolder = async (action: 'keep' | 'delete_all' = 'keep') => {
    if (!selectedFolder) return;
    try {
      if (action === 'keep') {
        // Remove folder link from all materials (move to root)
        await supabase.from('materiais').update({ folder_id: null }).eq('folder_id', selectedFolder.id);
      } else if (action === 'delete_all') {
        // Delete all materials in this folder from storage
        const { data: materialsToDelete } = await supabase.from('materiais').select('*').eq('folder_id', selectedFolder.id);
        
        if (materialsToDelete && materialsToDelete.length > 0) {
          for (const material of materialsToDelete) {
            if (material.arquivo_url) {
              try {
                const parts = String(material.arquivo_url).split('/materiais/');
                if (parts.length >= 2) {
                  const filePath = decodeURIComponent(parts[1].split('?')[0]);
                  await supabase.storage.from('materiais').remove([filePath]);
                }
              } catch (e) {
                console.error("Erro ao excluir arquivo fisico:", e);
              }
            }
          }
          // Delete from database
          await supabase.from('materiais').delete().eq('folder_id', selectedFolder.id);
        }
      }

      // Now delete the folder
      const { error } = await supabase
        .from('material_folders')
        .delete()
        .eq('id', selectedFolder.id);

      if (error) {
        throw error;
      }
      toast({ title: "Pasta excluída", description: `A pasta foi excluída com sucesso.` });
      setIsDeleteFolderDialogOpen(false);
      carregarPastas();
      carregarMateriais();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro", description: error.message || "Não foi possível excluir a pasta.", variant: "destructive" });
    }
  };

  const handleCriarMaterial = () => {
    setIsDialogOpen(true);
  };

  const handleCreateMaterial = async () => {
    // Validação básica
    if (!newMaterial.nome || !newMaterial.tipo || !newMaterial.categoria) {
      toast({
        title: "Erro de validação",
        description: "Nome, tipo e categoria são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar materiais.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('materiais')
        .insert({
          user_id: user.id,
          nome: newMaterial.nome,
          tipo: newMaterial.tipo,
          categoria: newMaterial.categoria,
          empreendimento_id: newMaterial.empreendimento || null,
          descricao: newMaterial.descricao || null,
          tags: newMaterial.tags ? newMaterial.tags.split(',').map(tag => tag.trim()) : [],
          folder_id: currentFolder
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar material:', error);
        toast({
          title: "Erro ao criar material",
          description: "Não foi possível criar o material.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Material criado com sucesso!",
        description: `${newMaterial.nome} foi adicionado à biblioteca.`,
      });

      // Resetar formulário e fechar dialog
      setNewMaterial({
        nome: "",
        tipo: "",
        categoria: "",
        empreendimento: "",
        descricao: "",
        tags: ""
      });
      setIsDialogOpen(false);

      // Recarregar materiais
      carregarMateriais();
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao criar o material.",
        variant: "destructive",
      });
    }
  };

  const handleViewMaterial = async (material: any) => {
    setSelectedMaterial(material);
    setIsViewDialogOpen(true);
    setPreviewUrl(null);

    try {
      if (material?.arquivo_url) {
        const parts = String(material.arquivo_url).split('/materiais/');
        if (parts.length >= 2) {
          const filePath = decodeURIComponent(parts[1].split('?')[0]);
          const { data, error } = await supabase.storage
            .from('materiais')
            .createSignedUrl(filePath, 60 * 10);
          if (!error && data?.signedUrl) {
            setPreviewUrl(data.signedUrl);
          } else {
            setPreviewUrl(material.arquivo_url);
          }
        } else {
          setPreviewUrl(material.arquivo_url);
        }
      }
    } catch (e) {
      console.error('Erro ao gerar URL assinada para preview:', e);
      setPreviewUrl(material.arquivo_url || null);
    }
  };

  const handleDownloadMaterial = async (material: any) => {
    if (material.arquivo_url) {
      try {
        // Extrair o caminho do arquivo da URL
        const parts = String(material.arquivo_url).split('/materiais/');
        if (parts.length < 2) {
          throw new Error('URL do arquivo inválida');
        }

        const filePath = decodeURIComponent(parts[1].split('?')[0]);

        // Gerar URL assinada para download
        const { data, error } = await supabase.storage
          .from('materiais')
          .createSignedUrl(filePath, 60); // URL válida por 60 segundos

        if (error) {
          throw error;
        }

        if (!data?.signedUrl) {
          throw new Error('Não foi possível gerar URL de download');
        }

        // Criar link temporário para download
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = material.arquivo_nome || material.nome;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Incrementar contador de downloads
        await supabase
          .from('materiais')
          .update({ downloads: (material.downloads || 0) + 1 })
          .eq('id', material.id);

        // Recarregar materiais para atualizar contador
        carregarMateriais();

        toast({
          title: "Download iniciado",
          description: `Abrindo ${material.nome}`,
        });
      } catch (error) {
        console.error('Erro ao fazer download:', error);
        toast({
          title: "Erro no download",
          description: error instanceof Error ? error.message : "Não foi possível fazer o download do arquivo.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Arquivo não encontrado",
        description: "Este material não possui arquivo associado.",
        variant: "destructive",
      });
    }
  };

  const handleShareMaterial = (material: any) => {
    // Copiar link para clipboard
    const shareUrl = `${window.location.origin}/material/${material.id}`;
    navigator.clipboard.writeText(shareUrl);

    toast({
      title: "Link copiado!",
      description: "Link do material copiado para a área de transferência.",
    });
  };

  const handleEditMaterial = (material: any) => {
    setSelectedMaterial(material);
    setEditMaterial({
      nome: material.nome,
      tipo: material.tipo,
      categoria: material.categoria,
      empreendimento: material.empreendimento_id || '',
      descricao: material.descricao || '',
      tags: material.tags && Array.isArray(material.tags) ? material.tags.join(", ") : ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateMaterial = async () => {
    // Validação básica
    if (!editMaterial.nome || !editMaterial.tipo || !editMaterial.categoria) {
      toast({
        title: "Erro de validação",
        description: "Nome, tipo e categoria são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedMaterial) {
      toast({
        title: "Nenhum material selecionado",
        description: "Selecione um material para atualizar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para atualizar materiais.",
          variant: "destructive",
        });
        return;
      }

      const updates = {
        nome: editMaterial.nome,
        tipo: editMaterial.tipo,
        categoria: editMaterial.categoria,
        empreendimento_id: editMaterial.empreendimento || null,
        descricao: editMaterial.descricao || null,
        tags: editMaterial.tags
          ? editMaterial.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('materiais')
        .update(updates)
        .eq('id', selectedMaterial.id);

      if (error) {
        console.error('Erro ao atualizar material:', error);
        toast({
          title: "Erro ao atualizar material",
          description: "Não foi possível salvar as alterações.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Material atualizado com sucesso!",
        description: `${editMaterial.nome} foi atualizado na biblioteca.`,
      });

      setIsEditDialogOpen(false);
      setSelectedMaterial(null);
      carregarMateriais();
    } catch (error) {
      console.error('Erro inesperado ao atualizar material:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao atualizar o material.",
        variant: "destructive",
      });
    }
  };

  const handleConvertMaterial = (material: any) => {
    // Check if it's an image
    if (!["JPG", "PNG", "WEBP", "JPEG"].includes(material.tipo.toUpperCase())) {
      toast({
        title: "Formato não suportado",
        description: "Apenas imagens podem ser convertidas no momento.",
        variant: "destructive"
      });
      return;
    }
    setSelectedMaterial(material);
    setTargetFormat("PNG"); // Default
    setIsConvertDialogOpen(true);
  };

  const processConversion = async () => {
    if (!selectedMaterial) return;

    setConverting(true);
    try {
      let imageUrl = selectedMaterial.arquivo_url;

      try {
        if (imageUrl.includes('/materiais/')) {
          const parts = imageUrl.split('/materiais/');
          if (parts.length >= 2) {
            const filePath = decodeURIComponent(parts[1].split('?')[0]);
            const { data } = await supabase.storage
              .from('materiais')
              .createSignedUrl(filePath, 60);
            if (data?.signedUrl) imageUrl = data.signedUrl;
          }
        }
      } catch (e) {
        console.warn("Could not sign URL, using original:", e);
      }

      // 2. Fetch the image as blob to handle CORS generally better if going through proxy, 
      // but for client side canvas, we need an Image object.
      // We'll use a crossOrigin anonymous image.

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Falha ao carregar imagem para conversão"));
      });

      // 3. Draw to canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // If converting to JPG, fill background with white (for transparency handling)
      if (targetFormat === "JPG") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      // 4. Export to blob
      const mimeType = targetFormat === "JPG" ? "image/jpeg" : "image/png";
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, 0.9));

      if (!blob) throw new Error("Falha ao gerar arquivo convertido");

      // 5. Create File object
      const fileNameWithoutExt = selectedMaterial.nome.replace(/\.[^/.]+$/, "");
      const newFileName = `${fileNameWithoutExt}_converted.${targetFormat.toLowerCase()}`;
      const file = new File([blob], newFileName, { type: mimeType });

      // 6. Upload using existing function
      await uploadFile(file, targetFormat);

      setIsConvertDialogOpen(false);
      // Toast is handled by uploadFile

    } catch (error) {
      console.error("Erro na conversão:", error);
      toast({
        title: "Erro na conversão",
        description: "Não foi possível converter a imagem. Tente novamente ou verifique se o arquivo é acessível.",
        variant: "destructive"
      });
    } finally {
      setConverting(false);
    }
  };

  const handleDeleteMaterial = (material: any) => {
    setSelectedMaterial(material);
    setIsDeleteConfirmDialogOpen(true);
  };

  const confirmDeleteMaterial = async () => {
    if (!selectedMaterial) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para excluir materiais.",
          variant: "destructive",
        });
        return;
      }

      // Se tiver arquivo no storage, deletar também
      if (selectedMaterial.arquivo_url) {
        try {
          const parts = String(selectedMaterial.arquivo_url).split('/materiais/');
          if (parts.length >= 2) {
            const filePath = decodeURIComponent(parts[1].split('?')[0]);
            await supabase.storage
              .from('materiais')
              .remove([filePath]);
          }
        } catch (e) {
          console.error("Erro ao tentar excluir arquivo físico:", e);
          // Continua para excluir o registro do banco mesmo se falhar no storage
        }
      }

      const { error } = await supabase
        .from('materiais')
        .delete()
        .eq('id', selectedMaterial.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Material excluído",
        description: "O material foi removido com sucesso.",
      });

      setIsDeleteConfirmDialogOpen(false);
      setSelectedMaterial(null);
      carregarMateriais();

    } catch (error) {
      console.error('Erro ao excluir material:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o material.",
        variant: "destructive",
      });
    }
  };


  const processMoveMaterial = async () => {
    if (!selectedMaterial) return;

    let targetFolderId: string | null = selectedFolderToMove;
    if (targetFolderId === "root_folder_value_placeholder") {
      targetFolderId = null;
    }

    try {
      const { error } = await supabase
        .from('materiais')
        .update({ folder_id: targetFolderId })
        .eq('id', selectedMaterial.id);

      if (error) throw error;

      toast({
        title: "Material movido",
        description: "Material movido com sucesso."
      });

      setIsMoveDialogOpen(false);
      carregarMateriais();
    } catch (error) {
      console.error('Erro ao mover material:', error);
      toast({
        title: "Erro ao mover",
        description: "Não foi possível mover o material.",
        variant: "destructive"
      });
    }
  };


  const handleMoveMaterial = (material: any) => {
    setSelectedMaterial(material);
    setSelectedFolderToMove(material.folder_id || "");
    setIsMoveDialogOpen(true);
  };


  // --- Bulk Actions Handlers ---

  const toggleMaterialSelection = (id: string) => {
    setSelectedMaterialIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMaterialIds.length === filteredMateriais.length) {
      setSelectedMaterialIds([]);
    } else {
      setSelectedMaterialIds(filteredMateriais.map(m => m.id));
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedMaterialIds.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para excluir materiais.",
          variant: "destructive",
        });
        return;
      }

      // Finds materials to optionally delete files from storage
      const materialsToDelete = materiais.filter(m => selectedMaterialIds.includes(m.id));

      for (const material of materialsToDelete) {
        if (material.arquivo_url) {
          try {
            const parts = String(material.arquivo_url).split('/materiais/');
            if (parts.length >= 2) {
              const filePath = decodeURIComponent(parts[1].split('?')[0]);
              await supabase.storage.from('materiais').remove([filePath]);
            }
          } catch (e) {
            console.error("Erro ao tentar excluir arquivo físico:", e);
          }
        }
      }

      const { error } = await supabase
        .from('materiais')
        .delete()
        .in('id', selectedMaterialIds);

      if (error) throw error;

      toast({
        title: "Materiais excluídos",
        description: `${selectedMaterialIds.length} materiais foram removidos com sucesso.`,
      });

      setIsBulkDeleteDialogOpen(false);
      setSelectedMaterialIds([]);
      carregarMateriais();

    } catch (error) {
      console.error('Erro ao excluir materiais em massa:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir os materiais selecionados.",
        variant: "destructive",
      });
    }
  };

  const processBulkMove = async () => {
    if (selectedMaterialIds.length === 0) return;

    let targetFolderId: string | null = selectedFolderToMove;
    if (targetFolderId === "root_folder_value_placeholder") {
      targetFolderId = null;
    }

    try {
      const { error } = await supabase
        .from('materiais')
        .update({ folder_id: targetFolderId })
        .in('id', selectedMaterialIds);

      if (error) throw error;

      toast({
        title: "Materiais movidos",
        description: `${selectedMaterialIds.length} materiais foram movidos com sucesso.`
      });

      setIsBulkMoveDialogOpen(false);
      setSelectedMaterialIds([]);
      carregarMateriais();
    } catch (error) {
      console.error('Erro ao mover materiais em massa:', error);
      toast({
        title: "Erro ao mover",
        description: "Não foi possível mover os materiais selecionados.",
        variant: "destructive"
      });
    }
  };







  const compressImage = async (file: File): Promise<File> => {
    // Only compress standard web images
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return file;
    }

    // Skip small files (e.g. < 300KB) - usually already optimized
    if (file.size < 300 * 1024) {
      return file;
    }

    try {
      // Create a bitmap from the file
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        bitmap.close();
        return file;
      }

      // Max dimension logic - resize huge images
      let { width, height } = bitmap;
      const MAX_WIDTH = 2048;
      const MAX_HEIGHT = 2048;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw to canvas
      ctx.fillStyle = '#FFFFFF'; // Ensure transparent PNGs get white background if converting to JPEG or similar logic
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      // Compress
      const compressedBlob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, file.type, 0.75) // 75% quality
      );

      if (compressedBlob && compressedBlob.size < file.size) {
        console.log(`Original: ${(file.size / 1024).toFixed(2)}KB, Compressed: ${(compressedBlob.size / 1024).toFixed(2)}KB`);
        return new File([compressedBlob], file.name, {
          type: file.type,
          lastModified: Date.now()
        });
      }
    } catch (error) {
      console.error("Compression failed, using original file", error);
    }

    return file;
  };

  const uploadFile = async (fileInput: File, tipo: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para fazer upload.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);

      // Tenta comprimir arquivo
      let file = fileInput;

      if (['image/jpeg', 'image/png', 'image/webp'].includes(fileInput.type)) {
        file = await compressImage(fileInput);
      } else if (fileInput.type === 'application/pdf') {
        file = await compressPDF(fileInput);
      }



      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload do arquivo para o storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('materiais')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        toast({
          title: "Erro no upload",
          description: "Não foi possível fazer o upload do arquivo.",
          variant: "destructive",
        });
        return;
      }

      // Obter URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('materiais')
        .getPublicUrl(fileName);

      // Salvar informações do material no banco
      const categoria = tipo === 'PDF' ? 'Documentos' :
        ['JPG', 'PNG'].includes(tipo) ? 'Imagens' :
          ['MP4', 'MOV'].includes(tipo) ? 'Vídeos' : 'Documentos';

      const { data, error } = await supabase
        .from('materiais')
        .insert({
          user_id: user.id,
          nome: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
          tipo: tipo,
          categoria: categoria,
          arquivo_url: publicUrl,
          arquivo_nome: file.name,
          arquivo_tamanho: file.size,
          arquivo_tipo: file.type,
          tags: [],
          folder_id: currentFolder
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar material:', error);
        toast({
          title: "Erro ao salvar",
          description: "O arquivo foi enviado mas não foi possível salvar as informações.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Upload realizado com sucesso!",
        description: `${file.name} foi adicionado à biblioteca.`,
      });

      // Recarregar materiais
      carregarMateriais();
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante o upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadArquivo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xlsx,.ppt,.pptx';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const fileExt = file.name.split('.').pop()?.toUpperCase() || '';
        uploadFile(file, fileExt);
      }
    };
    input.click();
  };

  const handleUploadImagens = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileExt = file.name.split('.').pop()?.toUpperCase() || '';
          await uploadFile(file, fileExt);
        }
      }
    };
    input.click();
  };

  const handleUploadVideos = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileExt = file.name.split('.').pop()?.toUpperCase() || '';
          await uploadFile(file, fileExt);
        }
      }
    };
    input.click();
  };



  const getTypeIcon = (tipo: string) => {
    switch (tipo.toUpperCase()) {
      case "PDF": return <FileText className="w-5 h-5 text-red-500" />;
      case "JPG":
      case "PNG": return <Image className="w-5 h-5 text-blue-500" />;
      case "MP4":
      case "MOV": return <Video className="w-5 h-5 text-purple-500" />;
      case "XLSX":
      case "DOC": return <FileIcon className="w-5 h-5 text-green-500" />;
      default: return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTypeColor = (tipo: string) => {
    switch (tipo.toUpperCase()) {
      case "PDF": return "bg-red-100 text-red-800 border-red-200";
      case "JPG":
      case "PNG": return "bg-blue-100 text-blue-800 border-blue-200";
      case "MP4":
      case "MOV": return "bg-purple-100 text-purple-800 border-purple-200";
      case "XLSX":
      case "DOC": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Extrair tags únicas dos materiais
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    materiais.forEach(material => {
      if (material.tags && Array.isArray(material.tags)) {
        material.tags.forEach((tag: string) => {
          if (tag) tagsSet.add(tag);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [materiais]);

  const filteredMateriais = materiais.filter(material => {
    // Basic folder filter
    if (material.folder_id !== currentFolder) return false;

    const empreendimentoNome = material.empreendimentos?.nome || '';
    const matchesSearch = material.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empreendimentoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (material.tags && material.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())));

    let matchesTipo = filtroTipo.length === 0;
    if (filtroTipo.includes("Imagens")) {
      matchesTipo = matchesTipo || ["JPG", "PNG"].includes(material.tipo.toUpperCase());
    }
    if (filtroTipo.some(tipo => tipo !== "Imagens")) {
      matchesTipo = matchesTipo || filtroTipo.some(tipo =>
        tipo !== "Imagens" && material.tipo.toLowerCase() === tipo.toLowerCase()
      );
    }

    const matchesCategoria = filtroCategoria.length === 0 || filtroCategoria.includes(material.categoria);
    const matchesEmpreendimento = filtroEmpreendimento.length === 0 || filtroEmpreendimento.includes(empreendimentoNome);

    // Filtro por Tags
    const matchesTags = filtroTags.length === 0 || (material.tags && Array.isArray(material.tags) && filtroTags.some(tag => material.tags.includes(tag)));

    return matchesSearch && matchesTipo && matchesCategoria && matchesEmpreendimento && matchesTags;
  });

  const clearFilters = () => {
    setFiltroTipo([]);
    setFiltroCategoria([]);
    setFiltroEmpreendimento([]);
    setFiltroTags([]);
  };

  const activeFiltersCount = filtroTipo.length + filtroCategoria.length + filtroEmpreendimento.length + filtroTags.length;

  // Funções para manejar seleção múltipla
  const toggleTipoFilter = (tipo: string) => {
    setFiltroTipo(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const toggleCategoriaFilter = (categoria: string) => {
    setFiltroCategoria(prev =>
      prev.includes(categoria)
        ? prev.filter(c => c !== categoria)
        : [...prev, categoria]
    );
  };

  const toggleEmpreendimentoFilter = (empreendimento: string) => {
    setFiltroEmpreendimento(prev =>
      prev.includes(empreendimento)
        ? prev.filter(e => e !== empreendimento)
        : [...prev, empreendimento]
    );
  };

  const toggleTagFilter = (tag: string) => {
    setFiltroTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Materiais de Venda</h2>
          <p className="text-muted-foreground">Gerencie arquivos, imagens e documentos</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="hero" className="shadow-elegant" disabled={uploading}>
              <Plus className="w-4 h-4 mr-2" />
              {uploading ? "Enviando..." : "Novo Material"}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="cursor-pointer" onClick={handleCriarMaterial}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Material Manualmente
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={handleUploadArquivo}>
              <Upload className="w-4 h-4 mr-2" />
              Upload de Arquivo
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={handleUploadImagens}>
              <Image className="w-4 h-4 mr-2" />
              Upload de Imagens
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={handleUploadVideos}>
              <Video className="w-4 h-4 mr-2" />
              Upload de Vídeos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar materiais por nome, empreendimento ou tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel>Filtrar por Tipo</DropdownMenuLabel>
            {["PDF", "Imagens", "MP4", "XLSX", "HTML"].map((tipo) => (
              <DropdownMenuItem
                key={tipo}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTipoFilter(tipo);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroTipo.includes(tipo)}
                    onCheckedChange={() => toggleTipoFilter(tipo)}
                  />
                  <div className="flex items-center gap-2">
                    {tipo === "PDF" && <FileText className="w-4 h-4 text-red-500" />}
                    {tipo === "Imagens" && <Image className="w-4 h-4 text-blue-500" />}
                    {tipo === "MP4" && <Video className="w-4 h-4 text-purple-500" />}
                    {tipo === "XLSX" && <FileIcon className="w-4 h-4 text-green-500" />}
                    {tipo === "HTML" && <FileText className="w-4 h-4 text-orange-500" />}
                    <span>{tipo === "MP4" ? "Vídeos" : tipo}</span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Filtrar por Categoria</DropdownMenuLabel>
            {["Plantas", "Vídeos", "Preços", "Imagens", "Documentos", "Virtual"].map((categoria) => (
              <DropdownMenuItem
                key={categoria}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleCategoriaFilter(categoria);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroCategoria.includes(categoria)}
                    onCheckedChange={() => toggleCategoriaFilter(categoria)}
                  />
                  <span>{categoria}</span>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Filtrar por Empreendimento</DropdownMenuLabel>
            {empreendimentos.map((empreendimento) => (
              <DropdownMenuItem
                key={empreendimento.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleEmpreendimentoFilter(empreendimento.nome);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroEmpreendimento.includes(empreendimento.nome)}
                    onCheckedChange={() => toggleEmpreendimentoFilter(empreendimento.nome)}
                  />
                  <span>{empreendimento.nome}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {empreendimento.status}
                  </Badge>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Filtrar por Tags</DropdownMenuLabel>
            {availableTags.length > 0 ? availableTags.map((tag) => (
              <DropdownMenuItem
                key={tag}
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTagFilter(tag);
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Checkbox
                    checked={filtroTags.includes(tag)}
                    onCheckedChange={() => toggleTagFilter(tag)}
                  />
                  <Badge variant="secondary" className="text-xs font-normal">
                    {tag}
                  </Badge>
                </div>
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground text-sm">Nenhuma tag cadastrada</span>
              </DropdownMenuItem>
            )}

            {activeFiltersCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive"
                  onClick={clearFilters}
                >
                  Limpar todos os filtros
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Folder Navigation & Breadcrumbs */}
      <div className="bg-muted/30 p-2 rounded-lg flex items-center flex-wrap gap-1 text-sm">
        <Button
          variant="ghost"
          size="sm"
          className={!currentFolder ? "font-bold" : "text-muted-foreground"}
          onClick={() => setCurrentFolder(null)}
        >
          <Home className="w-4 h-4 mr-1" />
          Início
        </Button>

        {(() => {
          const breadcrumbs = [];
          let currentId = currentFolder;
          while (currentId) {
            const folder = folders.find(f => f.id === currentId);
            if (folder) {
              breadcrumbs.unshift(folder);
              currentId = folder.parent_id;
            } else {
              break;
            }
          }

          return breadcrumbs.map((folder, index, array) => (
            <div key={folder.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className={index === array.length - 1 ? "font-bold" : "text-muted-foreground"}
                onClick={() => setCurrentFolder(folder.id)}
              >
                {folder.nome}
              </Button>
            </div>
          ));
        })()}
      </div>

      {/* Folders Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {folders
          .filter(f => f.parent_id === currentFolder)
          .map(folder => (
            <Card
              key={folder.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2 shadow-none relative group"
              onClick={() => setCurrentFolder(folder.id)}
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 rounded backdrop-blur-sm p-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }}>
                   <Edit className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}>
                   <Trash2 className="w-3 h-3 text-destructive hover:text-destructive/90" />
                </Button>
              </div>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 h-full">
                <Folder className="w-12 h-12 text-yellow-500 fill-current opacity-80" />
                <span className="font-medium text-sm truncate w-full">{folder.nome}</span>
              </CardContent>
            </Card>
          ))}
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2 shadow-none flex items-center justify-center min-h-[120px]"
          onClick={() => setIsFolderDialogOpen(true)}
        >
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <FolderPlus className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Nova Pasta</span>
          </div>
        </Card>
      </div>

      {/* Materials List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Biblioteca de Materiais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materiais.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Nenhum material encontrado</p>
                <p className="text-sm">Comece criando ou fazendo upload do seu primeiro material</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk Actions Bar */}
              {selectedMaterialIds.length > 0 && (
                <div className="bg-muted/50 p-2 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 mb-4 border border-blue-200 dark:border-blue-900">
                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-sm font-medium text-foreground">
                      {selectedMaterialIds.length} selecionado{selectedMaterialIds.length !== 1 && 's'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedMaterialIds([])}
                    >
                      Limpar seleção
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFolderToMove("");
                        setIsBulkMoveDialogOpen(true);
                      }}
                      className="h-8 gap-2 bg-background"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                      Mover p/ Pasta
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      className="h-8 gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Seleção
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2 px-4">
                <Checkbox
                  id="select-all"
                  checked={filteredMateriais.length > 0 && selectedMaterialIds.length === filteredMateriais.length}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                  Selecionar Todos
                </Label>
              </div>

              {filteredMateriais.map((material) => (
                <div key={material.id} className={`p-4 rounded-lg border transition-colors ${selectedMaterialIds.includes(material.id) ? 'bg-muted border-primary/50' : 'border-border hover:bg-muted/50'}`}>
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    {/* Checkbox & Icon & Info */}
                    <div className="flex items-start gap-4 flex-1 w-full">
                      {/* Checkbox Selection */}
                      <div className="pt-3">
                        <Checkbox
                          checked={selectedMaterialIds.includes(material.id)}
                          onCheckedChange={() => toggleMaterialSelection(material.id)}
                        />
                      </div>

                      {/* File Icon */}
                      <div className="p-3 rounded-lg bg-gradient-card hidden sm:block">
                        {getTypeIcon(material.tipo)}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h4 className="font-medium text-foreground truncate max-w-[200px] sm:max-w-none">{material.nome}</h4>
                          <Badge variant="outline" className={getTypeColor(material.tipo)}>
                            {material.tipo}
                          </Badge>

                          {/* Mobile Icon (visible only on mobile next to title) */}
                          <div className="sm:hidden ml-auto">
                            {getTypeIcon(material.tipo)}
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {material.descricao}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                          <div>
                            <div className="text-muted-foreground">Empreendimento</div>
                            <div className="font-medium truncate">{material.empreendimentos?.nome || 'Não informado'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Tamanho</div>
                            <div className="font-medium">{material.arquivo_tamanho ? `${(material.arquivo_tamanho / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Tipo</div>
                            <div className="font-medium">{material.categoria}</div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {material.tags && material.tags.length > 0 ? material.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          )) : (
                            <span className="text-xs text-muted-foreground">Sem tags</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Actions */}
                    <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto items-center sm:items-end justify-between sm:justify-start border-t sm:border-0 border-border pt-3 sm:pt-0 mt-2 sm:mt-0">
                      <div className="text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(material.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewMaterial(material)}
                          title="Visualizar material"
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadMaterial(material)}
                          title="Baixar material"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMaterial(material)}
                          title="Editar material"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                          onClick={() => handleDeleteMaterial(material)}
                          title="Excluir material"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {["JPG", "PNG", "WEBP", "JPEG"].includes(material.tipo.toUpperCase()) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConvertMaterial(material)}
                            title="Converter imagem"
                            className="h-8 w-8 p-0"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveMaterial(material)}
                          title="Mover para pasta"
                          className="h-8 w-8 p-0"
                        >
                          <FolderInput className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
            <DialogDescription>
              Crie uma nova pasta para organizar seus materiais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nome da Pasta</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Plantas 2024"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateFolder}>Criar Pasta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={isEditFolderDialogOpen} onOpenChange={setIsEditFolderDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Renomear Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">Nome da Pasta</Label>
              <Input
                id="edit-folder-name"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Ex: Plantas 2024"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEditFolder();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditFolderDialogOpen(false)}>Cancelar</Button>
              <Button onClick={confirmEditFolder}>Salvar Alterações</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirm Dialog */}
      <AlertDialog open={isDeleteFolderDialogOpen} onOpenChange={setIsDeleteFolderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pasta</AlertDialogTitle>
            <AlertDialogDescription>
              A pasta "{selectedFolder?.nome}" pode conter materiais. O que você deseja fazer com o conteúdo dela?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0 mt-4">
            <AlertDialogAction onClick={() => confirmDeleteFolder('keep')} className="w-full bg-primary hover:bg-primary/90 m-0">
              Excluir Pasta e Manter Materiais (Mover para a raiz)
            </AlertDialogAction>
            <AlertDialogAction onClick={() => confirmDeleteFolder('delete_all')} className="w-full bg-destructive hover:bg-destructive/90 m-0">
              Excluir Pasta E APAGAR TODOS OS MATERIAIS
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => setIsDeleteFolderDialogOpen(false)} className="w-full m-0">
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Material Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Material</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para adicionar um novo material à biblioteca.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Material *</Label>
              <Input
                id="nome"
                value={newMaterial.nome}
                onChange={(e) => setNewMaterial({ ...newMaterial, nome: e.target.value })}
                placeholder="Ex: Planta Apartamento 65m²"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={newMaterial.tipo} onValueChange={(value) => setNewMaterial({ ...newMaterial, tipo: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="JPG">JPG</SelectItem>
                  <SelectItem value="PNG">PNG</SelectItem>
                  <SelectItem value="MP4">MP4</SelectItem>
                  <SelectItem value="MOV">MOV</SelectItem>
                  <SelectItem value="XLSX">XLSX</SelectItem>
                  <SelectItem value="DOC">DOC</SelectItem>
                  <SelectItem value="HTML">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={newMaterial.categoria} onValueChange={(value) => setNewMaterial({ ...newMaterial, categoria: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plantas">Plantas</SelectItem>
                  <SelectItem value="Vídeos">Vídeos</SelectItem>
                  <SelectItem value="Imagens">Imagens</SelectItem>
                  <SelectItem value="Preços">Preços</SelectItem>
                  <SelectItem value="Documentos">Documentos</SelectItem>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Promocional">Promocional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="empreendimento">Empreendimento</Label>
              <Select
                value={newMaterial.empreendimento}
                onValueChange={(value) => setNewMaterial({ ...newMaterial, empreendimento: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Carregando..." : "Selecione o empreendimento"} />
                </SelectTrigger>
                <SelectContent>
                  {empreendimentos.length === 0 ? (
                    <SelectItem value="" disabled>
                      {loading ? "Carregando empreendimentos..." : "Nenhum empreendimento cadastrado"}
                    </SelectItem>
                  ) : (
                    empreendimentos.map((empreendimento) => (
                      <SelectItem key={empreendimento.id} value={empreendimento.id}>
                        {empreendimento.nome}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {empreendimento.status}
                        </Badge>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={newMaterial.descricao}
                onChange={(e) => setNewMaterial({ ...newMaterial, descricao: e.target.value })}
                placeholder="Descrição do material..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={newMaterial.tags}
                onChange={(e) => setNewMaterial({ ...newMaterial, tags: e.target.value })}
                placeholder="Ex: planta, 65m2, 2quartos (separado por vírgulas)"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateMaterial} className="flex-1">
                Criar Material
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Material Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Editar Material</DialogTitle>
            <DialogDescription>
              Atualize as informações do material selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do Material *</Label>
              <Input
                id="edit-nome"
                value={editMaterial.nome}
                onChange={(e) => setEditMaterial({ ...editMaterial, nome: e.target.value })}
                placeholder="Ex: Planta Apartamento 65m²"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tipo">Tipo *</Label>
              <Select value={editMaterial.tipo} onValueChange={(value) => setEditMaterial({ ...editMaterial, tipo: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="JPG">JPG</SelectItem>
                  <SelectItem value="PNG">PNG</SelectItem>
                  <SelectItem value="MP4">MP4</SelectItem>
                  <SelectItem value="MOV">MOV</SelectItem>
                  <SelectItem value="XLSX">XLSX</SelectItem>
                  <SelectItem value="DOC">DOC</SelectItem>
                  <SelectItem value="HTML">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-categoria">Categoria *</Label>
              <Select value={editMaterial.categoria} onValueChange={(value) => setEditMaterial({ ...editMaterial, categoria: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plantas">Plantas</SelectItem>
                  <SelectItem value="Vídeos">Vídeos</SelectItem>
                  <SelectItem value="Imagens">Imagens</SelectItem>
                  <SelectItem value="Preços">Preços</SelectItem>
                  <SelectItem value="Documentos">Documentos</SelectItem>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Promocional">Promocional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-empreendimento">Empreendimento</Label>
              <Select
                value={editMaterial.empreendimento}
                onValueChange={(value) => setEditMaterial({ ...editMaterial, empreendimento: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Carregando..." : "Selecione o empreendimento"} />
                </SelectTrigger>
                <SelectContent>
                  {empreendimentos.length === 0 ? (
                    <SelectItem value="" disabled>
                      {loading ? "Carregando empreendimentos..." : "Nenhum empreendimento cadastrado"}
                    </SelectItem>
                  ) : (
                    empreendimentos.map((empreendimento) => (
                      <SelectItem key={empreendimento.id} value={empreendimento.id}>
                        {empreendimento.nome}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {empreendimento.status}
                        </Badge>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Textarea
                id="edit-descricao"
                value={editMaterial.descricao}
                onChange={(e) => setEditMaterial({ ...editMaterial, descricao: e.target.value })}
                placeholder="Descrição do material..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={editMaterial.tags}
                onChange={(e) => setEditMaterial({ ...editMaterial, tags: e.target.value })}
                placeholder="Ex: planta, 65m2, 2quartos (separado por vírgulas)"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleUpdateMaterial} className="flex-1">
                Atualizar Material
              </Button>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Material Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMaterial && getTypeIcon(selectedMaterial.tipo)}
              Visualizar Material
            </DialogTitle>
            <DialogDescription>
              Detalhes e visualização do material selecionado.
            </DialogDescription>
          </DialogHeader>
          {selectedMaterial && (
            <div className="space-y-6 py-4">
              {/* Header Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{selectedMaterial.nome}</h3>
                  <Badge variant="outline" className={getTypeColor(selectedMaterial.tipo)}>
                    {selectedMaterial.tipo}
                  </Badge>
                </div>

                <p className="text-muted-foreground">{selectedMaterial.descricao}</p>
              </div>

              {/* Material Details Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/20">
                <div>
                  <div className="text-sm text-muted-foreground">Empreendimento</div>
                  <div className="font-medium">{selectedMaterial.empreendimentos?.nome || 'Não informado'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Categoria</div>
                  <div className="font-medium">{selectedMaterial.categoria}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Tamanho</div>
                  <div className="font-medium">{selectedMaterial.arquivo_tamanho ? `${(selectedMaterial.arquivo_tamanho / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Data de Criação</div>
                  <div className="font-medium">{new Date(selectedMaterial.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-accent text-accent-foreground">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground">{selectedMaterial.downloads || 0}</div>
                      <div className="text-xs text-muted-foreground">Downloads</div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success text-success-foreground">
                      <Share className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground">0</div>
                      <div className="text-xs text-muted-foreground">Campanhas</div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tags */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {selectedMaterial.tags && selectedMaterial.tags.length > 0 ? selectedMaterial.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  )) : (
                    <span className="text-xs text-muted-foreground">Sem tags</span>
                  )}
                </div>
              </div>

              {/* Material Preview Area */}
              <div className="rounded-lg border border-border overflow-hidden">
                {(() => {
                  const tipo = String(selectedMaterial.tipo || '').toUpperCase();
                  const src = previewUrl || selectedMaterial.arquivo_url || '';

                  if (!src) {
                    return (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Nenhum arquivo disponível para visualização.
                      </div>
                    );
                  }

                  if (["JPG", "JPEG", "PNG", "GIF", "WEBP"].includes(tipo)) {
                    return (
                      <img
                        src={src}
                        alt={`Prévia do material ${selectedMaterial.nome}`}
                        loading="lazy"
                        className="w-full max-h-[60vh] object-contain bg-muted"
                      />
                    );
                  }

                  if (tipo === "PDF") {
                    return (
                      <iframe
                        src={`${src}#toolbar=0`}
                        className="w-full h-[60vh] bg-muted"
                        title={`Prévia PDF - ${selectedMaterial.nome}`}
                      />
                    );
                  }

                  if (["MP4", "MOV", "WEBM"].includes(tipo)) {
                    return (
                      <video controls className="w-full max-h-[60vh] bg-black">
                        <source src={src} type={selectedMaterial.arquivo_tipo || 'video/mp4'} />
                        Seu navegador não suporta a reprodução de vídeo.
                      </video>
                    );
                  }

                  return (
                    <div className="p-8 text-center">
                      <div className="text-sm font-medium text-foreground">Prévia não disponível</div>
                      <div className="text-xs text-muted-foreground">Este tipo de arquivo não possui visualização embutida.</div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleDownloadMaterial(selectedMaterial)}
                  className="flex-1"
                  variant="hero"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Material
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mover Material</DialogTitle>
            <DialogDescription>
              Selecione a pasta de destino para este material.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Selecione a Pasta de Destino</Label>
              <Select value={selectedFolderToMove} onValueChange={setSelectedFolderToMove}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root_folder_value_placeholder">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Home className="w-3 h-3" /> Início (Raiz)
                    </span>
                  </SelectItem>
                  {folders.filter((f: any) => f.id !== selectedMaterial?.folder_id).map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="flex items-center gap-2">
                        <Folder className="w-3 h-3 text-yellow-500" /> {folder.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              // Handle root folder logic manually since Select value needs string
              if (selectedFolderToMove === "root_folder_value_placeholder") {
                // We can't really set the state to empty string and expect it to reflect immediately in the next line if using that state.
                // But wait, the processMoveMaterial uses selectedFolderToMove state.
                // We need to ensure logic handles "root_folder_value_placeholder" as null.
                // We can modify processMoveMaterial to check for this value.
              }
              processMoveMaterial();
            }}>
              Mover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Excluir Material</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o arquivo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Tem certeza que deseja excluir o material <strong>{selectedMaterial?.nome}</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita e o arquivo será removido permanentemente.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteMaterial}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Converter Imagem</DialogTitle>
            <DialogDescription>
              Converta a imagem selecionada para outro formato.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-4">
              {/* Preview thumbnail if desired, simplified for now */}
              <div className="text-sm">
                <p className="font-medium">Converter: {selectedMaterial?.nome}</p>
                <p className="text-muted-foreground">Formato atual: {selectedMaterial?.tipo}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Formato de Destino</Label>
              <Select value={targetFormat} onValueChange={(v: "PNG" | "JPG") => setTargetFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PNG">PNG (Preserva transparência)</SelectItem>
                  <SelectItem value="JPG">JPG (Menor tamanho, fundo branco)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              O arquivo convertido será salvo como um novo material na mesma pasta.
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)} disabled={converting}>
              Cancelar
            </Button>
            <Button onClick={processConversion} disabled={converting}>
              {converting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Convertendo...
                </>
              ) : (
                "Converter & Salvar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mover Material</DialogTitle>
            <DialogDescription>
              Selecione a pasta de destino para este material.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Selecione a Pasta de Destino</Label>
              <Select value={selectedFolderToMove} onValueChange={setSelectedFolderToMove}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root_folder_value_placeholder">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Home className="w-3 h-3" /> Início (Raiz)
                    </span>
                  </SelectItem>
                  {folders.filter((f: any) => f.id !== selectedMaterial?.folder_id).map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="flex items-center gap-2">
                        <Folder className="w-3 h-3 text-yellow-500" /> {folder.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (selectedFolderToMove === "root_folder_value_placeholder") {
                setSelectedFolderToMove(""); // treat as null
                // State update might not be immediate for the process function, so handling it carefully
                // Actually, setSelectedFolderToMove is asyncstate, so we can't just set it and call verify.
                // We need to handle the placeholder logic in the process function or before setting input.
                // Let's adjust the button:
              }

              // Hack: We need to pass the correct value to the processor if it's the placeholder.
              // But since we are using state, we should probably set state correctly in onValueChange.
              // Let's change onValueChange above: 
              //    if (val === 'root...') setSelectedFolderToMove("") else setSelected...
              // But SelectItem needs a valid value.

              processMoveMaterial();
            }}>
              Mover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Excluir {selectedMaterialIds.length} Itens?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. {selectedMaterialIds.length} materiais serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 py-4">
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Dialog */}
      <Dialog open={isBulkMoveDialogOpen} onOpenChange={setIsBulkMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mover {selectedMaterialIds.length} Itens</DialogTitle>
            <DialogDescription>
              Selecione a pasta de destino para os materiais selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Selecione a Pasta de Destino</Label>
              <Select value={selectedFolderToMove} onValueChange={setSelectedFolderToMove}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root_folder_value_placeholder">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Home className="w-3 h-3" /> Início (Raiz)
                    </span>
                  </SelectItem>
                  {folders.map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="flex items-center gap-2">
                        <Folder className="w-3 h-3 text-yellow-500" /> {folder.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsBulkMoveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={processBulkMove}>
              Mover Itens
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}