import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaxConfig, FinancialYear, SalaryEntry, MonthlyBreakdown } from '../../../models/tax-config.model';
import { SalaryCalculationService } from '../../../services/salary-calculation.service';

@Component({
  selector: 'app-detailed-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detailed-view.component.html',
  styleUrls: ['./detailed-view.component.css']
})
export class DetailedViewComponent {
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

  getCategoryAmountForMonth(breakdown: MonthlyBreakdown, category: string): number {
    return this.salaryCalculationService.getCategoryAmountForMonth(breakdown, category, this.taxConfig);
  }

  getColorClass(index: number): string {
    const colors = ['primary', 'secondary', 'success', 'info', 'warning', 'danger'];
    return colors[index % colors.length];
  }
}
