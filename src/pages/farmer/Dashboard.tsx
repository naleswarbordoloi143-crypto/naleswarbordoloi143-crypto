import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils';
import { Sprout, CloudRain, IndianRupee, Tractor, ShoppingBag, Wheat, Bell, Award, TrendingUp, Wallet, MapPin } from 'lucide-react';

export default function FarmerDashboard() {
  const { profile, t } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farm, setFarm] = useState<any>(null);
  const [farmCrops, setFarmCrops] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<any[]>([]);
  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  const [harvests, setHarvests] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const uid = profile.id;
        const [farmRes, cropsRes, expRes, salesRes, bookRes, ordRes, notifRes, waRes, mpRes, harvRes] = await Promise.all([
          supabase.from('farms').select('*').eq('user_id', uid).maybeSingle(),
          supabase.from('farm_crops').select('*, farm:farms!inner(user_id)').eq('farm.user_id', uid),
          supabase.from('farm_expenses').select('*').eq('user_id', uid).order('expense_date', { ascending: false }).limit(10),
          supabase.from('farm_sales').select('*').eq('user_id', uid).order('sale_date', { ascending: false }).limit(10),
          supabase.from('machinery_bookings').select('*, machinery:machinery(name,type)').eq('user_id', uid).order('booking_date', { ascending: false }).limit(5),
          supabase.from('buyer_orders').select('*').eq('farmer_id', uid).order('created_at', { ascending: false }).limit(5),
          supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
          supabase.from('weather_alerts').select('*').order('alert_date', { ascending: false }).limit(3),
          supabase.from('market_prices').select('*').order('recorded_date', { ascending: false }).limit(6),
          supabase.from('harvests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
        ]);
        setFarm(farmRes.data);
        setFarmCrops((cropsRes.data as any[]) ?? []);
        setExpenses((expRes.data as any[]) ?? []);
        setSales((salesRes.data as any[]) ?? []);
        setBookings((bookRes.data as any[]) ?? []);
        setOrders((ordRes.data as any[]) ?? []);
        setNotifications((notifRes.data as any[]) ?? []);
        setWeatherAlerts((waRes.data as any[]) ?? []);
        setMarketPrices((mpRes.data as any[]) ?? []);
        setHarvests((harvRes.data as any[]) ?? []);
      } catch (e: any) {
        setError(e.message || 'Failed to load dashboard');
      }
      setLoading(false);
    })();
  }, [profile]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = sales.reduce((s, e) => s + Number(e.total_amount), 0);
  const profit = totalRevenue - totalExpenses;
  const currentCrop = farmCrops.find((c) => c.status === 'planted');
  const expectedHarvest = farmCrops.reduce((s, c) => s + Number(c.expected_yield_kg), 0);

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-6 text-white shadow-card">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-400/10 rounded-full blur-3xl translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{t('appName')}, {profile?.full_name}!</h1>
          </div>
          {profile?.village && (
            <p className="text-primary-100 flex items-center gap-1.5">
              <MapPin size={14} />
              {profile.village}{profile?.state && `, ${profile.state}`}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2.5 text-sm">
            <div className="bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm border border-white/10">
              <span className="text-primary-100">Farm: </span>
              <span className="font-semibold">{farm ? `${farm.size_acres} acres` : 'Not set up'}</span>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm border border-white/10">
              <span className="text-primary-100">Crop: </span>
              <span className="font-semibold">{currentCrop?.crop_name || '—'}</span>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm border border-white/10">
              <span className="text-primary-100">Points: </span>
              <span className="font-semibold">{profile?.points_balance}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<IndianRupee size={22} />} color="success" />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={<Wallet size={22} />} color="warning" />
        <StatCard label="Profit" value={formatCurrency(profit)} icon={<TrendingUp size={22} />} color="primary" trend={profit >= 0 ? 'Profit' : 'Loss'} />
        <StatCard label="Expected Harvest" value={`${expectedHarvest} kg`} icon={<Wheat size={22} />} color="wheat" />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-pad lg:col-span-2">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Sprout size={20} className="text-primary-600" /> Current Crops</h3>
          {farmCrops.length === 0 ? (
            <EmptyState icon={<Sprout size={32} />} title="No crops planted yet" description="Add crops to your farm to start tracking" className="py-8" />
          ) : (
            <div className="space-y-3">
              {farmCrops.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100 hover:border-primary-200 transition-colors">
                  <div>
                    <p className="font-semibold text-stone-700">{c.crop_name}</p>
                    <p className="text-sm text-stone-400">{c.area_acres} acres · Planted {formatDate(c.planting_date)}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge-primary">{c.status}</span>
                    <p className="text-sm text-stone-500 mt-1">Harvest: {formatDate(c.expected_harvest_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><CloudRain size={20} className="text-blue-500" /> Weather Alerts</h3>
          {weatherAlerts.length === 0 ? (
            <EmptyState icon={<CloudRain size={32} />} title="No alerts" className="py-8" />
          ) : (
            <div className="space-y-3">
              {weatherAlerts.map((w) => (
                <div key={w.id} className={`p-3 rounded-xl border ${w.severity === 'severe' ? 'bg-error-50 border-error-500/20' : 'bg-blue-50 border-blue-200'}`}>
                  <p className="font-semibold text-sm text-stone-700">{w.title}</p>
                  <p className="text-xs text-stone-500 mt-1">{w.description}</p>
                  <p className="text-xs text-stone-400 mt-1">{formatDate(w.alert_date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad lg:col-span-2">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-accent-600" /> Market Prices</h3>
          {marketPrices.length === 0 ? (
            <EmptyState icon={<TrendingUp size={32} />} title="No prices available" className="py-8" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {marketPrices.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100 hover:border-primary-200 transition-colors">
                  <p className="font-semibold text-stone-700 text-sm">{m.crop_name}</p>
                  <p className="text-lg font-bold text-primary-600">{formatCurrency(m.price_per_kg)}/kg</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Bell size={20} className="text-stone-500" /> Recent Updates</h3>
          {notifications.length === 0 ? (
            <EmptyState icon={<Bell size={32} />} title="No notifications" className="py-8" />
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className={`p-3 rounded-xl ${n.is_read ? 'bg-stone-50' : 'bg-primary-50 border border-primary-100'}`}>
                  <p className="font-semibold text-sm text-stone-700">{n.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Tractor size={20} className="text-wheat-500" /> Machinery Bookings</h3>
          {bookings.length === 0 ? (
            <EmptyState icon={<Tractor size={32} />} title="No bookings" className="py-8" />
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <p className="font-semibold text-sm text-stone-700">{b.machinery?.name}</p>
                  <p className="text-xs text-stone-400">{formatDate(b.booking_date)} · {b.start_time}</p>
                  <span className="badge-neutral mt-1">{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><ShoppingBag size={20} className="text-primary-600" /> Buyer Orders</h3>
          {orders.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={32} />} title="No orders" className="py-8" />
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <p className="font-semibold text-sm text-stone-700">{o.crop_name} · {o.quantity_kg} kg</p>
                  <p className="text-xs text-stone-400">{formatCurrency(o.total_amount)}</p>
                  <span className="badge-primary mt-1">{o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Wheat size={20} className="text-accent-500" /> Harvest Status</h3>
          {harvests.length === 0 ? (
            <EmptyState icon={<Wheat size={32} />} title="No harvests" className="py-8" />
          ) : (
            <div className="space-y-2">
              {harvests.map((h) => (
                <div key={h.id} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <p className="font-semibold text-sm text-stone-700">{h.crop_name}</p>
                  <p className="text-xs text-stone-400">{h.expected_quantity_kg} kg · {formatDate(h.harvest_date)}</p>
                  <span className="badge-neutral mt-1">{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-pad bg-gradient-to-br from-accent-50 to-accent-100 border-accent-200">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Award size={20} className="text-accent-600" /> Rewards</h3>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-accent-600">{profile?.points_balance}</p>
            <p className="text-sm text-stone-500 mt-1">Total Points</p>
          </div>
        </div>
      </div>
    </div>
  );
}
