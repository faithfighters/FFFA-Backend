import { PageManifest } from './types';

export const PRIVACY_POLICY_MANIFEST: PageManifest = {
  page: 'privacy-policy',
  label: 'Privacy Policy',
  fields: [
    { key: 'heroTitle', label: 'Page title', type: 'text', section: 'Page', defaultValue: 'Privacy Policy' },
    { key: 'lastUpdated', label: 'Last updated date', type: 'text', section: 'Page', defaultValue: 'February 5, 2026' },
    {
      key: 'introText', label: 'Intro paragraph', type: 'textarea', section: 'Page',
      defaultValue: 'Faith Fighters For America ("FFFA," "we," "us," or "our") is committed to protecting your personal information and your right to privacy. Our core commitment is simple: we do not sell, trade, or rent your personal information to third parties.',
    },
    {
      key: 'sections', label: 'Sections', type: 'repeater', section: 'Page', itemLabel: 'Section',
      helpText: 'Each section is a numbered heading + body. In the body, start a line with "- " to make it a bullet list item.',
      itemFields: [
        { key: 'heading', label: 'Heading', type: 'text', defaultValue: '' },
        { key: 'body', label: 'Body', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { heading: '1. Information We Collect', body: 'We collect information you provide directly to us, including:\n- Name, email address, and phone number when you register or contact us\n- Billing and payment information (processed securely through Stripe)\n- Profile information and membership plan details\n- Volunteer application information\n- Communications you send to us via contact forms or email' },
        { heading: '2. How We Use Your Information', body: 'We use the information we collect to:\n- Process your membership subscription and donations\n- Send you receipts, tax letters, and account-related communications\n- Provide you with platform features including voting, video submissions, and impact reports\n- Send newsletters and community updates (you may opt out at any time)\n- Improve our platform and services\n- Comply with legal obligations' },
        { heading: '3. How We Share Your Information', body: 'We do not sell or rent your personal information. We may share your information with:\n- Service Providers: Stripe (payment processing), email providers, and hosting services who are contractually obligated to keep your data secure\n- Legal Requirements: When required by law, court order, or governmental authority\n- Business Transfers: In connection with a merger, sale, or transfer of assets, with notice to you' },
        { heading: '4. Data Security', body: 'We implement industry-standard security measures to protect your personal information, including SSL encryption for data transmission and secure storage of sensitive data. Payment information is processed and stored by Stripe and never stored on our servers.' },
        { heading: '5. Your Rights', body: 'You have the right to:\n- Access the personal information we hold about you\n- Request correction of inaccurate data\n- Request deletion of your personal data (subject to legal obligations)\n- Opt out of marketing communications at any time\n- Cancel your membership at any time' },
        { heading: '6. Cookies', body: 'We use cookies and similar tracking technologies to improve your browsing experience, analyze site traffic, and understand where our visitors are coming from. You can control cookie settings through your browser preferences.' },
        { heading: "7. Children's Privacy", body: 'Our platform is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.' },
        { heading: '8. Changes to This Policy', body: 'We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page with an updated date.' },
      ],
    },
    { key: 'contactHeading', label: 'Contact section heading', type: 'text', section: 'Contact', defaultValue: '9. Contact Us' },
    { key: 'contactText', label: 'Contact text', type: 'text', section: 'Contact', defaultValue: 'For privacy-related questions or requests, please contact us at:' },
    { key: 'contactEmail', label: 'Contact email', type: 'text', section: 'Contact', defaultValue: 'privacy@faithfightersforamerica.com' },
  ],
};
