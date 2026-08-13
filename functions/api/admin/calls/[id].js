import { makeUpdateDelete } from '../../../_lib/crud.js';

const FIELDS = ['sort_order', 'title', 'branch_slug', 'status', 'deadline_label', 'summary', 'link', 'link_label'];

export const { onRequestPut, onRequestDelete } = makeUpdateDelete('calls', 'id', FIELDS);
