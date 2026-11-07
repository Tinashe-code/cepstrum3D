'use client';

import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/atoms';
import {
  getPlace,
  locatePlace,
  searchPlaces,
  type PlaceAddress,
  type PlaceSuggestion
} from '@/lib/data/delivery';
import { cn } from '@/lib/utils';

const newSession = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Should the saved map point stay after the customer edits the address text?
 * Yes while the text still contains the place they picked (so "Avondale Shops"
 * → "Avondale Shops, house 4 behind" keeps it), or when the point came from
 * their own location. No once they type a different address or clear it.
 */
export const keepsPoint = (value: string, picked: string | null) => {
  if (!value.trim()) return false;
  if (picked === null) return true; // GPS point, or nothing picked to compare with
  const anchor = picked.split(',')[0].trim().toLowerCase();
  return !anchor || value.toLowerCase().includes(anchor);
};

/**
 * Address field with Google suggestions (Zimbabwe). Picking one fills the
 * address, city and province and records its map coordinates, which the
 * delivery price uses.
 *
 * Many Zimbabwe addresses aren't on Google, so the customer can:
 *  - pick the closest place Google does know (a shop, school, church, landmark)
 *    and then add their own details to the text, or
 *  - press "Use my location": we keep their phone's GPS point (so delivery is
 *    priced to where they really are) and fill in the nearest street address.
 * Without a Google key on the backend it is a plain field.
 */
export const AddressAutocomplete = ({
  name,
  label,
  value,
  onType,
  onPick,
  required,
  placeholder,
  error,
  hasPoint,
  'data-testid': testId
}: {
  name: string;
  label: string;
  value: string;
  onType: (value: string) => void;
  /** source 'gps' = the customer's own location (keep the point while they add details). */
  onPick: (address: PlaceAddress, source: 'place' | 'gps') => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  /** True when the current address already has a map point (shows "Location saved"). */
  hasPoint?: boolean;
  'data-testid'?: string;
}) => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string>();
  const session = useRef(newSession());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    if ((value ?? '').trim().length < 3) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await searchPlaces(value, session.current);
      setEnabled(r.enabled);
      setSuggestions(r.suggestions);
      setSearched(r.enabled);
      setOpen(r.enabled);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, enabled]);

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    const address = await getPlace(s.place_id, session.current);
    session.current = newSession();
    if (address) {
      skipNext.current = true;
      onPick(address, 'place');
    }
  };

  const useMyLocation = () => {
    setLocateError(undefined);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError("Your browser can't share your location. Type the closest place instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const address = await locatePlace(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        setOpen(false);
        if (!address) {
          setLocateError("We couldn't look up your location. Type the closest place instead.");
          return;
        }
        skipNext.current = true;
        onPick(address, 'gps');
      },
      err => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location is blocked for this site. Allow it in your browser, or type the closest place.'
            : "We couldn't get your location. Type the closest place instead."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div
      className="relative"
      ref={boxRef}
    >
      <Input
        label={label}
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        error={!!error}
        onChange={e => onType(e.target.value)}
        onFocus={() => searched && setOpen(true)}
        required={required}
        data-testid={testId}
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="label-sm text-action underline disabled:opacity-60"
          data-testid="address-use-my-location"
        >
          {locating ? 'Finding you…' : '📍 Use my location'}
        </button>
        {hasPoint && <span className="label-sm text-green-700">Location saved for delivery</span>}
      </div>
      {error && <p className="label-sm text-negative">{error}</p>}
      {locateError && <p className="label-sm text-negative">{locateError}</p>}
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-sm border bg-primary shadow-lg"
          data-testid="address-suggestions"
        >
          {suggestions.map(s => (
            <li key={s.place_id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(s)}
                className={cn('w-full px-3 py-2 text-left hover:bg-accent-soft')}
              >
                <span className="block text-sm text-primary">{s.main}</span>
                {s.secondary && <span className="block text-xs text-secondary">{s.secondary}</span>}
              </button>
            </li>
          ))}
          <li
            className="border-t px-3 py-2 text-xs text-secondary"
            data-testid="address-nearest-hint"
          >
            {suggestions.length
              ? "Can't see your address? Pick the closest place (a shop, school, church or landmark), then add your house number or directions to the address."
              : 'No matches. Try the name of a nearby shop, school or landmark, or use your location.'}
          </li>
          <li className="px-3 pb-1 text-right text-[10px] text-secondary">Powered by Google</li>
        </ul>
      )}
    </div>
  );
};
