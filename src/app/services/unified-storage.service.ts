import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GoogleAuthService, User } from './google-auth.service';
import { FirebaseService } from './firebase.service';
import { TaxConfig, SalaryEntry, TaxBracket, DistributionItem } from '../models/tax-config.model';
import { InvestmentConfig } from './configuration.service';

export type StorageMode = 'cloud-session' | 'local' | 'guest';

export interface InvestmentEntry {
  id: string;
  methodId: string;
  amount: number;
  investmentDate: Date;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UnifiedStorageService {
  private readonly SESSION_KEY = 'tax-calculator-session-config';
  private readonly LOCAL_KEY = 'tax-calculator-config';
  private readonly INVESTMENT_SESSION_KEY = 'tax-calculator-session-investments';
  private readonly INVESTMENT_LOCAL_KEY = 'tax-calculator-investments';
  private readonly INVESTMENT_CONFIG_SESSION_KEY = 'tax-calculator-session-investment-config';
  private readonly INVESTMENT_CONFIG_LOCAL_KEY = 'investment-config';
  
  private storageMode: StorageMode = 'guest';
  private currentUser: User | null = null;
  
  // Observable for storage mode changes
  private storageModeSubject = new BehaviorSubject<StorageMode>('guest');
  public storageMode$ = this.storageModeSubject.asObservable();
  
  // Observable for data changes
  private dataChangedSubject = new BehaviorSubject<TaxConfig | null>(null);
  public dataChanged$ = this.dataChangedSubject.asObservable();

  constructor(
    private googleAuthService: GoogleAuthService,
    private firebaseService: FirebaseService
  ) {
    // Subscribe to user authentication changes
    this.googleAuthService.user$.subscribe(user => {
      this.currentUser = user;
      this.updateStorageMode();
    });
  }

  /**
   * Update storage mode based on current user status
   */
  private updateStorageMode(): void {
    if (!this.currentUser) {
      this.storageMode = 'guest';
    } else if ('isGuest' in this.currentUser) {
      this.storageMode = 'local';
    } else {
      this.storageMode = 'cloud-session';
    }
    
    this.storageModeSubject.next(this.storageMode);
    console.log('🔄 Storage mode updated:', this.storageMode);
  }

  /**
   * Get current storage mode
   */
  getStorageMode(): StorageMode {
    return this.storageMode;
  }

  /**
   * Save tax configuration using appropriate storage strategy
   */
  async saveTaxConfig(config: TaxConfig): Promise<void> {
    try {
      switch (this.storageMode) {
        case 'cloud-session':
          // For signed-in users: Save to cloud first, then to session storage
          await this.saveToCloudAndSession(config);
          break;
          
        case 'local':
          // For guest users: Save to localStorage
          this.saveToLocalStorage(config);
          break;
          
        case 'guest':
          // For not signed-in users: Save to localStorage
          this.saveToLocalStorage(config);
          break;
      }
      
      // Notify observers of data change
      this.dataChangedSubject.next(config);
      
    } catch (error) {
      console.error('❌ Failed to save tax config:', error);
      throw error;
    }
  }

  /**
   * Load tax configuration using appropriate storage strategy
   */
  async loadTaxConfig(): Promise<TaxConfig | null> {
    console.log(`📋 UnifiedStorageService: loadTaxConfig() called with mode: ${this.storageMode}`);
    try {
      let config: TaxConfig | null = null;
      
      switch (this.storageMode) {
        case 'cloud-session':
          // For signed-in users: Load from cloud and cache in session
          config = await this.loadFromCloudAndCache();
          break;
          
        case 'local':
        case 'guest':
          // For guest users: Load from localStorage
          console.log('📋 Loading from localStorage for guest/local mode');
          config = this.loadFromLocalStorage();
          break;
      }
      
      // Ensure config has default values
      if (config) {
        config = this.ensureDefaultValues(config);
      } else {
        config = this.getDefaultTaxConfig();
      }
      
      return config;
      
    } catch (error) {
      console.error('❌ Failed to load tax config:', error);
      // Fallback to localStorage or default config
      return this.loadFromLocalStorage() || this.getDefaultTaxConfig();
    }
  }

  /**
   * Save salary entry using appropriate storage strategy
   */
  async saveSalaryEntry(salaryEntry: SalaryEntry, taxConfig: TaxConfig): Promise<void> {
    // Add salary entry to config
    taxConfig.salaryEntries.push(salaryEntry);
    
    // Save using unified strategy
    await this.saveTaxConfig(taxConfig);
  }

  /**
   * Update salary entries using appropriate storage strategy
   */
  async updateSalaryEntries(salaryEntries: SalaryEntry[], taxConfig: TaxConfig): Promise<void> {
    // Update salary entries in config
    taxConfig.salaryEntries = salaryEntries;
    
    // Save using unified strategy
    await this.saveTaxConfig(taxConfig);
  }

  /**
   * Load salary entries from appropriate storage
   */
  async loadSalaryEntries(): Promise<SalaryEntry[]> {
    const config = await this.loadTaxConfig();
    return config?.salaryEntries || [];
  }

  /**
   * Save to cloud first, then cache in session storage
   */
  private async saveToCloudAndSession(config: TaxConfig): Promise<void> {
    if (!this.firebaseService.isAvailable()) {
      throw new Error('Firebase not available for cloud storage');
    }

    console.log('💾 Saving to cloud and session storage...');
    
    // Save to cloud first
    await Promise.all([
      this.firebaseService.saveBasicConfiguration(config.defaultSalaryDate, config.defaultCurrency),
      this.firebaseService.saveTaxConfiguration(config.taxBrackets),
      this.firebaseService.saveEPFETFConfiguration(config.epfRate, config.etfRate),
      this.firebaseService.saveDistributionConfiguration(config.distributionItems),
      this.firebaseService.saveSalaryData(config.salaryEntries)
    ]);
    
    // Cache in session storage for fast access
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(config));
    
    console.log('✅ Saved to cloud and cached in session');
  }

