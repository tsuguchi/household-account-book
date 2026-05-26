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
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { Account, AccountInput } from "@/types/account";

function accountsCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "accounts");
}

export function subscribeAccounts(
  userId: string,
  onChange: (accounts: Account[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(accountsCollection(userId), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const accounts: Account[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name as string,
          type: data.type as Account["type"],
          initialBalance: data.initialBalance as number,
          createdAt: data.createdAt ?? null,
        };
      });
      onChange(accounts);
    },
    (error) => onError?.(error),
  );
}

export async function createAccount(userId: string, input: AccountInput): Promise<string> {
  const ref = await addDoc(accountsCollection(userId), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: AccountInput,
): Promise<void> {
  await updateDoc(doc(accountsCollection(userId), accountId), { ...input });
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  await deleteDoc(doc(accountsCollection(userId), accountId));
}
