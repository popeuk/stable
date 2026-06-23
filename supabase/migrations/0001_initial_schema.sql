-- ============================================================================
-- Be Stable v2 — initial schema (spec section 4)
-- ============================================================================
-- Apply with the Supabase CLI:  supabase db push
-- or via the Supabase MCP `apply_migration` tool.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  stable_name TEXT NOT NULL,
  region TEXT,
  stable_type TEXT CHECK (stable_type IN ('pension_simple', 'ecurie_active', 'centre_equestre', 'mixte')),
  onboarded_at TIMESTAMPTZ,
  mastery_level INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 3),
  notification_preferences JSONB DEFAULT '{"weekly_insight": true, "monthly_audit": true, "horse_alerts": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Stables
-- ----------------------------------------------------------------------------
CREATE TABLE public.stables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  capacity INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stables_owner ON public.stables(owner_id);

-- ----------------------------------------------------------------------------
-- Horses
-- ----------------------------------------------------------------------------
CREATE TABLE public.horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT,
  birth_year INT,
  owner_name TEXT,
  owner_contact TEXT,
  entry_date DATE NOT NULL,
  exit_date DATE,
  is_archived BOOLEAN DEFAULT FALSE,
  pension_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_horses_stable_active ON public.horses(stable_id) WHERE is_archived = FALSE;

-- ----------------------------------------------------------------------------
-- Categories
-- ----------------------------------------------------------------------------
CREATE TABLE public.revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  icon TEXT,
  display_order INT,
  UNIQUE(stable_id, name)
);

CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  icon TEXT,
  is_direct BOOLEAN DEFAULT TRUE,
  display_order INT,
  UNIQUE(stable_id, name)
);

-- ----------------------------------------------------------------------------
-- Revenues
-- ----------------------------------------------------------------------------
CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.revenue_categories(id),
  amount NUMERIC(10, 2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  source TEXT CHECK (source IN ('manual', 'voice', 'photo', 'recurring')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenues_horse_date ON public.revenues(horse_id, date);
CREATE INDEX idx_revenues_stable_date ON public.revenues(stable_id, date);

-- ----------------------------------------------------------------------------
-- Direct expenses (charged to one horse)
-- ----------------------------------------------------------------------------
CREATE TABLE public.direct_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id),
  label TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  source TEXT CHECK (source IN ('manual', 'voice', 'photo', 'recurring')),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_direct_expenses_horse_date ON public.direct_expenses(horse_id, date);
CREATE INDEX idx_direct_expenses_stable_date ON public.direct_expenses(stable_id, date);

-- ----------------------------------------------------------------------------
-- Shared (mutualised) expenses + allocations
-- ----------------------------------------------------------------------------
CREATE TABLE public.shared_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id),
  label TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL,
  distribution_mode TEXT NOT NULL CHECK (distribution_mode IN ('equal', 'weighted_by_days')),
  source TEXT CHECK (source IN ('manual', 'voice', 'photo', 'recurring')),
  receipt_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shared_expenses_stable_period ON public.shared_expenses(stable_id, period_year, period_month);

CREATE TABLE public.shared_expense_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_expense_id UUID NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(10, 2) NOT NULL,
  presence_days INT,
  UNIQUE(shared_expense_id, horse_id)
);

CREATE INDEX idx_allocations_horse ON public.shared_expense_allocations(horse_id);

-- ----------------------------------------------------------------------------
-- Recurring expense templates
-- ----------------------------------------------------------------------------
CREATE TABLE public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  horse_id UUID REFERENCES public.horses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id),
  label TEXT NOT NULL,
  expected_amount NUMERIC(10, 2) NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  auto_create BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Insights
-- ----------------------------------------------------------------------------
CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  key_metric_value NUMERIC,
  key_metric_label TEXT,
  related_horse_id UUID REFERENCES public.horses(id) ON DELETE SET NULL,
  cta_label TEXT,
  cta_action TEXT,
  score NUMERIC NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  acted_upon BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_insights_stable ON public.insights(stable_id, generated_at DESC);

-- ----------------------------------------------------------------------------
-- Scenarios
-- ----------------------------------------------------------------------------
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_period_year INT,
  base_period_month INT,
  parameters JSONB NOT NULL,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Lesson progress
-- ----------------------------------------------------------------------------
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_key)
);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','horses','revenues','direct_expenses','shared_expenses']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;
