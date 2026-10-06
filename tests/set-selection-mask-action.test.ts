import { Set_selection_mask_action } from '../src/js/actions/set-selection-mask.js';
import Selection_mask_class from '../src/js/core/selection-mask-state.js';
import { create_mask } from '../src/js/libs/selection-mask.js';

const rect = (x: number) => ({ x, y: 0, width: 5, height: 5 });

describe('Set_selection_mask_action', () => {
  beforeEach(() => new Selection_mask_class().reset());

  it('sets the custom mask and undo restores the previous one', async () => {
    const state = new Selection_mask_class();
    const first = new Set_selection_mask_action(create_mask(4, 4, 10), rect(1));
    const second = new Set_selection_mask_action(create_mask(4, 4, 20), rect(2));

    await first.do();
    const afterFirst = state.get_custom_state();
    expect(afterFirst!.mask.data[0]).toBe(10);
    expect(afterFirst!.key).toBe('1,0,5,5');

    await second.do();
    expect(state.get_custom_state()!.mask.data[0]).toBe(20);

    await second.undo();
    expect(state.get_custom_state()).toBe(afterFirst);

    await first.undo();
    expect(state.get_custom_state()).toBeNull();
  });

  it('redo sets the mask again', async () => {
    const state = new Selection_mask_class();
    const action = new Set_selection_mask_action(create_mask(4, 4, 7), rect(3));
    await action.do();
    await action.undo();
    expect(state.get_custom_state()).toBeNull();
    await action.do();
    expect(state.get_custom_state()!.mask.data[0]).toBe(7);
  });

  it('null mask clears the custom mask and undo brings it back', async () => {
    const state = new Selection_mask_class();
    const setter = new Set_selection_mask_action(create_mask(4, 4, 9), rect(0));
    await setter.do();
    const clearer = new Set_selection_mask_action(null, null);
    await clearer.do();
    expect(state.get_custom_state()).toBeNull();
    await clearer.undo();
    expect(state.get_custom_state()!.mask.data[0]).toBe(9);
  });

  it('estimates its memory use and releases it on free', () => {
    const action = new Set_selection_mask_action(create_mask(10, 10), rect(0));
    expect(action.memory_estimate).toBe(100);
    action.free();
    expect(action.mask).toBeNull();
  });
});
