import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService, ExchangeRateData } from './services/exchange-rate-production.service';
import { TaxConfigService } from './services/tax-config.service';
import { TaxConfig, SalaryEntry, FinancialYear, TaxBracket } from './models/tax-config.model';
import { ExchangeRateComponent } from './components/exchange-rate/exchange-rate.component';
import { SettingsComponent } from './components/settings/settings.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, ExchangeRateComponent, SettingsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Tax Calculator Web';

  // Tax calculator related properties
  taxConfig: TaxConfig;
  availableMonths: { value: string; label: string }[] = [];
  newSalaryEntry: Partial<SalaryEntry> = {};
  isAddingSalary: boolean = false;
  activeTab: 'settings' | 'salary' | 'calculator' | 'exchange' = 'settings';
  supportedCurrencies: { code: string, name: string }[] = [];

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService
  ) {
    // Load or create default tax config
    this.taxConfig = this.taxConfigService.loadTaxConfig() || this.taxConfigService.getDefaultTaxConfig();
    
    // Ensure tax brackets are always initialized
    if (!this.taxConfig.taxBrackets || this.taxConfig.taxBrackets.length === 0) {
      this.taxConfig.taxBrackets = this.taxConfigService.getDefaultTaxBrackets();
    }
  }

  ngOnInit() {
    console.log('AppComponent initialized');
    
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();
    console.log('Supported currencies loaded:', this.supportedCurrencies.length);

    // Initialize tax calculator data
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

  // Tax Calculator Methods

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

  saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
    console.log('Tax configuration saved');
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

  getFinancialYears(): FinancialYear[] {
    const financialYears = new Map<string, FinancialYear>();
    
    this.taxConfig.salaryEntries.forEach(entry => {
      const monthString = this.formatDateToMonthString(entry.taxableMonth);
      const fy = this.taxConfigService.getFinancialYear(monthString);
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
        const monthString = this.formatDateToMonthString(entry.taxableMonth);
        const entryFY = this.taxConfigService.getFinancialYear(monthString);
        return entryFY.startYear === financialYear.startYear;
      })
      .sort((a, b) => new Date(a.salaryDate).getTime() - new Date(b.salaryDate).getTime());
  }

  // Tax calculation helper methods for templates
  calculateAnnualTax(annualSalary: number): number {
    return this.taxConfigService.calculateAnnualTax(annualSalary, this.taxConfig.taxBrackets);
  }

  calculateMonthlyTax(annualSalary: number): number {
    return this.taxConfigService.calculateMonthlyTax(annualSalary, this.taxConfig.taxBrackets);
  }

  // Correct monthly tax calculation based on proportional share of total annual tax
  calculateCorrectMonthlyTax(entry: SalaryEntry, fy: FinancialYear): number {
    const monthlySalary = entry.salaryInLKR || 0;
    if (monthlySalary === 0) return 0;
    
    // Get cumulative salary up to this month (including this month)
    const cumulativeSalary = this.getCumulativeSalaryUpToMonth(entry, fy);
    
    // Get cumulative salary up to previous month (excluding this month)
    const previousCumulativeSalary = cumulativeSalary - monthlySalary;
    
    // Calculate tax on cumulative salary up to this month
    const cumulativeTax = this.calculateAnnualTax(cumulativeSalary);
    
    // Calculate tax on cumulative salary up to previous month
    const previousCumulativeTax = this.calculateAnnualTax(previousCumulativeSalary);
    
    // Monthly tax is the difference (additional tax due to this month's salary)
    return cumulativeTax - previousCumulativeTax;
  }

  getCumulativeSalaryUpToMonth(targetEntry: SalaryEntry, fy: FinancialYear): number {
    const targetDate = typeof targetEntry.salaryDate === 'string' ? new Date(targetEntry.salaryDate) : targetEntry.salaryDate;
    
    return this.getSalaryEntriesForFinancialYear(fy)
      .filter(entry => {
        const entryDate = typeof entry.salaryDate === 'string' ? new Date(entry.salaryDate) : entry.salaryDate;
        return entryDate <= targetDate;
      })
      .reduce((sum: number, entry: SalaryEntry) => sum + (entry.salaryInLKR || 0), 0);
  }

  getCumulativeTaxUpToMonth(targetEntry: SalaryEntry, fy: FinancialYear): number {
    const cumulativeSalary = this.getCumulativeSalaryUpToMonth(targetEntry, fy);
    return this.calculateAnnualTax(cumulativeSalary);
  }

  getTotalTaxForFinancialYear(fy: FinancialYear): number {
    return this.getSalaryEntriesForFinancialYear(fy).reduce((total: number, entry: SalaryEntry) => {
      return total + this.calculateCorrectMonthlyTax(entry, fy);
    }, 0);
  }

  getNetSalaryForFinancialYear(fy: FinancialYear): number {
    const totalSalary = this.getTotalSalaryForFinancialYear(fy);
    const totalTax = this.getTotalTaxForFinancialYear(fy);
    return totalSalary - totalTax;
  }

  // Get financial year for a specific entry
  getFinancialYearForEntry(entry: SalaryEntry): FinancialYear {
    const monthString = this.formatDateToMonthString(entry.taxableMonth);
    return this.taxConfigService.getFinancialYear(monthString);
  }

  calculateTaxBreakdown(salaryEntry: SalaryEntry): any[] {
    if (!salaryEntry.salaryInLKR) return [];
    const annualSalary = salaryEntry.salaryInLKR * 12;
    return this.taxConfigService.calculateDetailedTaxBreakdown(annualSalary, this.taxConfig.taxBrackets);
  }

  getAnnualSalaryFromEntry(entry: SalaryEntry): number {
    return (entry.salaryInLKR || 0) * 12;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2
    }).format(amount);
  }

  formatPercentage(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
  }

  getMonthName(monthNumber: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || '';
  }

  getDetailedTaxBreakdown(totalSalary: number) {
    return this.taxConfigService.calculateDetailedTaxBreakdown(totalSalary, this.taxConfig.taxBrackets);
  }

  getBracketSpecificTaxBreakdown(totalSalary: number) {
    const brackets = this.taxConfig.taxBrackets.sort((a, b) => a.minIncome - b.minIncome);
    const result = [];
    
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const rangeMin = bracket.minIncome;
      const rangeMax = bracket.maxIncome;
      
      // Calculate the taxable amount in this specific bracket
      let taxableInBracket = 0;
      
      if (totalSalary > rangeMin) {
        if (rangeMax === null) {
          // Highest bracket - no upper limit
          taxableInBracket = totalSalary - rangeMin;
        } else {
          // Middle brackets - has upper limit
          taxableInBracket = Math.min(totalSalary, rangeMax) - rangeMin;
        }
        taxableInBracket = Math.max(0, taxableInBracket);
      }
      
      const taxForThisBracket = taxableInBracket * bracket.taxRate;
      
      if (taxableInBracket > 0 || i === 0) { // Always show first bracket even if 0
        result.push({
          rangeMin: rangeMin,
          rangeMax: rangeMax,
          rate: bracket.taxRate,
          taxableAmount: taxableInBracket,
          tax: taxForThisBracket
        });
      }
    }
    
    return result;
  }

  trackBySalaryEntry(index: number, entry: SalaryEntry): string {
    return entry.id;
  }
}
