import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { getFrontendUrl } from '../common/url-resolver';

@Injectable()
export class EmailService {
  private from: string;
  private configured: boolean;
  private resend: Resend | null = null;

  constructor() {
    this.from = process.env.EMAIL_FROM || '';
    const apiKey = process.env.RESEND_API_KEY;

    this.configured = !!apiKey && !!this.from;
    if (!apiKey) {
      console.warn('[email] RESEND_API_KEY not set — email sending is disabled.');
    } else if (!this.from) {
      console.warn('[email] EMAIL_FROM not set — email sending is disabled.');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.configured || !this.resend) {
      console.warn(`[email] Resend not configured — skipping email to ${to}: ${subject}`);
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({ from: this.from, to, subject, html });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`[email] Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  // ── Auth Emails ──────────────────────────────────────────

  async sendWelcome(to: string, name: string, plan: string) {
    const planNames: Record<string, string> = {
      faith_builder: 'Faith Builder',
      faith_hero: 'Faith Hero',
      faith_fighter: 'Faith Fighter',
    };
    await this.send(
      to,
      'Welcome to Faith Fighters For America!',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#db0000;">Welcome, ${name}!</h2>
        <p>You've joined FFFA as a <strong>${planNames[plan] || plan}</strong> member.</p>
        <p>You can now log in, cast your votes, and help direct donations to the causes you care about most.</p>
        <a href="${getFrontendUrl()}/dashboard" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
          Go to My Dashboard →
        </a>
        <p style="margin-top:24px;color:#666;font-size:0.875rem;">
          Faith Fighters For America · 1751 Mound St, Suite 201, Sarasota, FL 34236
        </p>
      </div>
      `,
    );
  }

  // ── Video Emails ─────────────────────────────────────────

  async sendVideoApproved(to: string, name: string, videoTitle: string) {
    await this.send(
      to,
      'Your video has been approved!',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#db0000;">Great news, ${name}!</h2>
        <p>Your video <strong>"${videoTitle}"</strong> has been approved and is now live on the platform.</p>
        <a href="${getFrontendUrl()}/media" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
          View on Platform →
        </a>
      </div>
      `,
    );
  }

  async sendVideoRejected(to: string, name: string, videoTitle: string, reason: string) {
    await this.send(
      to,
      'Update on your video submission',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Hi ${name},</h2>
        <p>Unfortunately, your video <strong>"${videoTitle}"</strong> was not approved.</p>
        <div style="background:#f9f9f9;border-left:4px solid #db0000;padding:12px 16px;margin:16px 0;">
          <strong>Reason:</strong> ${reason}
        </div>
        <p>You're welcome to make adjustments and resubmit. If you have questions, contact us at
          <a href="mailto:info@faithfightersforamerica.com">info@faithfightersforamerica.com</a>.
        </p>
      </div>
      `,
    );
  }

  // ── Campaign Emails ──────────────────────────────────────

  async sendCampaignApproved(to: string, name: string, causeName: string) {
    await this.send(
      to,
      'Your campaign has been approved!',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#db0000;">Campaign Approved, ${name}!</h2>
        <p>Your campaign <strong>"${causeName}"</strong> has been approved and is now eligible for the next voting cycle.</p>
        <a href="${getFrontendUrl()}/leaderboard" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
          View Leaderboard →
        </a>
      </div>
      `,
    );
  }

  async sendCampaignRejected(to: string, name: string, causeName: string, reason: string) {
    await this.send(
      to,
      'Update on your campaign application',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Hi ${name},</h2>
        <p>Your campaign <strong>"${causeName}"</strong> was not approved for this cycle.</p>
        <div style="background:#f9f9f9;border-left:4px solid #db0000;padding:12px 16px;margin:16px 0;">
          <strong>Reason:</strong> ${reason}
        </div>
        <p>Contact us at <a href="mailto:info@faithfightersforamerica.com">info@faithfightersforamerica.com</a> if you have questions.</p>
      </div>
      `,
    );
  }

  // ── Voting Emails ────────────────────────────────────────

