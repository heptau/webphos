import app from './../../app.js';

/**
 * Commands of the document tabs (right click on a tab)
 */
class View_documents_class {

	get docs() {
		return app.GUI.GUI_documents;
	}

	close_tab(index) {
		this.docs.close(parseInt(index, 10));
	}

	close_others(index) {
		var keep = this.docs.documents[parseInt(index, 10)];
		this.docs.documents.filter((doc) => doc !== keep).forEach((doc) => this.docs.close(this.docs.documents.indexOf(doc)));
	}

	close_right(index) {
		var from = parseInt(index, 10);
		this.docs.documents.slice(from + 1).forEach((doc) => this.docs.close(this.docs.documents.indexOf(doc)));
	}

	rename_tab(index) {
		this.docs.rename(parseInt(index, 10));
	}

	duplicate_tab(index) {
		this.docs.duplicate(parseInt(index, 10));
	}
}

export default View_documents_class;
