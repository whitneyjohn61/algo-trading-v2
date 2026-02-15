/**
 * Geo-Block Middleware
 *
 * Blocks exchange-related API calls when the server is running
 * from a restricted region. Applied to exchange-facing routes
 * (trading, market, etc.) — NOT to auth, system, or geo status routes.
 */

import { Request, Response, NextFunction } from 'express';
import { geoLocationService } from '../services/geo/geoLocationService';

export const geoBlock = (_req: Request, res: Response, next: NextFunction): void => {
  if (geoLocationService.isRestricted()) {
    const location = geoLocationService.getLocation();
    res.status(403).json({
      error: 'Exchange API access is restricted from this region',
      country: location?.country ?? 'Unknown',
      countryCode: location?.countryCode ?? 'XX',
      message: `Exchange operations are not available from ${location?.country ?? 'your region'}. Please ensure the server is running from a non-restricted location.`,
    });
    return;
  }
  next();
};
