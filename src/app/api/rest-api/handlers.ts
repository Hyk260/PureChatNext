import { http } from '@/libs/utils/rest-api';
import { generateRandomInt32 } from '@/libs/utils/buildURL';

interface CheckItem {
  UserID: string;
}

interface AccountImportParams {
  UserID: string;
  Nick?: string;
  FaceUrl?: string;
}

interface SendMsgParams {
  From_Account: string;
  To_Account: string;
  Text: string;
  CloudCustomData?: string;
}

interface AddGroupMemberParams {
  groupId: string;
  member: string;
}

interface CheckResult {
  ResultItem?: Array<{ AccountStatus: string }>;
}

interface ImportResult {
  ErrorCode: number;
}

/**
 * 查询账号
 * https://cloud.tencent.com/document/product/269/38417
 */
export const accountCheck = async (params: CheckItem[]) => {
  const result = await http.request<CheckResult>({
    url: 'v4/im_open_login_svc/account_check',
    data: { CheckItem: params },
  });
  return result
  // .ResultItem?.[0]?.AccountStatus === 'Imported';
};

/**
 * 导入账号
 * https://cloud.tencent.com/document/product/269/1608
 */
export const accountImport = async (params: AccountImportParams) => {
  const { UserID, Nick, FaceUrl } = params;
  const result = await http.request<ImportResult>({
    url: 'v4/im_open_login_svc/account_import',
    data: { UserID, Nick, FaceUrl },
  });
  return result
};

/**
 * 单发单聊消息
 * https://cloud.tencent.com/document/product/269/2282
 */
export const restSendMsg = async (params: SendMsgParams) => {
  const { From_Account, To_Account, Text, CloudCustomData = '' } = params;
  const result = await http.request({
    url: 'v4/openim/sendmsg',
    data: {
      SyncOtherMachine: 1, 
      From_Account,
      To_Account,
      CloudCustomData: CloudCustomData,
      MsgRandom: generateRandomInt32(),
      ForbidCallbackControl: ['ForbidBeforeSendMsgCallback', 'ForbidAfterSendMsgCallback'],
      MsgBody: [{
        MsgType: 'TIMTextElem',
        MsgContent: { Text },
      }],
    },
  });
  return result;
};

/**
 * 增加群成员
 * https://cloud.tencent.com/document/product/269/1621
 */
export const addGroupMember = async (params: AddGroupMemberParams) => {
  const { groupId, member } = params;
  const result = await http.request({
    url: 'v4/group_open_http_svc/add_group_member',
    data: {
      GroupId: groupId,
      MemberList: [{ Member_Account: member }],
    },
  });
  return result;
};

export const API_METHODS = {
  accountCheck,
  accountImport,
  restSendMsg,
  addGroupMember,
} as const;

export type ApiMethodName = keyof typeof API_METHODS;
