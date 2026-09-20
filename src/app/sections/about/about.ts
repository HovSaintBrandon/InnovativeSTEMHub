import { Component } from '@angular/core';
import { PROFILE } from '../../data/profile';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  protected readonly bio = PROFILE.bio;
  protected readonly degrees = PROFILE.degrees;
  protected readonly expertise = PROFILE.expertise;
}
