'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';

interface GeoData {
  location: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    timezone: string;
    ip: string;
    source: string;
  };
  isRestricted: boolean;
  detectedAt: string;
}

export function GeoLocationChip() {
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const fetchGeo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.geo.getStatus();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to detect location');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeo();
  }, [fetchGeo]);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowDetails(false);
        setIsInteracting(false);
      }
    };
    if (showDetails) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetails]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const result = await api.geo.refresh();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  // Status dot color
  const getDotColor = () => {
    if (loading) return 'bg-slate-400 animate-pulse';
    if (error || !data) return 'bg-danger-500';
    if (data.isRestricted) return 'bg-danger-500';
    return 'bg-success-500';
  };

  // Chip text
  const getChipText = () => {
    if (loading) return 'Detecting...';
    if (error || !data) return 'Geo Error';
    const loc = data.location;
    return `${loc.city || loc.region || loc.country}`;
  };

  return (
    <div
      className="relative"
      ref={popupRef}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => {
        if (!isInteracting) setShowDetails(false);
      }}
    >
      {/* Chip */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Server geo-location"
      >
        <span className={`w-2 h-2 rounded-full ${getDotColor()}`} />
        <span className="hidden sm:inline">{getChipText()}</span>
        {data?.isRestricted && (
          <span className="text-[10px] bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 px-1 py-0.5 rounded font-bold">
            BLOCKED
          </span>
        )}
      </button>

      {/* Detail Popup */}
      {showDetails && (
        <div
          className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-3"
          onMouseEnter={() => {
            setShowDetails(true);
            setIsInteracting(true);
          }}
          onMouseLeave={() => {
            setIsInteracting(false);
            setShowDetails(false);
          }}
        >
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Server Location</h4>
              <button
                onClick={handleRefresh}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 text-xs font-medium disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {data && (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Country:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {data.location.country} ({data.location.countryCode})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Region:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{data.location.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">City:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{data.location.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Timezone:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{data.location.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">IP:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">{data.location.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Source:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{data.location.source}</span>
                </div>
              </div>
            )}

            {/* Restriction Warning */}
            {data?.isRestricted && (
              <div className="mt-2 p-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded text-xs">
                <p className="font-semibold text-danger-800 dark:text-danger-200">Restricted Region</p>
                <p className="text-danger-700 dark:text-danger-300 mt-0.5">
                  Exchange API calls are blocked. Ensure the server is running from a non-restricted region.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-2 p-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded text-xs">
                <p className="font-semibold text-danger-800 dark:text-danger-200">Detection Error</p>
                <p className="text-danger-700 dark:text-danger-300 mt-0.5">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Server IP-based detection. Refreshes every 5 min.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
