import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService } from './services/exchange-rate-production.service';
import { TaxConfigService } from './services/tax-config.service';
import { TaxConfig } from './models/tax-config.model';
import { ExchangeRateComponent } from './components/exchange-rate/exchange-rate.component';
import { SettingsComponent } from './components/settings/settings.component';
import { SalaryManagementComponent } from './components/salary-management/salary-management.component';
import { TaxCalculatorComponent } from './components/tax-calculator/tax-calculator.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, ExchangeRateComponent, SettingsComponent, SalaryManagementComponent, TaxCalculatorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Foreign Income Tax Calculator';

  // Tax calculator related properties
  taxConfig: TaxConfig;
  activeTab: 'settings' | 'salary' | 'calculator' | 'exchange' = 'settings';

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
  }

  onConfigChanged(): void {
    console.log('Tax configuration updated');
  }
}
