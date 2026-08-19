import { PageManifest } from './types';

export const REGISTER_MANIFEST: PageManifest = {
  page: 'register',
  label: 'Register',
  fields: [
    // ── Donor Hero (intent=donate, the default) ──
    { key: 'donorHeroEyebrow', label: 'Eyebrow', type: 'text', section: 'Donor Hero', defaultValue: 'Join the Movement' },
    { key: 'donorHeroTitle', label: 'Title', type: 'text', section: 'Donor Hero', defaultValue: 'One Spirit. One Mission.' },
    {
      key: 'donorHeroLead', label: 'Paragraph', type: 'textarea', section: 'Donor Hero',
      defaultValue: 'Create your account to track your giving, join missions, and stand with 10,000+ Americans.',
    },
    { key: 'donorFooterText', label: 'Footer text', type: 'text', section: 'Donor Hero', defaultValue: 'Already have an account?' },
    { key: 'donorFooterLinkLabel', label: 'Footer link label', type: 'text', section: 'Donor Hero', defaultValue: 'Log In' },

    // ── Help Hero (intent=help) ──
    { key: 'helpHeroEyebrow', label: 'Eyebrow', type: 'text', section: 'Help Hero', defaultValue: 'Need Help' },
    { key: 'helpHeroTitle', label: 'Title', type: 'text', section: 'Help Hero', defaultValue: "We're Here for You" },
    {
      key: 'helpHeroLead', label: 'Paragraph', type: 'textarea', section: 'Help Hero',
      defaultValue: 'If you or someone you know is in need, reach out. No situation is too small for compassion.',
    },

    // ── How We Help ──
    { key: 'howWeHelpEyebrow', label: 'Eyebrow', type: 'text', section: 'How We Help', defaultValue: '— How We Help' },
    { key: 'howWeHelpTitle', label: 'Title', type: 'text', section: 'How We Help', defaultValue: 'Ways we can support you' },
    {
      key: 'helpCards', label: 'Cards', type: 'repeater', section: 'How We Help', itemLabel: 'Card',
      helpText: 'Icons are fixed (Housing, Food, Disaster, Prayer, in that order) — this only edits title/description.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'desc', label: 'Description', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Housing & shelter', desc: 'Emergency housing, repairs, and essentials.' },
        { title: 'Food & supplies', desc: 'Meals, groceries, and daily necessities.' },
        { title: 'Disaster relief', desc: 'Rapid response for families hit by crisis.' },
        { title: 'Prayer & care', desc: 'Encouragement, connection, and follow-up.' },
      ],
    },

    // ── Help Flow: Share Your Story column ──
    { key: 'shareStoryEyebrow', label: 'Eyebrow', type: 'text', section: 'Help Form Columns', defaultValue: '— Share Your Story' },
    { key: 'shareStoryTitle', label: 'Title', type: 'text', section: 'Help Form Columns', defaultValue: 'Your story matters' },
    { key: 'shareStoryText', label: 'Text', type: 'text', section: 'Help Form Columns', defaultValue: 'Every mission starts with someone reaching out — thank you for taking this step.' },

    // ── Help Flow: Submit Request column ──
    { key: 'submitRequestEyebrow', label: 'Eyebrow', type: 'text', section: 'Help Form Columns', defaultValue: '— Submit Your Request' },
    { key: 'submitRequestTitle', label: 'Title', type: 'text', section: 'Help Form Columns', defaultValue: "A few details & you're done" },
    { key: 'submitRequestText', label: 'Text', type: 'text', section: 'Help Form Columns', defaultValue: "No account needed — we'll create your member account with this request so you can track it." },
  ],
};
