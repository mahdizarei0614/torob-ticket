import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Static head colors are compiled from the same semantic export palette as icons. */
export function brandMetadata(admin = false): Plugin {
  return {
    name: 'torobticket-brand-metadata',
    transformIndexHtml(html) {
      const { palette } = JSON.parse(readFileSync(new URL('../assets/brand/asset-manifest.json', import.meta.url), 'utf8')) as { palette: { light: string; dark: string; primary: string } };
      const origin = process.env.TOROBTICKET_PUBLIC_ORIGIN;
      let publicOrigin: URL | undefined;
      if (origin) {
        publicOrigin = new URL(origin);
        if (!['https:', 'http:'].includes(publicOrigin.protocol) || publicOrigin.username || publicOrigin.password || publicOrigin.search || publicOrigin.hash || publicOrigin.pathname !== '/') throw new Error('TOROBTICKET_PUBLIC_ORIGIN must be an HTTP(S) origin without a path or credentials');
      }
      const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
      const social = admin ? '' : `
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TorobTicket" />
        <meta property="og:locale" content="fa_IR" />
        <meta property="og:title" content="ترب تیکت" />
        <meta property="og:description" content="مقایسه بلیت پرواز، قطار و اتوبوس و اقامتگاه سفر." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ترب تیکت" />
        <meta name="twitter:description" content="مقایسه بلیت پرواز، قطار و اتوبوس و اقامتگاه سفر." />
        ${publicOrigin ? `<meta property="og:url" content="${escape(publicOrigin.href)}" />
        <meta property="og:image" content="${escape(new URL('brand/social-light.png', publicOrigin).href)}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="نشان ترب تیکت" />
        <meta name="twitter:image" content="${escape(new URL('brand/social-light.png', publicOrigin).href)}" />
        <meta name="twitter:image:alt" content="نشان ترب تیکت" />` : ''}`;
      return html.replace('content="" data-brand-theme-color', `content="${palette.light}" data-brand-theme-color data-light-color="${palette.light}" data-dark-color="${palette.dark}"`)
        .replace('rel="mask-icon"', `color="${palette.primary}" rel="mask-icon"`)
        .replace('</head>', social + '\n</head>');
    },
  };
}
