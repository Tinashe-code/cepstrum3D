#!/usr/bin/env bash
# Smoke test: guest checkout across two vendors through the Store API.
# Usage: PK=<publishable key> ./scripts/smoke-checkout.sh [http://localhost:9000]
set -euo pipefail
API="${1:-http://localhost:9000}"
H=(-H "x-publishable-api-key: ${PK:?set PK}" -H "Content-Type: application/json")
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }

REGION=$(curl -s "${H[@]}" "$API/store/regions" | j "d['regions'][0]['id']")
echo "region: $REGION"

# Pick one offer from each of two different sellers.
OFFERS=$(curl -s "${H[@]}" "$API/store/offers?limit=200&fields=id,seller_id,*seller" \
  | python3 -c "
import sys,json
seen={}
for o in json.load(sys.stdin)['offers']:
    seen.setdefault(o['seller']['name'], o['id'])
print(' '.join(list(seen.values())[:2]))
print('sellers:', list(seen)[:2], file=sys.stderr)
")
echo "offers: $OFFERS"

CART=$(curl -s "${H[@]}" -X POST "$API/store/carts" -d "{\"region_id\":\"$REGION\",\"email\":\"buyer@layerline.test\"}" | j "d['cart']['id']")
echo "cart: $CART"
for O in $OFFERS; do
  curl -s "${H[@]}" -X POST "$API/store/carts/$CART/line-items" -d "{\"offer_id\":\"$O\",\"quantity\":1}" | j "'items: '+str(len(d['cart']['items'])) if 'cart' in d else d"
done

ADDR='{"first_name":"Test","last_name":"Buyer","address_1":"1 Samora Machel Ave","city":"Harare","country_code":"zw","postal_code":"0000","phone":"0770000000"}'
curl -s "${H[@]}" -X POST "$API/store/carts/$CART" -d "{\"shipping_address\":$ADDR,\"billing_address\":$ADDR}" | j "'address ok' if 'cart' in d else d"

# One shipping method per seller (the endpoint groups options by seller).
curl -s "${H[@]}" "$API/store/shipping-options?cart_id=$CART" > /tmp/so.json
python3 - <<'EOF' > /tmp/so_ids
import json
d=json.load(open('/tmp/so.json'))['shipping_options']
groups=[d] if isinstance(d,list) else list(d.values())
for g in groups:
    opts=sorted(g, key=lambda o: o.get('amount') or 0)
    if opts: print(opts[0]['id'])
EOF
for S in $(cat /tmp/so_ids); do
  curl -s "${H[@]}" -X POST "$API/store/carts/$CART/shipping-methods" -d "{\"option_id\":\"$S\"}" | j "'shipping: '+str(len(d['cart']['shipping_methods'])) if 'cart' in d else d"
done

PC=$(curl -s "${H[@]}" -X POST "$API/store/payment-collections" -d "{\"cart_id\":\"$CART\"}" | j "d['payment_collection']['id']")
curl -s "${H[@]}" -X POST "$API/store/payment-collections/$PC/payment-sessions" -d '{"provider_id":"pp_system_default"}' | j "'payment session ok' if 'payment_collection' in d else d"

curl -s "${H[@]}" -X POST "$API/store/carts/$CART/complete" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('complete ->', d.get('type'), json.dumps({k:(v if not isinstance(v,dict) else {kk:vv for kk,vv in v.items() if kk in ('id','display_id','total')}) for k,v in d.items() if k!='cart'})[:400])
"
