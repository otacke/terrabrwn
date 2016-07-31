/**
 * This script is used for adding geolocation data to a Wordpress post
 */

var DEFAULT_ZOOM = 13;         // default zoom level
var DEFAULT_LAT  = 52.2721924; // Braunschweig latitide
var DEFAULT_LNG  = 10.527885;  // Braunschweig longitude
 
var geocoder = new google.maps.Geocoder(); // Google Maps Geocoder
var map;                                   // Google Maps map
var map_markers = new Array();             // markers for display
var markers;                               // JSON list of markers from PHP
var active_location = 1;                   // active_location in settings form

var debug_tab = "";
var debug_mode = false;

function debug_msg( message, type ) {
	if (debug_mode == true ) {
		type = (type === "undefined") ? 0 : type;
		
		if ( type == 0 ) {
			debug_tab = debug_tab.substring( 2 );
		}
		console.log( debug_tab + message );
		if ( type == 1 ) {
			debug_tab = debug_tab + "..";
		}
	}
}


/**
 * Initialize the Script for using Google Maps API
 */
function initialize() {
	debug_msg ( "initialize()", 1 );
	
	// set map to default values (position and options)
	var lat_lng = new google.maps.LatLng( DEFAULT_LAT, DEFAULT_LNG );
	var mapOptions = {
		zoom: DEFAULT_ZOOM,
		center: lat_lng
	}
	map = new google.maps.Map( document.getElementById( "map-canvas" ), mapOptions );
  
	google.maps.event.addListener(map, 'click', function( event ) {
		set_marker_by_lat_lng( event.latLng, active_location );
	});
	
	// This is a safe place to fill the map with markers because it is set and markers cannot get messed up
	place_initial_markers();

	debug_msg ( "done initialize()", 0 );
}


/**
 * Set a Marker on the map if you know the address
 * @param String address of the place to be marked
 */
function set_marker_by_address( address, number ) {
	debug_msg( "set_marker_by_address(" + address + ", " + number + ")", 1 );
	if ( typeof number === 'undefined' ) {
		number = "1";
	}
	
	geocoder.geocode( { "address": address}, function( results, status ) {
		if (status == google.maps.GeocoderStatus.OK) {
			var lat_lng = results[0].geometry.location;	
					
			place_marker( address, lat_lng, number );
			update_wp_post_values( address, lat_lng.lat(), lat_lng.lng(), number );
			map.panTo( lat_lng );
		}
	});
	debug_msg( "done set_marker_by_address(" + address + ", " + number + ")", 0 );
}


/**
 * Set a Marker on the map if you know latitude and longitude
 * @param LatLng latitide and longitude of the place to be marked
 */
function set_marker_by_lat_lng ( lat_lng, number ) {
	debug_msg( "set_marker_by_lat_lng(" + lat_lng + ", " + number + ")", 1 );
	if ( typeof number === 'undefined' ) {
		number = "1";
	}
	geocoder.geocode( { "location": lat_lng}, function( results, status ) {
		if ( status == google.maps.GeocoderStatus.OK ) {
			var address = results[0].formatted_address;

			place_marker( address, lat_lng, number );
			update_wp_post_values( address, lat_lng.lat(), lat_lng.lng(), number )
			map.panTo( lat_lng );			
		} else {
			console.log( "E: Could not detect geo location from lat_lng!" );
		}
	});
	debug_msg( "done set_marker_by_lat_lng(" + lat_lng + ", " + number + ")", 0 );
}


/**
 * places the initial markers on a map by their position
 */
function place_initial_markers() {
	debug_msg( "place_initial_markers", 1 );
	for ( i = 1; i <= document.getElementById("number_of_locations").value; i++) {
		set_marker_by_location_field( i );
	}
	debug_msg( "done place_initial_markers", 0 );
}

/**
 * Zooms and pans the map so all markers can be seen on the map
 */
function fit_map_to_bounds() {
	debug_msg( "fit_map_to_bounds", 1 );
	
	if ( map_markers.length > 0) {
		var bounds = new google.maps.LatLngBounds();
		for ( i = 0; i < map_markers.length; i++ ) {
			bounds.extend( map_markers[i].getPosition() );
		}
		map.fitBounds( bounds );
	}
	
	debug_msg( "done fit_map_to_bounds", 0 );
}


/**
 * Places a marker on the map and add information
 * @param String address of the place to be marked
 * @param LatLng latitide and longitude of the place to be marked
 */
function place_marker( address, lat_lng, number ) {
	debug_msg( "place_marker(" + address + ", " + lat_lng + ", " + number + ")", 1 );
	if ( typeof number === 'undefined' ) {
		number = "1";
	}
	
	if ( map_markers[number - 1] !== "undefined" ) {
		tmp_marker = map_markers[number - 1];
		if ( tmp_marker != null ) {
			tmp_marker.setPosition( lat_lng );
		} else {
			marker = new google.maps.Marker({
					map: map,
					position: lat_lng,
					title: address
			});
			map_markers[number - 1] = marker;
		}
	}
	
	debug_msg( "done place_marker(" + address + ", " + lat_lng + ", " + number + ")", 0 );
}

