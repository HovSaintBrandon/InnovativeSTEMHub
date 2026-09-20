import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { NAV_LINKS, PROFILE, SOCIAL_LINKS } from '../../data/profile';

@Component({
  selector: 'app-footer',
  imports: [Icon, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly name = PROFILE.name;
  protected readonly links = NAV_LINKS;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly year = new Date().getFullYear();
}
