import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zip, unzip } from '../public/js/kmz.js';

test('zip y unzip devuelven el mismo contenido, con acentos', async () => {
  const files = {
    'wpmz/template.kml': '<kml>Misión ñ — 50 m</kml>',
    'wpmz/waylines.wpml': '<kml>áéíóú</kml>',
  };
  assert.deepEqual(await unzip(zip(files)), files);
});

test('unzip lee entradas comprimidas con deflate', async () => {
  const bytes = new Uint8Array(await readFile(new URL('./data/deflate.kmz', import.meta.url)));
  assert.deepEqual(await unzip(bytes), { 'wpmz/waylines.wpml': 'Misión ñ' });
});

test('unzip rechaza bytes que no son un ZIP', async () => {
  const garbage = new Uint8Array(200).map((_, i) => (i * 37) % 251);
  await assert.rejects(unzip(garbage), { message: 'El archivo no es un KMZ válido.' });
  await assert.rejects(unzip(new Uint8Array(0)), { message: 'El archivo no es un KMZ válido.' });
});
