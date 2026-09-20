import { Component, OnInit, signal } from '@angular/core';
import { Typewriter } from '../../shared/typewriter';
import { Icon } from '../../shared/icon';
import { PROFILE, SOCIAL_LINKS } from '../../data/profile';

@Component({
  selector: 'app-hero',
  imports: [Typewriter, Icon],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero implements OnInit {
  protected readonly profile = PROFILE;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly portraitUrl = signal(PROFILE.portraitUrl);

  ngOnInit(): void {
    this.loadPortrait();
  }

  private async loadPortrait(): Promise<void> {
    try {
      const { getHomePhotoUrl } = await import('../../core/content');
      const url = await getHomePhotoUrl();
      if (url) {
        this.portraitUrl.set(url);
      }
    } catch {
      /* keep the default portrait if Firestore isn't reachable */
    }
  }
}
