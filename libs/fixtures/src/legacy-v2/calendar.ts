import { parseDate, parseZonedDateTime } from '@internationalized/date';
export function addDays(date:string,days:number):string { return parseDate(date).add({days}).toString(); }
export function atLocalHour(date:string,hour:number,zone:string):string { return parseZonedDateTime(`${date}T${String(hour).padStart(2,'0')}:00[${zone}]`).toAbsoluteString(); }
export function dayOffset(date:string,anchor:string):number { return parseDate(date).compare(parseDate(anchor)); }
