import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { AppNotification } from '@/lib/types';

export function useNotificationCount() {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session?.user) { setCount(0); return; }
    let active = true;
    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);
      if (!active) return;
      if (!error) setCount(c ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, fetchCount)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [session?.user]);

  return count;
}

export function useNotifications() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setNotifications(data as AppNotification[]);
    setLoading(false);
  }, [session?.user]);

  useEffect(() => { fetch(); }, [fetch]);
  return { notifications, loading, refetch: fetch };
}

export function useRewards() {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('reward_transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!error) setTransactions(data ?? []);
    setLoading(false);
  }, [session?.user]);

  useEffect(() => { fetch(); }, [fetch]);
  return { transactions, loading, refetch: fetch };
}

export function addRewardPoints(userId: string, points: number, reason: string) {
  return supabase.from('reward_transactions').insert({
    user_id: userId, points, reason, type: 'EARNED',
  });
}

export function createNotification(userId: string, type: string, title: string, body: string, link = '') {
  return supabase.from('notifications').insert({
    user_id: userId, type, title, body, link,
  });
}
