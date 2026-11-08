type Img = { url?: string | null } | null | undefined

/**
 * The picture to show for a product: its main image (thumbnail), or else its
 * first image. Products added without a main image still get a picture.
 */
export const productImage = (p?: { thumbnail?: string | null; images?: Img[] | null } | null) =>
  p?.thumbnail || p?.images?.find((i) => i?.url)?.url || null

type VImg = { id?: string | null; url?: string | null } | null | undefined
type V = { thumbnail?: string | null; images?: VImg[] | null } | null | undefined

/**
 * A variant's own picture.
 *
 * Medusa gives every variant the product's shared photos first, then the photos
 * assigned to that variant, so "the variant's first image" is the same shared
 * photo for every colour. Instead, use the first image this variant has that
 * NOT every variant has, i.e. the one assigned to it. Then its thumbnail, if
 * that isn't just the product's main picture.
 */
export const variantImage = (
  v: V,
  product?: { thumbnail?: string | null; variants?: V[] | null } | null
) => {
  const key = (i: VImg) => i?.id || i?.url || ""
  const others = (product?.variants ?? []).filter(Boolean)
  const own =
    others.length > 1
      ? v?.images?.find(
          (i) => i?.url && !others.every((o) => (o?.images ?? []).some((j) => key(j) === key(i)))
        )?.url
      : undefined
  const thumb = v?.thumbnail && v.thumbnail !== product?.thumbnail ? v.thumbnail : undefined
  return own || thumb || null
}

/**
 * For a colour without its own picture: a product image whose file name
 * mentions the colour ("…-purple.jpg" for Purple), if there is one.
 */
export const imageNamedFor = (
  images: Img[] | null | undefined,
  colour?: string | null
) => {
  const c = (colour ?? "").trim().toLowerCase()
  if (!c) return null
  const words = c.split(/[\s/-]+/).filter((w) => w.length > 2)
  const file = (u: string) => decodeURIComponent(u.split("?")[0].split("/").pop() ?? "").toLowerCase()
  const hit = (images ?? []).find((i) => {
    if (!i?.url) return false
    const f = file(i.url)
    return f.includes(c.replace(/\s+/g, "-")) || f.includes(c.replace(/\s+/g, "_")) || (words.length > 0 && words.every((w) => f.includes(w)))
  })
  return hit?.url ?? null
}
