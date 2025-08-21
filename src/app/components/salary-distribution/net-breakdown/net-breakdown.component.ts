import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaxConfig, FinancialYear, SalaryEntry } from '../../../models/tax-config.model';

interface MonthlyBreakdown {
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
  selector: 'app-net-breakdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './net-breakdown.component.html',
  styleUrls: ['./net-breakdown.component.css']
})
export class NetBreakdownComponent {
  @Input() monthlyBreakdowns: MonthlyBreakdown[] = [];
  @Input() taxConfig!: TaxConfig;
  @Input() selectedFinancialYear!: FinancialYear;

  getTotalGrossSalary(): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => total + breakdown.grossSalary, 0);
  }

  getTotalTaxAmount(): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => total + breakdown.taxAmount, 0);
  }

  getTotalEpfAmount(): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => total + breakdown.epfAmount, 0);
  }

  getTotalEtfAmount(): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => total + breakdown.etfAmount, 0);
  }

  getTotalDeductions(): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => total + breakdown.totalDeductions, 0);
  }

  getTotalNetIncome(): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => total + breakdown.netIncome, 0);
  }

  getUniqueCategories(): string[] {
    const categories = new Set<string>();
    this.taxConfig.distributionItems.forEach(item => categories.add(item.category));
    return Array.from(categories);
  }

  getCategoryAmountForMonth(breakdown: MonthlyBreakdown, category: string): number {
    return breakdown.distributionAmounts[category] || 0;
  }

  getCategoryPercentage(category: string): number {
    const item = this.taxConfig.distributionItems.find(item => item.category === category);
    return item ? item.percentage : 0;
  }

  getCategoryTotalForYear(category: string): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => {
      return total + (breakdown.distributionAmounts[category] || 0);
    }, 0);
  }

  formatMonthDisplay(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  getColorClass(index: number): string {
    const colors = ['primary', 'secondary', 'success', 'info', 'warning', 'danger'];
    return colors[index % colors.length];
  }
}
