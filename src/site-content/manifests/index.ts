import { PageManifest } from './types';
import { HOME_MANIFEST } from './home.manifest';
import { ABOUT_MANIFEST } from './about.manifest';

// Each page's manifest registers here. The admin page-picker and every
// GET/PATCH /site-content/:page route enumerate pages from this map only —
// adding a new page never requires touching the controller or service.
export const PAGE_MANIFESTS: Record<string, PageManifest> = {
  home: HOME_MANIFEST,
  about: ABOUT_MANIFEST,
};
