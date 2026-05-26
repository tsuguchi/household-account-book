import type { Timestamp } from "firebase/firestore";

export type Budget = {
  id: string;
  yearMonth: string; // "YYYY-MM"
  categoryId: string;
  amount: number;
  createdAt: Timestamp | null;
};

export type BudgetInput = {
  yearMonth: string;
  categoryId: string;
  amount: number;
};

export function toYearMonth(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}
