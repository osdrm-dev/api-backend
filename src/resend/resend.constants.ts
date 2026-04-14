export const RESEND_TEMPLATES = {
  DA_CREATED: 'da-created',
  BC_UPLOADED: 'bc-uploaded',
  PV_UPLOADED: 'pv-uploaded',
  QR_UPLOADED: 'qr-uploaded',
  DAP_CREATED: 'dap-created',
  CONFIRMATION: 'confirmation',
  PURCHASE_COMMENT_ADDED: 'purchase-comment-added',
} as const;

export type ResendTemplate =
  (typeof RESEND_TEMPLATES)[keyof typeof RESEND_TEMPLATES];
