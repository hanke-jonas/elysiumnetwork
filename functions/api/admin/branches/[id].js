import { makeUpdateDelete } from '../../../_lib/crud.js';

const FIELDS = [
  'sort_order', 'name', 'name_native', 'country', 'city', 'flag', 'accent',
  'tz', 'lat', 'lon', 'iso_n3', 'oid', 'type', 'status', 'tagline', 'about',
  'focus_json', 'people_json', 'email', 'phone', 'address', 'website',
];
const JSON_FIELDS = ['focus_json', 'people_json'];

export const { onRequestPut, onRequestDelete } = makeUpdateDelete('branches', 'slug', FIELDS, JSON_FIELDS);
