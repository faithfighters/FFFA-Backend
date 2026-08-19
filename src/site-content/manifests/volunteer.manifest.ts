import { PageManifest } from './types';

export const VOLUNTEER_MANIFEST: PageManifest = {
  page: 'volunteer',
  label: 'Volunteer',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Volunteer' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'Serve Your Community' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'One hour a week or a full weekend — bring your time and talents and make a real difference.',
    },

    // ── Six Ways to Serve ──
    { key: 'rolesEyebrow', label: 'Eyebrow', type: 'text', section: 'Six Ways to Serve', defaultValue: 'Find Your Role' },
    { key: 'rolesTitle', label: 'Title', type: 'text', section: 'Six Ways to Serve', defaultValue: 'Six ways to serve' },
    {
      key: 'roles', label: 'Roles', type: 'repeater', section: 'Six Ways to Serve', itemLabel: 'Role',
      helpText: 'Also populates the "Preferred Role" dropdown in the sign-up form below.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'desc', label: 'Description', type: 'textarea', defaultValue: '' },
        { key: 'image', label: 'Image', type: 'image', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Event Crew', desc: 'Setup, greeting guests, and event support.', image: '/images/serve-event.jpg' },
        { title: 'Community Outreach', desc: 'Shelter visits, food drives, partner support.', image: '/images/serve-outreach.jpg' },
        { title: 'Prayer & Care Team', desc: 'Encouragement and follow-up support.', image: '/images/serve-prayer.jpg' },
        { title: 'Content & Media', desc: 'Photography, storytelling, social media.', image: '/images/serve-media.jpg' },
        { title: 'Drivers & Logistics', desc: 'Transport supplies and resources.', image: '/images/serve-drive.jpg' },
        { title: 'Fundraising Support', desc: 'Awareness and donation initiatives.', image: '/images/serve-fund.jpg' },
      ],
    },

    // ── How It Works ──
    { key: 'howItWorksEyebrow', label: 'Eyebrow', type: 'text', section: 'How It Works', defaultValue: 'How It Works' },
    { key: 'howItWorksTitle', label: 'Title', type: 'text', section: 'How It Works', defaultValue: 'Start in three steps' },
    {
      key: 'steps', label: 'Steps', type: 'repeater', section: 'How It Works', itemLabel: 'Step',
      helpText: 'Step numbers (1, 2, 3) are fixed — this only edits each step\'s title/description.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'desc', label: 'Description', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Sign up', desc: 'Complete the short form with your info and preferred role.' },
        { title: 'Get matched', desc: 'A dedicated coordinator in your area reaches out to you.' },
        { title: 'Start serving', desc: 'Begin making a tangible difference alongside your community.' },
      ],
    },

    // ── Sign-Up Section ──
    { key: 'signupEyebrow', label: 'Eyebrow', type: 'text', section: 'Sign-Up Section', defaultValue: 'Ready to Serve?' },
    { key: 'signupTitle', label: 'Title', type: 'text', section: 'Sign-Up Section', defaultValue: 'Sign up to volunteer' },
    { key: 'submitBtnLabel', label: 'Submit button label', type: 'text', section: 'Sign-Up Section', defaultValue: 'Submit Volunteer Application →' },
    { key: 'successTitle', label: 'Success message title', type: 'text', section: 'Sign-Up Section', defaultValue: 'Thank You!' },
    { key: 'successText', label: 'Success message text', type: 'text', section: 'Sign-Up Section', defaultValue: 'A volunteer coordinator will be in touch with you soon.' },
  ],
};
