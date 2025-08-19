// Environment configuration for Google OAuth
export const authConfig = {
  // Replace this with your actual Google OAuth Client ID
  // To get a Client ID:
  // 1. Go to https://console.cloud.google.com/
  // 2. Create a new project or select an existing one
  // 3. Enable the Google Identity API
  // 4. Create OAuth 2.0 credentials
  // 5. Add your domain to authorized origins
  googleClientId: '615158904505-v8qrmar64m99vs5eqf16sp5ssaf04hti.apps.googleusercontent.com',
  
  // Optional: You can add different client IDs for different environments
  development: {
    googleClientId: 'YOUR_DEV_CLIENT_ID_HERE'
  },
  production: {
    googleClientId: 'YOUR_PROD_CLIENT_ID_HERE'
  }
};
