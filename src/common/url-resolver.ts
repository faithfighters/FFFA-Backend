export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL;
  if (url) {
    return url.split(',')[0].trim();
  }
  return 'https://stage-admin.faithfightersforamerica.com';
}
