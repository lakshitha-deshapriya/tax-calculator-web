import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { authConfig } from '../config/auth.config';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private readonly CLIENT_ID = authConfig.googleClientId; // Uses config file
  private userSubject = new BehaviorSubject<GoogleUser | null>(null);
  public user$ = this.userSubject.asObservable();
  private isInitialized = false;

  constructor() {
    this.loadGoogleScript();
  }

  private loadGoogleScript(): void {
    if (typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => this.initializeGoogleAuth();
      document.head.appendChild(script);
    }
  }

  private initializeGoogleAuth(): void {
    if (!window.google || this.isInitialized) {
      return;
    }

    // Check if CLIENT_ID is configured
    if (this.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      console.warn('Google Client ID not configured. Please update auth.config.ts');
      return;
    }

    console.log('Initializing Google Auth with Client ID:', this.CLIENT_ID);
    console.log('Current origin:', window.location.origin);

    try {
      window.google.accounts.id.initialize({
        client_id: this.CLIENT_ID,
        callback: (response: any) => this.handleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: false,
        ux_mode: 'popup', // Use popup mode to avoid redirect issues
        context: 'signin'
      });

      this.isInitialized = true;
      this.checkStoredUser();
      console.log('Google Auth initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Auth:', error);
    }
  }

  private handleCredentialResponse(response: any): void {
    try {
      // Decode the JWT token to get user information
      const payload = this.decodeJwtPayload(response.credential);
      const user: GoogleUser = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      };

      this.userSubject.next(user);
      this.storeUser(user);
      console.log('User signed in:', user);
    } catch (error) {
      console.error('Error handling credential response:', error);
    }
  }

  private decodeJwtPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT payload:', error);
      return {};
    }
  }

  public signIn(): void {
    console.log('Sign in requested, initialized:', this.isInitialized);
    console.log('Google available:', !!window.google);
    
    if (window.google && this.isInitialized) {
      try {
        console.log('Calling Google prompt...');
        window.google.accounts.id.prompt();
      } catch (error) {
        console.error('Error during sign in:', error);
        this.fallbackSignIn();
      }
    } else {
      console.error('Google Sign-In not properly initialized');
      // Retry initialization
      setTimeout(() => this.initializeGoogleAuth(), 1000);
    }
  }

  private fallbackSignIn(): void {
    console.log('Using fallback sign-in method');
    console.warn('Please check your Google Cloud Console configuration.');
    console.warn('Make sure your current origin is added to authorized JavaScript origins.');
    console.warn('Current origin:', window.location.origin);
  }

  public signOut(): void {
    this.userSubject.next(null);
    this.clearStoredUser();
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    console.log('User signed out');
  }

  public renderSignInButton(element: HTMLElement): void {
    console.log('Rendering sign-in button, initialized:', this.isInitialized);
    
    if (this.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      element.innerHTML = `
        <div style="padding: 20px; border: 2px dashed #ddd; border-radius: 8px; text-align: center; color: #666;">
          <p><strong>Google Sign-In Not Configured</strong></p>
          <p style="font-size: 14px; margin: 10px 0;">Please follow the setup instructions in GOOGLE_SIGNIN_SETUP.md</p>
        </div>
      `;
      return;
    }

    if (window.google && this.isInitialized && element) {
      try {
        console.log('Rendering Google Sign-In button with Client ID:', this.CLIENT_ID);
        window.google.accounts.id.renderButton(element, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: '250'
        });
        console.log('Google Sign-In button rendered successfully');
      } catch (error) {
        console.error('Error rendering Google Sign-In button:', error);
        element.innerHTML = `
          <div style="padding: 15px; border: 2px solid #ff6b6b; border-radius: 8px; text-align: center; color: #721c24; background: #f8d7da;">
            <p><strong>Google Sign-In Error</strong></p>
            <p style="font-size: 14px; margin: 10px 0;">Unable to load sign-in button. Check console for details.</p>
            <p style="font-size: 12px; margin: 5px 0;">Current origin: ${window.location.origin}</p>
          </div>
        `;
      }
    } else {
      console.warn('Google Sign-In not ready:', { 
        google: !!window.google, 
        initialized: this.isInitialized, 
        element: !!element 
      });
      
      element.innerHTML = `
        <div style="padding: 15px; border: 2px solid #ffeaa7; border-radius: 8px; text-align: center; color: #856404; background: #fff3cd;">
          <p><strong>Loading Google Sign-In...</strong></p>
          <p style="font-size: 14px; margin: 10px 0;">Please wait while we initialize the sign-in system.</p>
        </div>
      `;
      
      // Retry after a delay
      setTimeout(() => {
        if (window.google && this.isInitialized) {
          this.renderSignInButton(element);
        }
      }, 2000);
    }
  }

  public getCurrentUser(): GoogleUser | null {
    return this.userSubject.value;
  }

  public isSignedIn(): boolean {
    return this.userSubject.value !== null;
  }

  public isConfigured(): boolean {
    return this.CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';
  }

  private storeUser(user: GoogleUser): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('googleUser', JSON.stringify(user));
    }
  }

  private clearStoredUser(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('googleUser');
    }
  }

  private checkStoredUser(): void {
    if (typeof localStorage !== 'undefined') {
      const storedUser = localStorage.getItem('googleUser');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          this.userSubject.next(user);
        } catch (error) {
          console.error('Error parsing stored user:', error);
          this.clearStoredUser();
        }
      }
    }
  }
}
