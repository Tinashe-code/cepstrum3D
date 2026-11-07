import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/**
 * Brand mark (three printed layers) + the marketplace name from src/config/site.ts.
 * The name is live text, so renaming the site never needs a new logo file.
 */
export const SiteLogo = ({ className }: { className?: string }) => (
  <span
    className={cn("inline-flex items-center gap-2 text-primary", className)}
    aria-label={siteConfig.name}
  >
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <rect x="0" y="18" width="28" height="5" rx="2.5" fill="#090909" />
      <rect x="3" y="10" width="22" height="5" rx="2.5" fill="#090909" fillOpacity="0.6" />
      <rect x="6" y="2" width="16" height="5" rx="2.5" fill="#EA580C" />
    </svg>
    {/* text-[20px], not text-xl: globals.css forces text-xl to a light weight */}
    <span className="text-[20px] font-extrabold uppercase tracking-[0.08em] leading-none">
      {siteConfig.name}
    </span>
  </span>
)
