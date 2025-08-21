import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaxConfig, FinancialYear, MonthlyBreakdown } from '../../models/tax-config.model';
import { SalaryCalculationService } from '../../services/salary-calculation.service';

@Component({
  selector: 'app-financial-year-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-year-summary.component.html',
  styleUrls: ['./financial-year-summary.component.css']
})
export class FinancialYearSummaryComponent {
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
}
