import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService } from '../../services/exchange-rate-production.service';
import { TaxConfigService } from '../../services/tax-config.service';
import { ConfigurationService, InvestmentConfig, InvestmentMethod } from '../../services/configuration.service';
import { DataSyncService } from '../../services/data-sync.service';
import { UnifiedStorageService } from '../../services/unified-storage.service';
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
    epfEtfDistribution: boolean;
    investment: boolean;
    resetAll: boolean;
  } = {
    basic: false,
    tax: false,
    epfEtfDistribution: false,
    investment: false,
    resetAll: false
  };

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService,
    private configService: ConfigurationService,
    private googleAuthService: GoogleAuthService,
    private firebaseService: FirebaseService,
    private dataSyncService: DataSyncService,
    private unifiedStorageService: UnifiedStorageService
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('SettingsComponent initialized');
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();
    await this.loadCurrentConfiguration();
    
    // Subscribe to user changes
    this.googleAuthService.user$.subscribe(user => {
      this.currentUser = user;
      // Note: We don't call loadFromCloudIfAvailable() anymore
      // The UnifiedStorageService handles caching and will load from session/cloud as needed
      // Data loading happens in loadCurrentConfiguration() which uses UnifiedStorageService
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
  async loadCurrentConfiguration(): Promise<void> {
    // Load tax config from unified storage to get EPF/ETF rates
    const taxConfig = await this.unifiedStorageService.loadTaxConfig();
    if (taxConfig) {
      this.epfRatePercentage = (taxConfig.epfRate || 0.08) * 100; // Convert decimal to percentage
      this.etfRatePercentage = (taxConfig.etfRate || 0.03) * 100; // Convert decimal to percentage
    } else {
      // Fallback to default values
      this.epfRatePercentage = 8;
      this.etfRatePercentage = 3;
    }
    
    // Load investment configuration - this still uses ConfigurationService for now
    // TODO: Move investment config to unified storage in future
    this.investmentConfig = this.configService.getInvestmentConfig();
    
    // Initialize new distribution item
    this.initNewDistributionItem();
    this.initNewInvestmentMethod();
  }

  onDefaultConfigChange(): void {
    this.saveTaxConfig();
    this.configChanged.emit();
  }

  async saveTaxConfig(): Promise<void> {
    try {
      await this.unifiedStorageService.saveTaxConfig(this.taxConfig);
      const storageMode = this.unifiedStorageService.getStorageMode();
      console.log(`Tax configuration saved via ${storageMode}`);
    } catch (error) {
      console.error('Failed to save tax configuration:', error);
    }
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
   * Save EPF/ETF and Distribution configuration to Firebase (combined)
   */
  async saveEPFETFAndDistributionToCloud(): Promise<void> {
    if (!this.isCloudSyncAvailable()) {
      alert('Please sign in to save to cloud');
      return;
    }

    try {
      this.savingStatus.epfEtfDistribution = true;
      
      // Save EPF/ETF configuration
      await this.firebaseService.saveEPFETFConfiguration(this.epfRatePercentage, this.etfRatePercentage);
      
      // Save distribution configuration
      await this.configService.saveDistributionConfigurationToFirebase();
      
      console.log('EPF/ETF and Distribution configuration saved to cloud');
    } catch (error) {
      console.error('Error saving EPF/ETF and Distribution configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.epfEtfDistribution = false;
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
      this.savingStatus.epfEtfDistribution = true;
      // Save the current UI values directly instead of reading from TaxConfig
      await this.firebaseService.saveEPFETFConfiguration(this.epfRatePercentage, this.etfRatePercentage);
      console.log('EPF/ETF configuration saved to cloud');
    } catch (error) {
      console.error('Error saving EPF/ETF configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.epfEtfDistribution = false;
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
      this.savingStatus.epfEtfDistribution = true;
      await this.configService.saveDistributionConfigurationToFirebase();
      console.log('Distribution configuration saved to cloud');
    } catch (error) {
      console.error('Error saving distribution configuration to cloud:', error);
      alert('Failed to save to cloud. Please try again.');
    } finally {
      this.savingStatus.epfEtfDistribution = false;
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

  /**
   * Reset all configurations to default and save to cloud
   */
  async resetAllToDefault(): Promise<void> {
    if (!confirm('Are you sure you want to reset ALL settings to default? This will overwrite all your custom configurations.')) {
      return;
    }

    try {
      this.savingStatus.resetAll = true;
      
      // Reset to default values
      this.taxConfig.defaultSalaryDate = '01';
      this.taxConfig.defaultCurrency = 'LKR';
      this.epfRatePercentage = 8;
      this.etfRatePercentage = 3;
      
      // Reset tax brackets to default
      this.taxConfig.taxBrackets = this.taxConfigService.getDefaultTaxBrackets();
      
      // Reset distribution items to default
      this.taxConfig.distributionItems = this.taxConfigService.getDefaultDistributionItems();
      
      // Reset investment configuration to default
      const currentConfig = this.configService.getInvestmentConfig();
      currentConfig.targetInvestmentCategories = [];
      currentConfig.investmentMethods = [];
      this.configService.setInvestmentConfig(currentConfig);
      this.investmentConfig = this.configService.getInvestmentConfig();
      
      // Save all configurations locally first
      this.taxConfigService.saveTaxConfig(this.taxConfig);
      
      // Save to cloud if available
      if (this.isCloudSyncAvailable()) {
        await Promise.all([
          this.configService.saveBasicConfigurationToFirebase(),
          this.configService.saveTaxConfigurationToFirebase(),
          this.firebaseService.saveEPFETFConfiguration(this.epfRatePercentage, this.etfRatePercentage),
          this.configService.saveDistributionConfigurationToFirebase(),
          this.configService.saveInvestmentConfigurationToFirebase()
        ]);
        console.log('All configurations reset to default and saved to cloud');
      } else {
        console.log('All configurations reset to default (local only)');
      }
      
      // Emit change event to update parent components
      this.configChanged.emit();
      
      alert('All settings have been reset to default values!');
      
    } catch (error) {
      console.error('Error resetting configurations:', error);
      alert('Failed to reset configurations. Please try again.');
    } finally {
      this.savingStatus.resetAll = false;
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================



  getColorClass(index: number): string {
    const colors = ['red', 'blue', 'green', 'orange', 'purple'];
    return colors[index % colors.length];
  }
}
