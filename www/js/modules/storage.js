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
    callback = callback || function() {};
    var data = {};

    if ( typeof query === "string" ) {
        query = [ query ];
    }

    if (Array.isArray(query)) {
        query.forEach(function(key) {
            data[key] = OSApp.Storage.store.get(key);
        });
    }

	if ( typeof callback === "function" ) {
		callback(data);
	} else {
		return data;
	}
};

/* Returns a single value from storage without a callback*/
OSApp.Storage.getItem = function( key ) {
	return OSApp.Storage.store.get(key);
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
