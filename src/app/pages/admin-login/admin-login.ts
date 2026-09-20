import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

type LoginStatus = 'idle' | 'signing-in' | 'error';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
})
export class AdminLogin {
  protected readonly status = signal<LoginStatus>('idle');

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor(private readonly router: Router) {}

  async submit(): Promise<void> {
    if (this.form.invalid || this.status() === 'signing-in') {
      this.form.markAllAsTouched();
      return;
    }
    this.status.set('signing-in');
    try {
      const { login } = await import('../../core/auth');
      const { email, password } = this.form.getRawValue();
      await login(email, password);
      this.router.navigateByUrl('/admin');
    } catch {
      this.status.set('error');
    }
  }
}
