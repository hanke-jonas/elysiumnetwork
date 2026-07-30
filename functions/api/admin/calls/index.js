import { makeListCreate } from '../../../_lib/crud.js';

const FIELDS = ['sort_order', 'title', 'branch_slug', 'is_open', 'deadline_label', 'summary', 'link', 'link_label'];

export const { onRequestGet, onRequestPost } = makeListCreate('calls', 'id', FIELDS);
