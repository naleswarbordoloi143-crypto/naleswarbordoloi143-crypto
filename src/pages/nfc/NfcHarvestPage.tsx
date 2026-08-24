import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { NfcTag, NfcHarvestEntity, NfcTraceabilityEvent, TraceabilityEventType } from '@/lib/types';
import {
  nfcScan, nfcGenerateId, nfcRegister, nfcAssign, nfcGetTraceability,
  isNfcSupported, startNfcScan, generateQrDataUrl,
} from '@/lib/nfc';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatNumber, formatDate, formatCurrency } from '@/lib/utils';
import {
  Nfc, ScanLine, Smartphone, CheckCircle, XCircle, AlertCircle,
  QrCode, Wheat, Users, MapPin, Copy, Package, Truck, ClipboardCheck,
  Eye, ShoppingBag, CheckSquare, FileText, Info, TrendingUp,
} from 'lucide-react';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

const EVENT_META: Record<TraceabilityEventType, { icon: typeof Nfc; label: string; color: string }> = {
  HARVEST_CREATED: { icon: FileText, label: 'Harvest Created', color: 'text-primary-600 bg-primary-50' },
  NFC_ASSIGNED: { icon: Nfc, label: 'NFC Tag Assigned', color: 'text-accent-600 bg-accent-50' },
  COLLECTION_SCANNED: { icon: Package, label: 'Collection Center Scanned', color: 'text-warning-600 bg-warning-50' },
  QUALITY_CHECKED: { icon: ClipboardCheck, label: 'Quality Checked', color: 'text-success-600 bg-success-50' },
  BUYER_VIEWED: { icon: Eye, label: 'Buyer Viewed', color: 'text-stone-600 bg-stone-100' },
  ORDER_CONFIRMED: { icon: ShoppingBag, label: 'Order Confirmed', color: 'text-primary-600 bg-primary-50' },
  COLLECTION_COMPLETED: { icon: CheckSquare, label: 'Collection Completed', color: 'text-success-600 bg-success-50' },
};

