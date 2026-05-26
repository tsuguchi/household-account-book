import type { Timestamp } from "firebase/firestore";

export const CATEGORY_KINDS = ["expense", "income"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  expense: "支出",
  income: "収入",
};

export type Category = {
  id: string;
  name: string;
  color: string;
  kind: CategoryKind;
  isDefault: boolean;
  createdAt: Timestamp | null;
};

export type CategoryInput = {
  name: string;
  color: string;
  kind: CategoryKind;
};

export const DEFAULT_CATEGORIES: ReadonlyArray<CategoryInput & { kind: CategoryKind }> = [
  { name: "食費", color: "#ef4444", kind: "expense" },
  { name: "住居費", color: "#f97316", kind: "expense" },
  { name: "光熱費", color: "#eab308", kind: "expense" },
  { name: "交通費", color: "#22c55e", kind: "expense" },
  { name: "通信費", color: "#14b8a6", kind: "expense" },
  { name: "衣服", color: "#06b6d4", kind: "expense" },
  { name: "娯楽", color: "#3b82f6", kind: "expense" },
  { name: "医療", color: "#8b5cf6", kind: "expense" },
  { name: "教育", color: "#ec4899", kind: "expense" },
  { name: "その他支出", color: "#71717a", kind: "expense" },
  { name: "給与", color: "#16a34a", kind: "income" },
  { name: "副収入", color: "#0891b2", kind: "income" },
  { name: "その他収入", color: "#6b7280", kind: "income" },
];
