import debug from 'debug';
import { type CreateEmailOptions, Resend } from 'resend';

import { emailEnv } from '@/envs/email';

import { type EmailPayload, type EmailResponse, type EmailServiceImpl } from '../type';

const log = debug('email:Resend');

/**
 * Resend implementation of the email service
 */
export class ResendImpl implements EmailServiceImpl {
  private client: Resend;

  constructor() {
    if (!emailEnv.RESEND_API_KEY) {
      throw new Error(
        'RESEND_API_KEY environment variable is required to use Resend email service. Please configure it in your .env file.',
      );
    }

    this.client = new Resend(emailEnv.RESEND_API_KEY);
    log('Initialized Resend client');
  }

  async sendMail(payload: EmailPayload): Promise<EmailResponse> {
    // Note: Use || to handle empty string from Dockerfile defaults
    const from = payload.from || emailEnv.RESEND_FROM;
    const html = payload.html;
    const text = payload.text;

    if (!from) {
      throw new Error('Missing sender address. Provide payload.from or RESEND_FROM environment variable.');
    }

    if (!html && !text) {
      throw new Error('Resend requires either html or text content in the email payload.');
    }

    const attachments = payload.attachments?.map((attachment) => {
      if (attachment.content instanceof Buffer) {
        return {
          ...attachment,
          content: attachment.content.toString('base64'),
        };
      }

      return attachment;
    });

    try {
      log('Sending email via Resend: %o', {
        from,
        subject: payload.subject,
        to: payload.to,
      });

      const emailOptions: CreateEmailOptions = html
        ? {
            attachments,
            from,
            html,
            replyTo: payload.replyTo,
            subject: payload.subject,
            text,
            to: payload.to,
          }
        : {
            attachments,
            from,
            replyTo: payload.replyTo,
            subject: payload.subject,
            text: text!,
            to: payload.to,
          };

      const { data, error } = await this.client.emails.send(emailOptions);

      if (error) {
        log.extend('error')('Failed to send email via Resend: %o', error);
        throw new Error(`Failed to send email via Resend: ${error.message}`, { cause: error });
      }

      if (!data?.id) {
        log.extend('error')('Resend sendMail returned no message id: %o', data);
        throw new Error('Failed to send email via Resend: missing message id');
      }

      return {
        messageId: data.id,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      log.extend('error')('Unexpected Resend sendMail error: %o', error);
      throw new Error(`Failed to send email via Resend: ${String(error)}`, { cause: error });
    }
  }
}
