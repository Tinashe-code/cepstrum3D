import { AbstractNotificationProviderService } from "@medusajs/framework/utils";
import type { Logger, ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types";
import { resendConfig, sendWithResend } from "../../lib/notifications/resend";

type Options = {
  /** Resend API key (https://resend.com — free tier 3,000 emails/month). */
  apiKey?: string;
  /** Sender, e.g. "Cepstrum3D <orders@cepstrum3d.co.zw>" — the domain must be verified in Resend. */
  from?: string;
};

/**
 * All Cepstrum3D emails (channel "email") — to customers and to vendors —
 * through Resend. Without RESEND_API_KEY the email is written to the backend
 * log instead. Every send and every failure is logged with the reason.
 *
 * Expects notification.data = { subject, html, text } (see src/lib/notifications/).
 * Check your setup with:  bunx medusa exec ./src/scripts/send-test-email.ts
 */
class EmailNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "email-notification";

  protected logger: Logger;
  protected options: Options;

  constructor({ logger }: { logger: Logger }, options: Options) {
    super();
    this.logger = logger;
    this.options = options ?? {};
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const data = (notification.data ?? {}) as { subject?: string; html?: string; text?: string };
    const subject = data.subject ?? notification.template;
    const env = resendConfig();
    const apiKey = (this.options.apiKey ?? "").trim() || env.apiKey;
    const from = notification.from || (this.options.from ?? "").trim() || env.from;

    if (!apiKey) {
      this.logger.info(`[email not sent — set RESEND_API_KEY] to=${notification.to} subject="${subject}"\n${data.text ?? ""}`);
      return {};
    }

    const result = await sendWithResend({ to: notification.to, subject, html: data.html, text: data.text }, apiKey, from);
    if (!result.ok) {
      this.logger.error(
        `[email failed] to=${notification.to} subject="${subject}" — Resend ${result.status}: ${result.message}` +
          (result.hint ? `\n  → ${result.hint}` : "")
      );
      // Throwing marks the notification as failed in the notification module.
      throw new Error(`Resend ${result.status}: ${result.message}`);
    }
    this.logger.info(`[email sent] to=${notification.to} subject="${subject}" id=${result.id}`);
    return { id: result.id };
  }
}

export default EmailNotificationProviderService;
