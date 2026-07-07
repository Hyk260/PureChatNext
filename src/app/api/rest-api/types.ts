/** 账号查询单项 */
export interface AccountCheckItem {
  UserID: string;
}

/** 账号导入参数 */
export interface AccountImportParams {
  UserID: string;
  Nick?: string;
  FaceUrl?: string;
}

/** 单发单聊消息参数 */
export interface SendMsgParams {
  From_Account: string;
  To_Account: string;
  Text: string;
  CloudCustomData?: string;
}

/** 增加群成员参数 */
export interface AddGroupMemberParams {
  GroupId: string;
  Member_Account: string;
}

/** 账号查询结果 */
export interface AccountCheckResult {
  ResultItem?: Array<{ AccountStatus: string }>;
}

/** 账号导入结果 */
export interface ImportResult {
  ErrorCode: number;
}

export type ApiMethodName = 'accountCheck' | 'accountImport' | 'restSendMsg' | 'addGroupMember';
