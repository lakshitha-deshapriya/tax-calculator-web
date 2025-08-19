const axios = require('axios');
const cheerio = require('cheerio');

// Supported currencies based on CBSL official support
const SUPPORTED_CURRENCIES = [
  'USD', // United States Dollar
  'EUR', // Euro
  'GBP', // British Pound
  'AUD', // Australian Dollar
  'CAD', // Canadian Dollar
  'CHF', // Swiss Franc
  'CNY', // Renminbi
  'JPY', // Yen
  'SGD'  // Singapore Dollar
];

// Currency mapping for CBSL API
const getCurrencyMapping = (currency) => {
  const mapping = {
    'USD': 'USD',
    'EUR': 'EUR',
    'GBP': 'GBP',
    'AUD': 'AUD',
    'CAD': 'CAD',
    'CHF': 'CHF',
    'SGD': 'SGD',
    'JPY': 'JPY',
    'CNY': 'CNY'
  };
  return mapping[currency] || currency;
};

// Parse the HTML response from CBSL
const parseCBSLResponse = (htmlString, targetCurrency, exactDate) => {
  try {
    const $ = cheerio.load(htmlString);
    const rates = [];
    
    $('tr').each(function(index) {
      const cells = $(this).find('td');
      
      if (cells.length >= 3) {
        const dateCell = $(cells[0]).text().trim();
        // For this table structure: [Date] [Buy Rate (LKR)] [Sell Rate (LKR)]
        // There's no currency column, so we use the requested currency
        const buyingRateCell = $(cells[1]).text().trim();
        const sellingRateCell = $(cells[2]).text().trim();
        
        if (dateCell && buyingRateCell && sellingRateCell) {
          const parsedDate = parseDate(dateCell);
          const buyingRate = parseFloat(buyingRateCell.replace(/,/g, ''));
          const sellingRate = parseFloat(sellingRateCell.replace(/,/g, ''));
          
          if (parsedDate && !isNaN(buyingRate) && !isNaN(sellingRate)) {
            rates.push({
              date: parsedDate,
              currency: targetCurrency, // Use the requested currency since it's not in the table
              buyingRate: buyingRate,
              sellingRate: sellingRate,
              source: 'Central Bank of Sri Lanka (CBSL)',
              averageRate: (buyingRate + sellingRate) / 2
            });
          }
        }
      } else if (cells.length >= 6) {
        // Fallback: Handle the old format with currency column if it exists
        const dateCell = $(cells[0]).text().trim();
        const currencyCell = $(cells[1]).text().trim();
        const buyingRateCell = $(cells[4]).text().trim();
        const sellingRateCell = $(cells[5]).text().trim();
        
        if (currencyCell === targetCurrency && dateCell && buyingRateCell && sellingRateCell) {
          const parsedDate = parseDate(dateCell);
          const buyingRate = parseFloat(buyingRateCell.replace(/,/g, ''));
          const sellingRate = parseFloat(sellingRateCell.replace(/,/g, ''));
          
          if (parsedDate && !isNaN(buyingRate) && !isNaN(sellingRate)) {
            rates.push({
              date: parsedDate,
              currency: targetCurrency,
              buyingRate: buyingRate,
              sellingRate: sellingRate,
              source: 'Central Bank of Sri Lanka (CBSL)',
              averageRate: (buyingRate + sellingRate) / 2
            });
          }
        }
      }
    });
    
    if (rates.length === 0) {
      return null;
    }
    
    // If exactDate is specified, find the exact match
    if (exactDate) {
      const exactMatch = rates.find(rate => {
        const rateDate = new Date(rate.date);
        const targetDate = new Date(exactDate);
        return rateDate.toDateString() === targetDate.toDateString();
      });
      
      if (exactMatch) {
        return exactMatch;
      }
    }
    
    // Return the most recent rate
    rates.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rates[0];
    
  } catch (error) {
    console.error('Error parsing CBSL response:', error);
    return null;
  }
};

// Parse date from CBSL format
const parseDate = (dateStr) => {
  if (!dateStr) {
    return null;
  }
  
  try {
    // Clean the date string
    const cleanDateStr = dateStr.trim();
    
    // Handle different date formats from CBSL
    if (cleanDateStr.includes('/')) {
      const parts = cleanDateStr.split('/');
      if (parts.length >= 3) {
        // Assume MM/DD/YYYY format
        const month = parseInt(parts[0]) - 1; // Month is 0-indexed
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    
    // Try parsing as a standard date string
    const date = new Date(cleanDateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
  } catch (error) {
    return null;
  }
  
  return null;
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { startDate, endDate, currency, exactDate } = JSON.parse(event.body);
    
    // Validate currency support
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `Currency ${currency} is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
        })
      };
    }
    
    // Check if the dates are in the future (CBSL won't have data for future dates)
    const today = new Date();
    const requestDate = new Date(exactDate);
    
    if (requestDate > today) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `Exchange rates are not available for future dates. CBSL only publishes rates for past and current working days. Requested date: ${exactDate}, Today: ${today.toISOString().split('T')[0]}`
        })
      };
    }
    
    // Create the exact form data structure from CBSL
    const currencyMapping = getCurrencyMapping(currency);
    
    const formData = new URLSearchParams();
    formData.append('lookupPage', 'lookup_daily_exchange_rates.php');
    formData.append('startRange', '2006-11-11');
    formData.append('rangeType', 'dates');
    formData.append('txtStart', startDate);
    formData.append('txtEnd', endDate);
    formData.append('chk_cur[]', currencyMapping);
    formData.append('submit_button', 'Submit');
    
    // Make request to CBSL
    const response = await axios.post(
      'https://www.cbsl.gov.lk/cbsl_custom/exratestt/exrates_resultstt.php',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Referer': 'https://www.cbsl.gov.lk/cbsl_custom/exratestt/exratestt.php',
          'Origin': 'https://www.cbsl.gov.lk',
        },
        timeout: 30000
      }
    );
    
    if (!response.data) {
      throw new Error('No data received from CBSL');
    }
    
    const exchangeRateData = parseCBSLResponse(response.data, currency, exactDate);
    
    if (!exchangeRateData) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `No exchange rate data found for ${currency} in the specified date range`
        })
      };
    }
    
    console.log('Exchange rate data found:', exchangeRateData);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: exchangeRateData
      })
    };
    
  } catch (error) {
    console.error('Error in cbsl-proxy function:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
