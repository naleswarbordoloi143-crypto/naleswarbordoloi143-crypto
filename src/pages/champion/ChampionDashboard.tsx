import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Users, Sprout, ShoppingBag, Tractor, Wheat, IndianRupee, Award, Megaphone, ShieldCheck, ArrowRight } from 'lucide-react';

export default function ChampionDashboard() {
  const { profile, t } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ farmers: 0, acres: 0, bulkOrders: 0, machinery: 0, harvests: 0, buyers: 0, savings: 0, clusters: 0 });
  const [farmers, setFarmers] = useState<any[]>([]);
  const [bulkOrders, setBulkOrders] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const [farmersRes, farmsRes, bulkRes, machRes, harvRes, buyersRes, clustersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'farmer'),
        supabase.from('farms').select('size_acres'),
        supabase.from('bulk_orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('machinery').select('*'),
        supabase.from('harvests').select('*'),
        supabase.from('profiles').select('*').eq('role', 'buyer'),
        supabase.from('farm_clusters').select('*'),
      ]);
      const farmersList = farmersRes.data ?? [];
      setFarmers(farmersList);
      const totalAcres = (farmsRes.data ?? []).reduce((s: number, f: any) => s + Number(f.size_acres || 0), 0);
      const savings = (bulkRes.data ?? []).reduce((s: number, o: any) => {
        const committed = Number(o.target_quantity) || 0;
        const perUnitBulk = Number(o.target_quantity) > 0 ? Number(o.estimated_bulk_price) / Number(o.target_quantity) : 0;
        const perUnitIndiv = Number(o.target_quantity) > 0 ? Number(o.individual_price) / Number(o.target_quantity) : 0;
        return s + (perUnitIndiv - perUnitBulk) * committed;
      }, 0);
      setStats({
        farmers: farmersList.length, acres: totalAcres, bulkOrders: (bulkRes.data ?? []).length,
        machinery: (machRes.data ?? []).length, harvests: (harvRes.data ?? []).length,
        buyers: (buyersRes.data ?? []).length, savings: Math.max(0, savings), clusters: (clustersRes.data ?? []).length,
      });
      setBulkOrders(bulkRes.data ?? []);
      const { data: annRes } = await supabase.from('chat_messages').select('*, chat_groups!inner(name)').eq('type', 'announcement').order('created_at', { ascending: false }).limit(5);
      setAnnouncements(annRes ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const postAnnouncement = async () => {
    if (!profile || !announcement.trim()) return;
    let groupId: string | null = null;
    const groupName = `${profile.village || 'Village'} Announcements`;
    const { data: group } = await supabase.from('chat_groups').select('id').eq('name', groupName).maybeSingle();
    if (group) groupId = group.id;
    else {
      const { data: newGroup } = await supabase.from('chat_groups').insert({ name: groupName, description: 'Important updates from your champion', created_by: profile.id }).select().single();
      groupId = newGroup?.id ?? null;
    }
    if (groupId) {
      await supabase.from('chat_messages').insert({ group_id: groupId, user_id: profile.id, type: 'announcement', content: announcement.trim() });
    }
    setAnnouncement(''); fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  // Block unverified champions from accessing champion features
  if (!profile?.champion_verified && profile?.champion_verification_status !== 'pending') {
    return (
      <div className="space-y-6 animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
        <div className="card-pad max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={40} className="text-accent-600" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">{t('championBlocked')}</h2>
          <p className="text-sm text-stone-500 mb-6">{t('championCertRequiredDesc')}</p>
          <a href="#/profile" className="btn-primary inline-flex items-center gap-2">
            {t('goToProfile')} <ArrowRight size={18} />
          </a>
        </div>
      </div>
    );
  }

  // Show pending state
  if (profile?.champion_verification_status === 'pending' && !profile?.champion_verified) {
    return (
      <div className="space-y-6 animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
        <div className="card-pad max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={40} className="text-accent-600" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">{t('championCertPending')}</h2>
          <p className="text-sm text-stone-500 mb-6">{t('championCertDesc')}</p>
          <a href="#/profile" className="btn-secondary inline-flex items-center gap-2">
            {t('goToProfile')} <ArrowRight size={18} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-md">
        <h1 className="text-2xl font-bold">Welcome, {profile?.full_name}</h1>
        <p className="text-primary-100 mt-1 flex items-center gap-2">
          Village Champion · {profile?.village || 'Your Village'}
          {profile?.champion_verified && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-xs font-semibold">Verified</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Farmers" value={stats.farmers} icon={<Users size={22} />} color="primary" />
        <StatCard label="Total Acres" value={stats.acres} icon={<Sprout size={22} />} color="success" />
        <StatCard label="Bulk Orders" value={stats.bulkOrders} icon={<ShoppingBag size={22} />} color="accent" />
        <StatCard label="Machinery" value={stats.machinery} icon={<Tractor size={22} />} color="wheat" />
        <StatCard label="Harvests" value={stats.harvests} icon={<Wheat size={22} />} color="accent" />
        <StatCard label="Buyers" value={stats.buyers} icon={<IndianRupee size={22} />} color="success" />
        <StatCard label="Clusters" value={stats.clusters} icon={<Users size={22} />} color="primary" />
        <StatCard label="Est. Savings" value={formatCurrency(stats.savings)} icon={<Award size={22} />} color="accent" />
      </div>

      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Megaphone size={20} className="text-accent-600" /> Post Announcement</h3>
        <div className="flex gap-2">
          <input className="input-field flex-1" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="Share an important update with farmers..." />
          <button onClick={postAnnouncement} disabled={!announcement.trim()} className="btn-primary">Post</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">Farmers in Your Area</h3>
          {farmers.length === 0 ? <EmptyState icon={<Users size={32} />} title="No farmers registered" className="py-6" />
          : <div className="space-y-2">{farmers.slice(0, 10).map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold">{f.full_name?.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-stone-700 truncate">{f.full_name}</p><p className="text-xs text-stone-400">{f.village || '—'}</p></div>
              {f.is_active && <span className="badge-primary">Active</span>}
            </div>
          ))}</div>}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">Recent Bulk Orders</h3>
          {bulkOrders.length === 0 ? <EmptyState icon={<ShoppingBag size={32} />} title="No bulk orders" className="py-6" />
          : <div className="space-y-2">{bulkOrders.map((o) => (
            <div key={o.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
              <div className="flex items-center justify-between"><p className="font-semibold text-sm text-stone-700">{o.title}</p><span className="badge-neutral">{o.status}</span></div>
              <p className="text-xs text-stone-400 mt-1">{o.item_name} · {formatDate(o.created_at)}</p>
            </div>
          ))}</div>}
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">Recent Announcements</h3>
          <div className="space-y-2">{announcements.map((a) => (
            <div key={a.id} className="p-3 rounded-xl bg-accent-50 border border-accent-200">
              <p className="text-sm text-stone-700">{a.content}</p>
              <p className="text-xs text-stone-400 mt-1">{a.chat_groups?.name} · {formatDate(a.created_at)}</p>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
