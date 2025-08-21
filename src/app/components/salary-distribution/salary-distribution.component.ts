import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaxConfigService } from '../../services/tax-config.service';
import { TaxConfig, SalaryEntry, FinancialYear, DistributionItem } from '../../models/tax-config.model';
import { NetBreakdownComponent } from './net-breakdown/net-breakdown.component';
import { DetailedViewComponent } from './detailed-view/detailed-view.component';

interface MonthlyDistributionBreakdown {
  salaryEntry: SalaryEntry;
  grossSalary: number;
  taxAmount: number;
  epfAmount: number;
  etfAmount: number;
  totalDeductions: number;
  netIncome: number;
  distributionAmounts: { [category: string]: number };
}

@Component({
  selector: 'app-salary-distribution',
  standalone: true,
  imports: [CommonModule, FormsModule, NetBreakdownComponent, DetailedViewComponent],
  templateUrl: './salary-distribution.component.html',
  styleUrls: ['./salary-distribution.component.css']
})
export class SalaryDistributionComponent implements OnInit {
  taxConfig!: TaxConfig;
  availableFinancialYears: FinancialYear[] = [];
  selectedFinancialYear!: FinancialYear;
  monthlyBreakdowns: MonthlyDistributionBreakdown[] = [];
  
  // Configuration mode
  isConfiguring = false;
  
  // Distribution section collapse state
  isDistributionCollapsed = false;
  
  // View mode selection
  viewMode: 'breakdown' | 'detailed' = 'breakdown';

  constructor(private taxConfigService: TaxConfigService) { }

  ngOnInit(): void {
    console.log('SalaryDistributionComponent initialized');
    this.loadTaxConfig();
    this.updateAvailableFinancialYears();
    this.calculateDistributions();
  }

  loadTaxConfig(): void {
    this.taxConfig = this.taxConfigService.loadTaxConfig() || this.taxConfigService.getDefaultTaxConfig();
    this.taxConfigService.saveTaxConfig(this.taxConfig);
  }

  saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
  }

  updateAvailableFinancialYears(): void {
    const financialYears = new Map<string, FinancialYear>();
    
    this.taxConfig.salaryEntries.forEach(entry => {
      const monthString = this.formatDateToMonthString(entry.taxableMonth);
      const fy = this.taxConfigService.getFinancialYear(monthString);
      financialYears.set(fy.label, fy);
    });

    this.availableFinancialYears = Array.from(financialYears.values()).sort((a, b) => b.startYear - a.startYear);
    
    // Set default selected financial year to the most recent one
    if (this.availableFinancialYears.length > 0) {
      this.selectedFinancialYear = this.availableFinancialYears[0];
    }
  }

  onFinancialYearChange(): void {
    this.calculateDistributions();
  }
  
  onViewModeChange(): void {
    // View mode changed, nothing special to do here as the template will handle the display
  }

  calculateDistributions(): void {
    if (!this.selectedFinancialYear) {
      this.monthlyBreakdowns = [];
      return;
    }

    const salaryEntries = this.getSalaryEntriesForSelectedYear();
    this.monthlyBreakdowns = [];

    salaryEntries.forEach(entry => {
      const grossSalary = entry.salaryInLKR || 0;
      if (grossSalary === 0) return;

      // Calculate monthly tax using the same method as tax calculator
      const taxAmount = this.calculateCorrectMonthlyTax(entry, this.selectedFinancialYear);
      
      // Calculate EPF and ETF
      const epfAmount = grossSalary * this.taxConfig.epfRate;
      const etfAmount = grossSalary * this.taxConfig.etfRate;
      
      // Calculate total deductions and net income
      const totalDeductions = taxAmount + epfAmount + etfAmount;
      const netIncome = grossSalary - totalDeductions;
      
      // Calculate distribution amounts
      const distributionAmounts: { [category: string]: number } = {};
      this.taxConfig.distributionItems.forEach(item => {
        distributionAmounts[item.category] = (netIncome * item.percentage) / 100;
      });

      this.monthlyBreakdowns.push({
        salaryEntry: entry,
        grossSalary,
        taxAmount,
        epfAmount,
        etfAmount,
        totalDeductions,
        netIncome,
        distributionAmounts
      });
    });

    // Sort by taxable month (oldest first - ascending order)
    this.monthlyBreakdowns.sort((a, b) => 
      a.salaryEntry.taxableMonth.getTime() - b.salaryEntry.taxableMonth.getTime()
    );
  }

  getSalaryEntriesForSelectedYear(): SalaryEntry[] {
    if (!this.selectedFinancialYear) return [];
    
    return this.taxConfig.salaryEntries
      .filter(entry => {
        const monthString = this.formatDateToMonthString(entry.taxableMonth);
        const entryFY = this.taxConfigService.getFinancialYear(monthString);
        return entryFY.startYear === this.selectedFinancialYear.startYear;
      })
      .sort((a, b) => new Date(a.taxableMonth).getTime() - new Date(b.taxableMonth).getTime());
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
    
    return this.getSalaryEntriesForSelectedYear()
      .filter(entry => {
        const entryDate = typeof entry.salaryDate === 'string' ? new Date(entry.salaryDate) : entry.salaryDate;
        return entryDate <= targetDate;
      })
      .reduce((sum: number, entry: SalaryEntry) => sum + (entry.salaryInLKR || 0), 0);
  }

  calculateAnnualTax(annualSalary: number): number {
    return this.taxConfigService.calculateAnnualTax(annualSalary, this.taxConfig.taxBrackets);
  }

  formatDateToMonthString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  // Configuration methods
  toggleConfiguration(): void {
    this.isConfiguring = !this.isConfiguring;
  }

  toggleDistributionSection(): void {
    this.isDistributionCollapsed = !this.isDistributionCollapsed;
  }

  updateEpfRate(newRate: number): void {
    this.taxConfig.epfRate = newRate / 100; // Convert percentage to decimal
    this.saveTaxConfig();
    this.calculateDistributions();
  }

  updateEtfRate(newRate: number): void {
    this.taxConfig.etfRate = newRate / 100; // Convert percentage to decimal
    this.saveTaxConfig();
    this.calculateDistributions();
  }

  updateDistributionPercentage(index: number, newPercentage: number): void {
    this.taxConfig.distributionItems[index].percentage = newPercentage;
    this.saveTaxConfig();
    this.calculateDistributions();
  }

  addDistributionItem(): void {
    const newItem: DistributionItem = {
      id: this.taxConfigService.generateDistributionItemId(),
      category: 'New Category',
      percentage: 0,
      description: 'Enter description'
    };
    this.taxConfig.distributionItems.push(newItem);
    this.saveTaxConfig();
    this.calculateDistributions();
  }

  removeDistributionItem(index: number): void {
    if (this.taxConfig.distributionItems.length > 1) {
      this.taxConfig.distributionItems.splice(index, 1);
      this.saveTaxConfig();
      this.calculateDistributions();
    }
  }

  updateDistributionCategory(index: number, newCategory: string): void {
    this.taxConfig.distributionItems[index].category = newCategory;
    this.saveTaxConfig();
  }

  updateDistributionDescription(index: number, newDescription: string): void {
    this.taxConfig.distributionItems[index].description = newDescription;
    this.saveTaxConfig();
  }

  getTotalDistributionPercentage(): number {
    return this.taxConfig.distributionItems.reduce((sum, item) => sum + item.percentage, 0);
  }

  isDistributionPercentageValid(): boolean {
    const total = this.getTotalDistributionPercentage();
    return total >= 99 && total <= 101; // Allow 1% variance for rounding
  }

  normalizeDistributionPercentages(): void {
    const currentTotal = this.getTotalDistributionPercentage();
    if (currentTotal > 0) {
      this.taxConfig.distributionItems.forEach(item => {
        item.percentage = (item.percentage / currentTotal) * 100;
      });
      this.saveTaxConfig();
      this.calculateDistributions();
    }
  }

  getColorClass(index: number): string {
    const colors = ['primary', 'success', 'warning', 'info', 'secondary', 'danger'];
    return colors[index % colors.length];
  }

  // Summary methods
  getTotalGrossSalary(): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.grossSalary, 0);
  }

  getTotalTaxAmount(): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.taxAmount, 0);
  }

  getTotalEpfAmount(): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.epfAmount, 0);
  }

  getTotalEtfAmount(): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.etfAmount, 0);
  }

  getTotalDeductions(): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.totalDeductions, 0);
  }

  getTotalNetIncome(): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => sum + breakdown.netIncome, 0);
  }

  getAverageMonthlyBreakdown() {
    const count = this.monthlyBreakdowns.length;
    if (count === 0) return null;

    return {
      grossSalary: this.getTotalGrossSalary() / count,
      taxAmount: this.getTotalTaxAmount() / count,
      epfAmount: this.getTotalEpfAmount() / count,
      etfAmount: this.getTotalEtfAmount() / count,
      totalDeductions: this.getTotalDeductions() / count,
      netIncome: this.getTotalNetIncome() / count
    };
  }

  getCategoryTotalForYear(category: string): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => {
      return sum + (breakdown.distributionAmounts[category] || 0);
    }, 0);
  }

  // Net Salary Breakdown table methods
  getUniqueCategories(): string[] {
    return this.taxConfig.distributionItems.map(item => item.category);
  }

  formatMonthDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  }

  getCategoryAmountForMonth(breakdown: MonthlyDistributionBreakdown, category: string): number {
    return breakdown.distributionAmounts[category] || 0;
  }

  getCategoryPercentage(category: string): number {
    const item = this.taxConfig.distributionItems.find(item => item.category === category);
    return item ? item.percentage : 0;
  }
}
