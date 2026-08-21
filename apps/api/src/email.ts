export type EmailMessage = { to: string; template: 'VERIFY_EMAIL'|'PASSWORD_RESET'|'PASSWORD_CHANGED'; token?: string };
export interface EmailAdapter { send(message: EmailMessage): Promise<void>; }
export class TestEmailAdapter implements EmailAdapter { readonly messages: EmailMessage[]=[]; async send(message: EmailMessage): Promise<void> { this.messages.push(message); } }
export class DevelopmentEmailAdapter implements EmailAdapter { async send(message: EmailMessage): Promise<void> { console.info(JSON.stringify({event:'development_email_queued',template:message.template})); } }
export class ProductionEmailAdapter implements EmailAdapter { async send(): Promise<void> { throw new Error('Production email provider is not configured'); } }
