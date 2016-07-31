/**
 * This script is used for displaying a map with article markers
 *
 * TODO: refactoring
 * TODO: implement individual marker designs
 */
var DEFAULT_ZOOM          = 12;
var DEFAULT_ZOOM_CENTERED = 14;
var DEFAULT_LAT           = 52.2721924; // Braunschweig latitide
var DEFAULT_LNG           = 10.527885;  // Braunschweig longitude
var DEFAULT_MARKER_WIDTH  = 62;
var DEFAULT_MARKER_HEIGHT = 80;

var DEFAULT_SUNRISE_UTC_MINUTES = 60.0 * 4;
var DEFAULT_SUNSET_UTC_MINUTES  = 60.0 * 16;

var geocoder;
var frontend_map;
var markers; // JSON list of markers
var plugin_path;

/**
 * Initialize the Script for using Google Maps API
 */
function initialize_frontend() {
	geocoder = new google.maps.Geocoder();
		
	// set map to default values (position and options)
	var lat_lng = new google.maps.LatLng( DEFAULT_LAT, DEFAULT_LNG );
	var mapOptions = {
		zoom: DEFAULT_ZOOM,
		center: lat_lng,
		panControl: true,
		zoomControl: true,
		mapTypeControl: false,
		scaleControl: false,
		streetViewControl: false,
		overviewMapControl: false,
		rotateControl: false,
		scrollwheel: false,
		disableDoubleClickZoom: true,
		draggable: false,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		styles: get_map_style(),
	}
	frontend_map = new google.maps.Map( document.getElementById( "terra_brwn_map" ), mapOptions );
	show_markers();
		
	// Try to center the map on the user's position
	/*
	 * TODO: Only center if within n kilometers of Braunschweig,
	 *       else show messages depending on position,
	 *       e. g. make fun in case of Hannover :-)
	 */
	if ( navigator.geolocation ) {
		center_on_user_position();
	}
}

/**
 * returns the style for the present time in Braunschweig
 *
 * @returns JSON map style for the present time in Braunschweig
 */
