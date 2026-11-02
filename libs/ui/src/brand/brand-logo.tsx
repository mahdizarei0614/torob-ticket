import { compactLoop as mark } from './compact-loop';
import wordmarks from './wordmarks.json';
import styles from './brand-logo.module.css';

export function BrandLogo({ language = 'fa', symbolOnly = false, decorative = false, className }: {
  language?: 'fa' | 'en';
  symbolOnly?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const wordmark = wordmarks[language];
  const [x, y, width, height] = wordmark.viewBox as [number, number, number, number];
  const wordWidth = width * 144 / height;
  const totalWidth = symbolOnly ? 256 : 256 + 34 + wordWidth;
  const markX = language === 'fa' && !symbolOnly ? wordWidth + 34 : 0;
  const wordX = language === 'fa' ? 0 : 290;
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${totalWidth} 256`}
    className={[styles.logo, symbolOnly ? styles.symbol : '', className].filter(Boolean).join(' ')}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : language === 'fa' ? 'ترب تیکت' : 'TorobTicket'}
    aria-hidden={decorative ? true : undefined} focusable="false" data-brand-logo={symbolOnly ? 'symbol' : language}>
    <g transform={`translate(${markX} 0)`}>
      <path className={styles.mark} d={mark.arch} />
      <path className={styles.mark} d={mark.route} />
      {mark.endpoints.map(cx => <path key={cx} className={styles.mark} fillRule="evenodd"
        d={`M${cx - mark.endpointRadius} ${mark.endpointY}a${mark.endpointRadius} ${mark.endpointRadius} 0 1 0 ${mark.endpointRadius * 2} 0a${mark.endpointRadius} ${mark.endpointRadius} 0 1 0 -${mark.endpointRadius * 2} 0M${cx - mark.holeRadius} ${mark.endpointY}a${mark.holeRadius} ${mark.holeRadius} 0 1 0 ${mark.holeRadius * 2} 0a${mark.holeRadius} ${mark.holeRadius} 0 1 0 -${mark.holeRadius * 2} 0`} />)}
      {mark.leaves.map(d => <path key={d} className={styles.leaf} d={d} data-brand-leaf="" />)}
    </g>
    {!symbolOnly && <g className={styles.wordmark} transform={`translate(${wordX} 56) scale(${144 / height}) translate(${-x} ${-y})`}>
      {wordmark.paths.map((path, index) => <path key={index} d={path.d} transform={'transform' in path && typeof path.transform === 'string' ? path.transform : undefined} />)}
    </g>}
  </svg>;
}
