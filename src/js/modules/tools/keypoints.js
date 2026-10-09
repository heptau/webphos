import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';
import ImageFilters_class from './../../libs/imagefilters.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from './translate.js';

/**
 * SIFT: scale-invariant-feature-transform, keypoints
 *
 * @author ViliusL
 */
class Tools_keypoints_class {

	constructor() {
		this.Helper = new Helper_class();
		this.Base_layers = new Base_layers_class();
		this.ImageFilters = ImageFilters_class;

		//contrast check, smaller - more points, better accuracy, but slower
		this.avg_offset = 50;

		/**
		 * how much pixels to check for each side to get average
		 */
		this.avg_step = 4;
	}

	//generate key points for image
	keypoints(return_data) {

		let i, j;
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const W = config.layer.width;
		const H = config.layer.height;

		//get canvas from layer
		const clone = this.Base_layers.convert_layer_to_canvas();
		const ctx = clone.getContext("2d");

		//greyscale
		let imageData = ctx.getImageData(0, 0, W, H);
		const data = this.convert_to_grayscale(imageData);
		ctx.putImageData(data, 0, 0);

		//make few copies and blur each
		const n = 5;
		const copies = [];
		for (i = 0; i < n; i++) {
			const tmp_canvas = document.createElement('canvas');
			tmp_canvas.width = W;
			tmp_canvas.height = H;
			const ctx_i = tmp_canvas.getContext("2d");
			ctx_i.drawImage(clone, 0, 0);

			//Gausian blur
			imageData = ctx_i.getImageData(0, 0, W, H);
			const filtered = this.ImageFilters.GaussianBlur(imageData, i + 0.5); //add effect
			ctx_i.putImageData(filtered, 0, 0);

			copies.push(tmp_canvas);
		}

		//find extreme points
		const points = [];
		const n0 = this.avg_step * 2 + 1;
		for (let c = 1; c < copies.length - 1; c++) {
			imageData = copies[c].getContext("2d").getImageData(0, 0, W, H).data;
			const imageData0 = copies[c - 1].getContext("2d").getImageData(0, 0, W, H).data;
			const imageData2 = copies[c + 1].getContext("2d").getImageData(0, 0, W, H).data;
			for (j = this.avg_step; j < H - this.avg_step; j++) {
				for (i = this.avg_step; i < W - this.avg_step; i++) {
					const x = (i + j * W) * 4;
					if (imageData[x + 3] == 0)
						continue; //transparent
					if (imageData[x] < imageData[x - 4] || imageData[x] < imageData[x + 4] || imageData[x] > imageData[x - 4] || imageData[x] > imageData[x + 4]) {
						const x_pre = (i + (j - 1) * W) * 4;
						const x_post = (i + (j + 1) * W) * 4;
						//calc average
						let area_average = 0;
						for (let l = -this.avg_step; l <= this.avg_step; l++) {
							const avgi = (i + (j - l) * W) * 4;
							for (let a = -this.avg_step; a <= this.avg_step; a++) {
								area_average += imageData[avgi + 4 * a];
							}
						}
						area_average = area_average / (n0 * n0);
						//max
						if (imageData[x] + this.avg_offset < area_average) {
							const min = Math.min(imageData[x_pre - 4], imageData[x_pre], imageData[x_pre + 4], imageData[x - 4], imageData[x + 4], imageData[x_post - 4], imageData[x_post], imageData[x_post + 4]);
							if (imageData[x] <= min) {
								const min0 = Math.min(imageData0[x_pre - 4], imageData0[x_pre], imageData0[x_pre + 4], imageData0[x - 4], imageData0[x + 4], imageData0[x_post - 4], imageData0[x_post], imageData0[x_post + 4]);
								if (imageData[x] <= min0) {
									const min2 = Math.min(imageData2[x_pre - 4], imageData2[x_pre], imageData2[x_pre + 4], imageData2[x - 4], imageData2[x + 4], imageData2[x_post - 4], imageData2[x_post], imageData2[x_post + 4]);
									if (imageData[x] <= min2)
										points.push({
											x: i,
											y: j,
											w: Math.round(area_average - imageData[x] - this.avg_offset)
										});
								}
							}
							continue;
						}
						//min
						if (imageData[x] - this.avg_offset > area_average) {
							const max = Math.max(imageData[x_pre - 4], imageData[x_pre], imageData[x_pre + 4], imageData[x - 4], imageData[x + 4], imageData[x_post - 4], imageData[x_post], imageData[x_post + 4]);
							if (imageData[x] >= max) {
								const max0 = Math.max(imageData0[x_pre - 4], imageData0[x_pre], imageData0[x_pre + 4], imageData0[x - 4], imageData0[x + 4], imageData0[x_post - 4], imageData0[x_post], imageData0[x_post + 4]);
								if (imageData[x] >= max0) {
									const max2 = Math.max(imageData2[x_pre - 4], imageData2[x_pre], imageData2[x_pre + 4], imageData2[x - 4], imageData2[x + 4], imageData2[x_post - 4], imageData2[x_post], imageData2[x_post + 4]);
									if (imageData[x] >= max2) {
										points.push({
											x: i,
											y: j,
											w: Math.round(imageData[x] - area_average - this.avg_offset)
										});
									}
								}
							}
						}
					}
				}
			}
		}
		//make unique
		for (i = 0; i < points.length; i++) {
			for (j = 0; j < points.length; j++) {
				if (i != j && points[i].x == points[j].x && points[i].y == points[j].y) {
					points.splice(i, 1);
					i--;
					break;
				}
			}
		}

		//show points?
		if (return_data === undefined || return_data !== true) {
			alertify.success(t('key points: ') + points.length);

			const size = 3;
			ctx.clearRect(0, 0, clone.width, clone.height);
			ctx.fillStyle = "#ff0000";
			for (i in points) {
				const point = points[i];
				ctx.beginPath();
				ctx.rect(point.x - Math.floor(size / 2) + 1, point.y - Math.floor(size / 2) + 1, size, size);
				ctx.fill();
			}

			//show
			const params = [];
			params.type = 'image';
			params.name = `${config.layer.name  } + key points`;
			params.data = clone.toDataURL("image/png");
			params.x = parseInt(clone.dataset.x);
			params.y = parseInt(clone.dataset.y);
			params.width = clone.width;
			params.height = clone.height;
			app.State.do_action(
				new app.Actions.Bundle_action('keypoints', 'Key-Points', [
					new app.Actions.Insert_layer_action(params)
				])
			);

			clone.width = 1;
			clone.height = 1;
		}
		else {
			//sort by weights
			points.sort((a, b) => {
				return parseFloat(b.w) - parseFloat(a.w);
			});

			clone.width = 1;
			clone.height = 1;

			return {
				points,
			};
		}
	}

