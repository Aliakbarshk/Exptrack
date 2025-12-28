
export enum ExpenseCategory {
  POP = 'POP & Ceiling',
  PAINTING = 'Painting & Color',
  ELECTRICAL = 'Electrical',
  PLUMBING = 'Plumbing',
  FLOORING = 'Flooring',
  LABOR = 'Labor (Hazri)',
  MATERIAL = 'Raw Material (Saria/Cement)',
  WOODWORK = 'Woodwork/Carpentry',
  OTHER = 'Other Site Work'
}

export enum PaymentType {
  ADVANCE = 'Advance',
  FINAL = 'Final Payment',
  PARTIAL = 'Partial Payment',
  MATERIAL_DIRECT = 'Material Purchase'
}

export type AppTheme = 'classic' | 'construction' | 'midnight';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  payee: string;
  type: PaymentType;
  notes: string;
  isDeleted?: boolean;
}

export interface ContractInfo {
  totalValue: number;
  projectName: string;
  startDate: string;
}

export interface SpendingSummary {
  totalSpent: number;
  byCategory: Record<string, number>;
  byPayee: Record<string, number>;
}
