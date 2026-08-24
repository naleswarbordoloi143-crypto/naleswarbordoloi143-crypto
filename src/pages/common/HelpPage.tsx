import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';
import { HelpCircle, MessageSquare, Send, Phone, Mail, ChevronDown, ChevronUp, LifeBuoy } from 'lucide-react';

const FAQS = [
  { q: 'How do I create a farm cluster?', a: 'Go to the Clusters page and click "New Cluster". Other farmers in your village can then join. Land ownership is never transferred — clusters only coordinate digitally.' },
  { q: 'How does bulk buying work?', a: 'Create a bulk purchase request for seeds, fertilizer, or other supplies. When multiple farmers join, the combined quantity gets you wholesale prices. Savings are calculated automatically.' },
  { q: 'How do I book machinery?', a: 'Visit the Machinery page, find available equipment, and book a time slot. The system prevents double-booking automatically.' },
  { q: 'What is harvest pooling?', a: 'Pool your harvest with other farmers into a lot. Larger quantities attract better prices from buyers. Each farmer\'s contribution is tracked individually.' },
  { q: 'How does the AI assistant work?', a: 'Kishan Bhai AI answers farming questions in English and Hindi. It uses your farm profile and crop data for personalized advice. AI advice is advisory — always verify with local experts.' },
  { q: 'How do I earn reward points?', a: 'You earn points for bulk purchases, quality assessments, harvest contributions, sales records, and group participation. Points can be redeemed for rewards.' },
  { q: 'Is my land ownership affected?', a: 'No. Land ownership is NEVER transferred. The platform only digitally coordinates farmers. You always own your individual farm.' },
  { q: 'Which languages are supported?', a: 'English, Hindi, Bengali, Marathi, and Tamil are supported.' },
];

const CATEGORIES = ['General', 'Account', 'Orders', 'Payments', 'AI Assistant', 'Machinery', 'Other'];

export default function HelpPage() {
  const { profile, t } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showComplaint, setShowComplaint] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);

  const submitComplaint = async () => {
    if (!profile || !subject || !description) return;
    await supabase.from('complaints').insert({ user_id: profile.id, subject, category, description });
    setSubmitted(true);
    setSubject(''); setDescription(''); setCategory('General');
    setTimeout(() => { setShowComplaint(false); setSubmitted(false); }, 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div><h2 className="text-xl font-bold text-stone-800">{t('help')}</h2><p className="text-sm text-stone-500">{t('helpDesc')}</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="tel:1800-200-3000" className="card-pad flex flex-col items-center text-center hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-primary-50 text-primary-600 mb-2"><Phone size={24} /></div>
          <p className="font-semibold text-stone-700 text-sm">Call Support</p>
          <p className="text-xs text-stone-400">1800-200-3000</p>
        </a>
        <a href="mailto:help@kishanbhai.app" className="card-pad flex flex-col items-center text-center hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-primary-50 text-primary-600 mb-2"><Mail size={24} /></div>
          <p className="font-semibold text-stone-700 text-sm">Email Us</p>
          <p className="text-xs text-stone-400">help@kishanbhai.app</p>
        </a>
        <button onClick={() => setShowComplaint(true)} className="card-pad flex flex-col items-center text-center hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-accent-50 text-accent-600 mb-2"><LifeBuoy size={24} /></div>
          <p className="font-semibold text-stone-700 text-sm">Report Issue</p>
          <p className="text-xs text-stone-400">Submit a complaint</p>
        </button>
      </div>

      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><HelpCircle size={20} className="text-primary-600" /> Frequently Asked Questions</h3>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl border border-stone-100 overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors">
                <span className="font-semibold text-sm text-stone-700">{faq.q}</span>
                {openFaq === i ? <ChevronUp size={18} className="text-stone-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-stone-400 flex-shrink-0" />}
              </button>
              {openFaq === i && <div className="px-4 pb-4 text-sm text-stone-600">{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>

      <Modal open={showComplaint} onClose={() => setShowComplaint(false)} title="Report an Issue">
        <div className="space-y-4">
          {submitted ? <div className="p-4 rounded-xl bg-success-50 border border-success-500/20 text-success-700 text-sm text-center">Issue submitted. We will get back to you soon.</div> : (
            <>
              <div><label className="label-text">Subject</label><input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of the issue" /></div>
              <div><label className="label-text">Category</label><select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label-text">Description</label><textarea className="input-field" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail" /></div>
              <div className="flex gap-2 justify-end"><button onClick={() => setShowComplaint(false)} className="btn-ghost">{t('cancel')}</button><button onClick={submitComplaint} className="btn-primary"><Send size={16} /> Submit</button></div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
