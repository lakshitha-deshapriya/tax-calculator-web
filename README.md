# Tax Calculator Web

An Angular-based web application for calculating income tax based on salary amounts and currency conversions using real-time exchange rates from the Central Bank of Sri Lanka (CBSL).

## Features

### ✅ Implemented (Initial Functionality)

1. **Default Settings Configuration**
   - Set default salary date (day of the month)
   - Set default currency for salary entries
   - Data persisted in localStorage

2. **Salary Management**
   - Add monthly salary entries with amount, currency, and date
   - Automatic exchange rate lookup using CBSL buying rates
   - Salary date defaults to configured default date
   - View all salary entries with LKR conversion
   - Delete salary entries

3. **Financial Year Management**
   - Financial year runs from April 1st to March 31st
   - Automatic grouping of salary entries by financial year
   - Total annual salary calculation in LKR

4. **Exchange Rate Integration**
   - Real-time exchange rates from CBSL
   - Uses buying rate for all salary conversions
   - Historical exchange rate lookup for reference
   - Automatic rate application when adding salary entries

5. **Browser-First Data Management**
   - All data saved to browser localStorage immediately (fast, reliable)
   - Works fully offline without internet or authentication
   - Data persists across browser sessions and restarts
   - All calculations use browser data for maximum speed

6. **Cloud Backup & Synchronization**
   - **Browser-First Approach**: Local storage is primary, cloud is backup
   - **Google Sign-In**: Optional authentication for cloud features
   - **Automatic Sync**: When signed in, data automatically backs up to cloud
   - **Cross-Device Access**: Signed-in users can access data from any device
   - **Smart Merging**: Cloud data syncs seamlessly with local data
   - **Manual Controls**: Backup All / Restore from Cloud buttons
   - **Error Resilient**: Cloud sync failures don't affect local functionality

### 🔄 Coming Next

1. **Tax Calculation**
   - Implementation of Sri Lankan income tax brackets
   - Automatic tax calculation based on annual salary
   - Tax breakdown by financial year

2. **Enhanced Features**
   - Export functionality (PDF/Excel)
   - Tax payment reminders
   - Multi-year tax comparison

## Technology Stack

- **Frontend**: Angular 19.1.5
- **Styling**: Custom CSS with modern design
- **Data Storage**: Browser localStorage + Firebase Cloud Storage (optional)
- **Authentication**: Google OAuth 2.0
- **Exchange Rate API**: CBSL (Central Bank of Sri Lanka)
- **Cloud Backend**: Firebase Firestore (optional)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd tax-calculator-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:4200/`

### Firebase Cloud Sync Setup (Optional)

To enable cloud synchronization of configurations:

1. **Set up Firebase project** (see [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed instructions):
   - Create a Firebase project
   - Enable Firestore Database
   - Configure authentication
   - Set up security rules

2. **Configure the application**:
   - Update `src/app/config/firebase.config.ts` with your Firebase configuration
   - Set `firebaseEnabled = true`

3. **Configure Google OAuth**:
   - Update `src/app/config/auth.config.ts` with your Google OAuth client ID
   - Ensure OAuth client is configured for both Firebase and direct Google sign-in

### Usage

1. **Configure Default Settings**
   - Go to the "Settings" tab
   - Set your preferred default salary date (e.g., 1st, 15th, etc.)
   - Select your default salary currency
   - All changes save automatically to browser storage

2. **Add Salary Entries**
   - Go to the "Salary Management" tab
   - Select the month for which you want to add salary
   - Enter salary amount and select currency
   - The system will automatically fetch the exchange rate for that date
   - Click "Add Salary Entry" to save (instantly saved to browser + cloud backup if signed in)

3. **View Tax Summary**
   - Go to the "Tax Calculator" tab
   - View your salary entries grouped by financial year
   - See total annual salary in LKR
   - All calculations use fast browser data

4. **Cloud Backup (Optional)**
   - **For Guest Users**: App works fully with browser storage only
   - **Sign in with Google**: Enables automatic cloud backup
   - **Auto-Sync**: When signed in, all data automatically backs up to cloud
   - **Cross-Device**: Access your data from any device when signed in
   - **Manual Controls**: Use "Backup All to Cloud" / "Restore from Cloud" buttons in Settings
   - **Data Safety**: Browser data is primary, cloud is backup for reliability

## Architecture

### Key Components

### Key Components

- **TaxConfigService**: Manages configuration and localStorage operations
- **DataSyncService**: Browser-first data management with cloud backup orchestration
- **ExchangeRateProductionService**: Handles CBSL API integration  
- **GoogleAuthService**: Manages Google OAuth authentication
- **FirebaseService**: Handles cloud synchronization with Firestore (including salary data)
- **ConfigurationService**: Centralized configuration management with cloud sync
- **AppComponent**: Main application component with tabbed interface

### Data Models

- **TaxConfig**: Main configuration object
- **SalaryEntry**: Individual salary entry with exchange rate
- **FinancialYear**: Financial year representation (April-March)

### Financial Year Logic

The application follows Sri Lankan financial year conventions:
- **Financial Year**: April 1st to March 31st of the following year
- **Taxing Month**: Salary received in a month is taxed in the same month
- **Exchange Rate**: Uses CBSL buying rate for the salary date

### Data Flow

1. User configures default settings (saved instantly to browser localStorage)
2. User adds salary entry for a specific month
3. System fetches exchange rate from CBSL for the salary date
4. Salary is converted to LKR and stored in browser + cloud backup (if signed in)
5. Data is grouped by financial year for tax calculation (uses browser data for speed)
6. When user signs in: cloud data is loaded and merged with browser data

## API Integration

The application integrates with the Central Bank of Sri Lanka (CBSL) exchange rate API:
- **Primary Source**: CBSL official exchange rates
- **Rate Used**: Buying rate for all conversions
- **Fallback**: Alternative exchange rate APIs when CBSL is unavailable

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
