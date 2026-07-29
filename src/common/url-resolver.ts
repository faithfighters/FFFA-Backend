export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL || 'https://stage.faithfightersforamerica.com';
  return url.split(',')[0].trim();
}
