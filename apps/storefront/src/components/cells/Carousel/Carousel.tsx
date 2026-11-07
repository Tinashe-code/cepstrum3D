"use client"

import useEmblaCarousel from "embla-carousel-react"

import { Indicator } from "@/components/atoms"
import { ArrowLeftIcon, ArrowRightIcon } from "@/icons"
import { useCallback, useEffect, useState } from "react"
import { EmblaCarouselType } from "embla-carousel"
import tailwindConfig from "../../../../tailwind.config"
import { cn } from "@/lib/utils"

/**
 * Horizontal product row. Swipe on phones; on computers drag it or use the
 * side arrows. Arrows only show when there is more to scroll to, so when all
 * items fit on the screen the row simply sits still.
 */
export const CustomCarousel = ({
  variant = "light",
  items,
  align = "start",
}: {
  variant?: "light" | "dark"
  items: React.ReactNode[]
  align?: "center" | "start" | "end"
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align,
    containScroll: "trimSnaps",
    slidesToScroll: "auto",
  })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [snapCount, setSnapCount] = useState(items.length)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const onSelect = useCallback((api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap())
    setSnapCount(api.scrollSnapList().length)
    setCanPrev(api.canScrollPrev())
    setCanNext(api.canScrollNext())
  }, [])

  useEffect(() => {
    if (!emblaApi) return

    onSelect(emblaApi)
    emblaApi.on("reInit", onSelect).on("select", onSelect)
    return () => {
      emblaApi.off("reInit", onSelect).off("select", onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const arrowColor = {
    light: tailwindConfig.theme.extend.colors.primary,
    dark: tailwindConfig.theme.extend.colors.tertiary,
  }

  const sideArrow =
    "absolute top-1/3 z-10 hidden h-11 w-11 items-center justify-center rounded-full border bg-white shadow-md transition-opacity hover:border-accent sm:flex"

  return (
    <div className="embla relative w-full" data-testid="carousel">
      <div className="embla__viewport overflow-hidden rounded-xs w-full" ref={emblaRef}>
        <div className="embla__container flex">{items.map((slide) => slide)}</div>
      </div>

      {/* Desktop / tablet arrows */}
      {canPrev && (
        <button
          type="button"
          onClick={scrollPrev}
          aria-label="Scroll left"
          className={cn(sideArrow, "-left-3")}
          data-testid="carousel-prev"
        >
          <ArrowLeftIcon color={arrowColor.light} />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Scroll right"
          className={cn(sideArrow, "-right-3")}
          data-testid="carousel-next"
        >
          <ArrowRightIcon color={arrowColor.light} />
        </button>
      )}

      {/* Phone controls */}
      {snapCount > 1 && (
        <div className="flex justify-between items-center mt-4 sm:hidden">
          <div className="w-1/2">
            <Indicator variant={variant} maxStep={snapCount} step={selectedIndex + 1} />
          </div>
          <div>
            <button onClick={scrollPrev} aria-label="Previous">
              <ArrowLeftIcon color={arrowColor[variant]} />
            </button>
            <button onClick={scrollNext} aria-label="Next">
              <ArrowRightIcon color={arrowColor[variant]} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
