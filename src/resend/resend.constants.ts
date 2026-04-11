export const RESEND_TEMPLATES = {
  DA_CREATED: 'da-created',
  BC_UPLOADED: 'bc-uploaded',
  PV_UPLOADED: 'pv-uploaded',
  QR_UPLOADED: 'qr-uploaded',
  DPA_CREATED: 'dpa-created',
  CONFIRMATION: 'confirmation',
} as const;

export type ResendTemplate =
  (typeof RESEND_TEMPLATES)[keyof typeof RESEND_TEMPLATES];