  /**
   * Load from cloud and cache in session storage
   */
  private async loadFromCloudAndCache(): Promise<TaxConfig | null> {
    try {
      // First, try to get from session storage (fast)
      const cached = sessionStorage.getItem(this.SESSION_KEY);
      if (cached) {
        console.log('🚀 Loading from session cache');
        const config = JSON.parse(cached);
        return this.parseConfigDates(config);
      }
      
      // If not in session, load from cloud
      if (!this.firebaseService.isAvailable()) {
        console.log('Firebase not available, falling back to localStorage');
        return this.loadFromLocalStorage();
      }
      
      console.log('☁️ Loading from cloud...');
      const cloudData = await this.firebaseService.loadAllConfigurations();
      
      if (cloudData.basic || cloudData.tax || cloudData.epfEtf || cloudData.distribution || cloudData.salaries) {
        const config = this.mergeCloudDataToConfig(cloudData);
        
        // Cache in session storage
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(config));
        
        console.log('✅ Loaded from cloud and cached in session');
        return config;
      }
      
      console.log('No cloud data found');
      return null;
      
    } catch (error) {
      console.error('❌ Failed to load from cloud:', error);
      // Fallback to localStorage
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(config: TaxConfig): void {
    localStorage.setItem(this.LOCAL_KEY, JSON.stringify(config));
    console.log('💾 Saved to localStorage');
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(): TaxConfig | null {
    try {
      const stored = localStorage.getItem(this.LOCAL_KEY);
      if (stored) {
        console.log('📱 Loading from localStorage');
        const config = JSON.parse(stored);
        return this.parseConfigDates(config);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Merge cloud data into TaxConfig format
   */
  private mergeCloudDataToConfig(cloudData: any): TaxConfig {
    const config: TaxConfig = this.getDefaultTaxConfig();

    if (cloudData.basic) {
      config.defaultSalaryDate = cloudData.basic.defaultSalaryDate;
      config.defaultCurrency = cloudData.basic.defaultCurrency;
    }

    if (cloudData.tax) {
      config.taxBrackets = cloudData.tax.taxBrackets;
    }

    if (cloudData.epfEtf) {
      config.epfRate = cloudData.epfEtf.epfRatePercentage / 100; // Convert percentage to decimal
      config.etfRate = cloudData.epfEtf.etfRatePercentage / 100; // Convert percentage to decimal
    }

    if (cloudData.distribution) {
      config.distributionItems = cloudData.distribution.distributionItems;
    }

    if (cloudData.salaries) {
      config.salaryEntries = cloudData.salaries.salaryEntries || [];
    }

    return config;
  }

  /**
   * Parse date strings back to Date objects
   */
  private parseConfigDates(config: any): TaxConfig {
    if (config.salaryEntries) {
      config.salaryEntries = config.salaryEntries.map((entry: any) => ({
        ...entry,
        taxableMonth: new Date(entry.taxableMonth),
        salaryDate: new Date(entry.salaryDate)
      }));
    }
    return config;
  }

  /**
   * Ensure config has all required default values
   */
  private ensureDefaultValues(config: TaxConfig): TaxConfig {
    if (!config.taxBrackets || config.taxBrackets.length === 0) {
      config.taxBrackets = this.getDefaultTaxBrackets();
    }
    
    if (typeof config.epfRate === 'undefined') {
      config.epfRate = 0.08;
    }
    
    if (typeof config.etfRate === 'undefined') {
      config.etfRate = 0.03;
    }
    
    if (!config.distributionItems || config.distributionItems.length === 0) {
      config.distributionItems = this.getDefaultDistributionItems();
    }

    if (!config.salaryEntries) {
      config.salaryEntries = [];
    }
    
    return config;
  }

  /**
   * Get default tax configuration
   */
  private getDefaultTaxConfig(): TaxConfig {
    return {
      defaultSalaryDate: '01',
      defaultCurrency: 'USD',
      salaryEntries: [],
      taxBrackets: this.getDefaultTaxBrackets(),
      epfRate: 0.08,
      etfRate: 0.03,
      distributionItems: this.getDefaultDistributionItems()
    };
  }

  /**
   * Get default tax brackets
   */
  private getDefaultTaxBrackets(): TaxBracket[] {
    return [
      {
        id: '1',
        minIncome: 0,
        maxIncome: 1800000,
        taxRate: 0.0,
        description: 'No tax up to LKR 1,800,000'
      },
      {
        id: '2',
        minIncome: 1800000,
        maxIncome: 2800000,
        taxRate: 0.06,
        description: '6% tax on income from LKR 1,800,001 to LKR 2,800,000'
      },
      {
        id: '3',
        minIncome: 2800000,
        maxIncome: null,
        taxRate: 0.24,
        description: '24% tax on income above LKR 2,800,000'
      }
    ];
  }

  /**
   * Get default distribution items
   */
  private getDefaultDistributionItems(): DistributionItem[] {
    return [
      { id: '1', category: 'Living Expenses', percentage: 60, description: 'Basic living costs' },
      { id: '2', category: 'Savings', percentage: 20, description: 'Emergency fund and savings' },
      { id: '3', category: 'Investments', percentage: 15, description: 'Investment portfolio' },
      { id: '4', category: 'Entertainment', percentage: 5, description: 'Leisure and entertainment' }
    ];
  }

  /**
   * Clear session storage (useful when switching users)
   */
  clearSessionStorage(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    console.log('🗑️ Session storage cleared');
  }

  /**
   * Force reload from cloud (bypass session cache)
   */
  async forceReloadFromCloud(): Promise<TaxConfig | null> {
    this.clearSessionStorage();
    return await this.loadFromCloudAndCache();
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): { mode: StorageMode, hasSessionData: boolean, hasLocalData: boolean } {
    return {
      mode: this.storageMode,
      hasSessionData: !!sessionStorage.getItem(this.SESSION_KEY),
      hasLocalData: !!localStorage.getItem(this.LOCAL_KEY)
    };
  }

  // Investment Entries Management
  /**
   * Save investment entries using current storage strategy
   */
  async saveInvestmentEntries(entries: InvestmentEntry[]): Promise<void> {
    try {
      if (this.storageMode === 'cloud-session') {
        await this.saveInvestmentEntriesToCloudAndSession(entries);
      } else {
        // For 'local' and 'guest' modes, use localStorage
        localStorage.setItem(this.INVESTMENT_LOCAL_KEY, JSON.stringify(entries));
      }
    } catch (error) {
      console.error('Error saving investment entries:', error);
      // Fallback to localStorage
      localStorage.setItem(this.INVESTMENT_LOCAL_KEY, JSON.stringify(entries));
      throw error;
    }
  }

  /**
   * Load investment entries using current storage strategy
   */
  async loadInvestmentEntries(): Promise<InvestmentEntry[] | null> {
    try {
      if (this.storageMode === 'cloud-session') {
        return await this.loadInvestmentEntriesFromCloudAndCache();
      } else {
        // For 'local' and 'guest' modes, use localStorage
        return this.loadInvestmentEntriesFromLocal();
      }
    } catch (error) {
      console.error('Error loading investment entries:', error);
      // Fallback to localStorage
      return this.loadInvestmentEntriesFromLocal();
    }
  }

  /**
   * Save investment entries to cloud and cache in session
   */
  private async saveInvestmentEntriesToCloudAndSession(entries: InvestmentEntry[]): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user authenticated for cloud storage');
    }

    // Save to Firebase
    await this.firebaseService.saveInvestmentEntries(this.currentUser.id, entries);
    
    // Cache in session storage
    sessionStorage.setItem(this.INVESTMENT_SESSION_KEY, JSON.stringify(entries));
  }

  /**
   * Load investment entries from cloud and cache in session
   */
  private async loadInvestmentEntriesFromCloudAndCache(): Promise<InvestmentEntry[] | null> {
    // First check session cache
    const sessionData = sessionStorage.getItem(this.INVESTMENT_SESSION_KEY);
    if (sessionData) {
      console.log('💰 Loading investment entries from session cache');
      const entries = JSON.parse(sessionData);
      return this.deserializeInvestmentEntries(entries);
    }

    // If not in session, load from cloud
    if (!this.currentUser) {
      console.log('💰 No user authenticated for investment entries');
      return null;
    }

    console.log('💰 Loading investment entries from cloud...');
    const cloudEntries = await this.firebaseService.loadInvestmentEntries(this.currentUser.id);
    if (cloudEntries) {
      // Cache in session
      sessionStorage.setItem(this.INVESTMENT_SESSION_KEY, JSON.stringify(cloudEntries));
      console.log('💰 Investment entries cached in session');
      return this.deserializeInvestmentEntries(cloudEntries);
    }

    console.log('💰 No cloud investment entries found');
    return null;
  }

  /**
   * Load investment entries from localStorage
   */
  private loadInvestmentEntriesFromLocal(): InvestmentEntry[] | null {
    const localData = localStorage.getItem(this.INVESTMENT_LOCAL_KEY);
    if (localData) {
      const entries = JSON.parse(localData);
      return this.deserializeInvestmentEntries(entries);
    }
    return null;
  }

  /**
   * Deserialize investment entries (convert date strings back to Date objects)
   */
  private deserializeInvestmentEntries(entries: any[]): InvestmentEntry[] {
    return entries.map(entry => ({
      ...entry,
      investmentDate: new Date(entry.investmentDate)
    }));
  }

  /**
   * Clear investment entries from session storage
   */
  clearInvestmentEntriesSession(): void {
    sessionStorage.removeItem(this.INVESTMENT_SESSION_KEY);
  }

  // Investment Configuration Management
  /**
   * Save investment configuration using current storage strategy
   */
  async saveInvestmentConfig(config: InvestmentConfig): Promise<void> {
    try {
      if (this.storageMode === 'cloud-session') {
        await this.saveInvestmentConfigToCloudAndSession(config);
      } else {
        // For 'local' and 'guest' modes, use localStorage
        localStorage.setItem(this.INVESTMENT_CONFIG_LOCAL_KEY, JSON.stringify(config));
      }
    } catch (error) {
      console.error('Error saving investment config:', error);
      // Fallback to localStorage
      localStorage.setItem(this.INVESTMENT_CONFIG_LOCAL_KEY, JSON.stringify(config));
      throw error;
    }
  }

  /**
   * Load investment configuration using current storage strategy
   */
  async loadInvestmentConfig(): Promise<InvestmentConfig | null> {
    console.log(`🎯 UnifiedStorageService: loadInvestmentConfig() called with mode: ${this.storageMode}`);
    try {
      if (this.storageMode === 'cloud-session') {
        return await this.loadInvestmentConfigFromCloudAndCache();
      } else {
        // For 'local' and 'guest' modes, use localStorage
        console.log('🎯 Loading investment config from localStorage for guest/local mode');
        return this.loadInvestmentConfigFromLocal();
      }
    } catch (error) {
      console.error('Error loading investment config:', error);
      // Fallback to localStorage
      return this.loadInvestmentConfigFromLocal();
    }
  }

  /**
   * Save investment configuration to cloud and cache in session
   */
  private async saveInvestmentConfigToCloudAndSession(config: InvestmentConfig): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user authenticated for cloud storage');
    }

    if (!this.firebaseService.isAvailable()) {
      throw new Error('Firebase not available for cloud storage');
    }

    // Save to Firebase cloud storage
    await this.firebaseService.saveInvestmentConfiguration(config);
    console.log('🎯 Investment config saved to cloud storage');
    
    // Cache in session storage
    sessionStorage.setItem(this.INVESTMENT_CONFIG_SESSION_KEY, JSON.stringify(config));
    console.log('🎯 Investment config cached in session');
  }

  /**
   * Load investment configuration from cloud and cache in session
   */
  private async loadInvestmentConfigFromCloudAndCache(): Promise<InvestmentConfig | null> {
    // First check session cache
    const sessionData = sessionStorage.getItem(this.INVESTMENT_CONFIG_SESSION_KEY);
    if (sessionData) {
      console.log('🎯 Loading investment config from session cache');
      return JSON.parse(sessionData);
    }

    // If not in session, load from cloud
    if (!this.firebaseService.isAvailable()) {
      console.log('🎯 Firebase not available, falling back to localStorage');
      return this.loadInvestmentConfigFromLocal();
    }

    try {
      console.log('🎯 Loading investment config from cloud storage');
      const cloudData = await this.firebaseService.loadInvestmentConfiguration();
      
      if (cloudData) {
        // Cache in session
        sessionStorage.setItem(this.INVESTMENT_CONFIG_SESSION_KEY, JSON.stringify(cloudData));
        console.log('🎯 Investment config loaded from cloud and cached in session');
        return cloudData;
      }
    } catch (error) {
      console.error('🎯 Error loading investment config from cloud:', error);
    }

    // Fallback to localStorage if cloud fails
    console.log('🎯 Falling back to localStorage');
    const config = this.loadInvestmentConfigFromLocal();
    
    if (config) {
      // Cache in session
      sessionStorage.setItem(this.INVESTMENT_CONFIG_SESSION_KEY, JSON.stringify(config));
      console.log('🎯 Investment config cached in session');
    }

    return config;
  }

  /**
   * Load investment configuration from localStorage
   */
  private loadInvestmentConfigFromLocal(): InvestmentConfig | null {
    const localData = localStorage.getItem(this.INVESTMENT_CONFIG_LOCAL_KEY);
    if (localData) {
      return JSON.parse(localData);
    }
    return null;
  }

  /**
   * Clear investment configuration from session storage
   */
  clearInvestmentConfigSession(): void {
    sessionStorage.removeItem(this.INVESTMENT_CONFIG_SESSION_KEY);
  }
}
