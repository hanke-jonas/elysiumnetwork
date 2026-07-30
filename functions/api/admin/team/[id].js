import { makeUpdateDelete } from '../../../_lib/crud.js';

const FIELDS = ['sort_order', 'name', 'role', 'image', 'focal_y', 'bio'];

export const { onRequestPut, onRequestDelete } = makeUpdateDelete('team_members', 'id', FIELDS);
