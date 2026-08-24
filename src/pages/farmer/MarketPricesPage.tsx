import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, RefreshCw, MapPin, Sparkles, Search, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketPrice {
  crop_name: string;
  price_per_kg: number;
  market: string;
  state: string;
  district: string;
  trend: string;
  change_percent: number;
  source: string;
  min_price: number;
  max_price: number;
  arrival_date: string;
}

interface PricePrediction {
  crop_name: string;
  current_price: number;
  predicted_price: number;
  trend: string;
  horizon_days: number;
  confidence: number;
  reasoning: string;
  advisory_note: string;
}

export default function MarketPricesPage() {
  const { profile } = useAuth();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [predictions, setPredictions] = useState<PricePrediction[]>([]);
  const [savedPrices, setSavedPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [locationLabel, setLocationLabel] = useState('');

  const callEdgeFunction = useCallback(async (action: string) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-prices`;
    const body: any = { action };
    if (profile?.state) body.state = profile.state;
    if (profile?.district) body.district = profile.district;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Market price service unavailable');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }, [profile]);

  const fetchSavedPrices = async () => {
    const { data } = await supabase
      .from('market_prices')
      .select('*')
      .order('recorded_date', { ascending: false })
      .limit(20);
    setSavedPrices(data ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const locLabel = [profile?.district, profile?.state].filter(Boolean).join(', ');
        if (locLabel) setLocationLabel(locLabel);

        const data = await callEdgeFunction('prices');
        if (data.prices && data.prices.length > 0) {
          setPrices(data.prices);
        } else {
          setError('Could not fetch live market prices right now. Showing saved prices below.');
          await fetchSavedPrices();
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load market prices');
        await fetchSavedPrices();
      }
      setLoading(false);
    })();
  }, [profile]);

  const handlePredict = async () => {
    setPredicting(true);
    setPredictError(null);
    try {
      const data = await callEdgeFunction('predict');
      if (data.predictions && data.predictions.length > 0) {
        setPredictions(data.predictions);
      } else if (data.error) {
        setPredictError(data.error);
      } else {
        setPredictError('Could not generate predictions. Please try again.');
      }
    } catch (e: any) {
      setPredictError(e.message || 'Prediction service unavailable');
    }
    setPredicting(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEdgeFunction('prices');
      if (data.prices && data.prices.length > 0) {
        setPrices(data.prices);
        setPredictions([]);
      } else {
        setError('Could not fetch live prices. Showing saved prices.');
        await fetchSavedPrices();
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const filteredPrices = prices.filter((p) =>
    p.crop_name.toLowerCase().includes(search.toLowerCase()) ||
    p.market.toLowerCase().includes(search.toLowerCase())
  );

  const trendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp size={16} className="text-success-600" />;
    if (trend === 'down') return <TrendingDown size={16} className="text-error-600" />;
    return <Minus size={16} className="text-stone-400" />;
  };

  if (loading) return <CardSpinner />;
  if (error && prices.length === 0 && savedPrices.length === 0) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Market Prices</h2>
          <p className="text-sm text-stone-500 flex items-center gap-1">
            <MapPin size={14} /> {locationLabel || 'India'} · Live mandi prices
          </p>
        </div>
        <button onClick={handleRefresh} disabled={loading} className="btn-secondary text-sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-warning-50 border border-warning-200 text-warning-600 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          className="input-field pl-10"
          placeholder="Search by crop or market..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredPrices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrices.map((p, i) => (
            <div key={i} className="card-pad group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-stone-800">{p.crop_name}</h3>
                  <p className="text-xs text-stone-400">{p.market || 'Mandi'} · {p.arrival_date || formatDate(new Date().toISOString())}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {trendIcon(p.trend)}
                  {p.change_percent !== 0 && (
                    <span className={cn('font-semibold text-xs', p.trend === 'up' ? 'text-success-600' : p.trend === 'down' ? 'text-error-600' : 'text-stone-400')}>
                      {p.change_percent > 0 ? '+' : ''}{p.change_percent}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-primary-600">{formatCurrency(p.price_per_kg)}</p>
                <p className="text-sm text-stone-400">/kg</p>
              </div>
              {(p.min_price > 0 || p.max_price > 0) && (
                <div className="flex gap-3 mt-2 text-xs text-stone-400">
                  <span>Min: {formatCurrency(p.min_price)}/kg</span>
                  <span>Max: {formatCurrency(p.max_price)}/kg</span>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-stone-100">
                <span className="badge-neutral">{p.source}</span>
              </div>
            </div>
          ))}
        </div>
      ) : savedPrices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedPrices.map((m) => (
            <div key={m.id} className="card-pad">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-stone-800">{m.crop_name}</h3>
                {trendIcon(m.trend || 'stable')}
              </div>
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(m.price_per_kg)}<span className="text-sm text-stone-400">/kg</span></p>
              <p className="text-xs text-stone-400 mt-1">{m.market || '—'} · {formatDate(m.recorded_date)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-pad">
          <EmptyState icon={<TrendingUp size={32} />} title="No prices available" description="Try refreshing to fetch live mandi prices" />
        </div>
      )}

      <div className="card-pad bg-gradient-to-br from-primary-50 to-accent-50 border-primary-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <Sparkles size={20} className="text-accent-500" /> Price Predictions
            </h3>
            <p className="text-sm text-stone-500 mt-0.5">AI-powered 30-day price forecasts based on market trends</p>
          </div>
          <button onClick={handlePredict} disabled={predicting} className="btn-primary text-sm">
            {predicting ? <><RefreshCw size={16} className="animate-spin" /> Analyzing...</> : <><Sparkles size={16} /> Get Predictions</>}
          </button>
        </div>

        {predictError && (
          <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm mb-4">
            {predictError}
          </div>
        )}

        {predictions.length > 0 ? (
          <div className="space-y-3">
            {predictions.map((p, i) => {
              const diff = p.predicted_price - p.current_price;
              const pct = p.current_price > 0 ? (diff / p.current_price) * 100 : 0;
              return (
                <div key={i} className="p-4 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-stone-800">{p.crop_name}</h4>
                    <div className="flex items-center gap-2">
                      {trendIcon(p.trend)}
                      <span className={cn('text-sm font-semibold', p.trend === 'up' ? 'text-success-600' : p.trend === 'down' ? 'text-error-600' : 'text-stone-400')}>
                        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <p className="text-xs text-stone-400">Current</p>
                      <p className="font-semibold text-stone-700">{formatCurrency(p.current_price)}/kg</p>
                    </div>
                    <div className="text-stone-300">→</div>
                    <div>
                      <p className="text-xs text-stone-400">Predicted ({p.horizon_days}d)</p>
                      <p className="font-semibold text-primary-600">{formatCurrency(p.predicted_price)}/kg</p>
                    </div>
                    <div className="ml-auto">
                      <p className="text-xs text-stone-400">Confidence</p>
                      <p className="font-semibold text-stone-600">{p.confidence}%</p>
                    </div>
                  </div>
                  {p.reasoning && <p className="text-xs text-stone-500 mt-2 leading-relaxed">{p.reasoning}</p>}
                  {p.advisory_note && (
                    <div className="mt-2 p-2 rounded-lg bg-accent-50 text-xs text-accent-700 flex items-start gap-1.5">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      {p.advisory_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          !predicting && !predictError && (
            <div className="text-center py-6">
              <p className="text-sm text-stone-500">Click "Get Predictions" to generate AI-powered price forecasts for your crops.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
