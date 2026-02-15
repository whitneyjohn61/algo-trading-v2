'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Lock, UserX, Users } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { UserFormDialog } from './UserFormDialog';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { useAuthStore } from '@/store/authStore';

interface UserRow {
  id: number;
  username: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  timezone: string;
  is_active: boolean;
  avatar_path?: string;
  last_login?: string;
  created_at: string;
}

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogUser, setDialogUser] = useState<UserRow | null | undefined>(undefined);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const currentUser = useAuthStore(s => s.user);
  const isAdmin = currentUser?.role === 'admin';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.users.list({ includeInactive: isAdmin });
      if (res.data) {
        setUsers(res.data.users || []);
        setTotal(res.data.total || 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await api.users.deactivate(id);
      toast.success('User deactivated');
      loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to deactivate');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this user? This cannot be undone.')) return;
    try {
      await api.users.delete(id);
      toast.success('User deleted');
      loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Users ({total})</h2>
        <div className="flex gap-2">
          <button onClick={loadUsers} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setDialogUser(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" /> New User
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {users.length === 0 && !loading ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">User</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Timezone</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Last Login</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {u.avatar_path ? (
                          <img src={u.avatar_path} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-medium text-slate-500 dark:text-slate-400">
                            {(u.username || '?')[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-700 dark:text-slate-300">{u.username}</div>
                          {(u.first_name || u.last_name) && (
                            <div className="text-xs text-slate-500 dark:text-slate-500">{[u.first_name, u.last_name].filter(Boolean).join(' ')}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-500">{u.timezone}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs ${u.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-500">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDialogUser(u)}
                          className="p-1.5 text-slate-400 hover:text-primary-500"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPasswordUser(u)}
                          className="p-1.5 text-slate-400 hover:text-amber-500"
                          title="Change password"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && u.id !== currentUser?.id && (
                          <>
                            <button
                              onClick={() => handleDeactivate(u.id)}
                              className="p-1.5 text-slate-400 hover:text-orange-500"
                              title="Deactivate"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {dialogUser !== undefined && (
        <UserFormDialog
          user={dialogUser}
          onSave={() => { setDialogUser(undefined); loadUsers(); }}
          onClose={() => setDialogUser(undefined)}
        />
      )}

      {passwordUser && (
        <ChangePasswordDialog
          userId={passwordUser.id}
          username={passwordUser.username}
          onClose={() => setPasswordUser(null)}
        />
      )}
    </div>
  );
}
