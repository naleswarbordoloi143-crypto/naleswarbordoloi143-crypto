import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { addRewardPoints, createNotification } from '@/lib/hooks';
import { Plus, ShoppingBag, Tag, Package } from 'lucide-react';

export default function MarketplacePage() {
  const { profile, t } = useAuth();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReqModal, setShowReqModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerTarget, setOfferTarget] = useState<any | null>(null);

  // req form
  const [rCrop, setRCrop] = useState('');
  const [rQty, setRQty] = useState('');
  const [rMaxPrice, setRMaxPrice] = useState('');
  const [rDelivery, setRDelivery] = useState('');
  const [rNotes, setRNotes] = useState('');

  // offer form
  const [oPrice, setOPrice] = useState('');
  const [oQty, setOQty] = useState('');
  const [oNotes, setONotes] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [reqRes, lotRes, offRes, ordRes] = await Promise.all([
        supabase.from('buyer_requirements').select('*, profiles!inner(full_name, village)').order('created_at', { ascending: false }),
        supabase.from('harvest_lots').select('*').eq('status', 'OPEN').order('created_at', { ascending: false }),
        supabase.from('buyer_offers').select('*, profiles!inner(full_name)').order('created_at', { ascending: false }),
        supabase.from('buyer_orders').select('*').or(`farmer_id.eq.${profile.id},buyer_id.eq.${profile.id}`).order('created_at', { ascending: false }),
      ]);
      setRequirements(reqRes.data ?? []);
      setLots(lotRes.data ?? []);
      setOffers(offRes.data ?? []);
      setOrders(ordRes.data ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const createRequirement = async () => {
    if (!profile || !rCrop) return;
    await supabase.from('buyer_requirements').insert({
      buyer_id: profile.id, crop_name: rCrop, quantity_kg: parseFloat(rQty) || 0,
      max_price_per_kg: parseFloat(rMaxPrice) || 0, delivery_location: rDelivery, notes: rNotes,
    });
    setShowReqModal(false);
    setRCrop(''); setRQty(''); setRMaxPrice(''); setRDelivery(''); setRNotes('');
    fetchData();
  };

  const makeOffer = async () => {
    if (!profile || !offerTarget) return;
    await supabase.from('buyer_offers').insert({
      buyer_id: profile.id, requirement_id: offerTarget.kind === 'requirement' ? offerTarget.id : null,
      lot_id: offerTarget.kind === 'lot' ? offerTarget.id : null,
      price_per_kg: parseFloat(oPrice) || 0, quantity_kg: parseFloat(oQty) || 0, notes: oNotes,
    });
    setShowOfferModal(false);
    setOPrice(''); setOQty(''); setONotes('');
    setOfferTarget(null);
    fetchData();
  };

  const acceptOffer = async (offer: any) => {
    if (!profile) return;
    const total = Number(offer.price_per_kg) * Number(offer.quantity_kg);
    const lot = lots.find((l) => l.id === offer.lot_id);
    const cropName = lot?.crop_name || 'Crop';
    await supabase.from('buyer_offers').update({ status: 'ACCEPTED' }).eq('id', offer.id);
    await supabase.from('buyer_orders').insert({
      buyer_id: offer.buyer_id, farmer_id: profile.id, lot_id: offer.lot_id, offer_id: offer.id,
      crop_name: cropName, quantity_kg: offer.quantity_kg, price_per_kg: offer.price_per_kg,
      total_amount: total, status: 'CONFIRMED',
    });
    await addRewardPoints(profile.id, 20, 'Accepted buyer offer');
    await createNotification(profile.id, 'Orders', 'Order confirmed', `Order for ${offer.quantity_kg} kg of ${cropName} confirmed`);
    await createNotification(offer.buyer_id, 'Orders', 'Offer accepted', `Your offer for ${offer.quantity_kg} kg of ${cropName} was accepted`);
    fetchData();
  };

  const advanceOrder = async (order: any) => {
    const statuses = ['PENDING', 'ACCEPTED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
    const idx = statuses.indexOf(order.status);
    if (idx < 0 || idx >= statuses.length - 1) return;
    await supabase.from('buyer_orders').update({ status: statuses[idx + 1], updated_at: new Date().toISOString() }).eq('id', order.id);
    if (statuses[idx + 1] === 'DELIVERED' && order.farmer_id) {
      await addRewardPoints(order.farmer_id, 25, 'Timely delivery');
    }
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  const isBuyer = (profile?.active_role || profile?.role) === 'buyer';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Marketplace</h2>
          <p className="text-sm text-stone-500">{isBuyer ? 'Find crops and make offers to farmers' : 'View buyer requirements and harvest lots'}</p>
        </div>
        {isBuyer && <button onClick={() => setShowReqModal(true)} className="btn-primary"><Plus size={18} /> Post Requirement</button>}
      </div>

      {/* Buyer requirements */}
      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Tag size={20} className="text-primary-600" /> Buyer Requirements</h3>
        {requirements.length === 0 ? (
          <EmptyState icon={<Tag size={32} />} title="No requirements posted" className="py-6" />
        ) : (
          <div className="space-y-3">
            {requirements.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 rounded-xl border border-stone-100 bg-stone-50">
                <div>
                  <p className="font-semibold text-stone-700">{r.crop_name} · {r.quantity_kg} kg</p>
                  <p className="text-sm text-stone-400">Max ₹{r.max_price_per_kg}/kg · Delivery: {r.delivery_location || '—'}</p>
                  <p className="text-xs text-stone-400">By {r.profiles?.full_name} · {formatDate(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${r.status === 'OPEN' ? 'badge-primary' : 'badge-neutral'}`}>{r.status}</span>
                  {isBuyer && r.buyer_id !== profile?.id && (
                    <button onClick={() => { setOfferTarget({ ...r, kind: 'requirement' }); setShowOfferModal(true); }} className="btn-secondary text-sm">Make Offer</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Harvest lots */}
      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Package size={20} className="text-accent-500" /> Available Harvest Lots</h3>
        {lots.length === 0 ? (
          <EmptyState icon={<Package size={32} />} title="No lots available" className="py-6" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lots.map((l) => (
              <div key={l.id} className="p-4 rounded-xl border border-stone-100 bg-stone-50">
                <p className="font-semibold text-stone-700">{l.crop_name}</p>
                <p className="text-sm text-stone-400">{l.total_quantity_kg} kg · ₹{l.price_per_kg}/kg</p>
                <p className="text-xs text-stone-400">{l.location || '—'} · {formatDate(l.harvest_date)}</p>
                {isBuyer && (
                  <button onClick={() => { setOfferTarget({ ...l, kind: 'lot' }); setShowOfferModal(true); }} className="btn-secondary w-full mt-2 text-sm">Make Offer</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offers (for farmers) */}
      {!isBuyer && offers.length > 0 && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><ShoppingBag size={20} className="text-primary-600" /> Buyer Offers</h3>
          <div className="space-y-2">
            {offers.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <p className="font-semibold text-sm text-stone-700">₹{o.price_per_kg}/kg · {o.quantity_kg} kg</p>
                  <p className="text-xs text-stone-400">By {o.profiles?.full_name} · {formatCurrency(Number(o.price_per_kg) * Number(o.quantity_kg))}</p>
                </div>
                <div className="flex gap-2">
                  <span className="badge-neutral">{o.status}</span>
                  {o.status === 'PENDING' && <button onClick={() => acceptOffer(o)} className="btn-primary text-sm">Accept</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      {orders.length > 0 && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">Orders</h3>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <p className="font-semibold text-sm text-stone-700">{o.crop_name} · {o.quantity_kg} kg</p>
                  <p className="text-xs text-stone-400">{formatCurrency(o.total_amount)} · {formatDate(o.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <span className="badge-primary">{o.status}</span>
                  {!isBuyer && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                    <button onClick={() => advanceOrder(o)} className="btn-secondary text-sm">Advance</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={showReqModal} onClose={() => setShowReqModal(false)} title="Post Requirement">
        <div className="space-y-4">
          <div><label className="label-text">Crop</label><input className="input-field" value={rCrop} onChange={(e) => setRCrop(e.target.value)} placeholder="Wheat" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={rQty} onChange={(e) => setRQty(e.target.value)} /></div>
            <div><label className="label-text">Max Price/kg</label><input type="number" className="input-field" value={rMaxPrice} onChange={(e) => setRMaxPrice(e.target.value)} /></div>
          </div>
          <div><label className="label-text">Delivery Location</label><input className="input-field" value={rDelivery} onChange={(e) => setRDelivery(e.target.value)} /></div>
          <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={rNotes} onChange={(e) => setRNotes(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowReqModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={createRequirement} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>

      <Modal open={showOfferModal} onClose={() => setShowOfferModal(false)} title="Make Offer" size="sm">
        <div className="space-y-4">
          <div><label className="label-text">Price per kg (₹)</label><input type="number" className="input-field" value={oPrice} onChange={(e) => setOPrice(e.target.value)} /></div>
          <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={oQty} onChange={(e) => setOQty(e.target.value)} /></div>
          <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={oNotes} onChange={(e) => setONotes(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowOfferModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={makeOffer} className="btn-primary">{t('confirm')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