function get_map_style() {
	var MAP_STYLE_DAY = [{"featureType":"administrative","elementType":"all","stylers":[{"visibility":"on"},{"saturation":-100},{"lightness":20}]},{"featureType":"road","elementType":"all","stylers":[{"visibility":"on"},{"saturation":-100},{"lightness":40}]},{"featureType":"water","elementType":"all","stylers":[{"visibility":"on"},{"saturation":-10},{"lightness":30}]},{"featureType":"landscape.man_made","elementType":"all","stylers":[{"visibility":"simplified"},{"saturation":-60},{"lightness":10}]},{"featureType":"landscape.natural","elementType":"all","stylers":[{"visibility":"simplified"},{"saturation":-60},{"lightness":60}]},{"featureType":"poi","elementType":"all","stylers":[{"visibility":"off"},{"saturation":-100},{"lightness":60}]},{"featureType":"transit","elementType":"all","stylers":[{"visibility":"off"},{"saturation":-100},{"lightness":60}]}];

	var MAP_STYLE_NIGHT = [{"featureType": "water","elementType": "geometry","stylers": [{ "color": "#193341" }]},{"featureType": "landscape","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]},{"featureType": "road","elementType": "geometry","stylers": [{ "color": "#29768a" },{ "lightness": -37 }]},{"featureType": "poi","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"featureType": "transit","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"elementType": "labels.text.stroke","stylers": [{ "visibility": "on" },{ "color": "#3e606f" },{ "weight": 2 },{ "gamma": 0.84 }]},{"elementType": "labels.text.fill","stylers": [{ "color": "#ffffff" }]},{"featureType": "administrative","elementType": "geometry","stylers": [{ "weight": 0.6 },{ "color": "#1a3541" }]},{"elementType": "labels.icon","stylers": [{ "visibility": "off" }]},{"featureType": "poi.park","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]}];

	if ( is_daytime( DEFAULT_LAT, DEFAULT_LNG, ( new Date().getTimezoneOffset() / -60 ) ) ) {
		return MAP_STYLE_DAY;
	} else {
		return MAP_STYLE_NIGHT;
	}	
}

/**
 * determine whether it is daytime or not
 *
 * Should be uses if the offset already includes dst
 *
 * @param float lat latitude
 * @param float lng longitude
 * @param int offset timezone offset considering dst
 *
 * @return bool true, if daylight, else false
 */
function is_daytime( lat, lng, offset ) {
	return is_daytime( lat, lng, offset, 0 );
}

/**
 * determine whether it is daytime or not
 *
 * @param float lat latitude
 * @param float lng longitude
 * @param int tz timezone offset
 * @param bool dst true, if daylight saving time, else false
 *
 * @return bool true, if daylight, else false
 */
function is_daytime( lat, lng, tz, dst ) {
	var minutes = get_todays_minutes();
	
	if ( ( minutes < get_sunrise( lat, lng, tz, dst ) ) ||
			( minutes >= get_sunset( lat, lng, tz, dst ) ) ) {
		return false;
	} else {
		return true;
	}
}

/**
 * determine whether daylight savings time is active
 *
 * The function uses the fact that getTimezoneOffset returns a different value during DST and
 * standard time, and compares the difference between the two.
 * See http://javascript.about.com/library/bldst.htm for more information
 *
 * @returns bool true, if daylight savings time is active, else false
 */
function is_daylight_saving_time() {
	var now = new Date();
	
	var jan = new Date( now.getFullYear(), 0, 1);
    var jul = new Date( now.getFullYear(), 6, 1);
	
	var stdTimezoneOffset = Math.max( jan.getTimezoneOffset(), jul.getTimezoneOffset() );
	
	return now.getTimezoneOffset() < stdTimezoneOffset;
}

/**
 * calculate the distance to the default position
 *
 * @param float lat latitude of the point to check
 * @param float lng longitude of the point to check
 *
 * @return float distance to the default position
 */
function distance_to_default_position( lat, lng ) {
	return calculate_distance_on_earth( DEFAULT_LAT, DEFAULT_LNG, lat, lng )
}

/**
 * calculate the distance between two points on earth
 *
 * @param float lat1 latitude of first point
 * @param float lng1 longitude of first point
 * @param float lat2 latitude of second point
 * @param float lng2 longitude of second point
 *
 * @return float distance between two points on earth
 */
function calculate_distance_on_earth( lat1, lng1, lat2, lng2 ) {
	var R_meters = 6371000; // Earth Radius
	
	return calculate_distance_on_sphere( lat1, lng1, lat2, lng2, R_meters );
}

/**
 * calculate the distance between two points on a sphere
 *
 * The Haversine formula (https://en.wikipedia.org/wiki/Haversine_formula) is used to
 * calculate the distance
 *
 * @param float lat1 latitude of first point
 * @param float lng1 longitude of first point
 * @param float lat2 latitude of second point
 * @param float lng2 longitude of second point
 * @param int R_meters sphere's radius in meters
 *
 * @return float distance between two points on the sphere
 *
 */
function calculate_distance_on_sphere( lat1, lng1, lat2, lng2, R_meters ) {
	// convert to radial values
	var lat1_rad  = convert_deg_to_rad( lat1 );
	var lat2_rad  = convert_deg_to_rad( lat2 );
	var lat_angle = convert_deg_to_rad( ( lat2 - lat1 ) );
	var lng_angle = convert_deg_to_rad( ( lng2 - lng1 ) );
	
	var a = Math.sin( lat_angle / 2 ) *
			Math.sin( lat_angle / 2 ) + Math.cos( lat1_rad ) *
			Math.cos( lat2_rad ) * Math.sin( lng_angle / 2 ) * Math.sin( lng_angle / 2 );
	var c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );

	return R_meters * c;
}

/**
 * convert angle given as radian to angle in degrees
 *
 * @param float angle_rad angle as radian
 *
 * @return float angle in degrees
 */
function convert_rad_to_deg( angle_rad ) {
	return ( 180.0 * angle_rad / Math.PI );
}

/**
 * convert angle given in degrees to angle as radian
 *
 * @param float angle_deg angle in degrees
 *
 * @return float angle as radian
 */
function convert_deg_to_rad( angle_deg ) {
	return ( Math.PI * angle_deg / 180.0 );
}

/**
 * set a cookie with data in JSON format
 *
 * @param String cookie name
 * @param JSON data in JSON format
 */
function set_json_cookie( name, json ) {
	document.cookie = name + "=" + JSON.stringify( json );
}

/**
 * retrieves a json object from a bunch of cookies
 *
 * @param String cookie name
 * @return JSON data in JSON format
 */
function get_json_cookie( name ) {
	try {
		var json = JSON.parse( get_cookie( name ) );
	} catch ( error ) {
		if ( error instanceof SyntaxError ) {
			return null;
		}
	}
	return json;
}

/**
 * gets a cookie from a bunch of cookies from this page
 *
 * @param String cookie_name name of the cookie
 * @return String desired cookie or "" if not found
 */
function get_cookie( cookie_name ) {
	var name = cookie_name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) != -1) return c.substring(name.length, c.length);
    }
    return "";	
}

