import { http } from '@/libs/utils/rest-api'
import { generateRandomInt32 } from '@/libs/utils/buildURL'

import type {
  AccountCheckItem,
  AccountCheckResult,
  AccountImportParams,
  AddGroupMemberParams,
  ImportResult,
  SendMsgParams,
} from './types'

/**
 * 查询账号
 * https://cloud.tencent.com/document/product/269/38417
 */
export const accountCheck = async (params: AccountCheckItem[]) => {
  return http.request<AccountCheckResult>({
    url: 'v4/im_open_login_svc/account_check',
    data: { CheckItem: params },
  })
  // .ResultItem?.[0]?.AccountStatus === 'Imported';
}

/**
 * 导入账号
 * https://cloud.tencent.com/document/product/269/1608
 */
export const accountImport = async (params: AccountImportParams) => {
  return http.request<ImportResult>({
    url: 'v4/im_open_login_svc/account_import',
    data: params,
  })
}

/**
 * 单发单聊消息
 * https://cloud.tencent.com/document/product/269/2282
 */
export const restSendMsg = async (params: SendMsgParams) => {
  const { From_Account, To_Account, Text, CloudCustomData = '' } = params
  return http.request({
    url: 'v4/openim/sendmsg',
    data: {
      SyncOtherMachine: 1,
      From_Account,
      To_Account,
      CloudCustomData,
      MsgRandom: generateRandomInt32(),
      ForbidCallbackControl: ['ForbidBeforeSendMsgCallback', 'ForbidAfterSendMsgCallback'],
      MsgBody: [
        {
          MsgType: 'TIMTextElem',
          MsgContent: { Text },
        },
      ],
    },
  })
}

/**
 * 增加群成员
 * https://cloud.tencent.com/document/product/269/1621
 */
export const addGroupMember = async (params: AddGroupMemberParams) => {
  const { GroupId, Member_Account } = params
  return http.request({
    url: 'v4/group_open_http_svc/add_group_member',
    data: {
      GroupId,
      MemberList: [{ Member_Account }],
    },
  })
}

export const API_METHODS = {
  accountCheck,
  accountImport,
  restSendMsg,
  addGroupMember,
} as const

export type { ApiMethodName } from './types'
