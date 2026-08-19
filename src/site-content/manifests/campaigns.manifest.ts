import { PageManifest } from './types';

export const CAMPAIGNS_MANIFEST: PageManifest = {
  page: 'campaigns',
  label: 'Campaigns',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Campaigns' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'Fund a Mission' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'Choose a cause close to your heart. Track its progress. See exactly where your giving goes.',
    },

    // ── Campaign Grid ──
    { key: 'missionBtnLabel', label: '"Support this mission" button label', type: 'text', section: 'Campaign Grid', defaultValue: 'Support this mission' },
    {
      key: 'campaigns', label: 'Campaign cards', type: 'repeater', section: 'Campaign Grid', itemLabel: 'Campaign',
      helpText: 'Add, remove, or edit the campaign cards shown in the grid.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'videoUrl', label: 'Video file', type: 'video', defaultValue: '' },
        { key: 'image', label: 'Thumbnail image', type: 'image', defaultValue: '' },
        { key: 'desc', label: 'Description', type: 'textarea', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Bills Paid', videoUrl: 'https://faithfightersamerica.com/video8.mp4', image: '/images/img-01.jpg', desc: 'A family caught up on overdue utilities and kept the power on.' },
        { title: 'Car Payment Paid', videoUrl: 'https://faithfightersamerica.com/video4.mp4', image: '/images/img-02.jpg', desc: 'A worker kept the car that gets them to their job every day.' },
        { title: 'Hotel Stay Covered', videoUrl: 'https://faithfightersamerica.com/video5.mp4', image: '/images/img-03.jpg', desc: 'A family off the street and into a safe, warm place for the night.' },
        { title: 'Prayers Answered', videoUrl: 'https://faithfightersamerica.com/video11.mp4', image: '/images/img-05.png', desc: 'When hope had run out, the community showed up in force.' },
        { title: 'Rent Covered', videoUrl: 'https://faithfightersamerica.com/video7.mp4', image: '/images/img-05.jpg', desc: 'A family kept their home when the rent came due.' },
        { title: 'Student Loans Paid Off', videoUrl: 'https://faithfightersamerica.com/video6.mp4', image: '/images/img-06.jpg', desc: 'A graduate set free from the weight of student debt.' },
      ],
    },
  ],
};
