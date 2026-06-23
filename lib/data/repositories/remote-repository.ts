/**
 * Supabase implementation of RemoteRepository (spec section 3.2 Data Layer).
 * Translates a queued mutation into the right table write, mapping the domain
 * shape to Postgres rows. Not unit-tested (needs live credentials); exercised
 * once NEXT_PUBLIC_SUPABASE_* are set.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Mutation, RemoteRepository } from "@/lib/data/sync/types";
import type {
  DirectExpense,
  Horse,
  Revenue,
  SharedExpense,
} from "@/lib/domain/types";
import {
  allocationsToRows,
  directExpenseToRow,
  horseToRow,
  revenueToRow,
  sharedExpenseToRow,
} from "@/lib/data/sync/mappers";

export class SupabaseRemoteRepository implements RemoteRepository {
  constructor(private client: SupabaseClient) {}

  async apply(mutation: Mutation): Promise<void> {
    const { type, table, payload } = mutation;

    if (type === "delete") {
      const { error } = await this.client.from(table).delete().eq("id", payload.id);
      if (error) throw new Error(error.message);
      return;
    }

    if (table === "shared_expenses") {
      await this.upsertSharedExpense(payload as unknown as SharedExpense);
      return;
    }

    const row =
      table === "horses"
        ? horseToRow(payload as unknown as Horse)
        : table === "revenues"
          ? revenueToRow(payload as unknown as Revenue)
          : directExpenseToRow(payload as unknown as DirectExpense);

    const { error } = await this.client.from(table).upsert(row);
    if (error) throw new Error(error.message);
  }

  /** Upsert the head row, then replace its allocations atomically-ish. */
  private async upsertSharedExpense(se: SharedExpense): Promise<void> {
    const head = await this.client.from("shared_expenses").upsert(sharedExpenseToRow(se));
    if (head.error) throw new Error(head.error.message);

    const del = await this.client
      .from("shared_expense_allocations")
      .delete()
      .eq("shared_expense_id", se.id);
    if (del.error) throw new Error(del.error.message);

    if (se.allocations.length > 0) {
      const ins = await this.client
        .from("shared_expense_allocations")
        .insert(allocationsToRows(se));
      if (ins.error) throw new Error(ins.error.message);
    }
  }
}
