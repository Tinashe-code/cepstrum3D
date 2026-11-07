import { z } from "zod"

export const addressSchema = z.object({
  addressId: z.string().optional(),
  addressName: z.string().nonempty("Address name is required"),
  firstName: z.string().nonempty("First name is required"),
  lastName: z.string().nonempty("Last name is required"),
  address: z.string().nonempty("Address is required"),
  city: z.string().nonempty("City is required"),
  countryCode: z.string().nonempty("Country is required"),
  // Optional: Zimbabwe does not use postal codes.
  postalCode: z.string().optional().default(""),
  company: z.string().optional(),
  province: z.string().optional(),
  phone: z
    .string()
    .nonempty("Phone number is required")
    .regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number format"),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type AddressFormData = z.infer<typeof addressSchema>
