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
      
      if (cells.length >= 3) {
        const dateCell = $(cells[0]).text().trim();
        // For this table structure: [Date] [Buy Rate (LKR)] [Sell Rate (LKR)]
        // There's no currency column, so we use the requested currency
        const buyingRateCell = $(cells[1]).text().trim();
        const sellingRateCell = $(cells[2]).text().trim();
        
        console.log(`Row ${index}: Date="${dateCell}", BuyRate="${buyingRateCell}", SellRate="${sellingRateCell}"`);
        
        if (dateCell && buyingRateCell && sellingRateCell) {
          const parsedDate = parseDate(dateCell);
          const buyingRate = parseFloat(buyingRateCell.replace(/,/g, ''));
          const sellingRate = parseFloat(sellingRateCell.replace(/,/g, ''));
          
          console.log(`Processing row ${index}: parsedDate=${parsedDate}, buyingRate=${buyingRate}, sellingRate=${sellingRate}`);
          
          if (parsedDate && !isNaN(buyingRate) && !isNaN(sellingRate)) {
            console.log(`Valid data found for ${targetCurrency} on ${parsedDate}`);
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
        
        console.log(`Row ${index} (old format): Date="${dateCell}", Currency="${currencyCell}", Buying="${buyingRateCell}", Selling="${sellingRateCell}"`);
        
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
  if (!dateStr) {
    console.log('parseDate: empty dateStr');
    return null;
  }
  
  console.log('parseDate: attempting to parse:', dateStr);
  
  try {
    // Clean the date string
    const cleanDateStr = dateStr.trim();
    
    // Handle different date formats from CBSL
    if (cleanDateStr.includes('/')) {
      const parts = cleanDateStr.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY format
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
        const year = parseInt(parts[2]);
        const parsedDate = new Date(year, month, day);
        console.log('parseDate: parsed DD/MM/YYYY format:', parsedDate);
        return parsedDate;
      }
    } else if (cleanDateStr.includes('-')) {
      // Handle YYYY-MM-DD format
      const parsedDate = new Date(cleanDateStr);
      console.log('parseDate: parsed YYYY-MM-DD format:', parsedDate);
      return parsedDate;
    } else if (cleanDateStr.match(/^\d{1,2}\s+\w+\s+\d{4}$/)) {
      // Handle "DD Month YYYY" format (e.g., "11 August 2025")
      const parsedDate = new Date(cleanDateStr);
      console.log('parseDate: parsed DD Month YYYY format:', parsedDate);
      return parsedDate;
    }
    
    // Try direct parsing as fallback
    const parsedDate = new Date(cleanDateStr);
    console.log('parseDate: fallback parsing result:', parsedDate);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  } catch (error) {
    console.log('parseDate: error parsing', dateStr, ':', error);
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
    
    // Check if the dates are in the future (CBSL won't have data for future dates)
    const today = new Date();
    const requestDate = new Date(exactDate);
    
    if (requestDate > today) {
      console.log('Requested date is in the future, CBSL will not have this data');
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
    console.log('Currency mapping:', currencyMapping);
    
    const formData = new URLSearchParams();
    formData.append('lookupPage', 'lookup_daily_exchange_rates.php');
    formData.append('startRange', '2006-11-11');
    formData.append('rangeType', 'dates');
    formData.append('txtStart', startDate);
    formData.append('txtEnd', endDate);
    formData.append('chk_cur[]', currencyMapping);
    formData.append('submit_button', 'Submit');
    
    console.log('Form data being sent to CBSL:', formData.toString());
    
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
    console.log('CBSL Response preview (first 1000 chars):', response.data.substring(0, 1000));
    
    // Let's also check if there's any table content
    const $ = cheerio.load(response.data);
    const tables = $('table');
    console.log('Number of tables found:', tables.length);
    
    tables.each(function(i) {
      console.log('\n=== TABLE ' + i + ' ===');
      console.log('Table ' + i + ' HTML:', $(this).html());
      console.log('Table ' + i + ' text content:', $(this).text().trim());
      
      const rows = $(this).find('tr');
      console.log('Table ' + i + ' has ' + rows.length + ' rows');
      
      rows.each(function(rowIndex) {
        const cells = $(this).find('td, th');
        const cellTexts = [];
        cells.each(function() {
          cellTexts.push($(this).text().trim());
        });
        console.log('Table ' + i + ', Row ' + rowIndex + ': [' + cellTexts.join('] [') + ']');
      });
      console.log('=== END TABLE ' + i + ' ===\n');
    });
    
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
