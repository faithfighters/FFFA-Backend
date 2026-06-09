export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL;
  if (!url) throw new Error('FRONTEND_URL environment variable must be set.');
  return url.split(',')[0].trim();
}
