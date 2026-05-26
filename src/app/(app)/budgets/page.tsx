"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeCategories } from "@/lib/categories";
import {
  createBudget,
  deleteBudget,
  subscribeBudgetsByMonth,
  updateBudget,
} from "@/lib/budgets";
import { subscribeTransactionsByMonth } from "@/lib/transactions";
import { budgetConsumption } from "@/lib/aggregations";
import { toYearMonth, type Budget, type BudgetInput } from "@/types/budget";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; budget: Budget };

const today = new Date();

export default function BudgetsPage() {
  const { user, configured } = useAuth();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const yearMonth = toYearMonth(year, month);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeCategories(user.uid, setCategories, (e) => setLoadError(e.message));
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeBudgetsByMonth(
      user.uid,
      yearMonth,
      (list) => {
        setBudgets(list);
        setLoading(false);
        setLoadError(null);
      },
      (e) => {
        setLoadError(e.message);
        setLoading(false);
      },
    );
  }, [user, configured, yearMonth]);

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeTransactionsByMonth(user.uid, year, month, setTransactions);
  }, [user, configured, year, month]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories],
  );

  const consumption = useMemo(
    () => budgetConsumption(budgets, transactions, categories),
    [budgets, transactions, categories],
  );

  const availableCategories = useMemo(() => {
    if (form.mode !== "create") return expenseCategories;
    const usedIds = new Set(budgets.map((b) => b.categoryId));
    return expenseCategories.filter((c) => !usedIds.has(c.id));
  }, [expenseCategories, budgets, form.mode]);

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
  const isThisMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  const canAdd = expenseCategories.length > 0 && availableCategories.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">予算</h1>
        {form.mode === "closed" && (
          <button
            type="button"
            disabled={!canAdd || expenseCategories.length === 0}
            onClick={() => setForm({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + 予算を追加
          </button>
        )}
      </div>

      {expenseCategories.length === 0 && (
        <NoticeBox>
          予算は支出カテゴリに対して設定します。先に{" "}
          <Link href="/categories" className="underline">
            カテゴリ
          </Link>{" "}
          を登録してください。
        </NoticeBox>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={goPrev}
          aria-label="前の月"
          className="rounded-md px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          <span className="text-base font-medium">
            {year}年 {String(month).padStart(2, "0")}月 の予算
          </span>
          {!isThisMonth && (
            <button
              type="button"
              onClick={goThisMonth}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              今月
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="次の月"
          className="rounded-md px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          →
        </button>
      </div>

      {form.mode !== "closed" && user && (
        <BudgetForm
          key={form.mode === "edit" ? form.budget.id : "new"}
          initial={form.mode === "edit" ? form.budget : undefined}
          yearMonth={yearMonth}
          availableCategories={
            form.mode === "edit"
              ? categories.filter(
                  (c) => c.kind === "expense" || c.id === form.budget.categoryId,
                )
              : availableCategories
          }
          onCancel={() => setForm({ mode: "closed" })}
          onSubmit={async (input) => {
            if (form.mode === "edit") {
              await updateBudget(user.uid, form.budget.id, input);
            } else {
              await createBudget(user.uid, input);
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
        ) : consumption.length === 0 ? (
          <NoticeBox>この月の予算はまだ設定されていません。</NoticeBox>
        ) : (
          <ul className="space-y-3">
            {consumption.map((item) => (
              <li
                key={item.budgetId}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="truncate text-base font-medium">{item.categoryName}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const b = budgets.find((x) => x.id === item.budgetId);
                        if (b) setForm({ mode: "edit", budget: b });
                      }}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        const ok = window.confirm(
                          `「${item.categoryName}」の予算を削除します。よろしいですか？`,
                        );
                        if (!ok) return;
                        await deleteBudget(user.uid, item.budgetId);
                      }}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span>
                    <strong className="text-base">
                      ¥{item.spent.toLocaleString("ja-JP")}
                    </strong>
                    <span className="ml-1 text-zinc-500">
                      / ¥{item.budget.toLocaleString("ja-JP")}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      item.status === "over"
                        ? "text-rose-600 dark:text-rose-400"
                        : item.status === "warning"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-500"
                    }`}
                  >
                    {Math.round(item.ratio * 100)}%
                  </span>
                </div>
                <ProgressBar ratio={item.ratio} status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "warning" | "over" }) {
  if (status === "ok") return null;
  if (status === "warning") {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        80% 到達
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
      超過
    </span>
  );
}

function ProgressBar({
  ratio,
  status,
}: {
  ratio: number;
  status: "ok" | "warning" | "over";
}) {
  const percent = Math.min(ratio * 100, 100);
  const colorClass =
    status === "over"
      ? "bg-rose-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className={`h-full transition-all ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function BudgetForm({
  initial,
  yearMonth,
  availableCategories,
  onSubmit,
  onCancel,
}: {
  initial?: Budget;
  yearMonth: string;
  availableCategories: Category[];
  onSubmit: (input: BudgetInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? availableCategories[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("金額は正の数で入力してください。");
      setSubmitting(false);
      return;
    }
    if (!categoryId) {
      setError("カテゴリを選択してください。");
      setSubmitting(false);
      return;
    }
    try {
      await onSubmit({ yearMonth, categoryId, amount: n });
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
      <h2 className="text-base font-semibold">{initial ? "予算を編集" : "予算を追加"}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="budget-category" className="block text-sm font-medium">
            カテゴリ
          </label>
          <select
            id="budget-category"
            required
            disabled={!!initial || availableCategories.length === 0}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {availableCategories.length === 0 ? (
              <option value="">利用可能なカテゴリがありません</option>
            ) : (
              availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="budget-amount" className="block text-sm font-medium">
            月次予算 (円)
          </label>
          <input
            id="budget-amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例: 50000"
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
