const axios = require('axios');
const cheerio = require('cheerio');

// Currency mapping for CBSL API
const getCurrencyMapping = (currency) => {
  const mapping = {
    'USD': 'USD',
    'EUR': 'EUR',
    'GBP': 'GBP',
    'AUD': 'AUD',
    'CAD': 'CAD',
    'SGD': 'SGD',
    'JPY': 'JPY',
    'CNY': 'CNY',
    'INR': 'INR'
  };
  return mapping[currency] || currency;
};

// Parse the HTML response from CBSL
const parseCBSLResponse = (htmlString, targetCurrency, exactDate) => {
  try {
    console.log('Parsing HTML for currency:', targetCurrency, 'exactDate:', exactDate);
    const $ = cheerio.load(htmlString);
    const rates = [];
    
    // Debug: log how many rows we find
    const allRows = $('tr');
    console.log('Total rows found:', allRows.length);
    
    $('tr').each(function(index) {
      const cells = $(this).find('td');
      console.log(`Row ${index}: ${cells.length} cells`);
      
      if (cells.length >= 6) {
        const dateCell = $(cells[0]).text().trim();
        const currencyCell = $(cells[1]).text().trim();
        const buyingRateCell = $(cells[4]).text().trim();
        const sellingRateCell = $(cells[5]).text().trim();
        
        console.log(`Row ${index}: Date="${dateCell}", Currency="${currencyCell}", Buying="${buyingRateCell}", Selling="${sellingRateCell}"`);
        
        if (currencyCell === targetCurrency && dateCell && buyingRateCell && sellingRateCell) {
          const parsedDate = parseDate(dateCell);
          const buyingRate = parseFloat(buyingRateCell.replace(/,/g, ''));
          const sellingRate = parseFloat(sellingRateCell.replace(/,/g, ''));
          
          console.log(`Matched currency ${targetCurrency}: parsedDate=${parsedDate}, buyingRate=${buyingRate}, sellingRate=${sellingRate}`);
          
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
    
    console.log(`Found ${rates.length} rates for ${targetCurrency}`);
    
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
  if (!dateStr) return null;
  
  try {
    // Handle different date formats from CBSL
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    } else if (dateStr.includes('-')) {
      return new Date(dateStr);
    }
    
    return new Date(dateStr);
  } catch (error) {
    return null;
  }
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
    
    console.log(`Fetching exchange rate for ${currency} from ${startDate} to ${endDate}, exact date needed: ${exactDate}`);
    console.log('Request body:', JSON.parse(event.body));
    
    // Create the exact form data structure from CBSL
    const currencyMapping = getCurrencyMapping(currency);
    console.log('Currency mapping:', currencyMapping);
    
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
    
    console.log('CBSL Response received, length:', response.data.length);
    console.log('CBSL Response preview (first 500 chars):', response.data.substring(0, 500));
    console.log('CBSL Response parsing...');
    
    const exchangeRateData = parseCBSLResponse(response.data, currency, exactDate);
    
    console.log('Parsed exchange rate data:', exchangeRateData);
    
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
