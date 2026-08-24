import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Farm, Crop, FarmCrop } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { Plus, MapPin, Sprout, Edit } from 'lucide-react';

export default function FarmPage() {
  const { profile, t } = useAuth();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [crops, setCrops] = useState<FarmCrop[]>([]);
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFarmModal, setShowFarmModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [soilType, setSoilType] = useState('');
  const [irrigation, setIrrigation] = useState('');
  const [cropName, setCropName] = useState('');
  const [cropArea, setCropArea] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [expectedYield, setExpectedYield] = useState('');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const [farmRes, cropsRes, masterRes] = await Promise.all([
        supabase.from('farms').select('*').eq('user_id', profile.id).maybeSingle(),
        supabase.from('farm_crops').select('*, farm:farms!inner(user_id)').eq('farm.user_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('crops').select('*').order('name'),
      ]);
      setFarm(farmRes.data as Farm | null);
      setCrops((cropsRes.data as unknown as FarmCrop[]) ?? []);
      setAllCrops((masterRes.data as Crop[]) ?? []);
      if (farmRes.data) {
        setFarmName(farmRes.data.name || '');
        setFarmSize(String(farmRes.data.size_acres || ''));
        setFarmLocation(farmRes.data.location || '');
        setSoilType(farmRes.data.soil_type || '');
        setIrrigation(farmRes.data.irrigation_source || '');
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const saveFarm = async () => {
    if (!profile) return;
    if (farm) {
      await supabase.from('farms').update({
        name: farmName, size_acres: parseFloat(farmSize) || 0, location: farmLocation,
        soil_type: soilType, irrigation_source: irrigation, updated_at: new Date().toISOString(),
      }).eq('id', farm.id);
    } else {
      await supabase.from('farms').insert({
        user_id: profile.id, name: farmName || 'My Farm', size_acres: parseFloat(farmSize) || 0,
        location: farmLocation, soil_type: soilType, irrigation_source: irrigation,
      });
    }
    setShowFarmModal(false); fetchData();
  };

  const addCrop = async () => {
    if (!farm) return;
    const selectedCrop = allCrops.find((c) => c.name === cropName);
    await supabase.from('farm_crops').insert({
      farm_id: farm.id, crop_id: selectedCrop?.id ?? null, crop_name: cropName,
      area_acres: parseFloat(cropArea) || 0, planting_date: plantingDate || null,
      expected_harvest_date: harvestDate || null, expected_yield_kg: parseFloat(expectedYield) || 0,
      status: 'planted',
    });
    setShowCropModal(false);
    setCropName(''); setCropArea(''); setPlantingDate(''); setHarvestDate(''); setExpectedYield('');
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-pad">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-stone-800 text-lg">{farm?.name || 'My Farm'}</h3>
            <p className="text-sm text-stone-400">{farm ? `${farm.size_acres} acres` : 'Set up your farm to begin'}</p>
          </div>
          <button onClick={() => setShowFarmModal(true)} className="btn-secondary text-sm">
            {farm ? <><Edit size={16} /> {t('edit')}</> : <><Plus size={16} /> {t('create')}</>}
          </button>
        </div>
        {farm && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">Location</p><p className="text-sm font-semibold text-stone-700 flex items-center gap-1"><MapPin size={14} /> {farm.location || '—'}</p></div>
            <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">Soil Type</p><p className="text-sm font-semibold text-stone-700">{farm.soil_type || '—'}</p></div>
            <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">Irrigation</p><p className="text-sm font-semibold text-stone-700">{farm.irrigation_source || '—'}</p></div>
            <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">Size</p><p className="text-sm font-semibold text-stone-700">{farm.size_acres} acres</p></div>
          </div>
        )}
      </div>

      <div className="card-pad">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-800 flex items-center gap-2"><Sprout size={20} className="text-primary-600" /> Crops</h3>
          {farm && <button onClick={() => setShowCropModal(true)} className="btn-primary text-sm"><Plus size={16} /> Add Crop</button>}
        </div>
        {!farm ? <EmptyState icon={<Sprout size={32} />} title="Create your farm first" description="Add your farm details to start managing crops" />
        : crops.length === 0 ? <EmptyState icon={<Sprout size={32} />} title="No crops yet" description="Add your first crop to track planting and harvest" />
        : (
          <div className="space-y-3">
            {crops.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-stone-100 bg-stone-50">
                <div>
                  <p className="font-semibold text-stone-700">{c.crop_name}</p>
                  <p className="text-sm text-stone-400">{c.area_acres} acres · Planted {formatDate(c.planting_date)}</p>
                  <p className="text-sm text-stone-400">Expected yield: {c.expected_yield_kg} kg · Harvest: {formatDate(c.expected_harvest_date)}</p>
                </div>
                <span className="badge-primary">{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showFarmModal} onClose={() => setShowFarmModal(false)} title={farm ? 'Edit Farm' : 'Create Farm'}>
        <div className="space-y-4">
          <div><label className="label-text">Farm Name</label><input className="input-field" value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="My Farm" /></div>
          <div><label className="label-text">Size (acres)</label><input type="number" step="0.01" className="input-field" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} placeholder="2.5" /></div>
          <div><label className="label-text">Location</label><input className="input-field" value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="Rampur, UP" /></div>
          <div><label className="label-text">Soil Type</label><select className="input-field" value={soilType} onChange={(e) => setSoilType(e.target.value)}><option value="">Select soil type</option><option>Clay</option><option>Sandy</option><option>Loamy</option><option>Black</option><option>Red</option><option>Alluvial</option></select></div>
          <div><label className="label-text">Irrigation Source</label><select className="input-field" value={irrigation} onChange={(e) => setIrrigation(e.target.value)}><option value="">Select source</option><option>Borewell</option><option>Canal</option><option>River</option><option>Rainfed</option><option>Drip</option><option>Sprinkler</option></select></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowFarmModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={saveFarm} className="btn-primary">{t('save')}</button></div>
        </div>
      </Modal>

      <Modal open={showCropModal} onClose={() => setShowCropModal(false)} title="Add Crop" size="md">
        <div className="space-y-4">
          <div><label className="label-text">Crop</label><select className="input-field" value={cropName} onChange={(e) => setCropName(e.target.value)}><option value="">Select crop</option>{allCrops.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}<option value="Other">Other</option></select></div>
          <div><label className="label-text">Area (acres)</label><input type="number" step="0.01" className="input-field" value={cropArea} onChange={(e) => setCropArea(e.target.value)} placeholder="1.5" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Planting Date</label><input type="date" className="input-field" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} /></div>
            <div><label className="label-text">Expected Harvest</label><input type="date" className="input-field" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} /></div>
          </div>
          <div><label className="label-text">Expected Yield (kg)</label><input type="number" className="input-field" value={expectedYield} onChange={(e) => setExpectedYield(e.target.value)} placeholder="500" /></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowCropModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={addCrop} className="btn-primary">{t('add')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
