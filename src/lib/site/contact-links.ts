/** Opens the Maps app on phones, Google Maps in a tab on laptops. */
export function mapsDirectionsUrl(destination: string): string | null {
  const d = destination.trim();
  return d ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}` : null;
}

/** tel: link, or null when the text is not a plausible phone number. */
export function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.replace(/\D/g, '').length >= 6 ? `tel:${cleaned}` : null;
}
