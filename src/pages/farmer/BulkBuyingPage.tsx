import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { addRewardPoints, createNotification } from '@/lib/hooks';
import { Plus, ShoppingCart, Users } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'badge-warning', OPEN: 'badge-primary', CONFIRMED: 'badge-accent',
  ORDERED: 'badge-primary', DELIVERED: 'badge-primary', COMPLETED: 'badge-primary', CANCELLED: 'badge-error',
};

export default function BulkBuyingPage() {
  const { profile, t } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [joinOrder, setJoinOrder] = useState<any | null>(null);
  const [joinQty, setJoinQty] = useState('');
  const [title, setTitle] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Seeds');
  const [targetQty, setTargetQty] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [indivPrice, setIndivPrice] = useState('');
  const [notes, setNotes] = useState('');

  const fetchOrders = async () => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from('bulk_orders')
        .select('*, bulk_order_items(*, profiles!inner(full_name))')
        .order('created_at', { ascending: false });
      if (e) throw e;
      const enriched = (data ?? []).map((o: any) => {
        const totalCommitted = (o.bulk_order_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity), 0);
        const farmerCount = (o.bulk_order_items ?? []).length;
        const perUnitBulk = Number(o.target_quantity) > 0 ? Number(o.estimated_bulk_price) / Number(o.target_quantity) : 0;
        const savings = (Number(o.individual_price) / Math.max(Number(o.target_quantity), 1) - perUnitBulk) * totalCommitted;
        return { ...o, totalCommitted, farmerCount, savings: Math.max(0, savings) };
      });
      setOrders(enriched);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [profile]);

  const createOrder = async () => {
    if (!profile || !title || !itemName) return;
    await supabase.from('bulk_orders').insert({
      title, item_name: itemName, category, unit: 'kg', target_quantity: parseFloat(targetQty) || 0,
      estimated_bulk_price: parseFloat(bulkPrice) || 0, individual_price: parseFloat(indivPrice) || 0,
      created_by: profile.id, notes, status: 'REQUESTED',
    });
    setShowModal(false);
    setTitle(''); setItemName(''); setTargetQty(''); setBulkPrice(''); setIndivPrice(''); setNotes('');
    fetchOrders();
  };

  const joinBulk = async () => {
    if (!profile || !joinOrder || !joinQty) return;
    const { error: e } = await supabase.from('bulk_order_items').insert({
      bulk_order_id: joinOrder.id, user_id: profile.id, quantity: parseFloat(joinQty),
    });
    if (e) { alert(e.message); return; }
    await addRewardPoints(profile.id, 10, 'Joined bulk order');
    await createNotification(profile.id, 'Orders', 'Bulk order joined', `You joined ${joinOrder.title} with ${joinQty} kg`);
    setJoinOrder(null); setJoinQty(''); fetchOrders();
  };

  const advanceStatus = async (order: any) => {
    const statuses = ['REQUESTED', 'OPEN', 'CONFIRMED', 'ORDERED', 'DELIVERED', 'COMPLETED'];
    const idx = statuses.indexOf(order.status);
    if (idx < 0 || idx >= statuses.length - 1) return;
    await supabase.from('bulk_orders').update({ status: statuses[idx + 1] }).eq('id', order.id);
    fetchOrders();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Bulk Buying</h2><p className="text-sm text-stone-500">Join together to buy supplies at wholesale prices</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> New Request</button>
      </div>
      {orders.length === 0 ? (
        <div className="card-pad"><EmptyState icon={<ShoppingCart size={32} />} title="No bulk orders" description="Create a bulk purchase request" /></div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card-pad">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-bold text-stone-800">{o.title}</h3><p className="text-sm text-stone-400">{o.item_name} · {o.category}</p></div>
                <span className={STATUS_COLORS[o.status] || 'badge-neutral'}>{o.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Target</p><p className="font-semibold">{o.target_quantity} {o.unit}</p></div>
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Committed</p><p className="font-semibold">{o.totalCommitted} {o.unit}</p></div>
                <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Farmers</p><p className="font-semibold">{o.farmerCount}</p></div>
                <div className="p-2 rounded-lg bg-primary-50"><p className="text-xs text-primary-400">Est. Savings</p><p className="font-semibold text-primary-700">{formatCurrency(o.savings)}</p></div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-stone-400">Bulk: {formatCurrency(o.estimated_bulk_price)} · Individual: {formatCurrency(o.individual_price)} · Closes: {formatDate(o.closes_on)}</p>
                <div className="flex gap-2">
                  {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && <button onClick={() => setJoinOrder(o)} className="btn-secondary text-sm">Join</button>}
                  {o.created_by === profile?.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && <button onClick={() => advanceStatus(o)} className="btn-primary text-sm">Advance</button>}
                </div>
              </div>
              {o.bulk_order_items?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-500 mb-1 flex items-center gap-1"><Users size={12} /> Participants</p>
                  {o.bulk_order_items.map((i: any) => (<p key={i.id} className="text-xs text-stone-400">{i.profiles?.full_name || 'Farmer'}: {i.quantity} {o.unit}</p>))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Bulk Request">
        <div className="space-y-4">
          <div><label className="label-text">Title</label><input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bulk Urea Purchase" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Item Name</label><input className="input-field" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Urea fertilizer" /></div>
            <div><label className="label-text">Category</label><select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}><option>Seeds</option><option>Fertilizer</option><option>Pesticides</option><option>Equipment</option><option>Other</option></select></div>
          </div>
          <div><label className="label-text">Target Quantity (kg)</label><input type="number" className="input-field" value={targetQty} onChange={(e) => setTargetQty(e.target.value)} placeholder="500" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Bulk Price (total)</label><input type="number" className="input-field" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="8000" /></div>
            <div><label className="label-text">Individual Price (total)</label><input type="number" className="input-field" value={indivPrice} onChange={(e) => setIndivPrice(e.target.value)} placeholder="12000" /></div>
          </div>
          <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={createOrder} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>
      <Modal open={!!joinOrder} onClose={() => setJoinOrder(null)} title="Join Bulk Order" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-stone-600">Joining: <strong>{joinOrder?.title}</strong></p>
          <div><label className="label-text">Your Quantity ({joinOrder?.unit})</label><input type="number" className="input-field" value={joinQty} onChange={(e) => setJoinQty(e.target.value)} placeholder="50" /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setJoinOrder(null)} className="btn-ghost">{t('cancel')}</button><button onClick={joinBulk} className="btn-primary">{t('confirm')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
