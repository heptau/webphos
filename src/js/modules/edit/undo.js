import Base_state_class from './../../core/base-state.js';

let instance = null;

class Edit_undo_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_state = new Base_state_class();
		this.events();
	}

	events(){

		document.querySelector('#undo_button').addEventListener('click', () => {
			this.Base_state.undo();
		});
	}

	undo() {
		this.Base_state.undo();
	}
}

export default Edit_undo_class;
