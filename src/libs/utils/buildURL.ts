import { generateUserSig } from "./signature";
import { imEnv } from "@/envs/im";

const { IM_SDK_APPID: appId, IM_ADMIN_ISTRATOR: administrator } = imEnv;

let cachedSig: string = "";
let cacheExpiration: number | null = null;

interface Params {
  sdkappid: string;
  identifier: string;
  usersig: string;
  random: number | string;
  contenttype: string;
}

export function generateRandomInt32() {
  return Math.floor(Math.random() * 0x100000000);
}

export function getUserSig() {
  const now = Date.now();
  if (cachedSig && cacheExpiration && cacheExpiration > now) {
    return cachedSig;
  }
  cachedSig = generateUserSig({ identifier: administrator });
  cacheExpiration = now + 60 * 60 * 1000;
  return cachedSig;
}

export function buildURL(baseURL: string) {
  if (!appId || !administrator) {
    throw new Error("appId or administrator is not defined");
  }

  const params: Params = {
    sdkappid: appId,
    identifier: administrator,
    usersig: getUserSig(),
    random: generateRandomInt32(),
    contenttype: "json",
  };
  const enCode = (t: string | number) => encodeURIComponent(t);
  const query = Object.keys(params)
    .map((key) => {
      return `${enCode(key)}=${enCode(params[key as keyof Params])}`;
    })
    .join("&");
  return `${baseURL}?${query}`;
}
