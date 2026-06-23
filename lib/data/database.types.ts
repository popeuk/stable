/**
 * Database row types matching supabase/migrations (spec section 4).
 *
 * Hand-maintained to mirror the schema. Once the project is provisioned, this
 * file can be regenerated with:
 *   supabase gen types typescript --project-id <id> > lib/data/database.types.ts
 */

export type Source = "manual" | "voice" | "photo" | "recurring";
export type DistributionMode = "equal" | "weighted_by_days";
export type StableType =
  | "pension_simple"
  | "ecurie_active"
  | "centre_equestre"
  | "mixte";
export type Frequency = "monthly" | "quarterly" | "yearly";

export interface Database {
  public: {
    Tables: {
      profiles: Row<{
        id: string;
        full_name: string | null;
        stable_name: string;
        region: string | null;
        stable_type: StableType | null;
        onboarded_at: string | null;
        mastery_level: number;
        notification_preferences: {
          weekly_insight: boolean;
          monthly_audit: boolean;
          horse_alerts: boolean;
        };
        created_at: string;
        updated_at: string;
      }>;
      stables: Row<{
        id: string;
        owner_id: string;
        name: string;
        is_primary: boolean;
        capacity: number | null;
        created_at: string;
      }>;
      horses: Row<{
        id: string;
        stable_id: string;
        name: string;
        breed: string | null;
        birth_year: number | null;
        owner_name: string | null;
        owner_contact: string | null;
        entry_date: string;
        exit_date: string | null;
        is_archived: boolean;
        pension_type: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      revenue_categories: Row<{
        id: string;
        stable_id: string;
        name: string;
        is_default: boolean;
        icon: string | null;
        display_order: number | null;
      }>;
      expense_categories: Row<{
        id: string;
        stable_id: string;
        name: string;
        is_default: boolean;
        icon: string | null;
        is_direct: boolean;
        display_order: number | null;
      }>;
      revenues: Row<{
        id: string;
        stable_id: string;
        horse_id: string;
        category_id: string | null;
        amount: number;
        date: string;
        note: string | null;
        source: Source;
        created_at: string;
        updated_at: string;
      }>;
      direct_expenses: Row<{
        id: string;
        stable_id: string;
        horse_id: string;
        category_id: string | null;
        label: string;
        amount: number;
        date: string;
        note: string | null;
        source: Source;
        receipt_url: string | null;
        created_at: string;
        updated_at: string;
      }>;
      shared_expenses: Row<{
        id: string;
        stable_id: string;
        category_id: string | null;
        label: string;
        total_amount: number;
        period_month: number;
        period_year: number;
        distribution_mode: DistributionMode;
        source: Source;
        receipt_url: string | null;
        note: string | null;
        created_at: string;
        updated_at: string;
      }>;
      shared_expense_allocations: Row<{
        id: string;
        shared_expense_id: string;
        horse_id: string;
        allocated_amount: number;
        presence_days: number | null;
      }>;
      recurring_expenses: Row<{
        id: string;
        stable_id: string;
        horse_id: string | null;
        category_id: string | null;
        label: string;
        expected_amount: number;
        is_shared: boolean;
        frequency: Frequency;
        next_due_date: string;
        is_active: boolean;
        auto_create: boolean;
        created_at: string;
      }>;
      insights: Row<{
        id: string;
        stable_id: string;
        insight_type: string;
        title: string;
        body: string;
        key_metric_value: number | null;
        key_metric_label: string | null;
        related_horse_id: string | null;
        cta_label: string | null;
        cta_action: string | null;
        score: number;
        generated_at: string;
        opened_at: string | null;
        acted_upon: boolean;
      }>;
      scenarios: Row<{
        id: string;
        stable_id: string;
        name: string;
        base_period_year: number | null;
        base_period_month: number | null;
        parameters: Record<string, unknown>;
        results: Record<string, unknown> | null;
        created_at: string;
      }>;
      lesson_progress: Row<{
        id: string;
        user_id: string;
        lesson_key: string;
        first_seen_at: string;
        completed_at: string | null;
      }>;
    };
  };
}

/** Row helper: Row<T> exposes Row / Insert / Update shapes like supabase-gen. */
type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
};
