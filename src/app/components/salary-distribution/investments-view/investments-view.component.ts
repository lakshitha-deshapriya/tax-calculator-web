import { Component, OnInit, OnChanges, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaxConfig, FinancialYear, MonthlyBreakdown } from '../../../models/tax-config.model';
import { SalaryCalculationService } from '../../../services/salary-calculation.service';
import { TaxConfigService } from '../../../services/tax-config.service';

export interface InvestmentMethod {
  id: string;
  name: string;
  percentage: number; // Percentage allocation of investment amount
  description: string;
}

export interface InvestmentEntry {
  id: string;
  methodId: string;
  amount: number;
  investmentDate: Date;
  description?: string;
}

export interface InvestmentConfig {
  investmentMethods: InvestmentMethod[];
  targetInvestmentCategories: string[]; // Categories from distributionItems to use for investments
}

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
  isConfiguring = false;
  showAddInvestment = false;
  
  // New investment form
  newInvestment = {
    methodId: '',
    amount: 0,
    investmentDate: new Date().toISOString().substring(0, 10),
    description: ''
  };

  // Default investment methods
  defaultInvestmentMethods: InvestmentMethod[] = [
    {
      id: 'fixed-income-fund',
      name: 'Fixed Income Fund',
      percentage: 40,
      description: 'Government bonds, corporate bonds, fixed deposits'
    },
    {
      id: 'equity-fund',
      name: 'Equity Fund',
      percentage: 35,
      description: 'Mutual funds, index funds, equity investments'
    },
    {
      id: 'direct-stocks',
      name: 'Direct Stock Trading',
      percentage: 20,
      description: 'Direct purchases of individual stocks'
    },
    {
      id: 'other',
      name: 'Other Investments',
      percentage: 5,
      description: 'Real estate, commodities, alternative investments'
    }
  ];

  constructor(
    private salaryCalculationService: SalaryCalculationService,
    private taxConfigService: TaxConfigService
  ) {}

  ngOnInit(): void {
    this.loadInvestmentConfig();
    this.loadInvestmentEntries();
    this.calculateInvestmentSummaries();
  }

  ngOnChanges(): void {
    this.calculateInvestmentSummaries();
  }

  // Configuration Management
  loadInvestmentConfig(): void {
    const saved = localStorage.getItem('investmentConfig');
    if (saved) {
      this.investmentConfig = JSON.parse(saved);
    } else {
      this.investmentConfig.investmentMethods = [...this.defaultInvestmentMethods];
      
      // Auto-select investment categories
      if (this.taxConfig?.distributionItems) {
        const investmentKeywords = ['investment', 'saving', 'discretionary'];
        this.investmentConfig.targetInvestmentCategories = this.taxConfig.distributionItems
          .filter(item => investmentKeywords.some(keyword => 
            item.category.toLowerCase().includes(keyword.toLowerCase())
          ))
          .map(item => item.category);
      }
      
      this.saveInvestmentConfig();
    }
  }

  saveInvestmentConfig(): void {
    localStorage.setItem('investmentConfig', JSON.stringify(this.investmentConfig));
  }

  // Investment Entries Management
  loadInvestmentEntries(): void {
    const saved = localStorage.getItem('investmentEntries');
    if (saved) {
      this.investmentEntries = JSON.parse(saved).map((entry: any) => ({
        ...entry,
        investmentDate: new Date(entry.investmentDate)
      }));
    }
  }

  saveInvestmentEntries(): void {
    localStorage.setItem('investmentEntries', JSON.stringify(this.investmentEntries));
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

      // Calculate method allocations (only for selected categories, EPF/ETF are separate)
      const methodAllocations: { [methodId: string]: number } = {};
      const actualInvestments: { [methodId: string]: number } = {};
      const remainingToInvest: { [methodId: string]: number } = {};

      this.investmentConfig.investmentMethods.forEach(method => {
        const allocation = (selectedCategoriesAmount * method.percentage) / 100;
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
  addInvestment(): void {
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
    this.saveInvestmentEntries();
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

  deleteInvestment(id: string): void {
    this.investmentEntries = this.investmentEntries.filter(entry => entry.id !== id);
    this.saveInvestmentEntries();
    this.calculateInvestmentSummaries();
  }

  // Configuration methods
  updateMethodPercentage(methodId: string, percentage: number): void {
    const method = this.investmentConfig.investmentMethods.find(m => m.id === methodId);
    if (method) {
      method.percentage = percentage;
      this.saveInvestmentConfig();
      this.calculateInvestmentSummaries();
    }
  }

  toggleCategorySelection(category: string): void {
    const index = this.investmentConfig.targetInvestmentCategories.indexOf(category);
    if (index > -1) {
      this.investmentConfig.targetInvestmentCategories.splice(index, 1);
    } else {
      this.investmentConfig.targetInvestmentCategories.push(category);
    }
    this.saveInvestmentConfig();
    this.calculateInvestmentSummaries();
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

  // UI methods
  toggleConfiguration(): void {
    this.isConfiguring = !this.isConfiguring;
  }

  toggleAddInvestment(): void {
    this.showAddInvestment = !this.showAddInvestment;
  }

  isMethodPercentageValid(): boolean {
    const total = this.investmentConfig.investmentMethods.reduce((sum, method) => sum + method.percentage, 0);
    return total === 100;
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
