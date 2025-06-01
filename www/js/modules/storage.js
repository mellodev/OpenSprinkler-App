/* global store */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Configure module
var OSApp = OSApp || {};
OSApp.Storage = OSApp.Storage || {};

// We use store2 to wrap localStorage to provide namespacing (See github issue #214) store2 docs: https://github.com/nbubna/store
OSApp.Storage.store = store.namespace('OpenSprinkler')

OSApp.Storage.get = function( query, callback ) {
    var data = {};

    if ( typeof query === "string" ) {
        query = [ query ];
    }

    if (Array.isArray(query)) {
        query.forEach(function(key) {
            data[key] = OSApp.Storage.store.get(key);
        });
    }

	if ( callback && typeof callback === 'function' ) {
    	callback(data);
	} else {
		return data;
	}
};

/* Usage: OSApp.Storage.set({ preferences: { theme: 'dark', notifications: true } }); */
OSApp.Storage.set = function( dataToSet, callback ) {
    callback = callback || function() {};

    try {
        OSApp.Storage.store.setAll(dataToSet);
        callback(true);
    } catch (e) {
        console.error("Failed to set namespaced data in OSApp.Storage:", {e, dataToSet});
        callback(false, e);
    }
};


OSApp.Storage.remove = function( keysToRemove, callback ) {
    callback = callback || function() {};

    if ( typeof keysToRemove === "string" ) {
        keysToRemove = [ keysToRemove ];
    }

    if (Array.isArray(keysToRemove)) {
        keysToRemove.forEach(function(key) {
            // Now using the namespaced store's remove method
            OSApp.Storage.store.remove(key);
            // If key was 'userToken', store2 would attempt to remove 'OSApp.userToken' from localStorage
        });
    }

    callback(true);
};

OSApp.Storage.migrateLocalStorage = function() {
	// Check if instance is using localStorage rather than store2
	const keys = [
		'cloudDataToken',
		'current_site',
		'displayOption',
		'groupView',
		'is24Hour',
		'isMetric',
		'lang',
		'lastProgramRun',
		'runonce',
		'showDisabled',
		'showStationNum',
		'sites',
		'sortByStationName',
		'weatherData'
	];

	keys.forEach(function(storageKey) {
		try {
			const oldValueString = localStorage.getItem(storageKey);
			let valueToStore;

			try {
				valueToStore = {[storageKey]: JSON.parse(oldValueString)};
			} catch {
				valueToStore = {storageKey: oldValueString};
			}


			OSApp.Storage.set(valueToStore, function(){
				console.log(`*** migrateLocalStorage migrated key ${storageKey}`, {oldValueString, valueToStore});

				// localStorage.removeItem(storageKey)
			})
		} catch(ex) {
			console.error("*** OSApp.Storage.migrateLocalStorage uncaught exception", ex);
		}
	})

}
OSApp.Storage.loadLocalSettings = function() {
	OSApp.Storage.get( "isMetric", function( data ) {

		// We are using a switch because the boolean gets stored as a string
		// and we don't want to impact the in-memory value of `isMetric` when
		// no value in local storage exists.
		switch ( data.isMetric ) {
			case "true":
				OSApp.currentDevice.isMetric = true;
				break;
			case "false":
				OSApp.currentDevice.isMetric = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "is24Hour", function( data ) {
		switch ( data.is24Hour ) {
			case "true":
				OSApp.uiState.is24Hour = true;
				break;
			case "false":
				OSApp.uiState.is24Hour = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "groupView", function( data ) {
		switch ( data.groupView ) {
			case "true":
				OSApp.uiState.groupView = true;
				break;
			case "false":
				OSApp.uiState.groupView = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "sortByStationName", function( data ) {
		switch ( data.sortByStationName ) {
			case "true":
				OSApp.uiState.sortByStationName = true;
				break;
			case "false":
				OSApp.uiState.sortByStationName = false;
				break;
			default:
		}
	} );
};
