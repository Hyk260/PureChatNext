import { http } from '@/libs/utils/rest-api';
import { generateRandomInt32 } from '@/libs/utils/buildURL';
import { pino } from '@/libs/logger';

interface CheckItem {
  UserID: string;
}

interface AccountImportParams {
  UserID: string;
  Nick?: string;
  FaceUrl?: string;
}

interface CheckResultItem {
  AccountStatus: string;
}

interface SendMsgParams {
  From_Account: string
  To_Account: string
  Text: string
  CloudCustomData?: string
}

/**
 * 用于查询自有账号是否已导入即时通信 IM，支持批量查询。
 * https://cloud.tencent.com/document/product/269/38417
 */
export const accountCheck = async (params: CheckItem[]): Promise<boolean> => {
  try {
    const result = await http.request<CheckResultItem[]>({
      url: "v4/im_open_login_svc/account_check",
      method: "post",
      data: { CheckItem: params },
    });
    return result?.ResultItem?.[0]?.AccountStatus === "Imported";
  } catch (error) {
    console.error('Account check failed:', error);
    return false;
  }
};

/**
 * 导入单个账号
 */
export const accountImport = async (params: AccountImportParams): Promise<boolean> => {
  try {
    const result = await http.request({
      url: "v4/im_open_login_svc/account_import",
      method: "post",
      data: { ...params },
    });
    return result.ErrorCode === 0;
  } catch (error) {
    console.error('Account import failed:', error);
    return false;
  }
};

/**
 * 单发单聊消息
 * https://cloud.tencent.com/document/product/269/2282
 */
export const restSendMsg = async (params: SendMsgParams) => {
  const { From_Account, To_Account, Text, CloudCustomData } = params;
  const result = await http.request({
    url: "v4/openim/sendmsg",
    method: "post",
    data: {
      SyncOtherMachine: 1, // 消息同步1 不同步 2
      From_Account,
      To_Account,
      // MsgSeq: "",
      CloudCustomData: CloudCustomData || "",
      MsgRandom: generateRandomInt32(),
      ForbidCallbackControl: [
        "ForbidBeforeSendMsgCallback",
        "ForbidAfterSendMsgCallback",
      ], // 禁止回调控制选项
      MsgBody: [
        {
          MsgType: "TIMTextElem",
          MsgContent: {
            Text,
          },
        },
      ],
    },
  });
  pino.info(`restSendMsg: ${result}`);
  return result;
};

/**
 * 拉人入群
 */
export const addGroupMember = async (params: any) => {
  const { groupId, member } = params;
  const result = await http.request({
    url: "v4/group_open_http_svc/add_group_member",
    method: "post",
    data: {
      GroupId: groupId,
      MemberList: [{ Member_Account: member }],
    },
  });
  pino.info(`addGroupMember: ${result}`);
  return result;
};

// API方法映射
export const API_METHODS = {
  accountCheck,
  accountImport,
  restSendMsg,
  addGroupMember
} as const;

export type ApiMethodName = keyof typeof API_METHODS;
