'use client';

import { FC, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { HttpTypes } from '@medusajs/types';
import { FieldError, FieldValues, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Button } from '@/components/atoms';
import { LabeledInput } from '@/components/cells';
import { AddressAutocomplete, keepsPoint } from '@/components/cells/AddressAutocomplete/AddressAutocomplete';
import CountrySelect from '@/components/cells/CountrySelect/CountrySelect';
import { addCustomerAddress, updateCustomerAddress } from '@/lib/data/customer';
import type { PlaceAddress } from '@/lib/data/delivery';

import { AddressFormData, addressSchema } from './schema';

interface Props {
  defaultValues?: AddressFormData;

  regions: HttpTypes.StoreRegion[];
  handleClose?: () => void;
}

export const emptyDefaultAddressValues = {
  addressName: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  countryCode: '',
  postalCode: '',
  company: '',
  province: '',
  phone: '',
  metadata: {}
};

export const AddressForm: FC<Props> = ({ defaultValues, ...props }) => {
  const methods = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: defaultValues || emptyDefaultAddressValues
  });

  return (
    <FormProvider {...methods}>
      <Form {...props} />
    </FormProvider>
  );
};

const Form: FC<Props> = ({ regions, handleClose }) => {
  const [error, setError] = useState<string>();
  const {
    handleSubmit,
    register,
    formState: { errors },
    watch,
    setValue,
    getValues
  } = useFormContext();

  const metadata = (watch('metadata') ?? {}) as Record<string, unknown>;
  const hasPoint = metadata.lat != null && metadata.lat !== '';

  // Text of the place the point belongs to (see keepsPoint). For a saved
  // address we compare with what was saved.
  const picked = useRef<string | null>(hasPoint ? (getValues('address') ?? '') : null);

  const typeAddress = (value: string) => {
    setValue('address', value, { shouldValidate: !!errors.address });
    if (hasPoint && !keepsPoint(value, picked.current)) {
      const { lat: _lat, lng: _lng, place_id: _p, ...rest } = metadata;
      setValue('metadata', rest);
    }
  };

  const pickPlace = (p: PlaceAddress, source: 'place' | 'gps') => {
    const set = (field: string, v?: string) => v && setValue(field, v, { shouldValidate: true });
    // "Use my location" is where they are: keep that point while they type.
    picked.current = source === 'gps' ? null : p.address_1 || p.formatted;
    set('address', p.address_1 || p.formatted);
    set('city', p.city);
    set('province', p.province);
    set('postalCode', p.postal_code);
    if (!getValues('countryCode')) setValue('countryCode', 'zw');
    setValue('metadata', {
      ...metadata,
      ...(p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : {}),
      ...(p.place_id ? { place_id: p.place_id } : {})
    });
  };

  const region = {
    countries: regions.flatMap(region => region.countries)
  };

  const submit = async (data: FieldValues) => {
    const formData = new FormData();
    formData.append('addressId', data.addressId || '');
    formData.append('address_name', data.addressName);
    formData.append('first_name', data.firstName);
    formData.append('last_name', data.lastName);
    formData.append('address_1', data.address);
    formData.append('address_2', '');
    formData.append('province', data.province);
    formData.append('city', data.city);
    formData.append('country_code', data.countryCode);
    formData.append('postal_code', data.postalCode);
    formData.append('company', data.company);
    formData.append('phone', data.phone);
    formData.append('metadata', JSON.stringify(data.metadata ?? {}));

    const res = data.addressId
      ? await updateCustomerAddress(formData)
      : await addCustomerAddress(formData);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setError('');
    handleClose && handleClose();
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      data-testid="address-form"
    >
      <div className="space-y-4 px-4">
        <div className="items-top mb-4 grid max-w-full grid-cols-2 gap-4">
          <LabeledInput
            label="Address name"
            placeholder="Type address name"
            className="col-span-2"
            error={errors.firstName as FieldError}
            data-testid="address-form-address-name-input"
            {...register('addressName')}
          />
          <LabeledInput
            label="First name"
            placeholder="Type first name"
            error={errors.firstName as FieldError}
            data-testid="address-form-first-name-input"
            {...register('firstName')}
          />
          <LabeledInput
            label="Last name"
            placeholder="Type last name"
            error={errors.firstName as FieldError}
            data-testid="address-form-last-name-input"
            {...register('lastName')}
          />
          <LabeledInput
            label="Company (optional)"
            placeholder="Type company"
            error={errors.company as FieldError}
            data-testid="address-form-company-input"
            {...register('company')}
          />
          <div className="col-span-2 label-sm">
            <AddressAutocomplete
              label="Address"
              name="address"
              placeholder="Start typing your street, or a nearby place"
              value={watch('address') ?? ''}
              onType={typeAddress}
              onPick={pickPlace}
              hasPoint={hasPoint}
              error={(errors.address as FieldError | undefined)?.message}
              data-testid="address-form-address-input"
            />
          </div>
          <LabeledInput
            label="City"
            placeholder="Type city"
            error={errors.city as FieldError}
            data-testid="address-form-city-input"
            {...register('city')}
          />
          <LabeledInput
            label="Postal code (optional)"
            placeholder="Leave blank if none"
            error={errors.postalCode as FieldError}
            data-testid="address-form-postal-code-input"
            {...register('postalCode')}
          />
          <LabeledInput
            label="State / Province"
            placeholder="Type state / province"
            error={errors.province as FieldError}
            data-testid="address-form-province-input"
            {...register('province')}
          />
          <div>
            <CountrySelect
              region={region as HttpTypes.StoreRegion}
              {...register('countryCode')}
              value={watch('countryCode')}
              className="h-12"
              data-testid="address-form-country-select"
            />
            {errors.countryCode && (
              <p
                className="label-sm text-negative"
                data-testid="address-form-country-error"
              >
                {(errors.countryCode as FieldError).message}
              </p>
            )}
          </div>

          <LabeledInput
            label="Phone"
            placeholder="Type phone number"
            error={errors.phone as FieldError}
            data-testid="address-form-phone-input"
            {...register('phone')}
          />
        </div>
        {error && (
          <p
            className="label-md text-negative"
            data-testid="address-form-error"
          >
            {error}
          </p>
        )}
        <Button
          className="w-full"
          data-testid="address-form-submit-button"
        >
          Save address
        </Button>
      </div>
    </form>
  );
};
