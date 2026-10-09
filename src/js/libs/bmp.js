/**
 * BMP encoder - browsers can not encode BMP from canvas, so it is done here (24 bit, bottom-up).
 * Transparent pixels are composited on a white background, BMP has no alpha channel.
 */

/**
 * @param {{data: Uint8ClampedArray|number[], width: number, height: number}} image ImageData-like object
 * @returns {Uint8Array} BMP file
 */
export function encode_bmp(image) {
	const width = Math.max(1, parseInt(image.width, 10) || 1);
	const height = Math.max(1, parseInt(image.height, 10) || 1);
	const row_size = Math.ceil(width * 3 / 4) * 4;
	const pixels_size = row_size * height;
	const file_size = 54 + pixels_size;

	const bytes = new Uint8Array(file_size);
	const view = new DataView(bytes.buffer);

	//file header
	bytes[0] = 0x42; //B
	bytes[1] = 0x4d; //M
	view.setUint32(2, file_size, true);
	view.setUint32(10, 54, true);

	//DIB header (BITMAPINFOHEADER)
	view.setUint32(14, 40, true);
	view.setInt32(18, width, true);
	view.setInt32(22, height, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 24, true);
	view.setUint32(30, 0, true);
	view.setUint32(34, pixels_size, true);
	view.setInt32(38, 2835, true); //72 dpi
	view.setInt32(42, 2835, true);

	const data = image.data;
	for (let y = 0; y < height; y++) {
		let target = 54 + (height - 1 - y) * row_size;
		for (let x = 0; x < width; x++) {
			const source = (y * width + x) * 4;
			const alpha = data[source + 3] / 255;
			bytes[target++] = Math.round(data[source + 2] * alpha + 255 * (1 - alpha));
			bytes[target++] = Math.round(data[source + 1] * alpha + 255 * (1 - alpha));
			bytes[target++] = Math.round(data[source] * alpha + 255 * (1 - alpha));
		}
	}
	return bytes;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Blob}
 */
export function canvas_to_bmp_blob(canvas) {
	const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
	return new Blob([encode_bmp(image)], {type: 'image/bmp'});
}
