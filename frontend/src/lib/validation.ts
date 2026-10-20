import { z } from 'zod'

/** Same rules as the API, so most mistakes are caught before a request. */
export const nameField = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(50, 'At most 50 characters')

export const emailField = z
  .email('Enter a valid email address')
  .max(254, 'At most 254 characters')

export const passwordField = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a digit')

/** Optional on edit: empty means "keep the current password". */
export const optionalPasswordField = z.union([z.literal(''), passwordField])

export const pastDateField = z.iso
  .date('Pick a date')
  .refine((value) => value < new Date().toLocaleDateString('sv-SE'), {
    message: 'Must be in the past',
  })

export const notFutureDateField = z.iso
  .date('Pick a date')
  .refine((value) => value <= new Date().toLocaleDateString('sv-SE'), {
    message: 'Cannot be in the future',
  })
