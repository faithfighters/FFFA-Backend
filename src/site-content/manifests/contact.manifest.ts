import { PageManifest } from './types';

export const CONTACT_MANIFEST: PageManifest = {
  page: 'contact',
  label: 'Contact',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Get in Touch' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'Contact Us' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'Questions, ideas, or want to get involved? Reach out and join us in strengthening faith and unity across America.',
    },

    // ── Ways to Connect ──
    { key: 'connectEyebrow', label: 'Eyebrow', type: 'text', section: 'Ways to Connect', defaultValue: 'Reach Us' },
    { key: 'connectTitle', label: 'Title', type: 'text', section: 'Ways to Connect', defaultValue: 'Ways to connect' },
    { key: 'emailAddress', label: 'Email address', type: 'text', section: 'Ways to Connect', defaultValue: 'info@faithfightersforamerica.com' },
    { key: 'phoneText', label: 'Phone card text', type: 'text', section: 'Ways to Connect', defaultValue: "Call us today — we'd love to hear from you." },
    { key: 'address', label: 'Address', type: 'text', section: 'Ways to Connect', defaultValue: '1751 Mound St, Suite 201 · Sarasota, FL 34236' },
    { key: 'youtubeUrl', label: 'YouTube URL', type: 'text', section: 'Ways to Connect', defaultValue: 'https://www.youtube.com/@FaithFightersforAmerica' },
    { key: 'xUrl', label: 'X (Twitter) URL', type: 'text', section: 'Ways to Connect', defaultValue: '#' },
    { key: 'facebookUrl', label: 'Facebook URL', type: 'text', section: 'Ways to Connect', defaultValue: '#' },
    { key: 'tiktokUrl', label: 'TikTok URL', type: 'text', section: 'Ways to Connect', defaultValue: '#' },

    // ── Send a Message ──
    { key: 'sendMessageEyebrow', label: 'Eyebrow', type: 'text', section: 'Send a Message', defaultValue: 'Send a Message' },
    { key: 'sendMessageTitle', label: 'Title', type: 'text', section: 'Send a Message', defaultValue: "We'd love to hear from you" },
    { key: 'successText', label: 'Success message', type: 'text', section: 'Send a Message', defaultValue: "✓ Thank you! We'll get back to you soon." },
    { key: 'submitBtnLabel', label: 'Submit button label', type: 'text', section: 'Send a Message', defaultValue: 'Send message' },
  ],
};
