import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Sprout, ArrowRight, ArrowLeft,
  Sparkles, Eye, EyeOff, Mail, KeyRound, CheckCircle, RefreshCw,
  ShieldCheck, Upload, FileImage, Loader2, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/types';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

type ForgotStep = 'none' | 'email' | 'code' | 'password' | 'done';

export function AuthPage({ mode }: AuthPageProps) {
  const { signIn, signUp, sendPasswordReset, verifyResetCode, updatePassword, t, language, setLanguage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Champion certificate upload after signup
  const [certStep, setCertStep] = useState<'none' | 'upload' | 'verifying' | 'done'>('none');
  const [certError, setCertError] = useState<string | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const [forgotStep, setForgotStep] = useState<ForgotStep>('none');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signup') {
      const { error: err } = await signUp(email, password, fullName, phone, village);
      if (err) {
        setError(err);
      } else {
        setCertStep('upload');
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    }
    setLoading(false);
  };

  const handleCertUpload = async () => {
    if (!certFile) return;
    setCertError(null);
    setCertStep('verifying');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Session not found');

      const fileExt = certFile.name.split('.').pop();
      const filePath = `${session.user.id}/certificate-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('champion-certificates')
        .upload(filePath, certFile, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('champion-certificates')
        .getPublicUrl(filePath);

      await supabase
        .from('profiles')
        .update({ champion_certificate_url: urlData.publicUrl, champion_verification_status: 'pending' })
        .eq('id', session.user.id);

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
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: certFile.type,
              userId: session.user.id,
            }),
          });

          if (!response.ok) throw new Error('Verification failed');
          const result = await response.json();

          if (result.error && !result.configured) {
            setCertError(result.error);
            setCertStep('upload');
          } else if (result.error) {
            setCertError(result.error);
            setCertStep('upload');
          } else {
            setCertStep('done');
          }
        } catch {
          setCertError('AI verification failed. You can verify later from your profile.');
          setCertStep('upload');
        }
      };
      reader.readAsDataURL(certFile);
    } catch (e: any) {
      setCertError(e.message || 'Upload failed.');
      setCertStep('upload');
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    const { error: err } = await sendPasswordReset(forgotEmail);
    setForgotLoading(false);
    if (err) {
      setForgotError(err);
    } else {
      setInfoMessage(t('codeSent'));
      setForgotStep('code');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    const { error: err } = await verifyResetCode(forgotEmail, resetCode);
    setForgotLoading(false);
    if (err) {
      setForgotError(err);
    } else {
      setForgotStep('password');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (newPassword.length < 6) {
      setForgotError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError(t('passwordMismatch'));
      return;
    }
    setForgotLoading(true);
    const { error: err } = await updatePassword(newPassword);
    setForgotLoading(false);
    if (err) {
      setForgotError(err);
    } else {
      setForgotStep('done');
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = resetCode.split('');
    while (newCode.length < 6) newCode.push('');
    newCode[index] = value;
    const joined = newCode.join('');
    setResetCode(joined);
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      setResetCode(pasted.padEnd(6, '').slice(0, 6));
      const lastFilled = Math.min(pasted.length, 5);
      codeRefs.current[lastFilled]?.focus();
    }
  };

  if (forgotStep !== 'none') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-green opacity-30 pointer-events-none" />
        <div className="w-full max-w-md relative">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="p-2.5 bg-primary-600 rounded-xl text-white shadow-soft shadow-primary-600/30">
              <Sprout size={26} />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-stone-800">{t('appName')}</h1>
            </div>
          </div>

          <div className="card-glass p-8 rounded-2xl">
            {forgotStep !== 'done' && (
              <button
                onClick={() => setForgotStep('none')}
                className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4 transition-colors"
              >
                <ArrowLeft size={16} /> {t('backToLogin')}
              </button>
            )}

            {forgotStep === 'email' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-800">{t('forgotPasswordTitle')}</h2>
                    <p className="text-sm text-stone-500">{t('forgotPasswordDesc')}</p>
                  </div>
                </div>
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label className="label-text">{t('email')}</label>
                    <input
                      type="email"
                      className="input-field"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoFocus
                    />
                  </div>
                  {forgotError && (
                    <div className="p-3.5 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm animate-slide-down">
                      {forgotError}
                    </div>
                  )}
                  <button type="submit" disabled={forgotLoading} className="btn-primary w-full text-base py-3">
                    {forgotLoading ? t('loading') : t('sendCode')}
                    {!forgotLoading && <ArrowRight size={18} />}
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'code' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-accent-50 text-accent-600">
                    <KeyRound size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-800">{t('enterCode')}</h2>
                    <p className="text-sm text-stone-500">{t('enterCodeDesc')}</p>
                  </div>
                </div>
                {infoMessage && (
                  <div className="p-3.5 rounded-xl bg-success-50 border border-success-200 text-success-700 text-sm mb-4 flex items-start gap-2">
                    <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                    {infoMessage}
                  </div>
                )}
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        ref={(el) => { codeRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={resetCode[i] || ''}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-stone-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  {forgotError && (
                    <div className="p-3.5 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm animate-slide-down">
                      {forgotError}
                    </div>
                  )}
                  <button type="submit" disabled={forgotLoading || resetCode.replace(/\s/g, '').length < 6} className="btn-primary w-full text-base py-3">
                    {forgotLoading ? t('loading') : t('verifyCode')}
                    {!forgotLoading && <ArrowRight size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setInfoMessage(null);
                      setForgotStep('email');
                    }}
                    className="w-full text-sm text-stone-500 hover:text-stone-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={14} /> {t('resendCode')}
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'password' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-success-50 text-success-600">
                    <KeyRound size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-800">{t('setPassword')}</h2>
                    <p className="text-sm text-stone-500">{t('setPasswordDesc')}</p>
                  </div>
                </div>
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <label className="label-text">{t('newPassword')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input-field pr-11"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label-text">{t('confirmPassword')}</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                    />
                  </div>
                  {forgotError && (
                    <div className="p-3.5 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm animate-slide-down">
                      {forgotError}
                    </div>
                  )}
                  <button type="submit" disabled={forgotLoading} className="btn-primary w-full text-base py-3">
                    {forgotLoading ? t('loading') : t('setPassword')}
                    {!forgotLoading && <ArrowRight size={18} />}
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'done' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4 animate-scale-in">
                  <CheckCircle size={32} className="text-success-600" />
                </div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">{t('passwordReset')}</h2>
                <p className="text-sm text-stone-500 mb-6">
                  You can now login with your new password.
                </p>
                <button
                  onClick={() => {
                    setForgotStep('none');
                    setForgotEmail('');
                    setResetCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setForgotError(null);
                    setInfoMessage(null);
                  }}
                  className="btn-primary w-full text-base py-3"
                >
                  {t('backToLogin')} <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (certStep !== 'none') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-green opacity-30 pointer-events-none" />
        <div className="w-full max-w-md relative">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="p-2.5 bg-primary-600 rounded-xl text-white shadow-soft shadow-primary-600/30">
              <Sprout size={26} />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-stone-800">{t('appName')}</h1>
            </div>
          </div>

          <div className="card-glass p-8 rounded-2xl">
            {certStep === 'upload' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-800">{t('championCertTitle')}</h2>
                    <p className="text-sm text-stone-500">{t('championCertRequiredDesc')}</p>
                  </div>
                </div>

                <div
                  onClick={() => certInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all group mb-4"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-stone-100 group-hover:bg-primary-100 transition-colors">
                      {certFile ? <FileImage size={28} className="text-primary-600" /> : <Upload size={28} className="text-stone-500 group-hover:text-primary-600" />}
                    </div>
                    {certFile ? (
                      <p className="text-sm font-medium text-stone-700">{certFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-stone-600">{t('championCertDragDrop')}</p>
                        <p className="text-xs text-stone-400">{t('championCertFormats')}</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={certInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          setCertError('File too large. Maximum 5MB.');
                          return;
                        }
                        setCertError(null);
                        setCertFile(file);
                      }
                    }}
                  />
                </div>

                {certError && (
                  <div className="mb-4 p-3.5 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    {certError}
                  </div>
                )}

                <button
                  onClick={handleCertUpload}
                  disabled={!certFile}
                  className="btn-primary w-full text-base py-3"
                >
                  {t('championCertUpload')}
                  <ArrowRight size={18} />
                </button>

                <button
                  onClick={() => { window.location.hash = '/dashboard'; window.location.reload(); }}
                  className="w-full text-sm text-stone-500 hover:text-stone-700 flex items-center justify-center gap-1.5 mt-3 transition-colors"
                >
                  Skip for now <ArrowRight size={14} />
                </button>
              </>
            )}

            {certStep === 'verifying' && (
              <div className="text-center py-8">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <Loader2 size={32} className="animate-spin text-primary-600 absolute inset-0 m-auto" />
                  <ShieldCheck size={20} className="text-primary-400 absolute bottom-0 right-0" />
                </div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">{t('championCertVerifying')}</h2>
                <p className="text-sm text-stone-500">AI is checking if your certificate is genuine...</p>
              </div>
            )}

            {certStep === 'done' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4 animate-scale-in">
                  <CheckCircle size={32} className="text-success-600" />
                </div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">Certificate Submitted!</h2>
                <p className="text-sm text-stone-500 mb-6">
                  Your certificate has been analyzed by AI. Visit your profile to see the verification result.
                </p>
                <button
                  onClick={() => { window.location.hash = '/dashboard'; window.location.reload(); }}
                  className="btn-primary w-full text-base py-3"
                >
                  Continue to Dashboard <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-green opacity-40" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-accent-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="relative flex flex-col justify-between p-14 text-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
              <Sprout size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{t('appName')}</h1>
                <span className="badge-beta bg-white/15 text-accent-300 border-white/20">Beta</span>
              </div>
              <p className="text-primary-200 text-sm">किसान भाई</p>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-sm text-primary-100 mb-6">
              <Sparkles size={14} className="text-accent-400" />
              AI-Powered Farming Platform
            </div>
            <h2 className="text-5xl font-bold leading-[1.1] mb-5">{t('tagline')}</h2>
            <p className="text-primary-100/90 text-lg max-w-md leading-relaxed">
              Join thousands of small farmers working together digitally. Bulk buying, machinery sharing,
              harvest pooling, AI assistance, and direct buyer access — all in one platform.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3 max-w-md">
              {['Virtual Clusters', 'Bulk Purchasing', 'AI Farming Assistant', 'Direct Buyer Access',
                'Machinery Sharing', 'Weather Alerts'].map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-primary-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-400 shadow-sm shadow-accent-400/50" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-primary-200">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-success-400 animate-pulse-soft" /> Land ownership stays with you</span>
            <span className="text-primary-300">·</span>
            <span>We coordinate digitally</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-stone-50 overflow-y-auto relative">
        <div className="absolute inset-0 bg-mesh-green opacity-30 pointer-events-none" />
        <div className="w-full max-w-md py-8 relative">
          <div className="flex justify-end mb-4">
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <span>{t('language')}</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 outline-none">
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="bn">বাংলা</option>
                <option value="mr">मराठी</option>
                <option value="ta">தமிழ்</option>
              </select>
            </label>
          </div>
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="p-2.5 bg-primary-600 rounded-xl text-white shadow-soft shadow-primary-600/30"><Sprout size={26} /></div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-stone-800">{t('appName')}</h1>
                <span className="badge-beta">Beta</span>
              </div>
              <p className="text-stone-500 text-xs">{t('tagline')}</p>
            </div>
          </div>

          <div className="card-glass p-8 rounded-2xl">
            <h2 className="text-2xl font-bold text-stone-800 mb-1">
              {mode === 'signup' ? t('createAccount') : t('loginToAccount')}
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              {mode === 'signup' ? t('dontHaveAccount') : t('alreadyHaveAccount')}{' '}
              <a href={mode === 'signup' ? '#/login' : '#/signup'}
                 className="text-primary-600 font-semibold hover:underline inline-flex items-center gap-0.5">
                {mode === 'signup' ? t('login') : t('signup')}
                <ArrowRight size={14} />
              </a>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="label-text">{t('fullName')}</label>
                    <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Ramesh Kumar" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">{t('phone')}</label>
                      <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
                    </div>
                    <div>
                      <label className="label-text">{t('village')}</label>
                      <input className="input-field" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Rampur" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-primary-600" />
                      <p className="text-sm font-semibold text-primary-700">One account, all roles</p>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Your account includes Farmer, Village Champion, and Buyer access. You can switch between them anytime from the top menu. To activate Champion features, you will need to upload a certificate after signup.
                    </p>
                  </div>
                </>
              )}
              <div>
                <label className="label-text">{t('email')}</label>
                <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
              <div>
                <label className="label-text">{t('password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-error-50 border border-error-200 text-error-600 text-sm animate-slide-down">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full text-base py-3">
                {loading ? t('loading') : mode === 'signup' ? t('createAccount') : t('login')}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            {mode === 'login' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setForgotStep('email');
                    setForgotError(null);
                    setInfoMessage(null);
                    setForgotEmail(email);
                  }}
                  className="text-sm text-primary-600 font-semibold hover:underline transition-colors"
                >
                  {t('forgotPassword')}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
