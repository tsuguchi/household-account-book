import type { Timestamp } from "firebase/firestore";

export const TRANSACTION_KINDS = ["expense", "income"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  expense: "支出",
  income: "収入",
};

export type Transaction = {
  id: string;
  date: Timestamp;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  accountId: string;
  memo: string;
  createdAt: Timestamp | null;
};

export type TransactionInput = {
  date: Date;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  accountId: string;
  memo: string;
};
