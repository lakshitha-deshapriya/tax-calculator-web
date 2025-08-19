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

  availableFinancialYears: FinancialYear[] = [];
  selectedFinancialYear!: FinancialYear;
  availableMonths: { value: string; label: string }[] = [];
  selectedTaxableMonth: string = ''; // Add string property for month selection
  newSalaryEntry: Partial<SalaryEntry> = {};
  isAddingSalary: boolean = false;
  supportedCurrencies: { code: string, name: string }[] = [];
  salaryDateRange: { minDate: string; maxDate: string } = { minDate: '', maxDate: '' };

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService
  ) {}

  ngOnInit() {
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();

    // Initialize financial years
    this.availableFinancialYears = this.taxConfigService.getAvailableFinancialYears();
    // Set selected financial year to the first item (current year) from the available list
    if (this.availableFinancialYears.length > 0) {
      this.selectedFinancialYear = this.availableFinancialYears[0];
    }

    // Initialize salary data
    this.updateAvailableMonths();
    this.initNewSalaryEntry();
  }

  get maxDate(): string {
    return this.formatDateForInput(new Date());
  }

  updateAvailableMonths(): void {
    if (this.selectedFinancialYear) {
      this.availableMonths = this.taxConfigService.getAvailableTaxableMonths(
        this.selectedFinancialYear, 
        this.taxConfig.salaryEntries
      );
    } else {
      this.availableMonths = [];
    }
  }

  onFinancialYearChange(): void {
    if (this.selectedFinancialYear) {
      this.updateAvailableMonths();
      this.initNewSalaryEntry();
    }
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  initNewSalaryEntry(): void {
    // Set default month to the first available month (oldest unconfigured taxable month)
    const firstAvailableMonth = this.availableMonths[0]?.value || '';
    this.selectedTaxableMonth = firstAvailableMonth;
    
    this.newSalaryEntry = {
      taxableMonth: firstAvailableMonth ? new Date(firstAvailableMonth + '-01') : new Date(),
      salaryDate: firstAvailableMonth ? new Date(this.taxConfigService.getDefaultSalaryDateForMonth(firstAvailableMonth, this.taxConfig.defaultSalaryDate)) : new Date(),
      currency: this.taxConfig.defaultCurrency,
      salaryAmount: 0
    };

    // Update date range for the selected month
    if (firstAvailableMonth) {
      this.salaryDateRange = this.taxConfigService.getMonthDateRange(firstAvailableMonth);
    }
  }

  onConfigChanged(): void {
    // Update new salary entry with new defaults
    if (this.newSalaryEntry.currency !== this.taxConfig.defaultCurrency) {
      this.newSalaryEntry.currency = this.taxConfig.defaultCurrency;
    }
    // Update salary date to use new default day
    if (this.selectedTaxableMonth) {
      this.newSalaryEntry.salaryDate = new Date(this.taxConfigService.getDefaultSalaryDateForMonth(
        this.selectedTaxableMonth, 
        this.taxConfig.defaultSalaryDate
      ));
      this.salaryDateRange = this.taxConfigService.getMonthDateRange(this.selectedTaxableMonth);
    }
    // Update available months in case salary entries changed
    this.updateAvailableMonths();
  }

  onTaxableMonthChange(): void {
    // Update salary date when taxable month changes
    if (this.selectedTaxableMonth) {
      this.newSalaryEntry.taxableMonth = new Date(this.selectedTaxableMonth + '-01');
      this.newSalaryEntry.salaryDate = new Date(this.taxConfigService.getDefaultSalaryDateForMonth(
        this.selectedTaxableMonth, 
        this.taxConfig.defaultSalaryDate
      ));
      
      // Update date range for the selected month
      this.salaryDateRange = this.taxConfigService.getMonthDateRange(this.selectedTaxableMonth);
    }
  }

  formatDateToMonthString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  get sortedSalaryEntries(): SalaryEntry[] {
    return [...this.taxConfig.salaryEntries].sort((a, b) => {
      return b.taxableMonth.getTime() - a.taxableMonth.getTime(); // Most recent first
    });
  }

  trackByFinancialYear(index: number, item: FinancialYear): string {
    return item.label;
  }

  trackByMonth(index: number, item: { value: string; label: string }): string {
    return item.value;
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
        this.updateAvailableMonths(); // Update available months after adding entry
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
      this.updateAvailableMonths(); // Update available months after deleting entry
      this.initNewSalaryEntry(); // Reinitialize to pick up newly available months
    }
  }

  private saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
    this.configChanged.emit();
  }
}
