(function() {
    var DOM = tinymce.DOM;
    var each = tinymce.each;
    var klass='materialCitation'; //also in CSS
    var Event = tinymce.dom.Event;

    tinymce.create('tinymce.plugins.Citation', {
	getInfo : function() {
	    return {
		longname : 'Citation Plugin',
		author : 'Schuyler Duveen',
		authorurl : 'http://ccnmtl.columbia.edu',
		infourl : 'http://ccnmtl.columbia.edu/projects/vital/',
		version : "1.1" //for tinymce 3!
	    };
	},
	createCitationHTML: function(annotation) {
	    return ' <a href="'+annotation['annotation']+'" class="'+klass+'">'+annotation['title']+'</a> '
	    ///note that this can get changed by the url_converter.
	    ///see:
	    ///http://wiki.moxiecode.com/index.php/TinyMCE:Configuration/convert_urls
	    ///http://wiki.moxiecode.com/index.php/TinyMCE:Configuration/urlconverter_callback
	},
	addCitation: function(evt) {
	    evt = (evt) ? evt : window.event;
	    var citation= evt.target||evt.srcElement;
	    linkTitle=citation.getAttribute('title');
	    linkName=citation.getAttribute('name');
	    
	    //removing extraneous 0's in the timecode
	    linkTitle=linkTitle.replace(/([ -])0:/g,"$1");
	    linkTitle=linkTitle.replace(/([ -])0/g,"$1");

	    cite_text= this.createCitationHTML({annotation:linkName,title:linkTitle});
	    
	    tinyMCE.execCommand('mceInsertContent',false,cite_text);
	},
	init: function(ed,url) {
	    //called when TinyMCE area is modified
	    //but only gets triggered when focus comes to the editor.
	    var self = this;
	    ed.onChange.add(this._onChange, this);
	    this.newStyle = false;
	    this.legacy = true; //legacy support

	    if (typeof tinymce.plugins.EditorWindow == 'function'
		//TODO: also test for >IE6 and other stupidness
	       ) {
		this.newStyle = true;
		var css_file = url + '/skins/' + (ed.settings.citation_skin || 'minimalist') + "/citation.css";

		var highlighter = null;
		each(DOM.select('img.'+klass),function(citer) {
		    if (citer.onclick) {
			citer.onclick = function(evt){self.addCitation(evt);};
		    }

		    ///Adds a little cursor to where it will get added.
		    ///tested in Firefox, Webkit
		    Event.add(citer,'mouseover',function(evt) {
			if (highlighter == null) {
			    var active_ed = tinyMCE.activeEditor;
			    var editor_pos = DOM.getPos(active_ed.getContentAreaContainer());
			    var cursor_pos = DOM.getPos(active_ed.selection.getNode());
			    
			    var pos = {x:editor_pos.x-11, y:editor_pos.y+cursor_pos.y};
			    highlighter = DOM.create('div',{style:'height:12px;width:10px;background-color:red;position:absolute;top:'+pos.y+'px;left:'+pos.x+'px'},'>');
			    document.body.appendChild(highlighter);
			}
			evt.stopPropagation();
		    });
		},this);
		Event.add(document.body,'mouseover',function(evt) {
		    if (highlighter != null) {
			DOM.remove(highlighter);
			highlighter = null;
		    }
		});

		//DOM.loadCSS(css_file);//in main--should be done at discretion of page owner
		ed.onInit.add(function(ed) {
		    ///1. add CSS to editor context
		    ed.dom.loadCSS(css_file);

		    ///2. add drop events for easy annotation dragging into the editor
		    var iframe = ed.getDoc().documentElement;
		    tinymce.dom.Event.add(iframe, 'dragover',function(evt) {
			evt.preventDefault();
		    });
		    tinymce.dom.Event.add(iframe, 'drop',function(evt) {
			setTimeout(function() {
			    self._onChange(ed);
			},50);
			evt.preventDefault();

			if (tinymce.isWebKit || tinymce.isIE) {
			    //Firefox seems to copy the element itself
			    // but these folks need a little help
			    // maybe Firefox is the buggy one?
			    var droptarget = evt.target;
			    var url = String(evt.dataTransfer.getData("Text"));
			    var newimg = ed.dom.create('img',{src:url});

			    if (tinymce.isIE) {
				//IE's target is always BODY
				droptarget = ed.selection.getStart();
				//still a little buggy
				//I wish we could get better resolution
				//of where the user is dropping the element.
			    }
			    droptarget.parentNode.insertBefore(newimg,droptarget);
			}
		    });

		    ///3. register Citation Plugin as a special cursor window
		    ///   which can show the annotation inline, etc.
		    if (typeof ed.addCursorWindow == 'function') {
			ed.addCursorWindow({
			    name:'citation',
			    test:function(current_elt) {
				var par = DOM.getParent(current_elt, 'A.'+klass);
				if (par && !par.name) return par;
			    },
			    onUnload:function( win) {
				giveUp();
			    },
			    content:function(a_tag) {
				return DOM.create('div',{},
						  '<a href="javascript:openCitation(\''+a_tag.href+'\')">show annotation</a><div class="asset-object"><div id="videoclipbox" style="width: 322px; display:none;"><!-- width changes here too if video size changes --><div id="videoclip" class="asset-display"></div><div id="clipStrip"><div id="clipStripLabel"><!-- nothing --></div><div id="clipStripTrack"><div id="clipStripStart" class="clipSlider" onmouseover="return escape(\'Go to note start time\')" onclick="jumpToStartTime()" style="display:none"></div><div id="clipStripRange" class="clipStripRange" onclick="jumpToStartTime(true)" onmouseover="return escape(\'Play note\')" style="display:none"></div><div id="clipStripEnd" class="noteStripEnd" onmouseover="return escape(\'Go to note end time\')" onclick="jumpToEndTime()" style="display:none"></div></div></div></div></div>');
				/*
				return DOM.create('a',{href:a_tag.href,
						       target:'_blank'
						      },'open annotation');
                                 */
			    }
			});
		    }
		});
		///TODO: confirm that the right attributes are in valid_elements for the configuration (and not in invalid_elements)
	    }
	},
	_onChange : function(inst, undo_level, undo_manager) {
	    var dok=inst.getDoc();
	    ///VITAL HACK
	    if (typeof(wordCount) == 'function') {
		wordCount();//window.setTimeout(wordCount,0);
	    }
	    var triggerChange = false;
	    each( inst.dom.select('img'), function(c) {
		var reg = String(c.src).match(/#(annotation=.+)$/)
		if (reg != null) {
		    var annotationDict = {};
		    //stolen from Mochi
		    var pairs = reg[1].replace(/\+/g, "%20").split(/\&amp\;|\&\#38\;|\&#x26;|\&/);
		    each(pairs,function(p) {
			var kv = p.split('=');
			annotationDict[kv[0]] = kv[1];
		    });
		    //var linkName=c.getAttribute("name");
		    //var linkTitle=c.getAttribute("title");
		    var annotationHref = annotationDict['annotation'];
		    var linkTitle = annotationDict['title'];
			
		    //removing extraneous 0's in the timecode
		    linkTitle=linkTitle.replace(/([ -])0:/g,"$1");
		    linkTitle=linkTitle.replace(/([ -])0/g,"$1");

		    function swapCitation(inst,oldCitation, klass,linkTitle,annotationHref) {
			var newCitation = inst.dom.create('span',{},'&#160;<input type="button" class="'+klass+'" value="'+linkTitle+'" onclick="openCitation(\''+annotationHref+'\')" />&#160;');
			inst.dom.replace(newCitation,oldCitation);
		    }
		    function swapCitation_Mochi(inst,oldCitation, klass,linkTitle,annotationHref) {
			//temporarily swap which document MochiKit uses for DOM manipulation
			//This is necessary, because the A tag must be created with dok.createElement()
			var mochi_doc = MochiKit.DOM._document;
			MochiKit.DOM._document = inst.getDoc();
			newCitation = SPAN();//null, '&#160;', INPUT({'type':'button','class':klass,'value':linkTitle}),'&#160;');
			MochiKit.DOM._document = mochi_doc;
			
			//don't understand why 'onclick' can't be set with Mochi, but it can't
			//newCitation.childNodes[1].setAttribute('onclick',"openCitation('"+annotationHref+"')");
			newCitation.innerHTML = '&#160;<input type="button" class="'+klass+'" value="'+linkTitle+'" onclick="openCitation(\''+annotationHref+'\')" />&#160;';
			swapDOM(c,newCitation);
		    }

		    if (!this.newStyle) {
			swapCitation(inst,c, klass,linkTitle,annotationHref);
		    } else {//new!
			inst.dom.replace(
			    inst.dom.create('span', 
					    null, 
					    this.createCitationHTML(annotationDict)
					   )
			    ,c//old annotation
			);
		    }
		    triggerChange = true;
		}//if /#!annotation/.test(c.src)
	    }, this);

	    if (this.legacy) {
		each( inst.dom.select('input.'+klass), function(c){
			/*This is for cleaning up, or rather, DE-cleaning up the spaces 
			  around the input element which protect it from weird deletion.
			  Basically, tinyMCE cleans up spaces around the INPUT element,
			  but without a non-breaking space on each side, INPUT is subject to
			  some weird DOM deletions, or copying the value as text outside.
			 */
			//logDebug('nextsibling',typeof(c.nextSibling));
			if (typeof(c.nextSibling) == 'object') {
			    if (c.nextSibling == null) {
				//logDebug('  next  null');
			    } else if (c.nextSibling.nodeType == 3) {
				var x = c.nextSibling.textContent;
				//logDebug('x'+c.nextSibling.data+'x',c.nextSibling.textContent.length);
				if (x == '' || x == ' ') {
				    //logDebug('  next space');
				    c.nextSibling.nodeValue= '\xa0'; //nbsp
				}
			    }
			}
			if (typeof(c.previousSibling) == 'object') {
			    if (c.previousSibling == null) {
				//logDebug('  previous  null');
				var p = c.parentNode;
				p.insertBefore(dok.createTextNode('\xa0'),c);
			    } else if (c.previousSibling.nodeType == 3) {
				var x = c.previousSibling.textContent;
				//logDebug('x'+c.previousSibling.data+'x',c.previousSibling.textContent.length);
				if (x == '' || x == ' ') {
				    //logDebug('  previous space');
				    c.previousSibling.nodeValue= '\xa0'; //nbsp
				}
			    }
			}


		},this);
	    }
	    if (triggerChange) {
		inst.nodeChanged();
	    }
	}
    });
    
    // Register plugin
    tinymce.PluginManager.add("citation", tinymce.plugins.Citation); 
})();
