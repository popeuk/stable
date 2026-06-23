-- ============================================================================
-- Be Stable v2 — Row Level Security + default category seeding (spec 4.2 / 4.3)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stables                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horses                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenues                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expense_allocations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress             ENABLE ROW LEVEL SECURITY;

-- Helper: stables owned by the current user.
CREATE OR REPLACE FUNCTION public.owns_stable(target_stable UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stables s
    WHERE s.id = target_stable AND s.owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- profiles: a user manages only their own row
-- ----------------------------------------------------------------------------
CREATE POLICY "own profile" ON public.profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- stables: owner-scoped
-- ----------------------------------------------------------------------------
CREATE POLICY "own stables" ON public.stables
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- All stable-scoped tables share the same shape of policy.
-- ----------------------------------------------------------------------------
CREATE POLICY "stable scoped" ON public.horses
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.revenue_categories
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.expense_categories
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.revenues
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.direct_expenses
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.shared_expenses
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.recurring_expenses
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.insights
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));
CREATE POLICY "stable scoped" ON public.scenarios
  FOR ALL USING (public.owns_stable(stable_id)) WITH CHECK (public.owns_stable(stable_id));

-- allocations are reached through their parent shared_expense.
CREATE POLICY "via shared expense" ON public.shared_expense_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = shared_expense_id AND public.owns_stable(se.stable_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = shared_expense_id AND public.owns_stable(se.stable_id)
    )
  );

-- lesson progress is per-user.
CREATE POLICY "own lessons" ON public.lesson_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Seed default categories whenever a stable is created (spec 4.3)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rev TEXT[] := ARRAY['Pension','Cours','Sport','Transport','Débourrage','Demi-pension','Vente'];
  dir TEXT[] := ARRAY['Maréchal-ferrant','Vétérinaire','Médicaments','Équipement','Concours','Transport','Compléments'];
  sha TEXT[] := ARRAY['Foin','Granulés','Litière','Personnel','Loyer / foncier','Eau','Électricité','Assurance','Entretien','Fournitures'];
  i INT;
BEGIN
  FOR i IN 1 .. array_length(rev, 1) LOOP
    INSERT INTO public.revenue_categories (stable_id, name, is_default, display_order)
    VALUES (NEW.id, rev[i], TRUE, i)
    ON CONFLICT (stable_id, name) DO NOTHING;
  END LOOP;

  FOR i IN 1 .. array_length(dir, 1) LOOP
    INSERT INTO public.expense_categories (stable_id, name, is_default, is_direct, display_order)
    VALUES (NEW.id, dir[i], TRUE, TRUE, i)
    ON CONFLICT (stable_id, name) DO NOTHING;
  END LOOP;

  FOR i IN 1 .. array_length(sha, 1) LOOP
    INSERT INTO public.expense_categories (stable_id, name, is_default, is_direct, display_order)
    VALUES (NEW.id, sha[i], TRUE, FALSE, 100 + i)
    ON CONFLICT (stable_id, name) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_categories
  AFTER INSERT ON public.stables
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();

-- ----------------------------------------------------------------------------
-- Create a profile row automatically on signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, stable_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'stable_name', 'Mon écurie')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
