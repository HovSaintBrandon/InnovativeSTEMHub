import { Component } from '@angular/core';
import { Hero } from '../../sections/hero/hero';
import { About } from '../../sections/about/about';
import { Impact } from '../../sections/impact/impact';
import { Research } from '../../sections/research/research';
import { Library } from '../../sections/library/library';
import { Development } from '../../sections/development/development';
import { Contact } from '../../sections/contact/contact';

@Component({
  selector: 'app-home',
  imports: [Hero, About, Impact, Research, Library, Development, Contact],
  templateUrl: './home.html',
})
export class Home {}
