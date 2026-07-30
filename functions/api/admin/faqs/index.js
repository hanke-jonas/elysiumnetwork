import { makeListCreate } from '../../../_lib/crud.js';

const FIELDS = ['sort_order', 'question', 'answer'];

export const { onRequestGet, onRequestPost } = makeListCreate('faqs', 'id', FIELDS);
