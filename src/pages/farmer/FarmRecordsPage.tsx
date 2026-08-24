import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { FarmExpense, FarmProduction, FarmSale } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { addRewardPoints } from '@/lib/hooks';
import { Plus, Wallet, TrendingUp, IndianRupee, Trash } from 'lucide-react';

const CATEGORIES = ['Seeds', 'Fertilizer', 'Pesticides', 'Labour', 'Machinery', 'Irrigation', 'Other'];

export default function FarmRecordsPage() {
  const { profile, t } = useAuth();
  const [tab, setTab] = useState<'expenses' | 'production' | 'sales'>('expenses');
  const [expenses, setExpenses] = useState<FarmExpense[]>([]);
  const [productions, setProductions] = useState<FarmProduction[]>([]);
  const [sales, setSales] = useState<FarmSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('Seeds');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [buyerName, setBuyerName] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [eRes, pRes, sRes] = await Promise.all([
        supabase.from('farm_expenses').select('*').eq('user_id', profile.id).order('expense_date', { ascending: false }),
        supabase.from('farm_productions').select('*').eq('user_id', profile.id).order('production_date', { ascending: false }),
        supabase.from('farm_sales').select('*').eq('user_id', profile.id).order('sale_date', { ascending: false }),
      ]);
      setExpenses((eRes.data as FarmExpense[]) ?? []);
      setProductions((pRes.data as FarmProduction[]) ?? []);
      setSales((sRes.data as FarmSale[]) ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = sales.reduce((s, e) => s + Number(e.total_amount), 0);
  const profit = totalRevenue - totalExpenses;

  const addRecord = async () => {
    if (!profile) return;
    if (tab === 'expenses') {
      await supabase.from('farm_expenses').insert({ user_id: profile.id, category, description, amount: parseFloat(amount) || 0 });
    } else if (tab === 'production') {
      await supabase.from('farm_productions').insert({ user_id: profile.id, crop_name: cropName, quantity_kg: parseFloat(quantity) || 0 });
    } else {
      const total = (parseFloat(quantity) || 0) * (parseFloat(pricePerKg) || 0);
      await supabase.from('farm_sales').insert({ user_id: profile.id, crop_name: cropName, quantity_kg: parseFloat(quantity) || 0, price_per_kg: parseFloat(pricePerKg) || 0, total_amount: total, buyer_name: buyerName });
      await addRewardPoints(profile.id, 5, 'Recorded a sale');
    }
    setShowModal(false);
    setDescription(''); setAmount(''); setCropName(''); setQuantity(''); setPricePerKg(''); setBuyerName('');
    fetchData();
  };

  const deleteRecord = async (id: string, table: string) => {
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Farm Records</h2><p className="text-sm text-stone-500">Track expenses, production, and sales</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> Add Record</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={<Wallet size={22} />} color="warning" />
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<IndianRupee size={22} />} color="success" />
        <StatCard label="Profit" value={formatCurrency(profit)} icon={<TrendingUp size={22} />} color="primary" trend={profit >= 0 ? 'Profit' : 'Loss'} />
      </div>
      <div className="flex gap-2 border-b border-stone-200">
        {(['expenses', 'production', 'sales'] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === tabKey ? 'border-primary-600 text-primary-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>{tabKey}</button>
        ))}
      </div>
      <div className="card-pad">
        {tab === 'expenses' && (expenses.length === 0 ? <EmptyState icon={<Wallet size={32} />} title="No expenses recorded" />
        : <div className="space-y-2">{expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div><p className="font-semibold text-sm text-stone-700">{e.category}: {e.description || '—'}</p><p className="text-xs text-stone-400">{formatDate(e.expense_date)}</p></div>
            <div className="flex items-center gap-3"><p className="font-semibold text-stone-700">{formatCurrency(e.amount)}</p><button onClick={() => deleteRecord(e.id, 'farm_expenses')} className="text-stone-400 hover:text-error-500"><Trash size={16} /></button></div>
          </div>
        ))}</div>)}
        {tab === 'production' && (productions.length === 0 ? <EmptyState icon={<TrendingUp size={32} />} title="No production records" />
        : <div className="space-y-2">{productions.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div><p className="font-semibold text-sm text-stone-700">{p.crop_name}</p><p className="text-xs text-stone-400">{formatDate(p.production_date)}</p></div>
            <div className="flex items-center gap-3"><p className="font-semibold text-stone-700">{p.quantity_kg} kg</p><button onClick={() => deleteRecord(p.id, 'farm_productions')} className="text-stone-400 hover:text-error-500"><Trash size={16} /></button></div>
          </div>
        ))}</div>)}
        {tab === 'sales' && (sales.length === 0 ? <EmptyState icon={<IndianRupee size={32} />} title="No sales recorded" />
        : <div className="space-y-2">{sales.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div><p className="font-semibold text-sm text-stone-700">{s.crop_name} · {s.quantity_kg} kg</p><p className="text-xs text-stone-400">{s.buyer_name || '—'} · {formatDate(s.sale_date)}</p></div>
            <div className="flex items-center gap-3"><p className="font-semibold text-stone-700">{formatCurrency(s.total_amount)}</p><button onClick={() => deleteRecord(s.id, 'farm_sales')} className="text-stone-400 hover:text-error-500"><Trash size={16} /></button></div>
          </div>
        ))}</div>)}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Add ${tab === 'expenses' ? 'Expense' : tab === 'production' ? 'Production' : 'Sale'}`}>
        <div className="space-y-4">
          {tab === 'expenses' && (<>
            <div><label className="label-text">Category</label><select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label-text">Description</label><input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bought urea fertilizer" /></div>
            <div><label className="label-text">Amount (₹)</label><input type="number" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" /></div>
          </>)}
          {tab === 'production' && (<>
            <div><label className="label-text">Crop</label><input className="input-field" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder="Wheat" /></div>
            <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="500" /></div>
          </>)}
          {tab === 'sales' && (<>
            <div><label className="label-text">Crop</label><input className="input-field" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder="Wheat" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" /></div>
              <div><label className="label-text">Price/kg (₹)</label><input type="number" className="input-field" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} placeholder="24" /></div>
            </div>
            <div><label className="label-text">Buyer Name</label><input className="input-field" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Local mandi" /></div>
          </>)}
          <div className="flex gap-2 justify-end"><button onClick={() => setShowModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={addRecord} className="btn-primary">{t('add')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
