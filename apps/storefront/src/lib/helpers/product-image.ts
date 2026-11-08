type Img = { url?: string | null } | null | undefined

/**
 * The picture to show for a product: its main image (thumbnail), or else its
 * first image. Products added without a main image still get a picture.
 */
export const productImage = (p?: { thumbnail?: string | null; images?: Img[] | null } | null) =>
  p?.thumbnail || p?.images?.find((i) => i?.url)?.url || null

/** A variant's own picture: its thumbnail, or else the first image linked to it. */
export const variantImage = (v?: { thumbnail?: string | null; images?: Img[] | null } | null) =>
  v?.thumbnail || v?.images?.find((i) => i?.url)?.url || null

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
