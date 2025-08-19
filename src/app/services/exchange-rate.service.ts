import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface ExchangeRateData {
  date: Date;
  currency: string;
  buyingRate: number;
  sellingRate: number;
  source?: string;
  averageRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateService {
  private readonly baseUrl = 'https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-buy-and-sell-exchange-rates';

  constructor(private http: HttpClient) {}

  /**
   * Fetches exchange rate for a specific currency and date range
   */
  getExchangeRateForDateRange(startDate: Date, endDate: Date, currency: string): Observable<ExchangeRateData> {
    return new Observable(observer => {
      this.getRealCBSLData(startDate, endDate, currency)
        .then(data => {
          if (data) {
            observer.next(data);
            observer.complete();
          } else {
            const dateStr = startDate.getTime() === endDate.getTime() 
              ? this.formatDate(startDate)
              : `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`;
            observer.error(new Error(`No exchange rate available for ${dateStr} from Central Bank of Sri Lanka (CBSL). Exchange rates are only available for working days when the bank publishes them. Please try a different date or check if the selected date is a working day.`));
          }
        })
        .catch(error => {
          console.error('Error fetching exchange rate:', error);
          const dateStr = startDate.getTime() === endDate.getTime() 
            ? this.formatDate(startDate)
            : `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`;
          observer.error(new Error(`No exchange rate available for ${dateStr} from Central Bank of Sri Lanka (CBSL). Please try a different date or check if the selected date is a working day.`));
        });
    });
  }

  /**
   * Fetches exchange rate for a specific currency and date
   */
  getExchangeRate(date: Date, currency: string): Observable<ExchangeRateData> {
    return this.getExchangeRateForDateRange(date, date, currency);
  }

  private async getRealCBSLData(startDate: Date, endDate: Date, currency: string): Promise<ExchangeRateData | null> {
    try {
      const startDateStr = this.formatDate(startDate);
      const endDateStr = this.formatDate(endDate);
      
      // Store the original requested date for exact matching
      const originalRequestedDate = startDate.getTime() === endDate.getTime() ? startDate : endDate;
      
      // If looking for a specific date, expand the search range to find data, but we'll filter for exact date
      let actualStartDateStr = startDateStr;
      let actualEndDateStr = endDateStr;
      
      if (startDate.getTime() === endDate.getTime()) {
        const expandedStartDate = new Date(startDate);
        expandedStartDate.setDate(startDate.getDate() - 3);
        
        const expandedEndDate = new Date(endDate);
        expandedEndDate.setDate(endDate.getDate() + 3);
        
        actualStartDateStr = this.formatDate(expandedStartDate);
        actualEndDateStr = this.formatDate(expandedEndDate);
      }

      // Use our proxy server to fetch CBSL data
      const requestBody = {
        startDate: actualStartDateStr,
        endDate: actualEndDateStr,
        currency: currency,
        exactDate: this.formatDate(originalRequestedDate) // Send the exact date we want
      };

      const response = await this.http.post<any>('http://localhost:3001/api/cbsl/exchange-rate', requestBody).toPromise();

      if (response && response.success) {
        console.log('Successfully received CBSL data via proxy:', response.data);
        return {
          date: new Date(response.data.date),
          currency: response.data.currency,
          buyingRate: response.data.buyingRate,
          sellingRate: response.data.sellingRate,
          source: response.data.source,
          averageRate: response.data.averageRate
        };
      } else {
        console.log('CBSL proxy returned no data:', response?.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching CBSL data via proxy:', error);
      return null;
    }
  }

  private parseCBSLResponse(responseBody: string, startDate: Date, endDate: Date, currency: string): ExchangeRateData | null {
    try {
      // Create a temporary DOM element to parse the HTML
      const parser = new DOMParser();
      const document = parser.parseFromString(responseBody, 'text/html');
      const tables = document.querySelectorAll('table');
      
      if (tables.length === 0) {
        console.log('No tables found in CBSL response');
        return null;
      }
      
      const targetDate = startDate.getTime() === endDate.getTime() ? startDate : endDate;
      
      // Look for the exchange rate table
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) continue;
        
        // Check if this looks like an exchange rate table
        const headerRow = rows[0];
        const headerCells = headerRow.querySelectorAll('td, th');
        const headerTexts = Array.from(headerCells).map(cell => cell.textContent?.trim().toLowerCase() || '');
        
        // Look for table with Date, Buy Rate, Sell Rate columns
        const hasDate = headerTexts.some(text => text.includes('date'));
        const hasBuy = headerTexts.some(text => text.includes('buy'));
        const hasSell = headerTexts.some(text => text.includes('sell'));
        
        if (hasDate && hasBuy && hasSell) {
          const rates: any[] = [];
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td, th');
            const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
            
            if (cellTexts.length >= 3) {
              try {
                const dateStr = cellTexts[0];
                const buyRateStr = cellTexts[1].replace(/,/g, '');
                const sellRateStr = cellTexts[2].replace(/,/g, '');
                
                const date = new Date(dateStr);
                const buyRate = parseFloat(buyRateStr);
                const sellRate = parseFloat(sellRateStr);
                
                if (!isNaN(date.getTime()) && !isNaN(buyRate) && !isNaN(sellRate)) {
                  rates.push({
                    date: date,
                    buyingRate: buyRate,
                    sellingRate: sellRate,
                    daysDifference: Math.abs(Math.floor((date.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)))
                  });
                }
              } catch (e) {
                console.error(`Error parsing row ${i}:`, e);
              }
            }
          }
          
          if (rates.length > 0) {
            // Find exact date match
            const exactMatch = rates.filter(rate => {
              const rateDate = rate.date;
              return rateDate.getFullYear() === targetDate.getFullYear() && 
                     rateDate.getMonth() === targetDate.getMonth() && 
                     rateDate.getDate() === targetDate.getDate();
            });
            
            if (exactMatch.length > 0) {
              const exactRate = exactMatch[0];
              console.log(`Found exact date match for ${this.formatDate(targetDate)}`);
              
              return {
                date: exactRate.date,
                currency: currency,
                buyingRate: exactRate.buyingRate,
                sellingRate: exactRate.sellingRate,
                source: 'Central Bank of Sri Lanka (CBSL)',
                averageRate: (exactRate.buyingRate + exactRate.sellingRate) / 2
              };
            }
            
            console.log(`No exact exchange rate found for ${this.formatDate(targetDate)}`);
            return null;
          }
        }
      }
      
      console.log('No valid exchange rate table found in CBSL response');
      return null;
      
    } catch (error) {
      console.error('Error parsing CBSL response:', error);
      return null;
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getCurrencyMapping(currency: string): string {
    const mappings: { [key: string]: string } = {
      'USD': 'USD~US Dollar',
      'SGD': 'SGD~Singapore Dollar',
      'EUR': 'EUR~Euro',
      'GBP': 'GBP~Pound Sterling',
      'JPY': 'JPY~Japanese Yen',
      'AUD': 'AUD~Australian Dollar',
      'CAD': 'CAD~Canadian Dollar',
      'CHF': 'CHF~Swiss Franc',
      'CNY': 'CNY~Chinese Yuan',
      'INR': 'INR~Indian Rupee'
    };
    return mappings[currency] || `${currency}~${currency}`;
  }

  /**
   * Get list of supported currencies
   */
  getSupportedCurrencies(): { code: string, name: string }[] {
    return [
      { code: 'USD', name: 'United States Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'CNY', name: 'Renminbi' },
      { code: 'JPY', name: 'Yen' },
      { code: 'SGD', name: 'Singapore Dollar' }
    ];
  }

  /**
   * Returns a fallback rate when live data is not available (for testing/development)
   */
  private getFallbackRate(date: Date, currency: string): ExchangeRateData {
    console.log(`Using fallback exchange rate for ${currency} on ${this.formatDate(date)}`);
    
    // Base rates (approximate 2024-2025 rates)
    const baseRates: { [key: string]: number } = {
      'USD': 300.0,
      'SGD': 220.0,
      'EUR': 330.0,
      'GBP': 380.0,
      'JPY': 2.1,
      'AUD': 195.0,
      'CAD': 220.0,
      'CHF': 335.0,
      'CNY': 42.0,
      'INR': 3.6
    };
    
    // Simulate slight variation based on date for realism
    const dayOfMonth = date.getDate();
    const baseRate = baseRates[currency] || 250.0;
    const variation = (dayOfMonth % 5) * 0.5 - 1.0; // Small daily variation
    
    const buyingRate = baseRate + variation - 1.5;
    const sellingRate = baseRate + variation + 1.5;
    
    return {
      date: date,
      currency: currency,
      buyingRate: parseFloat(buyingRate.toFixed(2)),
      sellingRate: parseFloat(sellingRate.toFixed(2)),
      source: 'Fallback Rate (CBSL data temporarily unavailable)',
      averageRate: parseFloat(((buyingRate + sellingRate) / 2).toFixed(2))
    };
  }
}
