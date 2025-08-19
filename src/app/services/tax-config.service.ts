import { Injectable } from '@angular/core';
import { TaxConfig, SalaryEntry, FinancialYear } from '../models/tax-config.model';

@Injectable({
  providedIn: 'root'
})
export class TaxConfigService {
  private readonly STORAGE_KEY = 'tax-calculator-config';

  constructor() {}

  /**
   * Save tax configuration to localStorage
   */
  saveTaxConfig(config: TaxConfig): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
  }

  /**
   * Load tax configuration from localStorage
   */
  loadTaxConfig(): TaxConfig | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing stored tax config:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Get default tax configuration
   */
  getDefaultTaxConfig(): TaxConfig {
    return {
      defaultSalaryDate: '01',
      defaultCurrency: 'USD',
      salaryEntries: []
    };
  }

  /**
   * Generate a unique ID for salary entries
   */
  generateSalaryEntryId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get the taxing month for a given salary date
   * Salary received in a month is taxed in the same month
   */
  getTaxingMonth(salaryDate: string): string {
    const date = new Date(salaryDate);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  /**
   * Get financial year for a given month string (YYYY-MM format)
   * Financial year starts from April and ends in March of next year
   */
  getFinancialYear(monthString: string): FinancialYear {
    const [year, month] = monthString.split('-').map(Number);
    
    if (month >= 4) {
      // April to December - same year to next year
      return {
        startYear: year,
        endYear: year + 1,
        label: `${year}/${(year + 1).toString().substr(-2)}`
      };
    } else {
      // January to March - previous year to current year
      return {
        startYear: year - 1,
        endYear: year,
        label: `${year - 1}/${year.toString().substr(-2)}`
      };
    }
  }

  /**
   * Get list of available months for taxable month selection (last 24 months)
   */
  getAvailableMonths(): { value: string; label: string }[] {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      months.push({ value, label });
    }
    
    return months;
  }

  /**
   * Generate default salary date for a given month and default day
   */
  getDefaultSalaryDateForMonth(monthString: string, defaultDay: string): string {
    const [year, month] = monthString.split('-').map(Number);
    const dayNum = parseInt(defaultDay);
    
    // Get the last day of the month to ensure we don't exceed it
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const actualDay = Math.min(dayNum, lastDayOfMonth);
    
    const date = new Date(year, month - 1, actualDay);
    return this.formatDateForInput(date);
  }

  /**
   * Format date for HTML date input (YYYY-MM-DD)
   */
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calculate total salary in LKR for a financial year
   */
  calculateFinancialYearSalary(salaryEntries: SalaryEntry[], financialYear: FinancialYear): number {
    return salaryEntries
      .filter(entry => {
        const entryFinancialYear = this.getFinancialYear(entry.taxableMonth);
        return entryFinancialYear.startYear === financialYear.startYear;
      })
      .reduce((total, entry) => total + (entry.salaryInLKR || 0), 0);
  }
}
