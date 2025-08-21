import { Injectable } from '@angular/core';
import { SalaryEntry, FinancialYear, TaxConfig, TaxBracket, MonthlyBreakdown } from '../models/tax-config.model';
import { TaxConfigService } from './tax-config.service';

/**
 * Service for centralized salary and tax calculations
 * Used by Tax Calculator, Salary Distribution, and other components
 */
@Injectable({
  providedIn: 'root'
})
export class SalaryCalculationService {

  constructor(private taxConfigService: TaxConfigService) {}

  // ========================================
  // CORE TAX CALCULATION METHODS
  // ========================================

  /**
   * Calculate correct monthly tax using cumulative method
   * This is the primary method for accurate monthly tax calculation
   */
  calculateCorrectMonthlyTax(entry: SalaryEntry, financialYear: FinancialYear, taxBrackets: TaxBracket[], salaryEntries: SalaryEntry[] = []): number {
    const monthlySalary = entry.salaryInLKR || 0;
    if (monthlySalary === 0) return 0;
    
    // Get cumulative salary up to this month (including this month)
    const cumulativeSalary = this.getCumulativeSalaryUpToMonth(entry, financialYear, salaryEntries);
    
    // Get cumulative salary up to previous month (excluding this month)
    const previousCumulativeSalary = cumulativeSalary - monthlySalary;
    
    // Calculate tax on cumulative salary up to this month
    const cumulativeTax = this.calculateAnnualTax(cumulativeSalary, taxBrackets);
    
    // Calculate tax on cumulative salary up to previous month
    const previousCumulativeTax = this.calculateAnnualTax(previousCumulativeSalary, taxBrackets);
    
    // Monthly tax is the difference (additional tax due to this month's salary)
    return cumulativeTax - previousCumulativeTax;
  }

  /**
   * Calculate annual tax using progressive tax brackets
   * Uses TaxConfigService for consistency with existing components
   */
  calculateAnnualTax(annualSalaryLKR: number, taxBrackets: TaxBracket[]): number {
    // Use the same method as TaxConfigService for perfect consistency
    return this.taxConfigService.calculateAnnualTax(annualSalaryLKR, taxBrackets);
  }

  /**
   * Calculate monthly tax using simple annual/12 method (less accurate)
   */
  calculateSimpleMonthlyTax(monthlySalaryLKR: number, taxBrackets: TaxBracket[]): number {
    const annualSalary = monthlySalaryLKR * 12;
    const annualTax = this.calculateAnnualTax(annualSalary, taxBrackets);
    return annualTax / 12;
  }

  // ========================================
  // CUMULATIVE CALCULATION METHODS
  // ========================================

  /**
   * Get cumulative salary up to a specific month including that month
   */
  getCumulativeSalaryUpToMonth(targetEntry: SalaryEntry, financialYear: FinancialYear, salaryEntries: SalaryEntry[] = []): number {
    const targetDate = typeof targetEntry.salaryDate === 'string' ? new Date(targetEntry.salaryDate) : targetEntry.salaryDate;
    const fyEntries = this.getSalaryEntriesForFinancialYear(financialYear, salaryEntries);
    
    return fyEntries
      .filter(entry => {
        const entryDate = typeof entry.salaryDate === 'string' ? new Date(entry.salaryDate) : entry.salaryDate;
        return entryDate <= targetDate;
      })
      .reduce((sum: number, entry: SalaryEntry) => sum + (entry.salaryInLKR || 0), 0);
  }

  /**
   * Get cumulative tax up to a specific month
   */
  getCumulativeTaxUpToMonth(targetEntry: SalaryEntry, financialYear: FinancialYear, taxBrackets: TaxBracket[], salaryEntries: SalaryEntry[] = []): number {
    const cumulativeSalary = this.getCumulativeSalaryUpToMonth(targetEntry, financialYear, salaryEntries);
    return this.calculateAnnualTax(cumulativeSalary, taxBrackets);
  }

  // ========================================
  // FINANCIAL YEAR AGGREGATION METHODS
  // ========================================

  /**
   * Get all salary entries for a specific financial year
   * Uses exactly the same logic as Tax Calculator component for consistency
   */
  getSalaryEntriesForFinancialYear(financialYear: FinancialYear, salaryEntries: SalaryEntry[] = []): SalaryEntry[] {
    return salaryEntries
      .filter(entry => {
        const monthString = this.formatDateToMonthString(entry.taxableMonth);
        const entryFY = this.taxConfigService.getFinancialYear(monthString);
        return entryFY.startYear === financialYear.startYear;
      })
      .sort((a, b) => new Date(a.salaryDate).getTime() - new Date(b.salaryDate).getTime());
  }

  /**
   * Calculate total salary for a financial year
   */
  getTotalSalaryForFinancialYear(financialYear: FinancialYear, salaryEntries: SalaryEntry[] = []): number {
    const entries = this.getSalaryEntriesForFinancialYear(financialYear, salaryEntries);
    return entries.reduce((total: number, entry: SalaryEntry) => total + (entry.salaryInLKR || 0), 0);
  }

