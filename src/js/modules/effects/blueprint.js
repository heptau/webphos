import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import ImageFilters from './../../libs/imagefilters.js';
import glfx from './../../libs/glfx.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Effects_blueprint_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.ImageFilters = ImageFilters;
		this.fx_filter = false;
	}

	blueprint() {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		//get canvas from layer
		const canvas = this.Base_layers.convert_layer_to_canvas(null, true);
		const ctx = canvas.getContext("2d");

		//change data
		const data = this.change(canvas, canvas.width, canvas.height);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(data, 0, 0);

		//save
		return app.State.do_action(
			new app.Actions.Update_layer_image_action(canvas)
		);
	}

	change(canvas, width, height) {
		if (this.fx_filter == false) {
			//init glfx lib
			this.fx_filter = glfx.canvas();
		}
		const ctx = canvas.getContext("2d");

		//create blue layer
		const canvas2 = document.createElement('canvas');
		const ctx2 = canvas2.getContext("2d");
		canvas2.width = width;
		canvas2.height = height;
		ctx2.fillStyle = '#0e58a3';
		ctx2.fillRect(0, 0, width, height);

		//apply edges
		let img = ctx.getImageData(0, 0, width, height);
		img = this.ImageFilters.Edge(img);
		ctx.putImageData(img, 0, 0);

		//denoise
		const texture = this.fx_filter.texture(canvas);
		this.fx_filter.draw(texture).denoise(20).update();	//effect
		canvas = this.fx_filter;

		//Brightness
		img = ctx.getImageData(0, 0, width, height);
		img = this.ImageFilters.BrightnessContrastPhotoshop(img, 80, 0);
		ctx.putImageData(img, 0, 0);

		//merge
		ctx2.globalCompositeOperation = "screen";
		ctx2.filter = 'grayscale(1)';
		ctx2.drawImage(canvas, 0, 0);
		ctx2.globalCompositeOperation = "source-over";
		ctx2.filter = 'none';

		//draw lines
		this.draw_grid(ctx2, 20);

		return canvas2;
	}

	/**
	 * draw grid
	 *
	 * @param {CanvasContext} ctx
	 * @param {Int} size
	 */
	draw_grid(ctx, size) {
		let i;
		if (this.grid == false)
			return;

		const width = config.WIDTH;
		const height = config.HEIGHT;
		const color_main = 'rgba(255, 255, 255, 0.5)';
		const color_small = 'rgba(255, 255, 255, 0.1)';

		//size
		if (size != undefined && size != undefined)
			this.grid_size = [size, size];
		else {
			size = this.grid_size[1];
		}
		size = parseInt(size);
		size = parseInt(size);
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (size < 2)
			size = 2;
		if (size < 2)
			size = 2;
		for (i = size; i < width; i = i + size) {
			if (size == 0)
				break;
			if (i % (size * 5) == 0) {
				//main lines
				ctx.strokeStyle = color_main;
			}
			else {
				//small lines
				ctx.strokeStyle = color_small;
			}
			ctx.beginPath();
			ctx.moveTo(0.5 + i, 0);
			ctx.lineTo(0.5 + i, height);
			ctx.stroke();
		}
		for (i = size; i < height; i = i + size) {
			if (size == 0)
				break;
			if (i % (size * 5) == 0) {
				//main lines
				ctx.strokeStyle = color_main;
			}
			else {
				//small lines
				ctx.strokeStyle = color_small;
			}
			ctx.beginPath();
			ctx.moveTo(0, 0.5 + i);
			ctx.lineTo(width, 0.5 + i);
			ctx.stroke();
		}
	}

	demo(canvas_id, canvas_thumb){
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");
		ctx.drawImage(canvas_thumb, 0, 0);

		//now update
		const data = this.change(canvas, canvas_thumb.width, canvas_thumb.height);
		ctx.drawImage(data, 0, 0);
	}
}

export default Effects_blueprint_class;
