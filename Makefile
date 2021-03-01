JS_FILES=plugin.js

all: clean jshint jscs

clean:
	rm -rf node_modules

node_modules/jshint/bin/jshint:
	npm install jshint --prefix .

node_modules/jscs/bin/jscs:
	npm install jscs --prefix .

jshint: node_modules/jshint/bin/jshint
	./node_modules/jshint/bin/jshint $(JS_FILES)

jscs: node_modules/jscs/bin/jscs
	./node_modules/jscs/bin/jscs $(JS_FILES)

.PHONY: jshint jscs clean