  /**
   * Calculate total tax for a financial year using cumulative method
   */
  getTotalTaxForFinancialYear(financialYear: FinancialYear, taxBrackets: TaxBracket[], salaryEntries: SalaryEntry[] = []): number {
    const entries = this.getSalaryEntriesForFinancialYear(financialYear, salaryEntries);
    return entries.reduce((total: number, entry: SalaryEntry) => {
      return total + this.calculateCorrectMonthlyTax(entry, financialYear, taxBrackets, salaryEntries);
    }, 0);
  }

  /**
   * Calculate net salary for a financial year
   */
  getNetSalaryForFinancialYear(financialYear: FinancialYear, taxBrackets: TaxBracket[], salaryEntries: SalaryEntry[] = []): number {
    const totalSalary = this.getTotalSalaryForFinancialYear(financialYear, salaryEntries);
    const totalTax = this.getTotalTaxForFinancialYear(financialYear, taxBrackets, salaryEntries);
    return totalSalary - totalTax;
  }

  /**
   * Calculate effective tax rate for a financial year
   */
  getEffectiveTaxRateForFinancialYear(financialYear: FinancialYear, taxBrackets: TaxBracket[], salaryEntries: SalaryEntry[] = []): number {
    const totalSalary = this.getTotalSalaryForFinancialYear(financialYear, salaryEntries);
    const totalTax = this.getTotalTaxForFinancialYear(financialYear, taxBrackets, salaryEntries);
    return totalSalary > 0 ? (totalTax / totalSalary) * 100 : 0;
  }

  // ========================================
  // EPF/ETF CALCULATION METHODS
  // ========================================

  /**
   * Calculate EPF (Employee Provident Fund) amount
   */
  calculateEpfAmount(salaryLKR: number, epfRate: number): number {
    return salaryLKR * epfRate;
  }

  /**
   * Calculate ETF (Employee Trust Fund) amount
   */
  calculateEtfAmount(salaryLKR: number, etfRate: number): number {
    return salaryLKR * etfRate;
  }

  /**
   * Calculate total deductions (tax + EPF + ETF)
   */
  calculateTotalDeductions(salaryLKR: number, taxAmount: number, epfRate: number, etfRate: number): number {
    const epfAmount = this.calculateEpfAmount(salaryLKR, epfRate);
    const etfAmount = this.calculateEtfAmount(salaryLKR, etfRate);
    return taxAmount + epfAmount + etfAmount;
  }

  /**
   * Calculate net income after all deductions
   */
  calculateNetIncome(salaryLKR: number, taxAmount: number, epfRate: number, etfRate: number): number {
    const totalDeductions = this.calculateTotalDeductions(salaryLKR, taxAmount, epfRate, etfRate);
    return salaryLKR - totalDeductions;
  }

  // ========================================
  // MONTHLY BREAKDOWN METHODS
  // ========================================

  /**
   * Create monthly breakdown for a salary entry
   */
  createMonthlyBreakdown(entry: SalaryEntry, financialYear: FinancialYear, taxConfig: TaxConfig, salaryEntries: SalaryEntry[] = []): MonthlyBreakdown {
    const grossSalary = entry.salaryInLKR || 0;
    const taxAmount = this.calculateCorrectMonthlyTax(entry, financialYear, taxConfig.taxBrackets, salaryEntries);
    const epfAmount = this.calculateEpfAmount(grossSalary, taxConfig.epfRate);
    const etfAmount = this.calculateEtfAmount(grossSalary, taxConfig.etfRate);

    // Calculate distribution amounts based on taxConfig.distributionItems
    const distributionAmounts: { [category: string]: number } = {};
    const netIncome = grossSalary - (taxAmount + epfAmount + etfAmount);
    
    taxConfig.distributionItems.forEach(item => {
      distributionAmounts[item.category] = netIncome * (item.percentage / 100);
    });

    return {
      month: entry.taxableMonth,
      salaryEntry: entry,
      grossSalary,
      taxAmount,
      epfAmount,
      etfAmount,
      totalDeductions: taxAmount + epfAmount + etfAmount,
      netIncome,
      distributionAmounts
    };
  }

  /**
   * Calculate distributions for salary entries
   */
  calculateDistributions(salaryEntries: SalaryEntry[], financialYear: FinancialYear, taxConfig: TaxConfig): MonthlyBreakdown[] {
    // Sort entries by date (ascending)
    const sortedEntries = this.sortSalaryEntriesByDate(salaryEntries, true);

    return sortedEntries.map(entry => this.createMonthlyBreakdown(entry, financialYear, taxConfig, salaryEntries));
  }

  // ========================================
  // SUMMARY CALCULATION METHODS
  // ========================================

