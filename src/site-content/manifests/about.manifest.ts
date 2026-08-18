import { PageManifest } from './types';

export const ABOUT_MANIFEST: PageManifest = {
  page: 'about',
  label: 'About us',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Who We Are' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'About Faith Fighters' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'A movement built on the conviction that a nation grows strong when its people stand united in faith and service.',
    },

    // ── Mission & Vision ──
    {
      key: 'missionVisionCards', label: 'Cards', type: 'repeater', section: 'Mission & Vision', itemLabel: 'Card',
      itemFields: [
        { key: 'image', label: 'Image', type: 'image', defaultValue: '' },
        { key: 'icon', label: 'Icon (symbol/emoji)', type: 'text', defaultValue: '' },
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'text', label: 'Description', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { image: '/images/img-07.jpg', icon: '✝', title: 'Mission', text: 'We unite communities with compassion, making every act of giving a shared and visible moment of kindness.' },
        { image: '/images/img-08.jpg', icon: '◎', title: 'Vision', text: 'A transparent movement where everyone can see and celebrate how helping neighbors becomes a story that inspires us all.' },
      ],
    },

    // ── Our Story ──
    { key: 'storyEyebrow', label: 'Eyebrow', type: 'text', section: 'Our Story', defaultValue: 'Our Story' },
    { key: 'storyTitle', label: 'Title', type: 'text', section: 'Our Story', defaultValue: 'Strength from unity' },
    {
      key: 'storyLead', label: 'Paragraph', type: 'textarea', section: 'Our Story',
      defaultValue: 'Faith Fighters For America was born from a simple conviction: national strength emerges from a unified citizenry and shared faith. We encourage Americans to embody integrity, courage, compassion, and devotion to God and freedom — restoring optimism and reinforcing the communities we call home.',
    },
    {
      key: 'storyTagsCsv', label: 'Tags (comma-separated)', type: 'text', section: 'Our Story',
      helpText: 'Shown as small pill tags below the paragraph, e.g. "Integrity, Courage, Compassion"',
      defaultValue: 'Integrity, Courage, Compassion, Faith, Freedom',
    },

    // ── Core Values ──
    { key: 'coreValuesEyebrow', label: 'Eyebrow', type: 'text', section: 'Core Values', defaultValue: 'How We Operate' },
    { key: 'coreValuesTitle', label: 'Title', type: 'text', section: 'Core Values', defaultValue: 'Our core values' },
    {
      key: 'coreValues', label: 'Values', type: 'repeater', section: 'Core Values', itemLabel: 'Value',
      itemFields: [
        { key: 'icon', label: 'Icon (symbol/emoji)', type: 'text', defaultValue: '' },
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'text', label: 'Description', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { icon: '◎', title: 'Open Impact', text: 'Transparency and quantifiable outcomes that demonstrate the tangible difference we make together.' },
        { icon: '📍', title: 'Local First', text: 'Community-level transformation strengthens the broader nation, one neighborhood at a time.' },
        { icon: '🛡', title: 'Stewardship', text: 'Faith-guided responsibility in managing every resource entrusted to us.' },
      ],
    },

    // ── Leadership ──
    { key: 'leadershipEyebrow', label: 'Eyebrow', type: 'text', section: 'Leadership', defaultValue: 'Leadership' },
    { key: 'leadershipTitle', label: 'Title', type: 'text', section: 'Leadership', defaultValue: 'Meet the team' },
    {
      key: 'leadershipTeam', label: 'Team members', type: 'repeater', section: 'Leadership', itemLabel: 'Team member',
      itemFields: [
        { key: 'image', label: 'Photo', type: 'image', defaultValue: '' },
        { key: 'name', label: 'Name', type: 'text', defaultValue: '' },
        { key: 'role', label: 'Role', type: 'text', defaultValue: '' },
        { key: 'bio', label: 'Bio', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { image: '/images/kevin-jones.jpg', name: 'Kevin Jones "Coach K"', role: 'Founder & CEO', bio: "25+ years in entertainment and entrepreneurship, leading the movement's vision." },
        { image: '/images/james-price.jpg', name: 'James Price', role: 'Co-Founder & Treasurer', bio: 'Automotive & restaurant background with deep community mentorship experience.' },
        { image: '/images/billy-gleason-jr.jpg', name: 'Billy Gleason Jr.', role: 'Co-Founder & Secretary', bio: 'Martial arts instructor focused on character and accountability.' },
      ],
    },

    // ── Call to Action ──
    { key: 'impactTitle', label: 'Title', type: 'text', section: 'Call to Action', defaultValue: 'Ready to Make an Impact?' },
    {
      key: 'impactText1', label: 'Paragraph 1', type: 'textarea', section: 'Call to Action',
      defaultValue: 'Faith Fighters for America empowers everyday people to create extraordinary change through kindness, service, and transparent giving.',
    },
    {
      key: 'impactText2', label: 'Paragraph 2', type: 'textarea', section: 'Call to Action',
      defaultValue: 'Together, we connect people who want to help with those who need it most, building stronger communities and changing lives—one act of kindness at a time.',
    },
    { key: 'impactTagline', label: 'Tagline', type: 'text', section: 'Call to Action', defaultValue: 'One Nation. One Spirit. One Mission.' },
    { key: 'joinMissionLabel', label: '"Join the Mission" button label (signed-out visitors)', type: 'text', section: 'Call to Action', defaultValue: 'Join the Mission' },
    { key: 'volunteerBtnLabel', label: '"Volunteer" button label', type: 'text', section: 'Call to Action', defaultValue: 'Volunteer' },
  ],
};
