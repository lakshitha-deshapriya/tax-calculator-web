import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateService, ExchangeRateData } from './services/exchange-rate.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Tax Calculator Web';
  
  selectedDate: string = '';
  selectedCurrency: string = 'USD';
  exchangeRateData: ExchangeRateData | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  supportedCurrencies: { code: string, name: string }[] = [];

  constructor(private exchangeRateService: ExchangeRateService) {}

  ngOnInit() {
    console.log('AppComponent initialized');
    // Set default date to today
    const today = new Date();
    this.selectedDate = this.formatDateForInput(today);
    
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();
    console.log('Supported currencies loaded:', this.supportedCurrencies.length);
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
}
