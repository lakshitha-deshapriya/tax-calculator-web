import { Component, OnInit, OnChanges, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaxConfig, FinancialYear, MonthlyBreakdown } from '../../../models/tax-config.model';
import { SalaryCalculationService } from '../../../services/salary-calculation.service';
import { UnifiedStorageService, InvestmentEntry } from '../../../services/unified-storage.service';
import { ConfigurationService, InvestmentConfig, InvestmentMethod } from '../../../services/configuration.service';

export interface MonthlyInvestmentSummary {
  month: Date;
  totalInvestmentTarget: number; // EPF + ETF + selected categories
  epfAmount: number;
  etfAmount: number;
  selectedCategoriesAmount: number;
  methodAllocations: { [methodId: string]: number };
  actualInvestments: { [methodId: string]: number }; // What was actually invested
  remainingToInvest: { [methodId: string]: number }; // What still needs to be invested
}

@Component({
  selector: 'app-investments-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './investments-view.component.html',
  styleUrls: ['./investments-view.component.css']
})
export class InvestmentsViewComponent implements OnInit, OnChanges {
  @Input() monthlyBreakdowns: MonthlyBreakdown[] = [];
  @Input() taxConfig!: TaxConfig;
  @Input() selectedFinancialYear!: FinancialYear;

  // Configuration
  investmentConfig: InvestmentConfig = {
    investmentMethods: [],
    targetInvestmentCategories: []
  };

  // Data
  monthlyInvestmentSummaries: MonthlyInvestmentSummary[] = [];
  investmentEntries: InvestmentEntry[] = [];
  
  // UI state
  showAddInvestment = false;
  
  // New investment form
  newInvestment = {
    methodId: '',
    amount: 0,
    investmentDate: new Date().toISOString().substring(0, 10),
    description: ''
  };

  constructor(
    private salaryCalculationService: SalaryCalculationService,
    private unifiedStorageService: UnifiedStorageService,
    private configService: ConfigurationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadInvestmentConfig();
    await this.loadInvestmentEntries();
    this.calculateInvestmentSummaries();
  }

  ngOnChanges(): void {
    this.calculateInvestmentSummaries();
  }

  // Configuration Management
  loadInvestmentConfig(): void {
    // This still uses ConfigurationService for investment methods and categories
    // The main tax config data (EPF/ETF, salary entries) comes from parent component
    // which now uses UnifiedStorageService, so no Firebase calls are made here
    this.investmentConfig = this.configService.getInvestmentConfig();
  }

  saveInvestmentConfig(): void {
    this.configService.setInvestmentConfig(this.investmentConfig);
  }

  // Investment Entries Management
  async loadInvestmentEntries(): Promise<void> {
    try {
      const entries = await this.unifiedStorageService.loadInvestmentEntries();
      this.investmentEntries = entries || [];
    } catch (error) {
      console.error('Error loading investment entries:', error);
      this.investmentEntries = [];
    }
  }

  async saveInvestmentEntries(): Promise<void> {
    try {
      await this.unifiedStorageService.saveInvestmentEntries(this.investmentEntries);
    } catch (error) {
      console.error('Error saving investment entries:', error);
    }
  }

  // Calculate investment summaries
  calculateInvestmentSummaries(): void {
    if (!this.monthlyBreakdowns?.length || !this.investmentConfig.targetInvestmentCategories?.length) {
      this.monthlyInvestmentSummaries = [];
      return;
    }

    this.monthlyInvestmentSummaries = this.monthlyBreakdowns.map(breakdown => {
      const epfAmount = breakdown.epfAmount;
      const etfAmount = breakdown.etfAmount;
      
      // Calculate selected categories amount
      let selectedCategoriesAmount = 0;
      this.investmentConfig.targetInvestmentCategories.forEach(category => {
        const amount = this.salaryCalculationService.getCategoryAmountForMonth(breakdown, category, this.taxConfig);
        selectedCategoriesAmount += amount;
      });

      const totalInvestmentTarget = epfAmount + etfAmount + selectedCategoriesAmount;

      // Calculate method allocations (based on total investment target, not just selected categories)
      const methodAllocations: { [methodId: string]: number } = {};
      const actualInvestments: { [methodId: string]: number } = {};
      const remainingToInvest: { [methodId: string]: number } = {};

      this.investmentConfig.investmentMethods.forEach(method => {
        // Allocate based on total investment target (EPF + ETF + selected categories)
        const allocation = (totalInvestmentTarget * method.percentage) / 100;
        methodAllocations[method.id] = allocation;

        // Calculate actual investments for this month and method
        const monthStart = new Date(breakdown.month!.getFullYear(), breakdown.month!.getMonth(), 1);
        const monthEnd = new Date(breakdown.month!.getFullYear(), breakdown.month!.getMonth() + 1, 0);
        
        const actualAmount = this.investmentEntries
          .filter(entry => 
            entry.methodId === method.id && 
            entry.investmentDate >= monthStart && 
            entry.investmentDate <= monthEnd
          )
          .reduce((sum, entry) => sum + entry.amount, 0);

        actualInvestments[method.id] = actualAmount;
        remainingToInvest[method.id] = Math.max(0, allocation - actualAmount);
      });

      return {
        month: breakdown.month!,
        totalInvestmentTarget,
        epfAmount,
        etfAmount,
        selectedCategoriesAmount,
        methodAllocations,
        actualInvestments,
        remainingToInvest
      };
    });
  }

