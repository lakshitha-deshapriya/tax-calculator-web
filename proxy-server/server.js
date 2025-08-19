const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Proxy endpoint for CBSL exchange rates
app.post('/api/cbsl/exchange-rate', async (req, res) => {
  try {
    const { startDate, endDate, currency, exactDate } = req.body;
    
    console.log(`Fetching exchange rate for ${currency} from ${startDate} to ${endDate}, exact date needed: ${exactDate}`);
    
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
    
    if (response.status === 200) {
      const exchangeRateData = parseCBSLResponse(response.data, exactDate, currency);
      
      if (exchangeRateData) {
        console.log('Successfully fetched and parsed CBSL data:', exchangeRateData);
        res.json({ success: true, data: exchangeRateData });
      } else {
        console.log(`No exchange rate data found for exact date: ${exactDate}`);
        res.json({ 
          success: false, 
          error: `No exchange rate available for ${exactDate} from Central Bank of Sri Lanka (CBSL). Exchange rates are only available for working days when the bank publishes them.` 
        });
      }
    } else {
      console.error('CBSL request failed with status:', response.status);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch data from CBSL' 
      });
    }
    
  } catch (error) {
    console.error('Error fetching CBSL data:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error connecting to CBSL website. Please try again later.' 
    });
  }
});

function getCurrencyMapping(currency) {
  const mappings = {
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

function parseCBSLResponse(responseBody, exactDateStr, currency) {
  try {
    const $ = cheerio.load(responseBody);
    const tables = $('table');
    
    if (tables.length === 0) {
      console.log('No tables found in CBSL response');
      return null;
    }
    
    console.log(`Looking for exact date: ${exactDateStr}`);
    
    // Look for the exchange rate table
    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const rows = table.find('tr');
      
      if (rows.length < 2) continue;
      
      // Check if this looks like an exchange rate table
      const headerRow = $(rows[0]);
      const headerCells = headerRow.find('td, th');
      const headerTexts = [];
      
      headerCells.each((index, cell) => {
        headerTexts.push($(cell).text().trim().toLowerCase());
      });
      
      // Look for table with Date, Buy Rate, Sell Rate columns
      const hasDate = headerTexts.some(text => text.includes('date'));
      const hasBuy = headerTexts.some(text => text.includes('buy'));
      const hasSell = headerTexts.some(text => text.includes('sell'));
      
      if (hasDate && hasBuy && hasSell) {
        console.log('Found exchange rate table, parsing rows...');
        
        // Parse exchange rate data from this table
        for (let j = 1; j < rows.length; j++) {
          const row = $(rows[j]);
          const cells = row.find('td, th');
          const cellTexts = [];
          
          cells.each((index, cell) => {
            cellTexts.push($(cell).text().trim());
          });
          
          if (cellTexts.length >= 3) {
            try {
              const dateStr = cellTexts[0];
              const buyRateStr = cellTexts[1].replace(/,/g, '');
              const sellRateStr = cellTexts[2].replace(/,/g, '');
              
              console.log(`Found row: Date=${dateStr}, Buy=${buyRateStr}, Sell=${sellRateStr}`);
              
              // Parse the date and check if it matches exactly
              const rowDate = new Date(dateStr);
              const exactDate = new Date(exactDateStr);
              
              // Check if this row matches the exact date we want
              if (!isNaN(rowDate.getTime()) && 
                  rowDate.getFullYear() === exactDate.getFullYear() &&
                  rowDate.getMonth() === exactDate.getMonth() &&
                  rowDate.getDate() === exactDate.getDate()) {
                
                const buyRate = parseFloat(buyRateStr);
                const sellRate = parseFloat(sellRateStr);
                
                if (!isNaN(buyRate) && !isNaN(sellRate)) {
                  console.log(`✅ EXACT MATCH FOUND for ${exactDateStr}!`);
                  
                  return {
                    date: rowDate,
                    currency: currency,
                    buyingRate: buyRate,
                    sellingRate: sellRate,
                    source: 'Central Bank of Sri Lanka (CBSL)',
                    averageRate: (buyRate + sellRate) / 2
                  };
                }
              }
            } catch (e) {
              console.error(`Error parsing row ${j}:`, e);
            }
          }
        }
      }
    }
    
    console.log(`❌ No exchange rate found for exact date: ${exactDateStr}`);
    return null;
    
  } catch (error) {
    console.error('Error parsing CBSL response:', error);
    return null;
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CBSL Proxy Server is running' });
});

app.listen(PORT, () => {
  console.log(`CBSL Proxy Server running on http://localhost:${PORT}`);
  console.log('Health check: http://localhost:3001/health');
});

module.exports = app;
