import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "@/database/queries";
import { corsMiddleware } from "@/lib/utils/cors";

/**
 * 获取所有用户
 * GET /api/test/users
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // 如果提供了 ID，获取单个用户
    if (id) {
      const user = await getUserById(id);
      if (!user) {
        const response = NextResponse.json(
          { error: "用户不存在" },
          { status: 404 }
        );
        return corsMiddleware(request, response);
      }
      const response = NextResponse.json({ data: user }, { status: 200 });
      return corsMiddleware(request, response);
    }

    // 否则获取所有用户
    const users = await getAllUsers();
    const response = NextResponse.json({ data: users }, { status: 200 });
    return corsMiddleware(request, response);
  } catch (error) {
    console.error("Error in GET /api/test/users:", error);
    const response = NextResponse.json(
      { error: "获取用户失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
    return corsMiddleware(request, response);
  }
}

/**
 * 创建用户
 * POST /api/test/users
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证输入
    if (!email || !password) {
      const response = NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response = NextResponse.json(
        { error: "邮箱格式不正确" },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    const user = await createUser(email, password);
    const response = NextResponse.json(
      { message: "用户创建成功", data: user },
      { status: 201 }
    );
    return corsMiddleware(request, response);
  } catch (error) {
    console.error("Error in POST /api/test/users:", error);
    const response = NextResponse.json(
      { error: "创建用户失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
    return corsMiddleware(request, response);
  }
}

/**
 * 更新用户
 * PUT /api/test/users
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, password } = body;

    if (!id) {
      const response = NextResponse.json(
        { error: "用户 ID 不能为空" },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    // 验证邮箱格式（如果提供了邮箱）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const response = NextResponse.json(
          { error: "邮箱格式不正确" },
          { status: 400 }
        );
        return corsMiddleware(request, response);
      }
    }

    const updateData: { email?: string; password?: string } = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    const user = await updateUser(id, updateData);
    if (!user) {
      const response = NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
      return corsMiddleware(request, response);
    }

    const response = NextResponse.json(
      { message: "用户更新成功", data: user },
      { status: 200 }
    );
    return corsMiddleware(request, response);
  } catch (error) {
    console.error("Error in PUT /api/test/users:", error);
    const response = NextResponse.json(
      { error: "更新用户失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
    return corsMiddleware(request, response);
  }
}

/**
 * 删除用户
 * DELETE /api/test/users
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      const response = NextResponse.json(
        { error: "用户 ID 不能为空" },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    const success = await deleteUser(id);
    if (!success) {
      const response = NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
      return corsMiddleware(request, response);
    }

    const response = NextResponse.json(
      { message: "用户删除成功" },
      { status: 200 }
    );
    return corsMiddleware(request, response);
  } catch (error) {
    console.error("Error in DELETE /api/test/users:", error);
    const response = NextResponse.json(
      { error: "删除用户失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
    return corsMiddleware(request, response);
  }
}

/**
 * 处理 OPTIONS 预检请求
 */
export async function OPTIONS(request: NextRequest) {
  return corsMiddleware(request);
}

