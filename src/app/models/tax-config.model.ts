export interface TaxConfig {
  defaultSalaryDate: string; // Format: DD (e.g., "01", "15")
  defaultCurrency: string;
  salaryEntries: SalaryEntry[];
  taxBrackets: TaxBracket[];
}

export interface SalaryEntry {
  id: string;
  taxableMonth: Date; // The month for which this salary is taxed (e.g., January 2024)
  salaryDate: Date; // The actual date the salary was received
  salaryAmount: number; // Salary amount in the original currency
  currency: string;
  exchangeRate: number | null; // Exchange rate for the salary date
  salaryInLKR: number | null; // Converted salary amount in LKR
  financialYear: string; // Which financial year this belongs to (e.g., "2023-24")
  showTaxBreakdown?: boolean; // UI state for showing tax breakdown
}

export interface FinancialYear {
  startYear: number;
  endYear: number;
  label: string; // e.g., "2024/25"
}

export interface TaxBracket {
  id: string;
  minIncome: number;
  maxIncome: number | null; // null for the highest bracket (infinity)
  taxRate: number; // percentage as decimal (e.g., 0.06 for 6%)
  description: string;
}
