import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AIAnalysis } from '@/lib/types';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import {
  Upload, Camera, Image as ImageIcon, AlertCircle, CheckCircle, Info,
  Leaf, Shield, Clock, TrendingDown, FlaskConical, Sprout, HeartPulse,
  Bug, CloudRain, ChevronDown, ChevronUp, Printer, Trash2,
  Droplets, Package, Calendar, ListChecks, Beaker,
} from 'lucide-react';

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; key: string }> = {
  Low: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-500/30', key: 'sevLow' },
  Moderate: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-500/30', key: 'sevModerate' },
  High: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-500/30', key: 'sevHigh' },
  Critical: { bg: 'bg-error-50', text: 'text-error-700', border: 'border-error-500/30', key: 'sevCritical' },
  None: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-500/30', key: 'sevNone' },
};

const DISEASE_ICONS: Record<string, typeof Leaf> = {
  Fungal: FlaskConical,
  Bacterial: AlertCircle,
  Viral: HeartPulse,
  Pest: Bug,
  'Nutrient Deficiency': Leaf,
  Environmental: CloudRain,
  Healthy: CheckCircle,
  Other: Info,
};

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-success-500' : value >= 50 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold text-stone-600 tabular-nums">{value}%</span>
    </div>
  );
}

function ReportSection({
  icon: Icon, title, children, color = 'text-primary-600',
}: {
  icon: typeof Leaf; title: string; children: React.ReactNode; color?: string;
}) {
  return (
    <div className="flex gap-3 pt-3">
      <div className={`p-1.5 rounded-lg bg-stone-100 ${color} flex-shrink-0`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">{title}</p>
        <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{children}</div>
      </div>
    </div>
  );
}

function FertilizerCard({ a, t }: { a: AIAnalysis; t: (key: string) => string }) {
  const hasFertilizer = a.fertilizer_name && a.fertilizer_name !== 'Not required';
  if (!hasFertilizer && !a.fertilizer_type) return null;

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/50 overflow-hidden">
      <div className="bg-primary-600 px-4 py-2.5 flex items-center gap-2">
        <Droplets size={16} className="text-white" />
        <span className="text-sm font-bold text-white">{t('fertilizerRec')}</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Fertilizer name + type */}
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-primary-100 text-primary-600 flex-shrink-0">
            <Beaker size={16} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-stone-400 uppercase">{t('recommendedFertilizer')}</p>
            <p className="text-sm font-semibold text-stone-800 mt-0.5">{a.fertilizer_name}</p>
            {a.fertilizer_type && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                {a.fertilizer_type}
              </span>
            )}
          </div>
        </div>

        {/* Quantity */}
        {a.fertilizer_quantity && (
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-stone-100 text-stone-600 flex-shrink-0">
              <Package size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-stone-400 uppercase">{t('quantity')}</p>
              <p className="text-sm text-stone-700 mt-0.5">{a.fertilizer_quantity}</p>
            </div>
          </div>
        )}

        {/* Frequency / How many times */}
        {a.fertilizer_frequency && (
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-accent-100 text-accent-600 flex-shrink-0">
              <Calendar size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-stone-400 uppercase">{t('howOften')}</p>
              <p className="text-sm text-stone-700 mt-0.5">{a.fertilizer_frequency}</p>
            </div>
          </div>
        )}

        {/* Application method */}
        {a.fertilizer_application && (
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-success-100 text-success-600 flex-shrink-0">
              <ListChecks size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-stone-400 uppercase">{t('howToApply')}</p>
              <p className="text-sm text-stone-700 mt-0.5 whitespace-pre-line">{a.fertilizer_application}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({ a, onDelete, t }: { a: AIAnalysis; onDelete: (id: string) => void; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.None;
  const DiseaseIcon = DISEASE_ICONS[a.disease_type] || Info;

  return (
    <div className={`rounded-2xl border ${sev.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header bar */}
      <div className={`${sev.bg} px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <DiseaseIcon size={18} className={sev.text} />
          <span className={`text-sm font-bold ${sev.text}`}>{t(sev.key)}</span>
        </div>
        <span className="text-xs text-stone-500">{formatDate(a.created_at)}</span>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex gap-4 mb-4">
          {a.image_url && (
            <img src={a.image_url} alt="Crop" className="w-28 h-28 rounded-xl object-cover flex-shrink-0 border border-stone-200" />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold text-stone-800">{a.crop || t('unknownCrop')}</h4>
            <p className="text-sm text-stone-600 mt-0.5">{a.issue || t('noIssueDetected')}</p>
            {a.disease_type && (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-stone-100 text-xs font-medium text-stone-600">
                {a.disease_type}
              </span>
            )}
          </div>
        </div>

        {/* Confidence */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">{t('confidence')}</span>
          </div>
          <ConfidenceMeter value={a.confidence} />
        </div>

        {/* Quick info chips */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {a.affected_parts && (
            <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase">{t('affectedParts')}</p>
              <p className="text-xs text-stone-700 mt-0.5">{a.affected_parts}</p>
            </div>
          )}
          {a.treatment_timeline && (
            <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase">{t('recoveryTime')}</p>
              <p className="text-xs text-stone-700 mt-0.5">{a.treatment_timeline}</p>
            </div>
          )}
          {a.estimated_impact && (
            <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase">{t('yieldImpact')}</p>
              <p className="text-xs text-stone-700 mt-0.5">{a.estimated_impact}</p>
            </div>
          )}
        </div>

        {/* All problems list */}
        {a.all_problems && (
          <div className="rounded-xl bg-error-50/50 border border-error-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-error-600" />
              <p className="text-xs font-bold text-error-700 uppercase tracking-wide">{t('allProblemsFound')}</p>
            </div>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{a.all_problems}</p>
          </div>
        )}

        {/* Fertilizer recommendation */}
        <div className="mb-4">
          <FertilizerCard a={a} t={t} />
        </div>

        {/* Always visible: symptoms + actions */}
        {a.symptoms && (
          <ReportSection icon={AlertCircle} title={t('symptoms')} color="text-warning-600">
            {a.symptoms}
          </ReportSection>
        )}
        {a.suggested_actions && (
          <ReportSection icon={Shield} title={t('immediateActions')} color="text-error-600">
            {a.suggested_actions}
          </ReportSection>
        )}

        {/* Expandable detailed sections */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 flex items-center justify-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors py-2 border-t border-stone-100"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? t('showLess') : t('viewFullReport')}
        </button>

        {expanded && (
          <div className="space-y-1 pt-2 border-t border-stone-100">
            {a.organic_treatment && (
              <ReportSection icon={Sprout} title={t('organicTreatment')} color="text-success-600">
                {a.organic_treatment}
              </ReportSection>
            )}
            {a.chemical_treatment && (
              <ReportSection icon={FlaskConical} title={t('chemicalTreatment')} color="text-primary-600">
                {a.chemical_treatment}
              </ReportSection>
            )}
            {a.prevention && (
              <ReportSection icon={Shield} title={t('prevention')} color="text-stone-600">
                {a.prevention}
              </ReportSection>
            )}
            {a.advisory_note && (
              <div className="flex gap-2 pt-3 mt-2 border-t border-stone-100">
                <Info size={14} className="text-stone-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-stone-400 italic">{a.advisory_note}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-stone-100">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-primary-600 transition-colors"
          >
            <Printer size={14} /> {t('printReport')}
          </button>
          <button
            onClick={() => onDelete(a.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-error-600 transition-colors ml-auto"
          >
            <Trash2 size={14} /> {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CropDiseasePage() {
  const { profile, t, language } = useAuth();
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setAnalyses((data as AIAnalysis[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const handleFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError(t('imageTooLarge')); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const deleteAnalysis = async (id: string) => {
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
    await supabase.from('ai_analyses').delete().eq('id', id);
  };

  const analyze = async () => {
    if (!profile || !selectedFile) return;
    setAnalyzing(true);
    setError(null);

    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(fileBuffer);
      let base64 = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        base64 += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      base64 = btoa(base64);
      const mimeType = selectedFile.type || 'image/jpeg';

      const fileName = `crop-${Date.now()}-${selectedFile.name.replace(/\s/g, '_')}`;
      let imageUrl = '';
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('crop-images')
        .upload(fileName, selectedFile);
      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage.from('crop-images').getPublicUrl(uploadData.path);
        imageUrl = urlData.publicUrl;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crop-analysis`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ imageBase64: base64, mimeType, language }),
      });

      if (!res.ok) {
        throw new Error(t('analysisServiceDown'));
      }

      const result = await res.json();

      if (result.configured === false) {
        setError(t('aiNotConfigured'));
        setAnalyzing(false);
        return;
      }

      const { data: saved } = await supabase.from('ai_analyses').insert({
        user_id: profile.id,
        image_url: imageUrl,
        crop: result.crop || '',
        issue: result.issue || '',
        all_problems: result.allProblems || '',
        disease_type: result.diseaseType || '',
        severity: result.severity || '',
        confidence: result.confidence || 0,
        symptoms: result.symptoms || '',
        affected_parts: result.affectedParts || '',
        suggested_actions: result.suggestedActions || '',
        organic_treatment: result.organicTreatment || '',
        chemical_treatment: result.chemicalTreatment || '',
        fertilizer_name: result.fertilizerName || '',
        fertilizer_type: result.fertilizerType || '',
        fertilizer_quantity: result.fertilizerQuantity || '',
        fertilizer_frequency: result.fertilizerFrequency || '',
        fertilizer_application: result.fertilizerApplication || '',
        prevention: result.prevention || '',
        treatment_timeline: result.treatmentTimeline || '',
        estimated_impact: result.estimatedImpact || '',
      }).select().single();

      if (saved) setAnalyses((prev) => [saved as AIAnalysis, ...prev]);
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (e: any) {
      setError(e.message || t('analysisFailed'));
    }
    setAnalyzing(false);
  };

  if (loading) return <CardSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-600 rounded-xl text-white"><Camera size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">{t('cropDiseaseTitle')}</h2>
          <p className="text-sm text-stone-500">{t('cropDiseaseDesc')}</p>
        </div>
      </div>

      {/* Advisory banner */}
      <div className="bg-warning-50 border border-warning-500/20 rounded-xl p-4 flex items-start gap-3">
        <Info size={20} className="text-warning-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-warning-600">
          {t('cropAdvisory')}
        </p>
      </div>

      {/* Upload area */}
      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3">{t('uploadCropPhoto')}</h3>
        {previewUrl ? (
          <div className="space-y-3">
            <img src={previewUrl} alt="Crop preview" className="max-h-64 rounded-xl mx-auto" />
            <div className="flex gap-2 justify-center">
              <button onClick={() => { setSelectedFile(null); setPreviewUrl(''); }} className="btn-ghost">{t('cancel')}</button>
              <button onClick={analyze} disabled={analyzing} className="btn-primary">
                {analyzing ? t('analyzing') : t('analyzeNow')}
              </button>
            </div>
            {analyzing && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-sm text-stone-500">{t('analyzingCrop')}</p>
              </div>
            )}
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-12 cursor-pointer transition-all ${
              dragOver ? 'border-primary-500 bg-primary-50' : 'border-stone-300 hover:border-primary-400 hover:bg-primary-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <Upload size={40} className="text-stone-400 mb-2" />
            <p className="text-sm text-stone-500">{t('dragDropCrop')}</p>
            <p className="text-xs text-stone-400 mt-1">JPG, PNG up to 5MB</p>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileInput} />
          </label>
        )}
        {error && <p className="text-sm text-error-500 mt-2">{error}</p>}
      </div>

      {/* Past analyses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-stone-800">{t('diagnosticReports')}</h3>
          {analyses.length > 0 && (
            <span className="text-xs text-stone-400">{analyses.length} {analyses.length !== 1 ? t('reportCountPlural') : t('reportCount')}</span>
          )}
        </div>
        {analyses.length === 0 ? (
          <div className="card-pad">
            <EmptyState icon={<ImageIcon size={32} />} title={t('noReportsYet')} description={t('noReportsDesc')} />
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((a) => (
              <ReportCard key={a.id} a={a} onDelete={deleteAnalysis} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
