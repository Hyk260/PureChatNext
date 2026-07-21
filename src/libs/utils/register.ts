import debug from 'debug';

import { accountCheck, accountImport } from '@/app/api/rest-api/handlers';

import { type AccountImportParams } from '@/app/api/rest-api/types';

const log = debug('auth:im');

export type IMAccountStatus = 'already_registered' | 'registered';

export interface RegisterAccountParams {
  id: string;
  nick?: string;
  avatar?: string;
}

export interface RegisterAccountResult {
  status: IMAccountStatus;
}

/** 查询 IM 账号是否已导入 */
export async function isIMAccountRegistered(userId: string): Promise<boolean> {
  const result = await accountCheck([{ UserID: userId }]);
  return result?.ResultItem?.[0]?.AccountStatus === 'Imported';
}

/** 导入 IM 账号 */
export async function importIMAccount(params: AccountImportParams): Promise<void> {
  const result = await accountImport(params);

  if (result.ErrorCode !== 0) {
    throw new Error(`Import account ${params.UserID} failed, ErrorCode: ${result.ErrorCode}`);
  }
}

/**
 * 确保 IM 账号可用：已注册则跳过，未注册则导入。
 * 仅当返回成功时，调用方才可签发 userSig。
 */
export async function registerAccount(
  params: RegisterAccountParams,
): Promise<RegisterAccountResult> {
  const { id, nick = '', avatar = '' } = params;

  if (!id) {
    throw new Error('User ID is required');
  }

  const registered = await isIMAccountRegistered(id);
  log('account check %s: registered=%s', id, registered);

  if (registered) {
    return { status: 'already_registered' };
  }

  await importIMAccount({ UserID: id, Nick: nick, FaceUrl: avatar });
  log('account imported: %s', id);

  return { status: 'registered' };
}
