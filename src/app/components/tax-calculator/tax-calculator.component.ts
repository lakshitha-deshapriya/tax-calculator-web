import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaxConfigService } from '../../services/tax-config.service';
import { TaxConfig, SalaryEntry, FinancialYear } from '../../models/tax-config.model';

@Component({
  selector: 'app-tax-calculator',
  imports: [CommonModule],
  templateUrl: './tax-calculator.component.html',
  styleUrl: './tax-calculator.component.css'
})
export class TaxCalculatorComponent {
  @Input() taxConfig!: TaxConfig;

  constructor(private taxConfigService: TaxConfigService) {}

  getFinancialYears(): FinancialYear[] {
    const financialYears = new Map<string, FinancialYear>();
    
    this.taxConfig.salaryEntries.forEach(entry => {
      const monthString = this.formatDateToMonthString(entry.taxableMonth);
      const fy = this.taxConfigService.getFinancialYear(monthString);
      financialYears.set(fy.label, fy);
    });

    return Array.from(financialYears.values()).sort((a, b) => b.startYear - a.startYear);
  }

  getTotalSalaryForFinancialYear(financialYear: FinancialYear): number {
    return this.taxConfigService.calculateFinancialYearSalary(this.taxConfig.salaryEntries, financialYear);
  }

  getSalaryEntriesForFinancialYear(financialYear: FinancialYear): SalaryEntry[] {
    return this.taxConfig.salaryEntries
      .filter(entry => {
        const monthString = this.formatDateToMonthString(entry.taxableMonth);
        const entryFY = this.taxConfigService.getFinancialYear(monthString);
        return entryFY.startYear === financialYear.startYear;
      })
      .sort((a, b) => new Date(a.salaryDate).getTime() - new Date(b.salaryDate).getTime());
  }

  formatDateToMonthString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  // Tax calculation helper methods
  calculateAnnualTax(annualSalary: number): number {
    return this.taxConfigService.calculateAnnualTax(annualSalary, this.taxConfig.taxBrackets);
  }

  calculateCorrectMonthlyTax(entry: SalaryEntry, fy: FinancialYear): number {
    const monthlySalary = entry.salaryInLKR || 0;
    if (monthlySalary === 0) return 0;
    
    // Get cumulative salary up to this month (including this month)
    const cumulativeSalary = this.getCumulativeSalaryUpToMonth(entry, fy);
    
    // Get cumulative salary up to previous month (excluding this month)
    const previousCumulativeSalary = cumulativeSalary - monthlySalary;
    
    // Calculate tax on cumulative salary up to this month
    const cumulativeTax = this.calculateAnnualTax(cumulativeSalary);
    
    // Calculate tax on cumulative salary up to previous month
    const previousCumulativeTax = this.calculateAnnualTax(previousCumulativeSalary);
    
    // Monthly tax is the difference (additional tax due to this month's salary)
    return cumulativeTax - previousCumulativeTax;
  }

  getCumulativeSalaryUpToMonth(targetEntry: SalaryEntry, fy: FinancialYear): number {
    const targetDate = typeof targetEntry.salaryDate === 'string' ? new Date(targetEntry.salaryDate) : targetEntry.salaryDate;
    
    return this.getSalaryEntriesForFinancialYear(fy)
      .filter(entry => {
        const entryDate = typeof entry.salaryDate === 'string' ? new Date(entry.salaryDate) : entry.salaryDate;
        return entryDate <= targetDate;
      })
      .reduce((sum: number, entry: SalaryEntry) => sum + (entry.salaryInLKR || 0), 0);
  }

  getCumulativeTaxUpToMonth(targetEntry: SalaryEntry, fy: FinancialYear): number {
    const cumulativeSalary = this.getCumulativeSalaryUpToMonth(targetEntry, fy);
    return this.calculateAnnualTax(cumulativeSalary);
  }

  getTotalTaxForFinancialYear(fy: FinancialYear): number {
    return this.getSalaryEntriesForFinancialYear(fy).reduce((total: number, entry: SalaryEntry) => {
      return total + this.calculateCorrectMonthlyTax(entry, fy);
    }, 0);
  }

  getNetSalaryForFinancialYear(fy: FinancialYear): number {
    const totalSalary = this.getTotalSalaryForFinancialYear(fy);
    const totalTax = this.getTotalTaxForFinancialYear(fy);
    return totalSalary - totalTax;
  }

  formatPercentage(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
  }

  getBracketSpecificTaxBreakdown(totalSalary: number) {
    const brackets = this.taxConfig.taxBrackets.sort((a, b) => a.minIncome - b.minIncome);
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

  trackBySalaryEntry(index: number, entry: SalaryEntry): string {
    return entry.id;
  }
}
