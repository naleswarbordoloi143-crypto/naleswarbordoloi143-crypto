import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Farm } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Plus, Users, MapPin } from 'lucide-react';

export default function ClustersPage() {
  const { profile, t } = useAuth();
  const [clusters, setClusters] = useState<any[]>([]);
  const [myFarms, setMyFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [cropName, setCropName] = useState('');
  const [harvestDate, setHarvestDate] = useState('');

  const fetchClusters = async () => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase.from('farm_clusters').select('*, villages(name)').order('created_at', { ascending: false });
      if (e) throw e;
      const enriched = await Promise.all((data ?? []).map(async (c: any) => {
        const { data: members } = await supabase
          .from('cluster_members')
          .select('*, farm:farms(size_acres)')
          .eq('cluster_id', c.id);
        const totalAcres = (members ?? []).reduce((s: number, m: any) => s + Number(m.farm?.size_acres || 0), 0);
        return { ...c, memberCount: members?.length ?? 0, totalAcres };
      }));
      setClusters(enriched);
      const { data: farms } = await supabase.from('farms').select('*').eq('user_id', profile.id);
      setMyFarms((farms as Farm[]) ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchClusters(); }, [profile]);

  const createCluster = async () => {
    if (!profile || !name) return;
    await supabase.from('farm_clusters').insert({
      name, crop_name: cropName, expected_harvest_date: harvestDate || null,
      champion_id: (profile.active_role || profile.role) === 'champion' ? profile.id : null,
    });
    setShowModal(false); setName(''); setCropName(''); setHarvestDate('');
    fetchClusters();
  };

  const joinCluster = async (clusterId: string) => {
    if (!profile || myFarms.length === 0) return;
    const { error: e } = await supabase.from('cluster_members').insert({
      cluster_id: clusterId, farm_id: myFarms[0].id, user_id: profile.id,
    });
    if (e) { alert(e.message); return; }
    fetchClusters();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Virtual Farm Clusters</h2><p className="text-sm text-stone-500">Join or create clusters to coordinate with nearby farmers</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> New Cluster</button>
      </div>
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm text-primary-700">
        <strong>Important:</strong> Land ownership is never transferred. Clusters only digitally coordinate farmers for bulk buying, machinery sharing, and harvest pooling.
      </div>
      {clusters.length === 0 ? (
        <div className="card-pad"><EmptyState icon={<Users size={32} />} title="No clusters yet" description="Create the first cluster for your village" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.map((c) => (
            <div key={c.id} className="card-pad">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-bold text-stone-800">{c.name}</h3><p className="text-sm text-stone-400 flex items-center gap-1"><MapPin size={14} /> {c.villages?.name || '—'}</p></div>
                <span className="badge-primary">{c.crop_name || 'Mixed'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Farmers</p><p className="font-semibold text-stone-700">{c.memberCount}</p></div>
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Total Acres</p><p className="font-semibold text-stone-700">{c.totalAcres}</p></div>
              </div>
              {c.expected_harvest_date && <p className="text-xs text-stone-400 mt-2">Harvest: {c.expected_harvest_date}</p>}
              <button onClick={() => joinCluster(c.id)} className="btn-secondary w-full mt-3 text-sm" disabled={myFarms.length === 0}>
                {myFarms.length === 0 ? 'Create a farm first' : 'Join Cluster'}
              </button>
            </div>
          ))}
        </div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Cluster">
        <div className="space-y-4">
          <div><label className="label-text">Cluster Name</label><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rampur Wheat Group" /></div>
          <div><label className="label-text">Primary Crop</label><input className="input-field" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder="Wheat" /></div>
          <div><label className="label-text">Expected Harvest Date</label><input type="date" className="input-field" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={createCluster} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
