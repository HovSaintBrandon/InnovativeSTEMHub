import { Component } from '@angular/core';
import { MILESTONES, STATS } from '../../data/profile';

@Component({
  selector: 'app-impact',
  templateUrl: './impact.html',
  styleUrl: './impact.scss',
})
export class Impact {
  protected readonly stats = STATS;
  protected readonly milestones = MILESTONES;
}
