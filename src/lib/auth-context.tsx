import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, UserRole, Language } from '@/lib/types';
import { t as translate } from '@/lib/i18n';
import { detectLocation } from '@/lib/utils';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  signUp: (email: string, password: string, fullName: string, phone: string, village: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  switchRole: (role: UserRole) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  verifyResetCode: (email: string, code: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('kb_lang') as Language) || 'en');

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) {
      console.error('Profile load error:', error.message);
      return;
    }
    if (!data) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
        id: uid,
        role: 'farmer',
        roles: ['farmer', 'champion', 'buyer'],
        active_role: 'farmer',
        full_name: user?.user_metadata?.full_name || '',
        phone: user?.user_metadata?.phone || '',
        email: user?.email || '',
        village: '',
        preferred_language: (localStorage.getItem('kb_lang') as Language) || 'en',
      }).select('*').single();
      if (insertError) {
        console.error('Profile create error:', insertError.message);
        return;
      }
      setProfile(newProfile as Profile | null);
      return;
    }
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        (async () => { await loadProfile(s.user.id); })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kb_lang', lang);
    if (session?.user) {
      supabase.from('profiles').update({ preferred_language: lang }).eq('id', session.user.id).then(() => undefined);
    }
  }, [session?.user]);

  const t = useCallback((key: string) => translate(language, key), [language]);

  const signUp = useCallback(async (
    email: string, password: string, fullName: string, phone: string, village: string
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Failed to create account' };

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      role: 'farmer',
      roles: ['farmer', 'champion', 'buyer'],
      active_role: 'farmer',
      full_name: fullName,
      phone,
      email,
      village,
      preferred_language: language,
    });
    if (profileError) return { error: profileError.message };
    if (data.user) await loadProfile(data.user.id);
    return { error: null };
  }, [language, loadProfile]);

  const switchRole = useCallback(async (newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ active_role: newRole, role: newRole, updated_at: new Date().toISOString() })
      .eq('id', session?.user?.id || '');
    if (error) {
      console.error('Switch role error:', error.message);
      return;
    }
    await loadProfile(session!.user.id);
  }, [session, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfile(data.user.id);
      detectLocation().then((loc) => {
        if (!loc) return;
        const updates: Record<string, string | number> = {
          latitude: loc.latitude,
          longitude: loc.longitude,
        };
        if (loc.village) updates.village = loc.village;
        if (loc.district) updates.district = loc.district;
        if (loc.state) updates.state = loc.state;
        supabase.from('profiles').update(updates).eq('id', data.user.id).then(() => {
          loadProfile(data.user.id);
        });
      });
    }
    return { error: null };
  }, [loadProfile]);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/login`,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const verifyResetCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, language, setLanguage, t, signUp, signIn, switchRole, sendPasswordReset, verifyResetCode, updatePassword, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
