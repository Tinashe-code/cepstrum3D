import { Button } from "@/components/atoms"

const points = [
  {
    title: "Reach makers nationwide",
    text: "List filament, resin, printers and parts in front of buyers from Harare to Bulawayo.",
  },
  {
    title: "Your price, your stock",
    text: "Sell against shared product pages and compete on price, stock and delivery — no catalogue work.",
  },
  {
    title: "Get paid locally",
    text: "Customers pay by EcoCash, OneMoney or card. Payouts to your mobile wallet or bank on a regular schedule.",
  },
]

export const SellOnLayerlineSection = () => {
  const vendorUrl = process.env.NEXT_PUBLIC_VENDOR_URL || "/"

  return (
    <section className="bg-tertiary container text-tertiary" data-testid="sell-on-layerline">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px">
        <div className="py-8 px-6 flex flex-col justify-between border border-secondary rounded-sm">
          <div className="mb-8">
            <span className="text-sm inline-block px-4 py-1 border border-secondary rounded-sm mb-4">
              FOR VENDORS
            </span>
            <h2 className="display-sm uppercase">Sell on Layerline</h2>
            <p className="text-lg max-w-lg">
              Run a 3D printing shop? Open a vendor account and start selling to
              makers, schools and engineers across Zimbabwe.
            </p>
          </div>
          <a href={vendorUrl} className="w-fit">
            <Button size="large" className="w-fit bg-secondary/10">
              BECOME A VENDOR
            </Button>
          </a>
        </div>
        <ul className="grid grid-cols-1 border border-secondary rounded-sm">
          {points.map(({ title, text }) => (
            <li key={title} className="px-6 py-6 border-b border-secondary last:border-b-0">
              <h3 className="heading-sm uppercase mb-2">{title}</h3>
              <p className="text-md">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