  async sendVoteConfirmation(to: string, name: string, causes: string[]) {
    await this.send(
      to,
      'Your donation votes have been cast!',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#db0000;">Votes Confirmed, ${name}!</h2>
        <p>You've successfully cast your donation votes for this cycle:</p>
        <ul>
          ${causes.map(c => `<li>${c}</li>`).join('')}
        </ul>
        <p>80% of your membership fee will be distributed to these causes based on the final vote tally.</p>
        <a href="${getFrontendUrl()}/leaderboard" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
          Track the Leaderboard →
        </a>
      </div>
      `,
    );
  }

  // ── Subscription Emails ──────────────────────────────────

  async sendSubscriptionCancelled(to: string, name: string) {
    await this.send(
      to,
      'Your FFFA membership has been cancelled',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Hi ${name},</h2>
        <p>Your Faith Fighters For America membership has been cancelled. You'll retain access until the end of your current billing period.</p>
        <p>We're sorry to see you go. If you change your mind, you can rejoin at any time.</p>
        <a href="${getFrontendUrl()}/join" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
          Rejoin FFFA →
        </a>
      </div>
      `,
    );
  }

  // ── OTP Emails ───────────────────────────────────────────

  async sendRegisterOtp(to: string, name: string, code: string, expiryMinutes: number) {
    await this.send(
      to,
      'Verify Your Email Address',
      `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
        <div style="background-color: #0f172a; padding: 32px; text-align: center; border-bottom: 4px solid #dc2626;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FAITH FIGHTERS</h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">For America</p>
        </div>
        <div style="padding: 40px 32px; color: #334155; line-height: 1.6;">
          <h2 style="color: #0f172a; margin: 0 0 16px; font-size: 20px; font-weight: 700;">Verify Your Email Address</h2>
          <p style="margin: 0 0 24px; font-size: 15px;">Welcome to Faith Fighters For America, ${name}! Please verify your email address to complete your registration. Use the single-use security code below:</p>
          
          <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #dc2626; margin: 0; padding-left: 8px;">${code}</div>
            <p style="color: #64748b; margin: 12px 0 0; font-size: 13px; font-weight: 500;">Valid for <strong>${expiryMinutes} minutes</strong> (Single-use only)</p>
          </div>

          <p style="margin: 0 0 24px; font-size: 14px; color: #475569;">If you did not request this verification, you can safely ignore this email. No account will be created without this code.</p>
          <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 4px;">Faith Fighters For America · 1751 Mound St, Suite 201, Sarasota, FL 34236</p>
            <p style="margin: 0;">&copy; 2026 Faith Fighters For America. All rights reserved.</p>
          </div>
        </div>
      </div>
      `,
    );
  }

  async sendForgotPasswordOtp(to: string, name: string, code: string, expiryMinutes: number) {
    await this.send(
      to,
      'Password Reset Verification',
      `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
        <div style="background-color: #0f172a; padding: 32px; text-align: center; border-bottom: 4px solid #dc2626;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FAITH FIGHTERS</h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">For America</p>
        </div>
        <div style="padding: 40px 32px; color: #334155; line-height: 1.6;">
          <h2 style="color: #0f172a; margin: 0 0 16px; font-size: 20px; font-weight: 700;">Password Reset Verification</h2>
          <p style="margin: 0 0 24px; font-size: 15px;">Hello ${name}, we received a request to reset your password. Use the single-use security code below to authorize this change:</p>
          
          <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #dc2626; margin: 0; padding-left: 8px;">${code}</div>
            <p style="color: #64748b; margin: 12px 0 0; font-size: 13px; font-weight: 500;">Valid for <strong>${expiryMinutes} minutes</strong> (Single-use only)</p>
          </div>

          <p style="margin: 0 0 24px; font-size: 14px; color: #b91c1c; font-weight: 600; background-color: #fef2f2; border: 1px solid #fee2e2; padding: 12px 16px; border-radius: 8px;">
            ⚠️ SECURITY WARNING: If you did not request a password reset, please change your password immediately or contact support as someone else may be attempting to access your account.
          </p>
          <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 4px;">Faith Fighters For America · 1751 Mound St, Suite 201, Sarasota, FL 34236</p>
            <p style="margin: 0;">&copy; 2026 Faith Fighters For America. All rights reserved.</p>
          </div>
        </div>
      </div>
      `,
    );
  }
}
