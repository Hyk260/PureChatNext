import { accountImport, accountCheck } from "@/app/api/rest-api/handlers";

export  const registerAccount = async ({ id = '', nick = "", avatar = "" }) => {
  // 查询im账号
  const account = await accountCheck([{ UserID: id }]);
  // 注册im账号
  if (!account) {
    await accountImport({ UserID: id, Nick: nick, FaceUrl: avatar });
  }
}
