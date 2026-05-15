// ─────────────────────────────────────────────────────────────
// RBAC type definitions for the Nexis enterprise permission system
// ─────────────────────────────────────────────────────────────

export type RbacAction = 'create' | 'read' | 'update' | 'delete' | 'approve';

export const ALL_MODULES = [
  'dashboard', 'pos', 'inventory', 'invoices', 'customers',
  'suppliers', 'expenses', 'reports', 'staff', 'settings',
  'crm', 'sales', 'purchasing', 'projects', 'banking',
  'financials', 'hr', 'production',
] as const;

export type RbacModule = typeof ALL_MODULES[number];

export interface ModulePermission {
  can_create:  boolean;
  can_read:    boolean;
  can_update:  boolean;
  can_delete:  boolean;
  can_approve: boolean;
}

/** Loaded permissions for the current staff session */
export interface LoadedPermissions {
  roleId:  string | null;
  /** module → CRUD permissions */
  modules: Record<string, ModulePermission>;
  /** module → field → is_visible */
  fields:  Record<string, Record<string, boolean>>;
}

/** Full-access permissions (used for business owners + Administrator) */
export const OWNER_PERMISSIONS: LoadedPermissions = {
  roleId: null,
  modules: Object.fromEntries(
    ALL_MODULES.map((m) => [
      m,
      { can_create: true, can_read: true, can_update: true, can_delete: true, can_approve: true },
    ])
  ),
  fields: {},
};

/** Zero-access fallback (no permissions while loading) */
export const EMPTY_PERMISSIONS: LoadedPermissions = {
  roleId: null,
  modules: Object.fromEntries(
    ALL_MODULES.map((m) => [
      m,
      { can_create: false, can_read: false, can_update: false, can_delete: false, can_approve: false },
    ])
  ),
  fields: {},
};

/** Map a RbacAction to the column key in ModulePermission */
export function actionKey(action: RbacAction): keyof ModulePermission {
  return `can_${action}` as keyof ModulePermission;
}

/** Roles that can approve requests (Manager + Administrator) */
export const APPROVER_ROLES = ['Administrator', 'Manager', 'System Administrator'] as const;

export function isApproverRole(role: string): boolean {
  return APPROVER_ROLES.includes(role as any);
}

/** Action types for approval workflow */
export const APPROVAL_ACTIONS = {
  DISCOUNT_OVER_10: 'discount_over_10',
  VOID_SALE:        'void_sale',
  DELETE_INVOICE:   'delete_invoice',
  STOCK_ADJUST:     'stock_adjustment',
  EXPENSE_OVER_500: 'expense_over_500',
  REFUND:           'refund',
} as const;

export type ApprovalActionType = typeof APPROVAL_ACTIONS[keyof typeof APPROVAL_ACTIONS];

export const APPROVAL_ACTION_LABELS: Record<ApprovalActionType, string> = {
  discount_over_10:  'Discount > 10%',
  void_sale:         'Void Sale',
  delete_invoice:    'Delete Invoice',
  stock_adjustment:  'Stock Adjustment > 50 units',
  expense_over_500:  'Expense > GH₵ 500',
  refund:            'Refund',
};
