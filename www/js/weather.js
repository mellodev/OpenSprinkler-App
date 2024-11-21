/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <https://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

let OSWeather = OSWeather || {};

OSWeather.DEFAULT_WEATHER_SERVER_URL = "https://weather.opensprinkler.com";
OSWeather.WEATHER_SERVER_URL = DEFAULT_WEATHER_SERVER_URL;

OSWeather.checkURLandUpdateWeather = () => {
	var finish = function( wsp ) {
		if ( wsp ) {
			WEATHER_SERVER_URL = currPrefix + wsp;
		} else {
			WEATHER_SERVER_URL = DEFAULT_WEATHER_SERVER_URL;
		}

		OSWeather.updateWeather();
	};

	if ( controller.settings.wsp ) {
		if ( controller.settings.wsp === "weather.opensprinkler.com" ) {
			finish();
			return;
		}

		finish( controller.settings.wsp );
		return;
	}

	return $.get( currPrefix + currIp + "/su" ).then( function( reply ) {
		var wsp = reply.match( /value="([\w|:|/|.]+)" name=wsp/ );
		finish( wsp ? wsp[ 1 ] : undefined );
	} );
};

OSWeather.formatTemp = ( temp ) => {
	if ( isMetric ) {
		temp = Math.round( ( temp - 32 ) * ( 5 / 9 ) * 10 ) / 10 + " &#176;C";
	} else {
		temp = Math.round( temp * 10 ) / 10 + " &#176;F";
	}
	return temp;
};

OSWeather.formatPrecip = ( precip ) => {
	if ( isMetric ) {
		precip = Math.round( precip * 25.4 * 10 ) / 10 + " mm";
	} else {
		precip = Math.round( precip * 100 ) / 100 + " in";
	}
	return precip;
};

OSWeather.formatHumidity = ( humidity ) => {
	return Math.round( humidity ) + " %";
};

OSWeather.formatSpeed = ( speed ) => {
	if ( isMetric ) {
		speed = Math.round( speed * 1.6 * 10 ) / 10 + " km/h";
	} else {
		speed = Math.round( speed * 10 ) / 10 + " mph";
	}
	return speed;
};

OSWeather.hideWeather = () => {
	$( "#weather" ).empty().parents( ".info-card" ).addClass( "noweather" );
};

OSWeather.finishWeatherUpdate = () => {
	updateWeatherBox("finishWeatherUpdate");
	$.mobile.document.trigger( "weatherUpdateComplete" );
};

OSWeather.convertWUdata = (data) => {
	// Convert response from weather underground api to standard weather format
	let result = {
		weatherProvider: "WUnderground", // see makeAttribution()
		temp: 0,
		humidity: 0,
		wind: 0,
		// description: "Clear", // Not returned from observations
		// icon: "01d", // Not returned from observations
		// minTemp: 0, // Not returned from observations
		// maxTemp: 0, // Not returned from observations
		precip: 0,
		forecast: [], // Not returned from observations
		// Example Forecast children:
		// {
		// 	"temp_min": 39,
		// 	"temp_max": 75,
		// 	"date": 1732060800,
		// 	"icon": "01d",
		// 	"description": "Clear"
		// },
		location: [] // Array with gps coords for station
		// Example location:
		// 32.29261,
		// -111.07887
	};


	if (!data) {
		return result;
	}

	// wunderground station observations response:
	/*
	{
		"stationID": "KMAHANOV10",
		"obsTimeUtc": "2024-11-20T21:29:11Z",
		"obsTimeLocal": "2024-11-20 16:29:11",
		"neighborhood": "1505Broadway",
		"softwareType": "Rainwise IP-100",
		"country": "US",
		"solarRadiation": null,
		"lon": -70.864853,
		"realtimeFrequency": null,
		"epoch": 1732138151,
		"lat": 42.092632,
		"uv": null,
		"winddir": 22,
		"humidity": 81,
		"qcStatus": 1,
		"imperial": {
			"temp": 44,
			"heatIndex": 44,
			"dewpt": 38,
			"windChill": 44,
			"windSpeed": 0,
			"windGust": 1,
			"pressure": 29.82,
			"precipRate": 0,
			"precipTotal": 0,
			"elev": 104
		}
	} */

	// data stored in: imperial, metric, metric_si, uk_hybrid (depending on request format param)
	result.temp = data?.imperial?.temp;
	result.humidity = data?.humidity;
	result.wind = data?.imperial?.windSpeed;
	result._currentCoordinates = data?.lat + "," + data?.lon;
	result.location = [data?.lat, data?.lon];
	result.precip = data?.imperial?.precipTotal;

	return result;
};

