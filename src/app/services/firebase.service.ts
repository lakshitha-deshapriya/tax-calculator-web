import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  getDocs,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { firebaseConfig, firebaseEnabled } from '../config/firebase.config';
import { TaxConfig, TaxBracket, DistributionItem, SalaryEntry } from '../models/tax-config.model';
import { InvestmentConfig } from './configuration.service';
import { GoogleAuthService, User } from './google-auth.service';

// Configuration type definitions
export interface BasicConfiguration {
  defaultSalaryDate: string;
  defaultCurrency: string;
  lastUpdated: Date;
}

export interface TaxConfiguration {
  taxBrackets: TaxBracket[];
  lastUpdated: Date;
}

export interface EPFETFConfiguration {
  epfRatePercentage: number;
  etfRatePercentage: number;
  lastUpdated: Date;
}

export interface DistributionConfiguration {
  distributionItems: DistributionItem[];
  lastUpdated: Date;
}

export interface InvestmentConfiguration extends InvestmentConfig {
  lastUpdated: Date;
}

export interface SalaryData {
  salaryEntries: SalaryEntry[];
  lastUpdated: Date;
}

// Future data structures (commented for reference)
// export interface SalaryData {
//   salaryEntries: SalaryEntry[];
//   lastUpdated: Date;
// }

