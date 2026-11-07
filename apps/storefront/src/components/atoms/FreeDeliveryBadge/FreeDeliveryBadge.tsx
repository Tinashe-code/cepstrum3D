import { cn } from '@/lib/utils';
import { freeDeliveryLabel, getFreeDeliveryRule } from '@/lib/helpers/free-delivery';

export const TruckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn('h-4 w-4 shrink-0', className)}>
    <path d="M10 17h4V6H2v11h2" />
    <path d="M14 9h4l4 4v4h-2" />
    <circle cx="7" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </svg>
);

/** "🚚 Free delivery in Harare from 4 spools" — shown when the product has a free-delivery rule. */
export const FreeDeliveryBadge = ({
  metadata,
  className,
}: {
  metadata?: Record<string, unknown> | null;
  className?: string;
}) => {
  const rule = getFreeDeliveryRule(metadata);
  if (!rule) return null;
  return (
    <p
      className={cn('flex items-center gap-1.5 text-[13px] font-semibold text-[#15803d]', className)}
      data-testid="free-delivery-badge"
    >
      <TruckIcon />
      {freeDeliveryLabel(rule)}
    </p>
  );
};
