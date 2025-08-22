import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TaxConfigService } from './tax-config.service';
import { FirebaseService } from './firebase.service';
import { GoogleAuthService, User } from './google-auth.service';
import { TaxConfig, SalaryEntry } from '../models/tax-config.model';

@Injectable({
  providedIn: 'root'
})
export class DataSyncService {
  private syncStatusSubject = new BehaviorSubject<'idle' | 'syncing' | 'error'>('idle');
  public syncStatus$ = this.syncStatusSubject.asObservable();
  
  private lastSyncSubject = new BehaviorSubject<Date | null>(null);
  public lastSync$ = this.lastSyncSubject.asObservable();
  
  private autoSyncEnabled = true;

  constructor(
    private taxConfigService: TaxConfigService,
    private firebaseService: FirebaseService,
    private googleAuthService: GoogleAuthService
  ) {
    // Note: Auto-sync on sign-in is handled by AppComponent to ensure proper UI updates
    // This service will handle subsequent changes after initial sync
  }

  /**
   * Save salary entry to local storage and sync to cloud if user is signed in
   */
  async saveSalaryEntry(salaryEntry: SalaryEntry, taxConfig: TaxConfig): Promise<void> {
    // Always save to browser first
    taxConfig.salaryEntries.push(salaryEntry);
    this.taxConfigService.saveTaxConfig(taxConfig);
    
    // Sync to cloud if user is signed in
    if (this.firebaseService.isAvailable()) {
      try {
        await this.firebaseService.saveSalaryData(taxConfig.salaryEntries);
      } catch (error) {
        console.error('Failed to sync salary to cloud:', error);
      }
    }
  }

  /**
   * Update salary entries in local storage and sync to cloud if user is signed in
   */
  async updateSalaryEntries(salaryEntries: SalaryEntry[], taxConfig: TaxConfig): Promise<void> {
    // Always save to browser first
    taxConfig.salaryEntries = salaryEntries;
    this.taxConfigService.saveTaxConfig(taxConfig);
    
    // Sync to cloud if user is signed in
    if (this.firebaseService.isAvailable()) {
      try {
        await this.firebaseService.saveSalaryData(salaryEntries);
      } catch (error) {
        console.error('Failed to sync salaries to cloud:', error);
      }
    }
  }

  /**
   * Sync configuration changes to cloud
   */
  async syncConfigurationToCloud(taxConfig: TaxConfig): Promise<void> {
    if (!this.firebaseService.isAvailable()) {
      return;
    }

    try {
      this.syncStatusSubject.next('syncing');
      
      // Save all configurations
      await Promise.all([
        this.firebaseService.saveBasicConfiguration(taxConfig.defaultSalaryDate, taxConfig.defaultCurrency),
        this.firebaseService.saveTaxConfiguration(taxConfig.taxBrackets),
        this.firebaseService.saveEPFETFConfiguration(taxConfig.epfRate, taxConfig.etfRate),
        this.firebaseService.saveDistributionConfiguration(taxConfig.distributionItems),
        this.firebaseService.saveSalaryData(taxConfig.salaryEntries)
      ]);
      
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      console.log('✅ All data synced to cloud');
      
    } catch (error) {
      console.error('❌ Failed to sync to cloud:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load data from cloud and merge with local data (cloud takes precedence for newer data)
   */
  async syncFromCloudToLocal(): Promise<TaxConfig | null> {
    if (!this.firebaseService.isAvailable()) {
      return null;
    }

    try {
      this.syncStatusSubject.next('syncing');
      
      // Load all data from cloud
      const cloudData = await this.firebaseService.loadAllConfigurations();
      
      // Get current local data
      const localConfig = this.taxConfigService.loadTaxConfig() || this.taxConfigService.getDefaultTaxConfig();
      
      // Merge cloud data with local data (cloud takes precedence if newer)
      const mergedConfig = await this.mergeCloudAndLocalData(localConfig, cloudData);
      
      // Save merged configuration to local storage
      this.taxConfigService.saveTaxConfig(mergedConfig);
      
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      console.log('✅ Data synced from cloud to local storage');
      
      return mergedConfig;
      
    } catch (error) {
      console.error('❌ Failed to sync from cloud:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Manual sync - saves current local data to cloud
   */
  async manualSyncToCloud(): Promise<void> {
    const taxConfig = this.taxConfigService.loadTaxConfig();
    if (taxConfig) {
      await this.syncConfigurationToCloud(taxConfig);
    }
  }

  /**
   * Manual load from cloud - loads cloud data and overwrites local
   */
  async manualLoadFromCloud(): Promise<TaxConfig | null> {
    return await this.syncFromCloudToLocal();
  }

  /**
   * Merge cloud and local data, with cloud taking precedence for newer data
   */
  private async mergeCloudAndLocalData(
    localConfig: TaxConfig, 
    cloudData: {
      basic: any;
      tax: any;
      epfEtf: any;
      distribution: any;
      investment: any;
      salaries: any;
    }
  ): Promise<TaxConfig> {
    const mergedConfig = { ...localConfig };

    // Merge basic configuration
    if (cloudData.basic) {
      mergedConfig.defaultSalaryDate = cloudData.basic.defaultSalaryDate;
      mergedConfig.defaultCurrency = cloudData.basic.defaultCurrency;
    }

    // Merge tax configuration
    if (cloudData.tax) {
      mergedConfig.taxBrackets = cloudData.tax.taxBrackets;
    }

    // Merge EPF/ETF configuration
    if (cloudData.epfEtf) {
      mergedConfig.epfRate = cloudData.epfEtf.epfRatePercentage;
      mergedConfig.etfRate = cloudData.epfEtf.etfRatePercentage;
    }

    // Merge distribution configuration
    if (cloudData.distribution) {
      mergedConfig.distributionItems = cloudData.distribution.distributionItems;
    }

    // Merge salary data (this is the most important for the user request)
    if (cloudData.salaries) {
      // For salaries, we want to merge both local and cloud entries
      // Remove duplicates based on id, with cloud data taking precedence
      const cloudSalaries = cloudData.salaries.salaryEntries || [];
      const localSalaries = mergedConfig.salaryEntries || [];
      
      const allSalaries = [...cloudSalaries];
      
      // Add local salaries that don't exist in cloud
      localSalaries.forEach(localSalary => {
        const existsInCloud = cloudSalaries.some((cloudSalary: SalaryEntry) => cloudSalary.id === localSalary.id);
        if (!existsInCloud) {
          allSalaries.push(localSalary);
        }
      });
      
      mergedConfig.salaryEntries = allSalaries;
    }

    return mergedConfig;
  }

  /**
   * Enable/disable auto-sync
   */
  setAutoSyncEnabled(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
  }

  /**
   * Check if auto-sync is enabled
   */
  isAutoSyncEnabled(): boolean {
    return this.autoSyncEnabled;
  }

  /**
   * Get current sync status
   */
  getCurrentSyncStatus(): 'idle' | 'syncing' | 'error' {
    return this.syncStatusSubject.value;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncSubject.value;
  }
}
