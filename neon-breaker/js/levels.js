/* NEON BREAKER — levels.js
 * 12 handgebaute Level als ASCII-Layouts (10 Spalten breit).
 *
 * Zeichen:
 *   .  leer
 *   1  normaler Stein (1 Treffer)
 *   2  harter Stein   (2 Treffer)
 *   3  Panzerstein    (3 Treffer)
 *   #  Stahl (unzerstörbar, zählt nicht fürs Levelende)
 *   E  Sprengstein (explodiert und beschädigt Nachbarn)
 *   M  Mystery-Stein (lässt garantiert ein Power-Up fallen)
 */
'use strict';
window.NB = window.NB || {};

NB.LEVELS = [
  {
    name: 'Warm-Up', hue: 190, speed: 420,
    rows: [
      '..........',
      '.11111111.',
      '.11111111.',
      '.1111M111.',
      '.11111111.',
    ],
  },
  {
    name: 'Heart', hue: 330, speed: 432,
    rows: [
      '..........',
      '..11..11..',
      '.11111111.',
      '.111M1111.',
      '..111111..',
      '...1111...',
      '....11....',
    ],
  },
  {
    name: 'Invasion', hue: 120, speed: 444,
    rows: [
      '..1....1..',
      '...1..1...',
      '..111111..',
      '.11.11.11.',
      '1111M11111',
      '1.111111.1',
      '1.1....1.1',
      '...11.11..',
    ],
  },
  {
    name: 'Fortress', hue: 45, speed: 456,
    rows: [
      '..##..##..',
      '..#2222#..',
      '...2EE2...',
      '..#2M22#..',
      '..##..##..',
      '.11111111.',
    ],
  },
  {
    name: 'Checkerboard', hue: 265, speed: 466,
    rows: [
      '1.2.1.2.1.',
      '.2.1.2.1.2',
      '1.2.E.2.1.',
      '.2.1.2.1.2',
      '1.2.M.2.1.',
      '.2.1.2.1.2',
    ],
  },
  {
    name: 'Diamond', hue: 175, speed: 476,
    rows: [
      '....11....',
      '...1221...',
      '..122221..',
      '.12E3ME21.',
      '..122221..',
      '...1221...',
      '....11....',
    ],
  },
  {
    name: 'Smiley', hue: 55, speed: 486,
    rows: [
      '...1111...',
      '..1....1..',
      '.1.2..2.1.',
      '.1...M..1.',
      '.1.2222.1.',
      '..1....1..',
      '...1111...',
    ],
  },
  {
    name: 'Reactor', hue: 0, speed: 496,
    rows: [
      '.22222222.',
      '.2......2.',
      '.2.EEEE.2.',
      '.2.EM3E.2.',
      '.2.EEEE.2.',
      '.2......2.',
      '.22222222.',
    ],
  },
  {
    name: 'Labyrinth', hue: 210, speed: 506,
    rows: [
      '2222222222',
      '..........',
      '###..#..##',
      '.11111111.',
      '..........',
      '.##..##.#.',
      '..1E11E1..',
    ],
  },
  {
    name: 'Storm', hue: 280, speed: 516,
    rows: [
      '1..2..1..2',
      '.1..2..1..',
      '..1..2..M.',
      '2..1..2..1',
      '.2..E..2..',
      '..2..1..2.',
      '1..2..1..2',
      '.1..2..1..',
    ],
  },
  {
    name: 'Citadel', hue: 150, speed: 526,
    rows: [
      '#2#.22.#2#',
      '.2..22..2.',
      '2222222222',
      '.3.E22E.3.',
      '2222222222',
      '.2..M...2.',
      '#2#....#2#',
    ],
  },
  {
    name: 'Finale', hue: 320, speed: 538,
    rows: [
      '3223223223',
      '2332332332',
      '..........',
      '#E222222E#',
      '..........',
      '.33....33.',
      '.33.MM.33.',
      '..........',
      '..111111..',
    ],
  },
];

/* Eigenschaften der Steintypen */
NB.BRICK_TYPES = {
  '1': { hp: 1, points: 50,  kind: 'normal' },
  '2': { hp: 2, points: 100, kind: 'tough' },
  '3': { hp: 3, points: 150, kind: 'tough' },
  '#': { hp: Infinity, points: 0, kind: 'steel' },
  'E': { hp: 1, points: 120, kind: 'explosive' },
  'M': { hp: 1, points: 80,  kind: 'mystery' },
};
