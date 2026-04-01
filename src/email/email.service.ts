import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'noreply@faithfightersforamerica.com';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private async send(to: string, subject: string, html: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn(`[email] SMTP not configured — skipping email to ${to}: ${subject}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
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
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
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
        <a href="${process.env.FRONTEND_URL}/media" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
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
        <a href="${process.env.FRONTEND_URL}/leaderboard" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
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
        <a href="${process.env.FRONTEND_URL}/leaderboard" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
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
        <a href="${process.env.FRONTEND_URL}/join" style="display:inline-block;background:#db0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
          Rejoin FFFA →
        </a>
      </div>
      `,
    );
  }
}
