import {
  collection,
  getDocs,
  query,
  orderBy,
  writeBatch,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { buildCsv, parseCsv } from "@/lib/csv";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { TransactionKind } from "@/types/transaction";

export const CSV_HEADERS = ["date", "kind", "amount", "category", "account", "memo"] as const;

type RawTransaction = {
  date: Timestamp;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  accountId: string;
  memo: string;
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function exportTransactionsCsv(
  userId: string,
  accounts: ReadonlyArray<Account>,
  categories: ReadonlyArray<Category>,
): Promise<string> {
  const db = getFirebaseDb();
  const q = query(collection(db, "users", userId, "transactions"), orderBy("date", "asc"));
  const snap = await getDocs(q);

  const accountMap = new Map(accounts.map((a) => [a.id, a.name] as const));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name] as const));

  const rows: string[][] = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as RawTransaction;
    rows.push([
      formatDate(data.date.toDate()),
      data.kind,
      String(data.amount),
      categoryMap.get(data.categoryId) ?? "",
      accountMap.get(data.accountId) ?? "",
      data.memo ?? "",
    ]);
  }
  return buildCsv(CSV_HEADERS as unknown as string[], rows);
}

export type ImportRowError = {
  rowNumber: number;
  reason: string;
};

export type ImportResult = {
  inserted: number;
  errors: ImportRowError[];
};

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00`));
}

function isValidKind(s: string): s is TransactionKind {
  return s === "expense" || s === "income";
}

export async function importTransactionsCsv(
  userId: string,
  csv: string,
  accounts: ReadonlyArray<Account>,
  categories: ReadonlyArray<Category>,
): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { inserted: 0, errors: [] };

  const [header, ...dataRows] = rows;
  const headerNorm = header.map((h) => h.trim().toLowerCase());
  const expected = CSV_HEADERS as unknown as string[];
  if (
    headerNorm.length < expected.length ||
    expected.some((h, i) => headerNorm[i] !== h)
  ) {
    return {
      inserted: 0,
      errors: [
        {
          rowNumber: 1,
          reason: `ヘッダー行が想定と異なります。期待: ${expected.join(",")}`,
        },
      ],
    };
  }

  const errors: ImportRowError[] = [];
  const accountIdByName = new Map(accounts.map((a) => [a.name, a.id] as const));
  const categoryIdByKindAndName = new Map<string, string>();
  for (const c of categories) {
    categoryIdByKindAndName.set(`${c.kind}::${c.name}`, c.id);
  }

  const db = getFirebaseDb();
  const txCol = collection(db, "users", userId, "transactions");

  type PreparedRow = {
    dateMs: number;
    kind: TransactionKind;
    amount: number;
    categoryId: string;
    accountId: string;
    memo: string;
  };
  const prepared: PreparedRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2;
    if (row.every((cell) => cell.trim() === "")) continue;

    const [dateStr, kindStr, amountStr, categoryName, accountName, memo] = row;
    if (!isValidDate(dateStr ?? "")) {
      errors.push({ rowNumber, reason: `日付の形式が不正です: "${dateStr}"` });
      continue;
    }
    if (!isValidKind(kindStr ?? "")) {
      errors.push({ rowNumber, reason: `収支区分は expense / income のいずれか: "${kindStr}"` });
      continue;
    }
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ rowNumber, reason: `金額は正の数: "${amountStr}"` });
      continue;
    }
    const accountId = accountIdByName.get(accountName?.trim() ?? "");
    if (!accountId) {
      errors.push({ rowNumber, reason: `口座名が見つかりません: "${accountName}"` });
      continue;
    }
    const categoryId = categoryIdByKindAndName.get(`${kindStr}::${(categoryName ?? "").trim()}`);
    if (!categoryId) {
      errors.push({
        rowNumber,
        reason: `カテゴリ名 (${kindStr}) が見つかりません: "${categoryName}"`,
      });
      continue;
    }

    prepared.push({
      dateMs: Date.parse(`${dateStr}T00:00:00`),
      kind: kindStr as TransactionKind,
      amount: Math.round(amount),
      categoryId,
      accountId,
      memo: (memo ?? "").trim(),
    });
  }

  if (prepared.length === 0) {
    return { inserted: 0, errors };
  }

  const CHUNK = 400;
  let inserted = 0;
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = prepared.slice(i, i + CHUNK);
    for (const row of slice) {
      const ref = doc(txCol);
      batch.set(ref, {
        date: Timestamp.fromMillis(row.dateMs),
        kind: row.kind,
        amount: row.amount,
        categoryId: row.categoryId,
        accountId: row.accountId,
        memo: row.memo,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    inserted += slice.length;
  }

  return { inserted, errors };
}
