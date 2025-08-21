import { Injectable } from '@angular/core';
import { TaxConfig, TaxBracket, DistributionItem } from '../models/tax-config.model';
import { TaxConfigService } from './tax-config.service';
import { ExchangeRateProductionService } from './exchange-rate-production.service';

export interface InvestmentMethod {
  id: string;
  name: string;
  percentage: number;
  description: string;
}

export interface InvestmentConfig {
  targetInvestmentCategories: string[];
  investmentMethods: InvestmentMethod[];
}

/**
 * Centralized Configuration Service
 * Manages all application configurations including:
 * - Default Salary Date & Currency
 * - Tax Bracket Configuration  
 * - Income Distribution (EPF, ETF, Net Income Categories)
 * - Investment Configurations
 */
@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private readonly INVESTMENT_CONFIG_KEY = 'investment-config';

  constructor(
    private taxConfigService: TaxConfigService,
    private exchangeRateService: ExchangeRateProductionService
  ) {}

  // ========================================
  // BASIC CONFIGURATIONS
  // ========================================

  /**
   * Get default salary date (1-31)
   */
  getDefaultSalaryDate(): string {
    const config = this.getTaxConfig();
    return config.defaultSalaryDate;
  }

  /**
   * Set default salary date
   */
  setDefaultSalaryDate(date: string): void {
    const config = this.getTaxConfig();
    config.defaultSalaryDate = date;
    this.saveConfiguration(config);
  }

  /**
   * Get default currency
   */
  getDefaultCurrency(): string {
    const config = this.getTaxConfig();
    return config.defaultCurrency;
  }

  /**
   * Set default currency
   */
  setDefaultCurrency(currency: string): void {
    const config = this.getTaxConfig();
    config.defaultCurrency = currency;
    this.saveConfiguration(config);
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): { code: string, name: string }[] {
    return this.exchangeRateService.getSupportedCurrencies();
  }

  // ========================================
  // TAX BRACKET CONFIGURATION
  // ========================================

  /**
   * Get current tax brackets
   */
  getTaxBrackets(): TaxBracket[] {
    const config = this.getTaxConfig();
    return config.taxBrackets || this.taxConfigService.getDefaultTaxBrackets();
  }

  /**
   * Set tax brackets
   */
  setTaxBrackets(brackets: TaxBracket[]): void {
    const config = this.getTaxConfig();
    config.taxBrackets = brackets;
    this.saveConfiguration(config);
  }

  /**
   * Add new tax bracket
   */
  addTaxBracket(bracket: Omit<TaxBracket, 'id'>): void {
    const config = this.getTaxConfig();
    const newBracket: TaxBracket = {
      ...bracket,
      id: this.taxConfigService.generateTaxBracketId()
    };
    config.taxBrackets.push(newBracket);
    this.saveConfiguration(config);
  }

  /**
   * Remove tax bracket by ID
   */
  removeTaxBracket(bracketId: string): void {
    const config = this.getTaxConfig();
    config.taxBrackets = config.taxBrackets.filter(bracket => bracket.id !== bracketId);
    this.saveConfiguration(config);
  }

  /**
   * Reset tax brackets to default
   */
  resetTaxBracketsToDefault(): void {
    const config = this.getTaxConfig();
    config.taxBrackets = this.taxConfigService.getDefaultTaxBrackets();
    this.saveConfiguration(config);
  }

  // ========================================
  // EPF/ETF CONFIGURATION
  // ========================================

  /**
   * Get EPF rate (as percentage)
   */
  getEpfRatePercentage(): number {
    const config = this.getTaxConfig();
    return (config.epfRate || 0.08) * 100;
  }

  /**
   * Set EPF rate (from percentage)
   */
  setEpfRatePercentage(percentage: number): void {
    const config = this.getTaxConfig();
    config.epfRate = percentage / 100;
    this.saveConfiguration(config);
  }

  /**
   * Get ETF rate (as percentage)
   */
  getEtfRatePercentage(): number {
    const config = this.getTaxConfig();
    return (config.etfRate || 0.03) * 100;
  }

  /**
   * Set ETF rate (from percentage)
   */
  setEtfRatePercentage(percentage: number): void {
    const config = this.getTaxConfig();
    config.etfRate = percentage / 100;
    this.saveConfiguration(config);
  }

  // ========================================
  // INCOME DISTRIBUTION CONFIGURATION
  // ========================================

  /**
   * Get distribution items
   */
  getDistributionItems(): DistributionItem[] {
    const config = this.getTaxConfig();
    return config.distributionItems || this.taxConfigService.getDefaultDistributionItems();
  }

  /**
   * Set distribution items
   */
  setDistributionItems(items: DistributionItem[]): void {
    const config = this.getTaxConfig();
    config.distributionItems = items;
    this.saveConfiguration(config);
  }

  /**
   * Add new distribution item
   */
  addDistributionItem(item: Omit<DistributionItem, 'id'>): void {
    const config = this.getTaxConfig();
    const newItem: DistributionItem = {
      ...item,
      id: this.taxConfigService.generateDistributionItemId()
    };
    config.distributionItems.push(newItem);
    this.saveConfiguration(config);
  }

  /**
   * Update distribution item
   */
  updateDistributionItem(index: number, updates: Partial<DistributionItem>): void {
    const config = this.getTaxConfig();
    if (index >= 0 && index < config.distributionItems.length) {
      config.distributionItems[index] = { ...config.distributionItems[index], ...updates };
      this.saveConfiguration(config);
    }
  }

  /**
   * Remove distribution item
   */
  removeDistributionItem(index: number): void {
    const config = this.getTaxConfig();
    if (config.distributionItems.length > 1 && index >= 0 && index < config.distributionItems.length) {
      config.distributionItems.splice(index, 1);
      this.saveConfiguration(config);
    }
  }

  /**
   * Reset distribution items to default
   */
  resetDistributionItemsToDefault(): void {
    const config = this.getTaxConfig();
    config.distributionItems = this.taxConfigService.getDefaultDistributionItems();
    this.saveConfiguration(config);
  }

  // ========================================
  // INVESTMENT CONFIGURATION
  // ========================================

  /**
   * Get investment configuration
   */
  getInvestmentConfig(): InvestmentConfig {
    const stored = localStorage.getItem(this.INVESTMENT_CONFIG_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing investment config:', error);
      }
    }
    
    return this.getDefaultInvestmentConfig();
  }

  /**
   * Set investment configuration
   */
  setInvestmentConfig(config: InvestmentConfig): void {
    localStorage.setItem(this.INVESTMENT_CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * Get default investment configuration
   */
  private getDefaultInvestmentConfig(): InvestmentConfig {
    const distributionItems = this.getDistributionItems();
    return {
      targetInvestmentCategories: distributionItems
        .filter(item => item.category.toLowerCase().includes('investment') || item.category.toLowerCase().includes('saving'))
        .map(item => item.category),
      investmentMethods: [
        {
          id: 'method_1',
          name: 'Stocks',
          percentage: 60,
          description: 'Equity investments'
        },
        {
          id: 'method_2',
          name: 'Bonds',
          percentage: 25,
          description: 'Fixed income securities'
        },
        {
          id: 'method_3',
          name: 'Cash',
          percentage: 15,
          description: 'Cash reserves'
        }
      ]
    };
  }

  /**
   * Add investment method
   */
  addInvestmentMethod(method: Omit<InvestmentMethod, 'id'>): void {
    const config = this.getInvestmentConfig();
    const newMethod: InvestmentMethod = {
      ...method,
      id: 'method_' + Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    config.investmentMethods.push(newMethod);
    this.setInvestmentConfig(config);
  }

  /**
   * Update investment method
   */
  updateInvestmentMethod(methodId: string, updates: Partial<InvestmentMethod>): void {
    const config = this.getInvestmentConfig();
    const methodIndex = config.investmentMethods.findIndex(m => m.id === methodId);
    if (methodIndex >= 0) {
      config.investmentMethods[methodIndex] = { ...config.investmentMethods[methodIndex], ...updates };
      this.setInvestmentConfig(config);
    }
  }

  /**
   * Remove investment method
   */
  removeInvestmentMethod(methodId: string): void {
    const config = this.getInvestmentConfig();
    if (config.investmentMethods.length > 1) {
      config.investmentMethods = config.investmentMethods.filter(m => m.id !== methodId);
      this.setInvestmentConfig(config);
    }
  }

  /**
   * Toggle investment category selection
   */
  toggleInvestmentCategory(category: string): void {
    const config = this.getInvestmentConfig();
    const index = config.targetInvestmentCategories.indexOf(category);
    if (index >= 0) {
      config.targetInvestmentCategories.splice(index, 1);
    } else {
      config.targetInvestmentCategories.push(category);
    }
    this.setInvestmentConfig(config);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get total distribution percentage
   */
  getTotalDistributionPercentage(): number {
    const items = this.getDistributionItems();
    return items.reduce((sum, item) => sum + item.percentage, 0);
  }

  /**
   * Check if distribution percentage is valid (equals 100%)
   */
  isDistributionPercentageValid(): boolean {
    return Math.abs(this.getTotalDistributionPercentage() - 100) < 0.1;
  }

  /**
   * Get total investment method percentage
   */
  getTotalInvestmentMethodPercentage(): number {
    const config = this.getInvestmentConfig();
    return config.investmentMethods.reduce((sum, method) => sum + method.percentage, 0);
  }

  /**
   * Check if investment method percentage is valid (equals 100%)
   */
  isInvestmentMethodPercentageValid(): boolean {
    return Math.abs(this.getTotalInvestmentMethodPercentage() - 100) < 0.1;
  }

  /**
   * Reset all configurations to default
   */
  resetAllToDefault(): void {
    const defaultConfig = this.taxConfigService.getDefaultTaxConfig();
    this.saveConfiguration(defaultConfig);
    this.setInvestmentConfig(this.getDefaultInvestmentConfig());
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Get current tax configuration
   */
  private getTaxConfig(): TaxConfig {
    return this.taxConfigService.loadTaxConfig() || this.taxConfigService.getDefaultTaxConfig();
  }

  /**
   * Save configuration
   */
  private saveConfiguration(config: TaxConfig): void {
    this.taxConfigService.saveTaxConfig(config);
  }
}
