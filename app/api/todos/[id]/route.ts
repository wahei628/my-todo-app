import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, todoSelect, toTodo } from "@/lib/todos";
import type { Todo } from "../route";

// ---- API の型（画面側は import type で使う） ----

export type UpdateTodoRequest = {
  isCompleted: boolean;
};

export type UpdateTodoResponse = {
  todo: Todo;
};

export type DeleteTodoResponse = {
  id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- PATCH /api/todos/:id : 完了状態を切り替え ----

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/todos/[id]">,
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return errorResponse("ログインが必要です", 401);
  }

  const { id } = await ctx.params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse("TODO が見つかりません", 404);
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<UpdateTodoRequest>
    | null;
  if (typeof body?.isCompleted !== "boolean") {
    return errorResponse("isCompleted は true か false で指定してください", 400);
  }

  // 他人の TODO を更新しないよう、id と user_id の両方で絞り込む
  const { count } = await prisma.todo.updateMany({
    where: { id, userId },
    data: { isCompleted: body.isCompleted },
  });
  if (count === 0) {
    return errorResponse("TODO が見つかりません", 404);
  }

  const row = await prisma.todo.findFirstOrThrow({
    where: { id, userId },
    select: todoSelect,
  });

  return NextResponse.json<UpdateTodoResponse>({ todo: toTodo(row) });
}

// ---- DELETE /api/todos/:id : TODO を削除 ----

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/todos/[id]">,
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return errorResponse("ログインが必要です", 401);
  }

  const { id } = await ctx.params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse("TODO が見つかりません", 404);
  }

  // 他人の TODO を削除しないよう、id と user_id の両方で絞り込む
  const { count } = await prisma.todo.deleteMany({
    where: { id, userId },
  });
  if (count === 0) {
    return errorResponse("TODO が見つかりません", 404);
  }

  return NextResponse.json<DeleteTodoResponse>({ id });
}