OSWeather.updateWeather = () => {
	var now = new Date().getTime();
	const weatherUpdateTimeout = 5 * 60 * 100; // 5 minute timeout before weather data is re-requested

	if ( weather && weather.providedLocation === controller.settings.loc && now - weather.lastUpdated < weatherUpdateTimeout ) {
		finishWeatherUpdate();
		return;
	} else if ( localStorage.weatherData ) {
		try {
			var weatherData = JSON.parse( localStorage.weatherData );
			if ( weatherData.providedLocation === controller.settings.loc && now - weatherData.lastUpdated < weatherUpdateTimeout ) {
				weather = weatherData;
				finishWeatherUpdate();
				return;
			}
		} catch ( err ) {}
	}

	weather = undefined;

	if ( controller.settings.loc === "" ) {
		hideWeather();
		return;
	}

	showLoading( "#weather" );


	const wuKey = controller?.settings?.wto?.key;
	const wuStationId = "KAZTUCSO3443"; // mellodev this needs to be input by the user most likely. We can guess and use nearest station with 1 additional query.
	if ( wuKey ) {
		console.log("*** updateWeather calling weather underground " + wuKey, {settings: controller.settings});
		// Use weather underground instead of settings.wsp
		$.ajax( {
			url: "https://api.weather.com/v2/pws/observations/current?stationId=" + wuStationId + "&format=json&units=e&apiKey=" + wuKey,
			cache: true, // this prevents the _=<timestamp> querystring addition, which breaks wunderground
			success: function( data )  {
				console.log("*** wu response", {data});

				// Hide the weather if no data is returned
				if ( typeof data !== "object" || !data?.observations?.length > 0) {
					hideWeather();
					return;
				}


				const wuPWSObservations = data.observations[0];

				weather = convertWUdata(wuPWSObservations);

				currentCoordinates = weather._currentCoordinates;

				weather.lastUpdated = new Date().getTime();
				weather.providedLocation = controller.settings.loc;
				localStorage.weatherData = JSON.stringify( weather );

				finishWeatherUpdate();
			}
		} );
	} else {
		console.log("*** updateWeather calling weather endpoint", {wsp: controller.settings.wsp, c: controller});
		$.ajax( {
			url: WEATHER_SERVER_URL + "/weatherData?loc=" +
				encodeURIComponent( controller.settings.loc ),
			contentType: "application/json; charset=utf-8",
			success: function( data ) {

				console.log("*** updateWeather weather endpoint success", data);

				// Hide the weather if no data is returned
				if ( typeof data !== "object" ) {
					hideWeather();
					return;
				}

				currentCoordinates = data.location;

				weather = data;
				data.lastUpdated = new Date().getTime();
				data.providedLocation = controller.settings.loc;
				localStorage.weatherData = JSON.stringify( data );
				finishWeatherUpdate();
			}
		} );
	}
}

