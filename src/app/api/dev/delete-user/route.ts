import { NextResponse } from 'next/server';

import { UserModel } from '@/database/models/user';

type DeleteUserAction = 'lookup' | 'delete';

const availableActions: DeleteUserAction[] = ['lookup', 'delete'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseEmail = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const email = value.trim();

  if (!email || !email.includes('@')) {
    return undefined;
  }

  return email;
};

const badRequest = (error: string) => {
  return NextResponse.json({ error, success: false }, { status: 400 });
};

const success = (action: DeleteUserAction, result: unknown) => {
  return NextResponse.json({ action, result, success: true }, { status: 200 });
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Internal server error';
};

/**
 * 用户删除测试 API（仅开发环境）
 * POST /api/dev/delete-user
 */
export const POST = async (req: Request) => {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!isRecord(body)) {
    return badRequest('Request body must be an object');
  }

  const rawAction = body.action;

  if (typeof rawAction !== 'string' || !availableActions.includes(rawAction as DeleteUserAction)) {
    return badRequest(`Invalid action. Available actions: ${availableActions.join(', ')}`);
  }

  const action = rawAction as DeleteUserAction;
  const email = parseEmail(body.email);

  if (!email) {
    return badRequest('Missing or invalid "email" field');
  }

  try {
    if (action === 'lookup') {
      const result = await UserModel.getUserDeletionPreview(email);

      return success(action, result);
    }

    const confirmEmail = parseEmail(body.confirmEmail);

    if (!confirmEmail) {
      return badRequest('Missing or invalid "confirmEmail" field');
    }

    if (confirmEmail !== email) {
      return badRequest('confirmEmail must match email');
    }

    const result = await UserModel.deleteUserByEmail(email);

    return success(action, result);
  } catch (error) {
    const message = getErrorMessage(error);

    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
};

/**
 * 用户删除测试 API（仅开发环境）
 * GET /api/dev/delete-user
 */
export const GET = async () => {
  return NextResponse.json(
    {
      actions: availableActions,
      message: 'Delete user API',
    },
    { status: 200 },
  );
};
