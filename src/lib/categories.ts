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
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { DEFAULT_CATEGORIES, type Category, type CategoryInput } from "@/types/category";

function categoriesCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "categories");
}

export function subscribeCategories(
  userId: string,
  onChange: (categories: Category[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(categoriesCollection(userId), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const categories: Category[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name as string,
          color: data.color as string,
          kind: data.kind as Category["kind"],
          isDefault: Boolean(data.isDefault),
          createdAt: data.createdAt ?? null,
        };
      });
      onChange(categories);
    },
    (error) => onError?.(error),
  );
}

export async function createCategory(
  userId: string,
  input: CategoryInput,
): Promise<string> {
  const ref = await addDoc(categoriesCollection(userId), {
    ...input,
    isDefault: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  await updateDoc(doc(categoriesCollection(userId), categoryId), { ...input });
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  await deleteDoc(doc(categoriesCollection(userId), categoryId));
}

export async function seedDefaultCategories(userId: string): Promise<number> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const colRef = categoriesCollection(userId);
  for (const c of DEFAULT_CATEGORIES) {
    const ref = doc(colRef);
    batch.set(ref, {
      name: c.name,
      color: c.color,
      kind: c.kind,
      isDefault: true,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return DEFAULT_CATEGORIES.length;
}