OSWeather.updateWeatherBox = () => {
	$( "#weather" )
		.html(
			( controller.settings.rd ? "<div class='rain-delay red'><span class='icon ui-icon-alert'></span>Rain Delay<span class='time'>" + dateToString( new Date( controller.settings.rdst * 1000 ), undefined, true ) + "</span></div>" : "" ) +
			"<div class='inline tight'>" + formatTemp( weather.temp ) + "</div>" +
			"<div class='inline tight'>&nbsp;/&nbsp;</div>" +
			"<div class='inline tight'>" + formatHumidity( weather.humidity ) + "</div>" +
			"<br><div class='inline location tight'><h4>" + _( "Current Weather" ) + "</h4></div>" +
			( typeof weather.alert === "object" ? "<div><button class='tight help-icon btn-no-border ui-btn ui-icon-alert ui-btn-icon-notext ui-corner-all'></button>" + weather.alert.type + "</div>" : "" ) )
		.off( "click" ).on( "click", function( event ) {
			var target = $( event.target );
			if ( target.hasClass( "rain-delay" ) || target.parents( ".rain-delay" ).length ) {
				areYouSure( _( "Do you want to turn off rain delay?" ), "", function() {
					showLoading( "#weather" );
					sendToOS( "/cv?pw=&rd=0" ).done( function() {
						updateController( updateWeather );
					} );
				} );
			} else {
				changePage( "#forecast" );
			}
			return false;
		} )
		.parents( ".info-card" ).removeClass( "noweather" );
	// $( "#weather" )
	// 	.html(
	// 		( controller.settings.rd ? "<div class='rain-delay red'><span class='icon ui-icon-alert'></span>Rain Delay<span class='time'>" + dateToString( new Date( controller.settings.rdst * 1000 ), undefined, true ) + "</span></div>" : "" ) +
	// 		"<div title='" + weather.description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + weather.icon + ".png'></div>" +
	// 		"<div class='inline tight'>" + formatTemp( weather.temp ) + "</div><br><div class='inline location tight'>" + _( "Current Weather" ) + "</div>" +
	// 		( typeof weather.alert === "object" ? "<div><button class='tight help-icon btn-no-border ui-btn ui-icon-alert ui-btn-icon-notext ui-corner-all'></button>" + weather.alert.type + "</div>" : "" ) )
	// 	.off( "click" ).on( "click", function( event ) {
	// 		var target = $( event.target );
	// 		if ( target.hasClass( "rain-delay" ) || target.parents( ".rain-delay" ).length ) {
	// 			areYouSure( _( "Do you want to turn off rain delay?" ), "", function() {
	// 				showLoading( "#weather" );
	// 				sendToOS( "/cv?pw=&rd=0" ).done( function() {
	// 					updateController( updateWeather );
	// 				} );
	// 			} );
	// 		} else {
	// 			changePage( "#forecast" );
	// 		}
	// 		return false;
	// 	} )
	// 	.parents( ".info-card" ).removeClass( "noweather" );
};

// Validates a Weather Underground location to verify it contains the data needed for Weather Adjustments
OSWeather.validateWULocation = ( location, callback ) => {
	if ( !controller.settings.wto || typeof controller.settings.wto.key !== "string" || controller.settings.wto.key === "" ) {
		callback( false );
	}

	$.ajax( {
		url: "https://api.weather.com/v2/pws/observations/hourly/7day?stationId=" + location + "&format=json&units=e&apiKey=" + controller.settings.wto.key,
		cache: true
	} ).done( function( data ) {
		if ( !data || data.errors ) {
			callback( false );
			return;
		}

		callback( true );
	} ).fail( function() {
		callback( false );
	} );
};

