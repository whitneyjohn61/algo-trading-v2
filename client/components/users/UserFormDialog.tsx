'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface UserData {
  id?: number;
  username: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  timezone?: string;
}

interface Props {
  user?: UserData | null;
  onSave: () => void;
  onClose: () => void;
}

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

export function UserFormDialog({ user, onSave, onClose }: Props) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'user');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Load full user data for editing
  useEffect(() => {
    if (user?.id) {
      (async () => {
        try {
          const res = await api.users.get(user.id!);
          if (res.data) {
            setUsername(res.data.username || '');
            setEmail(res.data.email || '');
            setRole(res.data.role || 'user');
            setFirstName(res.data.first_name || '');
            setLastName(res.data.last_name || '');
            setPhone(res.data.phone || '');
            setTimezone(res.data.timezone || 'UTC');
          }
        } catch { /* ignore */ }
      })();
    }
  }, [user?.id]);

  const handleSave = async () => {
    if (!username || !email) {
      toast.error('Username and email are required');
      return;
    }

    setSaving(true);
    try {
      if (user?.id) {
        // Update
        await api.users.update(user.id, {
          username, email, role,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          phone: phone || undefined,
          timezone,
        });
        toast.success('User updated');
      } else {
        // Create
        if (!password || password.length < 8) {
          toast.error('Password must be at least 8 characters');
          setSaving(false);
          return;
        }
        await api.users.create({
          username, email, password, role,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          phone: phone || undefined,
          timezone,
        });
        toast.success('User created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {user?.id ? 'Edit User' : 'New User'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Username *</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {!user?.id && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                placeholder="Min 8 characters"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                placeholder="e.g. America/New_York"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !username || !email}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
