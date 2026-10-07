/**
 * Long press with a finger: the touch screens (iPad) have no right button, so holding a finger still opens the context
 * menu. Pure helpers plus one function that wires an element, so the rules can be tested without a touch screen.
 */

export const LONG_PRESS_DELAY = 500; //ms
export const LONG_PRESS_TOLERANCE = 10; //px the finger may move and it is still a hold

/**
 * Tools where a touch on the canvas does not paint: moving, selecting, looking. With the other tools a touch is the
 * start of a stroke (or a click that changes the picture), so holding the finger there must not open a menu.
 */
export const CONTEXT_MENU_TOOLS = ['select', 'hand', 'zoom', 'selection', 'lasso', 'magic_wand', 'quick_select', 'crop', 'measure', 'pick_color', 'text'];

/**
 * @param {string|null|undefined} tool_name name of the active tool
 * @returns {boolean} a long press on the canvas may open the context menu
 */
export function long_press_allowed(tool_name) {
	return typeof tool_name === 'string' && CONTEXT_MENU_TOOLS.indexOf(tool_name) >= 0;
}

/**
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} point
 * @param {number} [tolerance]
 * @returns {boolean} the finger moved so far that it is not a hold any more
 */
export function moved_too_far(start, point, tolerance) {
	return Math.hypot(point.x - start.x, point.y - start.y) > (tolerance === undefined ? LONG_PRESS_TOLERANCE : tolerance);
}

/**
 * Calls `on_press` with {clientX, clientY, target} when one finger stays on the element for the delay.
 * The touch end that follows is cancelled, so the browser does not turn the touch into a click.
 *
 * @param {HTMLElement} element
 * @param {function({clientX: number, clientY: number, target: EventTarget|null}): void} on_press
 * @param {{delay?: number, tolerance?: number, allowed?: function(): boolean}} [options]
 */
export function attach_long_press(element, on_press, options) {
	var settings = options || {};
	var timer = null;
	var start = null;
	var target = null;
	var fired = false;

	var cancel = function () {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	};

	element.addEventListener('touchstart', function (event) {
		cancel();
		fired = false;
		if (event.touches.length != 1 || (settings.allowed && settings.allowed() === false)) {
			return;
		}
		start = {x: event.touches[0].clientX, y: event.touches[0].clientY};
		target = event.target;
		timer = setTimeout(function () {
			timer = null;
			fired = true;
			on_press({clientX: start.x, clientY: start.y, target: target});
		}, settings.delay === undefined ? LONG_PRESS_DELAY : settings.delay);
	}, {passive: true});

	element.addEventListener('touchmove', function (event) {
		if (timer !== null && event.touches.length > 0
			&& moved_too_far(start, {x: event.touches[0].clientX, y: event.touches[0].clientY}, settings.tolerance)) {
			cancel();
		}
	}, {passive: true});

	var end = function (event) {
		cancel();
		if (fired) {
			fired = false;
			if (event.cancelable) {
				event.preventDefault(); //no click and no mouse events after the hold
			}
		}
	};
	element.addEventListener('touchend', end);
	element.addEventListener('touchcancel', end);
}
