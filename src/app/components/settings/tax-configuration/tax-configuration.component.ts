import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaxConfigService } from '../../../services/tax-config.service';
import { TaxConfig, TaxBracket } from '../../../models/tax-config.model';

@Component({
  selector: 'app-tax-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tax-configuration.component.html',
  styleUrl: './tax-configuration.component.css'
})
export class TaxConfigurationComponent {
  @Input() taxConfig!: TaxConfig;
  @Output() configChanged = new EventEmitter<void>();

  newTaxBracket: Partial<TaxBracket> = {};
  isEditingBrackets: boolean = false;
  showTaxBrackets: boolean = true;

  constructor(private taxConfigService: TaxConfigService) {
    this.initNewTaxBracket();
  }

  private initNewTaxBracket(): void {
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

  private saveTaxConfig(): void {
    this.taxConfigService.saveTaxConfig(this.taxConfig);
  }

  toggleSection(): void {
    this.showTaxBrackets = !this.showTaxBrackets;
  }

  toggleEditMode(): void {
    this.isEditingBrackets = !this.isEditingBrackets;
    if (!this.isEditingBrackets) {
      this.initNewTaxBracket();
    }
  }
}
