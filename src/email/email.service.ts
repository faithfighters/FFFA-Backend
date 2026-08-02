import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { getFrontendUrl } from '../common/url-resolver';

// Landing-page brand colors, applied as accents on a light background — mobile
// Gmail does not reliably render a fully dark email body (it was rewriting the
// whole template to its own light palette regardless of markup), so instead of
// fighting that, the same navy/gold/orange palette is used the way a normal
// light-theme email would: colored header band, colored headings/accents,
// body copy on white. This is the same approach the original working OTP
// template used before the body was made fully dark.
const NAVY_900 = '#0A1834';
const CARD_BG = '#ffffff';
const LINE = '#e2e8f0';
const INK_2 = '#334155';
const MUTED = '#64748b';
const GOLD_SOFT = '#E4531F';
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
    // Light background (universally safe across every mail client) with the
    // brand's navy/gold/orange colors used as accents — a navy header band
    // behind the logo, colored headings/highlights, white body. This mirrors
    // the original OTP template's structure, which rendered reliably, instead
    // of the fully-dark body that mobile Gmail kept rewriting regardless of
    // markup technique.
    return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Faith Fighters For America</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${CARD_BG};border:1px solid ${LINE};border-radius:16px;">
<tr><td align="center" style="background-color:${NAVY_900};padding:28px 32px;border-radius:16px 16px 0 0;">
<img src="${logoUrl}" alt="Faith Fighters For America" width="200" style="display:block;max-width:200px;height:auto;border:0;outline:none;" />
</td></tr>
<tr><td style="background-color:${CARD_BG};padding:36px 32px;color:${INK_2};font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.6;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="background-color:#f8fafc;border-top:1px solid ${LINE};padding:20px 32px;font-size:12px;color:${MUTED};font-family:'Inter',system-ui,-apple-system,sans-serif;border-radius:0 0 16px 16px;">
<p style="margin:0 0 4px;">Faith Fighters For America &middot; 1751 Mound St, Suite 201, Sarasota, FL 34236</p>
<p style="margin:0;">&copy; ${new Date().getFullYear()} Faith Fighters For America. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  private ctaButton(label: string, href: string): string {
    return `<a href="${href}" style="display:inline-block;background:${ORANGE_GRADIENT};color:#ffffff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;box-shadow:0 8px 20px rgba(228,75,52,0.25);">${label} &rarr;</a>`;
  }

  private heading(text: string): string {
    return `<h2 style="color:${NAVY_900};margin:0 0 16px;font-size:20px;font-weight:700;">${text}</h2>`;
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
        <div style="background-color:#fff1eb;border-left:3px solid #E4531F;padding:12px 16px;border-radius:0 8px 8px 0;">
          <strong style="color:${NAVY_900};">Reason:</strong> ${reason}
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
        <div style="background-color:#fff1eb;border-left:3px solid #E4531F;padding:12px 16px;border-radius:0 8px 8px 0;">
          <strong style="color:${NAVY_900};">Reason:</strong> ${reason}
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;margin:28px 0;">
        <tr><td align="center" style="padding:24px;">
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:38px;font-weight:800;letter-spacing:8px;color:${GOLD_SOFT};margin:0;padding-left:8px;">${code}</div>
          <p style="color:${MUTED};margin:12px 0 0;font-size:13px;font-weight:500;">Valid for <strong style="color:${NAVY_900};">${expiryMinutes} minutes</strong> (Single-use only)</p>
        </td></tr>
      </table>
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
        <p style="margin:0;font-size:13px;font-weight:600;color:#9a3412;background-color:#fff7ed;border:1px solid #fed7aa;padding:12px 16px;border-radius:8px;">
          ⚠️ SECURITY WARNING: If you did not request a password reset, please change your password immediately or contact support as someone else may be attempting to access your account.
        </p>
      `),
    );
  }
}
