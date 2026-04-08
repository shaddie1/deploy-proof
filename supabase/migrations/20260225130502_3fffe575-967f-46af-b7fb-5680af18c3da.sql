
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'warehouse_manager', 'field_officer', 'auditor');
CREATE TYPE public.shipment_status AS ENUM ('ordered', 'in_transit', 'customs', 'received', 'partial');
CREATE TYPE public.deployment_status AS ENUM ('scheduled', 'in_transit', 'deployed', 'verified', 'flagged');
CREATE TYPE public.evidence_event_type AS ENUM ('shipment', 'deployment', 'audit', 'stock_adjustment');
CREATE TYPE public.item_category AS ENUM ('cookstove', 'iot_device', 'antenna', 'sensor', 'other');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  -- Auto-assign 'admin' role to first user, 'field_officer' to others
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'field_officer');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== ITEMS (ASSET CATALOG) ==========
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category item_category NOT NULL DEFAULT 'other',
  unit_of_measure TEXT NOT NULL DEFAULT 'unit',
  description TEXT DEFAULT '',
  specifications JSONB DEFAULT '{}',
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view items" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and warehouse managers can manage items" ON public.items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse_manager'));

-- ========== PROJECTS ==========
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  region TEXT DEFAULT '',
  description TEXT DEFAULT '',
  target_quantity INTEGER NOT NULL DEFAULT 0,
  responsible_officer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== SHIPMENTS ==========
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity INTEGER NOT NULL,
  origin_country TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  expected_arrival DATE,
  actual_arrival DATE,
  status shipment_status NOT NULL DEFAULT 'ordered',
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view shipments" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and warehouse managers can manage shipments" ON public.shipments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse_manager'));

-- ========== STOCK BATCHES ==========
CREATE TABLE public.stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity_received INTEGER NOT NULL,
  quantity_available INTEGER NOT NULL,
  quantity_deployed INTEGER NOT NULL DEFAULT 0,
  condition TEXT DEFAULT 'good',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view stock" ON public.stock_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and warehouse managers can manage stock" ON public.stock_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse_manager'));

-- ========== DEPLOYMENTS ==========
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  stock_batch_id UUID NOT NULL REFERENCES public.stock_batches(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity INTEGER NOT NULL,
  deployment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location_name TEXT DEFAULT '',
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  status deployment_status NOT NULL DEFAULT 'scheduled',
  field_officer_id UUID NOT NULL REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view deployments" ON public.deployments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and field officers can manage deployments" ON public.deployments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'field_officer'));

-- ========== EVIDENCE FILES ==========
CREATE TABLE public.evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'document',
  file_size INTEGER DEFAULT 0,
  sha256_hash TEXT NOT NULL,
  event_type evidence_event_type NOT NULL,
  linked_entity_type TEXT NOT NULL,
  linked_entity_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT DEFAULT '',
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view evidence" ON public.evidence_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can upload evidence" ON public.evidence_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Admins can flag evidence" ON public.evidence_files FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========== STOCK ADJUSTMENTS ==========
CREATE TABLE public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_batch_id UUID NOT NULL REFERENCES public.stock_batches(id),
  quantity_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  adjusted_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view adjustments" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and warehouse managers can adjust stock" ON public.stock_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse_manager'));

-- ========== AUDIT LOG ==========
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and auditors can view audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ========== UPDATED_AT TRIGGER ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_batches_updated_at BEFORE UPDATE ON public.stock_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== STORAGE BUCKETS ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', true);

CREATE POLICY "Authenticated users can upload evidence files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "Anyone can view evidence files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence');
