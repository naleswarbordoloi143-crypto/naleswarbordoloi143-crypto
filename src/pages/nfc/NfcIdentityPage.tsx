import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { NfcTag, NfcFarmerEntity } from '@/lib/types';
import {
  nfcRegister, nfcScan, nfcGenerateId, nfcAssign,
  isNfcSupported, startNfcScan, writeNfcTag, generateQrDataUrl,
} from '@/lib/nfc';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatDate, formatNumber, formatCurrency } from '@/lib/utils';
import {
  Nfc, ScanLine, Smartphone, CheckCircle, XCircle, AlertCircle,
  QrCode, MapPin, Wheat, Users, Copy, RefreshCw, Info, Wifi, WifiOff,
  Package, Truck, TrendingUp,
} from 'lucide-react';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

export default function NfcIdentityPage() {
  const { profile, t } = useAuth();
  const [myTag, setMyTag] = useState<NfcTag | null>(null);
  const [farm, setFarm] = useState<any>(null);
  const [cluster, setCluster] = useState<any>(null);
  const [farmCrop, setFarmCrop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState('');
  const [scannedFarmer, setScannedFarmer] = useState<NfcFarmerEntity | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [writeState, setWriteState] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [writeError, setWriteError] = useState('');
  const [nfcSupported] = useState(isNfcSupported());
  const stopScanRef = useRef<(() => void) | null>(null);
  const [manualTagId, setManualTagId] = useState('');
  const [demoActive, setDemoActive] = useState(false);

  const fetchMyData = async () => {
    if (!profile) return;
    setLoading(true);
    const [tagRes, farmRes] = await Promise.all([
      supabase.from('nfc_tags').select('*').eq('entity_type', 'FARMER').eq('entity_id', profile.id).maybeSingle(),
      supabase.from('farms').select('*').eq('user_id', profile.id).maybeSingle(),
    ]);
    setMyTag(tagRes.data as NfcTag | null);
    setFarm(farmRes.data);

    if (farmRes.data) {
      const [cropRes, clusterMemberRes] = await Promise.all([
        supabase.from('farm_crops').select('*').eq('farm_id', farmRes.data.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cluster_members').select('farm_clusters!inner(*)').eq('user_id', profile.id).maybeSingle(),
      ]);
      setFarmCrop(cropRes.data);
      setCluster((clusterMemberRes.data as any)?.farm_clusters || null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMyData(); }, [profile]);

  const handleGenerateId = async () => {
    const result = await nfcGenerateId('FARMER');
    if (result.tagUid) setGeneratedId(result.tagUid);
  };

  const handleRegisterAndAssign = async () => {
    if (!profile || !generatedId) return;
    const regResult = await nfcRegister(generatedId, 'FARMER', profile.id);
    if (regResult.error) { setWriteError(regResult.error); return; }
    const assignResult = await nfcAssign(generatedId, 'FARMER', profile.id);
    if (assignResult.error) { setWriteError(assignResult.error); return; }
    setShowWriteModal(false);
    setGeneratedId('');
    setWriteState('idle');
    setWriteError('');
    fetchMyData();
  };

  const handleWriteNfc = async () => {
    if (!generatedId) return;
    setWriteState('writing');
    setWriteError('');
    await writeNfcTag(
      generatedId,
      () => {
        setWriteState('success');
        handleRegisterAndAssign();
      },
      (msg) => {
        setWriteState('error');
        setWriteError(msg);
      },
    );
  };

  const startScanning = async () => {
    setScanState('scanning');
    setScanError('');
    setScannedFarmer(null);

    if (!nfcSupported) {
      setScanState('error');
      setScanError(t('nfcNotSupported'));
      return;
    }

    const stop = await startNfcScan(
      async (uid: string) => {
        stopScanRef.current?.();
        stopScanRef.current = null;
        setShowScanModal(false);
        await handleScanResult(uid);
      },
      (msg: string) => {
        setScanState('error');
        setScanError(msg);
      },
    );
    stopScanRef.current = stop;
  };

  const stopScanning = () => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScanState('idle');
    setShowScanModal(false);
  };

  const handleScanResult = async (uid: string) => {
    setScanState('scanning');
    const result = await nfcScan(uid);
    if (result.error) {
      setScanState('error');
      setScanError(result.error);
      return;
    }
    if (result.entity?.type === 'FARMER') {
      setScannedFarmer(result.entity as NfcFarmerEntity);
      setScanState('success');
    } else if (result.entity) {
      setScanState('error');
      setScanError(t('nfcNotFarmerTag'));
    } else {
      setScanState('error');
      setScanError(t('nfcEntityNotFound'));
    }
  };

  const handleManualScan = async () => {
    if (!manualTagId.trim()) return;
    setShowScanModal(false);
    await handleScanResult(manualTagId.trim());
    setManualTagId('');
  };

  const handleDemoFarmer = () => {
    setDemoActive(true);
    setScannedFarmer({
      type: 'FARMER',
      farmerId: 'KB-F-1024',
      name: 'Ramesh Kumar',
      village: 'ABC Village',
      district: 'Pune',
      state: 'Maharashtra',
      phone: '9876543210',
      email: 'ramesh@example.com',
      avatarUrl: '',
      isActive: true,
      memberSince: '2026-01-15',
      farmSize: 2.5,
      farmName: 'Ramesh Farm',
      soilType: 'Black Soil',
      irrigationSource: 'Borewell',
      farmLocation: 'Pune, Maharashtra',
      cluster: 'VC-07',
      clusterCrop: 'Wheat',
      farmCrops: [
        { crop_name: 'Wheat', status: 'growing', area_acres: 1.5, expected_yield_kg: 1200 },
        { crop_name: 'Soybean', status: 'harvested', area_acres: 1.0, expected_yield_kg: 800 },
      ],
      harvestLots: [
        { crop_name: 'Soybean', quantity_kg: 800, quality_grade: 'Grade A', harvest_date: '2026-07-15', status: 'SOLD', price_per_kg: 45, location: 'Pune' },
      ],
      machinery: [
        { name: 'Tractor', type: 'Heavy', price_per_hour: 300, available: true, location: 'Pune' },
      ],
      totalContributionKg: 800,
      currentCrop: 'Wheat',
      cropStatus: 'Growing',
    });
    setScanState('success');
  };

  useEffect(() => {
    return () => { stopScanRef.current?.(); };
  }, []);

  if (loading) return <CardSpinner />;

  const farmerCardData = myTag ? {
    farmerId: myTag.tag_uid,
    name: profile?.full_name || '',
    village: profile?.village || '',
    district: profile?.district || '',
    state: profile?.state || '',
    farmSize: farm?.size_acres || null,
    farmName: farm?.name || null,
    cluster: cluster?.name || null,
    currentCrop: farmCrop?.crop_name || null,
    cropStatus: farmCrop?.status || null,
  } : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-600 rounded-xl text-white"><Nfc size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">{t('nfcIdentityTitle')}</h2>
          <p className="text-sm text-stone-500">{t('nfcIdentityDesc')}</p>
        </div>
      </div>

      {/* NFC support indicator */}
      <div className={`rounded-xl p-3 flex items-center gap-3 ${nfcSupported ? 'bg-success-50 border border-success-500/20' : 'bg-warning-50 border border-warning-500/20'}`}>
        {nfcSupported ? <Wifi size={18} className="text-success-600" /> : <WifiOff size={18} className="text-warning-600" />}
        <p className="text-sm text-stone-600">
          {nfcSupported ? t('nfcAvailable') : t('nfcNotAvailableQR')}
        </p>
      </div>

      {/* My NFC Card */}
      {farmerCardData ? (
        <div className="rounded-2xl overflow-hidden shadow-md">
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary-200">Kishan Bhai</p>
                <h3 className="text-lg font-bold mt-1">{farmerCardData.name}</h3>
                <p className="text-sm text-primary-100 mt-0.5">{farmerCardData.farmerId}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2">
                <Nfc size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={<MapPin size={14} />} label={t('village')} value={farmerCardData.village || '—'} />
              <InfoRow icon={<Users size={14} />} label={t('nfcCluster')} value={farmerCardData.cluster || '—'} />
              <InfoRow icon={<Wheat size={14} />} label={t('nfcCurrentCrop')} value={farmerCardData.currentCrop || '—'} />
              <InfoRow label={t('nfcFarmSize')} value={farmerCardData.farmSize ? `${farmerCardData.farmSize} acres` : '—'} />
            </div>
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${myTag.status === 'ACTIVE' ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'}`}>
                {myTag.status === 'ACTIVE' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {t('nfcStatus')}: {myTag.status}
              </span>
              <span className="text-xs text-stone-400">{t('nfcLastScan')}: {formatDate(myTag.last_scanned_at)}</span>
            </div>
            {/* QR Code */}
            <div className="flex flex-col items-center pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-2">{t('nfcQRFallback')}</p>
              <img src={generateQrDataUrl(myTag.tag_uid, 160)} alt="QR Code" className="w-40 h-40 rounded-lg border border-stone-200" />
              <button
                onClick={() => navigator.clipboard?.writeText(myTag.tag_uid)}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-primary-600 mt-2"
              >
                <Copy size={12} /> {myTag.tag_uid}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-pad">
          <EmptyState
            icon={<Nfc size={32} />}
            title={t('nfcNoTagAssigned')}
            description={t('nfcNoTagDesc')}
          />
          <button onClick={() => { setShowWriteModal(true); handleGenerateId(); }} className="btn-primary w-full mt-3">
            <Nfc size={18} className="inline mr-1" /> {t('nfcWriteTag')}
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { setShowScanModal(true); setScanState('idle'); setScannedFarmer(null); }} className="btn-secondary flex items-center justify-center gap-2">
          <ScanLine size={18} /> {t('nfcScanTag')}
        </button>
        {farmerCardData && (
          <button onClick={() => { setShowWriteModal(true); handleGenerateId(); }} className="btn-secondary flex items-center justify-center gap-2">
            <Nfc size={18} /> {t('nfcReassignTag')}
          </button>
        )}
      </div>

      {/* Demo section */}
      <div className="card-pad border-2 border-dashed border-warning-300">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-warning-600" />
          <p className="text-sm font-bold text-warning-700">{t('nfcDemoMode')}</p>
        </div>
        <p className="text-xs text-stone-500 mb-3">{t('nfcDemoDesc')}</p>
        <button onClick={handleDemoFarmer} className="btn-secondary w-full text-sm">
          <Smartphone size={16} className="inline mr-1" /> {t('nfcDemoFarmer')}
        </button>
      </div>

      {/* Scan result */}
      {scanState === 'error' && (
        <div className="rounded-xl bg-error-50 border border-error-200 p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-error-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-error-700">{t('nfcScanFailed')}</p>
            <p className="text-xs text-error-600 mt-1">{scanError}</p>
            <button onClick={() => { setScanState('idle'); setScanError(''); }} className="text-xs text-error-600 underline mt-2">{t('close')}</button>
          </div>
        </div>
      )}

      {scanState === 'success' && scannedFarmer && (
        <div className="rounded-2xl border-2 border-success-300 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-success-600 to-success-700 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <CheckCircle size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">{t('nfcTagVerified')}</p>
                <p className="text-xs text-success-100">{demoActive ? t('nfcDemoMode') : t('nfcVerifiedFarmer')}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${scannedFarmer.isActive ? 'bg-white/25' : 'bg-error-500/30'}`}>
                {scannedFarmer.isActive ? t('active') : t('inactive')}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Farmer identity */}
            <div className="text-center pb-3 border-b border-stone-100">
              <p className="text-lg font-bold text-stone-800">{scannedFarmer.name}</p>
              <p className="text-sm text-accent-600 font-semibold">{scannedFarmer.farmerId}</p>
              <p className="text-xs text-stone-400 mt-1">
                {scannedFarmer.village}{scannedFarmer.district ? `, ${scannedFarmer.district}` : ''}{scannedFarmer.state ? `, ${scannedFarmer.state}` : ''}
              </p>
            </div>

            {/* Contact info */}
            {(scannedFarmer.phone || scannedFarmer.email) && (
              <div className="grid grid-cols-2 gap-2">
                {scannedFarmer.phone && (
                  <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Phone</p>
                    <p className="text-xs text-stone-700 mt-0.5">{scannedFarmer.phone}</p>
                  </div>
                )}
                {scannedFarmer.email && (
                  <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Email</p>
                    <p className="text-xs text-stone-700 mt-0.5 truncate">{scannedFarmer.email}</p>
                  </div>
                )}
              </div>
            )}

            {/* Farm details */}
            {scannedFarmer.farmName && (
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wheat size={16} className="text-primary-600" />
                  <p className="text-sm font-bold text-primary-700">{scannedFarmer.farmName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <InfoRow label={t('nfcFarmSize')} value={scannedFarmer.farmSize ? `${scannedFarmer.farmSize} acres` : '—'} />
                  <InfoRow label="Soil" value={scannedFarmer.soilType || '—'} />
                  <InfoRow label="Irrigation" value={scannedFarmer.irrigationSource || '—'} />
                  <InfoRow icon={<MapPin size={14} />} label="Location" value={scannedFarmer.farmLocation || '—'} />
                </div>
              </div>
            )}

            {/* Cluster */}
            {scannedFarmer.cluster && (
              <div className="rounded-xl bg-accent-50 border border-accent-100 p-4 flex items-center gap-3">
                <Users size={18} className="text-accent-600" />
                <div>
                  <p className="text-sm font-bold text-accent-700">{scannedFarmer.cluster}</p>
                  {scannedFarmer.clusterCrop && <p className="text-xs text-accent-600">{scannedFarmer.clusterCrop}</p>}
                </div>
              </div>
            )}

            {/* Crops */}
            {scannedFarmer.farmCrops.length > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-1"><Wheat size={14} /> Crops</p>
                <div className="space-y-1.5">
                  {scannedFarmer.farmCrops.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-stone-700">{c.crop_name}</p>
                        <p className="text-[10px] text-stone-400">{c.area_acres} acres · {c.expected_yield_kg} kg expected</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'harvested' ? 'bg-success-50 text-success-600' :
                        c.status === 'growing' ? 'bg-primary-50 text-primary-600' :
                        'bg-stone-100 text-stone-500'
                      }`}>{c.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Harvest lots */}
            {scannedFarmer.harvestLots.length > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-1"><Package size={14} /> Harvest Lots</p>
                <div className="space-y-1.5">
                  {scannedFarmer.harvestLots.map((lot, i) => (
                    <div key={i} className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-stone-700">{lot.crop_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          lot.status === 'OPEN' || lot.status === 'AVAILABLE' ? 'bg-success-50 text-success-600' :
                          lot.status === 'SOLD' || lot.status === 'CLOSED' ? 'bg-stone-200 text-stone-500' :
                          'bg-primary-50 text-primary-600'
                        }`}>{lot.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-stone-400">
                        <span>{formatNumber(lot.quantity_kg)} kg</span>
                        <span>{formatCurrency(lot.price_per_kg)}/kg</span>
                        <span>{lot.quality_grade}</span>
                        {lot.harvest_date && <span>{formatDate(lot.harvest_date)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Machinery */}
            {scannedFarmer.machinery.length > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-1"><Truck size={14} /> Machinery</p>
                <div className="space-y-1.5">
                  {scannedFarmer.machinery.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-stone-700">{m.name}</p>
                        <p className="text-[10px] text-stone-400">{m.type} · {m.location || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-stone-700">{formatCurrency(m.price_per_hour)}/hr</p>
                        <span className={`text-[10px] font-bold ${m.available ? 'text-success-600' : 'text-stone-400'}`}>
                          {m.available ? 'Available' : 'In Use'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contribution summary */}
            {scannedFarmer.totalContributionKg > 0 && (
              <div className="rounded-xl bg-success-50 border border-success-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-success-600" />
                  <p className="text-xs font-semibold text-success-700">Total Contributed</p>
                </div>
                <p className="text-sm font-bold text-success-800">{formatNumber(scannedFarmer.totalContributionKg)} kg</p>
              </div>
            )}

            <button onClick={() => { setScanState('idle'); setScannedFarmer(null); setDemoActive(false); }} className="btn-ghost w-full text-sm">{t('close')}</button>
          </div>
        </div>
      )}

      {/* Scan modal */}
      <Modal open={showScanModal} onClose={stopScanning} title={t('nfcScannerTitle')} size="sm">
        <div className="space-y-4">
          {scanState === 'idle' && (
            <>
              <div className="flex flex-col items-center py-6">
                <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center mb-4 relative">
                  <Smartphone size={40} className="text-primary-600" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary-300 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-stone-600 text-center">{t('nfcHoldPhone')}</p>
              </div>
              <button onClick={startScanning} className="btn-primary w-full">
                <ScanLine size={18} className="inline mr-1" /> {t('nfcStartScan')}
              </button>
              {!nfcSupported && (
                <div className="rounded-lg bg-warning-50 border border-warning-200 p-3 flex items-center gap-2">
                  <QrCode size={16} className="text-warning-600 flex-shrink-0" />
                  <p className="text-xs text-warning-600">{t('nfcUseQRInstead')}</p>
                </div>
              )}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-semibold text-stone-500 mb-2">{t('nfcManualEntry')}</p>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    value={manualTagId}
                    onChange={(e) => setManualTagId(e.target.value)}
                    placeholder="KB-F-1024"
                  />
                  <button onClick={handleManualScan} className="btn-secondary text-sm">{t('nfcVerify')}</button>
                </div>
              </div>
            </>
          )}
          {scanState === 'scanning' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-4 relative">
                <Nfc size={36} className="text-primary-600" />
                <div className="absolute inset-0 rounded-full border-4 border-primary-400 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-stone-600">{t('nfcScanning')}</p>
              <button onClick={stopScanning} className="btn-ghost mt-4 text-sm">{t('cancel')}</button>
            </div>
          )}
        </div>
      </Modal>

      {/* Write NFC modal */}
      <Modal open={showWriteModal} onClose={() => { setShowWriteModal(false); setWriteState('idle'); setWriteError(''); setGeneratedId(''); }} title={t('nfcWriteTagTitle')} size="sm">
        <div className="space-y-4">
          {generatedId && (
            <div className="rounded-lg bg-primary-50 border border-primary-200 p-3 text-center">
              <p className="text-xs text-stone-500 mb-1">{t('nfcYourId')}</p>
              <p className="text-lg font-bold text-primary-700">{generatedId}</p>
            </div>
          )}
          <button onClick={handleGenerateId} className="btn-ghost w-full text-sm flex items-center justify-center gap-1">
            <RefreshCw size={14} /> {t('nfcRegenerateId')}
          </button>

          {writeState === 'idle' && (
            <>
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
                <p className="text-xs text-stone-500">{t('nfcWriteInstructions')}</p>
              </div>
              {nfcSupported ? (
                <button onClick={handleWriteNfc} className="btn-primary w-full">
                  <Nfc size={18} className="inline mr-1" /> {t('nfcWriteToTag')}
                </button>
              ) : (
                <div className="rounded-lg bg-warning-50 border border-warning-200 p-3 flex items-start gap-2">
                  <Info size={16} className="text-warning-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-600">{t('nfcWriteNotSupported')}</p>
                </div>
              )}
              <button onClick={handleRegisterAndAssign} className="btn-secondary w-full text-sm">
                {t('nfcRegisterWithoutWrite')}
              </button>
            </>
          )}

          {writeState === 'writing' && (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-3 relative">
                <Nfc size={28} className="text-primary-600" />
                <div className="absolute inset-0 rounded-full border-4 border-primary-400 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-stone-600">{t('nfcWritingTag')}</p>
            </div>
          )}

          {writeState === 'success' && (
            <div className="flex flex-col items-center py-6">
              <CheckCircle size={40} className="text-success-600 mb-2" />
              <p className="text-sm font-semibold text-success-700">{t('nfcWriteSuccess')}</p>
            </div>
          )}

          {writeState === 'error' && (
            <div className="rounded-lg bg-error-50 border border-error-200 p-3">
              <p className="text-xs text-error-600">{writeError}</p>
              <button onClick={() => setWriteState('idle')} className="text-xs text-error-600 underline mt-2">{t('nfcTryAgain')}</button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
      <p className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1">{icon}{label}</p>
      <p className="text-xs text-stone-700 mt-0.5">{value}</p>
    </div>
  );
}
