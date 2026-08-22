import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Tractor, Star, Calendar } from 'lucide-react';

const MACHINE_TYPES = ['Tractor', 'Harvester', 'Seeder', 'Sprayer', 'Rotavator', 'Cultivator', 'Other'];
const TIME_SLOTS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00'];

export default function MachineryPage() {
  const { profile, t } = useAuth();
  const [machinery, setMachinery] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [bookingMachine, setBookingMachine] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [bookingLocation, setBookingLocation] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Tractor');
  const [pricePerHour, setPricePerHour] = useState('');
  const [mLocation, setMLocation] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [machRes, bookRes] = await Promise.all([
        supabase.from('machinery').select('*, profiles:owner_id(full_name), villages(name)').order('created_at', { ascending: false }),
        supabase.from('machinery_bookings').select('*, machinery:machinery(name, type)').eq('user_id', profile.id).order('booking_date', { ascending: false }),
      ]);
      setMachinery(machRes.data ?? []);
      setMyBookings(bookRes.data ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const addMachine = async () => {
    if (!profile || !name) return;
    await supabase.from('machinery').insert({
      name, type, owner_id: profile.id, price_per_hour: parseFloat(pricePerHour) || 0, location: mLocation,
    });
    setShowAddModal(false); setName(''); setPricePerHour(''); setMLocation('');
    fetchData();
  };

  const bookMachine = async () => {
    if (!profile || !bookingMachine) return;
    setBookingError(null);
    const start = parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60;
    const end = parseInt(endTime.split(':')[0]) + parseInt(endTime.split(':')[1]) / 60;
    const hours = Math.max(0.5, end - start);
    if (end <= start) { setBookingError('End time must be after start time.'); return; }
    const total = Number(bookingMachine.price_per_hour) * hours;
    const { data: existing } = await supabase
      .from('machinery_bookings')
      .select('id, start_time, end_time')
      .eq('machinery_id', bookingMachine.id)
      .eq('booking_date', bookingDate)
      .in('status', ['PENDING', 'CONFIRMED']);
    if (existing) {
      for (const b of existing) {
        const bStart = parseInt(b.start_time.split(':')[0]) + parseInt(b.start_time.split(':')[1]) / 60;
        const bEnd = parseInt(b.end_time.split(':')[0]) + parseInt(b.end_time.split(':')[1]) / 60;
        if (start < bEnd && end > bStart) { setBookingError('This time overlaps with an existing booking. Please choose a different time.'); return; }
      }
    }
    const { error: e } = await supabase.from('machinery_bookings').insert({
      machinery_id: bookingMachine.id, user_id: profile.id, booking_date: bookingDate,
      start_time: startTime, end_time: endTime, location: bookingLocation, total_price: total, status: 'PENDING',
    });
    if (e) { setBookingError(e.message); return; }
    setBookingMachine(null); setBookingDate(''); setBookingLocation('');
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Machinery</h2><p className="text-sm text-stone-500">Book or list farm machinery</p></div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary"><Plus size={18} /> List Machinery</button>
      </div>
      {myBookings.length > 0 && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Calendar size={18} /> My Bookings</h3>
          <div className="space-y-2">
            {myBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div><p className="font-semibold text-sm text-stone-700">{b.machinery?.name}</p><p className="text-xs text-stone-400">{formatDate(b.booking_date)} · {b.start_time}-{b.end_time}</p></div>
                <div className="text-right"><span className="badge-neutral">{b.status}</span><p className="text-xs text-stone-500 mt-1">{formatCurrency(b.total_price)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machinery.length === 0 ? <div className="col-span-full card-pad"><EmptyState icon={<Tractor size={32} />} title="No machinery listed" /></div>
        : machinery.map((m) => (
          <div key={m.id} className="card-pad">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl bg-wheat-50 text-wheat-500"><Tractor size={24} /></div>
              <div className="flex items-center gap-1 text-sm text-stone-400">{m.rating > 0 && <><Star size={14} className="text-accent-500 fill-accent-500" /> {m.rating}</>}</div>
            </div>
            <h3 className="font-bold text-stone-800">{m.name}</h3>
            <p className="text-sm text-stone-400">{m.type} · {m.villages?.name || m.location || '—'}</p>
            <p className="text-sm text-stone-500 mt-1">Owner: {m.profiles?.full_name || '—'}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-lg font-bold text-primary-600">{formatCurrency(m.price_per_hour)}/hr</p>
              <span className={`badge ${m.is_available ? 'badge-primary' : 'badge-neutral'}`}>{m.is_available ? 'Available' : 'Busy'}</span>
            </div>
            <button onClick={() => { setBookingMachine(m); setBookingError(null); }} disabled={!m.is_available || m.owner_id === profile?.id} className="btn-secondary w-full mt-3 text-sm">
              {m.owner_id === profile?.id ? 'Your machinery' : 'Book Now'}
            </button>
          </div>
        ))}
      </div>
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="List Machinery">
        <div className="space-y-4">
          <div><label className="label-text">Name</label><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mahindra Tractor 575" /></div>
          <div><label className="label-text">Type</label><select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>{MACHINE_TYPES.map((mt) => <option key={mt}>{mt}</option>)}</select></div>
          <div><label className="label-text">Price per Hour (₹)</label><input type="number" className="input-field" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} placeholder="300" /></div>
          <div><label className="label-text">Location</label><input className="input-field" value={mLocation} onChange={(e) => setMLocation(e.target.value)} placeholder="Rampur" /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowAddModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={addMachine} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>
      <Modal open={!!bookingMachine} onClose={() => setBookingMachine(null)} title={`Book ${bookingMachine?.name}`} size="sm">
        <div className="space-y-4">
          {bookingError && <div className="p-3 rounded-xl bg-error-50 border border-error-500/20 text-error-600 text-sm">{bookingError}</div>}
          <div><label className="label-text">Date</label><input type="date" className="input-field" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Start Time</label><select className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)}>{TIME_SLOTS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label-text">End Time</label><select className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)}>{TIME_SLOTS.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="label-text">Location</label><input className="input-field" value={bookingLocation} onChange={(e) => setBookingLocation(e.target.value)} placeholder="Your farm location" /></div>
          <p className="text-sm text-stone-500">Estimated cost: {formatCurrency(Number(bookingMachine?.price_per_hour || 0) * Math.max(0.5, (parseInt(endTime.split(':')[0]) + parseInt(endTime.split(':')[1]) / 60) - (parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60)))}</p>
          <div className="flex gap-2 justify-end"><button onClick={() => setBookingMachine(null)} className="btn-ghost">{t('cancel')}</button><button onClick={bookMachine} className="btn-primary">{t('confirm')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
