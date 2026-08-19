import { PageManifest } from './types';

export const MEDIA_MANIFEST: PageManifest = {
  page: 'media',
  label: 'Media',
  fields: [
    { key: 'heroTitle', label: 'Page title', type: 'text', section: 'Page', defaultValue: 'Media' },
    { key: 'featuredEyebrow', label: 'Featured section eyebrow', type: 'text', section: 'Page', defaultValue: 'Featured' },
    { key: 'featuredTitle', label: 'Featured section title', type: 'text', section: 'Page', defaultValue: 'Latest From Our Community' },
    { key: 'emptyStateText', label: 'Empty state text (no videos yet)', type: 'text', section: 'Page', defaultValue: 'No videos yet. Be the first to submit a story!' },
    { key: 'galleryEyebrow', label: 'Gallery section eyebrow', type: 'text', section: 'Page', defaultValue: 'All Videos' },
    { key: 'galleryTitle', label: 'Gallery section title', type: 'text', section: 'Page', defaultValue: 'Stories of Impact' },
  ],
};
