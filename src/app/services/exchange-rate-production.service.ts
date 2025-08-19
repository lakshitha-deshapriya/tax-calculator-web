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
export class ExchangeRateProductionService {
  // This will be set to your Netlify site URL when deployed
  private readonly baseUrl = 'https://tax-calculator-web.netlify.app';

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
      
      // Always use the exact date range - no expansion to ensure exact date matching
      const actualStartDateStr = startDateStr;
      const actualEndDateStr = endDateStr;

      // Use our Netlify function to fetch CBSL data
      const requestBody = {
        startDate: actualStartDateStr,
        endDate: actualEndDateStr,
        currency: currency,
        exactDate: this.formatDate(originalRequestedDate) // Send the exact date we want
      };

      const response = await this.http.post<any>(`${this.baseUrl}/api/cbsl/exchange-rate`, requestBody).toPromise();

      if (response && response.success) {
        console.log('Successfully received CBSL data via Netlify function:', response.data);
        return {
          date: new Date(response.data.date),
          currency: response.data.currency,
          buyingRate: response.data.buyingRate,
          sellingRate: response.data.sellingRate,
          source: response.data.source,
          averageRate: response.data.averageRate
        };
      } else {
        console.warn('No data received from CBSL via Netlify function');
        return null;
      }
    } catch (error) {
      console.error('Error fetching data from CBSL via Netlify function:', error);
      throw error;
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns a list of supported currencies based on CBSL official support
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
}
