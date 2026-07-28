/**
 * The canonical public origin, in one place.
 *
 * This changed once already: the site used to be motorsurveyos.web.app on the
 * US project. Freeing that name to move it to the India project triggered a
 * Firebase reservation that makes it unclaimable, so the canonical origin is
 * now motorsurveyos-in.web.app. Every canonical URL, Open Graph tag, JSON-LD
 * block and the sitemap pointed at the dead name and had to be corrected by
 * hand — hence this constant.
 *
 * If the origin changes again (custom domain, or motorsurveyos.web.app is
 * ever released), change it HERE and in public/robots.txt, which is a static
 * file and cannot import this.
 */
export const SITE_URL = 'https://motorsurveyos-in.web.app';
