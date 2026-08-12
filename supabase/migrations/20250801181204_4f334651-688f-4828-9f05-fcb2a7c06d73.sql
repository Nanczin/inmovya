-- Criar enum para os roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'consultant', 'viewer', 'guest');

-- Criar tabela de user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'guest',
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função security definer para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Criar função para verificar se usuário tem pelo menos um nível de permissão
CREATE OR REPLACE FUNCTION public.has_role_level(_user_id UUID, _min_level INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND CASE ur.role
        WHEN 'admin' THEN 5
        WHEN 'manager' THEN 4
        WHEN 'consultant' THEN 3
        WHEN 'viewer' THEN 2
        WHEN 'guest' THEN 1
        ELSE 0
      END >= _min_level
  );
$$;

-- Criar função para obter o maior role de um usuário
CREATE OR REPLACE FUNCTION public.get_user_highest_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 5
    WHEN 'manager' THEN 4
    WHEN 'consultant' THEN 3
    WHEN 'viewer' THEN 2
    WHEN 'guest' THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$;

-- Políticas RLS para user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir role de admin para a conta principal
INSERT INTO public.user_roles (user_id, role, assigned_by)
SELECT 
    u.id,
    'admin'::app_role,
    u.id
FROM auth.users u
WHERE u.email = 'estevao.v.garcia10@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Criar tabela de permissões de módulos
CREATE TABLE public.module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    module_name TEXT NOT NULL,
    can_create BOOLEAN DEFAULT FALSE,
    can_read BOOLEAN DEFAULT FALSE,
    can_update BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_manage BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (role, module_name)
);

-- Habilitar RLS na tabela module_permissions
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- Política para visualizar permissões de módulos
CREATE POLICY "Users can view module permissions"
ON public.module_permissions
FOR SELECT
TO authenticated
USING (true);

-- Política para admins gerenciarem permissões
CREATE POLICY "Admins can manage module permissions"
ON public.module_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir permissões padrão para cada role
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_manage) VALUES
-- Admin - acesso total
('admin', 'dashboard', true, true, true, true, true),
('admin', 'leads', true, true, true, true, true),
('admin', 'campanhas', true, true, true, true, true),
('admin', 'empreendimentos', true, true, true, true, true),
('admin', 'ligacoes', true, true, true, true, true),
('admin', 'relatorios', true, true, true, true, true),
('admin', 'vozes', true, true, true, true, true),
('admin', 'materiais', true, true, true, true, true),
('admin', 'configuracoes', true, true, true, true, true),
('admin', 'usuarios', true, true, true, true, true),

-- Manager - gestão sem configurações do sistema
('manager', 'dashboard', true, true, true, false, true),
('manager', 'leads', true, true, true, true, false),
('manager', 'campanhas', true, true, true, true, true),
('manager', 'empreendimentos', true, true, true, true, false),
('manager', 'ligacoes', false, true, true, false, false),
('manager', 'relatorios', false, true, false, false, false),
('manager', 'vozes', true, true, true, false, false),
('manager', 'materiais', true, true, true, true, false),

-- Consultant - operacional
('consultant', 'dashboard', false, true, false, false, false),
('consultant', 'leads', false, true, true, false, false),
('consultant', 'ligacoes', true, true, true, false, false),
('consultant', 'vozes', false, true, false, false, false),
('consultant', 'materiais', false, true, false, false, false),

-- Viewer - apenas visualização
('viewer', 'dashboard', false, true, false, false, false),
('viewer', 'leads', false, true, false, false, false),
('viewer', 'relatorios', false, true, false, false, false),

-- Guest - acesso mínimo
('guest', 'dashboard', false, true, false, false, false);

-- Trigger para module_permissions
CREATE TRIGGER update_module_permissions_updated_at
BEFORE UPDATE ON public.module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();