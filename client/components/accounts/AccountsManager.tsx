'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, DollarSign, Key } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { AccountFormDialog } from './AccountFormDialog';

interface Account {
  id: number;
  user_id: number;
  username?: string;
  exchange: string;
  api_key: string | null;
  api_secret: string | null;
  current_balance: number;
  is_test: boolean;
  is_active: boolean;
  created_at: string;
}

export function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogAccount, setDialogAccount] = useState<Account | null | undefined>(undefined);
  const [loadingBalance, setLoadingBalance] = useState<number | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.accounts.list();
      if (res.data) {
        setAccounts(res.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this account?')) return;
    try {
      await api.accounts.delete(id);
      toast.success('Account deactivated');
      loadAccounts();
    } catch {
      toast.error('Failed to deactivate account');
    }
  };

  const handleFetchBalance = async (id: number) => {
    setLoadingBalance(id);
    try {
      const res = await api.accounts.getBalance(id);
      if (res.data) {
        toast.success(`Balance: $${res.data.totalBalance?.toFixed(2)}`);
        loadAccounts();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to fetch balance');
    } finally {
      setLoadingBalance(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Trading Accounts</h2>
        <div className="flex gap-2">
          <button onClick={loadAccounts} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setDialogAccount(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> New Account
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {accounts.length === 0 && !loading ? (
          <div className="p-8 text-center">
            <Key className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No trading accounts configured</p>
            <button
              onClick={() => setDialogAccount(null)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700"
            >
              Add your first account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">User</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Exchange</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Mode</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">API Key</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Balance</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{a.username || `#${a.user_id}`}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {a.exchange}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        a.is_test
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {a.is_test ? 'TEST' : 'LIVE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-500">
                      {a.api_key || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleFetchBalance(a.id)}
                        disabled={loadingBalance === a.id}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600"
                        title="Fetch live balance"
                      >
                        <DollarSign className={`w-3 h-3 ${loadingBalance === a.id ? 'animate-pulse' : ''}`} />
                        {Number(a.current_balance).toFixed(2)}
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-block w-2 h-2 rounded-full ${a.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDialogAccount(a)}
                          className="p-1.5 text-slate-400 hover:text-primary-500"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                          title="Deactivate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog */}
      {dialogAccount !== undefined && (
        <AccountFormDialog
          account={dialogAccount}
          onSave={() => { setDialogAccount(undefined); loadAccounts(); }}
          onClose={() => setDialogAccount(undefined)}
        />
      )}
    </div>
  );
}
