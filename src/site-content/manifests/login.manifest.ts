import { PageManifest } from './types';

export const LOGIN_MANIFEST: PageManifest = {
  page: 'login',
  label: 'Login',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Welcome Back' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'One Spirit. One Mission.' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'Sign in to track your giving, follow your missions, and stand with 10,000+ Americans.',
    },

    // ── Footer ──
    { key: 'footerText', label: 'Footer text', type: 'text', section: 'Footer', defaultValue: 'New to Faith Fighters?' },
    { key: 'footerLinkLabel', label: 'Footer link label', type: 'text', section: 'Footer', defaultValue: 'Create an account' },
  ],
};
