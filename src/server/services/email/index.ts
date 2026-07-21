import { emailEnv } from '@/envs/email';

import { type EmailPayload, type EmailResponse, type EmailServiceImpl, createEmailServiceImpl, EmailImplType } from './impls';

/**
 * 邮件服务类
 * 支持多种邮件提供商的发送能力
 */
export class EmailService {
  private emailImpl: EmailServiceImpl;

  constructor(implType?: EmailImplType) {
    const envImplType = typeof window === 'undefined' ? (emailEnv.EMAIL_SERVICE_PROVIDER) : undefined;
    const resolvedImplType = implType ?? envImplType ?? EmailImplType.Nodemailer;

    this.emailImpl = createEmailServiceImpl(resolvedImplType as EmailImplType);
  }

  /**
   * 发送邮件
   */
  async sendMail(payload: EmailPayload): Promise<EmailResponse> {
    return this.emailImpl.sendMail(payload);
  }

  /**
   * 校验邮件服务配置是否可用
   * 注意：目前仅 Nodemailer 实现支持此方法
   */
  async verify(): Promise<boolean> {
    // 检查当前实现是否提供 verify 方法
    if ('verify' in this.emailImpl && typeof this.emailImpl.verify === 'function') {
      return this.emailImpl.verify();
    }

    // 未提供 verify 的实现默认视为配置有效
    return true;
  }
}

export type { EmailPayload, EmailResponse } from './impls';
export { EmailImplType } from './impls';
