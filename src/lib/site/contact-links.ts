/** Opens the Maps app on phones, Google Maps in a tab on laptops. */
export function mapsDirectionsUrl(destination: string): string | null {
  const d = destination.trim();
  return d ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}` : null;
}

/** tel: link, or null when the text is not a plausible phone number. */
export function telHref(phone: string): string | null {
  const first = phone.split(/[/,;\n]|\sor\s/i)[0].trim();
  const digits = first.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return null;
  return `tel:${first.startsWith('+') ? '+' : ''}${digits}`;
}
