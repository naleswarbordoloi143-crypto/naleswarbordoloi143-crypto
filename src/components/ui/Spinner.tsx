import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  className?: string;
  size?: number;
}

export function Spinner({ className, size = 24 }: SpinnerProps) {
  return <Loader2 className={cn('animate-spin text-primary-600', className)} size={size} />;
}

export function FullPageSpinner({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-stone-50">
      <div className="p-4 rounded-2xl bg-white shadow-sm">
        <Spinner size={32} />
      </div>
      {message && <p className="text-stone-500 text-sm">{message}</p>}
    </div>
  );
}

export function CardSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  );
}