  /**
   * Calculate total gross salary from monthly breakdowns
   */
  getTotalGrossSalary(monthlyBreakdowns: MonthlyBreakdown[]): number {
    return monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.grossSalary, 0);
  }

  /**
   * Calculate total tax amount from monthly breakdowns
   */
  getTotalTaxAmount(monthlyBreakdowns: MonthlyBreakdown[]): number {
    return monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.taxAmount, 0);
  }

  /**
   * Calculate total EPF amount from monthly breakdowns
   */
  getTotalEpfAmount(monthlyBreakdowns: MonthlyBreakdown[]): number {
    return monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.epfAmount, 0);
  }

  /**
   * Calculate total ETF amount from monthly breakdowns
   */
  getTotalEtfAmount(monthlyBreakdowns: MonthlyBreakdown[]): number {
    return monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.etfAmount, 0);
  }

  /**
   * Calculate total deductions from monthly breakdowns
   */
  getTotalDeductions(monthlyBreakdowns: MonthlyBreakdown[]): number {
    return monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.totalDeductions, 0);
  }

  /**
   * Calculate total net income from monthly breakdowns
   */
  getTotalNetIncome(monthlyBreakdowns: MonthlyBreakdown[]): number {
    return monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.netIncome, 0);
  }

  /**
   * Calculate average monthly breakdown
   */
  getAverageMonthlyBreakdown(monthlyBreakdowns: MonthlyBreakdown[]): {
    grossSalary: number;
    taxAmount: number;
    epfAmount: number;
    etfAmount: number;
    totalDeductions: number;
    netIncome: number;
  } | null {
    const count = monthlyBreakdowns.length;
    if (count === 0) return null;

    return {
      grossSalary: this.getTotalGrossSalary(monthlyBreakdowns) / count,
      taxAmount: this.getTotalTaxAmount(monthlyBreakdowns) / count,
      epfAmount: this.getTotalEpfAmount(monthlyBreakdowns) / count,
      etfAmount: this.getTotalEtfAmount(monthlyBreakdowns) / count,
      totalDeductions: this.getTotalDeductions(monthlyBreakdowns) / count,
      netIncome: this.getTotalNetIncome(monthlyBreakdowns) / count
    };
  }

  // ========================================
  // TAX BRACKET ANALYSIS METHODS
  // ========================================

  /**
   * Get detailed tax breakdown by bracket for display
   */
  getBracketSpecificTaxBreakdown(totalSalary: number, taxBrackets: TaxBracket[]) {
    const brackets = [...taxBrackets].sort((a, b) => a.minIncome - b.minIncome);
    const result = [];
    
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const rangeMin = bracket.minIncome;
      const rangeMax = bracket.maxIncome;
      
      // Calculate the taxable amount in this specific bracket
      let taxableInBracket = 0;
      
      if (totalSalary > rangeMin) {
        if (rangeMax === null) {
          // Highest bracket - no upper limit
          taxableInBracket = totalSalary - rangeMin;
        } else {
          // Middle brackets - has upper limit
          taxableInBracket = Math.min(totalSalary, rangeMax) - rangeMin;
        }
        taxableInBracket = Math.max(0, taxableInBracket);
      }
      
      const taxForThisBracket = taxableInBracket * bracket.taxRate;
      
      if (taxableInBracket > 0 || i === 0) { // Always show first bracket even if 0
        result.push({
          rangeMin: rangeMin,
          rangeMax: rangeMax,
          rate: bracket.taxRate,
          taxableAmount: taxableInBracket,
          tax: taxForThisBracket
        });
      }
    }
    
    return result;
  }

  /**
   * Calculate detailed tax breakdown for display
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

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get unique categories from tax config distribution items
   */
  getUniqueCategories(taxConfig: TaxConfig): string[] {
    return taxConfig.distributionItems.map(item => item.category).sort();
  }

  /**
   * Get category amount for a specific month using distribution items
   */
  getCategoryAmountForMonth(breakdown: MonthlyBreakdown, category: string, taxConfig: TaxConfig): number {
    const distributionItem = taxConfig.distributionItems.find(item => item.category === category);
    if (!distributionItem) return 0;
    
    // Calculate distribution amount based on net income and percentage
    return breakdown.netIncome * (distributionItem.percentage / 100);
  }

  /**
   * Check if financial year has salary entries
   */
  hasEntriesForFinancialYear(financialYear: FinancialYear, salaryEntries: SalaryEntry[] = []): boolean {
    const entries = this.getSalaryEntriesForFinancialYear(financialYear, salaryEntries);
    return entries.length > 0;
  }

  /**
   * Format date to month string for display
   */
  formatDateToMonthString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().substring(0, 7); // YYYY-MM format
  }

  /**
   * Sort salary entries by date (ascending or descending)
   */
  sortSalaryEntriesByDate(entries: SalaryEntry[], ascending: boolean = true): SalaryEntry[] {
    return [...entries].sort((a, b) => {
      const dateA = typeof a.salaryDate === 'string' ? new Date(a.salaryDate) : a.salaryDate;
      const dateB = typeof b.salaryDate === 'string' ? new Date(b.salaryDate) : b.salaryDate;
      const comparison = dateA.getTime() - dateB.getTime();
      return ascending ? comparison : -comparison;
    });
  }
}
