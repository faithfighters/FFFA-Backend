import { PageManifest } from './types';

export const STORIES_MANIFEST: PageManifest = {
  page: 'stories',
  label: 'Stories',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Stories & Media' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'Stories of Impact' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: 'Real testimonies from the neighborhoods, families, and first responders your generosity reaches.',
    },

    // ── Featured Film ──
    { key: 'featuredVideoUrl', label: 'Video file', type: 'video', section: 'Featured Film', defaultValue: 'https://faithfightersamerica.com/video13.mp4' },
    { key: 'featuredVideoPoster', label: 'Poster image', type: 'image', section: 'Featured Film', defaultValue: '/images/video-thumbnail.png' },
    { key: 'featuredCaption', label: 'Caption', type: 'text', section: 'Featured Film', defaultValue: 'Our Story · A Nation United · 1:53' },

    // ── Testimonials ──
    { key: 'testimonialsEyebrow', label: 'Eyebrow', type: 'text', section: 'Testimonials', defaultValue: 'Testimonials' },
    { key: 'testimonialsTitle', label: 'Title', type: 'text', section: 'Testimonials', defaultValue: 'Real families. Real outcomes.' },
    { key: 'testimonialsSubtitle', label: 'Subtitle', type: 'text', section: 'Testimonials', defaultValue: 'Tap any story to watch.' },
    {
      key: 'stories', label: 'Story videos', type: 'repeater', section: 'Testimonials', itemLabel: 'Story',
      helpText: 'Add, remove, or edit the video cards shown in the grid below.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'videoUrl', label: 'Video file', type: 'video', defaultValue: '' },
        { key: 'thumbnail', label: 'Thumbnail image', type: 'image', defaultValue: '' },
        { key: 'duration', label: 'Duration (e.g. 0:57)', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Bills Paid', videoUrl: 'https://faithfightersamerica.com/video8.mp4', thumbnail: '/images/img-01.jpg', duration: '0:57' },
        { title: 'Car Payment Paid', videoUrl: 'https://faithfightersamerica.com/video4.mp4', thumbnail: '/images/img-02.jpg', duration: '0:34' },
        { title: 'Hotel Stay Covered', videoUrl: 'https://faithfightersamerica.com/video5.mp4', thumbnail: '/images/img-03.jpg', duration: '1:12' },
        { title: 'Prayers Answered', videoUrl: 'https://faithfightersamerica.com/video11.mp4', thumbnail: '/images/img-05.png', duration: '0:32' },
        { title: 'Rent Covered', videoUrl: 'https://faithfightersamerica.com/video7.mp4', thumbnail: '/images/img-05.jpg', duration: '0:27' },
        { title: 'Student Loans Paid Off', videoUrl: 'https://faithfightersamerica.com/video6.mp4', thumbnail: '/images/img-06.jpg', duration: '0:29' },
      ],
    },

    // ── Share Your Story ──
    { key: 'shareCardTitle', label: 'Title', type: 'text', section: 'Share Your Story', defaultValue: 'Your story can inspire someone today.' },
    {
      key: 'shareCardDescription', label: 'Description', type: 'textarea', section: 'Share Your Story',
      defaultValue: "Whether you've received help or want to share how giving back has impacted your life — your story matters.",
    },
    { key: 'shareBtnLabel', label: '"Share your story" button label', type: 'text', section: 'Share Your Story', defaultValue: 'Share your story' },
    {
      key: 'benefitLabelsCsv', label: 'Benefit labels (comma-separated)', type: 'text', section: 'Share Your Story',
      helpText: 'Shown as 4 small icons/labels — keep to 4 for the layout to look right',
      defaultValue: 'Inspire others, Encourage hope, Build community, Create change',
    },
    { key: 'noteText', label: 'Footer note', type: 'text', section: 'Share Your Story', defaultValue: 'Every submission is reviewed before being featured.' },
  ],
};
