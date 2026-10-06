const menuDefinition = [
	{
		name: 'WebPhos',
		app_menu: true,
		children: [
			{
				name: 'About WebPhos',
				ellipsis: true,
				target: 'help/about.about'
			},
			{
				name: 'Support the Project',
				href: 'https://github.com/sponsors/heptau'
			},
			{
				divider: true
			},
			{
				name: 'Settings',
				shortcut: 'Ctrl+,',
				ellipsis: true,
				target: 'tools/settings.settings'
			},
			{
				divider: true
			},
			{
				name: 'Quit WebPhos',
				target: 'help/quit.quit'
			}
		]
	},
	{
		name: 'File',
		children: [
			{
				name: 'New',
				target: 'file/new.new'
			},
			{
				divider: true
			},
			{
				name: 'Open',
				children: [
					{
						name: 'Open File',
						shortcut: 'O',
						ellipsis: true,
						target: 'file/open.open_file'
					},
					{
						name: 'Open Directory',
						ellipsis: true,
						target: 'file/open.open_dir'
					},
					{
						name: 'Open from Webcam',
						target: 'file/open.open_webcam'
					},
					{
						name: 'Open URL',
						ellipsis: true,
						target: 'file/open.open_url'
					},
					{
						name: 'Open Data URL',
						ellipsis: true,
						target: 'file/open.open_data_url'
					}
				]
			},
			{
				name: 'New from Template',
				ellipsis: true,
				target: 'file/templates.new_from_template'
			},
			{
				name: 'Save as Template',
				ellipsis: true,
				target: 'file/templates.save_as_template'
			},
			{
				name: 'Open Recent',
				children: [
					{
						name: 'No Recent Files',
						disabled: true
					}
				]
			},
			{
				divider: true
			},
			{
				name: 'Export',
				ellipsis: true,
				shortcut: 'S',
				target: 'file/save.export'
			},
			{
				name: 'Quick Export',
				shortcut: 'Alt+Shift+Ctrl+W',
				target: 'file/save.quick_export'
			},
			{
				name: 'Export Sizes',
				ellipsis: true,
				target: 'file/export_extra.export_scales'
			},
			{
				name: 'Export App Icons',
				target: 'file/export_extra.export_icons'
			},
			{
				name: 'Export Sprite Sheet',
				ellipsis: true,
				target: 'file/export_extra.export_sprite_sheet'
			},
			{
				name: 'Export Print Tiles',
				ellipsis: true,
				target: 'file/export_extra.export_print_tiles'
			},
			{
				name: 'Export Selection',
				target: 'file/export_extra.export_selection'
			},
			{
				name: 'Export with Watermark',
				ellipsis: true,
				target: 'file/export_extra.export_watermark'
			},
			{
				name: 'Export Document Info',
				target: 'file/export_extra.export_info'
			},
			{
				divider: true
			},
			{
				name: 'Save As',
				ellipsis: true,
				shortcut: 'Shift + S',
				target: 'file/save.save'
			},
			{
				name: 'Save As Data URL',
				ellipsis: true,
				target: 'file/save.save_data_url'
			},
			{
				name: 'Print',
				ellipsis: true,
				shortcut: 'Ctrl+P',
				target: 'file/print.print'
			},
			{
				divider: true
			},
			{
				name: 'Quick Save',
				shortcut: 'F9',
				target: 'file/quicksave.quicksave'
			},
			{
				name: 'Quick Load',
				shortcut: 'F10',
				target: 'file/quickload.quickload'
			}
		]
	},
	{
		name: 'Edit',
		children: [
			{
				name: 'Undo',
				shortcut: 'Ctrl+Z',
				target: 'edit/undo.undo'
			},
			{
				name: 'Redo',
				shortcut: 'Ctrl+Y',
				target: 'edit/redo.redo'
			},
			{
				name: 'Fade',
				ellipsis: true,
				shortcut: 'Shift+Ctrl+F',
				target: 'image/adjustments.fade'
			},
			{
				name: 'History',
				ellipsis: true,
				target: 'edit/history.history'
			},
			{
				divider: true
			},
			{
				name: 'Free Transform',
				shortcut: 'Ctrl+T',
				target: 'edit/transform.free_transform'
			},
			{
				name: 'Delete Selection',
				shortcut: 'Del',
				target: 'edit/selection.delete'
			},
			{
				name: 'Copy Selection',
				target: 'layer/new.new_selection'
			},
			{
				name: 'Cut',
				shortcut: 'Ctrl+X',
				target: 'edit/copy.cut'
			},
			{
				name: 'Copy to Clipboard',
				shortcut: 'Ctrl+C',
				target: 'edit/copy.copy_to_clipboard'
			},
			{
				name: 'Copy Merged',
				shortcut: 'Shift+Ctrl+C',
				target: 'edit/copy.copy_to_clipboard',
				parameter: 'merged'
			},
			{
				name: 'Paste',
				shortcut: 'Ctrl+V',
				target: 'edit/paste.paste'
			},
			{
				divider: true
			},
			{
				name: 'Copy as Data URL',
				target: 'file/export_extra.copy_data_url'
			},
			{
				name: 'Paste as New Document',
				target: 'edit/paste_new.paste_new'
			},
			{
				name: 'Repeat Last Command',
				shortcut: 'Alt+Shift+Ctrl+R',
				target: 'edit/repeat.repeat_last'
			},
			{
				name: 'Define Pattern',
				target: 'edit/fill.define_pattern'
			},
			{
				name: 'Fill with Pattern',
				target: 'edit/fill.fill_pattern'
			},
			{
				name: 'Find and Replace Text',
				ellipsis: true,
				target: 'edit/find_replace.find_replace'
			},
			{
				name: 'Fill with Foreground Color',
				shortcut: 'Alt+Backspace',
				target: 'edit/fill.fill'
			},
			{
				name: 'Fill with Background Color',
				shortcut: 'Ctrl+Backspace',
				target: 'edit/fill.fill_background'
			},
			{
				name: 'Stroke Selection',
				ellipsis: true,
				target: 'edit/selection.stroke_selection'
			}
		]
	},
	{
		name: 'Image',
		children: [
			{
				name: 'Information',
				shortcut: 'I',
				ellipsis: true,
				target: 'image/information.information'
			},
			{
				name: 'Canvas Size',
				ellipsis: true,
				target: 'image/size.size'
			},
			{
				name: 'Crop to Selection',
				target: 'image/crop_selection.crop'
			},
			{
				name: 'Trim',
				ellipsis: true,
				shortcut: 'T',
				target: 'image/trim.trim'
			},
			{
				divider: true
			},
			{
				name: 'Resize',
				ellipsis: true,
				shortcut: 'R',
				target: 'image/resize.resize'
			},
			{
				name: 'Image Rotation',
				children: [
					{
						name: '180°',
						target: 'image/rotate.rotate_180'
					},
					{
						name: '90° Clockwise',
						target: 'image/rotate.right'
					},
					{
						name: '90° Counter Clockwise',
						shortcut: 'L',
						target: 'image/rotate.left'
					},
					{
						name: 'Arbitrary',
						ellipsis: true,
						target: 'image/rotate.rotate'
					},
					{
						divider: true
					},
					{
						name: 'Mirror',
						ellipsis: true,
						target: 'image/adjustments.mirror'
					},
					{
						name: 'Flip Horizontal',
						target: 'image/flip.horizontal'
					},
					{
						name: 'Flip Vertical',
						target: 'image/flip.vertical'
					}
				]
			},
			{
				name: 'Canvas Rotation',
				children: [
					{
						name: '180°',
						target: 'image/canvas_rotate.rotate_180'
					},
					{
						name: '90° Clockwise',
						target: 'image/canvas_rotate.right'
					},
					{
						name: '90° Counter Clockwise',
						target: 'image/canvas_rotate.left'
					}
				]
			},
			{
				name: 'Translate',
				ellipsis: true,
				target: 'image/translate.translate'
			},
			{
				name: 'Opacity',
				ellipsis: true,
				target: 'image/opacity.opacity'
			},
			{
				divider: true
			},
			{
				name: 'Repeat Last Adjustment',
				shortcut: 'Alt+Ctrl+F',
				target: 'image/adjustments.repeat_last'
			},
			{
				name: 'Quick Edit',
				ellipsis: true,
				shortcut: 'Shift+Ctrl+Q',
				target: 'image/quick_edit.quick_edit'
			},
			{
				name: 'Recipes',
				children: [
					{ name: 'Portrait', target: 'image/quick_edit.recipe', parameter: 'portrait' },
					{ name: 'Product Photo', target: 'image/quick_edit.recipe', parameter: 'product' },
					{ name: 'Vintage', target: 'image/quick_edit.recipe', parameter: 'vintage' },
					{ name: 'Black and White Drama', target: 'image/quick_edit.recipe', parameter: 'drama' },
					{ name: 'Thumbnail Pop', target: 'image/quick_edit.recipe', parameter: 'thumbnail' }
				]
			},
			{
				name: 'Adjustments',
				children: [
					{
						name: 'Dehaze',
						ellipsis: true,
						target: 'image/photo_effects.dehaze'
					},
					{
						name: 'Split Toning',
						ellipsis: true,
						target: 'image/photo_effects.split_toning'
					},
					{
						name: 'Color Lookup',
						ellipsis: true,
						target: 'image/photo_effects.color_lookup'
					},
					{
						name: 'Defringe',
						ellipsis: true,
						target: 'image/photo_effects.defringe'
					},
					{
						name: 'White Balance',
						ellipsis: true,
						target: 'image/photo_effects.white_balance'
					},
					{
						name: 'Duotone',
						ellipsis: true,
						target: 'image/photo_effects.duotone'
					},
					{
						name: 'HDR Toning',
						ellipsis: true,
						target: 'image/photo_effects.hdr_toning'
					},
					{
						name: 'Soften Skin',
						ellipsis: true,
						target: 'image/photo_effects.surface_blur'
					},
					{
						name: 'Reduce to Palette',
						ellipsis: true,
						target: 'image/photo_effects.reduce_to_palette'
					},
					{
						name: 'Pixel Art',
						ellipsis: true,
						target: 'image/photo_effects.pixel_art'
					},
					{
						name: 'Save Last Adjustment as LUT',
						target: 'image/photo_effects.save_adjustment_lut'
					},
					{
						name: 'Match Color',
						ellipsis: true,
						target: 'image/adjustments.match_color'
					},
					{
						name: 'Levels',
						ellipsis: true,
						shortcut: 'Ctrl+L',
						target: 'image/adjustments.levels'
					},
					{
						name: 'Brightness/Contrast',
						ellipsis: true,
						target: 'image/adjustments.brightness_contrast'
					},
					{
						name: 'Hue/Saturation',
						ellipsis: true,
						shortcut: 'Ctrl+U',
						target: 'image/adjustments.hue_saturation'
					},
					{
						name: 'Exposure',
						ellipsis: true,
						target: 'image/adjustments.exposure'
					},
					{
						name: 'Color Balance',
						ellipsis: true,
						shortcut: 'Ctrl+B',
						target: 'image/adjustments.color_balance'
					},
					{
						name: 'Photo Filter',
						ellipsis: true,
						target: 'image/adjustments.photo_filter'
					},
					{
						name: 'Gradient Map',
						ellipsis: true,
						target: 'image/adjustments.gradient_map'
					},
					{
						name: 'Channel Mixer',
						ellipsis: true,
						target: 'image/adjustments.channel_mixer'
					},
					{
						name: 'Shadows/Highlights',
						ellipsis: true,
						target: 'image/adjustments.shadows_highlights'
					},
					{
						name: 'Temperature/Tint',
						ellipsis: true,
						target: 'image/adjustments.temperature_tint'
					},
					{
						name: 'Sepia Tone',
						ellipsis: true,
						target: 'image/adjustments.sepia'
					},
					{
						name: 'Swap Channels',
						ellipsis: true,
						target: 'image/adjustments.swap_channels'
					},
					{
						name: 'Extract Channel',
						ellipsis: true,
						target: 'image/adjustments.extract_channel'
					},
					{
						name: 'Curves',
						ellipsis: true,
						shortcut: 'Ctrl+M',
						target: 'image/adjustments.curves'
					},
					{
						name: 'Selective Color',
						ellipsis: true,
						target: 'image/adjustments.selective_color'
					},
					{
						name: 'Color Corrections',
						ellipsis: true,
						target: 'image/color_corrections.color_corrections'
					},
					{
						name: 'Auto Contrast',
						shortcut: 'Shift+Ctrl+L',
						target: 'image/adjustments.auto_contrast'
					},
					{
						name: 'Auto Color',
						shortcut: 'Shift+Ctrl+B',
						target: 'image/adjustments.auto_color'
					},
					{
						name: 'Equalize',
						target: 'image/adjustments.equalize'
					},
					{
						name: 'Auto Adjust Colors',
						shortcut: 'F',
						target: 'image/auto_adjust.auto_adjust'
					},
					{
						divider: true
					},
					{
						name: 'Invert',
						shortcut: 'Ctrl+I',
						target: 'image/adjustments.invert'
					},
					{
						name: 'Desaturate',
						shortcut: 'Shift+Ctrl+U',
						target: 'image/adjustments.desaturate'
					},
					{
						name: 'Threshold',
						ellipsis: true,
						target: 'image/adjustments.threshold'
					},
					{
						name: 'Posterize',
						ellipsis: true,
						target: 'image/adjustments.posterize'
					},
					{
						name: 'Decrease Color Depth',
						target: 'image/decrease_colors.decrease_colors'
					}
				]
			},
			{
				name: 'Color Palette',
				ellipsis: true,
				target: 'image/palette.palette'
			},
			{
				divider: true
			},
			{
				name: 'Histogram',
				ellipsis: true,
				target: 'image/histogram.histogram'
			}
		]
	},
	{
		name: 'Layer',
		children: [
			{
				name: 'New',
				shortcut: 'Shift+Ctrl+N',
				target: 'layer/new.new'
			},
			{
				name: 'New Fill Layer',
				children: [
					{ name: 'Solid Color', target: 'layer/fill.fill_layer', parameter: 'solid' },
					{ name: 'Gradient', target: 'layer/fill.fill_layer', parameter: 'gradient' }
				]
			},
			{
				name: 'New from Selection',
				target: 'layer/new.new_selection'
			},
			{
				name: 'Layer via Cut',
				shortcut: 'Shift+Ctrl+J',
				target: 'layer/new.new_selection',
				parameter: 'cut'
			},
			{
				name: 'New from Selection (Merged)',
				target: 'layer/new.new_selection',
				parameter: 'merged'
			},
			{
				divider: true
			},
			{
				name: 'Duplicate',
				shortcut: 'D',
				target: 'layer/duplicate.duplicate'
			},
			{
				name: 'Layer via Copy',
				shortcut: 'Ctrl+J',
				target: 'layer/duplicate.via_copy'
			},
			{
				name: 'Show / Hide',
				target: 'layer/visibility.toggle'
			},
			{
				name: 'Delete',
				target: 'layer/delete.delete'
			},
			{
				name: 'Convert to Raster',
				target: 'layer/raster.raster'
			},
			{
				divider: true
			},
			{
				name: 'Move',
				children: [
					{
						name: 'Up',
						target: 'layer/move.up'
					},
					{
						name: 'Down',
						target: 'layer/move.down'
					}
				]
			},
			{
				name: 'Group',
				children: [
					{
						name: 'Set Group',
						ellipsis: true,
						target: 'layer/group.set_group'
					},
					{
						name: 'Clear Group',
						target: 'layer/group.clear_group'
					},
					{
						divider: true
					},
					{
						name: 'Show / Hide Group',
						target: 'layer/group.toggle_visibility'
					},
					{
						name: 'Merge Group',
						target: 'layer/group.merge_group'
					}
				]
			},
			{
				name: 'Lock / Unlock Layer',
				target: 'layer/lock.toggle'
			},
			{
				name: 'Layer Mask',
				children: [
					{
						name: 'Reveal All',
						target: 'layer/mask.reveal_all'
					},
					{
						name: 'Hide All',
						target: 'layer/mask.hide_all'
					},
					{
						name: 'Remove Background',
						target: 'layer/mask.remove_background'
					},
					{
						name: 'From Selection',
						target: 'layer/mask.from_selection'
					},
					{
						divider: true
					},
					{
						name: 'Mask to Selection',
						target: 'layer/mask.to_selection'
					},
					{
						name: 'Invert Mask',
						target: 'layer/mask.invert'
					},
					{
						name: 'Disable / Enable Mask',
						target: 'layer/mask.toggle'
					},
					{
						divider: true
					},
					{
						name: 'Apply Mask',
						target: 'layer/mask.apply'
					},
					{
						name: 'Delete Mask',
						target: 'layer/mask.remove'
					}
				]
			},
			{
				name: 'Trim to Content',
				target: 'image/trim.trim_to_content'
			},
			{
				name: 'Align / Distribute',
				children: [
					{
						name: 'Align Left',
						target: 'layer/align.align_left'
					},
					{
						name: 'Align Horizontal Center',
						target: 'layer/align.align_center'
					},
					{
						name: 'Align Right',
						target: 'layer/align.align_right'
					},
					{
						divider: true
					},
					{
						name: 'Align Top',
						target: 'layer/align.align_top'
					},
					{
						name: 'Align Vertical Center',
						target: 'layer/align.align_middle'
					},
					{
						name: 'Align Bottom',
						target: 'layer/align.align_bottom'
					},
					{
						divider: true
					},
					{
						name: 'Distribute Horizontally',
						target: 'layer/align.distribute_horizontally'
					},
					{
						name: 'Distribute Vertically',
						target: 'layer/align.distribute_vertically'
					}
				]
			},
			{
				name: 'Layer Style',
				children: [
					{
						name: 'Drop Shadow',
						ellipsis: true,
						target: 'effects/common/shadow.shadow'
					},
					{
						name: 'Outer Glow',
						ellipsis: true,
						target: 'effects/common/glow.glow'
					},
					{
						name: 'Inner Shadow',
						ellipsis: true,
						target: 'effects/common/inner-shadow.inner_shadow'
					},
					{
						name: 'Bevel & Emboss',
						ellipsis: true,
						target: 'effects/common/bevel.bevel'
					},
					{
						name: 'Color Overlay',
						ellipsis: true,
						target: 'effects/common/color-overlay.color_overlay'
					},
					{
						name: 'Gradient Overlay',
						ellipsis: true,
						target: 'effects/common/gradient-overlay.gradient_overlay'
					},
					{
						name: 'Stroke',
						ellipsis: true,
						target: 'effects/common/stroke.stroke'
					}
				]
			},
			{
				name: 'Composition',
				ellipsis: true,
				target: 'layer/composition.composition'
			},
			{
				name: 'Color Label',
				ellipsis: true,
				target: 'layer/label.label'
			},
			{
				name: 'Rename',
				ellipsis: true,
				target: 'layer/rename.rename'
			},
			{
				name: 'Copy to Document',
				ellipsis: true,
				target: 'layer/copy_to_document.copy_to_document'
			},
			{
				name: 'Rename All',
				ellipsis: true,
				target: 'layer/rename_all.rename_all'
			},
			{
				name: 'Clear',
				target: 'layer/clear.clear'
			},
			{
				divider: true
			},
			{
				name: 'Differences Down',
				target: 'layer/differences.differences'
			},
			{
				name: 'Stamp Visible',
				shortcut: 'Alt+Shift+Ctrl+E',
				target: 'layer/stamp.stamp_visible'
			},
			{
				name: 'Merge Down',
				shortcut: 'Ctrl+E',
				target: 'layer/merge.merge'
			},
			{
				name: 'Flatten Image',
				shortcut: 'Shift+Ctrl+E',
				target: 'layer/flatten.flatten'
			}
		]
	},
	{
		name: 'Select',
		children: [
			{
				name: 'All',
				shortcut: 'Ctrl+A',
				target: 'edit/selection.select_all'
			},
			{
				name: 'Deselect',
				shortcut: 'Ctrl+D',
				target: 'edit/selection.deselect'
			},
			{
				name: 'Reselect',
				shortcut: 'Shift+Ctrl+D',
				target: 'edit/selection.reselect'
			},
			{
				divider: true
			},
			{
				name: 'Inverse',
				shortcut: 'Shift+Ctrl+I',
				target: 'edit/selection.invert'
			},
			{
				name: 'Refine Edge',
				ellipsis: true,
				target: 'edit/selection.refine_edge'
			},
			{
				name: 'Grow',
				ellipsis: true,
				target: 'edit/selection.grow_similar'
			},
			{
				name: 'Similar',
				ellipsis: true,
				target: 'edit/selection.select_similar'
			},
			{
				name: 'Modify',
				children: [
					{
						name: 'Expand',
						ellipsis: true,
						target: 'edit/selection.expand'
					},
					{
						name: 'Contract',
						ellipsis: true,
						target: 'edit/selection.contract'
					},
					{
						name: 'Feather',
						ellipsis: true,
						target: 'edit/selection.feather'
					},
					{
						name: 'Smooth',
						ellipsis: true,
						target: 'edit/selection.smooth'
					},
					{
						name: 'Offset',
						ellipsis: true,
						target: 'edit/selection.offset'
					},
					{
						name: 'Border',
						ellipsis: true,
						target: 'edit/selection.border'
					},
					{
						divider: true
					},
					{
						name: 'Rectangle to Ellipse',
						target: 'edit/selection.to_ellipse'
					}
				]
			},
			{
				divider: true
			},
			{
				name: 'Quick Mask',
				shortcut: 'Q',
				target: 'edit/selection.quick_mask'
			},
			{
				name: 'Selection to New Layer',
				target: 'edit/selection.mask_to_layer'
			},
			{
				name: 'Save Selection',
				ellipsis: true,
				target: 'edit/selection.save_selection'
			},
			{
				name: 'Load Selection',
				ellipsis: true,
				target: 'edit/selection.load_selection'
			},
			{
				name: 'Delete Saved Selection',
				ellipsis: true,
				target: 'edit/selection.delete_saved_selection'
			},
			{
				name: 'Import / Export',
				children: [
					{
						name: 'Export Saved Selections',
						ellipsis: true,
						target: 'edit/selection.export_saved_selections'
					},
					{
						name: 'Import Saved Selections',
						ellipsis: true,
						target: 'edit/selection.import_saved_selections'
					},
					{
						divider: true
					},
					{
						name: 'Export Selection as Image',
						target: 'edit/selection.export_selection_image'
					},
					{
						name: 'Import Selection from Image',
						ellipsis: true,
						target: 'edit/selection.import_selection_image'
					}
				]
			},
			{
				divider: true
			},
			{
				name: 'Sky',
				ellipsis: true,
				target: 'edit/selection.select_sky'
			},
			{
				name: 'Edges',
				ellipsis: true,
				target: 'edit/selection.select_edges'
			},
			{
				name: 'Luminosity Mask',
				ellipsis: true,
				target: 'edit/selection.luminosity'
			},
			{
				name: 'Subject',
				ellipsis: true,
				target: 'edit/selection.select_subject'
			},
			{
				name: 'Color Range',
				ellipsis: true,
				target: 'edit/selection.color_range'
			},
			{
				name: 'Layer Transparency',
				target: 'edit/selection.layer_transparency'
			},
			{
				divider: true
			},
			{
				name: 'Layer via Copy',
				shortcut: 'Ctrl+J',
				target: 'layer/duplicate.via_copy'
			},
			{
				name: 'Delete Selection',
				shortcut: 'Del',
				target: 'edit/selection.delete'
			}
		]
	},
	{
		name: 'Effects',
		children: [
			{
				name: 'Effect browser',
				ellipsis: true,
				target: 'effects/browser.browser'
			},
			{
				divider: true
			},
			{
				name: 'Common Filters',
				children: [
					{
						name: 'Gaussian Blur',
						ellipsis: true,
						target: 'effects/common/blur.blur'
					},
					{
						name: 'Brightness',
						ellipsis: true,
						target: 'effects/common/brightness.brightness'
					},
					{
						name: 'Contrast',
						ellipsis: true,
						target: 'effects/common/contrast.contrast'
					},
					{
						name: 'Grayscale',
						ellipsis: true,
						target: 'effects/common/grayscale.grayscale'
					},
					{
						name: 'Hue Rotate',
						ellipsis: true,
						target: 'effects/common/hue-rotate.hue_rotate'
					},
					{
						name: 'Negative',
						ellipsis: true,
						target: 'effects/common/invert.invert'
					},
					{
						name: 'Saturate',
						ellipsis: true,
						target: 'effects/common/saturate.saturate'
					},
					{
						name: 'Sepia',
						ellipsis: true,
						target: 'effects/common/sepia.sepia'
					},
					{
						name: 'Shadow',
						ellipsis: true,
						target: 'effects/common/shadow.shadow'
					},
					{
						name: 'Stroke',
						ellipsis: true,
						target: 'effects/common/stroke.stroke'
					},
					{
						name: 'Glow',
						ellipsis: true,
						target: 'effects/common/glow.glow'
					},
					{
						name: 'Inner shadow',
						ellipsis: true,
						target: 'effects/common/inner-shadow.inner_shadow'
					},
					{
						name: 'Bevel',
						ellipsis: true,
						target: 'effects/common/bevel.bevel'
					},
					{
						name: 'Color overlay',
						ellipsis: true,
						target: 'effects/common/color-overlay.color_overlay'
					},
					{
						name: 'Gradient overlay',
						ellipsis: true,
						target: 'effects/common/gradient-overlay.gradient_overlay'
					},
				]
			},
			{
				name: 'Instagram Filters',
				children: [
					{
						name: '1977',
						target: 'effects/instagram/1977.1977'
					},
					{
						name: 'Aden',
						target: 'effects/instagram/aden.aden'
					},
					{
						name: 'Clarendon',
						target: 'effects/instagram/clarendon.clarendon'
					},
					{
						name: 'Gingham',
						target: 'effects/instagram/gingham.gingham'
					},
					{
						name: 'Inkwell',
						target: 'effects/instagram/inkwell.inkwell'
					},
					{
						name: 'Lo-fi',
						target: 'effects/instagram/lofi.lofi'
					},
					{
						name: 'Toaster',
						target: 'effects/instagram/toaster.toaster'
					},
					{
						name: 'Valencia',
						target: 'effects/instagram/valencia.valencia'
					},
					{
						name: 'X-Pro II',
						target: 'effects/instagram/xpro2.xpro2'
					}
				]
			},
			{
				name: 'Blur Background',
				ellipsis: true,
				target: 'image/photo_effects.blur_background'
			},
			{
				name: 'Sharpen Edges',
				ellipsis: true,
				target: 'image/photo_effects.sharpen_edges'
			},
			{
				name: 'Reduce Color Noise',
				ellipsis: true,
				target: 'image/photo_effects.reduce_color_noise'
			},
			{
				name: 'Vignette',
				ellipsis: true,
				target: 'image/photo_effects.vignette'
			},
			{
				name: 'Tilt-Shift',
				ellipsis: true,
				target: 'image/photo_effects.tilt_shift'
			},
			{
				name: 'Film Grain',
				ellipsis: true,
				target: 'image/photo_effects.film_grain'
			},
			{
				name: 'Halftone',
				ellipsis: true,
				target: 'image/photo_effects.halftone'
			},
			{
				name: 'Chromatic Aberration',
				ellipsis: true,
				target: 'image/photo_effects.chromatic_aberration'
			},
			{
				name: 'Dust & Scratches',
				ellipsis: true,
				target: 'image/photo_effects.dust_scratches'
			},
			{
				name: 'Add Noise',
				ellipsis: true,
				target: 'image/adjustments.add_noise'
			},
			{
				name: 'Pixelate',
				ellipsis: true,
				target: 'image/adjustments.pixelate'
			},
			{
				name: 'Unsharp Mask',
				ellipsis: true,
				target: 'image/adjustments.unsharp_mask'
			},
			{
				name: 'High Pass',
				ellipsis: true,
				target: 'image/adjustments.high_pass'
			},
			{
				name: 'Median',
				ellipsis: true,
				target: 'image/adjustments.median'
			},
			{
				name: 'Maximum',
				ellipsis: true,
				target: 'image/adjustments.maximum'
			},
			{
				name: 'Minimum',
				ellipsis: true,
				target: 'image/adjustments.minimum'
			},
			{
				name: 'Motion Blur',
				ellipsis: true,
				target: 'image/adjustments.motion_blur'
			},
			{
				name: 'Offset',
				ellipsis: true,
				target: 'image/adjustments.offset'
			},
			{
				name: 'Clarity',
				ellipsis: true,
				target: 'image/adjustments.clarity'
			},
			{
				name: 'Smart Blur',
				ellipsis: true,
				target: 'image/adjustments.smart_blur'
			},
			{
				name: 'Twirl',
				ellipsis: true,
				target: 'image/adjustments.twirl'
			},
			{
				name: 'Wave',
				ellipsis: true,
				target: 'image/adjustments.wave'
			},
			{
				name: 'Lens Flare',
				ellipsis: true,
				target: 'image/adjustments.lens_flare'
			},
			{
				name: 'Clouds',
				ellipsis: true,
				target: 'image/adjustments.clouds'
			},
			{
				name: 'Black and White',
				ellipsis: true,
				target: 'effects/black_and_white.black_and_white'
			},
			{
				name: 'Borders',
				ellipsis: true,
				target: 'effects/borders.borders'
			},
			{
				name: 'Blueprint',
				target: 'effects/blueprint.blueprint'
			},
			{
				name: 'Box Blur',
				ellipsis: true,
				target: 'effects/box_blur.box_blur'
			},
			{
				name: 'Denoise',
				ellipsis: true,
				target: 'effects/denoise.denoise'
			},
			{
				name: 'Dither',
				ellipsis: true,
				target: 'effects/dither.dither'
			},
			{
				name: 'Dot Screen',
				ellipsis: true,
				target: 'effects/dot_screen.dot_screen'
			},
			{
				name: 'Edge',
				target: 'effects/edge.edge'
			},
			{
				name: 'Emboss',
				target: 'effects/emboss.emboss'
			},
			{
				name: 'Enrich',
				ellipsis: true,
				target: 'effects/enrich.enrich'
			},
			{
				name: 'Grains',
				ellipsis: true,
				target: 'effects/grains.grains'
			},
			{
				name: 'Heatmap',
				target: 'effects/heatmap.heatmap'
			},
			{
				name: 'Mosaic',
				ellipsis: true,
				target: 'effects/mosaic.mosaic'
			},
			{
				name: 'Night Vision',
				target: 'effects/night_vision.night_vision'
			},
			{
				name: 'Oil',
				ellipsis: true,
				target: 'effects/oil.oil'
			},
			{
				name: 'Pencil',
				target: 'effects/pencil.pencil'
			},
			{
				name: 'Sharpen',
				ellipsis: true,
				target: 'effects/sharpen.sharpen'
			},
			{
				name: 'Solarize',
				target: 'effects/solarize.solarize'
			},
			{
				name: 'Tilt Shift',
				ellipsis: true,
				target: 'effects/tilt_shift.tilt_shift'
			},
			{
				name: 'Vignette',
				ellipsis: true,
				target: 'effects/vignette.vignette'
			},
			{
				name: 'Vibrance',
				ellipsis: true,
				target: 'effects/vibrance.vibrance'
			},
			{
				name: 'Vintage',
				ellipsis: true,
				target: 'effects/vintage.vintage'
			},
			{
				name: 'Zoom Blur',
				ellipsis: true,
				target: 'effects/zoom_blur.zoom_blur'
			}
		]
	},
	{
		name: 'View',
		children: [
			{
				name: 'Zoom',
				children: [
					{
						name: 'Zoom In',
						shortcut: 'Ctrl++',
						target: 'view/zoom.in'
					},
					{
						name: 'Zoom Out',
						shortcut: 'Ctrl+-',
						target: 'view/zoom.out'
					},
					{
						divider: true
					},
					{
						name: 'Original Size',
						shortcut: 'Ctrl+1',
						target: 'view/zoom.original'
					},
					{
						name: 'Zoom to Selection',
						shortcut: 'Alt+Ctrl+0',
						target: 'view/zoom.to_selection'
					},
					{
						name: 'Fit Window',
						shortcut: 'Ctrl+0',
						target: 'view/zoom.auto'
					}
				]
			},
			{
				name: 'Grid',
				shortcut: 'G',
				target: 'view/grid.grid'
			},
			{
				name: 'Guides',
				children: [
					{
						name: 'Insert',
						ellipsis: true,
						target: 'view/guides.insert'
					},
					{
						name: 'Update',
						target: 'view/guides.update'
					},
					{
						name: 'Remove all',
						target: 'view/guides.remove'
					}
				]
			},
			{
				name: 'Ruler',
				shortcut: 'Ctrl+R',
				target: 'view/ruler.ruler'
			},
			{
				name: 'Split Compare',
				target: 'view/split_compare.toggle'
			},
			{
				name: 'Compare with Original',
				target: 'view/compare.compare'
			},
			{
				name: 'Canvas Color',
				children: [
					{ name: 'Theme Default', target: 'view/canvas_color.set_color', parameter: 'default' },
					{ divider: true },
					{ name: 'Gray', target: 'view/canvas_color.set_color', parameter: 'gray' },
					{ name: 'Dark', target: 'view/canvas_color.set_color', parameter: 'dark' },
					{ name: 'Black', target: 'view/canvas_color.set_color', parameter: 'black' },
					{ name: 'White', target: 'view/canvas_color.set_color', parameter: 'white' }
				]
			},
			{
				name: 'Proof Colors',
				children: [
					{ name: 'Normal Vision', target: 'view/proof.proof', parameter: 'none' },
					{ divider: true },
					{ name: 'Protanopia (no red)', target: 'view/proof.proof', parameter: 'protanopia' },
					{ name: 'Deuteranopia (no green)', target: 'view/proof.proof', parameter: 'deuteranopia' },
					{ name: 'Tritanopia (no blue)', target: 'view/proof.proof', parameter: 'tritanopia' },
					{ name: 'Achromatopsia (no color)', target: 'view/proof.proof', parameter: 'achromatopsia' }
				]
			},
			{
				name: 'Grid Settings',
				ellipsis: true,
				target: 'view/grid.settings'
			},
			{
				name: 'Show Guides',
				shortcut: 'Ctrl+;',
				target: 'view/guides.toggle'
			},
			{
				name: 'Snap',
				shortcut: 'Shift+Ctrl+;',
				target: 'view/guides.toggle_snap'
			},
			{
				divider: true
			},
			{
				name: 'Full Screen',
				target: 'view/full_screen.fs'
			}
		]
	},
	{
		name: 'Tools',
		children: [
			{
				name: 'Sprites',
				target: 'tools/sprites.sprites'
			},
			{
				name: 'Key-Points',
				target: 'tools/keypoints.keypoints'
			},
			{
				name: 'Content Fill',
				ellipsis: true,
				target: 'tools/content_fill.content_fill'
			},
			{
				divider: true
			},
			{
				name: 'Color Zoom',
				ellipsis: true,
				target: 'tools/color_zoom.color_zoom'
			},
			{
				name: 'Replace Color',
				ellipsis: true,
				target: 'tools/replace_color.replace_color'
			},
			{
				name: 'Restore Alpha',
				ellipsis: true,
				target: 'tools/restore_alpha.restore_alpha'
			},
			{
				divider: true
			},
			{
				name: 'Search',
				shortcut: 'F3',
				ellipsis: true,
				target: 'tools/search.search'
			}
		]
	},
	{
		name: 'Window',
		children: [
			{ name: 'Options', panel: 'options', target: 'view/panels.toggle', parameter: 'options' },
			{ name: 'Tools', panel: 'tools', target: 'view/panels.toggle', parameter: 'tools' },
			{ divider: true },
			{ name: 'Preview', panel: 'preview', target: 'view/panels.toggle', parameter: 'preview' },
			{ name: 'Histogram', panel: 'histogram', target: 'view/panels.toggle', parameter: 'histogram' },
			{ name: 'Colors', panel: 'colors', target: 'view/panels.toggle', parameter: 'colors' },
			{ name: 'Layer details', panel: 'details', target: 'view/panels.toggle', parameter: 'details' },
			{ name: 'History', panel: 'history', target: 'view/panels.toggle', parameter: 'history' },
			{ name: 'Layers', panel: 'layers', target: 'view/panels.toggle', parameter: 'layers' },
			{ divider: true },
			{
				name: 'Swatches',
				children: [
					{ name: 'Load Swatches', ellipsis: true, target: 'tools/swatches.import_swatches' },
					{ name: 'Save Swatches', target: 'tools/swatches.export_swatches' }
				]
			},
			{
				name: 'Workspace',
				children: [
					{ name: 'Essentials', target: 'view/panels.workspace', parameter: 'essentials' },
					{ name: 'Painting', target: 'view/panels.workspace', parameter: 'painting' },
					{ name: 'Photography', target: 'view/panels.workspace', parameter: 'photography' },
					{ name: 'Minimal', target: 'view/panels.workspace', parameter: 'minimal' },
					{ divider: true },
					{ name: 'My Workspace', target: 'view/panels.workspace', parameter: 'custom' },
					{ name: 'Save Current Layout', ellipsis: false, target: 'view/panels.save_workspace' }
				]
			},
			{ divider: true },
			{ name: 'Status Bar', panel: 'status', target: 'view/panels.toggle', parameter: 'status' },
			{ divider: true },
			{ name: 'Hide / Show All Panels', shortcut: 'Ctrl+\\', target: 'view/panels.toggle_all' }
		]
	},
	{
		name: 'Help',
		children: [
			{
				name: 'Describe Document',
				shortcut: 'Alt+Ctrl+D',
				target: 'help/describe.describe'
			},
			{
				name: 'Keyboard Shortcuts',
				ellipsis: true,
				target: 'help/shortcuts.shortcuts'
			},
			{
				name: 'Privacy',
				ellipsis: true,
				target: 'help/privacy.privacy'
			},
			{
				name: 'Report Issues',
				href: 'https://github.com/heptau/webphos/issues'
			},

		]
	}
];


export default menuDefinition;