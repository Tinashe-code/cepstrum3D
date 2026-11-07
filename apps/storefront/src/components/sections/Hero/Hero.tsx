"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ArrowRightIcon } from "@/icons"
import { cn } from "@/lib/utils"
import type { HeroSlide } from "@/data/heroSlides"

export type { HeroSlide }

const AUTOPLAY_MS = 6000

/** Text-panel backgrounds. The repeating lines are a nod to printed layers. */
const THEMES: Record<
  HeroSlide["theme"],
  { panel: string; text: string; sub: string; eyebrow: string; badge: string; secondary: string }
> = {
  light: {
    panel:
      "bg-[linear-gradient(135deg,#FFF7ED_0%,#FFEDD5_55%,#FED7AA_100%)]",
    text: "text-primary",
    sub: "text-secondary",
    eyebrow: "bg-accent text-white",
    badge: "bg-accent text-white",
    secondary: "border-black/25 text-primary hover:bg-black/5",
  },
  sale: {
    panel: "bg-[linear-gradient(135deg,#DC2626_0%,#EA580C_100%)]",
    text: "text-white",
    sub: "text-white/90",
    eyebrow: "bg-white text-sale",
    badge: "bg-white text-sale",
    secondary: "border-white/60 text-white hover:bg-white/10",
  },
  fresh: {
    panel: "bg-[linear-gradient(135deg,#ECFDF5_0%,#D1FAE5_60%,#A7F3D0_100%)]",
    text: "text-primary",
    sub: "text-secondary",
    eyebrow: "bg-[#047857] text-white",
    badge: "bg-[#047857] text-white",
    secondary: "border-black/25 text-primary hover:bg-black/5",
  },
  dark: {
    panel: "bg-[linear-gradient(135deg,#111113_0%,#27272A_100%)]",
    text: "text-white",
    sub: "text-white/80",
    eyebrow: "bg-accent text-white",
    badge: "bg-accent text-white",
    secondary: "border-white/40 text-white hover:bg-white/10",
  },
}

const LAYER_LINES =
  "bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.18)_0px,rgba(255,255,255,0.18)_2px,transparent_2px,transparent_14px)]"

function SlideLink({
  path,
  className,
  children,
}: {
  path: string
  className: string
  children: React.ReactNode
}) {
  return /^https?:\/\//.test(path) ? (
    <a href={path} className={className}>
      {children}
    </a>
  ) : (
    <LocalizedClientLink href={path} className={className}>
      {children}
    </LocalizedClientLink>
  )
}

export const Hero = ({ slides }: { slides: HeroSlide[] }) => {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = useRef(false)
  const touchX = useRef<number | null>(null)
  const count = slides.length

  const go = useCallback(
    (i: number) => setIndex(((i % count) + count) % count),
    [count]
  )

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    if (paused || count < 2 || reducedMotion.current) return
    const t = setTimeout(() => go(index + 1), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [index, paused, count, go])

  if (!count) return null

  return (
    <section
      className="relative w-full container mt-5"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
        touchX.current = null
      }}
      data-testid="hero-carousel"
    >
      <div className="relative overflow-hidden rounded-sm border">
        <div
          className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => {
            const t = THEMES[slide.theme]
            return (
              <div
                key={slide.id}
                className="flex w-full shrink-0 flex-col lg:flex-row"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}: ${slide.heading}`}
                aria-hidden={i !== index}
                data-testid={`hero-slide-${slide.id}`}
              >
                <div className="relative aspect-[4/3] w-full lg:w-1/2 lg:aspect-auto lg:min-h-[480px]">
                  <Image
                    src={slide.image}
                    alt={slide.imageAlt}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>

                <div
                  className={cn(
                    "relative flex w-full flex-col justify-center gap-5 overflow-hidden px-6 py-10 lg:w-1/2 lg:px-12",
                    t.panel
                  )}
                >
                  <div className={cn("pointer-events-none absolute inset-0 opacity-60", LAYER_LINES)} />

                  <div className="relative flex flex-col gap-4">
                    {slide.eyebrow && (
                      <span
                        className={cn(
                          "w-fit rounded-xs px-3 py-1 text-xs font-bold uppercase tracking-wider",
                          t.eyebrow
                        )}
                      >
                        {slide.eyebrow}
                      </span>
                    )}

                    <h2
                      className={cn(
                        "max-w-[620px] font-bold uppercase leading-tight text-4xl md:text-5xl",
                        t.text
                      )}
                    >
                      {slide.heading}
                    </h2>

                    {slide.badge && (
                      <span
                        className={cn(
                          "w-fit -rotate-2 rounded-sm px-4 py-2 text-2xl font-extrabold uppercase shadow-md md:text-3xl",
                          t.badge
                        )}
                      >
                        {slide.badge}
                      </span>
                    )}

                    <p className={cn("max-w-[560px] text-lg", t.sub)}>{slide.paragraph}</p>

                    <div className="mt-2 flex flex-wrap gap-3">
                      <SlideLink
                        path={slide.primary.path}
                        className="group inline-flex items-center gap-2 rounded-sm bg-accent px-6 py-3 font-bold uppercase text-white shadow-sm transition-colors hover:bg-accent-hover"
                      >
                        {slide.primary.label}
                        <ArrowRightIcon color="#ffffff" size={20} />
                      </SlideLink>
                      {slide.secondary && (
                        <SlideLink
                          path={slide.secondary.path}
                          className={cn(
                            "inline-flex items-center rounded-sm border px-6 py-3 font-bold uppercase transition-colors",
                            t.secondary
                          )}
                        >
                          {slide.secondary.label}
                        </SlideLink>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="absolute left-3 top-[37%] lg:top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
              data-testid="hero-prev"
            >
              <ArrowRightIcon className="rotate-180" size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="absolute right-3 top-[37%] lg:top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
              data-testid="hero-next"
            >
              <ArrowRightIcon size={20} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Choose slide">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show slide ${i + 1}: ${slide.heading}`}
              onClick={() => go(i)}
              className={cn(
                "h-2.5 rounded-full transition-all",
                i === index ? "w-8 bg-accent" : "w-2.5 bg-neutral-300 hover:bg-neutral-400"
              )}
              data-testid="hero-dot"
            />
          ))}
        </div>
      )}
    </section>
  )
}
