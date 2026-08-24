import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { CardSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { User, Mail, Phone, MapPin, Save, Award, Calendar, Shield } from 'lucide-react';
import { ChampionCertificate } from '@/components/champion/ChampionCertificate';
import type { Language } from '@/lib/types';

export default function ProfilePage() {
  const { profile, t, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [village, setVillage] = useState(profile?.village || '');
  const [district, setDistrict] = useState(profile?.district || '');
  const [state, setState] = useState(profile?.state || '');

  if (!profile) return <CardSpinner />;

  const languageNames: Record<Language, string> = { en: 'English', hi: 'हिंदी', bn: 'বাংলা', mr: 'मराठी', ta: 'தமிழ்' };

  const save = async () => {
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: fullName, phone, village, district, state, updated_at: new Date().toISOString(),
    }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false); setEditing(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="card-pad">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-3xl font-bold">{profile.full_name?.charAt(0).toUpperCase() || '?'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-stone-800">{profile.full_name}</h2>
            <p className="text-sm text-stone-500 capitalize">{t(profile.active_role || profile.role)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge-accent"><Award size={12} /> {profile.points_balance} points</span>
              <span className="badge-neutral">{t('joined')} {formatDate(profile.created_at)}</span>
              {(profile.active_role || profile.role) === 'champion' && profile.champion_verified && (
                <span className="badge-primary flex items-center gap-1"><Shield size={12} /> Verified Champion</span>
              )}
            </div>
          </div>
          {!editing && <button onClick={() => setEditing(true)} className="btn-secondary text-sm">{t('edit')}</button>}
        </div>

        {saved && <div className="mb-4 p-3 rounded-xl bg-success-50 border border-success-500/20 text-success-700 text-sm">{t('profileSaved')}</div>}

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
            <User size={18} className="text-stone-400" />
            {editing ? <input className="input-field flex-1" value={fullName} onChange={(e) => setFullName(e.target.value)} /> : <p className="text-sm text-stone-700">{profile.full_name}</p>}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
            <Mail size={18} className="text-stone-400" />
            <p className="text-sm text-stone-700">{profile.email}</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
            <Phone size={18} className="text-stone-400" />
            {editing ? <input className="input-field flex-1" value={phone} onChange={(e) => setPhone(e.target.value)} /> : <p className="text-sm text-stone-700">{profile.phone || 'Not set'}</p>}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
            <MapPin size={18} className="text-stone-400" />
            {editing ? (
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input className="input-field" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village" />
                <input className="input-field" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" />
                <input className="input-field" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
              </div>
            ) : <p className="text-sm text-stone-700">{[profile.village, profile.district, profile.state].filter(Boolean).join(', ') || 'Not set'}</p>}
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 mt-6">
            <button onClick={() => { setEditing(false); setFullName(profile.full_name); setPhone(profile.phone); setVillage(profile.village); setDistrict(profile.district); setState(profile.state); }} className="btn-ghost">{t('cancel')}</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1"><Save size={18} /> {saving ? t('loading') : t('save')}</button>
          </div>
        )}
      </div>

      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3">{t('accountInfo')}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">{t('activeRole')}</p><p className="font-semibold text-stone-700 capitalize">{t(profile.active_role || profile.role)}</p></div>
          <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">{t('status')}</p><p className="font-semibold text-success-600">{profile.is_active ? t('active') : t('inactive')}</p></div>
          <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">{t('language')}</p><p className="font-semibold text-stone-700">{languageNames[profile.preferred_language as Language] || languageNames.en}</p></div>
          <div className="p-3 rounded-xl bg-stone-50"><p className="text-xs text-stone-400">{t('memberSince')}</p><p className="font-semibold text-stone-700">{formatDate(profile.created_at)}</p></div>
        </div>
      </div>

      {profile.roles?.includes('champion') && <ChampionCertificate />}
    </div>
  );
}
