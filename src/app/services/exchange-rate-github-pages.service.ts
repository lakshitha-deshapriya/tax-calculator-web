import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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
export class ExchangeRateGithubPagesService {
  
  // Multiple CORS proxy services as fallbacks
  private corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/'
  ];

  // Static exchange rate data as ultimate fallback
  private staticRates: { [currency: string]: { buying: number, selling: number } } = {
    'USD': { buying: 299.50, selling: 309.50 },
    'EUR': { buying: 325.75, selling: 336.25 },
    'GBP': { buying: 378.50, selling: 390.50 },
    'JPY': { buying: 2.05, selling: 2.15 },
    'AUD': { buying: 199.25, selling: 206.75 },
    'CAD': { buying: 221.50, selling: 229.50 },
    'CHF': { buying: 337.25, selling: 348.75 },
    'SEK': { buying: 28.75, selling: 29.75 },
    'NOK': { buying: 28.25, selling: 29.25 },
    'DKK': { buying: 43.50, selling: 45.50 }
  };

  constructor(private http: HttpClient) {}

  /**
   * Fetches exchange rate for a specific currency and date
   */
  getExchangeRate(date: Date, currency: string): Observable<ExchangeRateData> {
    return this.getExchangeRateForDateRange(date, date, currency);
  }

  /**
   * Fetches exchange rate for a specific currency and date range
   */
  getExchangeRateForDateRange(startDate: Date, endDate: Date, currency: string): Observable<ExchangeRateData> {
    // Try to fetch from CBSL with CORS proxies
    return this.tryFetchFromCBSL(startDate, endDate, currency).pipe(
      catchError(() => {
        // If CBSL fails, try alternative APIs
        return this.tryAlternativeAPIs(currency, startDate);
      }),
      catchError(() => {
        // If all APIs fail, use static data with disclaimer
        return this.getStaticRate(currency, startDate);
      })
    );
  }

  private tryFetchFromCBSL(startDate: Date, endDate: Date, currency: string): Observable<ExchangeRateData> {
    const startDateStr = this.formatDate(startDate);
    const endDateStr = this.formatDate(endDate);
    
    // Try each CORS proxy until one works
    return this.tryProxiesSequentially(0, startDateStr, endDateStr, currency, startDate);
  }

  private tryProxiesSequentially(proxyIndex: number, startDateStr: string, endDateStr: string, currency: string, originalDate: Date): Observable<ExchangeRateData> {
    if (proxyIndex >= this.corsProxies.length) {
      throw new Error('All CORS proxies failed');
    }

    const proxy = this.corsProxies[proxyIndex];
    const cbslUrl = `https://www.cbsl.gov.lk/cbsl_custom/exchangerates/date_exchangerates.php`;
    const fullUrl = `${proxy}${encodeURIComponent(cbslUrl)}`;

    const requestBody = new URLSearchParams();
    requestBody.append('startdate', startDateStr);
    requestBody.append('enddate', endDateStr);

    return this.http.post(fullUrl, requestBody.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      responseType: 'text'
    }).pipe(
      map(response => this.parseCBSLResponse(response, currency, originalDate)),
      catchError(() => {
        // Try next proxy
        return this.tryProxiesSequentially(proxyIndex + 1, startDateStr, endDateStr, currency, originalDate);
      })
    );
  }

  private parseCBSLResponse(htmlResponse: string, currency: string, date: Date): ExchangeRateData {
    // Parse HTML response to extract exchange rate data
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlResponse, 'text/html');
    
    // Look for table with exchange rates
    const tables = doc.querySelectorAll('table');
    
    for (const table of Array.from(tables)) {
      const rows = table.querySelectorAll('tr');
      
      for (const row of Array.from(rows)) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          const currencyCell = cells[1]?.textContent?.trim();
          
          if (currencyCell && currencyCell.includes(currency)) {
            const buyingRate = parseFloat(cells[2]?.textContent?.replace(/,/g, '') || '0');
            const sellingRate = parseFloat(cells[3]?.textContent?.replace(/,/g, '') || '0');
            
            if (buyingRate > 0 && sellingRate > 0) {
              return {
                date: date,
                currency: currency,
                buyingRate: buyingRate,
                sellingRate: sellingRate,
                source: 'CBSL (Central Bank of Sri Lanka)',
                averageRate: (buyingRate + sellingRate) / 2
              };
            }
          }
        }
      }
    }
    
    throw new Error(`Currency ${currency} not found in CBSL response`);
  }

  private tryAlternativeAPIs(currency: string, date: Date): Observable<ExchangeRateData> {
    // Try exchangerate-api.com (free tier available)
    return this.http.get<any>(`https://api.exchangerate-api.com/v4/latest/LKR`).pipe(
      map(response => {
        if (response && response.rates && response.rates[currency]) {
          const lkrPerUnit = 1 / response.rates[currency];
          
          return {
            date: date,
            currency: currency,
            buyingRate: lkrPerUnit * 0.995, // Approximate spread
            sellingRate: lkrPerUnit * 1.005,
            source: 'ExchangeRate-API (Estimated)',
            averageRate: lkrPerUnit
          };
        }
        throw new Error('Currency not found in alternative API');
      }),
      catchError(() => {
        // Try fixer.io as another alternative
        return this.tryFixerAPI(currency, date);
      })
    );
  }

  private tryFixerAPI(currency: string, date: Date): Observable<ExchangeRateData> {
    // Using free tier of fixer.io (requires registration but has free tier)
    const fixerUrl = `https://api.fixer.io/latest?base=${currency}&symbols=LKR`;
    
    return this.http.get<any>(fixerUrl).pipe(
      map(response => {
        if (response && response.rates && response.rates.LKR) {
          const lkrPerUnit = response.rates.LKR;
          
          return {
            date: date,
            currency: currency,
            buyingRate: lkrPerUnit * 0.995,
            sellingRate: lkrPerUnit * 1.005,
            source: 'Fixer.io API (Estimated)',
            averageRate: lkrPerUnit
          };
        }
        throw new Error('Currency not found in Fixer API');
      })
    );
  }

  private getStaticRate(currency: string, date: Date): Observable<ExchangeRateData> {
    const rates = this.staticRates[currency];
    
    if (rates) {
      return of({
        date: date,
        currency: currency,
        buyingRate: rates.buying,
        sellingRate: rates.selling,
        source: 'Static Reference Data (Not Real-time)',
        averageRate: (rates.buying + rates.selling) / 2
      });
    }
    
    throw new Error(`No exchange rate data available for ${currency}`);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get available currencies
   */
  getAvailableCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK'];
  }

  /**
   * Get supported currencies with names (for compatibility with existing component)
   */
  getSupportedCurrencies(): { code: string, name: string }[] {
    return [
      { code: 'USD', name: 'US Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'SEK', name: 'Swedish Krona' },
      { code: 'NOK', name: 'Norwegian Krone' },
      { code: 'DKK', name: 'Danish Krone' }
    ];
  }

  /**
   * Check if service is online and working
   */
  checkServiceHealth(): Observable<boolean> {
    return this.http.get('https://api.exchangerate-api.com/v4/latest/USD').pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
