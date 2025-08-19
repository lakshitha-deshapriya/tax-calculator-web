import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ExchangeRateProductionService as ExchangeRateService } from './services/exchange-rate-production.service';
import { TaxConfigService } from './services/tax-config.service';
import { GoogleAuthService, GoogleUser } from './services/google-auth.service';
import { TaxConfig } from './models/tax-config.model';
import { ExchangeRateComponent } from './components/exchange-rate/exchange-rate.component';
import { SettingsComponent } from './components/settings/settings.component';
import { SalaryManagementComponent } from './components/salary-management/salary-management.component';
import { TaxCalculatorComponent } from './components/tax-calculator/tax-calculator.component';
import { SalaryDistributionComponent } from './components/salary-distribution/salary-distribution.component';
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { DebugPanelComponent } from './components/debug-panel/debug-panel.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, ExchangeRateComponent, SettingsComponent, SalaryManagementComponent, TaxCalculatorComponent, SalaryDistributionComponent, ClickOutsideDirective, DebugPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Foreign Income Tax Calculator';

  // Tax calculator related properties
  taxConfig: TaxConfig;
  activeTab: 'settings' | 'salary' | 'calculator' | 'exchange' | 'distribution' = 'settings';
  
  // User authentication properties
  currentUser: GoogleUser | null = null;
  isSignedIn = false;
  isAdmin = false;
  showProfileDropdown = false;
  private userSubscription?: Subscription;

  @ViewChild(TaxCalculatorComponent) taxCalculatorComponent?: TaxCalculatorComponent;

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService,
    private googleAuthService: GoogleAuthService
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
    
    // Subscribe to user authentication state
    this.userSubscription = this.googleAuthService.user$.subscribe(user => {
      this.currentUser = user;
      this.isSignedIn = !!user;
      this.isAdmin = user?.email === 'lakshithadeshapriya@gmail.com';
      
      // If user signs out and was viewing admin tab, switch to settings
      if (!this.isSignedIn && this.activeTab === 'distribution') {
        this.activeTab = 'settings';
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  signIn(): void {
    this.googleAuthService.signIn();
  }

  signOut(): void {
    this.googleAuthService.signOut();
    this.showProfileDropdown = false;
  }

  toggleProfileDropdown(): void {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  closeProfileDropdown(): void {
    this.showProfileDropdown = false;
  }

  onConfigChanged(): void {
    console.log('Tax configuration updated');
    // Update tax calculator when config changes
    if (this.taxCalculatorComponent) {
      this.taxCalculatorComponent.onTaxConfigChange();
    }
  }
}
