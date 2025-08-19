import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, timeout, retry } from 'rxjs/operators';

export interface ExchangeRateData {
  date: Date;
  currency: string;
  buyingRate: number;
  sellingRate: number;
  source: string;
  averageRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateGithubPagesService {
  private corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/'
  ];

  constructor(private http: HttpClient) { }

  getExchangeRate(currency: string, date: Date): Observable<ExchangeRateData> {
    const startDateStr = this.formatDateForAPI(date);
    const endDateStr = startDateStr;

    return this.tryProxiesSequentially(0, startDateStr, endDateStr, currency, date)
      .pipe(
        timeout(15000),
        retry(2),
        catchError(() => {
          console.warn('All CORS proxies failed for CBSL, trying alternative APIs');
          return this.tryAlternativeAPIs(currency, date);
        })
      );
  }

  getSupportedCurrencies(): { code: string, name: string }[] {
    return [
      { code: 'USD', name: 'US Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'SGD', name: 'Singapore Dollar' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'CNY', name: 'Chinese Yuan' },
      { code: 'INR', name: 'Indian Rupee' }
    ];
  }

  private formatDateForAPI(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private tryProxiesSequentially(proxyIndex: number, startDateStr: string, endDateStr: string, currency: string, originalDate: Date): Observable<ExchangeRateData> {
    if (proxyIndex >= this.corsProxies.length) {
      throw new Error('All CORS proxies failed');
    }

    const proxy = this.corsProxies[proxyIndex];
    
    // Try the main exchange rates page first for current rates
    const cbslMainUrl = `https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-buy-and-sell-exchange-rates`;
    const fullMainUrl = `${proxy}${encodeURIComponent(cbslMainUrl)}`;

    return this.http.get(fullMainUrl, {
      responseType: 'text'
    }).pipe(
      map(response => this.parseCBSLMainPageResponse(response, currency, originalDate)),
      catchError(() => {
        // If main page fails, try the old API endpoint
        return this.tryOldCBSLAPI(proxyIndex, startDateStr, endDateStr, currency, originalDate);
      })
    );
  }

  private tryOldCBSLAPI(proxyIndex: number, startDateStr: string, endDateStr: string, currency: string, originalDate: Date): Observable<ExchangeRateData> {
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
        if (proxyIndex + 1 < this.corsProxies.length) {
          return this.tryProxiesSequentially(proxyIndex + 1, startDateStr, endDateStr, currency, originalDate);
        } else {
          throw new Error('All proxies failed');
        }
      })
    );
  }

  private parseCBSLMainPageResponse(htmlResponse: string, currency: string, date: Date): ExchangeRateData {
    console.log('Parsing CBSL main page response for', currency);
    
    // Parse the main CBSL page for current exchange rates
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlResponse, 'text/html');
    
    // Look for table with exchange rates - CBSL typically uses tables for rate display
    const tables = doc.querySelectorAll('table');
    
    // Try to find rates in various table structures
    for (const table of Array.from(tables)) {
      const result = this.extractRatesFromTable(table, currency, date);
      if (result) return result;
    }
    
    // If no tables found, try to find rates in div elements with common patterns
    const allText = doc.body.textContent || '';
    const result = this.extractRatesFromText(allText, currency, date);
    if (result) return result;
    
    throw new Error(`Currency ${currency} not found in CBSL main page response`);
  }

  private extractRatesFromTable(table: Element, currency: string, date: Date): ExchangeRateData | null {
    const rows = table.querySelectorAll('tr');
    
    for (const row of Array.from(rows)) {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 3) {
        for (let i = 0; i < cells.length - 2; i++) {
          const cellText = cells[i]?.textContent?.trim();
          
          if (cellText && (cellText.includes(currency) || cellText === currency)) {
            // Found currency, look for rates in next cells
            const buyingRate = this.extractRate(cells[i + 1]?.textContent);
            const sellingRate = this.extractRate(cells[i + 2]?.textContent);
            
            if (buyingRate > 0 && sellingRate > 0) {
              console.log('Found rates in table:', {currency, buyingRate, sellingRate});
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
    
    return null;
  }

  private extractRatesFromText(text: string, currency: string, date: Date): ExchangeRateData | null {
    // Look for patterns like "USD 299.50 309.50" or similar in the text
    const patterns = [
      new RegExp(`${currency}\\s+([0-9,\\.]+)\\s+([0-9,\\.]+)`, 'i'),
      new RegExp(`${currency}[:\\s]+([0-9,\\.]+)[\\s/]+([0-9,\\.]+)`, 'i'),
      new RegExp(`${currency}.*?([0-9,\\.]+).*?([0-9,\\.]+)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const rate1 = this.extractRate(match[1]);
        const rate2 = this.extractRate(match[2]);
        
        if (rate1 > 0 && rate2 > 0) {
          // Assume first rate is buying, second is selling (or vice versa based on values)
          const buyingRate = rate1 < rate2 ? rate1 : rate2;
          const sellingRate = rate1 > rate2 ? rate1 : rate2;
          
          console.log('Found rates in text:', {currency, buyingRate, sellingRate});
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
    
    return null;
  }

  private extractRate(rateString: string | null | undefined): number {
    if (!rateString) return 0;
    
    // Remove commas and convert to number
    const cleaned = rateString.replace(/[^\d.]/g, '').trim();
    const rate = parseFloat(cleaned);
    
    return isNaN(rate) ? 0 : rate;
  }

  private parseCBSLResponse(htmlResponse: string, currency: string, date: Date): ExchangeRateData {
    console.log('Parsing CBSL API response for', currency);
    
    // Parse HTML response to extract exchange rate data
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlResponse, 'text/html');

    // Look for table rows containing exchange rate data
    const rows = doc.querySelectorAll('tr');
    
    for (const row of Array.from(rows)) {
      const cells = row.querySelectorAll('td');
      
      if (cells.length >= 6) {
        const currencyCell = cells[1]?.textContent?.trim();
        
        if (currencyCell === currency) {
          const buyingRateText = cells[4]?.textContent?.trim() || '';
          const sellingRateText = cells[5]?.textContent?.trim() || '';
          
          const buyingRate = this.parseRateFromText(buyingRateText);
          const sellingRate = this.parseRateFromText(sellingRateText);
          
          if (buyingRate > 0 && sellingRate > 0) {
            console.log('Found rates in API response:', {currency, buyingRate, sellingRate});
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
    
    throw new Error(`Currency ${currency} not found in CBSL response`);
  }

  private parseRateFromText(rateText: string): number {
    if (!rateText) return 0;
    
    const cleanRate = rateText.replace(/,/g, '').trim();
    const rate = parseFloat(cleanRate);
    
    return isNaN(rate) ? 0 : rate;
  }

  private tryAlternativeAPIs(currency: string, date: Date): Observable<ExchangeRateData> {
    console.warn('Using alternative API for', currency);
    
    // Try ExchangeRate-API as fallback
    return this.http.get<any>(`https://api.exchangerate-api.com/v4/latest/LKR`).pipe(
      map(response => {
        const rate = response.rates[currency];
        if (rate) {
          // Convert from LKR base to currency (inverse rate)
          const lkrToUsd = 1 / rate;
          const spread = 0.02; // 2% spread estimation
          
          return {
            date: date,
            currency: currency,
            buyingRate: lkrToUsd * (1 - spread),
            sellingRate: lkrToUsd * (1 + spread),
            source: 'ExchangeRate-API (Estimated)',
            averageRate: lkrToUsd
          };
        }
        throw new Error(`Currency ${currency} not found in alternative API`);
      }),
      catchError(() => this.tryFixerAPI(currency, date))
    );
  }

  private tryFixerAPI(currency: string, date: Date): Observable<ExchangeRateData> {
    console.warn('Using Fixer API for', currency);
    
    // Fixer.io as another fallback (limited free tier)
    return this.http.get<any>(`https://api.fixer.io/latest?base=LKR`).pipe(
      map(response => {
        const rate = response.rates[currency];
        if (rate) {
          const spread = 0.02;
          
          return {
            date: date,
            currency: currency,
            buyingRate: rate * (1 - spread),
            sellingRate: rate * (1 + spread),
            source: 'Fixer.io (Estimated)',
            averageRate: rate
          };
        }
        throw new Error(`Currency ${currency} not found in Fixer.io`);
      }),
      catchError(() => this.getStaticFallback(currency, date))
    );
  }

  private getStaticFallback(currency: string, date: Date): Observable<ExchangeRateData> {
    console.warn('Using static fallback rates for', currency);
    
    // Static fallback rates (approximate current rates)
    const staticRates: { [key: string]: { buying: number, selling: number } } = {
      'USD': { buying: 299.50, selling: 309.50 },
      'EUR': { buying: 325.00, selling: 335.00 },
      'GBP': { buying: 380.00, selling: 390.00 },
      'AUD': { buying: 195.00, selling: 205.00 },
      'CAD': { buying: 220.00, selling: 230.00 },
      'SGD': { buying: 220.00, selling: 230.00 },
      'JPY': { buying: 2.05, selling: 2.15 },
      'CNY': { buying: 41.50, selling: 43.50 },
      'INR': { buying: 3.55, selling: 3.75 }
    };

    const rates = staticRates[currency];
    if (rates) {
      return of({
        date: date,
        currency: currency,
        buyingRate: rates.buying,
        sellingRate: rates.selling,
        source: 'Static Fallback (Approximate)',
        averageRate: (rates.buying + rates.selling) / 2
      });
    }

    return throwError(() => new Error(`Currency ${currency} not supported`));
  }
}
