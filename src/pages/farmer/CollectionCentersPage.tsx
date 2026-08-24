import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { MapPin, Phone, Clock, Calendar, Navigation } from 'lucide-react';

const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

export default function CollectionCentersPage() {
  const { profile, t } = useAuth();
  const [centers, setCenters] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingCenter, setBookingCenter] = useState<any | null>(null);
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('09:00');
  const [cropName, setCropName] = useState('');
  const [qty, setQty] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        supabase.from('collection_centers').select('*, villages(name)').order('name'),
        supabase.from('collection_slots').select('*, collection_centers(name)').order('slot_date', { ascending: false }),
      ]);
      setCenters(cRes.data ?? []);
      setSlots(sRes.data ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const bookSlot = async () => {
    if (!profile || !bookingCenter) return;
    setBookingError(null);
    const { data: existing } = await supabase.from('collection_slots').select('id').eq('center_id', bookingCenter.id).eq('slot_date', slotDate).eq('slot_time', slotTime);
    if (existing && existing.length > 0) { setBookingError('This slot is already booked. Please choose another time.'); return; }
    const { error: e } = await supabase.from('collection_slots').insert({ center_id: bookingCenter.id, user_id: profile.id, slot_date: slotDate, slot_time: slotTime, crop_name: cropName, quantity_kg: parseFloat(qty) || 0, status: 'PENDING' });
    if (e) { setBookingError(e.message); return; }
    setBookingCenter(null); setSlotDate(''); setCropName(''); setQty('');
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h2 className="text-xl font-bold text-stone-800">Collection Centers</h2><p className="text-sm text-stone-500">Find nearby centers and book collection slots</p></div>
      <div className="card-pad overflow-hidden p-0">
        <iframe title="Collection Centers Map" className="w-full h-64 border-0" src="https://www.openstreetmap.org/export/embed.html?bbox=72.5%2C22.6%2C73.0%2C23.0&layer=mapnik&marker=22.75%2C72.68" loading="lazy" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {centers.length === 0 ? <div className="col-span-full card-pad"><EmptyState icon={<MapPin size={32} />} title="No centers found" /></div>
        : centers.map((c) => (
          <div key={c.id} className="card-pad">
            <h3 className="font-bold text-stone-800">{c.name}</h3>
            <div className="space-y-2 mt-3 text-sm text-stone-600">
              <p className="flex items-center gap-2"><MapPin size={16} className="text-stone-400" /> {c.address || c.villages?.name || '—'}</p>
              <p className="flex items-center gap-2"><Clock size={16} className="text-stone-400" /> {c.opening_hours}</p>
              <p className="flex items-center gap-2"><Navigation size={16} className="text-stone-400" /> Capacity: {c.capacity_kg} kg</p>
              {c.contact_phone && <p className="flex items-center gap-2"><Phone size={16} className="text-stone-400" /> {c.contact_phone}</p>}
            </div>
            <button onClick={() => { setBookingCenter(c); setBookingError(null); }} className="btn-primary w-full mt-3 text-sm"><Calendar size={16} /> Book Slot</button>
          </div>
        ))}
      </div>
      {slots.length > 0 && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3">Booked Slots</h3>
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div><p className="font-semibold text-sm text-stone-700">{s.collection_centers?.name}</p><p className="text-xs text-stone-400">{s.slot_date} · {s.slot_time} · {s.crop_name} · {s.quantity_kg} kg</p></div>
                <span className="badge-primary">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Modal open={!!bookingCenter} onClose={() => setBookingCenter(null)} title={`Book Slot — ${bookingCenter?.name}`} size="sm">
        <div className="space-y-4">
          {bookingError && <div className="p-3 rounded-xl bg-error-50 border border-error-500/20 text-error-600 text-sm">{bookingError}</div>}
          <div><label className="label-text">Date</label><input type="date" className="input-field" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} /></div>
          <div><label className="label-text">Time Slot</label><select className="input-field" value={slotTime} onChange={(e) => setSlotTime(e.target.value)}>{TIME_SLOTS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label-text">Crop</label><input className="input-field" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder="Wheat" /></div>
          <div><label className="label-text">Quantity (kg)</label><input type="number" className="input-field" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100" /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setBookingCenter(null)} className="btn-ghost">{t('cancel')}</button><button onClick={bookSlot} className="btn-primary">{t('confirm')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
