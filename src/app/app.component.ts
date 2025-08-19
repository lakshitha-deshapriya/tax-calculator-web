import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService, ExchangeRateData } from './services/exchange-rate-production.service';
import { TaxConfigService } from './services/tax-config.service';
import { TaxConfig, SalaryEntry, FinancialYear } from './models/tax-config.model';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Tax Calculator Web';
  
  // Exchange rate related properties
  selectedDate: string = '';
  selectedCurrency: string = 'USD';
  exchangeRateData: ExchangeRateData | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  supportedCurrencies: { code: string, name: string }[] = [];

  // Tax calculator related properties
  taxConfig: TaxConfig;
  availableMonths: { value: string; label: string }[] = [];
  newSalaryEntry: Partial<SalaryEntry> = {};
  isAddingSalary: boolean = false;
  activeTab: 'settings' | 'salary' | 'calculator' = 'settings';

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService
  ) {
    // Load or create default tax config
    this.taxConfig = this.taxConfigService.loadTaxConfig() || this.taxConfigService.getDefaultTaxConfig();
  }

  ngOnInit() {
    console.log('AppComponent initialized');
    // Set default date to today
    const today = new Date();
    this.selectedDate = this.formatDateForInput(today);
    
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();
    console.log('Supported currencies loaded:', this.supportedCurrencies.length);

    // Initialize tax calculator data
    this.availableMonths = this.taxConfigService.getAvailableMonths();
    this.initNewSalaryEntry();

    // Set default currency for exchange rate lookup
    if (this.taxConfig.defaultCurrency) {
      this.selectedCurrency = this.taxConfig.defaultCurrency;
    }
  }

  get maxDate(): string {
    return this.formatDateForInput(new Date());
  }

  onSearchExchangeRate() {
    if (!this.selectedDate || !this.selectedCurrency) {
      this.errorMessage = 'Please select both date and currency';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.exchangeRateData = null;

    const date = new Date(this.selectedDate);
    
        this.exchangeRateService.getExchangeRate(date, this.selectedCurrency).subscribe({
      next: (data: ExchangeRateData) => {
        this.exchangeRateData = data;
        this.isLoading = false;
        console.log('Exchange rate data received:', data);
      },
      error: (error: any) => {
        this.errorMessage = error.message || 'Failed to fetch exchange rate. Please try again.';
        this.isLoading = false;
        console.error('Error fetching exchange rate:', error);
      }
    });
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Tax Calculator Methods

  initNewSalaryEntry(): void {
    // Set default month to current month
    const currentMonth = this.availableMonths[0]?.value || '';
    
    this.newSalaryEntry = {
      taxableMonth: currentMonth,
      salaryDate: currentMonth ? this.taxConfigService.getDefaultSalaryDateForMonth(currentMonth, this.taxConfig.defaultSalaryDate) : '',
      currency: this.taxConfig.defaultCurrency,
      salaryAmount: 0
    };
  }

  saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
    console.log('Tax configuration saved');
  }

  onDefaultConfigChange(): void {
    this.saveTaxConfig();
    // Update new salary entry with new defaults
    if (this.newSalaryEntry.currency !== this.taxConfig.defaultCurrency) {
      this.newSalaryEntry.currency = this.taxConfig.defaultCurrency;
    }
    // Update salary date to use new default day
    if (this.newSalaryEntry.taxableMonth) {
      this.newSalaryEntry.salaryDate = this.taxConfigService.getDefaultSalaryDateForMonth(
        this.newSalaryEntry.taxableMonth, 
        this.taxConfig.defaultSalaryDate
      );
    }
  }

  onTaxableMonthChange(): void {
    // Update salary date when taxable month changes
    if (this.newSalaryEntry.taxableMonth) {
      this.newSalaryEntry.salaryDate = this.taxConfigService.getDefaultSalaryDateForMonth(
        this.newSalaryEntry.taxableMonth, 
        this.taxConfig.defaultSalaryDate
      );
    }
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
        const salaryEntry: SalaryEntry = {
          id: this.taxConfigService.generateSalaryEntryId(),
          taxableMonth: this.newSalaryEntry.taxableMonth!,
          salaryDate: this.newSalaryEntry.salaryDate!,
          salaryAmount: this.newSalaryEntry.salaryAmount!,
          currency: this.newSalaryEntry.currency!,
          exchangeRate: exchangeData.buyingRate,
          salaryInLKR: this.newSalaryEntry.salaryAmount! * exchangeData.buyingRate
        };

        this.taxConfig.salaryEntries.push(salaryEntry);
        this.saveTaxConfig();
        this.initNewSalaryEntry();
        this.isAddingSalary = false;
        
        console.log('Salary entry added:', salaryEntry);
      },
      error: (error: any) => {
        console.error('Error getting exchange rate for salary:', error);
        alert('Failed to get exchange rate for the salary date. Please try again.');
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

  getFinancialYears(): FinancialYear[] {
    const financialYears = new Map<string, FinancialYear>();
    
    this.taxConfig.salaryEntries.forEach(entry => {
      const fy = this.taxConfigService.getFinancialYear(entry.taxableMonth);
      financialYears.set(fy.label, fy);
    });

    return Array.from(financialYears.values()).sort((a, b) => b.startYear - a.startYear);
  }

  getTotalSalaryForFinancialYear(financialYear: FinancialYear): number {
    return this.taxConfigService.calculateFinancialYearSalary(this.taxConfig.salaryEntries, financialYear);
  }

  getSalaryEntriesForFinancialYear(financialYear: FinancialYear): SalaryEntry[] {
    return this.taxConfig.salaryEntries
      .filter(entry => {
        const entryFY = this.taxConfigService.getFinancialYear(entry.taxableMonth);
        return entryFY.startYear === financialYear.startYear;
      })
      .sort((a, b) => new Date(a.salaryDate).getTime() - new Date(b.salaryDate).getTime());
  }
}
