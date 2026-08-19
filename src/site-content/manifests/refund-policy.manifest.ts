import { PageManifest } from './types';

export const REFUND_POLICY_MANIFEST: PageManifest = {
  page: 'refund-policy',
  label: 'Refund Policy',
  fields: [
    { key: 'heroTitle', label: 'Page title', type: 'text', section: 'Page', defaultValue: 'Refund Policy' },
    { key: 'lastUpdated', label: 'Last updated date', type: 'text', section: 'Page', defaultValue: 'March 6, 2026' },
    {
      key: 'introText', label: 'Intro paragraph', type: 'textarea', section: 'Page',
      defaultValue: 'Faith Fighters For America ("FFFA") is committed to transparency and fairness in all financial transactions. Please read this Refund Policy carefully before making any donation or subscription purchase.',
    },
    {
      key: 'sections', label: 'Sections', type: 'repeater', section: 'Page', itemLabel: 'Section',
      helpText: 'Each section is a numbered heading + body. In the body, start a line with "- " to make it a bullet list item.',
      itemFields: [
        { key: 'heading', label: 'Heading', type: 'text', defaultValue: '' },
        { key: 'body', label: 'Body', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { heading: '1. Donations', body: 'All donations made to Faith Fighters For America are considered voluntary contributions and are generally non-refundable. Once a donation has been processed and allocated to charitable causes, it cannot be reversed.' },
        { heading: '2. Disputed or Erroneous Charges', body: 'If you believe a charge was made in error or without your authorization, you have a 7-day window from the date of the charge to contact us at info@faithfightersforamerica.com to report the issue. We will investigate promptly and, if an error is confirmed, process a refund.' },
        { heading: '3. Refund Processing', body: 'Once a refund is approved, it will be processed within 7–10 business days. Refunds are returned to the original payment method. Processing times may vary depending on your financial institution.' },
        { heading: '4. Membership Fees', body: 'Monthly membership fees are generally non-refundable. If you cancel your subscription, your membership remains active through the end of the current billing period, after which no further charges will occur. No partial-month refunds are issued.' },
        { heading: '5. Store Purchases', body: 'Store items may be returned within 14 days of purchase if they are unused and in their original condition. To initiate a return, contact us at info@faithfightersforamerica.com with your order details.' },
        { heading: '6. How to Request a Refund', body: 'To request a refund:\n- Email info@faithfightersforamerica.com\n- Include your full name, email address used for the transaction, and transaction date\n- Describe the reason for your refund request\n- Our team will respond within 2 business days' },
      ],
    },
    { key: 'contactHeading', label: 'Contact section heading', type: 'text', section: 'Contact', defaultValue: '7. Contact' },
    { key: 'contactText', label: 'Contact text', type: 'text', section: 'Contact', defaultValue: 'Questions about refunds? Contact us at' },
    { key: 'contactEmail', label: 'Contact email', type: 'text', section: 'Contact', defaultValue: 'info@faithfightersforamerica.com' },
  ],
};
