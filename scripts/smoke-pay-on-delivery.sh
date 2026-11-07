#!/usr/bin/env bash
# Pay-on-delivery rule tests through the Store API.
#   A) cart with only eligible items   → POD allowed, order placed
#   B) cart with one ineligible item   → POD rejected
#   C) POD chosen, then an ineligible item added → order completion rejected
# Usage: PK=<publishable key> ./scripts/smoke-pay-on-delivery.sh [http://localhost:9000]
set -uo pipefail
API="${1:-http://localhost:9000}"
H=(-H "x-publishable-api-key: ${PK:?set PK}" -H "Content-Type: application/json")
POD="pp_pay-on-delivery_pay-on-delivery"
PASS=0; FAIL=0
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }

REGION=$(curl -s "${H[@]}" "$API/store/regions" | jget "d['regions'][0]['id']")

# An offer for an eligible product (filament) and one for an ineligible product (printer).
offer_for() {
  local handle=$1
  local pid; pid=$(curl -s "${H[@]}" "$API/store/products?handle=$handle&fields=id" | jget "d['products'][0]['id']")
  curl -s "${H[@]}" "$API/store/offers?limit=500&fields=id,product_id" \
    | python3 -c "import sys,json; print(next(o['id'] for o in json.load(sys.stdin)['offers'] if o.get('product_id')=='$pid'))"
}
ELIGIBLE=$(offer_for kingroon-pla-basic)
INELIGIBLE=$(offer_for bambu-lab-a1-mini)
echo "eligible offer: $ELIGIBLE   ineligible offer: $INELIGIBLE"

ADDR='{"first_name":"Test","last_name":"Buyer","address_1":"1 Samora Machel Ave","city":"Harare","country_code":"zw","postal_code":"0000","phone":"0770000000"}'
new_cart() {
  local c; c=$(curl -s "${H[@]}" -X POST "$API/store/carts" -d "{\"region_id\":\"$REGION\",\"email\":\"buyer@layerline.test\"}" | jget "d['cart']['id']")
  for o in "$@"; do curl -s -o /dev/null "${H[@]}" -X POST "$API/store/carts/$c/line-items" -d "{\"offer_id\":\"$o\",\"quantity\":1}"; done
  curl -s -o /dev/null "${H[@]}" -X POST "$API/store/carts/$c" -d "{\"shipping_address\":$ADDR,\"billing_address\":$ADDR}"
  curl -s "${H[@]}" "$API/store/shipping-options?cart_id=$c" | python3 -c "
import sys,json
d=json.load(sys.stdin)['shipping_options']; groups=[d] if isinstance(d,list) else list(d.values())
print(' '.join(sorted(g,key=lambda o:o.get('amount') or 0)[0]['id'] for g in groups if g))" \
  | tr ' ' '\n' | while read -r s; do [ -n "$s" ] && curl -s -o /dev/null "${H[@]}" -X POST "$API/store/carts/$c/shipping-methods" -d "{\"option_id\":\"$s\"}"; done
  echo "$c"
}
pod_session() { # prints HTTP status
  local pc; pc=$(curl -s "${H[@]}" -X POST "$API/store/payment-collections" -d "{\"cart_id\":\"$1\"}" | jget "d['payment_collection']['id']")
  curl -s -o /tmp/pod_session.json -w "%{http_code}" "${H[@]}" -X POST "$API/store/payment-collections/$pc/payment-sessions" -d "{\"provider_id\":\"$POD\"}"
}

echo "A) eligible-only cart"
A=$(new_cart "$ELIGIBLE")
[ "$(curl -s "${H[@]}" "$API/store/carts/$A/pay-on-delivery" | jget "d['pay_on_delivery']['eligible']")" = "True" ] && ok "eligibility endpoint says eligible" || bad "eligibility endpoint"
[ "$(pod_session "$A")" = "200" ] && ok "POD payment session created" || bad "POD session: $(cat /tmp/pod_session.json)"
RES=$(curl -s "${H[@]}" -X POST "$API/store/carts/$A/complete")
[ "$(echo "$RES" | jget "d.get('type')")" = "order_group" ] && ok "order placed without online payment" || bad "complete: $RES"

echo "B) cart with an ineligible item"
B=$(new_cart "$ELIGIBLE" "$INELIGIBLE")
MSG=$(curl -s "${H[@]}" "$API/store/carts/$B/pay-on-delivery" | jget "d['pay_on_delivery']['message']")
[ "$(curl -s "${H[@]}" "$API/store/carts/$B/pay-on-delivery" | jget "d['pay_on_delivery']['eligible']")" = "False" ] && ok "eligibility endpoint says not eligible — $MSG" || bad "eligibility endpoint"
CODE=$(pod_session "$B")
[ "$CODE" != "200" ] && ok "POD payment session rejected ($CODE)" || bad "POD session was allowed"

echo "C) POD chosen, then ineligible item added"
C=$(new_cart "$ELIGIBLE")
[ "$(pod_session "$C")" = "200" ] && ok "POD chosen while eligible" || bad "POD session: $(cat /tmp/pod_session.json)"
curl -s -o /dev/null "${H[@]}" -X POST "$API/store/carts/$C/line-items" -d "{\"offer_id\":\"$INELIGIBLE\",\"quantity\":1}"
CODE=$(curl -s -o /tmp/pod_complete.json -w "%{http_code}" "${H[@]}" -X POST "$API/store/carts/$C/complete")
[ "$CODE" != "200" ] && ok "order completion blocked ($CODE)" || bad "order completed: $(cat /tmp/pod_complete.json)"

echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
