/*
	A single instance dispatcher for React JS flux architecture
*/
'use strict';
var Promise = require('es6-promise').Promise;
var isValidDependencyLayout = require('./isValidDependencyLayout.js');
var compareArraysWithProp = require('./compareArraysWithProp.js');

var getCallback = function (callbacks, store) {
	for (var x = 0; x < callbacks.length; x++) {
		if (callbacks[x].store === store) {
			return callbacks[x];
		}
	}
};

// A function that creates a waitFor() method for the specific dispatch
// callback. This is needed to understand what store is depending on what
// other stores
var createWaitForMethod = function (store, dispatcher) {
	
	return function (storeDeps, callback) {

		storeDeps = Array.isArray(storeDeps) ? storeDeps : [storeDeps];

		if (arguments.length < 2) {
			throw new Error('Missing argument(s) in waitFor()')
		}

		var isValidStores = compareArraysWithProp(null, storeDeps, 'store', dispatcher.callbacks);
		if (!isValidStores) {
			throw new Error('You have passed invalid stores to waitFor()');
		}

		var registeredCallback = getCallback(dispatcher.callbacks, store);
		registeredCallback.deps = storeDeps;

		if (isValidDependencyLayout('store', dispatcher.callbacks)) {
			var selectedPromises = dispatcher.callbacks.map(function(callback, index) {
				if (storeDeps.indexOf(callback.store) >= 0) {
					return dispatcher.promises[index];
				}
			});
			return Promise.all(selectedPromises).then(callback.bind(store));
		} else {
			throw new Error('There is an infinite loop on your waitFor handling');
		}

	};

};

// The wrapper ensures that "true" is returned
// even though the callback returns undefined
var createWrapper = function (context, callback) {
	return function (payload) {
		var result = callback.call(context, payload);
		if (result === undefined) {
			return true;
		} else {
			return result;
		}
	}
};

function Dispatcher () {
	this.callbacks = [];
	this.promises = [];
}

Dispatcher.prototype = {

    register: function(store, callback) {
    		// Create a context to bind the store to the
    		// waitFor method. This is needed to resolve dependencies
        var context = {
            waitFor: createWaitForMethod(store, this)
        };
        this.callbacks.push({
            store: store,
            func: createWrapper(context, callback),
            deps: []
        });
    },

    dispatch: function(payload) {
        var resolves = [];
        var rejects = [];

        // First create array of promises for each callback and
        // add their respective resolves and rejects to individual arrays
        // for later reference
        this.promises = this.callbacks.map(function(callback, i) {
            return new Promise(function(resolve, reject) {
                resolves[i] = resolve;
                rejects[i] = reject;
            });
        });

        // Dispatch to callbacks and resolve/reject promises.
        this.callbacks.forEach(function(callback, i) {
            // Callback can return an obj, to resolve, or a promise, to chain,
            // no matter what, resolve or reject the callback-promise. Pass
            // the returned value or payload by default
            Promise.resolve(callback.func(payload)).then(function(returnValue) {
                resolves[i](returnValue || payload);
            }, function(err) {
                new Error('Dispatcher callback unsuccessful');
                rejects[i](err);
            });
        });
        this.promises = [];
    }
};

module.exports = Dispatcher;