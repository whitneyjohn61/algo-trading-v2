/**
 * Client-side timezone utilities.
 * Transplanted from V1, trimmed to what is needed by the UserAvatar timezone selector.
 */

import { useTimezoneStore } from '@/store/timezoneStore';

/**
 * Get UTC offset string for a timezone (e.g. "+05:30", "-08:00")
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = localTime.getTime() - utcTime.getTime();
    const offsetHours = Math.floor(Math.abs(offsetMs) / (1000 * 60 * 60));
    const offsetMinutes = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));
    const sign = offsetMs >= 0 ? '+' : '-';
    return `${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
  } catch {
    return '+00:00';
  }
}

/**
 * Common timezone options for the selector dropdown.
 */
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'America/New_York', label: 'New York (EST/EDT)', offset: getTimezoneOffset('America/New_York') },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)', offset: getTimezoneOffset('America/Chicago') },
  { value: 'America/Denver', label: 'Denver (MST/MDT)', offset: getTimezoneOffset('America/Denver') },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: getTimezoneOffset('America/Los_Angeles') },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: getTimezoneOffset('Europe/London') },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: getTimezoneOffset('Europe/Paris') },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: getTimezoneOffset('Europe/Berlin') },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)', offset: getTimezoneOffset('Europe/Rome') },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: getTimezoneOffset('Asia/Tokyo') },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: getTimezoneOffset('Asia/Shanghai') },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: getTimezoneOffset('Asia/Hong_Kong') },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: getTimezoneOffset('Australia/Sydney') },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', offset: getTimezoneOffset('Pacific/Auckland') },
];

/**
 * Get all available timezones from Intl.supportedValuesOf.
 */
export function getAllTimezones() {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      const all = (Intl as unknown as { supportedValuesOf: (type: string) => string[] }).supportedValuesOf('timeZone');
      return all.map((tz: string) => ({
        value: tz,
        label: tz.replace(/_/g, ' '),
        offset: getTimezoneOffset(tz),
      }));
    }
    return COMMON_TIMEZONES;
  } catch {
    return COMMON_TIMEZONES;
  }
}

/**
 * Format a UTC date/timestamp in the user's selected timezone.
 */
export function formatDateTimeInTimezone(
  utcDate: Date | number | string,
  format?: string,
  timezone?: string,
): string {
  const { selectedTimezone } = useTimezoneStore.getState();
  const targetTimezone = timezone || selectedTimezone;

  if (!format) format = 'MM/dd/yy HH:mm:ss';

  if (utcDate === null || utcDate === undefined || utcDate === '') return 'Invalid Date';

  let dateObj: Date;
  if (utcDate instanceof Date) dateObj = utcDate;
  else if (typeof utcDate === 'string') dateObj = new Date(utcDate);
  else {
    const ts = (utcDate as number) > 1_000_000_000_000 ? (utcDate as number) : (utcDate as number) * 1000;
    dateObj = new Date(ts);
  }
  if (isNaN(dateObj.getTime())) return 'Invalid Date';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: targetTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const yearFull = parts.find(p => p.type === 'year')?.value || '0000';
  const year2 = yearFull.slice(-2);
  const month = parts.find(p => p.type === 'month')?.value || '00';
  const day = parts.find(p => p.type === 'day')?.value || '00';
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  const second = parts.find(p => p.type === 'second')?.value || '00';

  return format
    .replace(/YYYY/g, yearFull)
    .replace(/yyyy/g, yearFull)
    .replace(/dd/g, day)
    .replace(/MM/g, month)
    .replace(/yy/g, year2)
    .replace(/HH/g, hour)
    .replace(/mm/g, minute)
    .replace(/ss/g, second);
}
