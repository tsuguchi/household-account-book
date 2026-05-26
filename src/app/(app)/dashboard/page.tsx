"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeBudgetsByMonth } from "@/lib/budgets";
import { subscribeCategories } from "@/lib/categories";
import { subscribeTransactionsByMonth } from "@/lib/transactions";
import {
  breakdownByCategory,
  budgetConsumption,
  summarize,
  type BudgetConsumptionItem,
  type CategoryBreakdownItem,
} from "@/lib/aggregations";
import { toYearMonth, type Budget } from "@/types/budget";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

const today = new Date();

export default function DashboardPage() {
  const { user, configured } = useAuth();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !configured) return;
    const unsub = subscribeCategories(user.uid, setCategories);
    return unsub;
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeBudgetsByMonth(user.uid, toYearMonth(year, month), setBudgets);
  }, [user, configured, year, month]);

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTransactionsByMonth(user.uid, year, month, (list) => {
      setTransactions(list);
      setLoading(false);
    });
    return unsub;
  }, [user, configured, year, month]);

  const summary = useMemo(() => summarize(transactions), [transactions]);
  const expenseByCategory = useMemo(
    () => breakdownByCategory(transactions, categories, "expense"),
    [transactions, categories],
  );
  const incomeByCategory = useMemo(
    () => breakdownByCategory(transactions, categories, "income"),
    [transactions, categories],
  );
  const consumption = useMemo(
    () => budgetConsumption(budgets, transactions, categories),
    [budgets, transactions, categories],
  );
  const overItems = consumption.filter((c) => c.status === "over");
  const warningItems = consumption.filter((c) => c.status === "warning");

  if (!configured) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <p className="text-sm text-zinc-500">
          {year}年 {String(month).padStart(2, "0")}月
        </p>
      </div>

      {overItems.length > 0 && (
        <BudgetAlertBanner tone="over" items={overItems} />
      )}
      {overItems.length === 0 && warningItems.length > 0 && (
        <BudgetAlertBanner tone="warning" items={warningItems} />
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="今月の収入" amount={summary.income} tone="income" />
        <SummaryCard label="今月の支出" amount={summary.expense} tone="expense" />
        <SummaryCard
          label="今月の差額"
          amount={summary.balance}
          tone={summary.balance >= 0 ? "income" : "expense"}
        />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">読み込み中…</p>
      ) : transactions.length === 0 ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          まだ今月の取引がありません。
          <Link href="/transactions" className="ml-1 underline">
            取引を追加
          </Link>
          すると、ここにカテゴリ別グラフが表示されます。
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ChartCard title="カテゴリ別 支出">
            {expenseByCategory.length === 0 ? (
              <EmptyChart message="支出データはありません。" />
            ) : (
              <CategoryPie items={expenseByCategory} />
            )}
          </ChartCard>
          <ChartCard title="カテゴリ別 ランキング (支出)">
            {expenseByCategory.length === 0 ? (
              <EmptyChart message="支出データはありません。" />
            ) : (
              <CategoryBar items={expenseByCategory.slice(0, 8)} />
            )}
          </ChartCard>
          {incomeByCategory.length > 0 && (
            <ChartCard title="カテゴリ別 収入">
              <CategoryBar items={incomeByCategory.slice(0, 8)} />
            </ChartCard>
          )}
        </div>
      )}

      {consumption.length > 0 && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">予算消化率</h2>
            <Link
              href="/budgets"
              className="text-xs text-zinc-500 underline-offset-2 hover:underline"
            >
              予算を編集
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {consumption.map((item) => (
              <BudgetRow key={item.budgetId} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BudgetAlertBanner({
  tone,
  items,
}: {
  tone: "over" | "warning";
  items: BudgetConsumptionItem[];
}) {
  const containerClass =
    tone === "over"
      ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
  const headline =
    tone === "over"
      ? `予算超過: ${items.length}件`
      : `予算 80% 到達: ${items.length}件`;
  return (
    <div className={`mt-4 rounded-lg border p-4 text-sm ${containerClass}`} role="alert">
      <p className="font-semibold">{headline}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {items.map((item) => (
          <li key={item.budgetId}>
            {item.categoryName} — ¥{item.spent.toLocaleString("ja-JP")} / ¥
            {item.budget.toLocaleString("ja-JP")} ({Math.round(item.ratio * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

function BudgetRow({ item }: { item: BudgetConsumptionItem }) {
  const percent = Math.min(item.ratio * 100, 100);
  const barColor =
    item.status === "over"
      ? "bg-rose-500"
      : item.status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const ratioColor =
    item.status === "over"
      ? "text-rose-600 dark:text-rose-400"
      : item.status === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-500";
  return (
    <li>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="truncate">{item.categoryName}</span>
        </div>
        <span className={`shrink-0 ${ratioColor}`}>
          ¥{item.spent.toLocaleString("ja-JP")} /{" "}
          <span className="text-zinc-500">¥{item.budget.toLocaleString("ja-JP")}</span>{" "}
          <span className="ml-1 font-medium">{Math.round(item.ratio * 100)}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}

function SummaryCard({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "income" | "expense";
}) {
  const colorClass =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${colorClass}`}>
        ¥ {amount.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-500">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function CategoryPie({ items }: { items: CategoryBreakdownItem[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            dataKey="total"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {items.map((item) => (
              <Cell key={item.categoryId} fill={item.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatYen(Number(value))}
            wrapperStyle={{ outline: "none" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryBar({ items }: { items: CategoryBreakdownItem[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ left: 12, right: 12 }}>
          <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={10} />
          <YAxis dataKey="name" type="category" width={70} fontSize={11} />
          <Tooltip
            formatter={(value) => formatYen(Number(value))}
            wrapperStyle={{ outline: "none" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(228, 228, 231, 0.4)" }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {items.map((item) => (
              <Cell key={item.categoryId} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
