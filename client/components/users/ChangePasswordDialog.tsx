'use client';

import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

interface Props {
  userId: number;
  username: string;
  onClose: () => void;
}

export function ChangePasswordDialog({ userId, username, onClose }: Props) {
  const currentUser = useAuthStore(s => s.user);
  const isChangingOwn = currentUser?.id === userId;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.users.changePassword(userId, {
        currentPassword: isChangingOwn ? currentPassword : undefined,
        newPassword,
      });
      toast.success('Password changed');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4" /> Change Password
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changing password for <span className="font-medium text-slate-700 dark:text-slate-300">{username}</span>
          </p>

          {isChangingOwn && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || newPassword.length < 8}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
