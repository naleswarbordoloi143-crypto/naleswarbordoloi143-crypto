import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatDate, formatNumber } from '@/lib/utils';
import { addRewardPoints, createNotification } from '@/lib/hooks';
import { Plus, Wheat, Users } from 'lucide-react';

export default function HarvestPage() {
  const { profile, t } = useAuth();
  const [myHarvests, setMyHarvests] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [contributeLot, setContributeLot] = useState<any | null>(null);
  const [contribQty, setContribQty] = useState('');
  const [hCrop, setHCrop] = useState('');
  const [hQty, setHQty] = useState('');
  const [hDate, setHDate] = useState('');
  const [hLocation, setHLocation] = useState('');
  const [lCrop, setLCrop] = useState('');
  const [lQty, setLQty] = useState('');
  const [lPrice, setLPrice] = useState('');
  const [lDate, setLDate] = useState('');
  const [lLocation, setLLocation] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [hRes, lRes] = await Promise.all([
        supabase.from('harvests').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('harvest_lots').select('*, harvest_contributions(*, profiles!inner(full_name))').order('created_at', { ascending: false }),
      ]);
      setMyHarvests(hRes.data ?? []);
      setLots(lRes.data ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const addHarvest = async () => {
    if (!profile || !hCrop) return;
    const { data: farm } = await supabase.from('farms').select('id').eq('user_id', profile.id).maybeSingle();
    await supabase.from('harvests').insert({
      farm_id: farm?.id, user_id: profile.id, crop_name: hCrop,
      expected_quantity_kg: parseFloat(hQty) || 0, harvest_date: hDate || null, location: hLocation,
    });
    setShowHarvestModal(false); setHCrop(''); setHQty(''); setHDate(''); setHLocation('');
    fetchData();
  };

  const createLot = async () => {
    if (!profile || !lCrop) return;
    const { data } = await supabase.from('harvest_lots').insert({
      crop_name: lCrop, total_quantity_kg: parseFloat(lQty) || 0, price_per_kg: parseFloat(lPrice) || 0,
      harvest_date: lDate || null, location: lLocation, created_by: profile.id,
    }).select().single();
    if (data) {
      await supabase.from('harvest_contributions').insert({ lot_id: data.id, user_id: profile.id, quantity_kg: parseFloat(lQty) || 0 });
    }
    setShowLotModal(false); setLCrop(''); setLQty(''); setLPrice(''); setLDate(''); setLLocation('');
    fetchData();
  };

  const contribute = async () => {
    if (!profile || !contributeLot || !contribQty) return;
    const { error: e } = await supabase.from('harvest_contributions').insert({
      lot_id: contributeLot.id, user_id: profile.id, quantity_kg: parseFloat(contribQty),
    });
    if (e) { alert(e.message); return; }
    const newTotal = Number(contributeLot.total_quantity_kg) + parseFloat(contribQty);
    const { error: updErr } = await supabase.from('harvest_lots').update({ total_quantity_kg: newTotal }).eq('id', contributeLot.id);
    if (updErr) { console.error('Failed to update lot total:', updErr.message); }
    await addRewardPoints(profile.id, 15, 'Contributed to harvest pool');
    await createNotification(profile.id, 'Harvest', 'Harvest contribution added', `You added ${contribQty} kg to ${contributeLot.crop_name} lot`);
    setContributeLot(null); setContribQty(''); fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Harvest Pooling</h2><p className="text-sm text-stone-500">Pool your harvest with other farmers for better prices</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowHarvestModal(true)} className="btn-secondary"><Plus size={18} /> Add Harvest</button>
          <button onClick={() => setShowLotModal(true)} className="btn-primary"><Plus size={18} /> Create Lot</button>
        </div>
      </div>
      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Wheat size={20} className="text-accent-500" /> My Harvests</h3>
        {myHarvests.length === 0 ? <EmptyState icon={<Wheat size={32} />} title="No harvests recorded" className="py-6" />
        : (<div className="space-y-2">
          {myHarvests.map((h) => (
            <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
              <div><p className="font-semibold text-sm text-stone-700">{h.crop_name}</p><p className="text-xs text-stone-400">{formatNumber(h.expected_quantity_kg)} kg · {formatDate(h.harvest_date)}</p></div>
              <span className="badge-neutral">{h.status}</span>
            </div>
          ))}
        </div>)}
      </div>
      <div>
        <h3 className="font-bold text-stone-800 mb-3">Harvest Lots</h3>
        {lots.length === 0 ? <div className="card-pad"><EmptyState icon={<Users size={32} />} title="No lots created" description="Create a lot to pool harvests" /></div>
        : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lots.map((l) => (
            <div key={l.id} className="card-pad">
              <div className="flex items-start justify-between mb-2">
                <div><h4 className="font-bold text-stone-800">{l.crop_name}</h4><p className="text-sm text-stone-400">{l.location || '—'} · {formatDate(l.harvest_date)}</p></div>
                <span className="badge-primary">{l.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Total</p><p className="font-semibold">{formatNumber(l.total_quantity_kg)} kg</p></div>
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Price/kg</p><p className="font-semibold">₹{l.price_per_kg}</p></div>
              </div>
              {l.harvest_contributions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-500 mb-1">Contributors ({l.harvest_contributions.length})</p>
                  {l.harvest_contributions.map((c: any) => (<p key={c.id} className="text-xs text-stone-400">{c.profiles?.full_name}: {c.quantity_kg} kg</p>))}
                </div>
              )}
              <button onClick={() => setContributeLot(l)} className="btn-secondary w-full mt-3 text-sm">Contribute</button>
            </div>
          ))}
        </div>)}
      </div>
      <Modal open={showHarvestModal} onClose={() => setShowHarvestModal(false)} title="Add Harvest" size="sm">
        <div className="space-y-4">
          <div><label className="label-text">Crop</label><input className="input-field" value={hCrop} onChange={(e) => setHCrop(e.target.value)} placeholder="Wheat" /></div>
          <div><label className="label-text">Expected Quantity (kg)</label><input type="number" className="input-field" value={hQty} onChange={(e) => setHQty(e.target.value)} placeholder="500" /></div>
          <div><label className="label-text">Harvest Date</label><input type="date" className="input-field" value={hDate} onChange={(e) => setHDate(e.target.value)} /></div>
          <div><label className="label-text">Location</label><input className="input-field" value={hLocation} onChange={(e) => setHLocation(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowHarvestModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={addHarvest} className="btn-primary">{t('add')}</button></div>
        </div>
      </Modal>
      <Modal open={showLotModal} onClose={() => setShowLotModal(false)} title="Create Harvest Lot">
        <div className="space-y-4">
          <div><label className="label-text">Crop</label><input className="input-field" value={lCrop} onChange={(e) => setLCrop(e.target.value)} placeholder="Wheat" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={lQty} onChange={(e) => setLQty(e.target.value)} placeholder="500" /></div>
            <div><label className="label-text">Price/kg (₹)</label><input type="number" className="input-field" value={lPrice} onChange={(e) => setLPrice(e.target.value)} placeholder="24" /></div>
          </div>
          <div><label className="label-text">Harvest Date</label><input type="date" className="input-field" value={lDate} onChange={(e) => setLDate(e.target.value)} /></div>
          <div><label className="label-text">Location</label><input className="input-field" value={lLocation} onChange={(e) => setLLocation(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowLotModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={createLot} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>
      <Modal open={!!contributeLot} onClose={() => setContributeLot(null)} title="Contribute to Lot" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-stone-600">Contributing to: <strong>{contributeLot?.crop_name}</strong></p>
          <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={contribQty} onChange={(e) => setContribQty(e.target.value)} placeholder="100" /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setContributeLot(null)} className="btn-ghost">{t('cancel')}</button><button onClick={contribute} className="btn-primary">{t('confirm')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
