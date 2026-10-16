import { NextResponse } from "next/server";
import type { ErrorResponse, Todo } from "@/app/api/todos/route";
import type { Prisma } from "@/app/generated/prisma/client";

// app/api/todos 配下の Route Handler で共通に使う処理

export const TITLE_MAX_LENGTH = 200;

export const todoSelect = {
  id: true,
  title: true,
  isCompleted: true,
  dueDate: true,
  createdAt: true,
} as const;

// 期限の近い順。期限なしは最後、同じ期限なら新しい順
export const todoOrderBy: Prisma.TodoOrderByWithRelationInput[] = [
  { dueDate: { sort: "asc", nulls: "last" } },
  { createdAt: "desc" },
];

export function toTodo(row: {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: Date | null;
  createdAt: Date;
}): Todo {
  return {
    ...row,
    // @db.Date は UTC の 0 時として返るので、日付部分だけを取り出す
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ error: message }, { status });
}

// 不正なタイトルならエラーメッセージを、正しければ null を返す
export function validateTitle(title: string): string | null {
  if (!title) {
    return "タイトルを入力してください";
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return `タイトルは${TITLE_MAX_LENGTH}文字以内で入力してください`;
  }
  return null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// リクエストの dueDate を解釈する。
// undefined: 指定なし（変更しない） / null: 期限なし / "YYYY-MM-DD": その日付
export function parseDueDate(
  value: unknown,
): { ok: true; value: Date | null | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, value };
  }
  if (typeof value === "string" && DATE_PATTERN.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    // 2026-02-30 のような存在しない日付は、変換後に別の日付になるので弾く
    if (!Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)) {
      return { ok: true, value: date };
    }
  }
  return { ok: false, error: "期限日は YYYY-MM-DD 形式で指定してください" };
}
