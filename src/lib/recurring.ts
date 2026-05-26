import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { RecurringInput, RecurringTemplate } from "@/types/recurring";

function recurringCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "recurring");
}

function transactionsCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "transactions");
}

export function clampDayOfMonth(year: number, month0: number, dayOfMonth: number): number {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return Math.min(dayOfMonth, lastDay);
}

export function buildDateForMonth(
  year: number,
  month0: number,
  dayOfMonth: number,
): Date {
  return new Date(year, month0, clampDayOfMonth(year, month0, dayOfMonth));
}

export function computeNextRunDate(from: Date, dayOfMonth: number): Date {
  const y = from.getFullYear();
  const m0 = from.getMonth() + 1;
  return buildDateForMonth(y, m0, dayOfMonth);
}

export function computeInitialNextRunDate(dayOfMonth: number, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = buildDateForMonth(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (candidate.getTime() < today.getTime()) {
    return computeNextRunDate(candidate, dayOfMonth);
  }
  return candidate;
}

export function subscribeRecurring(
  userId: string,
  onChange: (items: RecurringTemplate[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    recurringCollection(userId),
    (snapshot) => {
      const items: RecurringTemplate[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name as string,
          kind: data.kind as RecurringTemplate["kind"],
          amount: data.amount as number,
          categoryId: data.categoryId as string,
          accountId: data.accountId as string,
          dayOfMonth: data.dayOfMonth as number,
          nextRunDate: data.nextRunDate as Timestamp,
          active: Boolean(data.active),
          createdAt: data.createdAt ?? null,
        };
      });
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis() ?? 0;
        const tb = b.createdAt?.toMillis() ?? 0;
        return ta - tb;
      });
      onChange(items);
    },
    (e) => onError?.(e),
  );
}

export async function createRecurring(userId: string, input: RecurringInput): Promise<string> {
  const nextRun = computeInitialNextRunDate(input.dayOfMonth);
  const ref = await addDoc(recurringCollection(userId), {
    name: input.name.trim(),
    kind: input.kind,
    amount: Math.round(input.amount),
    categoryId: input.categoryId,
    accountId: input.accountId,
    dayOfMonth: input.dayOfMonth,
    nextRunDate: Timestamp.fromDate(nextRun),
    active: input.active,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecurring(
  userId: string,
  id: string,
  input: RecurringInput,
  existing: RecurringTemplate,
): Promise<void> {
  const dayChanged = existing.dayOfMonth !== input.dayOfMonth;
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    kind: input.kind,
    amount: Math.round(input.amount),
    categoryId: input.categoryId,
    accountId: input.accountId,
    dayOfMonth: input.dayOfMonth,
    active: input.active,
  };
  if (dayChanged) {
    payload.nextRunDate = Timestamp.fromDate(computeInitialNextRunDate(input.dayOfMonth));
  }
  await updateDoc(doc(recurringCollection(userId), id), payload);
}

export async function deleteRecurring(userId: string, id: string): Promise<void> {
  await deleteDoc(doc(recurringCollection(userId), id));
}

export type ProcessRecurringResult = {
  generated: number;
};

export async function processRecurringDue(
  userId: string,
  now: Date = new Date(),
): Promise<ProcessRecurringResult> {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const snap = await getDocs(
    query(recurringCollection(userId), where("active", "==", true)),
  );
  if (snap.empty) return { generated: 0 };

  const batch = writeBatch(getFirebaseDb());
  let generated = 0;
  const txCol = transactionsCollection(userId);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    let nextRun = (data.nextRunDate as Timestamp).toDate();
    const dayOfMonth = data.dayOfMonth as number;
    let advanced = false;

    while (nextRun.getTime() <= todayMidnight.getTime()) {
      const txRef = doc(txCol);
      batch.set(txRef, {
        date: Timestamp.fromDate(nextRun),
        amount: data.amount as number,
        kind: data.kind as string,
        categoryId: data.categoryId as string,
        accountId: data.accountId as string,
        memo: `${data.name as string} (定期)`,
        recurringId: docSnap.id,
        createdAt: serverTimestamp(),
      });
      generated++;
      nextRun = computeNextRunDate(nextRun, dayOfMonth);
      advanced = true;
    }
    if (advanced) {
      batch.update(docSnap.ref, { nextRunDate: Timestamp.fromDate(nextRun) });
    }
  }

  if (generated > 0) await batch.commit();
  return { generated };
}
