import app from './../../app.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * opens image from webcam
 *
 * @author ViliusL
 */
class File_open_webcam_class {

	constructor(owner) {
		this.owner = owner;
	}

	open_webcam() {
		const video = document.createElement('video');
		video.autoplay = true;
		video.style.maxWidth = '100%';
		let track = null;

		function handleSuccess(stream) {
			track = stream.getTracks()[0];
			video.srcObject = stream;
		}

		function handleError(error) {
			alertify.error(t('Sorry, cold not load getUserMedia() data: ') + error);
		}

		const settings = {
			title: 'Webcam',
			params: [
				{title: "Stream:", html: '<div id="webcam_container"></div>'},
			],
			on_load(){
				document.getElementById('webcam_container').appendChild(video);
			},
			on_finish: () => {
				//capture data
				const width = video.videoWidth;
				const height = video.videoHeight;

				const tmpCanvas = document.createElement('canvas');
				const tmpCanvasCtx = tmpCanvas.getContext("2d");
				tmpCanvas.width = width;
				tmpCanvas.height = height;
				tmpCanvasCtx.drawImage(video, 0, 0);

				//create requested layer
				const new_layer = {
					name: `Webcam #${  this.owner.Base_layers.auto_increment}`,
					type: 'image',
					data: tmpCanvas.toDataURL("image/png"),
					width,
					height,
					width_original: width,
					height_original: height,
				};
				app.State.do_action(
					new app.Actions.Bundle_action('open_file_webcam', 'Open File Webcam', [
						new app.Actions.Insert_layer_action(new_layer),
						new app.Actions.Autoresize_canvas_action(width, height, null, true, true)
					])
				);

				//destroy
				if(track != null){
					track.stop();
				}
				video.pause();
				video.src = "";
				video.load();
			},
			on_cancel(){
				if(track != null){
					track.stop();
				}
				video.pause();
				video.src = "";
				video.load();
			},
		};
		this.owner.POP.show(settings);

		navigator.mediaDevices.getUserMedia({audio: false, video: true})
			.then(handleSuccess)
			.catch(handleError);
	}

}

// internal sub-module of file/open - not an app module, must not be auto-registered
File_open_webcam_class.auto_register = false;

export default File_open_webcam_class;
