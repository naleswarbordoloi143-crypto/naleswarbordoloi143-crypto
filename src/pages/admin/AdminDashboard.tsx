import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { Users, Sprout, ShoppingBag, Tractor, Wheat, IndianRupee, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ users: 0, farmers: 0, champions: 0, buyers: 0, farms: 0, acres: 0, bulkOrders: 0, machinery: 0, harvests: 0, clusters: 0, complaints: 0, activeUsers: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [tab, setTab] = useState<'users' | 'complaints'>('users');

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const [usersRes, farmsRes, bulkRes, machRes, harvRes, clustersRes, complaintsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('farms').select('size_acres'),
        supabase.from('bulk_orders').select('*'),
        supabase.from('machinery').select('*'),
        supabase.from('harvests').select('*'),
        supabase.from('farm_clusters').select('*'),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      const allUsers = usersRes.data ?? [];
      setUsers(allUsers);
      setComplaints(complaintsRes.data ?? []);
      const totalAcres = (farmsRes.data ?? []).reduce((s: number, f: any) => s + Number(f.size_acres || 0), 0);
      setStats({
        users: allUsers.length,
        farmers: allUsers.filter((u) => u.role === 'farmer').length,
        champions: allUsers.filter((u) => u.role === 'champion').length,
        buyers: allUsers.filter((u) => u.role === 'buyer').length,
        farms: (farmsRes.data ?? []).length,
        acres: totalAcres,
        bulkOrders: (bulkRes.data ?? []).length,
        machinery: (machRes.data ?? []).length,
        harvests: (harvRes.data ?? []).length,
        clusters: (clustersRes.data ?? []).length,
        complaints: (complaintsRes.data ?? []).length,
        activeUsers: allUsers.filter((u) => u.is_active).length,
      });
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    await supabase.from('profiles').update({ is_active: !currentActive, updated_at: new Date().toISOString() }).eq('id', userId);
    fetchData();
  };

  const updateComplaintStatus = async (complaintId: string, status: string) => {
    await supabase.from('complaints').update({ status }).eq('id', complaintId);
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl">
            <Shield size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-stone-300 mt-0.5">{profile?.full_name} · Platform Administrator</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.users} icon={<Users size={22} />} color="primary" />
        <StatCard label="Active Users" value={stats.activeUsers} icon={<CheckCircle size={22} />} color="success" />
        <StatCard label="Farmers" value={stats.farmers} icon={<Sprout size={22} />} color="success" />
        <StatCard label="Champions" value={stats.champions} icon={<Shield size={22} />} color="accent" />
        <StatCard label="Buyers" value={stats.buyers} icon={<IndianRupee size={22} />} color="primary" />
        <StatCard label="Total Acres" value={stats.acres} icon={<Sprout size={22} />} color="success" />
        <StatCard label="Bulk Orders" value={stats.bulkOrders} icon={<ShoppingBag size={22} />} color="accent" />
        <StatCard label="Machinery" value={stats.machinery} icon={<Tractor size={22} />} color="wheat" />
        <StatCard label="Harvests" value={stats.harvests} icon={<Wheat size={22} />} color="accent" />
        <StatCard label="Clusters" value={stats.clusters} icon={<Users size={22} />} color="primary" />
        <StatCard label="Complaints" value={stats.complaints} icon={<AlertTriangle size={22} />} color="error" />
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'users' ? 'bg-white text-primary-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>User Management</button>
        <button onClick={() => setTab('complaints')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'complaints' ? 'bg-white text-primary-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Complaints</button>
      </div>

      {tab === 'users' && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">All Users</h3>
          {users.length === 0 ? <EmptyState icon={<Users size={32} />} title="No users registered" className="py-6" /> : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold">{u.full_name?.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-stone-700 truncate">{u.full_name}</p>
                    <p className="text-xs text-stone-400">{u.email} · {u.role} · {u.village || '—'}</p>
                  </div>
                  <button
                    onClick={() => toggleUserActive(u.id, u.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${u.is_active ? 'bg-success-50 text-success-600 hover:bg-success-100' : 'bg-error-50 text-error-600 hover:bg-error-100'}`}
                  >
                    {u.is_active ? <span className="flex items-center gap-1"><CheckCircle size={13} /> Active</span> : <span className="flex items-center gap-1"><XCircle size={13} /> Disabled</span>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'complaints' && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">Recent Complaints</h3>
          {complaints.length === 0 ? <EmptyState icon={<AlertTriangle size={32} />} title="No complaints" className="py-6" /> : (
            <div className="space-y-3">
              {complaints.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-stone-700">{c.subject}</p>
                      <p className="text-xs text-stone-500 mt-1">{c.description}</p>
                      <p className="text-xs text-stone-400 mt-1">{c.category} · {formatDate(c.created_at)}</p>
                    </div>
                    <span className={`badge-neutral text-xs flex-shrink-0 ${c.status === 'RESOLVED' ? 'bg-success-50 text-success-600' : c.status === 'OPEN' ? 'bg-warning-50 text-warning-600' : ''}`}>{c.status}</span>
                  </div>
                  {c.resolution && <p className="text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">Resolution: {c.resolution}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateComplaintStatus(c.id, 'RESOLVED')} className="px-3 py-1.5 rounded-lg bg-success-50 text-success-600 text-xs font-semibold hover:bg-success-100 transition-colors">Mark Resolved</button>
                    <button onClick={() => updateComplaintStatus(c.id, 'OPEN')} className="px-3 py-1.5 rounded-lg bg-warning-50 text-warning-600 text-xs font-semibold hover:bg-warning-100 transition-colors">Mark Open</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
