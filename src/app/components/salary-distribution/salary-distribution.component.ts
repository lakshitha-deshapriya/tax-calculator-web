import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnifiedStorageService } from '../../services/unified-storage.service';
import { TaxConfigService } from '../../services/tax-config.service';
import { SalaryCalculationService } from '../../services/salary-calculation.service';
import { ConfigurationService } from '../../services/configuration.service';
import { TaxConfig, SalaryEntry, FinancialYear, DistributionItem, MonthlyBreakdown } from '../../models/tax-config.model';
import { NetBreakdownComponent } from './net-breakdown/net-breakdown.component';
import { DetailedViewComponent } from './detailed-view/detailed-view.component';
import { InvestmentsViewComponent } from './investments-view/investments-view.component';

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
  imports: [CommonModule, FormsModule, NetBreakdownComponent, DetailedViewComponent, InvestmentsViewComponent],
  templateUrl: './salary-distribution.component.html',
  styleUrls: ['./salary-distribution.component.css']
})
export class SalaryDistributionComponent implements OnInit {
  taxConfig!: TaxConfig;
  availableFinancialYears: FinancialYear[] = [];
  selectedFinancialYear!: FinancialYear;
  monthlyBreakdowns: MonthlyBreakdown[] = [];
  
  // View mode selection
  viewMode: 'breakdown' | 'detailed' | 'investments' = 'breakdown';

  constructor(
    private unifiedStorageService: UnifiedStorageService,
    private taxConfigService: TaxConfigService,
    private salaryCalculationService: SalaryCalculationService,
    private configService: ConfigurationService
  ) { }

  async ngOnInit(): Promise<void> {
    console.log('SalaryDistributionComponent initialized');
    await this.loadTaxConfig();
    this.updateAvailableFinancialYears();
    this.calculateDistributions();
  }

  async loadTaxConfig(): Promise<void> {
    const config = await this.unifiedStorageService.loadTaxConfig();
    this.taxConfig = config || this.taxConfigService.getDefaultTaxConfig();
  }

  async saveTaxConfig(): Promise<void> {
    await this.unifiedStorageService.saveTaxConfig(this.taxConfig);
  }

  updateAvailableFinancialYears(): void {
    const financialYears = new Map<string, FinancialYear>();
    
    this.taxConfig.salaryEntries.forEach(entry => {
      const monthString = this.salaryCalculationService.formatDateToMonthString(entry.taxableMonth);
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
    console.log('Calculating distributions for financial year:', this.selectedFinancialYear);
    
    if (!this.selectedFinancialYear) {
      this.monthlyBreakdowns = [];
      return;
    }

    const salaryEntries = this.getSalaryEntriesForSelectedYear();
    
    // Use the salary calculation service to calculate distributions
    this.monthlyBreakdowns = this.salaryCalculationService.calculateDistributions(
      salaryEntries, 
      this.selectedFinancialYear, 
      this.taxConfig
    );
  }

  getSalaryEntriesForSelectedYear(): SalaryEntry[] {
    if (!this.selectedFinancialYear) return [];
    
    return this.taxConfig.salaryEntries
      .filter(entry => {
        const monthString = this.salaryCalculationService.formatDateToMonthString(entry.taxableMonth);
        const entryFY = this.taxConfigService.getFinancialYear(monthString);
        return entryFY.startYear === this.selectedFinancialYear.startYear;
      })
      .sort((a, b) => new Date(a.taxableMonth).getTime() - new Date(b.taxableMonth).getTime());
  }

  // Helper methods for getting configurations
  getEpfRatePercentage(): number {
    return this.configService.getEpfRatePercentage();
  }

  getEtfRatePercentage(): number {
    return this.configService.getEtfRatePercentage();
  }

  getTotalDistributionPercentage(): number {
    return this.configService.getTotalDistributionPercentage();
  }

  isDistributionPercentageValid(): boolean {
    return this.configService.isDistributionPercentageValid();
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

  // Summary methods - delegated to salary calculation service
  getTotalGrossSalary(): number {
    return this.salaryCalculationService.getTotalGrossSalary(this.monthlyBreakdowns);
  }

  getTotalTaxAmount(): number {
    return this.salaryCalculationService.getTotalTaxAmount(this.monthlyBreakdowns);
  }

  getTotalEpfAmount(): number {
    return this.salaryCalculationService.getTotalEpfAmount(this.monthlyBreakdowns);
  }

  getTotalEtfAmount(): number {
    return this.salaryCalculationService.getTotalEtfAmount(this.monthlyBreakdowns);
  }

  getTotalDeductions(): number {
    return this.salaryCalculationService.getTotalDeductions(this.monthlyBreakdowns);
  }

  getTotalNetIncome(): number {
    return this.salaryCalculationService.getTotalNetIncome(this.monthlyBreakdowns);
  }

  getAverageMonthlyBreakdown() {
    return this.salaryCalculationService.getAverageMonthlyBreakdown(this.monthlyBreakdowns);
  }

  getCategoryTotalForYear(category: string): number {
    return this.monthlyBreakdowns.reduce((sum, breakdown) => {
      return sum + (breakdown.distributionAmounts?.[category] || 0);
    }, 0);
  }

  // Net Salary Breakdown table methods
  getUniqueCategories(): string[] {
    return this.salaryCalculationService.getUniqueCategories(this.taxConfig);
  }

  formatMonthDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  }

  getCategoryAmountForMonth(breakdown: MonthlyBreakdown, category: string): number {
    return this.salaryCalculationService.getCategoryAmountForMonth(breakdown, category, this.taxConfig);
  }

  getCategoryPercentage(category: string): number {
    const item = this.taxConfig.distributionItems.find(item => item.category === category);
    return item ? item.percentage : 0;
  }
}
