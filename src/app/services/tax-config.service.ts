import { Injectable } from '@angular/core';
import { TaxConfig, SalaryEntry, FinancialYear, TaxBracket } from '../models/tax-config.model';

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
        const config = JSON.parse(stored);
        // Ensure tax brackets are always present
        if (!config.taxBrackets || config.taxBrackets.length === 0) {
          config.taxBrackets = this.getDefaultTaxBrackets();
        }
        
        // Convert string dates back to Date objects
        if (config.salaryEntries) {
          config.salaryEntries = config.salaryEntries.map((entry: any) => ({
            ...entry,
            taxableMonth: new Date(entry.taxableMonth),
            salaryDate: new Date(entry.salaryDate)
          }));
        }
        
        return config;
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
      salaryEntries: [],
      taxBrackets: this.getDefaultTaxBrackets()
    };
  }

  /**
   * Get default tax brackets for Sri Lankan income tax
   */
  getDefaultTaxBrackets(): TaxBracket[] {
    return [
      {
        id: '1',
        minIncome: 0,
        maxIncome: 1800000,
        taxRate: 0.0,
        description: 'No tax up to LKR 1,800,000'
      },
      {
        id: '2',
        minIncome: 1800000,
        maxIncome: 2800000,
        taxRate: 0.06,
        description: '6% tax on income from LKR 1,800,001 to LKR 2,800,000'
      },
      {
        id: '3',
        minIncome: 2800000,
        maxIncome: null,
        taxRate: 0.15,
        description: '15% tax on income above LKR 2,800,000'
      }
    ];
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
   * Get current financial year
   */
  getCurrentFinancialYear(): FinancialYear {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    
    if (currentMonth >= 4) {
      // April to December - current year to next year
      return {
        startYear: currentYear,
        endYear: currentYear + 1,
        label: `${currentYear}/${(currentYear + 1).toString().substr(-2)}`
      };
    } else {
      // January to March - previous year to current year
      return {
        startYear: currentYear - 1,
        endYear: currentYear,
        label: `${currentYear - 1}/${currentYear.toString().substr(-2)}`
      };
    }
  }

  /**
   * Get available financial years (current and previous 2 years)
   */
  getAvailableFinancialYears(): FinancialYear[] {
    const current = this.getCurrentFinancialYear();
    const years = [];
    
    for (let i = 0; i < 3; i++) {
      const startYear = current.startYear - i;
      const endYear = current.endYear - i;
      years.push({
        startYear,
        endYear,
        label: `${startYear}/${endYear.toString().substr(-2)}`
      });
    }
    
    return years;
  }

  /**
   * Get available taxable months for a specific financial year that haven't been entered yet
   */
  getAvailableTaxableMonths(financialYear: FinancialYear, existingSalaryEntries: SalaryEntry[]): { value: string; label: string }[] {
    const months = [];
    const currentDate = new Date();
    
    // Get all months in the financial year (April to March)
    for (let month = 4; month <= 15; month++) {
      const actualMonth = month > 12 ? month - 12 : month;
      const actualYear = month > 12 ? financialYear.endYear : financialYear.startYear;
      
      const date = new Date(actualYear, actualMonth - 1, 1);
      
      // Only include months that are not in the future
      if (date <= currentDate) {
        const value = `${actualYear}-${actualMonth.toString().padStart(2, '0')}`;
        
        // Check if this month already has a salary entry
        const hasEntry = existingSalaryEntries.some(entry => {
          const entryMonth = this.formatDateToMonthString(entry.taxableMonth);
          return entryMonth === value;
        });
        
        if (!hasEntry) {
          const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
          months.push({ value, label });
        }
      }
    }
    
    return months.sort((a, b) => b.value.localeCompare(a.value)); // Most recent first
  }

  /**
   * Get list of available months for taxable month selection (last 24 months) - Legacy method
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
   * Get the date range (min and max) for a given month string (YYYY-MM format)
   */
  getMonthDateRange(monthString: string): { minDate: string; maxDate: string } {
    const [year, month] = monthString.split('-').map(Number);
    
    // First day of the month
    const minDate = new Date(year, month - 1, 1);
    
    // Last day of the month
    const maxDate = new Date(year, month, 0);
    
    // Don't allow future dates
    const today = new Date();
    const actualMaxDate = maxDate > today ? today : maxDate;
    
    return {
      minDate: this.formatDateForInput(minDate),
      maxDate: this.formatDateForInput(actualMaxDate)
    };
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
        const monthString = this.formatDateToMonthString(entry.taxableMonth);
        const entryFinancialYear = this.getFinancialYear(monthString);
        return entryFinancialYear.startYear === financialYear.startYear;
      })
      .reduce((total, entry) => total + (entry.salaryInLKR || 0), 0);
  }

  formatDateToMonthString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Calculate monthly tax for a given monthly salary using progressive tax brackets
   */
  calculateMonthlyTax(monthlySalaryLKR: number, taxBrackets: TaxBracket[]): number {
    // Convert monthly to annual for tax calculation
    const annualSalaryLKR = monthlySalaryLKR * 12;
    const annualTax = this.calculateAnnualTax(annualSalaryLKR, taxBrackets);
    // Return monthly tax
    return annualTax / 12;
  }

  /**
   * Calculate annual tax using progressive tax brackets
   */
  calculateAnnualTax(annualSalaryLKR: number, taxBrackets: TaxBracket[]): number {
    let totalTax = 0;
    let remainingIncome = annualSalaryLKR;

    // Sort brackets by minIncome to ensure correct order
    const sortedBrackets = [...taxBrackets].sort((a, b) => a.minIncome - b.minIncome);

    for (const bracket of sortedBrackets) {
      if (remainingIncome <= 0) break;

      const bracketMin = bracket.minIncome;
      const bracketMax = bracket.maxIncome || Infinity;
      
      // Skip brackets that don't apply to this income level
      if (annualSalaryLKR <= bracketMin) continue;

      // Calculate taxable amount in this bracket
      const taxableInThisBracket = Math.min(
        remainingIncome,
        Math.min(bracketMax - bracketMin, annualSalaryLKR - bracketMin)
      );

      if (taxableInThisBracket > 0) {
        totalTax += taxableInThisBracket * bracket.taxRate;
        remainingIncome -= taxableInThisBracket;
      }
    }

    return totalTax;
  }

  /**
   * Calculate detailed tax breakdown by bracket for display
   */
  calculateDetailedTaxBreakdown(annualSalaryLKR: number, taxBrackets: TaxBracket[]): {
    rangeMin: number;
    rangeMax: number | null;
    rate: number;
    tax: number;
  }[] {
    const sortedBrackets = [...taxBrackets].sort((a, b) => a.minIncome - b.minIncome);
    const breakdown = [];
    let remainingSalary = annualSalaryLKR;

    for (const bracket of sortedBrackets) {
      if (remainingSalary <= 0) break;

      const bracketMin = bracket.minIncome;
      const bracketMax = bracket.maxIncome;
      const taxableInThisBracket = Math.min(
        remainingSalary,
        bracketMax ? bracketMax - bracketMin : remainingSalary
      );

      if (taxableInThisBracket > 0) {
        const tax = (taxableInThisBracket * bracket.taxRate) / 100;
        breakdown.push({
          rangeMin: bracketMin,
          rangeMax: bracketMax,
          rate: bracket.taxRate,
          tax: tax
        });
      }

      remainingSalary -= taxableInThisBracket;
    }

    return breakdown;
  }

  /**
   * Calculate tax breakdown for a salary entry
   */
  calculateTaxBreakdown(salaryEntry: SalaryEntry, taxBrackets: TaxBracket[]): {
    monthlySalaryLKR: number;
    annualSalaryLKR: number;
    monthlyTax: number;
    annualTax: number;
    netMonthlySalary: number;
    netAnnualSalary: number;
    effectiveTaxRate: number;
  } {
    const monthlySalaryLKR = salaryEntry.salaryInLKR || 0;
    const annualSalaryLKR = monthlySalaryLKR * 12;
    const annualTax = this.calculateAnnualTax(annualSalaryLKR, taxBrackets);
    const monthlyTax = annualTax / 12;

    return {
      monthlySalaryLKR,
      annualSalaryLKR,
      monthlyTax,
      annualTax,
      netMonthlySalary: monthlySalaryLKR - monthlyTax,
      netAnnualSalary: annualSalaryLKR - annualTax,
      effectiveTaxRate: annualSalaryLKR > 0 ? (annualTax / annualSalaryLKR) * 100 : 0
    };
  }

  /**
   * Generate unique ID for tax brackets
   */
  generateTaxBracketId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
  }
}
