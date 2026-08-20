import { PageManifest } from './types';

export const HOME_MANIFEST: PageManifest = {
  page: 'home',
  label: 'Home',
  fields: [
    // ── Hero ──
    { key: 'heroBadgeText', label: 'Hero badge text', type: 'text', section: 'Hero', defaultValue: '963 Missions Completed' },
    { key: 'heroTitleLine1', label: 'Hero title — line 1', type: 'text', section: 'Hero', defaultValue: 'One Nation.' },
    { key: 'heroTitleLine2', label: 'Hero title — line 2', type: 'text', section: 'Hero', defaultValue: 'One Spirit.' },
    { key: 'heroTitleLine3', label: 'Hero title — line 3', type: 'text', section: 'Hero', defaultValue: 'One Mission.' },
    {
      key: 'heroLead', label: 'Hero paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'A national movement of everyday Americans strengthening communities, restoring unity, and lifting up those in need through faith-driven action.',
    },
    { key: 'heroTrustText', label: 'Hero trust badge', type: 'text', section: 'Hero', defaultValue: 'Join the Founding Members' },
    { key: 'heroVideoCaption', label: 'Hero video caption', type: 'text', section: 'Hero', defaultValue: 'One Nation. One Mission. · 1:53' },
    { key: 'heroVideoPoster', label: 'Hero video poster image', type: 'image', section: 'Hero', defaultValue: '/images/video-thumbnail.png' },
    { key: 'joinNowLabel', label: '"Join Now" button label (signed-out visitors)', type: 'text', section: 'Hero', defaultValue: 'Join Now' },

    // ── What We Do ──
    { key: 'whatWeDoEyebrow', label: 'Section eyebrow', type: 'text', section: 'What We Do', defaultValue: '— What We Do' },
    { key: 'whatWeDoTitle', label: 'Section title', type: 'text', section: 'What We Do', defaultValue: 'Faith in action, made visible' },
    {
      key: 'whatWeDo', label: 'Cards', type: 'repeater', section: 'What We Do', itemLabel: 'Card',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'desc', label: 'Description', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Transparent Giving', desc: 'Every dollar is tracked and every mission is shared, so you always see the difference you make.' },
        { title: 'Community Action', desc: 'Boots-on-the-ground missions — food drives, shelter support, disaster relief — in neighborhoods nationwide.' },
        { title: 'Stories of Impact', desc: 'Real testimonies from the people you help, turning generosity into a story that inspires us all.' },
      ],
    },

    // ── Testimonials ──
    {
      key: 'testimonials', label: 'Testimonials', type: 'repeater', section: 'Testimonials', itemLabel: 'Testimonial',
      itemFields: [
        { key: 'quote', label: 'Quote', type: 'textarea', defaultValue: '' },
        { key: 'bio', label: 'Bio / context', type: 'textarea', defaultValue: '' },
        { key: 'name', label: 'Name', type: 'text', defaultValue: '' },
        { key: 'role', label: 'Role', type: 'text', defaultValue: '' },
        { key: 'initials', label: 'Avatar initials', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        {
          quote: "I couldn't even begin to imagine what my outcome would have been if it wasn't for Faith Fighters For America.",
          bio: "Mum-of-four Nikki Benstead needed the charity's help when her horse spooked and reared up, falling backwards on top of her.",
          name: 'Nikki Benstead', role: 'Mission beneficiary', initials: 'NB',
        },
        {
          quote: "They didn't just send help — they showed up, prayed with us, and helped us rebuild. We finally felt seen.",
          bio: 'After a house fire took everything, the Alvarez family turned to Faith Fighters for emergency housing and hope.',
          name: 'Maria Alvarez', role: 'Mission beneficiary', initials: 'MA',
        },
      ],
    },

    // ── Active Campaigns ──
    { key: 'campaignsEyebrow', label: 'Section eyebrow', type: 'text', section: 'Active Campaigns', defaultValue: '— Active Campaigns' },
    { key: 'campaignsTitle', label: 'Section title', type: 'text', section: 'Active Campaigns', defaultValue: 'Fund a mission today' },
    { key: 'campaignsSeeAllLabel', label: '"See all campaigns" button label', type: 'text', section: 'Active Campaigns', defaultValue: 'See all campaigns' },

    // ── Our Purpose ──
    { key: 'purposeEyebrow', label: 'Section eyebrow', type: 'text', section: 'Our Purpose', defaultValue: 'Our Purpose' },
    { key: 'purposeTitle', label: 'Section title', type: 'text', section: 'Our Purpose', defaultValue: 'Making Kindness Visible.' },
    {
      key: 'purposeLead', label: 'Section paragraph', type: 'textarea', section: 'Our Purpose',
      defaultValue: 'We unite communities through transparent giving and meaningful action, connecting people who want to help with those who need it most.',
    },
    { key: 'purposeStat1', label: 'Stat 1 label', type: 'text', section: 'Our Purpose', defaultValue: 'Stronger Communities' },
    { key: 'purposeStat2', label: 'Stat 2 label', type: 'text', section: 'Our Purpose', defaultValue: 'Real Compassion' },
    { key: 'purposeStat3', label: 'Stat 3 label', type: 'text', section: 'Our Purpose', defaultValue: 'Lasting Impact' },
    { key: 'purposeTagline', label: 'Tagline', type: 'text', section: 'Our Purpose', defaultValue: 'One Nation. One Spirit. One Mission.' },

    // ── Official Store ──
    { key: 'storeEyebrow', label: 'Section eyebrow', type: 'text', section: 'Official Store', defaultValue: '— Official Store' },
    { key: 'storeTitle', label: 'Section title', type: 'text', section: 'Official Store', defaultValue: 'Wear the mission' },
    { key: 'storeSubtitle', label: 'Section subtitle', type: 'text', section: 'Official Store', defaultValue: 'Every purchase funds faith-driven initiatives.' },
    { key: 'storeCtaLabel', label: '"Visit the store" button label', type: 'text', section: 'Official Store', defaultValue: 'Visit the store' },
  ],
};
