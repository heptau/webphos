import Base_layers_class from './../../core/base-layers.js';
import File_open_class from './open.js';

/**
 * manages files / quick-load
 *
 * @author ViliusL
 */
class File_quickload_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.File_open = new File_open_class();

		this.set_events();
	}

	set_events() {

	}

	quickload() {
		//load image data
		const json = localStorage.getItem('quicksave_data');
		if (json == '' || json == null) {
			//nothing was found
			return false;
		}

		this.File_open.load_json(json);
	}

}

export default File_quickload_class;
