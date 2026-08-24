import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { CheckCircle, Award, Plus } from 'lucide-react';

export default function QualityPage() {
  const { profile, t } = useAuth();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [targetLot, setTargetLot] = useState('');
  const [moisture, setMoisture] = useState('');
  const [cleanliness, setCleanliness] = useState('');
  const [defects, setDefects] = useState('');
  const [grade, setGrade] = useState('A');
  const [aiObs, setAiObs] = useState('');
  const [humanVer, setHumanVer] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aRes, lRes] = await Promise.all([
        supabase.from('quality_assessments').select('*, harvest_lots(crop_name), profiles!inner(full_name)').order('created_at', { ascending: false }),
        supabase.from('harvest_lots').select('*').order('created_at', { ascending: false }),
      ]);
      setAssessments(aRes.data ?? []);
      setLots(lRes.data ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addAssessment = async () => {
    if (!profile || !targetLot) return;
    const score = (Number(cleanliness) || 0) * 0.4 + (100 - (Number(defects) || 0)) * 0.3 + (100 - Math.abs(Number(moisture) || 0 - 14)) * 0.3;
    await supabase.from('quality_assessments').insert({
      lot_id: targetLot, assessed_by: profile.id, moisture_pct: parseFloat(moisture) || 0,
      cleanliness_pct: parseFloat(cleanliness) || 0, defects_pct: parseFloat(defects) || 0,
      grade, ai_observations: aiObs, human_verified: humanVer, score: Math.round(score * 100) / 100,
    });
    setShowModal(false); setMoisture(''); setCleanliness(''); setDefects(''); setAiObs(''); setHumanVer(false);
    fetchData();
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-stone-800">Quality Score</h2><p className="text-sm text-stone-500">Assess and track crop quality</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> New Assessment</button>
      </div>
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm text-primary-700">
        <strong>Note:</strong> AI observations support but do not replace human verification. All quality grades must be confirmed by a qualified assessor.
      </div>
      {assessments.length === 0 ? <div className="card-pad"><EmptyState icon={<Award size={32} />} title="No assessments yet" description="Create a quality assessment for a harvest lot" /></div>
      : <div className="space-y-3">
        {assessments.map((a) => (
          <div key={a.id} className="card-pad">
            <div className="flex items-start justify-between mb-3">
              <div><p className="font-bold text-stone-800">{a.harvest_lots?.crop_name || 'Unknown lot'}</p><p className="text-xs text-stone-400">By {a.profiles?.full_name} · {formatDate(a.created_at)}</p></div>
              <div className="flex items-center gap-2"><span className="badge-accent">Grade {a.grade}</span>{a.human_verified && <span className="badge-primary"><CheckCircle size={12} /> Verified</span>}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Score</p><p className="font-semibold text-primary-600">{a.score}/100</p></div>
              <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Moisture</p><p className="font-semibold">{a.moisture_pct}%</p></div>
              <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Cleanliness</p><p className="font-semibold">{a.cleanliness_pct}%</p></div>
              <div className="p-2 rounded-lg bg-stone-50"><p className="text-xs text-stone-400">Defects</p><p className="font-semibold">{a.defects_pct}%</p></div>
            </div>
            {a.ai_observations && <p className="text-sm text-stone-500 mt-2"><strong>AI:</strong> {a.ai_observations}</p>}
          </div>
        ))}
      </div>}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Quality Assessment">
        <div className="space-y-4">
          <div><label className="label-text">Harvest Lot</label><select className="input-field" value={targetLot} onChange={(e) => setTargetLot(e.target.value)}><option value="">Select lot</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.crop_name} — {l.total_quantity_kg}kg</option>)}</select></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label-text">Moisture %</label><input type="number" className="input-field" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="14" /></div>
            <div><label className="label-text">Cleanliness %</label><input type="number" className="input-field" value={cleanliness} onChange={(e) => setCleanliness(e.target.value)} placeholder="90" /></div>
            <div><label className="label-text">Defects %</label><input type="number" className="input-field" value={defects} onChange={(e) => setDefects(e.target.value)} placeholder="5" /></div>
          </div>
          <div><label className="label-text">Grade</label><select className="input-field" value={grade} onChange={(e) => setGrade(e.target.value)}><option>A</option><option>B</option><option>C</option><option>D</option></select></div>
          <div><label className="label-text">AI Observations</label><textarea className="input-field" rows={2} value={aiObs} onChange={(e) => setAiObs(e.target.value)} placeholder="Optional AI-generated observations" /></div>
          <label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={humanVer} onChange={(e) => setHumanVer(e.target.checked)} /> Human verified</label>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowModal(false)} className="btn-ghost">{t('cancel')}</button><button onClick={addAssessment} className="btn-primary">{t('create')}</button></div>
        </div>
      </Modal>
    </div>
  );
}
