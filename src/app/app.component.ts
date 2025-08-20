import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
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
  private buttonRenderAttempts = 0;
  private readonly maxButtonRenderAttempts = 10;

  @ViewChild(TaxCalculatorComponent) taxCalculatorComponent?: TaxCalculatorComponent;
  @ViewChild('googleSignInButton') googleSignInButton?: ElementRef;

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService,
    private googleAuthService: GoogleAuthService,
    private cdr: ChangeDetectorRef
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
      console.log('User state changed:', user);
      this.currentUser = user;
      this.isSignedIn = !!user;
      this.isAdmin = user?.email === 'lakshithadeshapriya@gmail.com';
      
      // If user signs out and was viewing admin tab, switch to settings
      if (!this.isSignedIn && this.activeTab === 'distribution') {
        this.activeTab = 'settings';
      }

      // Trigger change detection to update the UI immediately
      this.cdr.detectChanges();

      // Re-render Google button when sign-in state changes to signed out
      if (!this.isSignedIn) {
        console.log('User signed out, re-rendering sign-in button');
        this.renderSignInButtonWithDelay();
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  ngAfterViewInit() {
    // Render Google Sign-In button after view initialization
    console.log('AfterViewInit: Rendering initial sign-in button');
    this.renderSignInButtonWithDelay();
  }

  private renderSignInButtonWithDelay(): void {
    // Use multiple timeouts to ensure the ViewChild is available and DOM is ready
    setTimeout(() => {
      this.tryRenderSignInButton();
    }, 100);
  }

  private tryRenderSignInButton(retryCount: number = 0): void {
    const maxRetries = Math.min(this.maxButtonRenderAttempts, 5);
    
    if (this.isSignedIn) {
      // Don't render if user is already signed in
      return;
    }
    
    // First try with ViewChild
    if (this.googleSignInButton && this.googleSignInButton.nativeElement) {
      console.log('Rendering sign-in button via ViewChild');
      this.googleAuthService.renderSignInButton(this.googleSignInButton.nativeElement);
      this.buttonRenderAttempts++;
      return;
    }
    
    // Fallback: Query the DOM directly
    const buttonContainer = document.querySelector('.google-signin-wrapper:not([data-initialized="true"])') as HTMLElement;
    if (buttonContainer) {
      console.log('Rendering sign-in button via DOM query');
      buttonContainer.setAttribute('data-initialized', 'true');
      this.googleAuthService.renderSignInButton(buttonContainer);
      this.buttonRenderAttempts++;
      return;
    }
    
    // Retry if neither method worked and we haven't exceeded max retries
    if (retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1}/${maxRetries} for sign-in button rendering`);
      setTimeout(() => {
        this.tryRenderSignInButton(retryCount + 1);
      }, 200 * (retryCount + 1)); // Increasing delay
    } else if (retryCount >= maxRetries) {
      console.warn('Failed to render sign-in button after maximum retries');
    }
  }

  signIn(): void {
    this.googleAuthService.signIn();
  }

  signOut(): void {
    console.log('Sign out initiated');
    this.googleAuthService.signOut();
    this.showProfileDropdown = false;
    this.buttonRenderAttempts = 0; // Reset counter for fresh attempts
    
    // Reset any initialized flags
    const buttonContainers = document.querySelectorAll('.google-signin-wrapper');
    buttonContainers.forEach(container => {
      container.setAttribute('data-initialized', 'false');
      container.innerHTML = ''; // Clear any existing content
    });
    
    // Force change detection and re-render sign-in button
    this.cdr.detectChanges();
    
    // Additional delay to ensure DOM is updated after *ngIf changes
    setTimeout(() => {
      this.renderSignInButtonWithDelay();
    }, 50);
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
