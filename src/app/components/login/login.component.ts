import { Component, EventEmitter, Output, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleAuthService } from '../../services/google-auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, AfterViewInit {
  @Output() continueAsGuest = new EventEmitter<void>();
  @ViewChild('googleSignInButton') googleSignInButton?: ElementRef;

  constructor(private googleAuthService: GoogleAuthService) {}

  ngOnInit(): void {
    console.log('Login component initialized');
  }

  ngAfterViewInit(): void {
    // Render Google Sign-In button after view initialization
    this.renderGoogleSignInButton();
  }

  private renderGoogleSignInButton(): void {
    if (this.googleSignInButton && this.googleSignInButton.nativeElement) {
      this.googleAuthService.renderSignInButton(this.googleSignInButton.nativeElement);
    }
  }

  onContinueAsGuest(): void {
    console.log('User chose to continue as guest');
    this.continueAsGuest.emit();
  }

  onSignInWithGoogle(): void {
    console.log('User chose to sign in with Google');
    this.googleAuthService.signIn();
  }
}
