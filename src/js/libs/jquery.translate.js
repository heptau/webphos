// https://github.com/jorgejeferson/translate.js/tree/39be8237666a76035fc210a28d8e431f1416579e
(function ($) {
	//translations may contain simple inline markup; everything else (scripts, event handlers...) is dropped
	const ALLOWED_TAGS = ['B', 'I', 'U', 'EM', 'STRONG', 'SPAN', 'SMALL', 'BR', 'CODE', 'SUB', 'SUP', 'A'];
	const ALLOWED_ATTRS = ['class', 'title', 'href', 'target', 'rel'];

	function clean_node(source, target) {
		Array.prototype.forEach.call(source.childNodes, (node) => {
			if (node.nodeType === 3) {
				target.appendChild(document.createTextNode(node.nodeValue));
			}
			else if (node.nodeType === 1) {
				if (ALLOWED_TAGS.indexOf(node.tagName) < 0) {
					//unknown element: keep only its (cleaned) content
					clean_node(node, target);
					return;
				}
				const copy = document.createElement(node.tagName);
				Array.prototype.forEach.call(node.attributes, (attribute) => {
					const name = attribute.name.toLowerCase();
					if (ALLOWED_ATTRS.indexOf(name) < 0) {
						return;
					}
					if (name === 'href' && /^(https?:|mailto:|#)/i.test(attribute.value.trim()) === false) {
						return;
					}
					copy.setAttribute(name, attribute.value);
				});
				clean_node(node, copy);
				target.appendChild(copy);
			}
		});
	}

	//sets the content of the element from a text with simple markup, without evaluating it as HTML
	function set_safe_content($element, text) {
		const parsed = new DOMParser().parseFromString(String(text), 'text/html');
		const fragment = document.createDocumentFragment();
		clean_node(parsed.body, fragment);
		$element.empty().append(fragment);
	}

	$.fn.translate = function (options) {
		const that = this; //a reference to ourselves
		let settings = {
			css: "trn",
			attrs: ["alt", "placeholder", "title"],
			lang: "pt",
			langDefault: "pt",
		};
		settings = $.extend(settings, options || {});
		if (settings.css.lastIndexOf(".", 0) !== 0) { //doesn't start with '.'
			settings.css = `.${  settings.css}`;
		}
		const t = settings.t;
		//public methods
		this.lang = function (l) {
			if (l) {
				settings.lang = l;
				this.translate(settings);  //translate everything
			}
			return settings.lang;
		};
		this.get = function (index) {
			let res;

			try {
				res = t[index][settings.lang];
			}
			catch { //not found, return index
				return index;
			}
			if (res) {
				return res;
			}
			else {
				return index;
			}
		};
		this.g = this.get;
		//main
		this.find(settings.css).each(function () {
			const $this = $(this);

			//elements with an icon (svg) keep their content, only the attributes (title) are translated
			const has_icon = $this.find("svg").length > 0;
			let trn_key = $this.attr("data-trn-key");
			if (!trn_key && !has_icon) {
				trn_key = $this.html();
				$this.attr("data-trn-key", trn_key);
			}
			// Filtering attr
			$.each(this.attributes, function () {
				if ($.inArray(this.name, settings.attrs) !== -1) {
					let trn_attr_key = $this.attr("data-trn-attr");
					if (!trn_attr_key) {
						trn_attr_key = $this.attr(this.name);
						$this.attr("data-trn-attr", trn_attr_key);
					}
					$this.attr(this.name, that.get(trn_attr_key));
				}
			});
			if (!has_icon) {
				set_safe_content($this, that.get(trn_key));
			}
		});
		return this;
	};
})(jQuery);
