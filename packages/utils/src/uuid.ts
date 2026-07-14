import { customAlphabet } from "nanoid/non-secure"

export const alphabet = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

export const createNanoId = (size = 8) => customAlphabet(alphabet, size)

export const nanoid = createNanoId()

/** UUID v4 without hyphens (32 hex chars), for IM / legacy userId fields. */
export const generateCompactUuid = () => crypto.randomUUID().replace(/-/g, '')