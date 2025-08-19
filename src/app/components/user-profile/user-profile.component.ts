import { Component, OnInit, ElementRef, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleAuthService, GoogleUser } from '../../services/google-auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('googleSignInButton', { static: false }) googleSignInButton?: ElementRef;
  
  user: GoogleUser | null = null;
  isSignedIn = false;
  isGoogleConfigured = false;
  private userSubscription?: Subscription;

  constructor(private googleAuthService: GoogleAuthService) {}

  ngOnInit(): void {
    this.isGoogleConfigured = this.googleAuthService.isConfigured();
    this.userSubscription = this.googleAuthService.user$.subscribe(user => {
      this.user = user;
      this.isSignedIn = !!user;
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  ngAfterViewInit(): void {
    // Render Google Sign-In button after view init
    setTimeout(() => {
      if (this.googleSignInButton && !this.isSignedIn) {
        this.googleAuthService.renderSignInButton(this.googleSignInButton.nativeElement);
      }
    }, 100);
  }

  signOut(): void {
    this.googleAuthService.signOut();
  }

  promptSignIn(): void {
    this.googleAuthService.signIn();
  }
}
