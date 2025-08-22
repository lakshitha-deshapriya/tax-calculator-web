import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService } from '../../services/exchange-rate-production.service';
import { TaxConfigService } from '../../services/tax-config.service';
import { ConfigurationService, InvestmentConfig, InvestmentMethod } from '../../services/configuration.service';
import { DataSyncService } from '../../services/data-sync.service';
import { TaxConfig, DistributionItem } from '../../models/tax-config.model';
import { TaxConfigurationComponent } from './tax-configuration/tax-configuration.component';
import { GoogleAuthService, User } from '../../services/google-auth.service';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TaxConfigurationComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  @Input() taxConfig!: TaxConfig;
  @Output() configChanged = new EventEmitter<void>();

  supportedCurrencies: { code: string, name: string }[] = [];
  
  // Section visibility toggles
  showBasicSettings: boolean = true;
  showIncomeDistribution: boolean = true;
  showInvestmentConfig: boolean = true;
  
  // EPF/ETF configuration
  epfRatePercentage: number = 8;
  etfRatePercentage: number = 3;
  
  // Distribution configuration
  newDistributionItem: Partial<DistributionItem> = {};
  isAddingDistributionItem: boolean = false;
  
  // Investment configuration
  investmentConfig: InvestmentConfig = {
    targetInvestmentCategories: [],
    investmentMethods: []
  };
  newInvestmentMethod: Partial<InvestmentMethod> = {};
  isAddingInvestmentMethod: boolean = false;

  // Firebase/Cloud sync status
  currentUser: User | null = null;
  syncStatus: 'idle' | 'saving' | 'loading' | 'error' = 'idle';
  lastSyncTime: Date | null = null;
  showCloudSyncInfo: boolean = false;
  
  // Individual section saving status
  savingStatus: {
    basic: boolean;
    tax: boolean;
    epfEtf: boolean;
    distribution: boolean;
    investment: boolean;
  } = {
    basic: false,
    tax: false,
    epfEtf: false,
    distribution: false,
    investment: false
  };

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService,
    private configService: ConfigurationService,
    private googleAuthService: GoogleAuthService,
    private firebaseService: FirebaseService,
    private dataSyncService: DataSyncService
  ) {}

  ngOnInit() {
    console.log('SettingsComponent initialized');
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();
    this.loadCurrentConfiguration();
    
    // Subscribe to user changes
    this.googleAuthService.user$.subscribe(user => {
      this.currentUser = user;
      if (user && !('isGuest' in user)) {
        // User is signed in with Google, try to load from Firebase
        this.loadFromCloudIfAvailable();
      }
    });
    
    // Subscribe to Firebase sync status
    this.firebaseService.syncStatus$.subscribe(status => {
      this.syncStatus = status;
    });
    
    // Subscribe to last sync time
    this.firebaseService.lastSync$.subscribe(time => {
      this.lastSyncTime = time;
    });
  }

  /**
   * Load current configuration values
   */
  loadCurrentConfiguration(): void {
    // Load EPF/ETF rates
    this.epfRatePercentage = this.configService.getEpfRatePercentage();
    this.etfRatePercentage = this.configService.getEtfRatePercentage();
    
    // Load investment configuration
    this.investmentConfig = this.configService.getInvestmentConfig();
    
    // Initialize new distribution item
    this.initNewDistributionItem();
    this.initNewInvestmentMethod();
  }

  onDefaultConfigChange(): void {
    this.saveTaxConfig();
    this.configChanged.emit();
  }

  saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
    console.log('Tax configuration saved');
    // Configurations are automatically synced to Firebase via ConfigurationService
  }

  // ========================================
  // FIREBASE/CLOUD SYNC METHODS
  // ========================================

  /**
   * Load configuration from Firebase if user is signed in
   */
  async loadFromCloudIfAvailable(): Promise<void> {
    try {
      const loaded = await this.configService.loadFromFirebaseIfSignedIn();
      if (loaded) {
        // Refresh local configuration display
        this.loadCurrentConfiguration();
        this.configChanged.emit();
        console.log('Configuration loaded from cloud');
      }
    } catch (error) {
      console.error('Error loading from cloud:', error);
    }
  }

  /**
   * Save basic configuration to Firebase
   */
  async saveBasicToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to save to cloud');
      return;
    }

    try {
      this.savingStatus.basic = true;
      await this.configService.saveBasicConfigurationToFirebase();
      console.log('Basic configuration saved to cloud');
    } catch (error) {
      console.error('Error saving basic configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.basic = false;
    }
  }

  /**
   * Save tax configuration to Firebase
   */
  async saveTaxToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to save to cloud');
      return;
    }

    try {
      this.savingStatus.tax = true;
      await this.configService.saveTaxConfigurationToFirebase();
      console.log('Tax configuration saved to cloud');
    } catch (error) {
      console.error('Error saving tax configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.tax = false;
    }
  }

  /**
   * Save EPF/ETF configuration to Firebase
   */
  async saveEPFETFToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to save to cloud');
      return;
    }

    try {
      this.savingStatus.epfEtf = true;
      // Save the current UI values directly instead of reading from TaxConfig
      await this.firebaseService.saveEPFETFConfiguration(this.epfRatePercentage, this.etfRatePercentage);
      console.log('EPF/ETF configuration saved to cloud');
    } catch (error) {
      console.error('Error saving EPF/ETF configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.epfEtf = false;
    }
  }

  /**
   * Save distribution configuration to Firebase
   */
  async saveDistributionToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to save to cloud');
      return;
    }

    try {
      this.savingStatus.distribution = true;
      await this.configService.saveDistributionConfigurationToFirebase();
      console.log('Distribution configuration saved to cloud');
    } catch (error) {
      console.error('Error saving distribution configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.distribution = false;
    }
  }

  /**
   * Save investment configuration to Firebase
   */
  async saveInvestmentToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to save to cloud');
      return;
    }

    try {
      this.savingStatus.investment = true;
      await this.configService.saveInvestmentConfigurationToFirebase();
      console.log('Investment configuration saved to cloud');
    } catch (error) {
      console.error('Error saving investment configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.investment = false;
    }
  }

  /**
   * Sync all data to cloud (comprehensive backup)
   */
  async syncAllToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to sync to cloud');
      return;
    }

    try {
      this.savingStatus = {
        basic: true,
        tax: true,
        epfEtf: true,
        distribution: true,
        investment: true
      };

      await this.dataSyncService.syncConfigurationToCloud(this.taxConfig);
      console.log('✅ All data synced to cloud');
      alert('All data synced to cloud successfully!');
      
    } catch (error) {
      console.error('❌ Failed to sync all data to cloud:', error);
      alert('Failed to sync to cloud. Please try again.');
    } finally {
      this.savingStatus = {
        basic: false,
        tax: false,
        epfEtf: false,
        distribution: false,
        investment: false
      };
    }
  }

  /**
   * Load all data from cloud
   */
  async loadAllFromCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to load from cloud');
      return;
    }

    if (!confirm('This will overwrite your current settings with data from cloud. Continue?')) {
      return;
    }

    try {
      this.savingStatus = {
        basic: true,
        tax: true,
        epfEtf: true,
        distribution: true,
        investment: true
      };

      const mergedConfig = await this.dataSyncService.syncFromCloudToLocal();
      if (mergedConfig) {
        // Update the taxConfig to reflect the merged data
        this.taxConfig = mergedConfig;
        this.loadCurrentConfiguration();
        this.configChanged.emit();
        console.log('✅ All data loaded from cloud');
        alert('Data loaded from cloud successfully!');
      } else {
        alert('No data found in cloud');
      }
      
    } catch (error) {
      console.error('❌ Failed to load data from cloud:', error);
      alert('Failed to load from cloud. Please try again.');
    } finally {
      this.savingStatus = {
        basic: false,
        tax: false,
        epfEtf: false,
        distribution: false,
        investment: false
      };
    }
  }

  /**
   * Check if Firebase is available and user is signed in
   */
  isCloudSyncAvailable(): boolean {
    return this.firebaseService.isAvailable();
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Toggle cloud sync info panel
   */
  toggleCloudSyncInfo(): void {
    this.showCloudSyncInfo = !this.showCloudSyncInfo;
  }

  /**
   * Get sync status display text
   */
  getSyncStatusText(): string {
    switch (this.syncStatus) {
      case 'saving':
        return 'Saving to cloud...';
      case 'loading':
        return 'Loading from cloud...';
      case 'error':
        return 'Sync error';
      case 'idle':
      default:
        if (this.lastSyncTime) {
          return `Last synced: ${this.lastSyncTime.toLocaleTimeString()}`;
        }
        return 'Ready';
    }
  }

  /**
   * Get sync status icon
   */
  getSyncStatusIcon(): string {
    switch (this.syncStatus) {
      case 'saving':
      case 'loading':
        return '⏳';
      case 'error':
        return '❌';
      case 'idle':
      default:
        if (this.isCloudSyncAvailable()) {
          return '☁️';
        }
        return '💾';
    }
  }

  // ========================================
  // EPF/ETF CONFIGURATION METHODS
  // ========================================

  onEpfRateChange(): void {
    this.configService.setEpfRatePercentage(this.epfRatePercentage);
    this.saveTaxConfig();
    this.configChanged.emit();
  }

  onEtfRateChange(): void {
    this.configService.setEtfRatePercentage(this.etfRatePercentage);
    this.saveTaxConfig();
    this.configChanged.emit();
  }

  // ========================================
  // DISTRIBUTION CONFIGURATION METHODS
  // ========================================

  initNewDistributionItem(): void {
    this.newDistributionItem = {
      category: '',
      percentage: 0,
      description: ''
    };
  }

  onAddDistributionItem(): void {
    if (!this.newDistributionItem.category || 
        !this.newDistributionItem.percentage || 
        !this.newDistributionItem.description) {
      alert('Please fill in all required fields');
      return;
    }

    this.configService.addDistributionItem({
      category: this.newDistributionItem.category!,
      percentage: this.newDistributionItem.percentage!,
      description: this.newDistributionItem.description!
    });

    // Update tax config to trigger UI refresh
    this.taxConfig.distributionItems = this.configService.getDistributionItems();
    this.saveTaxConfig();
    this.initNewDistributionItem();
    this.isAddingDistributionItem = false;
    this.configChanged.emit();
  }

  onUpdateDistributionItem(index: number, field: keyof DistributionItem, value: any): void {
    // Update the item directly instead of reassigning the entire array
    if (this.taxConfig.distributionItems[index]) {
      (this.taxConfig.distributionItems[index] as any)[field] = value;
      this.configService.updateDistributionItem(index, { [field]: value });
      this.saveTaxConfig();
      this.configChanged.emit();
    }
  }

  onDeleteDistributionItem(index: number): void {
    if (confirm('Are you sure you want to delete this distribution item?')) {
      this.configService.removeDistributionItem(index);
      this.taxConfig.distributionItems = this.configService.getDistributionItems();
      this.saveTaxConfig();
      this.configChanged.emit();
    }
  }

  onResetDistributionItems(): void {
    if (confirm('Are you sure you want to reset to default distribution items? This will remove all custom items.')) {
      this.configService.resetDistributionItemsToDefault();
      this.taxConfig.distributionItems = this.configService.getDistributionItems();
      this.saveTaxConfig();
      this.configChanged.emit();
    }
  }

  getTotalDistributionPercentage(): number {
    return this.configService.getTotalDistributionPercentage();
  }

  isDistributionPercentageValid(): boolean {
    return this.configService.isDistributionPercentageValid();
  }

  // ========================================
  // INVESTMENT CONFIGURATION METHODS
  // ========================================

  initNewInvestmentMethod(): void {
    this.newInvestmentMethod = {
      name: '',
      percentage: 0,
      description: ''
    };
  }

  onAddInvestmentMethod(): void {
    if (!this.newInvestmentMethod.name || 
        !this.newInvestmentMethod.percentage || 
        !this.newInvestmentMethod.description) {
      alert('Please fill in all required fields');
      return;
    }

    this.configService.addInvestmentMethod({
      name: this.newInvestmentMethod.name!,
      percentage: this.newInvestmentMethod.percentage!,
      description: this.newInvestmentMethod.description!
    });

    this.investmentConfig = this.configService.getInvestmentConfig();
    this.initNewInvestmentMethod();
    this.isAddingInvestmentMethod = false;
    this.configChanged.emit();
  }

  onUpdateInvestmentMethod(methodId: string, field: keyof InvestmentMethod, value: any): void {
    // Find and update the method directly instead of reassigning the entire config
    const method = this.investmentConfig.investmentMethods.find(m => m.id === methodId);
    if (method) {
      (method as any)[field] = value;
      this.configService.updateInvestmentMethod(methodId, { [field]: value });
      this.configChanged.emit();
    }
  }

  onDeleteInvestmentMethod(methodId: string): void {
    if (confirm('Are you sure you want to delete this investment method?')) {
      this.configService.removeInvestmentMethod(methodId);
      this.investmentConfig = this.configService.getInvestmentConfig();
      this.configChanged.emit();
    }
  }

  onToggleCategorySelection(category: string): void {
    this.configService.toggleInvestmentCategory(category);
    this.investmentConfig = this.configService.getInvestmentConfig();
    this.configChanged.emit();
  }

  getTotalInvestmentMethodPercentage(): number {
    return this.configService.getTotalInvestmentMethodPercentage();
  }

  isInvestmentMethodPercentageValid(): boolean {
    return this.configService.isInvestmentMethodPercentageValid();
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  onResetAllToDefault(): void {
    if (confirm('Are you sure you want to reset ALL settings to default? This will remove all custom configurations.')) {
      this.configService.resetAllToDefault();
      this.taxConfig = this.taxConfigService.loadTaxConfig() || this.taxConfigService.getDefaultTaxConfig();
      this.loadCurrentConfiguration();
      this.configChanged.emit();
    }
  }

  getColorClass(index: number): string {
    const colors = ['red', 'blue', 'green', 'orange', 'purple'];
    return colors[index % colors.length];
  }
}
