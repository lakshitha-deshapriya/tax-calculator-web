import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeRateProductionService as ExchangeRateService } from '../../services/exchange-rate-production.service';
import { TaxConfigService } from '../../services/tax-config.service';
import { ConfigurationService, InvestmentConfig, InvestmentMethod } from '../../services/configuration.service';
import { TaxConfig, TaxBracket, DistributionItem } from '../../models/tax-config.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  @Input() taxConfig!: TaxConfig;
  @Output() configChanged = new EventEmitter<void>();

  supportedCurrencies: { code: string, name: string }[] = [];
  newTaxBracket: Partial<TaxBracket> = {};
  isEditingBrackets: boolean = false;
  
  // Section visibility toggles
  showBasicSettings: boolean = true;
  showTaxBrackets: boolean = true;
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

  constructor(
    private exchangeRateService: ExchangeRateService,
    private taxConfigService: TaxConfigService,
    private configService: ConfigurationService
  ) {}

  ngOnInit() {
    console.log('SettingsComponent initialized');
    // Load supported currencies
    this.supportedCurrencies = this.exchangeRateService.getSupportedCurrencies();
    this.initNewTaxBracket();
    this.loadCurrentConfiguration();
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
  }

  // Tax Bracket Management Methods
  initNewTaxBracket(): void {
    this.newTaxBracket = {
      minIncome: 0,
      maxIncome: undefined,
      taxRate: 0,
      description: ''
    };
  }

  onAddTaxBracket(): void {
    if (!this.newTaxBracket.minIncome && this.newTaxBracket.minIncome !== 0 || 
        !this.newTaxBracket.taxRate && this.newTaxBracket.taxRate !== 0 || 
        !this.newTaxBracket.description) {
      alert('Please fill in all required fields');
      return;
    }

    // Ensure tax brackets array exists
    if (!this.taxConfig.taxBrackets) {
      this.taxConfig.taxBrackets = [];
    }

    const bracket: TaxBracket = {
      id: this.taxConfigService.generateTaxBracketId(),
      minIncome: this.newTaxBracket.minIncome!,
      maxIncome: this.newTaxBracket.maxIncome || null,
      taxRate: this.newTaxBracket.taxRate! / 100, // Convert percentage to decimal
      description: this.newTaxBracket.description!
    };

    this.taxConfig.taxBrackets.push(bracket);
    this.saveTaxConfig();
    this.initNewTaxBracket();
    this.isEditingBrackets = false;
    this.configChanged.emit();
  }

  onDeleteTaxBracket(bracketId: string): void {
    if (confirm('Are you sure you want to delete this tax bracket?')) {
      this.taxConfig.taxBrackets = this.taxConfig.taxBrackets.filter(bracket => bracket.id !== bracketId);
      this.saveTaxConfig();
      this.configChanged.emit();
    }
  }

  onResetTaxBrackets(): void {
    if (confirm('Are you sure you want to reset to default tax brackets? This will remove all custom brackets.')) {
      this.taxConfig.taxBrackets = this.taxConfigService.getDefaultTaxBrackets();
      this.saveTaxConfig();
      this.configChanged.emit();
    }
  }

  formatPercentage(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
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
    this.configService.updateDistributionItem(index, { [field]: value });
    this.taxConfig.distributionItems = this.configService.getDistributionItems();
    this.saveTaxConfig();
    this.configChanged.emit();
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
    this.configService.updateInvestmentMethod(methodId, { [field]: value });
    this.investmentConfig = this.configService.getInvestmentConfig();
    this.configChanged.emit();
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