  // Investment entry management
  async addInvestment(): Promise<void> {
    if (!this.newInvestment.methodId || this.newInvestment.amount <= 0) {
      return;
    }

    const investment: InvestmentEntry = {
      id: Date.now().toString(),
      methodId: this.newInvestment.methodId,
      amount: this.newInvestment.amount,
      investmentDate: new Date(this.newInvestment.investmentDate),
      description: this.newInvestment.description || ''
    };

    this.investmentEntries.push(investment);
    await this.saveInvestmentEntries();
    this.calculateInvestmentSummaries();

    // Reset form
    this.newInvestment = {
      methodId: '',
      amount: 0,
      investmentDate: new Date().toISOString().substring(0, 10),
      description: ''
    };
    this.showAddInvestment = false;
  }

  async deleteInvestment(id: string): Promise<void> {
    this.investmentEntries = this.investmentEntries.filter(entry => entry.id !== id);
    await this.saveInvestmentEntries();
    this.calculateInvestmentSummaries();
  }

  updateMethodPercentage(methodId: string, percentage: number): void {
    this.configService.updateInvestmentMethod(methodId, { percentage });
    this.loadInvestmentConfig(); // Refresh local config
    this.calculateInvestmentSummaries();
  }

  getTotalMethodPercentage(): number {
    return this.configService.getTotalInvestmentMethodPercentage();
  }

  isMethodPercentageValid(): boolean {
    return this.configService.isInvestmentMethodPercentageValid();
  }

  private generateMethodId(): string {
    return 'method_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Utility methods
  getTotalInvestmentTargetForYear(): number {
    return this.monthlyInvestmentSummaries.reduce((sum, summary) => sum + summary.totalInvestmentTarget, 0);
  }

  getTotalActualInvestmentsForYear(): number {
    return this.investmentEntries
      .filter(entry => this.isEntryInSelectedYear(entry))
      .reduce((sum, entry) => sum + entry.amount, 0);
  }

  getTotalRemainingToInvestForYear(): number {
    return this.getTotalInvestmentTargetForYear() - this.getTotalActualInvestmentsForYear();
  }

  getMethodTotalAllocation(methodId: string): number {
    return this.monthlyInvestmentSummaries.reduce((sum, summary) => sum + (summary.methodAllocations[methodId] || 0), 0);
  }

  getMethodTotalActual(methodId: string): number {
    return this.investmentEntries
      .filter(entry => entry.methodId === methodId && this.isEntryInSelectedYear(entry))
      .reduce((sum, entry) => sum + entry.amount, 0);
  }

  getMethodTotalRemaining(methodId: string): number {
    return this.getMethodTotalAllocation(methodId) - this.getMethodTotalActual(methodId);
  }

  private isEntryInSelectedYear(entry: InvestmentEntry): boolean {
    if (!this.selectedFinancialYear) return false;
    const entryYear = entry.investmentDate.getFullYear();
    const entryMonth = entry.investmentDate.getMonth();
    
    // Financial year starts in April
    const fyStart = entryMonth >= 3 ? entryYear : entryYear - 1;
    return fyStart === this.selectedFinancialYear.startYear;
  }

  getMethodName(methodId: string): string {
    return this.investmentConfig.investmentMethods.find(m => m.id === methodId)?.name || methodId;
  }

  getTotalEpfForYear(): number {
    return this.monthlyInvestmentSummaries.reduce((sum, summary) => sum + summary.epfAmount, 0);
  }

  getTotalEtfForYear(): number {
    return this.monthlyInvestmentSummaries.reduce((sum, summary) => sum + summary.etfAmount, 0);
  }

  getTotalSelectedCategoriesForYear(): number {
    return this.monthlyInvestmentSummaries.reduce((sum, summary) => sum + summary.selectedCategoriesAmount, 0);
  }

  // UI methods
  toggleAddInvestment(): void {
    this.showAddInvestment = !this.showAddInvestment;
  }

  // Template helper methods for status calculation
  isInvestmentComplete(summary: MonthlyInvestmentSummary): boolean {
    return Object.values(summary.remainingToInvest).every(val => val <= 0);
  }

  isInvestmentPartial(summary: MonthlyInvestmentSummary): boolean {
    return Object.values(summary.actualInvestments).some(val => val > 0) && 
           Object.values(summary.remainingToInvest).some(val => val > 0);
  }

  isInvestmentPending(summary: MonthlyInvestmentSummary): boolean {
    return Object.values(summary.actualInvestments).every(val => val <= 0);
  }

  getInvestmentStatus(summary: MonthlyInvestmentSummary): string {
    if (this.isInvestmentComplete(summary)) return 'Complete';
    if (this.isInvestmentPartial(summary)) return 'Partial';
    return 'Pending';
  }
}
