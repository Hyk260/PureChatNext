/**
 * 集中管理的 Redis key 定义
 *
 * 所有 Redis key 应在此定义，便于统一管理与保持一致性。
 *
 * 结构：
 * - RedisKeyNamespace：所有可用前缀
 * - RedisKeys：按命名空间/作用域组织的 key 构建器
 */

/**
 * Redis key 命名空间前缀
 *
 * 每个前缀在 Redis 中形成独立的 key 空间。
 * 使用 `createRedisWithPrefix` 时，将其中之一作为 prefix 参数传入。
 */
export const RedisKeyNamespace = {
  /**
   * AI 生成相关 key（agent 欢迎语、占位符等）
   */
  AI_GENERATION: 'aiGeneration',
  /**
   * 微信 iLink 渠道（context_token 等）
   */
  WECHAT: 'wechat',
} as const

/**
 * 按命名空间/作用域组织的 Redis key 构建器
 *
 * 用法：
 * ```ts
 * // 得到逻辑 key：agent_welcome:{agentId}
 * const key = RedisKeys.aiGeneration.agentWelcome(agentId);
 *
 * // 配合 Redis 客户端使用（前缀由 createRedisWithPrefix 添加）
 * const redis = await createRedisWithPrefix(config, RedisKeyNamespace.AI_GENERATION);
 * await redis.get(key);
 * // 实际 Redis key：aiGeneration:agent_welcome:{agentId}
 * ```
 */
export const RedisKeys = {
  /**
   * AI 生成作用域 —— 用于欢迎语等 AI 生成内容
   */
  aiGeneration: {
    /**
     * Agent 欢迎语与开放问题
     * 完整 key：aiGeneration:agent_welcome:{agentId}
     */
    agentWelcome: (agentId: string): string => `agent_welcome:${agentId}`,
    /**
     * 首页展示的按用户配对的 { welcome, hint } 对象
     * 完整 key：aiGeneration:home_brief:{userId}
     */
    homeBrief: (userId: string): string => `home_brief:${userId}`,
  },
  /**
   * 微信 iLink 渠道
   */
  wechat: {
    /**
     * 回复所需的 context_token
     * 完整 key：wechat:ctx:{bindingId}:{fromUserId}
     */
    contextToken: (bindingId: string, fromUserId: string): string => `wechat:ctx:${bindingId}:${fromUserId}`,
  },
} as const
