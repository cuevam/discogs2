/**
 * Quick-pick styles for the Styles filter.
 *
 * These are convenience shortcuts only — clicking a chip toggles the exact
 * string in the free-text Styles field, which stays fully editable. Values use
 * Discogs' canonical style spelling so the marketplace's exact-match filter
 * hits. (The bundled library's Style type is only a partial subset, so it isn't
 * used as the source of truth here.)
 */

/** Quick-pick styles, shown as chips and kept in alphabetical order. */
export const QUICK_STYLES: string[] = [
  'Abstract',
  'Acid House',
  'Ambient',
  'Avantgarde',
  'Disco',
  'Downtempo',
  'Drone',
  'Dub',
  'Dub Techno',
  'EBM',
  'Electro',
  'Experimental',
  'IDM',
  'Industrial',
  'Italo-Disco',
  'Krautrock',
  'Leftfield',
  'Minimal',
  'New Wave',
  'Noise',
  'Noise Rock',
  'Post Rock',
  'Psychedelic',
  'Psychedelic Rock',
  'Synth-pop',
  'Techno',
  'Trip Hop',
];
