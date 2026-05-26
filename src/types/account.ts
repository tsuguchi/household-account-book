import type { Timestamp } from "firebase/firestore";

export const ACCOUNT_TYPES = ["cash", "bank", "card", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "現金",
  bank: "銀行",
  card: "カード",
  other: "その他",
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  createdAt: Timestamp | null;
};

export type AccountInput = {
  name: string;
  type: AccountType;
  initialBalance: number;
};
