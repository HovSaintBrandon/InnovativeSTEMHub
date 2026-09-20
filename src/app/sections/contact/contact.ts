import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Icon } from '../../shared/icon';
import { PROFILE, SOCIAL_LINKS } from '../../data/profile';

type SubmitStatus = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  protected readonly contact = PROFILE.contact;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly status = signal<SubmitStatus>('idle');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
  });

  get name() {
    return this.form.controls.name;
  }
  get email() {
    return this.form.controls.email;
  }
  get message() {
    return this.form.controls.message;
  }

  async submit(): Promise<void> {
    if (this.status() === 'sending') {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.status.set('sending');
    try {
      const { sendContactMessage } = await import('../../core/contact');
      await sendContactMessage(this.form.getRawValue());
      this.status.set('success');
      this.form.reset();
    } catch {
      this.status.set('error');
    }
  }
}