/**
 * Center the map on the user's current location
 */
function center_on_user_position() {
	if ( get_json_cookie( "terrabrwn_position" ) != null ) {
		pan_to_user_position( get_json_cookie( "terrabrwn_position" ) );
	} else {
		navigator.geolocation.getCurrentPosition( pan_to_user_position );
	}
}

/**
 * pans the map to the current (or temporarily stored) user position and zooms to it
 *
 * @param position position to pan to
 */
function pan_to_user_position( position ) {
	if ( distance_to_default_position( position.coords.latitude, position.coords.longitude ) < 5000 ) {
		// user is within range of Braunschweig
		set_map_view (
				frontend_map,
				position.coords.latitude,
				position.coords.longitude,
				DEFAULT_ZOOM_CENTERED,
				'Dein Browser sagt, du bist ungefähr hier.' );
	} else {
		// user is not within range of Braunschweig
		set_map_view (
				frontend_map,
				DEFAULT_LAT,
				DEFAULT_LNG,
				DEFAULT_ZOOM,
				'Schade, dass du nicht hier in Braunschweig bist...' );			
	}
	
	// remember the position (circumvents browsers that don't block repeated queries for location)
	set_json_cookie( "terrabrwn_position", {
		coords:{
			latitude:position.coords.latitude,
			longitude:position.coords.longitude}
		});		
}

/**
 * pan and zoom a map to a certain position and add a message bubble
 *
 * @param Map map map to be maniulated
 * @param int lat latitude to pan to
 * @param int lng longitude to pan to
 * @param int zoom zoom level
 * @param String message message to be displayed
 */
function set_map_view( map, lat, lng, zoom, message ) {
		var pos = new google.maps.LatLng( lat, lng )
		var infowindow = new google.maps.InfoWindow({
				map: map,
				position: pos,
				content: message
			});
		frontend_map.panTo( pos );
		frontend_map.setZoom( zoom );
}

/**
 * sets the markers sent from Wordpress
 *
 * @param JSON json data encoded in JSON
 */
function set_markers( json ) {
	markers = JSON.parse( json );
}

function sizeme( obj ) {
    var size = 0, key;
    for ( key in obj ) {
        if ( obj.hasOwnProperty( key ) ) size++;
    }
    return size;
};



/**
 * sets the plugin path
 *
 * @param String path
 */
function set_plugin_path( path ) {
	plugin_path = path;
}

/**
 * Show all markers that have been prepared by PHP in global variable markers
 */
function show_markers() {
	for ( index = 0; index < markers.length; ++index ) {
		var lat_lng = new google.maps.LatLng( markers[index].lat, markers[index].lng );
		put_marker( markers[index].title, lat_lng, markers[index].link, get_marker_image( markers[index].cat ) );
	}
}

/*
 * TODO: create all images up front instead of loading them each by each again and again
 * TODO: better scaling!
 * TODO: better path handling!
 * TODO: fix marker position (presently it is off to the bottom left)
 */
function get_marker_image( category ) {
	var CAT_TO_IMAGE = { 
		"allgemein":"default",
		"bambule":"bambule",
		"klater &amp; botten":"klater",
		"miezen &amp; löken":"loewe",
		"posemuckel":"posemuckel",
		"temopowi":"temopowi",
		"tirater &amp; döneken":"tirater"
	}

	var link = plugin_path + "/TerraBRWN/img/" + CAT_TO_IMAGE[category] + ".png";
	
	if ( url_exists ( link ) ) {
		return image = {
			url: link,
			scaledSize: new google.maps.Size( DEFAULT_MARKER_WIDTH, DEFAULT_MARKER_HEIGHT ),
			origin: new google.maps.Point( 0, 0 ),
			anchor: new google.maps.Point( 31, 80 )
		};
	} else {
		return null;
	}
}

/**
 * check whether a URL exists or not
 *
 * @param String url URL to be checked
 * @return true, if URL can be found, else false
 */
function url_exists( url ) {
    var http = new XMLHttpRequest();
    http.open( 'HEAD', url, false );
    http.send();
    return http.status != 404 ;
}

/**
 * Place a marker on the map and add information
 *
 * TODO: Get category from Wordpress and use appropriate marker
 *
 * @param String address of the place to be marked
 * @param LatLng latitide and longitude of the place to be marked
 * @param String URL to be linked to from the marker
 */
function put_marker( address, lat_lng, link, image ) {
	marker = new google.maps.Marker({
		map: frontend_map,
		position: lat_lng,
		title: address,
		url: link,
	});
	
	if ( image != null ) {
		marker.setIcon( image );
	}
	
	google.maps.event.addListener(marker, 'click', function() {
			window.location.href = this.url;
			});
}

