import { NextResponse } from "next/server";
import type { ErrorResponse, Todo } from "@/app/api/todos/route";

// app/api/todos 配下の Route Handler で共通に使う処理

export const TITLE_MAX_LENGTH = 200;

export const todoSelect = {
  id: true,
  title: true,
  isCompleted: true,
  createdAt: true,
} as const;

export function toTodo(row: {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
}): Todo {
  return { ...row, createdAt: row.createdAt.toISOString() };
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
