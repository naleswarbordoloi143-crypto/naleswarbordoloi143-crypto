import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Shield, Upload, CheckCircle, XCircle, Clock, FileImage, Loader2, Award, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type UploadState = 'idle' | 'uploading' | 'verifying' | 'done' | 'error';

export function ChampionCertificate() {
  const { profile, t, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  if (!profile) return null;

  const status = profile.champion_verification_status || 'not_submitted';
  const isVerified = profile.champion_verified;
  const hasCertificate = !!profile.champion_certificate_url;

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum 5MB allowed.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('Please upload a PNG, JPG, or WebP image.');
      return;
    }

    setError(null);
    setUploadState('uploading');

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}/certificate-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('champion-certificates')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('champion-certificates')
        .getPublicUrl(filePath);

      const certificateUrl = urlData.publicUrl;

      await supabase
        .from('profiles')
        .update({
          champion_certificate_url: certificateUrl,
          champion_verification_status: 'pending',
          champion_verified: false,
          champion_verification_notes: '',
          champion_verified_at: null,
        })
        .eq('id', profile.id);

      setUploadState('verifying');

      // Read file as base64 for AI verification
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/champion-verify`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type,
              userId: profile.id,
            }),
          });

          if (!response.ok) throw new Error('Verification request failed');
          const result = await response.json();

          if (result.error && !result.configured) {
            setError(result.error);
            setUploadState('error');
          } else if (result.error) {
            setError(result.error);
            setUploadState('error');
          } else {
            setVerifyResult(result);
            setUploadState('done');
            await refreshProfile();
          }
        } catch (e: any) {
          setError('AI verification failed. Please try again.');
          setUploadState('error');
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
      setUploadState('error');
    }
  };

  const statusConfig = {
    not_submitted: { icon: <AlertCircle size={20} className="text-stone-400" />, label: t('championCertNotSubmitted'), color: 'text-stone-500 bg-stone-50 border-stone-200' },
    pending: { icon: <Clock size={20} className="text-accent-600" />, label: t('championCertPending'), color: 'text-accent-700 bg-accent-50 border-accent-200' },
    verified: { icon: <CheckCircle size={20} className="text-success-600" />, label: t('championCertVerified'), color: 'text-success-700 bg-success-50 border-success-200' },
    rejected: { icon: <XCircle size={20} className="text-error-600" />, label: t('championCertRejected'), color: 'text-error-700 bg-error-50 border-error-200' },
  };

  const currentStatus = statusConfig[status] || statusConfig.not_submitted;

  return (
    <div className="card-pad">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
          <Shield size={24} />
        </div>
        <div>
          <h3 className="font-bold text-stone-800">{t('championCertTitle')}</h3>
          <p className="text-sm text-stone-500">{t('championCertDesc')}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className={cn('flex items-center gap-2.5 p-3 rounded-xl border mb-4', currentStatus.color)}>
        {currentStatus.icon}
        <span className="text-sm font-semibold">{currentStatus.label}</span>
        {isVerified && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold text-success-600">
            <Award size={14} /> {t('championCertVerified')}
          </span>
        )}
      </div>

      {/* Verification result details */}
      {(uploadState === 'done' || (hasCertificate && status !== 'not_submitted')) && (
        <div className="space-y-3 mb-4">
          {profile.champion_certificate_type && status !== 'not_submitted' && (
            <div className="p-3 rounded-xl bg-stone-50">
              <p className="text-xs text-stone-400">{t('championCertType')}</p>
              <p className="text-sm font-semibold text-stone-700">{profile.champion_certificate_type}</p>
            </div>
          )}
          {profile.champion_verification_notes && status !== 'not_submitted' && (
            <div className="p-3 rounded-xl bg-stone-50">
              <p className="text-xs text-stone-400">{t('championCertNotes')}</p>
              <p className="text-sm text-stone-600 whitespace-pre-line">{profile.champion_verification_notes}</p>
            </div>
          )}
          {verifyResult && uploadState === 'done' && (
            <div className="p-3 rounded-xl bg-stone-50">
              <p className="text-xs text-stone-400">{t('championCertConfidence')}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      verifyResult.confidence >= 70 ? 'bg-success-500' : verifyResult.confidence >= 40 ? 'bg-accent-500' : 'bg-error-500'
                    )}
                    style={{ width: `${verifyResult.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-stone-700">{verifyResult.confidence}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload area */}
      {uploadState !== 'uploading' && uploadState !== 'verifying' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all group"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-stone-100 group-hover:bg-primary-100 transition-colors">
              {hasCertificate ? <FileImage size={24} className="text-stone-500 group-hover:text-primary-600" /> : <Upload size={24} className="text-stone-500 group-hover:text-primary-600" />}
            </div>
            <p className="text-sm font-medium text-stone-600">{hasCertificate ? t('championCertReupload') : t('championCertUpload')}</p>
            <p className="text-xs text-stone-400">{t('championCertDragDrop')}</p>
            <p className="text-xs text-stone-400">{t('championCertFormats')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {/* Loading states */}
      {uploadState === 'uploading' && (
        <div className="flex items-center justify-center gap-2 p-6 rounded-xl bg-stone-50">
          <Loader2 size={20} className="animate-spin text-primary-600" />
          <span className="text-sm text-stone-600">{t('championCertUploading')}</span>
        </div>
      )}
      {uploadState === 'verifying' && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-primary-50/30">
          <div className="relative">
            <Loader2 size={32} className="animate-spin text-primary-600" />
            <Shield size={16} className="text-primary-400 absolute -bottom-1 -right-1" />
          </div>
          <span className="text-sm text-stone-600 text-center">{t('championCertVerifying')}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}
