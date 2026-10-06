/**
 * Minimal PDF writer: one page that shows one JPEG image. No dependencies.
 */

function ascii(text) {
	var bytes = new Uint8Array(text.length);
	for (var i = 0; i < text.length; i++) {
		bytes[i] = text.charCodeAt(i) & 255;
	}
	return bytes;
}

function number(value) {
	return String(Math.round(value * 100) / 100);
}

/**
 * @param {Uint8Array} jpeg JPEG file data
 * @param {number} image_width width of the image in pixels
 * @param {number} image_height height of the image in pixels
 * @param {number} page_width page width in points (1/72 inch)
 * @param {number} page_height page height in points
 * @returns {Uint8Array} PDF file
 */
export function build_pdf(jpeg, image_width, image_height, page_width, page_height) {
	var w = number(page_width);
	var h = number(page_height);
	var content = 'q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im0 Do Q';

	var objects = [
		ascii('<< /Type /Catalog /Pages 2 0 R >>'),
		ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
		ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
		[
			ascii('<< /Type /XObject /Subtype /Image /Width ' + parseInt(image_width, 10) + ' /Height ' + parseInt(image_height, 10)
				+ ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'),
			jpeg,
			ascii('\nendstream'),
		],
		ascii('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'),
	];

	var chunks = [ascii('%PDF-1.4\n')];
	var length = chunks[0].length;
	var offsets = [];
	objects.forEach(function (object, index) {
		offsets.push(length);
		var parts = [ascii((index + 1) + ' 0 obj\n')].concat(Array.isArray(object) ? object : [object], [ascii('\nendobj\n')]);
		parts.forEach(function (part) {
			chunks.push(part);
			length += part.length;
		});
	});

	var xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
	offsets.forEach(function (offset) {
		xref += ('0000000000' + offset).slice(-10) + ' 00000 n \n';
	});
	xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + length + '\n%%EOF\n';
	chunks.push(ascii(xref));

	var total = chunks.reduce(function (sum, chunk) {
		return sum + chunk.length;
	}, 0);
	var result = new Uint8Array(total);
	var position = 0;
	chunks.forEach(function (chunk) {
		result.set(chunk, position);
		position += chunk.length;
	});
	return result;
}
