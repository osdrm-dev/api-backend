import {
  OSDRM_PROCESS_EVENT,
  OsdrmProcessEvent,
} from 'src/notification/constants/notification.constants';

export const AUDIT_LOG_QUEUE = 'audit-log';
export const AUDIT_LOG_JOB = 'write-audit-log';

// Ordered from most specific to most general — first match wins.
const AUDIT_PATH_TYPE_MAP: Array<{
  method: string;
  pattern: RegExp;
  type: OsdrmProcessEvent;
}> = [
  // Auth
  {
    method: 'POST',
    pattern: /^\/auth\/login$/,
    type: OSDRM_PROCESS_EVENT.USER_LOGIN,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/logout-all$/,
    type: OSDRM_PROCESS_EVENT.USER_LOGOUT_ALL,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/logout$/,
    type: OSDRM_PROCESS_EVENT.USER_LOGOUT,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/register$/,
    type: OSDRM_PROCESS_EVENT.USER_REGISTERED,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/change-password$/,
    type: OSDRM_PROCESS_EVENT.PASSWORD_CHANGED,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/reset-password$/,
    type: OSDRM_PROCESS_EVENT.FORGOT_PASSWORD,
  },
  {
    method: 'PATCH',
    pattern: /^\/auth\/profile$/,
    type: OSDRM_PROCESS_EVENT.PROFILE_UPDATED,
  },
  {
    method: 'PATCH',
    pattern: /^\/auth\/user\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.USER_UPDATED,
  },

  // Quotations — specific paths before generic /:purchaseId/quotations
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/quotations\/submit$/,
    type: OSDRM_PROCESS_EVENT.QR_SUBMITTED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/quotations\/validate$/,
    type: OSDRM_PROCESS_EVENT.QR_VALIDATED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/quotations\/bulk$/,
    type: OSDRM_PROCESS_EVENT.QR_BULK_CREATED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/quotations\/derogation$/,
    type: OSDRM_PROCESS_EVENT.QR_DEROGATION,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/quotations$/,
    type: OSDRM_PROCESS_EVENT.QR_CREATED,
  },
  {
    method: 'DELETE',
    pattern: /^\/purchases\/[^/]+\/quotations\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.QR_DELETED,
  },

  // BC
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/bc\/upload$/,
    type: OSDRM_PROCESS_EVENT.BC_UPLOADED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/attachments\/bc$/,
    type: OSDRM_PROCESS_EVENT.BC_ATTACHED,
  },
  {
    method: 'DELETE',
    pattern: /^\/purchases\/[^/]+\/attachments\/bc\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.BC_DELETED,
  },

  // PV — specific paths before generic /:purchaseId/pv
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/pv\/suppliers\/[^/]+\/select-items$/,
    type: OSDRM_PROCESS_EVENT.PV_ITEMS_SELECTED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/pv\/suppliers\/[^/]+\/items$/,
    type: OSDRM_PROCESS_EVENT.PV_ITEMS_UPDATED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/pv$/,
    type: OSDRM_PROCESS_EVENT.PV_UPLOADED,
  },
  {
    method: 'PATCH',
    pattern: /^\/purchases\/[^/]+\/pv$/,
    type: OSDRM_PROCESS_EVENT.PV_UPDATED,
  },

  // Document signing — before generic step upload/submit
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/[^/]+\/attachments\/[^/]+\/sign$/,
    type: OSDRM_PROCESS_EVENT.DOCUMENT_SIGNED,
  },

  // Generic step upload / submit
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/[^/]+\/upload$/,
    type: OSDRM_PROCESS_EVENT.STEP_DOCUMENT_UPLOADED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/[^/]+\/submit$/,
    type: OSDRM_PROCESS_EVENT.STEP_SUBMITTED,
  },

  // Purchases — specific actions before generic /:id
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/publish$/,
    type: OSDRM_PROCESS_EVENT.DA_PUBLISHED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/submit$/,
    type: OSDRM_PROCESS_EVENT.DA_SUBMITTED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/update-and-republish$/,
    type: OSDRM_PROCESS_EVENT.DA_REPUBLISHED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/items$/,
    type: OSDRM_PROCESS_EVENT.DA_ITEM_ADDED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases\/[^/]+\/attachments$/,
    type: OSDRM_PROCESS_EVENT.ATTACHMENT_ADDED,
  },
  {
    method: 'DELETE',
    pattern: /^\/purchases\/[^/]+\/attachments\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.ATTACHMENT_DELETED,
  },
  {
    method: 'POST',
    pattern: /^\/purchases$/,
    type: OSDRM_PROCESS_EVENT.DA_CREATED,
  },
  {
    method: 'PUT',
    pattern: /^\/purchases\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.DA_UPDATED,
  },
  {
    method: 'DELETE',
    pattern: /^\/purchases\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.DA_DELETED,
  },

  // Validation
  {
    method: 'POST',
    pattern: /^\/validation\/[^/]+\/validate$/,
    type: OSDRM_PROCESS_EVENT.DA_VALIDATED,
  },
  {
    method: 'POST',
    pattern: /^\/validation\/[^/]+\/reject$/,
    type: OSDRM_PROCESS_EVENT.DA_REJECTED,
  },
  {
    method: 'POST',
    pattern: /^\/validation\/[^/]+\/request-changes$/,
    type: OSDRM_PROCESS_EVENT.DA_CHANGE_REQUESTED,
  },
  {
    method: 'POST',
    pattern: /^\/bc-validation\/[^/]+\/validate$/,
    type: OSDRM_PROCESS_EVENT.BC_VALIDATED,
  },

  // Derogation
  {
    method: 'POST',
    pattern: /^\/derogations\/[^/]+\/validate$/,
    type: OSDRM_PROCESS_EVENT.DEROGATION_VALIDATED,
  },

  // Satisfaction
  {
    method: 'POST',
    pattern: /^\/satisfaction\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.SATISFACTION_SUBMITTED,
  },

  // Suppliers
  {
    method: 'PUT',
    pattern: /^\/suppliers\/[^/]+\/active$/,
    type: OSDRM_PROCESS_EVENT.SUPPLIER_STATUS_UPDATED,
  },
  {
    method: 'POST',
    pattern: /^\/suppliers$/,
    type: OSDRM_PROCESS_EVENT.SUPPLIER_CREATED,
  },
  {
    method: 'PUT',
    pattern: /^\/suppliers\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.SUPPLIER_UPDATED,
  },

  // Files
  {
    method: 'POST',
    pattern: /^\/files\/upload\/multiple$/,
    type: OSDRM_PROCESS_EVENT.FILE_UPLOADED,
  },
  {
    method: 'POST',
    pattern: /^\/files\/upload$/,
    type: OSDRM_PROCESS_EVENT.FILE_UPLOADED,
  },
  {
    method: 'DELETE',
    pattern: /^\/files\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.FILE_DELETED,
  },

  // Signatures
  {
    method: 'POST',
    pattern: /^\/signatures\/upload$/,
    type: OSDRM_PROCESS_EVENT.SIGNATURE_UPLOADED,
  },
  {
    method: 'PATCH',
    pattern: /^\/signatures\/[^/]+\/activate$/,
    type: OSDRM_PROCESS_EVENT.SIGNATURE_ACTIVATED,
  },
  {
    method: 'DELETE',
    pattern: /^\/signatures\/[^/]+$/,
    type: OSDRM_PROCESS_EVENT.SIGNATURE_DELETED,
  },

  // Budget
  {
    method: 'POST',
    pattern: /^\/budget-tables\/upload$/,
    type: OSDRM_PROCESS_EVENT.BUDGET_UPLOADED,
  },
  {
    method: 'POST',
    pattern: /^\/budget-tables\/[^/]+\/activate$/,
    type: OSDRM_PROCESS_EVENT.BUDGET_ACTIVATED,
  },
];

export function resolveAuditEventType(
  method: string,
  path: string,
): OsdrmProcessEvent | undefined {
  return AUDIT_PATH_TYPE_MAP.find(
    (entry) => entry.method === method && entry.pattern.test(path),
  )?.type;
}
