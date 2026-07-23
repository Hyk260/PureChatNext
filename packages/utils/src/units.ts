/** @pure/utils — time / size / currency unit constants. */

// --- Time ---

export const MS = 1

/** 1000 ms */
export const SECOND = 1000 * MS

/** 60 s */
export const MINUTE = 60 * SECOND

/** 3600 s */
export const HOUR = 60 * MINUTE

/** 86400 s */
export const DAY = 24 * HOUR

/** 30 days */
export const MONTH = 30 * DAY

/** 365 days */
export const YEAR = 365 * DAY

export const API_TEST_TIMEOUT = 10 * SECOND

// --- Size ---

/** 1024 bytes */
export const KiB = 1024

/** 1024 KiB */
export const MiB = 1024 * KiB

/** 1024 MiB */
export const GiB = 1024 * MiB

/** 1024 GiB */
export const TiB = 1024 * GiB

export const DOLLAR_PER_CREDIT = 0.003
export const DOLLAR_PER_RMB = 0.14
export const RMB_PER_CREDIT = DOLLAR_PER_RMB / DOLLAR_PER_CREDIT
