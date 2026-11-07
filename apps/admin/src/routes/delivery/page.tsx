import { useEffect, useState } from "react"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { TruckFast } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { getAuthHeaders } from "@mercurjs/admin"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Delivery",
  icon: TruckFast,
}

type Values = { freeMinOrder: number; freeOrderCities: string[] }
type State = { current: Values; defaults: Values; overrides: Partial<Values>; label: string }

const api = () => `${__BACKEND_URL__}/admin/delivery-settings`

/**
 * Admin → Delivery: free-delivery order amount and towns. Saved in the
 * database, live in the shop within seconds — no redeploy.
 * Backend: packages/api/src/lib/delivery/overrides.ts
 */
const DeliveryPage = () => {
  const [state, setState] = useState<State | null>(null)
  const [amount, setAmount] = useState("")
  const [towns, setTowns] = useState("")
  const [saving, setSaving] = useState(false)

  const apply = (s: State) => {
    setState(s)
    setAmount(String(s.current.freeMinOrder))
    setTowns(s.current.freeOrderCities.join(", "))
  }

  useEffect(() => {
    fetch(api(), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(apply)
      .catch(() => toast.error("Could not load delivery settings"))
  }, [])

  const save = async (reset = false) => {
    const n = Number(amount)
    if (!reset && (amount.trim() === "" || !Number.isFinite(n) || n < 0)) {
      toast.error("Enter an amount of 0 or more (0 turns free delivery off)")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(api(), {
        method: "POST",
        headers: { ...getAuthHeaders(), "content-type": "application/json" },
        body: JSON.stringify(
          reset
            ? {}
            : {
                freeMinOrder: n,
                freeOrderCities: towns.split(",").map((t) => t.trim()).filter(Boolean),
              }
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Could not save")
      apply(json)
      toast.success(reset ? "Back to the default settings" : "Saved — the shop shows it now")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading>Delivery</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Free delivery for big orders. Changes apply to the shop and checkout within a few seconds.
        </Text>
      </div>
      <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="free-min">Free delivery on orders from (USD)</Label>
          <Input
            id="free-min"
            type="number"
            min={0}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Whole cart, before delivery. 0 turns it off.
          </Text>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="free-towns">In these towns</Label>
          <Input
            id="free-towns"
            placeholder="Harare, Chitungwiza"
            value={towns}
            onChange={(e) => setTowns(e.target.value)}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Separate with commas. Leave empty for everywhere.
          </Text>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Shop shows: <span className="text-ui-fg-base">{state?.label || "No free-delivery amount"}</span>
        </Text>
        <div className="flex gap-2">
          {state && Object.keys(state.overrides).length > 0 && (
            <Button variant="secondary" size="small" onClick={() => save(true)} isLoading={saving}>
              Use defaults
            </Button>
          )}
          <Button size="small" onClick={() => save()} isLoading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Container>
  )
}

export default DeliveryPage
