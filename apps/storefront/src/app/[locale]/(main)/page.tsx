import {
  Hero,
  HomeCategories,
  HomePopularBrandsSection,
  HomeProductSection,
  SellOnMarketplaceSection,
} from "@/components/sections"

import type { Metadata } from "next"
import { heroSlides } from "@/data/heroSlides"

import { headers } from "next/headers"
import Script from "next/script"
import { listRegions } from "@/lib/data/regions"
import {
  buildHreflangAlternates,
  getStorefrontLocales,
  toHreflang,
} from "@/lib/helpers/hreflang"
import { siteConfig } from "@/config/site"

const withVendorUrl = (link: { label: string; path: string }) =>
  link.path === "VENDOR_URL"
    ? { ...link, path: process.env.NEXT_PUBLIC_VENDOR_URL || "/" }
    : link

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

  let locales: string[] = []
  try {
    locales = getStorefrontLocales(await listRegions())
  } catch {
    locales = [locale]
  }

  const { canonical, languages } = buildHreflangAlternates({
    baseUrl,
    path: "",
    locale,
    locales,
  })

  const title = "Home"
  const description =
    siteConfig.description
  const ogImage = "/B2C_Storefront_Open_Graph.png"

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: `${title} | ${
        siteConfig.name
      }`,
      description,
      url: canonical,
      siteName:
        siteConfig.name,
      type: "website",
      images: [
        {
          url: ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`,
          width: 1200,
          height: 630,
          alt:
            siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`],
    },
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

  const siteName =
    siteConfig.name

  return (
    <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start text-primary">
      <link
        rel="preload"
        as="image"
        href={heroSlides[0]?.image}
        imageSizes="(min-width: 1024px) 50vw, 100vw"
      />
      <Script
        id="ld-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteName,
            url: `${baseUrl}/${locale}`,
            logo: `${baseUrl}/icon.svg`,
          }),
        }}
      />
      <Script
        id="ld-website"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: siteName,
            url: `${baseUrl}/${locale}`,
            inLanguage: toHreflang(locale),
          }),
        }}
      />

      <Hero
        slides={heroSlides.map((slide) => ({
          ...slide,
          // "VENDOR_URL" in data/heroSlides.ts → the vendor panel address.
          primary: withVendorUrl(slide.primary),
          secondary: slide.secondary && withVendorUrl(slide.secondary),
        }))}
      />
      <div className="px-4 lg:px-8 w-full">
        <HomeCategories heading="SHOP BY CATEGORY" />
      </div>
      <div className="px-4 lg:px-8 w-full">
        <HomeProductSection heading="new in the shop" locale={locale} home />
      </div>
      <HomePopularBrandsSection />
      <SellOnMarketplaceSection />
    </main>
  )
}
