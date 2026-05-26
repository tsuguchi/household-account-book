"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeAccounts } from "@/lib/accounts";
import { subscribeCategories } from "@/lib/categories";
import {
  createRecurring,
  deleteRecurring,
  processRecurringDue,
  subscribeRecurring,
  updateRecurring,
} from "@/lib/recurring";
import { ACCOUNT_TYPE_LABELS, type Account } from "@/types/account";
import type { Category } from "@/types/category";
import {
  TRANSACTION_KINDS,
  TRANSACTION_KIND_LABELS,
  type TransactionKind,
} from "@/types/transaction";
import type { RecurringInput, RecurringTemplate } from "@/types/recurring";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; template: RecurringTemplate };

export default function RecurringPage() {
  const { user, configured } = useAuth();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeAccounts(user.uid, setAccounts);
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeCategories(user.uid, setCategories);
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    return subscribeRecurring(
      user.uid,
      (list) => {
        setTemplates(list);
        setLoading(false);
        setLoadError(null);
      },
      (e) => {
        setLoadError(e.message);
        setLoading(false);
      },
    );
  }, [user, configured]);

  const canAdd = accounts.length > 0 && categories.length > 0;

  if (!configured) {
    return (
      <NoticeBox>
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </NoticeBox>
    );
  }

  async function handleRunNow() {
    if (!user) return;
    setProcessing(true);
    setProcessResult(null);
    try {
      const r = await processRecurringDue(user.uid);
      setProcessResult(
        r.generated === 0
          ? "計上すべき定期取引はありませんでした。"
          : `${r.generated} 件の定期取引を生成しました。`,
      );
    } catch (err) {
      setProcessResult(
        err instanceof Error ? `エラー: ${err.message}` : "実行に失敗しました。",
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">定期取引</h1>
        {form.mode === "closed" && (
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => setForm({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + 定期取引を追加
          </button>
        )}
      </div>

      {!canAdd && (
        <NoticeBox>
          定期取引を作るには、口座とカテゴリを先に登録してください（
          <Link href="/accounts" className="underline">
            口座
          </Link>
          {" / "}
          <Link href="/categories" className="underline">
            カテゴリ
          </Link>
          ）。
        </NoticeBox>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-500">
          アプリ起動時に未計上分は自動生成されます。手動で再実行することもできます。
        </p>
        <button
          type="button"
          onClick={handleRunNow}
          disabled={processing}
          className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {processing ? "実行中…" : "今すぐ生成"}
        </button>
      </div>
      {processResult && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{processResult}</p>
      )}

      {form.mode !== "closed" && user && canAdd && (
        <RecurringForm
          key={form.mode === "edit" ? form.template.id : "new"}
          initial={form.mode === "edit" ? form.template : undefined}
          accounts={accounts}
          categories={categories}
          onCancel={() => setForm({ mode: "closed" })}
          onSubmit={async (input) => {
            if (form.mode === "edit") {
              await updateRecurring(user.uid, form.template.id, input, form.template);
            } else {
              await createRecurring(user.uid, input);
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
        ) : templates.length === 0 ? (
          <NoticeBox>
            まだ定期取引のテンプレートがありません。家賃やサブスク等を登録しておくと、毎月自動で記録されます。
          </NoticeBox>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {templates.map((t) => (
              <RecurringRow
                key={t.id}
                template={t}
                accounts={accounts}
                categories={categories}
                onToggleActive={async () => {
                  if (!user) return;
                  await updateRecurring(
                    user.uid,
                    t.id,
                    {
                      name: t.name,
                      kind: t.kind,
                      amount: t.amount,
                      categoryId: t.categoryId,
                      accountId: t.accountId,
                      dayOfMonth: t.dayOfMonth,
                      active: !t.active,
                    },
                    t,
                  );
                }}
                onEdit={() => setForm({ mode: "edit", template: t })}
                onDelete={async () => {
                  if (!user) return;
                  const ok = window.confirm(
                    `「${t.name}」を削除します。これまで生成された取引は残ります。よろしいですか？`,
                  );
                  if (!ok) return;
                  await deleteRecurring(user.uid, t.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecurringRow({
  template,
  accounts,
  categories,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  template: RecurringTemplate;
  accounts: Account[];
  categories: Category[];
  onToggleActive: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const account = accounts.find((a) => a.id === template.accountId);
  const category = categories.find((c) => c.id === template.categoryId);
  const sign = template.kind === "income" ? "+" : "-";
  const colorClass =
    template.kind === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  const nextDate = template.nextRunDate.toDate();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: category?.color ?? "#9ca3af" }}
          />
          <p className="truncate text-base font-medium">{template.name}</p>
          {!template.active && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              停止中
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">
          毎月 {template.dayOfMonth} 日 ・ {category?.name ?? "（不明）"} ・{" "}
          {account?.name ?? "（不明）"}（{account ? ACCOUNT_TYPE_LABELS[account.type] : "—"}） ・ 次回{" "}
          {nextDate.getFullYear()}/{nextDate.getMonth() + 1}/{nextDate.getDate()}
        </p>
      </div>
      <div className={`shrink-0 text-base font-semibold ${colorClass}`}>
        {sign}¥ {template.amount.toLocaleString("ja-JP")}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleActive}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {template.active ? "停止" : "再開"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          削除
        </button>
      </div>
    </li>
  );
}

function RecurringForm({
  initial,
  accounts,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: RecurringTemplate;
  accounts: Account[];
  categories: Category[];
  onSubmit: (input: RecurringInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? filteredCategories[0]?.id ?? "",
  );
  const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? 1));
  const [active, setActive] = useState(initial?.active ?? true);
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
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("金額は正の数で入力してください。");
      setSubmitting(false);
      return;
    }
    const dom = Number(dayOfMonth);
    if (!Number.isInteger(dom) || dom < 1 || dom > 31) {
      setError("計上日は 1〜31 で入力してください。");
      setSubmitting(false);
      return;
    }
    if (!accountId || !categoryId) {
      setError("口座とカテゴリを選択してください。");
      setSubmitting(false);
      return;
    }
    try {
      await onSubmit({
        name: name.trim(),
        kind,
        amount: amt,
        accountId,
        categoryId,
        dayOfMonth: dom,
        active,
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
        {initial ? "定期取引を編集" : "定期取引を追加"}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="rec-name" className="block text-sm font-medium">
            名前
          </label>
          <input
            id="rec-name"
            type="text"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 家賃 / Netflix"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

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
                  name="rec-kind"
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
          <label htmlFor="rec-amount" className="block text-sm font-medium">
            金額 (円)
          </label>
          <input
            id="rec-amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label htmlFor="rec-day" className="block text-sm font-medium">
            毎月の計上日 (1〜31)
          </label>
          <input
            id="rec-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            step={1}
            required
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">
            指定日が存在しない月（例: 2/30）は月末に丸めて計上します。
          </p>
        </div>

        <div>
          <label htmlFor="rec-category" className="block text-sm font-medium">
            カテゴリ
          </label>
          <select
            id="rec-category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={filteredCategories.length === 0}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {filteredCategories.length === 0 ? (
              <option value="">{TRANSACTION_KIND_LABELS[kind]}カテゴリがありません</option>
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
          <label htmlFor="rec-account" className="block text-sm font-medium">
            口座
          </label>
          <select
            id="rec-account"
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
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm">有効にする（オフにすると次回以降の計上を停止）</span>
          </label>
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