/* ---------------------------------------------------------------------------------------------- */
// adapted from http://www.esrl.noaa.gov/gmd/grad/solcalc/

/* */
function calcTimeJulianCent( jd ) {
	return ( jd - 2451545.0 ) / 36525.0;
}

/* */
function calcGeomMeanLongSun( t ) {
	var L0 = 280.46646 + t * ( 36000.76983 + t * ( 0.0003032 ) );
	while( L0 > 360.0 ) {
		L0 -= 360.0;
	}
	while( L0 < 0.0 ) {
		L0 += 360.0;
	}
	return L0		// in degrees
}

/* */
function calcGeomMeanAnomalySun( t ) {
	return 357.52911 + t * ( 35999.05029 - 0.0001537 * t );
}

/* */
function calcEccentricityEarthOrbit( t ) {
	return 0.016708634 - t * ( 0.000042037 + 0.0000001267 * t );
}

/* */
function calcSunEqOfCenter( t ) {
	var m = calcGeomMeanAnomalySun(t);
	var mrad = convert_deg_to_rad(m);
	var sinm = Math.sin(mrad);
	var sin2m = Math.sin(mrad+mrad);
	var sin3m = Math.sin(mrad+mrad+mrad);
	var C = sinm * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin2m * (0.019993 - 0.000101 * t) + sin3m * 0.000289;
	return C;		// in degrees
}

/* */
function calcSunTrueLong( t ) {
	var l0 = calcGeomMeanLongSun( t );
	var c = calcSunEqOfCenter( t );
	var O = l0 + c;
	return O;		// in degrees
}

/* */
function calcSunApparentLong( t ) {
	var o = calcSunTrueLong( t );
	var omega = 125.04 - 1934.136 * t;
	var lambda = o - 0.00569 - 0.00478 * Math.sin( convert_deg_to_rad( omega ) );
	return lambda;		// in degrees
}

/* */
function calcMeanObliquityOfEcliptic( t ) {
	var seconds = 21.448 - t * ( 46.8150 + t * ( 0.00059 - t * ( 0.001813 ) ) );
	var e0 = 23.0 + ( 26.0 + ( seconds / 60.0 ) ) / 60.0;
	return e0;		// in degrees
}

/* */
function calcObliquityCorrection( t ) {
  var e0 = calcMeanObliquityOfEcliptic( t );
  var omega = 125.04 - 1934.136 * t;
  var e = e0 + 0.00256 * Math.cos( convert_deg_to_rad( omega ) );
  return e;		// in degrees
}

/* */
function calculate_solar_declination( t ) {
  var e = calcObliquityCorrection( t );
  var lambda = calcSunApparentLong( t );

  var sint = Math.sin( convert_deg_to_rad( e ) ) * Math.sin( convert_deg_to_rad( lambda ) );
  var theta = convert_rad_to_deg( Math.asin( sint ) );
  return theta;		// in degrees
}

/* */
function calcEquationOfTime( t ) {
  var epsilon = calcObliquityCorrection( t );
  var l0 = calcGeomMeanLongSun( t );
  var e = calcEccentricityEarthOrbit( t );
  var m = calcGeomMeanAnomalySun( t );

  var y = Math.tan( convert_deg_to_rad( epsilon ) / 2.0 );
  y *= y;

  var sin2l0 = Math.sin( 2.0 * convert_deg_to_rad( l0 ) );
  var sinm   = Math.sin( convert_deg_to_rad( m ) );
  var cos2l0 = Math.cos( 2.0 * convert_deg_to_rad( l0 ) );
  var sin4l0 = Math.sin( 4.0 * convert_deg_to_rad( l0 ) );
  var sin2m  = Math.sin( 2.0 * convert_deg_to_rad( m ) );

  var Etime = y * sin2l0 -
		2.0 * e * sinm +
		4.0 * e * y * sinm * cos2l0 -
		0.5 * y * y * sin4l0 -
		1.25 * e * e * sin2m;
  return convert_rad_to_deg( Etime ) * 4.0;	// in minutes of time
}

/* */
function calculate_hour_angle_sunrise( lat, solar_declination ) {
  var latRad = convert_deg_to_rad( lat );
  var sdRad  = convert_deg_to_rad( solar_declination );
  var HAarg  = ( Math.cos( convert_deg_to_rad( 90.833 ) ) /
		( Math.cos( latRad ) * Math.cos( sdRad ) ) -
		Math.tan( latRad ) * Math.tan( sdRad ) );
  var HA     = Math.acos( HAarg );
  return HA;		// in radians (for sunset, use -HA)
}

