import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService, ExchangeRateData } from '../../services/exchange-rate-production.service';
import { TaxConfigService } from '../../services/tax-config.service';
import { TaxConfig, SalaryEntry, FinancialYear } from '../../models/tax-config.model';

@Component({
  selector: 'app-salary-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-management.component.html',
  styleUrl: './salary-management.component.css'
})
export class SalaryManagementComponent implements OnInit {
  @Input() taxConfig!: TaxConfig;
  @Output() configChanged = new EventEmitter<void>();

  availableMonths: { value: string; label: string }[] = [];
  newSalaryEntry: Partial<SalaryEntry> = {};
  isAddingSalary: boolean = false;
  supportedCurrencies: { code: string, name: string }[] = [];

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService
  ) {}

  ngOnInit() {
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();

    // Initialize salary data
    this.availableMonths = this.taxConfigService.getAvailableMonths();
    this.initNewSalaryEntry();
  }

  get maxDate(): string {
    return this.formatDateForInput(new Date());
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  initNewSalaryEntry(): void {
    // Set default month to current month
    const currentMonth = this.availableMonths[0]?.value || '';
    
    this.newSalaryEntry = {
      taxableMonth: currentMonth ? new Date(currentMonth + '-01') : new Date(),
      salaryDate: currentMonth ? new Date(this.taxConfigService.getDefaultSalaryDateForMonth(currentMonth, this.taxConfig.defaultSalaryDate)) : new Date(),
      currency: this.taxConfig.defaultCurrency,
      salaryAmount: 0
    };
  }

  onConfigChanged(): void {
    // Update new salary entry with new defaults
    if (this.newSalaryEntry.currency !== this.taxConfig.defaultCurrency) {
      this.newSalaryEntry.currency = this.taxConfig.defaultCurrency;
    }
    // Update salary date to use new default day
    if (this.newSalaryEntry.taxableMonth) {
      const monthString = this.formatDateToMonthString(this.newSalaryEntry.taxableMonth);
      this.newSalaryEntry.salaryDate = new Date(this.taxConfigService.getDefaultSalaryDateForMonth(
        monthString, 
        this.taxConfig.defaultSalaryDate
      ));
    }
  }

  onTaxableMonthChange(): void {
    // Update salary date when taxable month changes
    if (this.newSalaryEntry.taxableMonth) {
      const monthString = this.formatDateToMonthString(this.newSalaryEntry.taxableMonth);
      this.newSalaryEntry.salaryDate = new Date(this.taxConfigService.getDefaultSalaryDateForMonth(
        monthString, 
        this.taxConfig.defaultSalaryDate
      ));
    }
  }

  formatDateToMonthString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  onAddSalaryEntry(): void {
    if (!this.newSalaryEntry.taxableMonth || !this.newSalaryEntry.salaryDate || 
        !this.newSalaryEntry.salaryAmount || !this.newSalaryEntry.currency) {
      alert('Please fill in all fields');
      return;
    }

    this.isAddingSalary = true;
    const salaryDate = new Date(this.newSalaryEntry.salaryDate!);

    // Get exchange rate for the salary date
    this.exchangeRateService.getExchangeRate(salaryDate, this.newSalaryEntry.currency!).subscribe({
      next: (exchangeData: ExchangeRateData) => {
        const monthString = this.formatDateToMonthString(this.newSalaryEntry.taxableMonth!);
        const financialYear = this.taxConfigService.getFinancialYear(monthString);
        
        const salaryEntry: SalaryEntry = {
          id: this.taxConfigService.generateSalaryEntryId(),
          taxableMonth: this.newSalaryEntry.taxableMonth!,
          salaryDate: this.newSalaryEntry.salaryDate!,
          salaryAmount: this.newSalaryEntry.salaryAmount!,
          currency: this.newSalaryEntry.currency!,
          exchangeRate: exchangeData.buyingRate,
          salaryInLKR: this.newSalaryEntry.salaryAmount! * exchangeData.buyingRate,
          financialYear: financialYear.label
        };

        this.taxConfig.salaryEntries.push(salaryEntry);
        this.saveTaxConfig();
        this.initNewSalaryEntry();
        this.isAddingSalary = false;
        
        console.log('Salary entry added:', salaryEntry);
      },
      error: (error: any) => {
        console.error('Error adding salary entry:', error);
        alert('Failed to get exchange rate. Please try again.');
        this.isAddingSalary = false;
      }
    });
  }

  onDeleteSalaryEntry(entryId: string): void {
    if (confirm('Are you sure you want to delete this salary entry?')) {
      this.taxConfig.salaryEntries = this.taxConfig.salaryEntries.filter(entry => entry.id !== entryId);
      this.saveTaxConfig();
    }
  }

  private saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
    this.configChanged.emit();
  }
}
