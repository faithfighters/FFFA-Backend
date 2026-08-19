import { PageManifest } from './types';

// Not a routed page — "global" holds content shared across many pages
// (starting with the Newsletter signup block, which appears on ~10 pages).
// There's no single "live page" URL for this in the admin editor.
export const GLOBAL_MANIFEST: PageManifest = {
  page: 'global',
  label: 'Global (shared across pages)',
  fields: [
    { key: 'newsletterLabel', label: 'Label', type: 'text', section: 'Newsletter', defaultValue: 'NEWSLETTER' },
    { key: 'newsletterTitle', label: 'Title', type: 'text', section: 'Newsletter', defaultValue: 'STAY CONNECTED TO THE MOVEMENT' },
    {
      key: 'newsletterDescription', label: 'Description', type: 'textarea', section: 'Newsletter',
      defaultValue: 'Get inspiring stories, volunteer opportunities, community updates, and behind-the-scenes access delivered straight to your inbox.',
    },
    { key: 'newsletterBtnLabel', label: 'Submit button label', type: 'text', section: 'Newsletter', defaultValue: 'JOIN THE MISSION' },
    { key: 'newsletterNoSpamText', label: 'Fine print below the form', type: 'text', section: 'Newsletter', defaultValue: 'No spam. Just purpose-driven updates.' },
  ],
};
