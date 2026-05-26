"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCategory,
  deleteCategory,
  seedDefaultCategories,
  subscribeCategories,
  updateCategory,
} from "@/lib/categories";
import {
  CATEGORY_KINDS,
  CATEGORY_KIND_LABELS,
  type Category,
  type CategoryInput,
  type CategoryKind,
} from "@/types/category";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; category: Category };

export default function CategoriesPage() {
  const { user, configured } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeCategories(
      user.uid,
      (list) => {
        setCategories(list);
        setLoading(false);
        setLoadError(null);
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, configured]);

  const groups = useMemo(() => {
    return {
      expense: categories.filter((c) => c.kind === "expense"),
      income: categories.filter((c) => c.kind === "income"),
    };
  }, [categories]);

  if (!configured) {
    return (
      <NoticeBox>
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </NoticeBox>
    );
  }

  async function handleSeed() {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDefaultCategories(user.uid);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "デフォルトカテゴリの追加に失敗しました。");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">カテゴリ</h1>
        {form.mode === "closed" && (
          <button
            type="button"
            onClick={() => setForm({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + カテゴリを追加
          </button>
        )}
      </div>

      {form.mode !== "closed" && user && (
        <CategoryForm
          key={form.mode === "edit" ? form.category.id : "new"}
          initial={form.mode === "edit" ? form.category : undefined}
          onCancel={() => setForm({ mode: "closed" })}
          onSubmit={async (input) => {
            if (form.mode === "edit") {
              await updateCategory(user.uid, form.category.id, input);
            } else {
              await createCategory(user.uid, input);
            }
            setForm({ mode: "closed" });
          }}
        />
      )}

      <div className="mt-6 space-y-6">
        {loading ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : loadError ? (
          <NoticeBox tone="error">読み込みに失敗しました: {loadError}</NoticeBox>
        ) : categories.length === 0 ? (
          <NoticeBox>
            <div className="space-y-3">
              <p>
                まだカテゴリが登録されていません。よく使うカテゴリ（食費・交通費・給与など）を一括で追加できます。
              </p>
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {seeding ? "追加中…" : "デフォルトカテゴリを追加"}
              </button>
            </div>
          </NoticeBox>
        ) : (
          CATEGORY_KINDS.map((kind) => (
            <section key={kind}>
              <h2 className="mb-2 text-sm font-medium text-zinc-500">
                {CATEGORY_KIND_LABELS[kind]}（{groups[kind].length}件）
              </h2>
              {groups[kind].length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700">
                  {CATEGORY_KIND_LABELS[kind]}カテゴリはまだありません。
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {groups[kind].map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      onEdit={() => setForm({ mode: "edit", category })}
                      onDelete={async () => {
                        if (!user) return;
                        const ok = window.confirm(
                          `「${category.name}」を削除します。よろしいですか？`,
                        );
                        if (!ok) return;
                        await deleteCategory(user.uid, category.id);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <p className="truncate text-base">{category.name}</p>
        {category.isDefault && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            既定
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          削除
        </button>
      </div>
    </li>
  );
}

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Category;
  onSubmit: (input: CategoryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? "expense");
  const [color, setColor] = useState(initial?.color ?? "#3b82f6");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), kind, color });
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
        {initial ? "カテゴリを編集" : "カテゴリを追加"}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="category-name" className="block text-sm font-medium">
            カテゴリ名
          </label>
          <input
            id="category-name"
            type="text"
            required
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 食費"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label htmlFor="category-kind" className="block text-sm font-medium">
            収支区分
          </label>
          <select
            id="category-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as CategoryKind)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CATEGORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category-color" className="block text-sm font-medium">
            色
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              id="category-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            />
            <code className="text-sm text-zinc-500">{color}</code>
          </div>
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
    <div className={`rounded-lg border p-4 text-sm ${toneClass}`}>{children}</div>
  );
}