/*
 * Removes a marker from the map and from memory
 *
 * @param int number number of marker to be removed
 */
function remove_marker( number ) {
	debug_msg ( "remove_marker (" + number + ")", 1 );
	
	if ( ! is_undefined_or_null( map_markers[number - 1] ) ) {
		map_markers[number - 1].setMap( null );
	}
	map_markers.splice( number - 1, 1 );
		
	debug_msg ( "done remove_marker (" + number + ")", 0 );
}

/**
 * Places a marker on the map according to the manual setting via location field in Wordpress
 *
 * This function is invoked from the settings form
 *
 * @param int number number of the location field / marker
 */
function set_marker_by_location_field( number ) {
	debug_msg ( "set_marker_by_location_field(" + number + ")", 1 );
	if ( typeof number === 'undefined' ) {
		number = "1";
	}
	
	set_active_location( number );
	
	var address = document.getElementById( "terra_brwn_location_field" + number ).value;
	if ( address != "" ) {
		set_marker_by_address( address, number );
		map.setZoom( 15 );
	}
	debug_msg ( "done set_marker_by_location_field(" + number + ")", 0 );
}

/**
 * initializes the settings form with fields for each location
 *
 * @param json JSON location data for the current post coming from PHP
 */
function initialize_js( json ) {
	debug_msg( "initialize_js(" + json + ")", 1 );
	
	if ( json != "" ) {
		markers = JSON.parse( json );
		for ( i = 1; i <= markers.length; i++ ) {
			add_location_field( i );
		}
	} else {
		add_location_field( 1 );
	}
	debug_msg( "done initialize_js(" + json + ")", 0 );
}

/**
 * set the active field in settigns form
 *
 * @param int number number of the field
 */
function set_active_location( number ) {
	debug_msg( "set_active_location(" + number + ")", 1 );
	number = parseInt( number );
	
	// set background of old location field
	var old_active_field = document.getElementById( "terra_brwn_location_field" + active_location );
	if ( old_active_field !== null ) {
		old_active_field.setAttribute( "style", "background-color: white;" );
	}
	// set background of new location field
	var active_field = document.getElementById( "terra_brwn_location_field" + number );
	active_field.setAttribute( "style", "background-color: #ffffaa;" );
	active_location = number;
	debug_msg( "done set_active_location(" + number + ")", 0 );
}

/**
 * add a location field to settings form
 *
 * TODO: refactoring!!!!! 
 *
 * @param number int number of field to be created
 */
function add_location_field( number ) {
	debug_msg( "add_location_field(" + number + ")", 1 );
	number = parseInt( number );
	var input_value;
	
	var div1  = document.createElement( "div" );
	div1.setAttribute( "id", "field" + number );
		var label = document.createElement( "label" );
		label.setAttribute( "for", "terra_brwn_location_field" + number );
		label.appendChild( document.createTextNode( "Zu markierender Ort " + number ) );
	div1.appendChild( label );
	
	div1.appendChild( document.createElement( "br" ) );

	if ( markers !== undefined ) {
		var markers_location = is_undefined_or_null( markers[number - 1] ) ? "" : markers[number - 1].location;
		var markers_lat      = is_undefined_or_null( markers[number - 1] ) ? "" : markers[number - 1].lat;
		var markers_lng      = is_undefined_or_null( markers[number - 1] ) ? "" : markers[number - 1].lng;
	} else {
		var markers_location = "";
		var markers_lat      = "";
		var markers_lng      = "";
	}

	var input_location = document.createElement( "input" );
		input_location.setAttribute( "id", "terra_brwn_location_field" + number );
		input_location.setAttribute( "class", "terra_brwn_location_field" );
		input_location.setAttribute( "type", "text" );
		input_location.setAttribute( "name", "terra-brwn-location" + number );
		input_location.setAttribute( "value", markers_location );
		input_location.setAttribute( "onfocus", "set_active_location(" + number + ")");
	div1.appendChild( input_location );

	var input_lat = document.createElement( "input" );
		input_lat.setAttribute( "id", "terra_brwn_location_lat" + number );
		input_lat.setAttribute( "type", "hidden" );
		input_lat.setAttribute( "name", "terra-brwn-lat" + number );
		input_lat.setAttribute( "value", markers_lat );
	div1.appendChild( input_lat );

	var input_lng = document.createElement( "input" );
		input_lng.setAttribute( "id", "terra_brwn_location_lng" + number );
		input_lng.setAttribute( "type", "hidden" );
		input_lng.setAttribute( "name", "terra-brwn-lng" + number );
		input_lat.setAttribute( "value", markers_lng );
	div1.appendChild( input_lng );

	var button = document.createElement( "button" );
	button.setAttribute( "id", "terra_brwn_search_button" + number );
		button.setAttribute( "class", "terra_brwn_search_button" );
		button.setAttribute( "type", "button" );
		button.setAttribute( "onclick", "set_marker_by_location_field(" + number + ")" );
		button.appendChild( document.createTextNode( "Suchen" ) );
	div1.appendChild( button );
	
	if ( markers !== "undefined" ) {
		var button_plus = document.createElement( "button" );
			button_plus.setAttribute( "id", "terra_brwn_plus_button" + number );
			button_plus.setAttribute( "class", "terra_brwn_plus_minus_button" );
			button_plus.setAttribute( "type", "button" );
			button_plus.setAttribute( "onclick", "add_location_field(" + ( number + 1 ) + ")" );
			button_plus.appendChild( document.createTextNode( " + " ) );
		div1.appendChild( button_plus );

		if ( number > 2 ) {
			var button_to_be_removed = document.getElementById( "terra_brwn_minus_button" + ( number - 1 ) );
			var parent = document.getElementById( "field" + ( number - 1 ) );
			parent.removeChild( button_to_be_removed );
		}
		
		if ( number > 1 ) {
			var button_to_be_removed = document.getElementById( "terra_brwn_plus_button" + ( number - 1 ) );
			var parent = document.getElementById( "field" + ( number - 1 ) );
			parent.removeChild( button_to_be_removed );
			
			var button_minus = document.createElement( "button" );
				button_minus.setAttribute( "id", "terra_brwn_minus_button" + number );
				button_minus.setAttribute( "class", "terra_brwn_plus_minus_button" )
				button_minus.setAttribute( "type", "button" );
				button_minus.setAttribute( "onclick", "remove_location_field(" + number + ")" );
				button_minus.appendChild( document.createTextNode( " - " ) );
			div1.appendChild( button_minus );
		}
	}

	var element = document.getElementById( "terra_brwn_location_field_container" );
	var dummy = document.getElementById( "dummy" );
	element.insertBefore( div1, dummy );

	// store the number of fields present for PHP	
	document.getElementById("number_of_locations").value = number;
	
	// set the new field to active
	set_active_location( number );
	
	debug_msg( "done add_location_field(" + number + ")", 0 );
}

