import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { siteConfig } from "@/config/site"
import { infoPages } from "@/data/infoPages"
import { getDeliverySettings } from "@/lib/data/delivery"

/** Footer pages: /info/help, /info/delivery, /info/returns … (text in data/infoPages.ts) */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const page = infoPages[(await params).slug]
  return page ? { title: `${page.title} | ${siteConfig.name}`, description: page.intro } : {}
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = infoPages[slug]
  if (!page) notFound()

  // "{FREE_DELIVERY}" → the live rule set in admin → Delivery
  const settings = await getDeliverySettings()
  const free = settings?.free_order_label ? `${settings.free_order_label}.` : ""
  const fill = (t: string) => t.replace("{FREE_DELIVERY}", free).trim()

  return (
    <main className="container max-w-3xl py-10" data-testid={`info-page-${slug}`}>
      <h1 className="heading-lg text-primary mb-3">{page.title}</h1>
      <p className="text-lg text-secondary mb-8">{fill(page.intro)}</p>
      {page.sections.map((s) => (
        <section key={s.heading} className="mb-8">
          <h2 className="heading-sm text-primary mb-2 uppercase">{s.heading}</h2>
          {s.paragraphs.map(fill).filter(Boolean).map((p, i) => (
            <p key={i} className="text-md text-primary mb-3 leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
