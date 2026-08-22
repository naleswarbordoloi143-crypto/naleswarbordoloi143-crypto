import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: 'primary' | 'accent' | 'wheat' | 'soil' | 'success' | 'warning' | 'info' | 'error';
}

const colorMap = {
  primary: { bg: 'bg-primary-50', text: 'text-primary-600', ring: 'group-hover:ring-primary-200' },
  accent: { bg: 'bg-accent-50', text: 'text-accent-600', ring: 'group-hover:ring-accent-200' },
  wheat: { bg: 'bg-wheat-50', text: 'text-wheat-500', ring: 'group-hover:ring-wheat-200' },
  soil: { bg: 'bg-soil-50', text: 'text-soil-500', ring: 'group-hover:ring-soil-200' },
  success: { bg: 'bg-success-50', text: 'text-success-600', ring: 'group-hover:ring-success-200' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600', ring: 'group-hover:ring-warning-200' },
  info: { bg: 'bg-info-50', text: 'text-info-600', ring: 'group-hover:ring-info-200' },
  error: { bg: 'bg-error-50', text: 'text-error-600', ring: 'group-hover:ring-error-200' },
};

export function StatCard({ label, value, icon, trend, color = 'primary' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="card-pad group animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-stone-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-stone-800 mt-1">{value}</p>
          {trend && <p className="text-xs text-stone-400 mt-1">{trend}</p>}
        </div>
        <div className={cn('p-3 rounded-xl transition-all duration-300 group-hover:scale-110 ring-2 ring-transparent', c.bg, c.text, c.ring)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
