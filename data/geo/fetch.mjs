/**
 * US state boundaries for the map view — from the `us-atlas` package
 * (TopoJSON derived from the U.S. Census Bureau's cartographic boundary
 * files, 1:10M; the data is a work of the U.S. Government, public domain;
 * the package's own code is ISC). We take the ALBERS file: pre-projected
 * (Albers USA, screen coordinates, y growing downward) with Alaska and
 * Hawaii as insets — the 50 states and DC. The unprojected `states-10m`
 * carries Guam, American Samoa and the Marianas too, but at ±180° they
 * shrink the mainland to a thumbnail; those places ride the table instead.
 * Converted to a GeoJSON FeatureCollection with `properties.name` and
 * committed with its provenance, so the web app needs no topology library.
 *
 *   node data/geo/fetch.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const topo = require('us-atlas/states-albers-10m.json');
const pkg = require('us-atlas/package.json');

const fc = feature(topo, topo.objects.states);
const out = {
  type: 'FeatureCollection',
  features: fc.features.map((f) => ({ type: 'Feature', properties: { name: f.properties.name, id: f.id }, geometry: f.geometry })),
};
writeFileSync(path.join(here, 'us-states.geo.json'), JSON.stringify(out));
writeFileSync(
  path.join(here, 'PROVENANCE.json'),
  JSON.stringify(
    {
      source: 'U.S. Census Bureau cartographic boundary files (1:10,000,000), via the us-atlas package',
      package: { name: 'us-atlas', version: pkg.version, license: pkg.license, file: 'states-albers-10m.json' },
      projection: 'Albers USA, pre-projected by us-atlas (screen coordinates, y downward, ~975×610 frame; Alaska and Hawaii as insets)',
      features: out.features.length,
      noShape: 'Places that report to NNDSS but have no shape in this file (Puerto Rico, Guam, American Samoa, the Northern Mariana Islands, the U.S. Virgin Islands, New York City) ride the table; the cockpit derives that list from the data at run time.',
      names: out.features.map((f) => f.properties.name).sort(),
      license: 'The boundary data is a work of the United States Government — public domain.',
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(`wrote ${out.features.length} features`);
