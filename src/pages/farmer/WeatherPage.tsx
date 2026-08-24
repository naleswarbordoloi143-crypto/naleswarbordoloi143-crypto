import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { CloudRain, Cloud, Sun, Wind, Droplets, AlertTriangle } from 'lucide-react';

interface WeatherData {
  current: { temp: number; humidity: number; wind: number; weatherCode: number; rain: number };
  forecast: { date: string; temp_max: number; temp_min: number; rain: number; weatherCode: number }[];
}

export default function WeatherPage() {
  const { profile } = useAuth();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locationLabel, setLocationLabel] = useState<string>('');

  const fetchWeather = async (lat: number, lon: number, label?: string) => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ lat, lon }),
      });
      if (res.ok) {
        setWeather(await res.json());
        if (label) setLocationLabel(label);
      } else {
        setError('Weather service unavailable. Configure the weather edge function.');
      }
      const { data: wa } = await supabase.from('weather_alerts').select('*').order('alert_date', { ascending: false }).limit(5);
      setAlerts(wa ?? []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!profile) return;
    (async () => {
      // Try browser geolocation first
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`, {
                headers: { 'User-Agent': 'KishanBhai/1.0' },
              });
              if (revRes.ok) {
                const revData = await revRes.json();
                const addr = revData.address || {};
                const label = [addr.village || addr.town || addr.city || addr.county || addr.district, addr.state].filter(Boolean).join(', ');
                await fetchWeather(latitude, longitude, label);
                return;
              }
            } catch { /* fall through */ }
            await fetchWeather(latitude, longitude);
          },
          async () => {
            // Geolocation denied — fall back to village from profile
            const { data: village } = await supabase.from('villages').select('latitude, longitude').ilike('name', profile.village || '').maybeSingle();
            await fetchWeather(village?.latitude ?? 28.6, village?.longitude ?? 77.2, profile.village || '');
          },
          { timeout: 10000, enableHighAccuracy: false }
        );
      } else {
        // No geolocation support — use village from profile
        const { data: village } = await supabase.from('villages').select('latitude, longitude').ilike('name', profile.village || '').maybeSingle();
        await fetchWeather(village?.latitude ?? 28.6, village?.longitude ?? 77.2, profile.village || '');
      }
    })();
  }, [profile]);

  const weatherIcon = (code: number) => {
    if (code === 0) return <Sun size={28} className="text-accent-500" />;
    if (code < 50) return <Cloud size={28} className="text-stone-400" />;
    return <CloudRain size={28} className="text-blue-500" />;
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!weather) return <EmptyState icon={<CloudRain size={32} />} title="No weather data" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">{locationLabel || profile?.village || 'Your Location'}</p>
            <p className="text-4xl font-bold mt-1">{Math.round(weather.current.temp)}°C</p>
            <p className="text-blue-100 text-sm mt-1">Humidity: {weather.current.humidity}% · Wind: {weather.current.wind} km/h</p>
          </div>
          <div className="p-4 bg-white/15 rounded-2xl backdrop-blur-sm">{weatherIcon(weather.current.weatherCode)}</div>
        </div>
        {weather.current.rain > 0 && <div className="mt-4 bg-white/10 rounded-xl p-3 text-sm"><Droplets size={16} className="inline mr-1" /> Rain: {weather.current.rain} mm</div>}
      </div>
      {alerts.length > 0 && (
        <div className="card-pad">
          <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><AlertTriangle size={20} className="text-warning-600" /> Weather Alerts</h3>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className={`p-3 rounded-xl ${a.severity === 'severe' ? 'bg-error-50 border border-error-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <p className="font-semibold text-sm text-stone-700">{a.title}</p>
                <p className="text-xs text-stone-500 mt-1">{a.description}</p>
                <p className="text-xs text-stone-400 mt-1">{formatDate(a.alert_date)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3">7-Day Forecast</h3>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {weather.forecast.map((f, i) => (
            <div key={i} className="text-center p-3 rounded-xl bg-stone-50">
              <p className="text-xs text-stone-400">{new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
              <div className="my-2 flex justify-center">{weatherIcon(f.weatherCode)}</div>
              <p className="text-sm font-semibold text-stone-700">{Math.round(f.temp_max)}°</p>
              <p className="text-xs text-stone-400">{Math.round(f.temp_min)}°</p>
              {f.rain > 0 && <p className="text-xs text-blue-500 mt-1">{f.rain}mm</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
