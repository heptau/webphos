import app from './../../app.js';

/**
 * Edit > Free Transform (Ctrl+T) - the selection tool shows handles to move, scale and rotate the active layer
 */
class Edit_transform_class {

	free_transform() {
		return app.State.do_action(new app.Actions.Activate_tool_action('select'));
	}
}

export default Edit_transform_class;
