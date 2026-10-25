/** Opaque identifiers remain distinct even when language collation considers them equivalent. */
export function compareHotelKeys(a: string, b: string): number {
    return a.localeCompare(b, 'en') || (a < b ? -1 : a > b ? 1 : 0);
}
