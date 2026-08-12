-- Corrigir funções para definir search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_level(_user_id UUID, _min_level INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.get_user_highest_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
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