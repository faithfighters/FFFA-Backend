import { PageManifest } from './types';

export const DONATION_MANIFEST: PageManifest = {
  page: 'donation',
  label: 'Donation',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Give Today' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'Your gift, made visible' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: '100% transparent. Every dollar tracked to a mission you can follow from start to finish.',
    },

    // ── Donate Card ──
    { key: 'amountLabel', label: '"Choose an amount" label', type: 'text', section: 'Donate Card', defaultValue: 'Choose an amount' },
    {
      key: 'amountOptions', label: 'Amount options', type: 'repeater', section: 'Donate Card', itemLabel: 'Amount',
      itemFields: [
        { key: 'value', label: 'Amount (numbers only, e.g. 25)', type: 'text', defaultValue: '' },
        { key: 'label', label: 'Label (e.g. "1 family meal")', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { value: '25', label: '1 family meal' },
        { value: '50', label: 'Shelter kit' },
        { value: '100', label: 'Youth mentor' },
        { value: '250', label: 'Relief supplies' },
        { value: '500', label: 'Rebuild fund' },
      ],
    },
    {
      key: 'causeOptionsCsv', label: '"Direct my gift to" options (comma-separated)', type: 'text', section: 'Donate Card',
      defaultValue: "Where it's needed most, Disaster Relief, Youth Programs, Medical Relief, Food Security, Housing",
    },
    {
      key: 'secureNoteText', label: 'Secure checkout note', type: 'textarea', section: 'Donate Card',
      defaultValue: "Secure checkout via Stripe. You'll receive a tax-deductible receipt and a link to follow your mission.",
    },

    // ── Benefit Rows ──
    {
      key: 'benefits', label: 'Benefit rows', type: 'repeater', section: 'Benefit Rows', itemLabel: 'Benefit',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'text', label: 'Description', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Tracked to the dollar', text: 'Follow your gift to the exact mission it funds.' },
        { title: 'Boots on the ground', text: '963 missions delivered by real volunteers.' },
      ],
    },

    // ── Celebration Modal (shown after a successful donation) ──
    { key: 'modalTitle', label: 'Title', type: 'text', section: 'Celebration Modal', defaultValue: 'Donation Successful!' },
    { key: 'modalSubtitle', label: 'Subtitle', type: 'text', section: 'Celebration Modal', defaultValue: 'Thank you for your contribution!' },
    {
      key: 'modalBody', label: 'Body text', type: 'textarea', section: 'Celebration Modal',
      defaultValue: 'Your support helps us continue our mission to strengthen faith, unity, and purpose across America.',
    },
    { key: 'modalCardTitle', label: 'Supporting card title', type: 'text', section: 'Celebration Modal', defaultValue: 'Thank you for Supporting!' },
    { key: 'modalCardSubtitle', label: 'Supporting card subtitle', type: 'text', section: 'Celebration Modal', defaultValue: 'Together we can bring hope and rebuild lives' },
    { key: 'modalBtnLabel', label: 'Close button label', type: 'text', section: 'Celebration Modal', defaultValue: 'Great!' },
  ],
};
