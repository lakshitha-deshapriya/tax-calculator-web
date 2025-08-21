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

  getColorClass(index: number): string {
    const colors = ['primary', 'secondary', 'success', 'info', 'warning', 'danger'];
    return colors[index % colors.length];
  }
}
