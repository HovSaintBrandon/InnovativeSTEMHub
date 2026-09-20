import { Component } from '@angular/core';
import { CERTIFICATIONS, CONFERENCES } from '../../data/profile';

@Component({
  selector: 'app-development',
  templateUrl: './development.html',
  styleUrl: './development.scss',
})
export class Development {
  protected readonly certifications = CERTIFICATIONS;
  protected readonly conferences = CONFERENCES;
}
