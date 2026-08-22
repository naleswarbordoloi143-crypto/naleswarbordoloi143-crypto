import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/lib/types';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';
import { Bell, BellOff, Check, Trash } from 'lucide-react';

const TYPE_ICONS: Record<string, string> = {
  Weather: 'bg-blue-100 text-blue-600',
  Harvest: 'bg-accent-100 text-accent-600',
  Orders: 'bg-primary-100 text-primary-600',
  Machinery: 'bg-wheat-100 text-wheat-600',
  Buyer: 'bg-primary-100 text-primary-600',
  Payment: 'bg-success-100 text-success-600',
  Reward: 'bg-accent-100 text-accent-600',
  Reminder: 'bg-warning-100 text-warning-600',
  System: 'bg-stone-100 text-stone-500',
};

export default function NotificationsPage() {
  const { profile, t } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      let query = supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(100);
      if (filter === 'unread') query = query.eq('is_read', false);
      const { data, error: e } = await query;
      if (e) throw e;
      setNotifications((data as AppNotification[]) ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [profile, filter]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Notifications</h2><p className="text-sm text-stone-500">Stay updated on your farm activities</p></div>
        <div className="flex gap-2">
          <button onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')} className="btn-secondary text-sm">{filter === 'all' ? 'Unread Only' : 'All'}</button>
          {notifications.some((n) => !n.is_read) && <button onClick={markAllRead} className="btn-ghost text-sm"><Check size={16} /> Mark all read</button>}
        </div>
      </div>
      {notifications.length === 0 ? (
        <div className="card-pad"><EmptyState icon={<BellOff size={32} />} title="No notifications" description="You'll see updates here as they come in" /></div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`card-pad flex items-start gap-3 ${!n.is_read ? 'border-primary-200 bg-primary-50/30' : ''}`}>
              <div className={`p-2 rounded-xl flex-shrink-0 ${TYPE_ICONS[n.type] || TYPE_ICONS.System}`}><Bell size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-stone-800">{n.title}</p>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                </div>
                <p className="text-sm text-stone-500 mt-0.5">{n.body}</p>
                <p className="text-xs text-stone-400 mt-1">{timeAgo(n.created_at)} · {n.type}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!n.is_read && <button onClick={() => markRead(n.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-primary-600"><Check size={16} /></button>}
                <button onClick={() => deleteNotification(n.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-error-500"><Trash size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
