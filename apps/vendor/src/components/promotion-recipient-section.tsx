import { useEffect, useState } from "react"
import { Badge, Button, Checkbox, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { getAuthHeaders } from "@mercurjs/vendor"

declare const __BACKEND_URL__: string

type Recipient = { email?: string; phone?: string; name?: string } | null
type State = { recipient: Recipient; sent_at: string | null; promotion: { code: string } }

const api = (id: string) => `${__BACKEND_URL__}/vendor/promotions/${id}/recipient`

/**
 * Promotion page → "Only for one customer": reserve this code for one
 * customer (email and/or phone) and email it to them from Cepstrum3D.
 * Backend: packages/api/src/lib/promotions/recipient.ts
 */
export const PromotionRecipientSection = ({ data }: { data?: unknown }) => {
  const id = (data as { id?: string } | undefined)?.id
  const [state, setState] = useState<State | null>(null)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)

  const apply = (s: State) => {
    setState(s)
    setEmail(s.recipient?.email ?? "")
    setPhone(s.recipient?.phone ?? "")
    setName(s.recipient?.name ?? "")
  }

  useEffect(() => {
    if (!id) return
    fetch(api(id), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(apply)
      .catch(() => undefined)
  }, [id])

  const save = async (clear = false) => {
    if (!id) return
    setSaving(true)
    try {
      const res = await fetch(api(id), {
        method: "POST",
        headers: { ...getAuthHeaders(), "content-type": "application/json" },
        body: JSON.stringify(
          clear ? { email: null, phone: null } : { email, phone, name, message, notify: notify && !!email }
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Could not save")
      apply(json)
      setMessage("")
      toast.success(
        clear ? "Anyone can use this code again" : notify && email ? `Saved and sent to ${email}` : "Saved"
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const reserved = !!state?.recipient

  return (
    <Container className="divide-y p-0" data-testid="promotion-recipient-section">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h2">Only for one customer</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Reserve this code for one customer. It then only works when their email or phone number is on the
            order. The email to them comes from Cepstrum3D.
          </Text>
        </div>
        {reserved ? (
          <Badge size="2xsmall" color="orange">Reserved</Badge>
        ) : (
          <Badge size="2xsmall" color="grey">Anyone</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-3">
        <div>
          <Label size="small">Customer email</Label>
          <Input size="small" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="recipient-email" />
        </div>
        <div>
          <Label size="small">Phone (optional)</Label>
          <Input size="small" placeholder="077 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="recipient-phone" />
        </div>
        <div>
          <Label size="small">First name (optional)</Label>
          <Input size="small" placeholder="Used in the email" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <Label size="small">Personal message (optional)</Label>
          <Textarea rows={2} placeholder="Thanks for being one of our first customers!" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 md:col-span-3">
          <Checkbox id="recipient-notify" checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
          <Label htmlFor="recipient-notify" size="small">
            Email the code to the customer now
          </Label>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          {state?.sent_at ? `Last sent ${new Date(state.sent_at).toLocaleString()}` : reserved ? "Not sent yet" : ""}
        </Text>
        <div className="flex gap-2">
          {reserved && (
            <Button size="small" variant="secondary" onClick={() => save(true)} isLoading={saving}>
              Let anyone use it
            </Button>
          )}
          <Button size="small" onClick={() => save(false)} isLoading={saving} disabled={!email && !phone} data-testid="recipient-save">
            {notify && email ? "Save and send" : "Save"}
          </Button>
        </div>
      </div>
    </Container>
  )
}