	//returns average value of requested area from greyscale image
	//area = {x, y, w, h}
	get_area_average(area, imageData, i, j, size) {
		const imgData = imageData.data;
		let sum = 0;
		let n = 0;
		size = size / 100; //prepare to use 1-100% values
		const stop_x = i + Math.round(size * area.x) + Math.round(size * area.w);
		const stop_y = j + Math.round(size * area.y) + Math.round(size * area.h);
		const img_width4 = imageData.width * 4;
		let k0, k;
		for (let y = j + Math.round(size * area.y); y < stop_y; y++) {
			k0 = y * img_width4;
			for (let x = i + Math.round(size * area.x); x < stop_x; x++) {
				k = k0 + (x * 4);
				sum = sum + imgData[k];
				n++;
			}
		}
		return Math.round(sum / n);
	}

	convert_to_grayscale(data) {
		const imgData = data.data;
		let grey;

		for (let i = 0; i < imgData.length; i += 4) {
			if (imgData[i + 3] == 0)
				continue;	//transparent
			grey = Math.round(0.2126 * imgData[i] + 0.7152 * imgData[i + 1] + 0.0722 * imgData[i + 2]);
			imgData[i] = grey;
			imgData[i + 1] = grey;
			imgData[i + 2] = grey;
		}
		return data;
	}
}

export default Tools_keypoints_class;
