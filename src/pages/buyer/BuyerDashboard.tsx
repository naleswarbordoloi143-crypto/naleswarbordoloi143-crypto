import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { addRewardPoints, createNotification } from '@/lib/hooks';
import { ShoppingBag, Package, IndianRupee, TrendingUp, Plus, Search, Check, X, Truck, ScanLine } from 'lucide-react';

export default function BuyerDashboard() {
  const { profile, t } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showReqModal, setShowReqModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState<any>(null);
  const [reqCrop, setReqCrop] = useState('');
  const [reqQty, setReqQty] = useState('');
  const [reqPrice, setReqPrice] = useState('');
  const [reqDate, setReqDate] = useState('');
  const [reqLocation, setReqLocation] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQty, setOfferQty] = useState('');
  const [offerNotes, setOfferNotes] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const [lotsRes, reqRes, ordRes, offRes] = await Promise.all([
        supabase.from('harvest_lots').select('*').eq('status', 'OPEN').order('created_at', { ascending: false }),
        supabase.from('buyer_requirements').select('*').eq('buyer_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('buyer_orders').select('*').eq('buyer_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('buyer_offers').select('*, harvest_lots(crop_name)').eq('buyer_id', profile.id).order('created_at', { ascending: false }),
      ]);
      setLots(lotsRes.data ?? []); setRequirements(reqRes.data ?? []);
      setOrders(ordRes.data ?? []); setOffers(offRes.data ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const totalSpent = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED').reduce((s, o) => s + Number(o.total_amount), 0);
  const activeOrders = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
  const filteredLots = lots.filter((l) => l.crop_name?.toLowerCase().includes(search.toLowerCase()));

  const createRequirement = async () => {
    if (!profile || !reqCrop) return;
    await supabase.from('buyer_requirements').insert({
      buyer_id: profile.id, crop_name: reqCrop, quantity_kg: parseFloat(reqQty) || 0,
      max_price_per_kg: parseFloat(reqPrice) || 0, delivery_date: reqDate || null, delivery_location: reqLocation, notes: reqNotes,
    });
    setShowReqModal(false); setReqCrop(''); setReqQty(''); setReqPrice(''); setReqDate(''); setReqLocation(''); setReqNotes('');
    fetchData();
  };

  const makeOffer = async () => {
    if (!profile || !showOfferModal) return;
    const { data: offer } = await supabase.from('buyer_offers').insert({
      buyer_id: profile.id, lot_id: showOfferModal.id, price_per_kg: parseFloat(offerPrice) || 0,
      quantity_kg: parseFloat(offerQty) || 0, notes: offerNotes, status: 'PENDING',
    }).select().single();
    if (offer && showOfferModal.created_by) {
      await createNotification(showOfferModal.created_by, 'Buyer', 'New offer received', `Buyer offered ${formatCurrency(parseFloat(offerPrice) || 0)}/kg for ${showOfferModal.crop_name}`);
    }
    setShowOfferModal(null); setOfferPrice(''); setOfferQty(''); setOfferNotes('');
    fetchData();
  };

  const placeOrder = async (lot: any) => {
    if (!profile) return;
    const total = Number(lot.price_per_kg) * Number(lot.total_quantity_kg);
    const { data: order } = await supabase.from('buyer_orders').insert({
      buyer_id: profile.id, farmer_id: lot.created_by, lot_id: lot.id, crop_name: lot.crop_name,
      quantity_kg: lot.total_quantity_kg, price_per_kg: lot.price_per_kg, total_amount: total,
      delivery_location: profile.village || '—',
    }).select().single();
    if (order && lot.created_by) {
      await createNotification(lot.created_by, 'Orders', 'New order placed', `Order for ${lot.crop_name} - ${lot.total_quantity_kg} kg`);
      await addRewardPoints(lot.created_by, 20, 'Received a buyer order');
    }
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Buyer Dashboard</h1>
            <p className="text-primary-100 mt-1">{profile?.full_name} · Source crops directly from farmers</p>
          </div>
          <button
            onClick={() => { window.location.hash = '/nfcHarvest'; }}
            className="bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-semibold"
          >
            <ScanLine size={18} /> Scan Harvest NFC
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Purchased" value={formatCurrency(totalSpent)} icon={<IndianRupee size={22} />} color="success" />
        <StatCard label="Active Orders" value={activeOrders} icon={<Package size={22} />} color="primary" />
        <StatCard label="Requirements" value={requirements.length} icon={<ShoppingBag size={22} />} color="accent" />
      </div>

      <div className="card-pad">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-800 flex items-center gap-2"><Search size={20} className="text-primary-600" /> Available Harvest Lots</h3>
          <button onClick={() => setShowReqModal(true)} className="btn-primary text-sm"><Plus size={16} /> Post Requirement</button>
        </div>
        <input className="input-field mb-4" placeholder="Search crops..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {filteredLots.length === 0 ? <EmptyState icon={<ShoppingBag size={32} />} title="No lots available" className="py-6" />
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredLots.map((l) => (
          <div key={l.id} className="p-4 rounded-xl border border-stone-100 bg-stone-50">
            <div className="flex items-center justify-between mb-2"><p className="font-bold text-stone-800">{l.crop_name}</p><span className="badge-primary">{l.total_quantity_kg} kg</span></div>
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(l.price_per_kg)}/kg</p>
            <p className="text-xs text-stone-400 mt-1">{l.location || '—'} · Harvest: {formatDate(l.harvest_date)}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setShowOfferModal(l); setOfferPrice(String(l.price_per_kg)); setOfferQty(String(l.total_quantity_kg)); }} className="btn-secondary flex-1 text-sm">Make Offer</button>
              <button onClick={() => placeOrder(l)} className="btn-primary flex-1 text-sm">Order Now</button>
            </div>
          </div>
        ))}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Package size={20} className="text-primary-600" /> My Orders</h3>
          {orders.length === 0 ? <EmptyState icon={<Package size={32} />} title="No orders yet" className="py-6" />
          : <div className="space-y-2">{orders.map((o) => (
            <div key={o.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
              <div className="flex items-center justify-between"><p className="font-semibold text-sm text-stone-700">{o.crop_name} · {o.quantity_kg} kg</p><span className="badge-primary">{o.status}</span></div>
              <p className="text-xs text-stone-400 mt-1">{formatCurrency(o.total_amount)} · {formatDate(o.created_at)}</p>
            </div>
          ))}</div>}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><TrendingUp size={20} className="text-primary-600" /> My Requirements</h3>
          {requirements.length === 0 ? <EmptyState icon={<ShoppingBag size={32} />} title="No requirements posted" className="py-6" />
          : <div className="space-y-2">{requirements.map((r) => (
            <div key={r.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
              <div className="flex items-center justify-between"><p className="font-semibold text-sm text-stone-700">{r.crop_name} · {r.quantity_kg} kg</p><span className="badge-neutral">{r.status}</span></div>
              <p className="text-xs text-stone-400 mt-1">Max: {formatCurrency(r.max_price_per_kg)}/kg · By {formatDate(r.delivery_date)}</p>
            </div>
          ))}</div>}
        </div>
      </div>

      <Modal open={showReqModal} onClose={() => setShowReqModal(false)} title="Post Requirement">
        <div className="space-y-4">
          <div><label className="label-text">Crop</label><input className="input-field" value={reqCrop} onChange={(e) => setReqCrop(e.target.value)} placeholder="Wheat" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={reqQty} onChange={(e) => setReqQty(e.target.value)} placeholder="500" /></div>
            <div><label className="label-text">Max Price/kg</label><input type="number" className="input-field" value={reqPrice} onChange={(e) => setReqPrice(e.target.value)} placeholder="24" /></div>
          </div>
          <div><label className="label-text">Delivery Date</label><input type="date" className="input-field" value={reqDate} onChange={(e) => setReqDate(e.target.value)} /></div>
          <div><label className="label-text">Delivery Location</label><input className="input-field" value={reqLocation} onChange={(e) => setReqLocation(e.target.value)} placeholder="Delhi" /></div>
          <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowReqModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={createRequirement} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>

      <Modal open={!!showOfferModal} onClose={() => setShowOfferModal(null)} title={`Make Offer — ${showOfferModal?.crop_name}`} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Price/kg</label><input type="number" className="input-field" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} /></div>
            <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={offerQty} onChange={(e) => setOfferQty(e.target.value)} /></div>
          </div>
          <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={offerNotes} onChange={(e) => setOfferNotes(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowOfferModal(null)} className="btn-ghost">{t('cancel')}</button><button onClick={makeOffer} className="btn-primary">Send Offer</button></div>
        </div>
      </Modal>
    </div>
  );
}
