import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ExchangeRateProductionService as ExchangeRateService } from './services/exchange-rate-production.service';
import { TaxConfigService } from './services/tax-config.service';
import { DataSyncService } from './services/data-sync.service';
import { UnifiedStorageService } from './services/unified-storage.service';
import { GoogleAuthService, User } from './services/google-auth.service';
import { TaxConfig } from './models/tax-config.model';
import { SettingsComponent } from './components/settings/settings.component';
import { SalaryManagementComponent } from './components/salary-management/salary-management.component';
import { TaxCalculatorComponent } from './components/tax-calculator/tax-calculator.component';
import { SalaryDistributionComponent } from './components/salary-distribution/salary-distribution.component';
import { LoginComponent } from './components/login/login.component';
import { ClickOutsideDirective } from './directives/click-outside.directive';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, SettingsComponent, SalaryManagementComponent, TaxCalculatorComponent, SalaryDistributionComponent, LoginComponent, ClickOutsideDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  title = 'Foreign Income Tax Calculator';

  // Tax calculator related properties
  taxConfig: TaxConfig;
  activeTab: 'settings' | 'salary' | 'calculator' | 'distribution' = 'settings';
  
  // User authentication properties
  currentUser: User | null = null;
  isSignedIn = false;
  isAdmin = false;
  isGuestUser = false;
  showInitialLogin = true;
  showProfileDropdown = false;
  isLoadingFromCloud = false;
  private userSubscription?: Subscription;
  private buttonRenderAttempts = 0;
  private readonly maxButtonRenderAttempts = 10;

  @ViewChild(TaxCalculatorComponent) taxCalculatorComponent?: TaxCalculatorComponent;
  @ViewChild('googleSignInButton') googleSignInButton?: ElementRef;

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService,
    private dataSyncService: DataSyncService,
    private unifiedStorageService: UnifiedStorageService,
    private googleAuthService: GoogleAuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Initialize with empty config - will be loaded in ngOnInit based on user status
    this.taxConfig = this.getEmptyTaxConfig();
  }

  ngOnInit() {
    console.log('AppComponent initialized');
    
    // Initialize tax config based on user status
    this.initializeTaxConfig();
    
    // Check if we should show initial login
    this.showInitialLogin = this.googleAuthService.shouldShowInitialLogin();
    
    // Subscribe to user authentication state
    this.userSubscription = this.googleAuthService.user$.subscribe(user => {
      console.log('User state changed:', user);
      const wasAdmin = this.isAdmin;
      
      this.currentUser = user;
      this.isSignedIn = !!user;
      this.isGuestUser = this.googleAuthService.isGuestUser();
      this.isAdmin = user?.email === 'lakshithadeshapriya@gmail.com' && !this.isGuestUser;
      
      // Hide login screen when user signs in or continues as guest
      if (user) {
        this.showInitialLogin = false;
        
        // Reload tax config with new storage strategy
        this.initializeTaxConfig();
        
        // Auto-sync data from cloud when user signs in (but not for guest users)
        if (!('isGuest' in user)) {
          console.log('User signed in - initiating comprehensive cloud sync...');
          // Small delay to ensure Firebase is fully initialized
          setTimeout(() => {
            this.performAutoSyncOnSignIn();
          }, 1000);
        }
      }
      
      console.log('User info:', {
        isSignedIn: this.isSignedIn,
        isGuestUser: this.isGuestUser,
        isAdmin: this.isAdmin,
        email: user?.email
      });
      
      console.log('Admin status:', this.isAdmin, 'Was admin:', wasAdmin);
      
      // If user signs out and was viewing admin tab, switch to settings
      if (!this.isSignedIn && this.activeTab === 'distribution') {
        this.activeTab = 'settings';
      }

      // If user just became admin and was on settings, optionally suggest distribution tab
      if (this.isAdmin && !wasAdmin && this.activeTab === 'settings') {
        console.log('User just became admin - Salary Distribution tab is now available');
        
        // Small delay to ensure UI is fully updated before allowing tab switches
        setTimeout(() => {
          console.log('Admin tab is now ready for interaction');
        }, 200);
      }

      // Trigger change detection to update the UI immediately
      this.cdr.detectChanges();

      // Additional verification for profile button availability
      if (this.isSignedIn && this.currentUser) {
        console.log('User signed in - profile button should now be available');
        // Use NgZone to ensure proper change detection and event binding
        this.ngZone.run(() => {
          // Small delay to ensure DOM is fully updated and event handlers are bound
          setTimeout(() => {
            const profileButton = document.querySelector('.profile-btn') as HTMLButtonElement;
            console.log('Profile button found in DOM:', !!profileButton);
            if (profileButton) {
              console.log('Profile button is clickable:', !profileButton.hasAttribute('disabled'));
              // Test if the button is actually clickable by adding a temporary event listener
              const testClick = () => {
                console.log('Profile button test click registered - button is working!');
                profileButton.removeEventListener('click', testClick);
              };
              profileButton.addEventListener('click', testClick, { once: true });
            } else {
              console.warn('Profile button not found after sign-in, forcing change detection');
              this.cdr.detectChanges();
            }
          }, 150);
        });
      }

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
    
    // Show login screen again
    this.showInitialLogin = true;
    
    // Reset any initialized flags
    const buttonContainers = document.querySelectorAll('.google-signin-wrapper');
    buttonContainers.forEach(container => {
      container.setAttribute('data-initialized', 'false');
      container.innerHTML = ''; // Clear any existing content
    });
    
    // Force change detection and re-render sign-in button
    this.cdr.detectChanges();
  }

  toggleProfileDropdown(): void {
    console.log('Profile button clicked! Current state:', this.showProfileDropdown);
    console.log('User signed in:', this.isSignedIn, 'Current user:', this.currentUser?.email);
    
    // Use NgZone to ensure proper event handling
    this.ngZone.run(() => {
      this.showProfileDropdown = !this.showProfileDropdown;
      
      // Force change detection to ensure the dropdown state updates immediately
      this.cdr.detectChanges();
      
      console.log('Profile dropdown state after toggle:', this.showProfileDropdown);
      
      // Additional DOM check
      setTimeout(() => {
        const dropdownMenu = document.querySelector('.dropdown-menu');
        console.log('Dropdown menu in DOM:', !!dropdownMenu);
        if (this.showProfileDropdown && !dropdownMenu) {
          console.warn('Dropdown should be visible but not found in DOM, forcing another change detection');
          this.cdr.detectChanges();
        }
      }, 50);
    });
  }

  closeProfileDropdown(): void {
    console.log('Closing profile dropdown');
    this.showProfileDropdown = false;
    
    // Force change detection
    this.cdr.detectChanges();
  }

  setActiveTab(tab: 'settings' | 'salary' | 'calculator' | 'distribution'): void {
    console.log('Setting active tab to:', tab);
    console.log('Current admin status:', this.isAdmin);
    console.log('Current user:', this.currentUser?.email);
    
    // Special handling for distribution tab
    if (tab === 'distribution' && !this.isAdmin) {
      console.warn('Cannot switch to distribution tab - user is not admin');
      return;
    }
    
    this.activeTab = tab;
    
    // Force change detection to ensure the UI updates immediately
    this.cdr.detectChanges();
    
    // Additional logging for debugging
    console.log('Active tab is now:', this.activeTab);
    
    // Additional check specifically for distribution tab
    if (tab === 'distribution') {
      console.log('Distribution tab selected. Admin check:', this.isAdmin);
      // Use a more robust approach to check for the component
      setTimeout(() => {
        const distributionElement = document.querySelector('app-salary-distribution');
        console.log('Distribution component found in DOM:', !!distributionElement);
        if (!distributionElement) {
          console.warn('Distribution component not found, forcing another change detection cycle');
          this.cdr.detectChanges();
        }
      }, 100);
    }
  }

  isDistributionTabVisible(): boolean {
    const isVisible = this.activeTab === 'distribution' && this.isAdmin;
    console.log('Distribution tab visibility check:', {
      activeTab: this.activeTab,
      isAdmin: this.isAdmin,
      isVisible: isVisible,
      currentUserEmail: this.currentUser?.email
    });
    return isVisible;
  }

  // Helper method to ensure tab switching works properly
  canSwitchToDistributionTab(): boolean {
    return this.isSignedIn && this.isAdmin;
  }

  onConfigChanged(): void {
    console.log('Tax configuration updated');
    // Update tax calculator when config changes
    if (this.taxCalculatorComponent) {
      this.taxCalculatorComponent.onTaxConfigChange();
    }
  }

  onContinueAsGuest(): void {
    console.log('User chose to continue as guest');
    this.googleAuthService.continueAsGuest();
  }

  getUserDisplayName(): string {
    if (!this.currentUser) return '';
    return this.isGuestUser ? 'Guest User' : this.currentUser.name;
  }

  getUserStatusText(): string {
    if (this.isGuestUser) {
      return 'Signed in as Guest (Local Storage)';
    }
    if (this.isSignedIn) {
      return 'Signed in with Google (Online Storage)';
    }
    return '';
  }

  /**
   * Get empty tax config for initialization
   */
  private getEmptyTaxConfig(): TaxConfig {
    return {
      defaultSalaryDate: '01',
      defaultCurrency: 'USD',
      salaryEntries: [],
      taxBrackets: [],
      epfRate: 0.08,
      etfRate: 0.03,
      distributionItems: []
    };
  }

  /**
   * Initialize tax config using unified storage service
   */
  private async initializeTaxConfig(): Promise<void> {
    try {
      console.log('🔄 Initializing tax config with unified storage...');
      const config = await this.unifiedStorageService.loadTaxConfig();
      if (config) {
        this.taxConfig = config;
        this.cdr.detectChanges();
        console.log('✅ Tax config loaded via unified storage');
      }
    } catch (error) {
      console.error('❌ Failed to initialize tax config:', error);
      // Keep the empty config as fallback
    }
  }

  /**
   * Perform comprehensive auto-sync when user signs in
   */
  private async performAutoSyncOnSignIn(): Promise<void> {
    try {
      console.log('🔄 Starting automatic cloud sync...');
      
      // Show loading state
      this.isLoadingFromCloud = true;
      this.cdr.detectChanges();
      
      // Clear session storage to force fresh load from cloud
      this.unifiedStorageService.clearSessionStorage();
      
      // Load fresh data from cloud using unified storage
      const mergedConfig = await this.unifiedStorageService.forceReloadFromCloud();
      
      if (mergedConfig) {
        // Update the app's tax config
        this.taxConfig = mergedConfig;
        
        // Force change detection to update child components
        this.cdr.detectChanges();
        
        // Emit configuration changed to all child components
        this.onConfigChanged();
        
        console.log('✅ Automatic cloud sync completed successfully');
        console.log('📊 Updated data:', {
          salaryEntries: mergedConfig.salaryEntries.length,
          distributionItems: mergedConfig.distributionItems.length,
          defaultCurrency: mergedConfig.defaultCurrency,
          defaultSalaryDate: mergedConfig.defaultSalaryDate,
          storageMode: this.unifiedStorageService.getStorageMode()
        });
        
        // Show success message briefly
        setTimeout(() => {
          console.log('🎉 Your data has been synced from the cloud!');
        }, 500);
        
      } else {
        console.log('📱 No cloud data found, continuing with defaults');
      }
      
    } catch (error) {
      console.error('❌ Automatic cloud sync failed:', error);
    } finally {
      // Hide loading state
      this.isLoadingFromCloud = false;
      this.cdr.detectChanges();
    }
  }
}