/**
 * check if a value is a number
 *
 * @param object value value to be checked
 *
 * @return true, if value is a number, else false
 */
function isNumber( value ) {
    if ( ( value === undefined) || ( value === null ) || ( value == "" ) ) {
        return false;
    }
    if ( typeof value == 'number' ) {
        return true;
    }
    return !isNaN( value - 0 );
}

/**
 * calculate the Julian Date in days
 *
 * @return Julian Date in days
 */
function get_Julian_Date_in_days() {
	var now = new Date();
  
	var month = now.getMonth() + 1;
	var day   = now.getDate() + 1;
	var year  = now.getFullYear();
	if ( month <= 2 ) {
		year--;
		month += 12;
	}
	var A = Math.floor( year / 100 );
	var B = 2 - A + Math.floor( A / 4 );
	return ( Math.floor( 365.25 * ( year + 4716 ) ) +
			Math.floor( 30.6001 * ( month + 1 ) ) +
			day + B - 1524.5 );
}

/**
 * calculate the minutes that have passed today
 *
 * @returns float number of minutes passed today
 */
function get_todays_minutes() {
	var now = new Date();
	return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/**
 * convert minutes to Date
 *
 * @param int minutes minutes to be converted
 *
 * @return Date minutes as Date
 */
function convert_minutes_to_date( minutes ) {
	if ( ( minutes < 0 ) || ( minutes >= 1440 ) ) {
		return null;
	} else {
		var floatHour = minutes / 60.0;
		var hour = Math.floor( floatHour );
		var floatMinute = 60.0 * ( floatHour - Math.floor( floatHour ) );
		var minute = Math.floor( floatMinute );
		if ( minute > 59 ) {
			minute = 0;
			hour++;
		}

		return new Date( 0, 0, 0, hour, minute );
	}
}

/**
 * calculate the minutes that have passed today
 *
 * @return float minutes that have passed today
 */
function get_todays_minutes() {
	var now = new Date();
	return now.getHours() * 60.0 + now.getMinutes();
}

/* */
function calculate_sunrise_sunset_UTC( rise, julian_date, lat, lng ) {
	var t = calcTimeJulianCent( julian_date );
	var eqTime = calcEquationOfTime( t );
	var solar_declination = calculate_solar_declination( t );
	var hour_angle = calculate_hour_angle_sunrise( lat, solar_declination );
	if ( !rise ) {
		hour_angle = -hour_angle;
	}
	var delta = lng + convert_rad_to_deg( hour_angle );
	var timeUTC = 720 - ( 4.0 * delta ) - eqTime;	// in minutes
	return timeUTC;
}

/**
 * calculate the time of sunrise/sunset in minutes of the day
 *
 * @param rise int 0 for sunset, 1 for sunrise
 * @param JD int Julian Date representes by number of days
 * @param lat float latitude
 * @param lng flaot longitude
 * @param timezone int timezone offset
 * @param dst bool true, if daylight saving time, else false
 *
 * @return float time of sunrise/sunset in minutes of the day
 */
function calcSunriseSet( rise, JD, lat, lng, timezone, dst ) {
	var timeUTC = calculate_sunrise_sunset_UTC( rise, JD, lat, lng );
	var newTimeUTC = calculate_sunrise_sunset_UTC( rise, JD + timeUTC / 1440.0, lat, lng );

	if ( !isNumber ( newTimeUTC ) ) {
		if ( rise ) {
			newTimeUTC = DEFAULT_SUNRISE_UTC_MINUTES;
		} else {
			newTimeUTC = DEFAULT_SUNSET_UTC_MINUTES;
		}
	}
	var minutes = newTimeUTC + ( timezone * 60.0 );
	minutes += ( ( dst ) ? 60.0 : 0.0 );

	if ( ( minutes < 0.0 ) || ( minutes >= 1440.0 ) ) {
		var increment = ( ( minutes < 0 ) ? 1 : -1 );
		while ( ( minutes < 0.0 ) || ( minutes >= 1440.0 ) ) {
			minutes += increment * 1440.0;
		}
	}
	return minutes;
}

function get_sunrise( lat, lng, tz, dst ) {
	return calcSunriseSet( 1, get_Julian_Date_in_days(), lat, lng, tz, dst );
}

function get_sunset( lat, lng, tz, dst ) {
	return calcSunriseSet( 0, get_Julian_Date_in_days(), lat, lng, tz, dst );
}

/* ---------------------------------------------------------------------------------------------- */

google.maps.event.addDomListener(window, 'load', initialize_frontend);