export default function NfcHarvestPage() {
  const { profile, t } = useAuth();
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState('');
  const [scannedHarvest, setScannedHarvest] = useState<NfcHarvestEntity | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignLot, setAssignLot] = useState<any>(null);
  const [generatedId, setGeneratedId] = useState('');
  const [manualTagId, setManualTagId] = useState('');
  const [nfcSupported] = useState(isNfcSupported());
  const [traceability, setTraceability] = useState<NfcTraceabilityEvent[]>([]);
  const [showTraceability, setShowTraceability] = useState<string | null>(null);
  const [demoActive, setDemoActive] = useState(false);
  const stopScanRef = useRef<(() => void) | null>(null);

  const fetchLots = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: allLots } = await supabase
      .from('harvest_lots')
      .select('*')
      .order('created_at', { ascending: false });
    // Fetch NFC tags separately and map them
    const { data: tags } = await supabase
      .from('nfc_tags')
      .select('tag_uid, status, entity_id, entity_type')
      .eq('entity_type', 'HARVEST');
    const tagMap = new Map((tags || []).map((tag: any) => [tag.entity_id, tag]));
    const merged = (allLots || []).map((lot) => ({
      ...lot,
      nfc_tag: tagMap.get(lot.id) || null,
    }));
    setLots(merged);
    setLoading(false);
  };

  useEffect(() => { fetchLots(); }, [profile]);

  const startScanning = async () => {
    setScanState('scanning');
    setScanError('');
    setScannedHarvest(null);

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
    if (result.entity?.type === 'HARVEST') {
      setScannedHarvest(result.entity as NfcHarvestEntity);
      setScanState('success');
      // Fetch traceability
      if (result.tag?.entity_id) {
        const traceResult = await nfcGetTraceability(result.tag.entity_id);
        if (traceResult.events) setTraceability(traceResult.events);
      }
    } else if (result.entity) {
      setScanState('error');
      setScanError(t('nfcNotHarvestTag'));
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

  const handleDemoHarvest = () => {
    setDemoActive(true);
    setScannedHarvest({
      type: 'HARVEST',
      lotId: 'KB-WHT-2026-001',
      crop: 'Wheat',
      quantity: 2500,
      harvestDate: '2026-08-22',
      location: 'Pune, Maharashtra',
      cluster: 'VC-07',
      qualityGrade: 'Grade A',
      qualityScore: 92,
      status: 'AVAILABLE',
      pricePerKg: 24,
      contributorCount: 5,
      contributions: [
        { farmerName: 'Farmer A', quantityKg: 400 },
        { farmerName: 'Farmer B', quantityKg: 600 },
        { farmerName: 'Farmer C', quantityKg: 300 },
        { farmerName: 'Farmer D', quantityKg: 500 },
        { farmerName: 'Farmer E', quantityKg: 700 },
      ],
    });
    setTraceability([
      { id: '1', lot_id: 'demo', tag_id: null, event_type: 'HARVEST_CREATED', actor_id: null, location: 'Pune', latitude: null, longitude: null, metadata: {}, created_at: '2026-08-22T08:00:00Z', profiles: { full_name: 'Champion', role: 'champion' } },
      { id: '2', lot_id: 'demo', tag_id: null, event_type: 'NFC_ASSIGNED', actor_id: null, location: null, latitude: null, longitude: null, metadata: {}, created_at: '2026-08-22T09:00:00Z', profiles: { full_name: 'Champion', role: 'champion' } },
    ]);
    setScanState('success');
  };

  const handleGenerateForAssign = async (cropName: string) => {
    const result = await nfcGenerateId('HARVEST', cropName);
    if (result.tagUid) setGeneratedId(result.tagUid);
  };

  const handleAssignTag = async () => {
    if (!assignLot || !generatedId) return;
    const regResult = await nfcRegister(generatedId, 'HARVEST', assignLot.id);
    if (regResult.error && !regResult.tag) {
      // Try assign if already registered
      const assignResult = await nfcAssign(generatedId, 'HARVEST', assignLot.id);
      if (assignResult.error) { alert(assignResult.error); return; }
    } else if (regResult.tag) {
      const assignResult = await nfcAssign(generatedId, 'HARVEST', assignLot.id);
      if (assignResult.error) { alert(assignResult.error); return; }
    }
    setShowAssignModal(false);
    setAssignLot(null);
    setGeneratedId('');
    fetchLots();
  };

  const handleViewTraceability = async (lotId: string) => {
    const result = await nfcGetTraceability(lotId);
    if (result.events) {
      setTraceability(result.events);
      setShowTraceability(lotId);
    }
  };

  const handleRequestPurchase = () => {
    if (!scannedHarvest) return;
    alert(t('nfcPurchaseRequestSent'));
  };

  useEffect(() => {
    return () => { stopScanRef.current?.(); };
  }, []);

  if (loading) return <CardSpinner />;

  const isBuyer = profile?.role === 'buyer' || profile?.active_role === 'buyer';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent-600 rounded-xl text-white"><Nfc size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">{t('nfcHarvestTitle')}</h2>
          <p className="text-sm text-stone-500">{t('nfcHarvestDesc')}</p>
        </div>
      </div>

      {/* NFC support indicator */}
      <div className={`rounded-xl p-3 flex items-center gap-3 ${nfcSupported ? 'bg-success-50 border border-success-500/20' : 'bg-warning-50 border border-warning-500/20'}`}>
        {nfcSupported ? <Nfc size={18} className="text-success-600" /> : <QrCode size={18} className="text-warning-600" />}
        <p className="text-sm text-stone-600">
          {nfcSupported ? t('nfcAvailable') : t('nfcNotAvailableQR')}
        </p>
      </div>

      {/* Scan button */}
      <button onClick={() => { setShowScanModal(true); setScanState('idle'); setScannedHarvest(null); setDemoActive(false); }} className="btn-primary w-full">
        <ScanLine size={18} className="inline mr-1" /> {t('nfcScanHarvest')}
      </button>

      {/* Demo section */}
      <div className="card-pad border-2 border-dashed border-warning-300">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-warning-600" />
          <p className="text-sm font-bold text-warning-700">{t('nfcDemoMode')}</p>
        </div>
        <p className="text-xs text-stone-500 mb-3">{t('nfcDemoHarvestDesc')}</p>
        <button onClick={handleDemoHarvest} className="btn-secondary w-full text-sm">
          <Smartphone size={16} className="inline mr-1" /> {t('nfcDemoHarvest')}
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

      {scanState === 'success' && scannedHarvest && (
        <div className="rounded-2xl border-2 border-success-300 overflow-hidden shadow-sm">
          <div className="bg-success-600 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={20} />
              <p className="text-sm font-bold">{t('nfcVerifiedHarvest')}</p>
            </div>
            <p className="text-xs text-success-100">{demoActive ? t('nfcDemoMode') : 'Kishan Bhai'}</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-stone-400 uppercase">{t('nfcLotId')}</p>
              <p className="text-lg font-bold text-stone-800">{scannedHarvest.lotId}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DataRow icon={<Wheat size={14} />} label={t('nfcCrop')} value={scannedHarvest.crop} />
              <DataRow icon={<Package size={14} />} label={t('nfcQuantity')} value={`${formatNumber(scannedHarvest.quantity)} kg`} />
              <DataRow icon={<MapPin size={14} />} label={t('location')} value={scannedHarvest.location || '—'} />
              <DataRow icon={<Users size={14} />} label={t('nfcCluster')} value={scannedHarvest.cluster || '—'} />
              <DataRow label={t('date')} value={formatDate(scannedHarvest.harvestDate)} />
              <DataRow icon={<TrendingUp size={14} />} label={t('nfcPricePerKg')} value={formatCurrency(scannedHarvest.pricePerKg)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 text-center">
                <p className="text-[10px] font-bold text-stone-400 uppercase">{t('nfcQuality')}</p>
                <p className="text-sm font-bold text-stone-800 mt-1">{scannedHarvest.qualityGrade}</p>
              </div>
              <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 text-center">
                <p className="text-[10px] font-bold text-stone-400 uppercase">{t('nfcStatus')}</p>
                <p className="text-sm font-bold text-stone-800 mt-1">{scannedHarvest.status}</p>
              </div>
              <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 text-center">
                <p className="text-[10px] font-bold text-stone-400 uppercase">{t('nfcFarmers')}</p>
                <p className="text-sm font-bold text-stone-800 mt-1">{scannedHarvest.contributorCount}</p>
              </div>
            </div>

            {/* Contributions (only for non-buyers) */}
            {scannedHarvest.contributions && scannedHarvest.contributions.length > 0 && (
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-bold text-stone-500 mb-2">{t('nfcContributions')}</p>
                <div className="space-y-1">
                  {scannedHarvest.contributions.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-stone-600">{c.farmerName}</span>
                      <span className="font-semibold text-stone-700">{formatNumber(c.quantityKg)} kg</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                    <span className="font-bold text-stone-700">{t('nfcTotal')}</span>
                    <span className="font-bold text-stone-800">{formatNumber(scannedHarvest.quantity)} kg</span>
                  </div>
                </div>
              </div>
            )}

            {/* QR Code */}
            <div className="flex flex-col items-center pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-2">{t('nfcQRFallback')}</p>
              <img src={generateQrDataUrl(scannedHarvest.lotId, 140)} alt="QR" className="w-36 h-36 rounded-lg border border-stone-200" />
            </div>

            {/* Traceability timeline */}
            {traceability.length > 0 && (
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-bold text-stone-500 mb-3">{t('nfcTraceability')}</p>
                <div className="space-y-2">
                  {traceability.map((event, idx) => {
                    const meta = EVENT_META[event.event_type];
                    const Icon = meta?.icon || Info;
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`p-1.5 rounded-lg ${meta?.color}`}>
                            <Icon size={12} />
                          </div>
                          {idx < traceability.length - 1 && <div className="w-0.5 h-4 bg-stone-200 mt-1" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-xs font-semibold text-stone-700">{meta?.label || event.event_type}</p>
                          <p className="text-[10px] text-stone-400">
                            {formatDate(event.created_at)}
                            {event.profiles?.full_name ? ` · ${event.profiles.full_name}` : ''}
                            {event.location ? ` · ${event.location}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-3 border-t border-stone-100">
              {isBuyer && (
                <button onClick={handleRequestPurchase} className="btn-primary flex-1 text-sm">
                  <ShoppingBag size={16} className="inline mr-1" /> {t('nfcRequestPurchase')}
                </button>
              )}
              <button onClick={() => { setScanState('idle'); setScannedHarvest(null); setTraceability([]); setDemoActive(false); }} className="btn-ghost text-sm">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign NFC to existing lots */}
      {!isBuyer && lots.length > 0 && (
        <div>
          <h3 className="font-bold text-stone-800 mb-3">{t('nfcAssignToLot')}</h3>
          <div className="space-y-2">
            {lots.map((lot) => (
              <div key={lot.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-stone-700">{lot.crop_name}</p>
                  <p className="text-xs text-stone-400">{formatNumber(lot.total_quantity_kg)} kg · {formatDate(lot.harvest_date)}</p>
                  {lot.nfc_tag && (
                    <p className="text-[10px] text-accent-600 font-semibold mt-0.5">{lot.nfc_tag.tag_uid}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleViewTraceability(lot.id)} className="text-xs text-stone-500 hover:text-primary-600 px-2 py-1">
                    {t('nfcHistory')}
                  </button>
                  <button
                    onClick={() => { setAssignLot(lot); setShowAssignModal(true); handleGenerateForAssign(lot.crop_name); }}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 px-2 py-1"
                  >
                    {t('nfcAssignTag')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan modal */}
      <Modal open={showScanModal} onClose={stopScanning} title={t('nfcScannerTitle')} size="sm">
        <div className="space-y-4">
          {scanState === 'idle' && (
            <>
              <div className="flex flex-col items-center py-6">
                <div className="w-24 h-24 rounded-full bg-accent-100 flex items-center justify-center mb-4 relative">
                  <Smartphone size={40} className="text-accent-600" />
                  <div className="absolute inset-0 rounded-full border-4 border-accent-300 border-t-transparent animate-spin" />
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
                    placeholder="KB-WHT-2026-001"
                  />
                  <button onClick={handleManualScan} className="btn-secondary text-sm">{t('nfcVerify')}</button>
                </div>
              </div>
            </>
          )}
          {scanState === 'scanning' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mb-4 relative">
                <Nfc size={36} className="text-accent-600" />
                <div className="absolute inset-0 rounded-full border-4 border-accent-400 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-stone-600">{t('nfcScanning')}</p>
              <button onClick={stopScanning} className="btn-ghost mt-4 text-sm">{t('cancel')}</button>
            </div>
          )}
        </div>
      </Modal>

      {/* Assign modal */}
      <Modal open={showAssignModal} onClose={() => { setShowAssignModal(false); setAssignLot(null); setGeneratedId(''); }} title={t('nfcAssignTagTitle')} size="sm">
        <div className="space-y-4">
          {assignLot && (
            <div className="rounded-lg bg-stone-50 p-3">
              <p className="text-sm font-semibold text-stone-700">{assignLot.crop_name}</p>
              <p className="text-xs text-stone-400">{formatNumber(assignLot.total_quantity_kg)} kg</p>
            </div>
          )}
          {generatedId && (
            <div className="rounded-lg bg-accent-50 border border-accent-200 p-3 text-center">
              <p className="text-xs text-stone-500 mb-1">{t('nfcLotId')}</p>
              <p className="text-lg font-bold text-accent-700">{generatedId}</p>
            </div>
          )}
          <button onClick={() => assignLot && handleGenerateForAssign(assignLot.crop_name)} className="btn-ghost w-full text-sm">
            {t('nfcRegenerateId')}
          </button>
          {generatedId && (
            <>
              <div className="flex justify-center">
                <img src={generateQrDataUrl(generatedId, 120)} alt="QR" className="w-32 h-32 rounded-lg border border-stone-200" />
              </div>
              <button onClick={handleAssignTag} className="btn-primary w-full">
                <Nfc size={18} className="inline mr-1" /> {t('nfcConfirmAssign')}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Traceability modal */}
      <Modal open={!!showTraceability} onClose={() => setShowTraceability(null)} title={t('nfcTraceabilityHistory')}>
        <div className="space-y-3">
          {traceability.length === 0 ? (
            <EmptyState icon={<Info size={32} />} title={t('nfcNoEvents')} description={t('nfcNoEventsDesc')} />
          ) : (
            traceability.map((event, idx) => {
              const meta = EVENT_META[event.event_type];
              const Icon = meta?.icon || Info;
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`p-2 rounded-lg ${meta?.color}`}>
                      <Icon size={16} />
                    </div>
                    {idx < traceability.length - 1 && <div className="w-0.5 h-6 bg-stone-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-sm font-semibold text-stone-700">{meta?.label || event.event_type}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {formatDate(event.created_at)}
                      {event.profiles?.full_name ? ` · ${event.profiles.full_name}` : ''}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}

function DataRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
      <p className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1">{icon}{label}</p>
      <p className="text-xs text-stone-700 mt-0.5">{value}</p>
    </div>
  );
}
