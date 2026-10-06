import { next_document_name, remove_document_index } from '../src/js/libs/documents.js';

describe('documents', () => {
  it('names new documents with the first free number', () => {
    expect(next_document_name([])).toBe('Untitled-1');
    expect(next_document_name(['Untitled-1', 'Untitled-3'])).toBe('Untitled-2');
    expect(next_document_name(['Untitled-1', 'Photo'])).toBe('Untitled-2');
  });

  it('keeps the active document after removing another one', () => {
    expect(remove_document_index(3, 2, 0)).toEqual({ active: 1, switched: false });
    expect(remove_document_index(3, 0, 2)).toEqual({ active: 0, switched: false });
  });

  it('switches to a neighbour when the active document is removed', () => {
    expect(remove_document_index(3, 1, 1)).toEqual({ active: 1, switched: true });
    expect(remove_document_index(3, 2, 2)).toEqual({ active: 1, switched: true });
    expect(remove_document_index(2, 0, 0)).toEqual({ active: 0, switched: true });
  });
});

import { move_active_index } from '../src/js/libs/documents.js';

describe('moving tabs', () => {
  it('follows the active tab and shifts the others', () => {
    expect(move_active_index(1, 1, 3)).toBe(3);
    expect(move_active_index(2, 0, 3)).toBe(1);
    expect(move_active_index(1, 3, 0)).toBe(2);
    expect(move_active_index(0, 1, 2)).toBe(0);
  });
});
