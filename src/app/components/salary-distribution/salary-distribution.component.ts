import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SalaryDistributionItem {
  category: string;
  amount: number;
  percentage: number;
  description: string;
}

@Component({
  selector: 'app-salary-distribution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-distribution.component.html',
  styleUrls: ['./salary-distribution.component.css']
})
export class SalaryDistributionComponent implements OnInit {
  totalSalary = 150000; // Base salary amount
  distributionItems: SalaryDistributionItem[] = [
    {
      category: 'Base Salary',
      amount: 100000,
      percentage: 66.67,
      description: 'Fixed monthly salary'
    },
    {
      category: 'Performance Bonus',
      amount: 25000,
      percentage: 16.67,
      description: 'Quarterly performance incentive'
    },
    {
      category: 'Benefits',
      amount: 15000,
      percentage: 10.0,
      description: 'Health, insurance, and other benefits'
    },
    {
      category: 'Stock Options',
      amount: 10000,
      percentage: 6.67,
      description: 'Equity compensation'
    }
  ];

  constructor() { }

  ngOnInit(): void {
    console.log('SalaryDistributionComponent initialized');
    this.calculatePercentages();
  }

  calculatePercentages(): void {
    this.totalSalary = this.distributionItems.reduce((sum, item) => sum + item.amount, 0);
    this.distributionItems.forEach(item => {
      item.percentage = (item.amount / this.totalSalary) * 100;
    });
  }

  updateAmount(index: number, newAmount: number): void {
    this.distributionItems[index].amount = newAmount;
    this.calculatePercentages();
  }

  addNewCategory(): void {
    this.distributionItems.push({
      category: 'New Category',
      amount: 0,
      percentage: 0,
      description: 'Enter description'
    });
    this.calculatePercentages();
  }

  removeCategory(index: number): void {
    if (this.distributionItems.length > 1) {
      this.distributionItems.splice(index, 1);
      this.calculatePercentages();
    }
  }

  getColorClass(index: number): string {
    const colors = ['primary', 'success', 'warning', 'info', 'secondary'];
    return colors[index % colors.length];
  }

  getHighestComponent(): SalaryDistributionItem | null {
    if (this.distributionItems.length === 0) {
      return null;
    }
    return this.distributionItems.reduce((prev, current) => 
      (prev.amount > current.amount) ? prev : current
    );
  }
}
