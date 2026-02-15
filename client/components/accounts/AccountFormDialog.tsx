'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface AccountData {
  id?: number;
  user_id?: number;
  exchange: string;
  api_key: string | null;
  api_secret: string | null;
  is_test: boolean;
}

interface Props {
  account?: AccountData | null;
  onSave: () => void;
  onClose: () => void;
}

export function AccountFormDialog({ account, onSave, onClose }: Props) {
  const [exchange, setExchange] = useState(account?.exchange || 'bybit');
  const [apiKey, setApiKey] = useState(account?.api_key || '');
  const [apiSecret, setApiSecret] = useState(account?.api_secret || '');
  const [isTest, setIsTest] = useState(account?.is_test ?? true);
  const [showSecret, setShowSecret] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // Load full account data for editing
  useEffect(() => {
    if (account?.id) {
      (async () => {
        try {
          const res = await api.accounts.get(account.id!);
          if (res.data) {
            setExchange(res.data.exchange || 'bybit');
            setApiKey(res.data.api_key || '');
            setApiSecret(res.data.api_secret || '');
            setIsTest(res.data.is_test ?? true);
          }
        } catch { /* ignore */ }
      })();
    }
  }, [account?.id]);

  const handleVerify = async () => {
    if (!apiKey || !apiSecret) {
      toast.error('API key and secret are required');
      return;
    }
    setVerifying(true);
    setVerified(null);
    try {
      const res = await api.accounts.verify({ exchange, api_key: apiKey, api_secret: apiSecret, is_test: isTest });
      if (res.data?.valid) {
        setVerified(true);
        toast.success(`Verified! Balance: $${res.data.totalBalance?.toFixed(2)}`);
      } else {
        setVerified(false);
        toast.error(res.data?.error || 'Verification failed');
      }
    } catch {
      setVerified(false);
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      toast.error('API key and secret are required');
      return;
    }
    setSaving(true);
    try {
      if (account?.id) {
        await api.accounts.update(account.id, { exchange, api_key: apiKey, api_secret: apiSecret, is_test: isTest });
        toast.success('Account updated');
      } else {
        await api.accounts.create({ exchange, api_key: apiKey, api_secret: apiSecret, is_test: isTest });
        toast.success('Account created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {account?.id ? 'Edit Account' : 'New Trading Account'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Exchange */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Exchange</label>
            <select
              value={exchange}
              onChange={e => setExchange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
            >
              <option value="bybit">Bybit</option>
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsTest(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isTest
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                }`}
              >
                Testnet
              </button>
              <button
                type="button"
                onClick={() => setIsTest(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !isTest
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                }`}
              >
                Mainnet (LIVE)
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setVerified(null); }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
              placeholder="Enter API key"
            />
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">API Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={e => { setApiSecret(e.target.value); setVerified(null); }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 pr-10 text-sm text-slate-900 dark:text-white font-mono"
                placeholder="Enter API secret"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Verification status */}
          {verified !== null && (
            <div className={`flex items-center gap-2 text-xs ${verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {verified ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {verified ? 'Credentials verified' : 'Verification failed'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleVerify}
            disabled={verifying || !apiKey || !apiSecret}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify Keys'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey || !apiSecret}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
