import { PageManifest } from './types';

export const STORE_MANIFEST: PageManifest = {
  page: 'store',
  label: 'Store',
  fields: [
    // ── Hero ──
    { key: 'heroEyebrow', label: 'Eyebrow', type: 'text', section: 'Hero', defaultValue: 'Official Store' },
    { key: 'heroTitle', label: 'Title', type: 'text', section: 'Hero', defaultValue: 'Wear the Mission' },
    {
      key: 'heroLead', label: 'Paragraph', type: 'textarea', section: 'Hero',
      defaultValue: "Every purchase funds faith-driven initiatives that uplift communities and strengthen America's spirit.",
    },

    // ── Product Grid ──
    { key: 'productsEyebrow', label: 'Eyebrow', type: 'text', section: 'Product Grid', defaultValue: 'Shop the Collection' },
    { key: 'productsTitle', label: 'Title', type: 'text', section: 'Product Grid', defaultValue: 'Wear your faith' },
    { key: 'productsSubtitle', label: 'Subtitle', type: 'text', section: 'Product Grid', defaultValue: 'Tap a product to shop it directly.' },
    {
      key: 'products', label: 'Products', type: 'repeater', section: 'Product Grid', itemLabel: 'Product',
      helpText: 'Add, remove, or edit the products shown in the grid.',
      itemFields: [
        { key: 'name', label: 'Name', type: 'text', defaultValue: '' },
        { key: 'price', label: 'Price (numbers only, e.g. 30)', type: 'text', defaultValue: '' },
        { key: 'image', label: 'Image', type: 'image', defaultValue: '' },
        { key: 'url', label: 'Shop link URL', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { name: "Men's Faith Tee", price: '30', image: '/images/serve-img.jpg', url: 'https://shop.faithfightersforamerica.com/products/wake-up-with-faith-mens-shirts' },
        { name: "Women's Faith Tank", price: '25', image: '/images/serve-img-2.jpg', url: 'https://shop.faithfightersforamerica.com/products/wake-up-with-faith-female-tanktops' },
        { name: 'Faith Fighters Hat', price: '25', image: '/images/serve-img-3.jpg', url: 'https://shop.faithfightersforamerica.com/products/wake-up-with-faith-hats' },
        { name: 'Wake Up With Faith Coffee', price: '25', image: '/images/serve-img-4.jpg', url: 'https://shop.faithfightersforamerica.com/products/wake-up-with-faith-cofee' },
      ],
    },
    { key: 'fullStoreBtnLabel', label: '"Visit the Full Store" button label', type: 'text', section: 'Product Grid', defaultValue: 'Visit the Full Store' },

    // ── Benefit Rows ──
    {
      key: 'benefits', label: 'Benefit rows', type: 'repeater', section: 'Benefit Rows', itemLabel: 'Benefit',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text', defaultValue: '' },
        { key: 'text', label: 'Description', type: 'text', defaultValue: '' },
      ],
      defaultValue: [
        { title: 'Ships to all 50 states', text: 'Fast, tracked delivery nationwide.' },
        { title: 'Funds the mission', text: 'Proceeds support faith-driven missions.' },
      ],
    },
  ],
};
