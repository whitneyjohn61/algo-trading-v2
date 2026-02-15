/**
 * Geo-Location Service
 *
 * Detects server location via IP geolocation APIs and determines
 * whether the current region is restricted for exchange API access.
 *
 * Transplanted from V1 and cleaned up:
 *  - Uses ip-api.com (free, no key) as primary, ipapi.co as fallback
 *  - Maintains restricted countries list
 *  - Caches result for 5 minutes
 *  - No browser-side geo logic
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  timezone: string;
  ip: string;
  isRestricted: boolean;
  detectedAt: string;
  source: string;
}

// Countries where Bybit (and most crypto exchanges) restrict access
const RESTRICTED_COUNTRY_CODES = new Set([
  'US',  // United States
  'CN',  // China
  'KP',  // North Korea
  'IR',  // Iran
  'SY',  // Syria
  'CU',  // Cuba
  'VE',  // Venezuela
  'RU',  // Russia
  'BY',  // Belarus
  'AF',  // Afghanistan
  'MM',  // Myanmar
  'SD',  // Sudan
  'CA',  // Canada
  'GB',  // United Kingdom
  'NL',  // Netherlands
  'BE',  // Belgium
]);

class GeoLocationService {
  private cache: GeoLocation | null = null;
  private cacheTime = 0;
  private detecting = false;

  /**
   * Detect current server location. Returns cached result if fresh.
   */
  async detectLocation(): Promise<GeoLocation> {
    // Return cached if fresh
    if (this.cache && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      return this.cache;
    }

    // Prevent concurrent detections
    if (this.detecting && this.cache) {
      return this.cache;
    }

    this.detecting = true;

    try {
      // Try primary: ip-api.com (free, no key, 45 req/min)
      const result = await this.tryIpApi() || await this.tryIpapiCo();

      if (result) {
        result.isRestricted = RESTRICTED_COUNTRY_CODES.has(result.countryCode);
        result.detectedAt = new Date().toISOString();
        this.cache = result;
        this.cacheTime = Date.now();
      } else {
        // Fallback: unknown location, assume safe
        this.cache = {
          country: 'Unknown',
          countryCode: 'XX',
          region: 'Unknown',
          city: 'Unknown',
          timezone: 'UTC',
          ip: '',
          isRestricted: false,
          detectedAt: new Date().toISOString(),
          source: 'fallback',
        };
        this.cacheTime = Date.now();
      }

      return this.cache;
    } finally {
      this.detecting = false;
    }
  }

  /**
   * Whether current location is restricted for exchange API access.
   */
  isRestricted(): boolean {
    return this.cache?.isRestricted ?? false;
  }

  /**
   * Get cached location (may be null if not yet detected).
   */
  getLocation(): GeoLocation | null {
    return this.cache;
  }

  /**
   * Force a fresh detection (clears cache).
   */
  async refresh(): Promise<GeoLocation> {
    this.cache = null;
    this.cacheTime = 0;
    return this.detectLocation();
  }

  // ── Private: API providers ──

  private async tryIpApi(): Promise<GeoLocation | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,timezone,query', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, string>;
      if (data['status'] !== 'success') return null;

      return {
        country: data['country'] || 'Unknown',
        countryCode: data['countryCode'] || 'XX',
        region: data['regionName'] || '',
        city: data['city'] || '',
        timezone: data['timezone'] || 'UTC',
        ip: data['query'] || '',
        isRestricted: false,
        detectedAt: '',
        source: 'ip-api.com',
      };
    } catch {
      return null;
    }
  }

  private async tryIpapiCo(): Promise<GeoLocation | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, string>;
      if (data['error']) return null;

      return {
        country: data['country_name'] || 'Unknown',
        countryCode: data['country_code'] || 'XX',
        region: data['region'] || '',
        city: data['city'] || '',
        timezone: data['timezone'] || 'UTC',
        ip: data['ip'] || '',
        isRestricted: false,
        detectedAt: '',
        source: 'ipapi.co',
      };
    } catch {
      return null;
    }
  }
}

export const geoLocationService = new GeoLocationService();
export default geoLocationService;
