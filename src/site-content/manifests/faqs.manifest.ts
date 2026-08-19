import { PageManifest } from './types';

export const FAQS_MANIFEST: PageManifest = {
  page: 'faqs',
  label: 'FAQs',
  fields: [
    { key: 'eyebrow', label: 'Eyebrow', type: 'text', section: 'Page', defaultValue: 'Help Center' },
    { key: 'title', label: 'Title', type: 'text', section: 'Page', defaultValue: 'Frequently Asked Questions' },
    {
      key: 'subtitle', label: 'Subtitle', type: 'textarea', section: 'Page',
      defaultValue: 'Find answers to the most common questions about donations, membership, and our platform.',
    },
    {
      key: 'faqs', label: 'Questions', type: 'repeater', section: 'Page', itemLabel: 'Question',
      helpText: 'Questions are grouped by "Category" on the live page — use the same category text on multiple questions to group them together (e.g. "Donations", "Membership").',
      itemFields: [
        { key: 'category', label: 'Category', type: 'text', defaultValue: '' },
        { key: 'q', label: 'Question', type: 'text', defaultValue: '' },
        { key: 'a', label: 'Answer', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { category: 'Donations', q: 'How are donations used?', a: 'Donations directly support faith-based initiatives, community outreach programs, and charitable causes voted on by our members. 80% of all subscription revenue goes directly to causes, and 20% supports platform operations.' },
        { category: 'Donations', q: 'Are my donations tax-deductible?', a: 'Yes. All donations made to Faith Fighters For America are fully tax-deductible as allowed by law. You will receive an official tax receipt via email immediately after your donation.' },
        { category: 'Donations', q: 'Can I set up recurring gifts?', a: 'Yes. You can set up monthly, quarterly, or annual recurring donation options when selecting your membership plan.' },
        { category: 'Donations', q: 'Can I make a memorial donation?', a: 'Yes. We accept donations made in honor or memory of loved ones. Please contact us at info@faithfightersforamerica.com for arrangements.' },
        { category: 'Donations', q: 'What payment methods are accepted?', a: 'We accept credit and debit cards, PayPal, and secure online transfers via Stripe.' },
        { category: 'Membership', q: 'How do I sign up?', a: "Complete the online membership form at our Join The Movement page. Choose your plan, create your account, and you're ready to start making an impact." },
        { category: 'Membership', q: 'What are the membership benefits?', a: 'Benefits vary by tier. All members receive exclusive updates, event invitations, participation opportunities, voting rights, impact reports, and access to community features.' },
        { category: 'Membership', q: 'Is there a free membership?', a: 'Yes. A free membership option is available with optional voluntary donations. Paid plans unlock voting rights and additional benefits.' },
        { category: 'Membership', q: 'Who is eligible to join?', a: 'Individuals and faith-based organizations throughout the United States are welcome to join.' },
        { category: 'Membership', q: 'Can I change my membership plan?', a: 'Yes. You can upgrade or downgrade your plan at any time by logging into your account and visiting the subscription management section.' },
        { category: 'Store', q: 'What products are available?', a: 'Our store will feature apparel, accessories, and faith-inspired items. Products are launching soon — subscribe to our newsletter for alerts.' },
        { category: 'Store', q: 'What is the return policy?', a: 'We offer a 14-day return window for unused items in their original condition.' },
        { category: 'Store', q: 'Do you ship internationally?', a: 'We currently ship within the United States only.' },
        { category: 'Store', q: 'Are store purchases tax-deductible?', a: 'No. Store purchases are not tax-deductible. Only direct donations qualify for tax deductions.' },
        { category: 'Tax & Receipts', q: 'Is FFFA a registered nonprofit?', a: 'Yes. Faith Fighters For America is registered as a nonprofit organization under U.S. law.' },
        { category: 'Tax & Receipts', q: 'When will I receive my tax receipt?', a: 'Official tax receipts are emailed immediately after each donation.' },
        { category: 'Tax & Receipts', q: 'Can I get an annual donation statement?', a: 'Yes. Annual statements are available upon request. Contact our finance department at info@faithfightersforamerica.com.' },
        { category: 'Contact & Support', q: 'How can I contact you?', a: 'You can reach us via our online contact form or by emailing contact@faithfightersforamerica.org. We respond within 24–48 business hours.' },
        { category: 'Contact & Support', q: 'How do I volunteer?', a: 'Visit our Volunteer page to explore opportunities and submit your application. A coordinator will reach out to connect you.' },
        { category: 'Contact & Support', q: "I'm having a technical issue. Who do I contact?", a: 'Email our support team at info@faithfightersforamerica.com with a description of the issue, or use the contact form on our Contact page.' },
      ],
    },
    { key: 'ctaText', label: '"Still have questions?" text', type: 'text', section: 'Page', defaultValue: 'Still have questions?' },
    { key: 'ctaBtnLabel', label: 'CTA button label', type: 'text', section: 'Page', defaultValue: 'Contact Us' },
  ],
};
