import { PageManifest } from './types';
import { HOME_MANIFEST } from './home.manifest';
import { ABOUT_MANIFEST } from './about.manifest';
import { STORIES_MANIFEST } from './stories.manifest';
import { CAMPAIGNS_MANIFEST } from './campaigns.manifest';
import { STORE_MANIFEST } from './store.manifest';
import { VOLUNTEER_MANIFEST } from './volunteer.manifest';
import { CONTACT_MANIFEST } from './contact.manifest';
import { DONATION_MANIFEST } from './donation.manifest';
import { LOGIN_MANIFEST } from './login.manifest';
import { REGISTER_MANIFEST } from './register.manifest';

// Each page's manifest registers here. The admin page-picker and every
// GET/PATCH /site-content/:page route enumerate pages from this map only —
// adding a new page never requires touching the controller or service.
export const PAGE_MANIFESTS: Record<string, PageManifest> = {
  home: HOME_MANIFEST,
  about: ABOUT_MANIFEST,
  stories: STORIES_MANIFEST,
  campaigns: CAMPAIGNS_MANIFEST,
  store: STORE_MANIFEST,
  volunteer: VOLUNTEER_MANIFEST,
  contact: CONTACT_MANIFEST,
  donation: DONATION_MANIFEST,
  login: LOGIN_MANIFEST,
  register: REGISTER_MANIFEST,
};
