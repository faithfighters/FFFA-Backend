import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { getFrontendUrl } from '../common/url-resolver';

// Landing-page theme tokens (mirrors FFFA-Frontend's page.module.css --hp-* variables)
const NAVY_900 = '#0A1834';
const CARD_BG = '#161B2A';
const LINE = 'rgba(255,255,255,0.08)';
const INK_2 = '#C6D2EA';
const MUTED = '#8A93A8';
const GOLD_SOFT = '#F0C879';
const ORANGE_GRADIENT = 'linear-gradient(135deg, #F4B98C 0%, #EE8A4C 50%, #E4531F 100%)';

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

  // ── Shared shell: dark navy card, real logo, gold/orange accents — matches the landing page theme ──

  private wrap(bodyHtml: string): string {
    const logoUrl = `${getFrontendUrl()}/images/fffa-logo.png`;
    return `
    <div style="background-color:#06080f;padding:32px 16px;font-family:'Inter',system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:linear-gradient(160deg,#121c34 0%,#0a0e1a 55%,#080a12 100%);border:1px solid ${LINE};border-radius:20px;overflow:hidden;">
        <div style="background:${NAVY_900};padding:28px 32px;text-align:center;border-bottom:1px solid ${LINE};">
          <img src="${logoUrl}" alt="Faith Fighters For America" width="200" style="display:inline-block;max-width:200px;height:auto;" />
        </div>
        <div style="padding:36px 32px;color:${INK_2};line-height:1.6;">
          ${bodyHtml}
        </div>
        <div style="border-top:1px solid ${LINE};padding:20px 32px;text-align:center;font-size:12px;color:${MUTED};">
          <p style="margin:0 0 4px;">Faith Fighters For America &middot; 1751 Mound St, Suite 201, Sarasota, FL 34236</p>
          <p style="margin:0;">&copy; ${new Date().getFullYear()} Faith Fighters For America. All rights reserved.</p>
        </div>
      </div>
    </div>
    `;
  }

  private ctaButton(label: string, href: string): string {
    return `<a href="${href}" style="display:inline-block;background:${ORANGE_GRADIENT};color:#ffffff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px;box-shadow:0 8px 20px rgba(228,75,52,0.3);">${label} &rarr;</a>`;
  }

  private heading(text: string): string {
    return `<h2 style="color:#ffffff;margin:0 0 16px;font-size:20px;font-weight:700;">${text}</h2>`;
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
      this.wrap(`
        ${this.heading(`Welcome, ${name}!`)}
        <p style="margin:0 0 8px;">You've joined FFFA as a <strong style="color:${GOLD_SOFT};">${planNames[plan] || plan}</strong> member.</p>
        <p style="margin:0;">You can now log in, cast your votes, and help direct donations to the causes you care about most.</p>
        ${this.ctaButton('Go to My Dashboard', `${getFrontendUrl()}/dashboard`)}
      `),
    );
  }

  // ── Video Emails ─────────────────────────────────────────

  async sendVideoApproved(to: string, name: string, videoTitle: string) {
    await this.send(
      to,
      'Your video has been approved!',
      this.wrap(`
        ${this.heading(`Great news, ${name}!`)}
        <p style="margin:0;">Your video <strong style="color:${GOLD_SOFT};">"${videoTitle}"</strong> has been approved and is now live on the platform.</p>
        ${this.ctaButton('View on Platform', `${getFrontendUrl()}/media`)}
      `),
    );
  }

  async sendVideoRejected(to: string, name: string, videoTitle: string, reason: string) {
    await this.send(
      to,
      'Update on your video submission',
      this.wrap(`
        ${this.heading(`Hi ${name},`)}
        <p style="margin:0 0 16px;">Unfortunately, your video <strong style="color:${GOLD_SOFT};">"${videoTitle}"</strong> was not approved.</p>
        <div style="background:rgba(255,255,255,0.04);border-left:3px solid #E4531F;padding:12px 16px;border-radius:0 8px 8px 0;">
          <strong style="color:#ffffff;">Reason:</strong> ${reason}
        </div>
        <p style="margin:16px 0 0;font-size:13px;color:${MUTED};">You're welcome to make adjustments and resubmit. If you have questions, contact us at
          <a href="mailto:info@faithfightersforamerica.com" style="color:${GOLD_SOFT};">info@faithfightersforamerica.com</a>.
        </p>
      `),
    );
  }

  // ── Campaign Emails ──────────────────────────────────────

  async sendCampaignApproved(to: string, name: string, causeName: string) {
    await this.send(
      to,
      'Your campaign has been approved!',
      this.wrap(`
        ${this.heading(`Campaign Approved, ${name}!`)}
        <p style="margin:0;">Your campaign <strong style="color:${GOLD_SOFT};">"${causeName}"</strong> has been approved and is now eligible for the next voting cycle.</p>
        ${this.ctaButton('View Leaderboard', `${getFrontendUrl()}/leaderboard`)}
      `),
    );
  }

  async sendCampaignRejected(to: string, name: string, causeName: string, reason: string) {
    await this.send(
      to,
      'Update on your campaign application',
      this.wrap(`
        ${this.heading(`Hi ${name},`)}
        <p style="margin:0 0 16px;">Your campaign <strong style="color:${GOLD_SOFT};">"${causeName}"</strong> was not approved for this cycle.</p>
        <div style="background:rgba(255,255,255,0.04);border-left:3px solid #E4531F;padding:12px 16px;border-radius:0 8px 8px 0;">
          <strong style="color:#ffffff;">Reason:</strong> ${reason}
        </div>
        <p style="margin:16px 0 0;font-size:13px;color:${MUTED};">Contact us at <a href="mailto:info@faithfightersforamerica.com" style="color:${GOLD_SOFT};">info@faithfightersforamerica.com</a> if you have questions.</p>
      `),
    );
  }

  /** Shared shell for the assistance-request lifecycle emails below — keeps six near-identical templates down to one render path. */
  private renderAssistanceRequestEmail(name: string, heading: string, body: string, ctaLabel = 'View My Requests', ctaHref = `${getFrontendUrl()}/dashboard/requests`) {
    return this.wrap(`
      ${this.heading(heading)}
      <p style="margin:0 0 8px;">Hi ${name},</p>
      ${body}
      ${this.ctaButton(ctaLabel, ctaHref)}
    `);
  }

  async sendAssistanceRequestReceived(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'We received your assistance request',
      this.renderAssistanceRequestEmail(
        name,
        'Request Received',
        `<p style="margin:0;">Your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong> has been submitted and is now awaiting review by our team. We'll email you at each step as it moves forward.</p>`,
      ),
    );
  }

  async sendAssistanceRequestUnderReview(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Your assistance request is under review',
      this.renderAssistanceRequestEmail(
        name,
        'Under Review',
        `<p style="margin:0;">Our team has started reviewing your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong>. We'll let you know as soon as a decision is made.</p>`,
      ),
    );
  }

  async sendAssistanceRequestApproved(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Your assistance request has been approved!',
      this.renderAssistanceRequestEmail(
        name,
        'Request Approved 🎉',
        `<p style="margin:0;">Great news — your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong> has been approved and is now eligible for member votes. The more votes it receives, the sooner it reaches its funding goal.</p>`,
      ),
    );
  }

  async sendAssistanceRequestFundingStarted(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Your campaign has started receiving votes!',
      this.renderAssistanceRequestEmail(
        name,
        'Votes Are Coming In',
        `<p style="margin:0;">Members of the Faith Fighters community have started voting for your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong>. Keep sharing your story — every vote brings you closer to your goal.</p>`,
      ),
    );
  }

  async sendAssistanceRequestFundingComplete(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Your campaign reached its funding goal! 🎉',
      this.renderAssistanceRequestEmail(
        name,
        'Funding Goal Reached 🎉',
        `<p style="margin:0;">Your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong> has received 100% of its required votes! Our team is now arranging payment.</p>`,
      ),
    );
  }

  async sendAssistanceRequestPaymentCompleted(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Payment for your assistance request is complete',
      this.renderAssistanceRequestEmail(
        name,
        'Payment Completed ✅',
        `<p style="margin:0;">Payment for your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong> has been completed. Thank you for being part of the Faith Fighters community — we'll be in touch shortly to invite you to share your story.</p>`,
      ),
    );
  }

  async sendAssistanceRequestCaseClosed(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Your assistance request case is now closed',
      this.renderAssistanceRequestEmail(
        name,
        'Case Closed — Thank You 🙏',
        `<p style="margin:0;">Your request <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong> is now fully closed out. Thank you for sharing your story with the community — it inspires others to keep giving.</p>`,
        'View Testimonial Videos',
        `${getFrontendUrl()}/dashboard/testimonials`,
      ),
    );
  }

  async sendTestimonialRejected(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Action needed: your testimonial for review',
      this.renderAssistanceRequestEmail(
        name,
        'Your Testimonial Needs Another Look',
        `<p style="margin:0;">Thanks for submitting a testimonial for <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong>. Our team wasn't able to publish it as submitted (missing details or information that needs a correction), so it's been removed. You're welcome to submit a new one any time.</p>`,
        'Submit a New Testimonial',
        `${getFrontendUrl()}/dashboard/requests`,
      ),
    );
  }

  async sendTestimonialRequest(to: string, name: string, requestTitle: string) {
    await this.send(
      to,
      'Your campaign reached 100% — share your story 🎉',
      this.wrap(`
        ${this.heading(`Congratulations, ${name}! 🎉`)}
        <p style="margin:0 0 8px;">Your campaign <strong style="color:${GOLD_SOFT};">"${requestTitle}"</strong> has received 100% of its required votes, and payment has been arranged.</p>
        <p style="margin:0;">Because of votes like theirs, the Faith Fighters community came together and made this happen. We'd love for you to share how this support helped you — it means the world to the members who voted, and inspires others to keep giving.</p>
        ${this.ctaButton('Share Your Testimonial', `${getFrontendUrl()}/dashboard/requests`)}
        <p style="margin-top:16px;color:${MUTED};font-size:13px;">Click the button above, find this request under "My Requests," and tap "Share Your Testimonial" — you can submit a short video or write a few words about your experience.</p>
      `),
    );
  }

  // ── Voting Emails ────────────────────────────────────────

  async sendVoteConfirmation(to: string, name: string, causes: string[]) {
    await this.send(
      to,
      'Your donation votes have been cast!',
      this.wrap(`
        ${this.heading(`Votes Confirmed, ${name}!`)}
        <p style="margin:0 0 12px;">You've successfully cast your donation votes for this cycle:</p>
        <ul style="margin:0 0 16px;padding-left:20px;color:${INK_2};">
          ${causes.map(c => `<li style="margin-bottom:4px;">${c}</li>`).join('')}
        </ul>
        <p style="margin:0;">80% of your membership fee will be distributed to these causes based on the final vote tally.</p>
        ${this.ctaButton('Track the Leaderboard', `${getFrontendUrl()}/leaderboard`)}
      `),
    );
  }

  // ── Subscription Emails ──────────────────────────────────

  async sendSubscriptionCancelled(to: string, name: string) {
    await this.send(
      to,
      'Your FFFA membership has been cancelled',
      this.wrap(`
        ${this.heading(`Hi ${name},`)}
        <p style="margin:0 0 8px;">Your Faith Fighters For America membership has been cancelled. You'll retain access until the end of your current billing period.</p>
        <p style="margin:0;">We're sorry to see you go. If you change your mind, you can rejoin at any time.</p>
        ${this.ctaButton('Rejoin FFFA', `${getFrontendUrl()}/join`)}
      `),
    );
  }

  // ── OTP Emails ───────────────────────────────────────────

  private otpCodeBlock(code: string, expiryMinutes: number): string {
    return `
      <div style="background:rgba(224,169,60,0.08);border:1.5px solid rgba(224,169,60,0.3);border-radius:12px;padding:24px;text-align:center;margin:28px 0;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:38px;font-weight:800;letter-spacing:8px;color:${GOLD_SOFT};margin:0;padding-left:8px;">${code}</div>
        <p style="color:${MUTED};margin:12px 0 0;font-size:13px;font-weight:500;">Valid for <strong style="color:#ffffff;">${expiryMinutes} minutes</strong> (Single-use only)</p>
      </div>
    `;
  }

  async sendRegisterOtp(to: string, name: string, code: string, expiryMinutes: number) {
    await this.send(
      to,
      'Verify Your Email Address',
      this.wrap(`
        ${this.heading('Verify Your Email Address')}
        <p style="margin:0 0 8px;">Welcome to Faith Fighters For America, ${name}! Please verify your email address to complete your registration. Use the single-use security code below:</p>
        ${this.otpCodeBlock(code, expiryMinutes)}
        <p style="margin:0;font-size:13px;color:${MUTED};">If you did not request this verification, you can safely ignore this email. No account will be created without this code.</p>
      `),
    );
  }

  async sendForgotPasswordOtp(to: string, name: string, code: string, expiryMinutes: number) {
    await this.send(
      to,
      'Password Reset Verification',
      this.wrap(`
        ${this.heading('Password Reset Verification')}
        <p style="margin:0 0 8px;">Hello ${name}, we received a request to reset your password. Use the single-use security code below to authorize this change:</p>
        ${this.otpCodeBlock(code, expiryMinutes)}
        <p style="margin:0;font-size:13px;font-weight:600;color:#F0C879;background:rgba(228,83,31,0.12);border:1px solid rgba(228,83,31,0.3);padding:12px 16px;border-radius:8px;">
          ⚠️ SECURITY WARNING: If you did not request a password reset, please change your password immediately or contact support as someone else may be attempting to access your account.
        </p>
      `),
    );
  }
}
