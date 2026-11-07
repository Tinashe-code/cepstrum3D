import { cn } from '@/lib/utils';

/** Read-only star rating, e.g. 4.3 → ★★★★☆ (partial stars filled proportionally). */
export const Stars = ({
  value,
  size = 16,
  className,
  label
}: {
  value: number;
  size?: number;
  className?: string;
  label?: string;
}) => (
  <span
    className={cn('inline-flex items-center', className)}
    role="img"
    aria-label={label ?? `${value} out of 5 stars`}
  >
    {[0, 1, 2, 3, 4].map(i => {
      const fill = Math.max(0, Math.min(1, value - i));
      return (
        <span
          key={i}
          className="relative inline-block"
          style={{ width: size, height: size }}
        >
          <svg viewBox="0 0 20 20" width={size} height={size} className="absolute inset-0 text-gray-300" aria-hidden>
            <path fill="currentColor" d="M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.8l6-.8z" />
          </svg>
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
            <svg viewBox="0 0 20 20" width={size} height={size} className="text-amber-500" aria-hidden>
              <path fill="currentColor" d="M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.8l6-.8z" />
            </svg>
          </span>
        </span>
      );
    })}
  </span>
);
