import { useRewards } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/ui/StatCard';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';
import { Award, TrendingUp, TrendingDown, Gift } from 'lucide-react';

export default function RewardsPage() {
  const { profile, t } = useAuth();
  const { transactions, loading } = useRewards();

  if (loading) return <CardSpinner />;

  const totalEarned = transactions.filter((t: any) => t.type === 'EARNED').reduce((s: number, t: any) => s + t.points, 0);
  const totalSpent = transactions.filter((t: any) => t.type === 'SPENT').reduce((s: number, t: any) => s + t.points, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-stone-800">Rewards</h2>
        <p className="text-sm text-stone-500">Earn points for active participation</p>
      </div>

      <div className="bg-gradient-to-br from-accent-400 to-accent-600 rounded-2xl p-8 text-center text-stone-900 shadow-md">
        <Gift size={40} className="mx-auto mb-2" />
        <p className="text-5xl font-bold">{profile?.points_balance}</p>
        <p className="text-lg font-semibold mt-1">Points Balance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Total Earned" value={totalEarned} icon={<TrendingUp size={22} />} color="success" />
        <StatCard label="Total Spent" value={totalSpent} icon={<TrendingDown size={22} />} color="warning" />
      </div>

      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2"><Award size={20} className="text-accent-600" /> Transaction History</h3>
        {transactions.length === 0 ? (
          <EmptyState icon={<Award size={32} />} title="No transactions yet" description="Earn points by participating in bulk orders, quality assessments, machinery sharing and more" />
        ) : (
          <div className="space-y-2">
            {transactions.map((tr: any) => (
              <div key={tr.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <p className="font-semibold text-sm text-stone-700">{tr.reason}</p>
                  <p className="text-xs text-stone-400">{timeAgo(tr.created_at)}</p>
                </div>
                <p className={`font-bold ${tr.type === 'EARNED' ? 'text-success-600' : 'text-error-500'}`}>
                  {tr.type === 'EARNED' ? '+' : '-'}{tr.points}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-pad">
        <h3 className="font-bold text-stone-800 mb-3">Ways to Earn</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Join a bulk order', points: 10 },
            { label: 'Contribute to harvest pool', points: 15 },
            { label: 'Accept a buyer offer', points: 20 },
            { label: 'Timely delivery', points: 25 },
            { label: 'Record a sale', points: 5 },
            { label: 'Complete farm records', points: 10 },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between p-3 rounded-xl bg-accent-50 border border-accent-100">
              <p className="text-sm text-stone-700">{r.label}</p>
              <span className="badge-accent">+{r.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
