import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, todoSelect, toTodo, validateTitle } from "@/lib/todos";

// ---- API の型（画面側は import type で使う） ----

export type Todo = {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string; // ISO 8601
};

export type ErrorResponse = {
  error: string;
};

export type GetTodosResponse = {
  todos: Todo[];
};

export type CreateTodoRequest = {
  title: string;
};

export type CreateTodoResponse = {
  todo: Todo;
};

// ---- GET /api/todos : 自分の TODO 一覧 ----

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return errorResponse("ログインが必要です", 401);
  }

  const rows = await prisma.todo.findMany({
    where: { userId },
    select: todoSelect,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json<GetTodosResponse>({ todos: rows.map(toTodo) });
}

// ---- POST /api/todos : TODO を追加 ----

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return errorResponse("ログインが必要です", 401);
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<CreateTodoRequest>
    | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  const invalid = validateTitle(title);
  if (invalid) {
    return errorResponse(invalid, 400);
  }

  const row = await prisma.todo.create({
    data: { userId, title },
    select: todoSelect,
  });

  return NextResponse.json<CreateTodoResponse>(
    { todo: toTodo(row) },
    { status: 201 },
  );
}
