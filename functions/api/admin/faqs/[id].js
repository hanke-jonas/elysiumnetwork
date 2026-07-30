import { makeUpdateDelete } from '../../../_lib/crud.js';

const FIELDS = ['sort_order', 'question', 'answer'];

export const { onRequestPut, onRequestDelete } = makeUpdateDelete('faqs', 'id', FIELDS);
