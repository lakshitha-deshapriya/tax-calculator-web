import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleAuthService } from '../../services/google-auth.service';

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="debug-panel" *ngIf="showDebug">
      <h3>🔧 Google Sign-In Debug Panel</h3>
      <div class="debug-info">
        <div class="debug-item">
          <strong>Current Origin:</strong> {{ currentOrigin }}
        </div>
        <div class="debug-item">
          <strong>Client ID:</strong> {{ clientId }}
        </div>
        <div class="debug-item">
          <strong>Google Script Loaded:</strong> 
          <span [class]="googleScriptLoaded ? 'status-good' : 'status-bad'">
            {{ googleScriptLoaded ? '✅ Yes' : '❌ No' }}
          </span>
        </div>
        <div class="debug-item">
          <strong>Google Auth Initialized:</strong> 
          <span [class]="googleAuthInitialized ? 'status-good' : 'status-bad'">
            {{ googleAuthInitialized ? '✅ Yes' : '❌ No' }}
          </span>
        </div>
        <div class="debug-item">
          <strong>User Signed In:</strong> 
          <span [class]="isSignedIn ? 'status-good' : 'status-neutral'">
            {{ isSignedIn ? '✅ Yes' : '⭕ No' }}
          </span>
        </div>
      </div>
      
      <div class="debug-actions">
        <button class="debug-btn" (click)="testGoogleAuth()">Test Google Auth</button>
        <button class="debug-btn" (click)="clearStorage()">Clear Storage</button>
        <button class="debug-btn" (click)="reloadPage()">Reload Page</button>
      </div>
      
      <div class="debug-instructions">
        <h4>Quick Fix Steps:</h4>
        <ol>
          <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a></li>
          <li>Edit your OAuth Client ID</li>
          <li>Add this origin: <code>{{ currentOrigin }}</code></li>
          <li>Save and wait 5-10 minutes</li>
        </ol>
      </div>
    </div>
    
    <button class="debug-toggle" (click)="toggleDebug()">
      {{ showDebug ? '🔧 Hide Debug' : '🔧 Show Debug' }}
    </button>
  `,
  styles: [`
    .debug-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 25px;
      cursor: pointer;
      font-size: 12px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(255, 107, 107, 0.3);
    }
    
    .debug-panel {
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: white;
      border: 2px solid #ff6b6b;
      border-radius: 12px;
      padding: 15px;
      max-width: 400px;
      font-size: 14px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
      z-index: 999;
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .debug-panel h3 {
      margin: 0 0 15px 0;
      color: #333;
    }
    
    .debug-info {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    
    .debug-item {
      margin-bottom: 8px;
      padding: 5px 0;
      border-bottom: 1px solid #e9ecef;
    }
    
    .debug-item:last-child {
      border-bottom: none;
    }
    
    .status-good { color: #28a745; font-weight: bold; }
    .status-bad { color: #dc3545; font-weight: bold; }
    .status-neutral { color: #6c757d; font-weight: bold; }
    
    .debug-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }
    
    .debug-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .debug-btn:hover {
      background: #0056b3;
    }
    
    .debug-instructions {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 10px;
      border-radius: 6px;
    }
    
    .debug-instructions h4 {
      margin: 0 0 10px 0;
      color: #856404;
    }
    
    .debug-instructions ol {
      margin: 0;
      padding-left: 20px;
    }
    
    .debug-instructions code {
      background: #f8f9fa;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
    }
    
    .debug-instructions a {
      color: #007bff;
      text-decoration: none;
    }
    
    .debug-instructions a:hover {
      text-decoration: underline;
    }
  `]
})
export class DebugPanelComponent implements OnInit {
  showDebug = false;
  currentOrigin = window.location.origin;
  clientId = '';
  googleScriptLoaded = false;
  googleAuthInitialized = false;
  isSignedIn = false;

  constructor(private googleAuthService: GoogleAuthService) {}

  ngOnInit(): void {
    // Check Google script loading
    this.checkGoogleScript();
    
    // Subscribe to auth state
    this.googleAuthService.user$.subscribe(user => {
      this.isSignedIn = !!user;
    });
    
    // Get client ID
    this.clientId = (this.googleAuthService as any).CLIENT_ID || 'Not configured';
    
    // Check if Google Auth is configured
    this.googleAuthInitialized = this.googleAuthService.isConfigured();
  }

  toggleDebug(): void {
    this.showDebug = !this.showDebug;
  }

  private checkGoogleScript(): void {
    this.googleScriptLoaded = !!(window as any).google;
    
    // Check periodically for Google script loading
    const checkInterval = setInterval(() => {
      this.googleScriptLoaded = !!(window as any).google;
      if (this.googleScriptLoaded) {
        clearInterval(checkInterval);
      }
    }, 500);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
  }

  testGoogleAuth(): void {
    console.log('=== GOOGLE AUTH TEST ===');
    console.log('Origin:', this.currentOrigin);
    console.log('Client ID:', this.clientId);
    console.log('Google available:', !!(window as any).google);
    console.log('Auth configured:', this.googleAuthService.isConfigured());
    console.log('User signed in:', this.isSignedIn);
    
    // Try to sign in
    try {
      this.googleAuthService.signIn();
    } catch (error) {
      console.error('Sign in test failed:', error);
    }
  }

  clearStorage(): void {
    localStorage.clear();
    sessionStorage.clear();
    console.log('Storage cleared');
    alert('Storage cleared! Reload the page to see changes.');
  }

  reloadPage(): void {
    window.location.reload();
  }
}
