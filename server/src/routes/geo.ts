/**
 * Geo-Location Routes
 *
 * GET  /api/geo/status  — Returns current server geo-location and restriction status
 * POST /api/geo/refresh — Forces a fresh geo-location detection
 *
 * Both routes are public (no auth required) so the client can always
 * display the geo-region chip.
 */

import { Router, Request, Response } from 'express';
import { geoLocationService } from '../services/geo/geoLocationService';

const router = Router();

// GET /api/geo/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const location = await geoLocationService.detectLocation();
    res.json({
      location: {
        country: location.country,
        countryCode: location.countryCode,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
        ip: location.ip,
        source: location.source,
      },
      isRestricted: location.isRestricted,
      detectedAt: location.detectedAt,
    });
  } catch (err: any) {
    console.error('[Geo] Status error:', err.message);
    res.status(500).json({ error: 'Failed to detect geo-location' });
  }
});

// POST /api/geo/refresh
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const location = await geoLocationService.refresh();
    res.json({
      location: {
        country: location.country,
        countryCode: location.countryCode,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
        ip: location.ip,
        source: location.source,
      },
      isRestricted: location.isRestricted,
      detectedAt: location.detectedAt,
    });
  } catch (err: any) {
    console.error('[Geo] Refresh error:', err.message);
    res.status(500).json({ error: 'Failed to refresh geo-location' });
  }
});

export default router;
