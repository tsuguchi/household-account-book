import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { Transaction, TransactionInput } from "@/types/transaction";

function transactionsCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "transactions");
}

export function subscribeTransactionsByMonth(
  userId: string,
  year: number,
  month1to12: number,
  onChange: (transactions: Transaction[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1to12, 1, 0, 0, 0, 0);
  const q = query(
    transactionsCollection(userId),
    where("date", ">=", Timestamp.fromDate(start)),
    where("date", "<", Timestamp.fromDate(end)),
    orderBy("date", "desc"),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const transactions: Transaction[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          date: data.date as Timestamp,
          amount: data.amount as number,
          kind: data.kind as Transaction["kind"],
          categoryId: data.categoryId as string,
          accountId: data.accountId as string,
          memo: (data.memo as string | undefined) ?? "",
          createdAt: data.createdAt ?? null,
        };
      });
      onChange(transactions);
    },
    (error) => onError?.(error),
  );
}

function toFirestorePayload(input: TransactionInput) {
  return {
    date: Timestamp.fromDate(input.date),
    amount: Math.round(input.amount),
    kind: input.kind,
    categoryId: input.categoryId,
    accountId: input.accountId,
    memo: input.memo.trim(),
  };
}

export async function createTransaction(
  userId: string,
  input: TransactionInput,
): Promise<string> {
  const ref = await addDoc(transactionsCollection(userId), {
    ...toFirestorePayload(input),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: TransactionInput,
): Promise<void> {
  await updateDoc(
    doc(transactionsCollection(userId), transactionId),
    toFirestorePayload(input),
  );
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<void> {
  await deleteDoc(doc(transactionsCollection(userId), transactionId));
}
