import type { Timestamp } from "firebase/firestore";
import type { TransactionKind } from "@/types/transaction";

export type RecurringTemplate = {
  id: string;
  name: string;
  kind: TransactionKind;
  amount: number;
  categoryId: string;
  accountId: string;
  dayOfMonth: number;
  nextRunDate: Timestamp;
  active: boolean;
  createdAt: Timestamp | null;
};

export type RecurringInput = {
  name: string;
  kind: TransactionKind;
  amount: number;
  categoryId: string;
  accountId: string;
  dayOfMonth: number;
  active: boolean;
};
