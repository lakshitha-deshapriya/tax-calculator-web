import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaxConfig, FinancialYear, SalaryEntry, MonthlyBreakdown } from '../../../models/tax-config.model';
import { SalaryCalculationService } from '../../../services/salary-calculation.service';

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

  constructor(private salaryCalculationService: SalaryCalculationService) {}

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

  getUniqueCategories(): string[] {
    return this.salaryCalculationService.getUniqueCategories(this.taxConfig);
  }

  getCategoryAmountForMonth(breakdown: MonthlyBreakdown, category: string): number {
    return this.salaryCalculationService.getCategoryAmountForMonth(breakdown, category, this.taxConfig);
  }

  getCategoryPercentage(category: string): number {
    const item = this.taxConfig.distributionItems.find(item => item.category === category);
    return item ? item.percentage : 0;
  }

  getCategoryTotalForYear(category: string): number {
    return this.monthlyBreakdowns.reduce((total, breakdown) => {
      return total + (breakdown.distributionAmounts?.[category] || 0);
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
