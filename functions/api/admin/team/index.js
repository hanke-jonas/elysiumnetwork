import { makeListCreate } from '../../../_lib/crud.js';

const FIELDS = ['sort_order', 'name', 'role', 'image', 'focal_y', 'bio'];

export const { onRequestGet, onRequestPost } = makeListCreate('team_members', 'id', FIELDS);
