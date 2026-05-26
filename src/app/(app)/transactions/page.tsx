"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeAccounts } from "@/lib/accounts";
import { subscribeCategories } from "@/lib/categories";
import {
  createTransaction,
  deleteTransaction,
  subscribeTransactionsByMonth,
  updateTransaction,
} from "@/lib/transactions";
import { ACCOUNT_TYPE_LABELS, type Account } from "@/types/account";
import type { Category } from "@/types/category";
import {
  TRANSACTION_KINDS,
  TRANSACTION_KIND_LABELS,
  type Transaction,
  type TransactionInput,
  type TransactionKind,
} from "@/types/transaction";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; transaction: Transaction };

const today = new Date();

export default function TransactionsPage() {
  const { user, configured } = useAuth();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    const unsub = subscribeAccounts(user.uid, setAccounts, (e) =>
      setLoadError(e.message),
    );
    return unsub;
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) return;
    const unsub = subscribeCategories(user.uid, setCategories, (e) =>
      setLoadError(e.message),
    );
    return unsub;
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeTransactionsByMonth(
      user.uid,
      year,
      month,
      (list) => {
        setTransactions(list);
        setLoading(false);
        setLoadError(null);
      },
      (e) => {
        setLoadError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [user, configured, year, month]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.kind === "income") income += t.amount;
      else if (t.kind === "expense") expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c] as const));
  }, [categories]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a] as const));
  }, [accounts]);

  if (!configured) {
    return (
      <NoticeBox>
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </NoticeBox>
    );
  }

  function goPrev() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }
  function goNext() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }
  function goThisMonth() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }

  const canAdd = accounts.length > 0 && categories.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">取引</h1>
        {form.mode === "closed" && (
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => setForm({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + 取引を追加
          </button>
        )}
      </div>

      {!canAdd && (
        <NoticeBox tone="info">
          取引を入力するには、口座とカテゴリを先に登録してください（
          <Link href="/accounts" className="underline">
            口座
          </Link>{" "}
          /{" "}
          <Link href="/categories" className="underline">
            カテゴリ
          </Link>
          ）。
        </NoticeBox>
      )}

      <MonthSwitcher
        year={year}
        month={month}
        onPrev={goPrev}
        onNext={goNext}
        onThisMonth={goThisMonth}
      />

      <SummaryCards summary={summary} />

      {form.mode !== "closed" && user && canAdd && (
        <TransactionForm
          key={form.mode === "edit" ? form.transaction.id : "new"}
          initial={form.mode === "edit" ? form.transaction : undefined}
          accounts={accounts}
          categories={categories}
          onCancel={() => setForm({ mode: "closed" })}
          onSubmit={async (input) => {
            if (form.mode === "edit") {
              await updateTransaction(user.uid, form.transaction.id, input);
            } else {
              await createTransaction(user.uid, input);
            }
            setForm({ mode: "closed" });
          }}
        />
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : loadError ? (
          <NoticeBox tone="error">読み込みに失敗しました: {loadError}</NoticeBox>
        ) : transactions.length === 0 ? (
          <NoticeBox>この月の取引はまだありません。「取引を追加」から記録してください。</NoticeBox>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {transactions.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                category={categoryMap.get(t.categoryId)}
                account={accountMap.get(t.accountId)}
                onEdit={() => setForm({ mode: "edit", transaction: t })}
                onDelete={async () => {
                  if (!user) return;
                  const ok = window.confirm("この取引を削除します。よろしいですか？");
                  if (!ok) return;
                  await deleteTransaction(user.uid, t.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MonthSwitcher({
  year,
  month,
  onPrev,
  onNext,
  onThisMonth,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onThisMonth: () => void;
}) {
  const isThisMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;
  return (
    <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onPrev}
        aria-label="前の月"
        className="rounded-md px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        ←
      </button>
      <div className="flex items-center gap-3">
        <span className="text-base font-medium">
          {year}年 {String(month).padStart(2, "0")}月
        </span>
        {!isThisMonth && (
          <button
            type="button"
            onClick={onThisMonth}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            今月
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="次の月"
        className="rounded-md px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        →
      </button>
    </div>
  );
}

function SummaryCards({
  summary,
}: {
  summary: { income: number; expense: number; balance: number };
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <SummaryCard label="収入" value={summary.income} tone="income" />
      <SummaryCard label="支出" value={summary.expense} tone="expense" />
      <SummaryCard
        label="差額"
        value={summary.balance}
        tone={summary.balance >= 0 ? "income" : "expense"}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  const colorClass =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${colorClass}`}>
        ¥ {value.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function TransactionRow({
  transaction,
  category,
  account,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  category: Category | undefined;
  account: Account | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = transaction.date.toDate();
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
  const amountColor =
    transaction.kind === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-12 shrink-0 text-sm font-medium text-zinc-500">{dateLabel}</div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: category?.color ?? "#9ca3af" }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {category?.name ?? "（不明なカテゴリ）"}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {account?.name ?? "（不明な口座）"}
            {transaction.memo ? ` ・ ${transaction.memo}` : ""}
          </p>
        </div>
      </div>
      <div className={`shrink-0 text-base font-semibold ${amountColor}`}>
        {transaction.kind === "income" ? "+" : "-"}¥{" "}
        {transaction.amount.toLocaleString("ja-JP")}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label="編集"
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="削除"
          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          削除
        </button>
      </div>
    </li>
  );
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function TransactionForm({
  initial,
  accounts,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: Transaction;
  accounts: Account[];
  categories: Category[];
  onSubmit: (input: TransactionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [dateStr, setDateStr] = useState(
    formatDateForInput(initial?.date.toDate() ?? new Date()),
  );
  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? accounts[0]?.id ?? "",
  );
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? filteredCategories[0]?.id ?? "",
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? "");
    }
  }, [filteredCategories, categoryId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("金額は正の数で入力してください。");
      setSubmitting(false);
      return;
    }
    if (!accountId) {
      setError("口座を選択してください。");
      setSubmitting(false);
      return;
    }
    if (!categoryId) {
      setError("カテゴリを選択してください。");
      setSubmitting(false);
      return;
    }
    try {
      await onSubmit({
        date: new Date(`${dateStr}T00:00:00`),
        amount: amountNum,
        kind,
        categoryId,
        accountId,
        memo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold">
        {initial ? "取引を編集" : "取引を追加"}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="block text-sm font-medium">収支区分</legend>
          <div className="mt-1 flex gap-2">
            {TRANSACTION_KINDS.map((k) => (
              <label
                key={k}
                className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition ${
                  kind === k
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="sr-only"
                />
                {TRANSACTION_KIND_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="tx-date" className="block text-sm font-medium">
            日付
          </label>
          <input
            id="tx-date"
            type="date"
            required
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label htmlFor="tx-amount" className="block text-sm font-medium">
            金額 (円)
          </label>
          <input
            id="tx-amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例: 1500"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label htmlFor="tx-category" className="block text-sm font-medium">
            カテゴリ
          </label>
          <select
            id="tx-category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={filteredCategories.length === 0}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {filteredCategories.length === 0 ? (
              <option value="">
                {TRANSACTION_KIND_LABELS[kind]}カテゴリがありません
              </option>
            ) : (
              filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="tx-account" className="block text-sm font-medium">
            口座
          </label>
          <select
            id="tx-account"
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}（{ACCOUNT_TYPE_LABELS[a.type]}）
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="tx-memo" className="block text-sm font-medium">
            メモ <span className="text-xs font-normal text-zinc-500">(任意)</span>
          </label>
          <input
            id="tx-memo"
            type="text"
            maxLength={120}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {submitting ? "保存中…" : initial ? "更新" : "追加"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

function NoticeBox({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error";
}) {
  const toneClass =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  return (
    <div className={`mt-4 rounded-lg border p-4 text-sm ${toneClass}`}>{children}</div>
  );
}
