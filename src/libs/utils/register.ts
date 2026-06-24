import { accountImport, accountCheck } from "@/app/api/rest-api/handlers";

export  const registerAccount = async ({ id = '', nick = "", avatar = "" }) => {
  const account = await accountCheck([{ UserID: id }]);
  const isImported = account?.ResultItem?.[0]?.AccountStatus === 'Imported';
  // 注册im账号
  if (!isImported) {
    const result = await accountImport({ UserID: id, Nick: nick, FaceUrl: avatar });
    if (result.ErrorCode !== 0) {
      throw new Error(`Import account ${id} failed, ErrorCode: ${result.ErrorCode}`);
    }
  }
}
