/* global tinymce: true, CitationView: true, wordCount: true */

/*
 * This file is named plugin.min.js because that's what TinyMCE 4
 * expects. I'd still like to keep it unminified because it makes
 * development easier.
 */

(function() {
    var DOM = tinymce.DOM;
    var DomQuery = tinymce.dom.DomQuery;
    var each = tinymce.each;
    var klass = 'materialCitation'; //also in CSS
    var Event = tinymce.dom.Event;
    var EventUtils = tinymce.dom.EventUtils;

    tinymce.create('tinymce.plugins.Citation', {
        getInfo: function() {
            return {
                longname: 'Citation Plugin',
                author: 'Schuyler Duveen',
                authorurl: 'http://ctl.columbia.edu/',
                infourl: 'http://mediathread.info/',
                version: '1.2'
            };
        },
        createCitationHTML: function(annotation) {
            var rv = ' <a href="' + annotation.annotation + '" class="' +
                klass + '';
            if (annotation.type) {
                rv += ' asset-' + annotation.type;
            }
            if (annotation.range1 === 0) {
                rv += ' asset-whole';
            }
            rv += '">' + decodeURI(annotation.title) + '</a> ';
            return rv;
        },
        addCitation: function(evt) {
            evt = (evt) ? evt : window.event;
            var citation = evt.target || evt.srcElement;
            var annotationDict = this.decodeCitation(citation);
            if (annotationDict) {
                var cite_text = this.createCitationHTML(annotationDict);
                tinymce.execCommand('mceInsertContent', false, cite_text);
            }
        },
        decodeCitation: function(imgElt) {
            var annotationDict = false;
            var reg = String(imgElt.src).match(/#(annotation=.+)$/);
            if (reg !== null) {
                annotationDict = {};
                //stolen from Mochi
                var pairs = reg[1].replace(/\+/g, '%20').split(
                        /\&amp\;|\&\#38\;|\&#x26;|\&/);
                each(pairs, function(p) {
                    var kv = p.split('=');
                    var key = kv.shift();
                    annotationDict[key] = kv.join('=');
                });
                //removing extraneous 0's in the timecode
                annotationDict.title = (annotationDict.title
                                          .replace(/([ -])0:/g, '$1')
                                          .replace(/([ -])0/g, '$1'));
            } else {
                var annotationHref = imgElt.getAttribute('name');
                var linkTitle = imgElt.getAttribute('title');
                if (linkTitle && annotationHref) {
                    annotationDict = {
                        annotation: annotationHref,
                        title: linkTitle
                    };
                }
            }
            return annotationDict;
        },
        _decorateCitationAdders: function(ed, citationPlugin, dom) {
            var highlighter = null;
            each(DOM.select('img.' + klass, dom), function(citer) {
                if (DomQuery(citer).hasClass('clickableCitation')) {
                    citer.onclick = function(evt) {
                        citationPlugin.addCitation(evt);
                    };
                }
            }, this);
            EventUtils.bind(document.body, 'mouseover', function(evt) {
                if (highlighter !== null) {
                    DOM.remove(highlighter);
                    highlighter = null;
                }
            });
        },
        init: function(ed, url) {
            //called when TinyMCE area is modified
            //but only gets triggered when focus comes to the editor.
            var self = this;
            ed.onChange.add(this._onChange, this);
            this.newStyle = false;
            this.legacy = true; //legacy support

            if (typeof tinymce.plugins.EditorWindow === 'function'
                //TODO: also test for >IE6 and other stupidness
               ) {
                this.newStyle = true;

                self._decorateCitationAdders(ed, self, document);
                self.decorateCitationAdders = function(dom) {
                    self._decorateCitationAdders(ed, self, dom);
                };
                // DOM.loadCSS(css_file);//in main--should be done
                // at discretion of page owner
                ed.onInit.add(function(ed) {
                    ///1. add CSS to editor context
                    ed.dom.loadCSS(url + '/css/citation.css');
                    ///2. add drop events for easy annotation
                    // dragging into the editor
                    var iframe = ed.getDoc().documentElement;
                    tinymce.dom.EventUtils.bind(
                        iframe, 'dragover', function(evt) {
                            evt.preventDefault();
                        });
                    tinymce.dom.EventUtils.bind(iframe, 'drop', function(evt) {
                        setTimeout(function() {
                            self._onChange(ed);
                        }, 50);
                        evt.preventDefault();

                        if (!/Firefox\/3/.test(navigator.userAgent)) {
                            //Firefox 3.6- seems to copy the element itself
                            // Firefox is the buggy one.
                            var droptarget = evt.target;
                            var url = String(evt.dataTransfer.getData('Text'));
                            var newimg = ed.dom.create('img', {src: url});

                            if (tinymce.isIE) {
                                //IE's target is always BODY
                                droptarget = ed.selection.getStart();
                                //still a little buggy
                                //I wish we could get better resolution
                                //of where the user is dropping the element.
                            }
                            droptarget.parentNode.insertBefore(
                                newimg, droptarget);
                        }
                    });

                    ///3. register Citation Plugin as a special cursor window
                    ///   which can show the annotation inline, etc.
                    if (typeof ed.addCursorWindow === 'function') {
                        ed.addCursorWindow({
                            name: 'citation',
                            test: function(currentElt) {
                                var par = DOM.getParent(
                                    currentElt, 'A.' + klass);
                                if (par && !par.name) {
                                    return par;
                                }
                            },
                            onUnload: function(win) {
                                if (self.current_opener) {
                                    Event.unbind(
                                        self.current_opener,
                                        'click',
                                        self.opener_listener);
                                    self.asset_target = null;
                                }
                                if (self.citation && self.citation.onUnload) {
                                    self.citation.onUnload();
                                    self.citation = null;
                                }
                            },
                            content: function(aTag) {
                                var annHref = String(aTag.href);
                                var dom = DOM.create(
                                    'div', {},
                                    '<a href="' + annHref + '">' +
                                        'View Selection</a>' +
                                        '<div class="asset-object">' +
                                        '<div class="assetbox" ' +
                                        'style="width: 322px; display:none;">' +
                                        '<div class="asset-display"></div>' +
                                        '<div class="clipstrip-display">' +
                                        '</div>' +
                                        '</div></div>');
                                self.opener_listener = DomQuery(dom.firstChild)
                                    .on('click', function(evt) {
                                        evt.preventDefault();
                                        var cv = new CitationView();
                                        cv.init({
                                            autoplay: true,
                                            targets: {
                                                asset: self.asset_target
                                            }});
                                        self.citation = cv.openCitation(aTag);
                                    });
                                self.current_opener = dom.firstChild;
                                //target should be the thing that has display:none
                                self.asset_target = dom.lastChild.firstChild;
                                return dom;
                            }
                        });
                    }
                });
                ///TODO: confirm that the right attributes are in valid_elements for the configuration (and not in invalid_elements)
            }
        },
        _onChange: function(inst, undo_level, undo_manager) {
            var dok = inst.getDoc();
            ///VITAL HACK
            if (typeof wordCount === 'function') {
                wordCount();//window.setTimeout(wordCount,0);
            }
            var triggerChange = false;
            each(inst.dom.select('img'), function(c) {
                var annotationDict = this.decodeCitation(c);
                if (annotationDict) {
                    // WORKAROUND: when firefox 3.5 drags a whole
                    // asset, it drags the H2
                    if (c.parentNode.parentNode.tagName
                        .toLowerCase() === 'h2' &&
                        /asset/.test(c.parentNode.parentNode.className)
                       ) {
                        c = c.parentNode.parentNode;
                    }
                    inst.dom.replace(
                        inst.dom.create(
                            'span', null,
                            this.createCitationHTML(annotationDict)),
                        c //old annotation
                    );
                    triggerChange = true;
                }//if /#!annotation/.test(c.src)
            }, this);

            if (this.legacy) {
                each(inst.dom.select('input.' + klass), function(c) {
                    /*This is for cleaning up, or rather, DE-cleaning up the spaces
                      around the input element which protect it from weird deletion.
                      Basically, tinyMCE cleans up spaces around the INPUT element,
                      but without a non-breaking space on each side, INPUT is subject to
                      some weird DOM deletions, or copying the value as text outside.
                    */
                    var x;
                    if (typeof(c.nextSibling) === 'object') {
                        if (c.nextSibling === null) {
                        } else if (c.nextSibling.nodeType === 3) {
                            x = c.nextSibling.textContent;
                            if (x === '' || x === ' ') {
                                c.nextSibling.nodeValue = '\xa0'; //nbsp
                            }
                        }
                    }
                    if (typeof(c.previousSibling) === 'object') {
                        if (c.previousSibling === null) {
                            var p = c.parentNode;
                            p.insertBefore(dok.createTextNode('\xa0'), c);
                        } else if (c.previousSibling.nodeType === 3) {
                            x = c.previousSibling.textContent;
                            if (x === '' || x === ' ') {
                                c.previousSibling.nodeValue = '\xa0'; //nbsp
                            }
                        }
                    }

                }, this);
            }
            if (triggerChange) {
                inst.nodeChanged();
            }
        }
    });

    // Register plugin
    tinymce.PluginManager.add('citation', tinymce.plugins.Citation);
})();
