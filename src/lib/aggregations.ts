import type { Budget } from "@/types/budget";
import type { Category } from "@/types/category";
import type { Transaction, TransactionKind } from "@/types/transaction";

export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  color: string;
  total: number;
};

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
};

export function summarize(transactions: ReadonlyArray<Transaction>): MonthlySummary {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.kind === "income") income += t.amount;
    else if (t.kind === "expense") expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function breakdownByCategory(
  transactions: ReadonlyArray<Transaction>,
  categories: ReadonlyArray<Category>,
  kind: TransactionKind,
): CategoryBreakdownItem[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  const items: CategoryBreakdownItem[] = [];
  for (const [categoryId, total] of totals) {
    const cat = categories.find((c) => c.id === categoryId);
    items.push({
      categoryId,
      name: cat?.name ?? "（不明）",
      color: cat?.color ?? "#9ca3af",
      total,
    });
  }
  return items.sort((a, b) => b.total - a.total);
}

export type BudgetStatus = "ok" | "warning" | "over";

export type BudgetConsumptionItem = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  color: string;
  budget: number;
  spent: number;
  ratio: number;
  status: BudgetStatus;
};

export const BUDGET_WARNING_RATIO = 0.8;

export function budgetConsumption(
  budgets: ReadonlyArray<Budget>,
  transactions: ReadonlyArray<Transaction>,
  categories: ReadonlyArray<Category>,
): BudgetConsumptionItem[] {
  const spentByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  return budgets.map((b) => {
    const cat = categories.find((c) => c.id === b.categoryId);
    const spent = spentByCategory.get(b.categoryId) ?? 0;
    const ratio = b.amount > 0 ? spent / b.amount : 0;
    const status: BudgetStatus =
      ratio >= 1 ? "over" : ratio >= BUDGET_WARNING_RATIO ? "warning" : "ok";
    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: cat?.name ?? "（不明）",
      color: cat?.color ?? "#9ca3af",
      budget: b.amount,
      spent,
      ratio,
      status,
    };
  });
}
