import Dialog_class from './../../libs/popup.js';

class Help_about_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	//about
	about() {
		var settings = {
			title: 'About',
			params: [
				{function: function () {
					return '<div class="about-logo-wrap"><img class="about-logo" alt="" src="images/logo-colors.png" /></div>';
				}},
				{title: "Name:", html: '<span class="about-name">WebPhos</span>'},
				{title: "Version:", value: VERSION},
				{title: "Description:", value: "Online image editor."},
				{title: "Author:", html: '<a href="https://www.80.cz" rel="noopener noreferrer">Zbyněk Vanžura</a>'},
				{title: "Based on:", html: '<a href="https://github.com/viliusle/miniPaint" rel="noopener noreferrer">miniPaint</a> by ViliusL (MIT)'},
				{title: "License:", value: 'MIT'},
			],
		};
		this.POP.show(settings);
	}

}

export default Help_about_class;
