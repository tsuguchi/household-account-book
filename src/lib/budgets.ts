import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { Budget, BudgetInput } from "@/types/budget";

function budgetsCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "budgets");
}

export function subscribeBudgetsByMonth(
  userId: string,
  yearMonth: string,
  onChange: (budgets: Budget[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(budgetsCollection(userId), where("yearMonth", "==", yearMonth));
  return onSnapshot(
    q,
    (snapshot) => {
      const budgets: Budget[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          yearMonth: data.yearMonth as string,
          categoryId: data.categoryId as string,
          amount: data.amount as number,
          createdAt: data.createdAt ?? null,
        };
      });
      budgets.sort((a, b) => {
        const ta = a.createdAt?.toMillis() ?? 0;
        const tb = b.createdAt?.toMillis() ?? 0;
        return ta - tb;
      });
      onChange(budgets);
    },
    (error) => onError?.(error),
  );
}

export async function createBudget(
  userId: string,
  input: BudgetInput,
): Promise<string> {
  const ref = await addDoc(budgetsCollection(userId), {
    ...input,
    amount: Math.round(input.amount),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: BudgetInput,
): Promise<void> {
  await updateDoc(doc(budgetsCollection(userId), budgetId), {
    yearMonth: input.yearMonth,
    categoryId: input.categoryId,
    amount: Math.round(input.amount),
  });
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  await deleteDoc(doc(budgetsCollection(userId), budgetId));
}