OSWeather.showEToAdjustmentOptions = ( button, callback ) => {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	// Elevation and baseline ETo for ETo adjustment.
	var options = $.extend( {}, {
			baseETo: 0,
			elevation: 600
		},
		unescapeJSON( button.value )
	);

	if ( isMetric ) {
		options.baseETo = Math.round( options.baseETo * 25.4 * 10 ) / 10;
		options.elevation = Math.round( options.elevation / 3.28 );
	}

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + _( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					_( "Set the baseline potential evapotranspiration (ETo) and elevation for your location. " ) +
					_( "The ETo adjustment method will adjust the watering duration based on the difference between the baseline ETo and the current ETo." ) +
				"</p>" +
				"<div class='ui-grid-a'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							_( "Baseline ETo" ) + ( isMetric ? " (mm" : "(in" ) + "/day)" +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='baseline-ETo' type='number' min='0' " + ( isMetric ? "max='25' step='0.1'" : "max='1' step='0.01'" ) + " value='" + options.baseETo + "'>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							_( "Elevation" ) + ( isMetric ? " (m)" : " (ft)" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='elevation' type='number' step='1'" + ( isMetric ? "min='-400' max='9000'" : "min='-1400' max='30000'" ) + " value='" + options.elevation + "'>" +
					"</div>" +
				"</div>" +
				"<button class='detect-baseline-eto'>" + _( "Detect baseline ETo" ) + "</button>" +
				"<button class='submit' data-theme='b'>" + _( "Submit" ) + "</button>" +
			"</div>" +
		"</div>"
	);

	popup.find( ".submit" ).on( "click", function() {
		options = {
			baseETo: parseFloat( popup.find( ".baseline-ETo" ).val() ),
			elevation: parseInt( popup.find( ".elevation" ).val() )
		};

		// Convert to imperial before storing.
		if ( isMetric ) {
			options.baseETo = Math.round( options.baseETo / 25.4 * 100 ) / 100;
			options.elevation = Math.round( options.elevation * 3.28 );
		}

		if ( button ) {
			button.value = escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.find( ".detect-baseline-eto" ).on( "click", function() {

		// Backup button contents so it can be restored after the request is completed.
		var buttonContents = $( ".detect-baseline-eto" ).html();

		showLoading( ".detect-baseline-eto" );

		$.ajax( {
			url: WEATHER_SERVER_URL + "/baselineETo?loc=" + encodeURIComponent( controller.settings.loc ),
			contentType: "application/json; charset=utf-8",
			success: function( data ) {

				var baselineETo = data.eto;

				// Convert to metric if necessary.
				if ( isMetric ) {
					baselineETo = Math.round( baselineETo * 25.4 * 100 ) / 100;
				}

				$( ".baseline-ETo" ).val( baselineETo );

				window.alert( "Detected baseline ETo for configured location is " + baselineETo + ( isMetric ? "mm" : "in" ) + "/day" );
			},
			error: function( xhr, errorType ) {

				// Use the response body for HTTP errors and the error type for JQuery errors.
				var errorMessage = "Unable to detect baseline ETo: " +
					( xhr.status ? xhr.responseText + "(" + xhr.status + ")" : errorType );
				window.alert( errorMessage );
				window.console.error( errorMessage );
			},
			complete: function( ) {
				$( ".detect-baseline-eto" ).html( buttonContents );
			}
		} );

		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {

		// Generic min/max checker for each option.
		var min = parseFloat( this.min ),
			max = parseFloat( this.max );

		if ( this.value === "" ) {
			this.value = "0";
		}
		if ( this.value < min || this.value > max ) {
			this.value = this.value < min ? min : max;
		}
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	openPopup( popup, { positionTo: "window" } );
};

OSWeather.getSunTimes = ( date ) => {
	date = date || new Date( controller.settings.devt * 1000 );

	var times = SunCalc.getTimes( date, currentCoordinates[ 0 ], currentCoordinates[ 1 ] ),
		sunrise = times.sunrise,
		sunset = times.sunset,
		tzOffset = getTimezoneOffset();

	sunrise.setUTCMinutes( sunrise.getUTCMinutes() + tzOffset );
	sunset.setUTCMinutes( sunset.getUTCMinutes() + tzOffset );

	sunrise = ( sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes() );
	sunset = ( sunset.getUTCHours() * 60 + sunset.getUTCMinutes() );

	return [ sunrise, sunset ];
};

OSWeather.makeAttribution = ( provider ) => {
	if ( typeof provider !== "string" ) { return ""; }

	var attrib = "<div class='weatherAttribution'>";
	switch ( provider ) {
		case "Apple":
			attrib += _( "Powered by Apple" );
			break;
		case "DarkSky":
		case "DS":
			attrib += "<a href='https://darksky.net/poweredby/' target='_blank'>" + _( "Powered by Dark Sky" ) + "</a>";
			break;
		case "OWM":
			attrib += "<a href='https://openweathermap.org/' target='_blank'>" + _( "Powered by OpenWeather" ) + "</a>";
			break;
		case "DWD":
				attrib += "<a href='https://brightsky.dev/' target='_blank'>" + _( "Powered by Bright Sky+DWD" ) + "</a>";
				break;
		case "OpenMeteo":
		case "OM":
				attrib += "<a href='https://open-meteo.com/' target='_blank'>" + _( "Powered by Open Meteo" ) + "</a>";
				break;
		case "WUnderground":
		case "WU":
			attrib += "<a href='https://wunderground.com/' target='_blank'>" + _( "Powered by Weather Underground" ) + "</a>";
			break;
		case "local":
			attrib += _( "Powered by your Local PWS" );
			break;
		case "Manual":
			attrib += _( "Using manual watering" );
			break;
		default:
			attrib += _( "Unrecognised weather provider" );
			break;
	}
	return attrib + "</div>";
};

OSWeather.showForecast = () => {
	var page = $( "<div data-role='page' id='forecast'>" +
			"<div class='ui-content' role='main'>" +
				"<ul data-role='listview' data-inset='true'>" +
					makeForecast() +
				"</ul>" +
				makeAttribution( weather.wp || weather.weatherProvider ) +
			"</div>" +
		"</div>" );

	changeHeader( {
		title: _( "Forecast" ),
		leftBtn: {
			icon: "carat-l",
			text: _( "Back" ),
			class: "ui-toolbar-back-btn",
			on: goBack
		},
		rightBtn: {
			icon: "refresh",
			text: _( "Refresh" ),
			on: function() {
				$.mobile.loading( "show" );
				$.mobile.document.one( "weatherUpdateComplete", function() {
					$.mobile.loading( "hide" );
				} );
				updateWeather();
			}
		}
	} );

	page.one( "pagehide", function() {
		page.remove();
	} );

	page.find( ".alert" ).on( "click", function() {
		openPopup( $( "<div data-role='popup' data-theme='a'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + weather.alert.name + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<span style='white-space: pre-wrap'>" + $.trim( weather.alert.message ) + "</span>" +
				"</div>" +
			"</div>" ) );
	} );

	$( "#forecast" ).remove();
	$.mobile.pageContainer.append( page );
};

OSWeather.makeForecast = () => {
	var list = "",
		sunrise = controller.settings.sunrise ? controller.settings.sunrise : getSunTimes()[ 0 ],
		sunset = controller.settings.sunset ? controller.settings.sunset : getSunTimes()[ 1 ],
		i, date, times;

	var weekdays = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];

	list += "<li data-icon='false' class='center'>" +
			"<div>" + _( "Now" ) + "</div><br>" +
			"<div title='" + weather.description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + weather.icon + ".png'></div>" +
			"<span>" + formatTemp( weather.temp ) + "</span><br>" +
			"<span>" + _( "Sunrise" ) + "</span><span>: " + pad( parseInt( sunrise / 60 ) % 24 ) + ":" + pad( sunrise % 60 ) + "</span> " +
			"<span>" + _( "Sunset" ) + "</span><span>: " + pad( parseInt( sunset / 60 ) % 24 ) + ":" + pad( sunset % 60 ) + "</span>" +
		"</li>";

	for ( i = 1; i < weather.forecast.length; i++ ) {
		date = new Date( weather.forecast[ i ].date * 1000 );
		times = getSunTimes( date );

		sunrise = times[ 0 ];
		sunset = times[ 1 ];

		list += "<li data-icon='false' class='center'>" +
				"<div>" + date.toLocaleDateString() + "</div><br>" +
				"<div title='" + weather.forecast[ i ].description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + weather.forecast[ i ].icon + ".png'></div>" +
				"<span>" + _( weekdays[ date.getDay() ] ) + "</span><br>" +
				"<span>" + _( "Low" ) + "</span><span>: " + formatTemp( weather.forecast[ i ].temp_min ) + "  </span>" +
				"<span>" + _( "High" ) + "</span><span>: " + formatTemp( weather.forecast[ i ].temp_max ) + "</span><br>" +
				"<span>" + _( "Sunrise" ) + "</span><span>: " + pad( parseInt( sunrise / 60 ) % 24 ) + ":" + pad( sunrise % 60 ) + "</span> " +
				"<span>" + _( "Sunset" ) + "</span><span>: " + pad( parseInt( sunset / 60 ) % 24 ) + ":" + pad( sunset % 60 ) + "</span>" +
			"</li>";
	}

	return list;
};

OSWeather.overlayMap = ( callback ) => {

	// Looks up the location and shows a list possible matches for selection
	// Returns the selection to the callback
	$( "#location-list" ).popup( "destroy" ).remove();
	$.mobile.loading( "show" );

	callback = callback || function() {};

	var popup = $( "<div data-role='popup' id='location-list' data-theme='a' style='background-color:rgb(229, 227, 223);'>" +
			"<a href='#' data-rel='back' class='ui-btn ui-corner-all ui-shadow ui-btn-b ui-icon-delete ui-btn-icon-notext ui-btn-right'>" + _( "Close" ) + "</a>" +
				"<iframe style='border:none' src='" + getAppURLPath() + "map.html' width='100%' height='100%' seamless=''></iframe>" +
		"</div>" ),
		getCurrentLocation = function( callback ) {
			callback = callback || function( result ) {
				if ( result ) {
					iframe.get( 0 ).contentWindow.postMessage( {
						type: "currentLocation",
						payload: {
							lat: result.coords.latitude,
							lon: result.coords.longitude
						}
					}, "*" );
				}
			};

			var exit = function( result ) {
					clearTimeout( loadMsg );
					$.mobile.loading( "hide" );

					if ( !result ) {
						showerror( _( "Unable to retrieve your current location" ) );
					}

					callback( result );
				},
				loadMsg;

			try {
				loadMsg = setTimeout( function() {
					$.mobile.loading( "show", {
						html: "<div class='logo'></div><h1 style='padding-top:5px'>" + _( "Attempting to retrieve your current location" ) + "</h1></p>",
						textVisible: true,
						theme: "b"
					} );
				}, 100 );
				navigator.geolocation.getCurrentPosition( function( position ) {
					clearTimeout( loadMsg );
					exit( position );
				}, function() {
					exit( false );
				}, { timeout: 10000 } );
			} catch ( err ) { exit( false ); }
		},
		updateStations = function( latitude, longitude ) {
			var key = $( "#wtkey" ).val();
			if ( key === "" ) {
				return;
			}

			$.ajax( {
				url: "https://api.weather.com/v3/location/near?format=json&product=pws&apiKey=" + key +
						"&geocode=" + encodeURIComponent( latitude ) + "," + encodeURIComponent( longitude ),
				cache: true
			} ).done( function( data ) {
				var sortedData = [];

				data.location.stationId.forEach( function( id, index ) {
					sortedData.push( {
						id: id,
						lat: data.location.latitude[ index ],
						lon: data.location.longitude[ index ],
						message: data.location.stationId[ index ]
					} );
				} );

				if ( sortedData.length > 0 ) {
					sortedData = encodeURIComponent( JSON.stringify( sortedData ) );
					iframe.get( 0 ).contentWindow.postMessage( {
						type: "pwsData",
						payload: sortedData
					}, "*" );
				}
			} );
		},
		iframe = popup.find( "iframe" ),
		locInput = $( "#loc" ).val(),
		current = {
			lat: locInput.match( regex.gps ) ? locInput.split( "," )[ 0 ] : currentCoordinates[ 0 ],
			lon: locInput.match( regex.gps ) ? locInput.split( "," )[ 1 ] : currentCoordinates[ 1 ]
		},
		dataSent = false;

	// Wire in listener for communication from iframe
	$.mobile.window.off( "message onmessage" ).on( "message onmessage", function( e ) {
		var data = e.originalEvent.data;

		if ( typeof data.WS !== "undefined" ) {
			var coords = data.WS.split( "," );
			callback( coords.length > 1 ? coords : data.WS, data.station );
			dataSent = true;
			popup.popup( "destroy" ).remove();
		} else if ( data.loaded === true ) {
			$.mobile.loading( "hide" );
		} else if ( typeof data.location === "object" ) {
			updateStations( data.location[ 0 ], data.location[ 1 ] );
		} else if ( data.dismissKeyboard === true ) {
			document.activeElement.blur();
		} else if ( data.getLocation === true ) {
			getCurrentLocation();
		}
	} );

	iframe.one( "load", function() {
		if ( current.lat === 0 && current.lon === 0 ) {
			getCurrentLocation();
		}

		this.contentWindow.postMessage( {
			type: "startLocation",
			payload: {
				start: current
			}
		}, "*" );
	} );

	popup.one( "popupafterclose", function() {
		if ( dataSent === false ) {
			callback( false );
		}
	} );

	openPopup( popup, {
		beforeposition: function() {
			popup.css( {
				width: window.innerWidth - 36,
				height: window.innerHeight - 28
			} );
		},
		x: 0,
		y: 0
	} );

	updateStations( current.lat, current.lon );
};

OSWeather.getWeatherError = ( err ) => {
	var errType = Math.floor( err / 10 );

	if ( err in weatherErrors ) {
		return weatherErrors[ err ];
	} else if ( err <= 59 && err >= 10 && errType in weatherErrors ) {
		return weatherErrors[ errType ];
	}

	return _( "Unrecognised" ) + " (" + err + ")";
};

OSWeather.getWeatherStatus = ( status ) => {
	if ( status < 0 ) {
		return "<font class='debugWUError'>" + _( "Offline" ) + "</font>";
	} else if ( status > 0 ) {
		return "<font class='debugWUError'>" + _( "Error" ) + "</font>";
	} else {
		return "<font class='debugWUOK'>" + _( "Online" ) + "</font>";
	}
};

OSWeather.testAPIKey = ( key, callback ) => {
	$.ajax( {
		url: "https://api.weather.com/v2/pws/observations/current?stationId=KMAHANOV10&format=json&units=m&apiKey=" + key,
		cache: true
	} ).done( function( data ) {
		if ( data.errors ) {
			callback( false );
			return;
		}
		callback( true );
	} ).fail( function() {
		callback( false );
	} );
};

OSWeather.corruptionNotificationShown = false;
OSWeather.handleCorruptedWeatherOptions = ( wto ) => {
	if ( corruptionNotificationShown ) {
		return;
	}

	addNotification( {
		title: _( "Weather Options have Corrupted" ),
		desc: _( "Click here to retrieve the partial weather option data" ),
		on: function() {
			var button = $( this ).parent(),
				popup = $(
					"<div data-role='popup' data-theme='a' class='modal ui-content' id='weatherOptionCorruption'>" +
						"<h3 class='center'>" +
							_( "Weather option data has corrupted" ) +
						"</h3>" +
						"<h5 class='center'>" + _( "Please note this may indicate other data corruption as well, please verify all settings." ) + "</h5>" +
						"<h6 class='center'>" + _( "Below is the corrupt data which could not be parsed but may be useful for restoration." ) + "</h6>" +
						"<code>" +
							wto[ 0 ].substr( 7 ) +
						"</code>" +
						"<a class='ui-btn ui-corner-all ui-shadow red reset-options' style='width:80%;margin:5px auto;' href='#'>" +
							_( "Reset All Options" ) +
						"</a>" +
						"<a class='ui-btn ui-corner-all ui-shadow submit' style='width:80%;margin:5px auto;' href='#'>" +
							_( "Dismiss" ) +
						"</a>" +
					"</div>"
				);

			popup.find( ".submit" ).on( "click", function() {
				removeNotification( button );
				popup.popup( "close" );

				return false;
			} );

			popup.find( ".reset-options" ).on( "click", function() {
				removeNotification( button );
				popup.popup( "close" );
				resetAllOptions( function() {
					showerror( _( "Settings have been saved" ) );
				} );

				return false;
			} );

			openPopup( popup );
			return false;
		}
	} );

	OSWeather.corruptionNotificationShown = true;
};