// export interface InvestmentData {
//   investments: Investment[];
//   lastUpdated: Date;
// }

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private isInitialized = false;
  private currentUser: User | null = null;
  
  // Observable to track sync status
  private syncStatusSubject = new BehaviorSubject<'idle' | 'saving' | 'loading' | 'error'>('idle');
  public syncStatus$ = this.syncStatusSubject.asObservable();
  
  // Observable to track last sync time
  private lastSyncSubject = new BehaviorSubject<Date | null>(null);
  public lastSync$ = this.lastSyncSubject.asObservable();

  constructor(private googleAuthService: GoogleAuthService) {
    // Subscribe to user changes
    this.googleAuthService.user$.subscribe(user => {
      this.currentUser = user;
      if (user && firebaseEnabled) {
        this.initializeFirebase();
      }
    });
  }

  private initializeFirebase(): void {
    if (!firebaseEnabled) {
      console.log('Firebase is disabled in configuration');
      return;
    }

    if (this.isInitialized) {
      return;
    }

    try {
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.isInitialized = true;
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Firebase:', error);
      this.syncStatusSubject.next('error');
    }
  }

  /**
   * Check if Firebase is available and user is signed in
   */
  isAvailable(): boolean {
    return firebaseEnabled && this.isInitialized && this.currentUser !== null && !('isGuest' in this.currentUser);
  }

  // ========================================
  // BASIC CONFIGURATION METHODS
  // ========================================

  /**
   * Save basic configuration (salary date and currency)
   */
  async saveBasicConfiguration(defaultSalaryDate: string, defaultCurrency: string): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      this.syncStatusSubject.next('saving');
      
      const basicConfig: BasicConfiguration = {
        defaultSalaryDate,
        defaultCurrency,
        lastUpdated: new Date()
      };

      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'basic');
      await setDoc(docRef, basicConfig);
      
      console.log('✅ Basic configuration saved to Firebase');
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      
    } catch (error) {
      console.error('❌ Error saving basic configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load basic configuration
   */
  async loadBasicConfiguration(): Promise<BasicConfiguration | null> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      return null;
    }

    try {
      this.syncStatusSubject.next('loading');
      
      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'basic');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: BasicConfiguration = {
          defaultSalaryDate: data['defaultSalaryDate'],
          defaultCurrency: data['defaultCurrency'],
          lastUpdated: data['lastUpdated'].toDate()
        };
        
        console.log('✅ Basic configuration loaded from Firebase');
        this.syncStatusSubject.next('idle');
        return config;
      } else {
        console.log('No basic configuration found');
        this.syncStatusSubject.next('idle');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading basic configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  // ========================================
  // TAX CONFIGURATION METHODS
  // ========================================

  /**
   * Save tax configuration (tax brackets)
   */
  async saveTaxConfiguration(taxBrackets: TaxBracket[]): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      this.syncStatusSubject.next('saving');
      
      const taxConfig: TaxConfiguration = {
        taxBrackets,
        lastUpdated: new Date()
      };

      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'tax');
      await setDoc(docRef, taxConfig);
      
      console.log('✅ Tax configuration saved to Firebase');
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      
    } catch (error) {
      console.error('❌ Error saving tax configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load tax configuration
   */
  async loadTaxConfiguration(): Promise<TaxConfiguration | null> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      return null;
    }

    try {
      this.syncStatusSubject.next('loading');
      
      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'tax');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: TaxConfiguration = {
          taxBrackets: data['taxBrackets'],
          lastUpdated: data['lastUpdated'].toDate()
        };
        
        console.log('✅ Tax configuration loaded from Firebase');
        this.syncStatusSubject.next('idle');
        return config;
      } else {
        console.log('No tax configuration found');
        this.syncStatusSubject.next('idle');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading tax configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  // ========================================
  // EPF/ETF CONFIGURATION METHODS
  // ========================================

  /**
   * Save EPF/ETF configuration
   */
  async saveEPFETFConfiguration(epfRatePercentage: number, etfRatePercentage: number): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      this.syncStatusSubject.next('saving');
      
      const epfetfConfig: EPFETFConfiguration = {
        epfRatePercentage,
        etfRatePercentage,
        lastUpdated: new Date()
      };

      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'epf-etf');
      await setDoc(docRef, epfetfConfig);
      
      console.log('✅ EPF/ETF configuration saved to Firebase');
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      
    } catch (error) {
      console.error('❌ Error saving EPF/ETF configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load EPF/ETF configuration
   */
  async loadEPFETFConfiguration(): Promise<EPFETFConfiguration | null> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      return null;
    }

    try {
      this.syncStatusSubject.next('loading');
      
      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'epf-etf');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: EPFETFConfiguration = {
          epfRatePercentage: data['epfRatePercentage'],
          etfRatePercentage: data['etfRatePercentage'],
          lastUpdated: data['lastUpdated'].toDate()
        };
        
        console.log('✅ EPF/ETF configuration loaded from Firebase');
        this.syncStatusSubject.next('idle');
        return config;
      } else {
        console.log('No EPF/ETF configuration found');
        this.syncStatusSubject.next('idle');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading EPF/ETF configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  // ========================================
  // DISTRIBUTION CONFIGURATION METHODS
  // ========================================

  /**
   * Save distribution configuration
   */
  async saveDistributionConfiguration(distributionItems: DistributionItem[]): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      this.syncStatusSubject.next('saving');
      
      const distributionConfig: DistributionConfiguration = {
        distributionItems,
        lastUpdated: new Date()
      };

      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'distribution');
      await setDoc(docRef, distributionConfig);
      
      console.log('✅ Distribution configuration saved to Firebase');
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      
    } catch (error) {
      console.error('❌ Error saving distribution configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load distribution configuration
   */
  async loadDistributionConfiguration(): Promise<DistributionConfiguration | null> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      return null;
    }

    try {
      this.syncStatusSubject.next('loading');
      
      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'distribution');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: DistributionConfiguration = {
          distributionItems: data['distributionItems'],
          lastUpdated: data['lastUpdated'].toDate()
        };
        
        console.log('✅ Distribution configuration loaded from Firebase');
        this.syncStatusSubject.next('idle');
        return config;
      } else {
        console.log('No distribution configuration found');
        this.syncStatusSubject.next('idle');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading distribution configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  // ========================================
  // INVESTMENT CONFIGURATION METHODS
  // ========================================

  /**
   * Save investment configuration
   */
  async saveInvestmentConfiguration(investmentConfig: InvestmentConfig): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      this.syncStatusSubject.next('saving');
      
      const config: InvestmentConfiguration = {
        ...investmentConfig,
        lastUpdated: new Date()
      };

      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'investment');
      await setDoc(docRef, config);
      
      console.log('✅ Investment configuration saved to Firebase');
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      
    } catch (error) {
      console.error('❌ Error saving investment configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load investment configuration
   */
  async loadInvestmentConfiguration(): Promise<InvestmentConfiguration | null> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      return null;
    }

    try {
      this.syncStatusSubject.next('loading');
      
      const docRef = doc(this.db, 'users', this.currentUser.id, 'configurations', 'investment');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: InvestmentConfiguration = {
          targetInvestmentCategories: data['targetInvestmentCategories'],
          investmentMethods: data['investmentMethods'],
          lastUpdated: data['lastUpdated'].toDate()
        };
        
        console.log('✅ Investment configuration loaded from Firebase');
        this.syncStatusSubject.next('idle');
        return config;
      } else {
        console.log('No investment configuration found');
        this.syncStatusSubject.next('idle');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading investment configuration:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  // ========================================
  // SALARY DATA METHODS
  // ========================================

  /**
   * Save salary entries
   */
  async saveSalaryData(salaryEntries: SalaryEntry[]): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      this.syncStatusSubject.next('saving');
      
      const salaryData: SalaryData = {
        salaryEntries,
        lastUpdated: new Date()
      };

      const docRef = doc(this.db, 'users', this.currentUser.id, 'data', 'salaries');
      await setDoc(docRef, salaryData);
      
      console.log('✅ Salary data saved to Firebase');
      this.syncStatusSubject.next('idle');
      this.lastSyncSubject.next(new Date());
      
    } catch (error) {
      console.error('❌ Error saving salary data:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  /**
   * Load salary entries
   */
  async loadSalaryData(): Promise<SalaryData | null> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      return null;
    }

    try {
      this.syncStatusSubject.next('loading');
      
      const docRef = doc(this.db, 'users', this.currentUser.id, 'data', 'salaries');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const salaryData: SalaryData = {
          salaryEntries: data['salaryEntries'].map((entry: any) => ({
            ...entry,
            taxableMonth: entry.taxableMonth.toDate(),
            salaryDate: entry.salaryDate.toDate()
          })),
          lastUpdated: data['lastUpdated'].toDate()
        };
        
        console.log('✅ Salary data loaded from Firebase');
        this.syncStatusSubject.next('idle');
        return salaryData;
      } else {
        console.log('No salary data found');
        this.syncStatusSubject.next('idle');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading salary data:', error);
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  // ========================================
  // BULK OPERATIONS
  // ========================================

  /**
   * Load all configurations and data at once
   */
  async loadAllConfigurations(): Promise<{
    basic: BasicConfiguration | null;
    tax: TaxConfiguration | null;
    epfEtf: EPFETFConfiguration | null;
    distribution: DistributionConfiguration | null;
    investment: InvestmentConfiguration | null;
    salaries: SalaryData | null;
  }> {
    if (!this.isAvailable()) {
      return {
        basic: null,
        tax: null,
        epfEtf: null,
        distribution: null,
        investment: null,
        salaries: null
      };
    }

    try {
      const [basic, tax, epfEtf, distribution, investment, salaries] = await Promise.all([
        this.loadBasicConfiguration(),
        this.loadTaxConfiguration(),
        this.loadEPFETFConfiguration(),
        this.loadDistributionConfiguration(),
        this.loadInvestmentConfiguration(),
        this.loadSalaryData()
      ]);

      return { basic, tax, epfEtf, distribution, investment, salaries };
    } catch (error) {
      console.error('❌ Error loading all configurations:', error);
      return {
        basic: null,
        tax: null,
        epfEtf: null,
        distribution: null,
        investment: null,
        salaries: null
      };
    }
  }

  /**
   * Delete all user configurations
   */
  async deleteAllConfigurations(): Promise<void> {
    if (!this.isAvailable() || !this.db || !this.currentUser) {
      throw new Error('Firebase not available or user not signed in');
    }

    try {
      const configTypes = ['basic', 'tax', 'epf-etf', 'distribution', 'investment'];
      
      const deletePromises = configTypes.map(configType => {
        const docRef = doc(this.db!, 'users', this.currentUser!.id, 'configurations', configType);
        return deleteDoc(docRef);
      });

      await Promise.all(deletePromises);
      console.log('✅ All configurations deleted from Firebase');
      
    } catch (error) {
      console.error('❌ Error deleting configurations from Firebase:', error);
      throw error;
    }
  }

  /**
   * Get current sync status
   */
  getCurrentSyncStatus(): 'idle' | 'saving' | 'loading' | 'error' {
    return this.syncStatusSubject.value;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncSubject.value;
  }

  // Investment Entries Management
  /**
   * Save investment entries for a user
   */
  async saveInvestmentEntries(userId: string, entries: any[]): Promise<void> {
    if (!firebaseEnabled || !this.db) {
      throw new Error('Firebase is not enabled or not initialized');
    }

    this.syncStatusSubject.next('saving');

    try {
      const docRef = doc(this.db, `users/${userId}/data/investmentEntries`);
      await setDoc(docRef, {
        entries: entries,
        lastUpdated: new Date()
      });

      console.log('Investment entries saved successfully to Firebase');
    } catch (error) {
      this.syncStatusSubject.next('error');
      console.error('Error saving investment entries to Firebase:', error);
      throw error;
    } finally {
      if (this.syncStatusSubject.value !== 'error') {
        this.syncStatusSubject.next('idle');
      }
    }
  }

  /**
   * Load investment entries for a user
   */
  async loadInvestmentEntries(userId: string): Promise<any[] | null> {
    if (!firebaseEnabled || !this.db) {
      console.log('Firebase is not enabled or not initialized');
      return null;
    }

    this.syncStatusSubject.next('loading');

    try {
      const docRef = doc(this.db, `users/${userId}/data/investmentEntries`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Investment entries loaded successfully from Firebase');
        return data['entries'] || [];
      } else {
        console.log('No investment entries found in Firebase');
        return null;
      }
    } catch (error) {
      this.syncStatusSubject.next('error');
      console.error('Error loading investment entries from Firebase:', error);
      throw error;
    } finally {
      if (this.syncStatusSubject.value !== 'error') {
        this.syncStatusSubject.next('idle');
      }
    }
  }
}
