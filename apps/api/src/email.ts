import { appendFile } from 'node:fs/promises';

export type EmailMessage = {
  to: string;
  template: 'VERIFY_EMAIL' | 'PASSWORD_RESET' | 'PASSWORD_CHANGED';
  token?: string;
};
export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}
export class TestEmailAdapter implements EmailAdapter {
  readonly messages: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}
export class DevelopmentEmailAdapter implements EmailAdapter {
  // Optional: appends every queued message (including the raw token) as a
  // JSON line to this path. Off by default — only set by E2E, which has no
  // real mailbox to read a verify/reset link out of and needs the actual
  // token the API generated, not a stub.
  constructor(private readonly logPath?: string) {}

  async send(message: EmailMessage): Promise<void> {
    console.info(
      JSON.stringify({
        event: 'development_email_queued',
        template: message.template,
      }),
    );
    if (this.logPath) {
      await appendFile(this.logPath, JSON.stringify(message) + '\n');
    }
  }
}

function renderEmail(
  message: EmailMessage,
  appOrigin: string,
): { subject: string; html: string } {
  switch (message.template) {
    case 'VERIFY_EMAIL': {
      const link = `${appOrigin}/verify-email?token=${encodeURIComponent(message.token ?? '')}`;
      return {
        subject: 'ยืนยันอีเมลของคุณสำหรับ WYN',
        html: `<p>กดลิงก์นี้เพื่อยืนยันอีเมลของคุณ (หมดอายุใน 24 ชั่วโมง):</p><p><a href="${link}">${link}</a></p>`,
      };
    }
    case 'PASSWORD_RESET': {
      const link = `${appOrigin}/reset-password?token=${encodeURIComponent(message.token ?? '')}`;
      return {
        subject: 'รีเซ็ตรหัสผ่าน WYN ของคุณ',
        html: `<p>กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 1 ชั่วโมง):</p><p><a href="${link}">${link}</a></p><p>หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน สามารถเพิกเฉยต่ออีเมลนี้ได้</p>`,
      };
    }
    case 'PASSWORD_CHANGED':
      return {
        subject: 'รหัสผ่าน WYN ของคุณถูกเปลี่ยนแล้ว',
        html: `<p>รหัสผ่านบัญชี WYN ของคุณเพิ่งถูกเปลี่ยน หากไม่ใช่คุณ โปรดติดต่อฝ่ายสนับสนุนทันที</p>`,
      };
  }
}

/**
 * Sends transactional email through Resend's HTTP API
 * (https://resend.com/docs/api-reference/emails/send-email). Uses the
 * platform `fetch` (Node >=20, per package.json engines) rather than an
 * SDK dependency for one simple POST.
 */
export class ResendEmailAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly appOrigin: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const { subject, html } = renderEmail(message, this.appOrigin);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject,
        html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Resend email send failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }
  }
}