/**
 * check whether an object is undefined or null
 *
 * @param Object object object to be checked
 *
 * @returns boolean true, if object is undefined or null, else false
 */
function is_undefined_or_null( object ) {
	if ( object === "undefined" ) {
		return true;
	} else {
		return ( object == null ) ? true : false;
	}
}

/**
 * remove a location field from settings form
 *
 * TODO: refactoring!!!!! 
 *
 * @param number int number of field to be removed
 */
function remove_location_field( number ) {
	debug_msg ( "remove(" + number + ")", 1 );
	number = parseInt( number );

	// add + button to previous field
	var button_plus = document.createElement( "button" );
		button_plus.setAttribute( "id", "terra_brwn_plus_button" + ( number - 1 ) ) ;
	button_plus.setAttribute( "class", "terra_brwn_plus_minus_button" );
		button_plus.setAttribute( "type", "button" );
		button_plus.setAttribute( "onclick", "add_location_field(" + number + ")" );
		button_plus.appendChild( document.createTextNode( " + " ) );
	var parent = document.getElementById( "field" + ( number - 1 ) );
	parent.appendChild( button_plus );
	
	// add - button to previous field if not last one available
	if ( number > 2 ) {
		var button_minus = document.createElement( "button" );
			button_minus.setAttribute( "id", "terra_brwn_minus_button" + ( number - 1 ) );
			button_minus.setAttribute( "class", "terra_brwn_plus_minus_button" );
			button_minus.setAttribute( "type", "button" );
			button_minus.setAttribute( "onclick", "remove_location_field(" + ( number - 1 ) + ")" );
			button_minus.appendChild( document.createTextNode( " - " ) );
		parent.appendChild( button_minus );
	}	

	// eventually, remove the field
	var field_to_be_removed = document.getElementById( "field" + number );
	var parent = document.getElementById( "terra_brwn_location_field_container" );
	parent.removeChild( field_to_be_removed );
	
	// remove the marker from the map and from memory
	remove_marker( number );
	
	// store the number of fields present for PHP
	document.getElementById( "number_of_locations" ).value = ( number - 1 ) ;
	
	// set the last field to active
	set_active_location( number - 1 );
	debug_msg( "done remove(" + number + ")", 0 );
}

/**
 * Updates the form values in settings form
 *
 * @param String address address to be set
 * @param String lat latitude to be set
 * @param String lng longitude to be set
 */
function update_wp_post_values( address, lat, lng, number ) {
	debug_msg ( "update_wp_post_values(" + address + ", " + lat + ", " + lng + ", " + number + ")", 1 );
	if ( typeof number === 'undefined' ) {
		number = "1";
	}
	document.getElementById( "terra_brwn_location_field" + number ).value = address;
	document.getElementById( "terra_brwn_location_lat" + number ).value = lat;
	document.getElementById( "terra_brwn_location_lng" + number ).value = lng;
	debug_msg ( "done update_wp_post_values(" + address + ", " + lat + ", " + lng + ", " + number + ")", 0 );
}

google.maps.event.addDomListener(window, 'load', initialize);