export interface TaxConfig {
  defaultSalaryDate: string; // Format: DD (e.g., "01", "15")
  defaultCurrency: string;
  salaryEntries: SalaryEntry[];
}

export interface SalaryEntry {
  id: string;
  taxableMonth: string; // Format: YYYY-MM (e.g., "2024-04") - the month for tax purposes
  salaryDate: string; // Format: YYYY-MM-DD (e.g., "2024-04-01") - actual salary date
  salaryAmount: number;
  currency: string;
  exchangeRate?: number;
  salaryInLKR?: number;
}

export interface FinancialYear {
  startYear: number;
  endYear: number;
  label: string; // e.g., "2024/25"
}

export interface TaxBracket {
  minIncome: number;
  maxIncome: number | null; // null for the highest bracket
  rate: number; // percentage
  description: string;
}
