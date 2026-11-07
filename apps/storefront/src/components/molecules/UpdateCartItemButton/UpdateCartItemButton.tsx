'use client';

import { useEffect, useRef, useState } from 'react';

import { useCartContext } from '@/components/providers';
import { siteConfig } from '@/config/site';
import { toast } from '@/lib/helpers/toast';
import { cn } from '@/lib/utils';

/** Whole units only: "2.5" → "2", "3,7" → "3", letters dropped. */
export const toWholeNumberText = (raw: string) => raw.split(/[.,]/)[0].replace(/\D/g, '');

/** While typing allow digits and one decimal mark, so "2.5" reads naturally before it is cut to 2. */
const typingText = (raw: string) => {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const mark = cleaned.search(/[.,]/);
  return mark === -1 ? cleaned : cleaned.slice(0, mark + 1) + cleaned.slice(mark + 1).replace(/[.,]/g, '');
};

/**
 * Cart quantity: − / + buttons with a box you can also type in. Whole units only.
 * - Decimals are cut off when saved (2.5 → 2).
 * - Typed quantities are saved on Enter or when you leave the box; −/+ clicks
 *   are saved half a second after the last click.
 * - Asking for more than the vendor has sets it to what's available and says
 *   "Only N items can be ordered."
 * - When stock is low (below siteConfig.lowStockThreshold) it says "Only N left".
 */
export const UpdateCartItemButton = ({
  quantity,
  lineItemId,
  stock
}: {
  quantity: number;
  lineItemId: string;
  /** Units the vendor has; undefined while unknown. */
  stock?: number;
}) => {
  const { updateCartItem } = useCartContext();
  const [text, setText] = useState(String(quantity));
  const [saving, setSaving] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (stepTimer.current) clearTimeout(stepTimer.current);
  }, []);

  useEffect(() => {
    if (!saving) setText(String(quantity));
  }, [quantity, saving]);

  const save = async (raw: string = text) => {
    let wanted = parseInt(toWholeNumberText(raw), 10);
    if (!Number.isFinite(wanted) || wanted < 1) wanted = 1;

    let capped = false;
    if (stock !== undefined && stock > 0 && wanted > stock) {
      wanted = stock;
      capped = true;
    }
    setLimitHit(capped);
    setText(String(wanted));

    if (wanted === quantity || !lineItemId) return;

    setSaving(true);
    try {
      await updateCartItem(lineItemId, wanted);
    } catch (error: unknown) {
      setText(String(quantity));
      const message =
        error instanceof Error && /inventory|stock/i.test(error.message)
          ? 'There is not enough stock for that quantity.'
          : 'Please try again.';
      toast.error({ title: "Couldn't update quantity", description: message });
    } finally {
      setSaving(false);
    }
  };

  const current = parseInt(toWholeNumberText(text), 10) || 1;
  const atMax = stock !== undefined && stock > 0 && current >= stock;

  const step = (delta: number) => {
    let next = current + delta;
    if (next < 1) return;
    if (stock !== undefined && stock > 0 && next > stock) {
      next = stock;
      setLimitHit(true);
    } else {
      setLimitHit(false);
    }
    const nextText = String(next);
    setText(nextText);
    if (stepTimer.current) clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => save(nextText), 500);
  };

  const stepBtn =
    'flex h-10 w-10 items-center justify-center rounded-sm bg-secondary text-[20px] font-medium text-primary transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40';

  const lowStock =
    stock !== undefined && stock > 0 && stock < siteConfig.lowStockThreshold;

  return (
    <div className="mt-2" data-testid="cart-item-quantity-control">
      <div className="flex items-center gap-2">
        <span className="text-secondary">Qty</span>
        <button
          type="button"
          className={stepBtn}
          onClick={() => step(-1)}
          disabled={!lineItemId || current <= 1}
          aria-label="Decrease quantity"
          data-testid="cart-item-decrease"
        >
          −
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Quantity"
          value={text}
          disabled={!lineItemId}
          onChange={e => {
            setText(typingText(e.target.value));
            setLimitHit(false);
          }}
          onBlur={() => save()}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              inputRef.current?.blur();
            }
          }}
          className={cn(
            'h-10 w-16 rounded-sm border bg-primary px-2 text-center text-[16px] font-medium text-primary outline-none focus:border-accent',
            limitHit && 'border-sale',
            saving && 'opacity-60'
          )}
          data-testid="cart-item-quantity"
        />
        <button
          type="button"
          className={stepBtn}
          onClick={() => (atMax ? setLimitHit(true) : step(1))}
          disabled={!lineItemId}
          aria-label="Increase quantity"
          data-testid="cart-item-increase"
        >
          +
        </button>
        {saving && (
          <span className="text-xs text-secondary" data-testid="cart-item-quantity-saving">
            Saving…
          </span>
        )}
      </div>

      {limitHit && stock !== undefined && (
        <p className="mt-1 text-[14px] font-bold text-sale" role="alert" data-testid="cart-item-stock-limit">
          Only {stock} {stock === 1 ? 'item' : 'items'} can be ordered.
        </p>
      )}
      {!limitHit && lowStock && (
        <p className="mt-1 text-[13px] font-medium text-accent" data-testid="cart-item-low-stock">
          Only {stock} left in stock
        </p>
      )}
    </div>
  );
};
