<?php

/**
 * Plugin Name: TerraBRWN
 * Plugin URI: TO DO
 * Description: attach geo-locations to posts and display them on Google Maps
 * Version: 0.12
 * Author: Oliver Tacke
 * Author URI: http://www.olivertacke.de
 * License: WTFPL
 */
 
/*
 * TODO: Namespace
 * TODO: refactoring (!!!)
 * TODO: Object Orientation (maybe)
 * TODO: improve individual markers
 * TODO: Localization
 */

// as suggested by the Wordpress community
defined( 'ABSPATH' ) or die( 'No script kiddies please!' );

// Here I am!
add_action( 'load-post.php', 'terra_brwn_setup' );
add_action( 'load-post-new.php', 'terra_brwn_setup' );


/**
 * setup the plugin
 */
function terra_brwn_setup() {
	wp_enqueue_style( 'TerraBRWN', plugins_url( 'css/TerraBRWN.css', __FILE__ ) );
	// The next two scripts are necessary for implementing Google Maps
	wp_enqueue_script( 'GoogleMapsAPI', 'https://maps.googleapis.com/maps/api/js?v=3.exp&signed_in=false' );
	wp_enqueue_script( 'TerraBRWNGoogleMaps', plugins_url( 'js/TerraBRWN_google_maps.js', __FILE__ ) );
	load_plugin_textdomain( 'TerraBRWN', false, basename( dirname( __FILE__ ) ) . '/languages' );
	add_action( 'add_meta_boxes', 'add_terra_brwn_meta_boxes' );
	add_action( 'save_post', 'terra_brwn_save_meta', 10, 2 );
}

/**
 * add the meta box to Wordpress
 */
function add_terra_brwn_meta_boxes() {
	add_meta_box(
			'terra_brwn_location',
			esc_html__( 'TerraBRWN', 'TerraBRWN' ),
			'display_terra_brwn_meta_box',
			'post',
			'normal',
			'default'
	);
}


/* Display the post meta box. */
function display_terra_brwn_meta_box( $object, $box ) {
	wp_nonce_field( basename( __FILE__ ), 'terra_brwn_nonce' );
	
	echo '<p>';

	echo '<div style="height: 405px;">';

	echo '<div id="terra_brwn_settings_container">';
	echo '<div id="terra_brwn_location_field_container">';
	
	// dynamic content is included by JavaScript
	
	echo '<div id="dummy">';
	echo '<br />';
	
	echo '<button id="terra_brwn_fit_bounds" type="button" name="terra_brwn_fit_bounds" style="display: block; margin-left: auto; margin-right: auto;" onclick="fit_map_to_bounds()">Karte Zentrieren</button>';
	
	// for storing locations, JavaScript tells PHP how many fields it created
	echo '<input id="number_of_locations" type="hidden" name="number_of_locations" value="" />';

	echo '</div>';

	echo '</div>';
	echo '</div>';

	// Google Map
	echo '<div id="terra_brwn_google_maps_container">';
	echo '<label for="terra_brwn_google_maps">' . 'Google Maps' . '</label>';
	echo '<br />';
    echo '<div id="map-canvas"></div>';
	echo '</div>';

	echo '</div>';

	echo '</p>';

	// transfer location data to JavaScript in JSON format
	echo '<script>initialize_js(\'' . gather_locations() . '\')</script>';
}

/**
 * Saves the meta data that were entered
 *
 * @param int $post_id ID of the post
 * @param WP_Post $post post
 * @returns int the post id if something went wrong 
 */
function terra_brwn_save_meta( $post_id, $post ) {
	// Verify the nonce before proceeding
	if ( ! isset( $_POST['terra_brwn_nonce'] ) || ! wp_verify_nonce( $_POST['terra_brwn_nonce'], basename( __FILE__ ) ) ) {
		return $post_id;
	}

	// Nothing may be changed if user is not allowed to
	$post_type = get_post_type_object( $post->post_type );
	if ( ! current_user_can( $post_type->cap->edit_post, $post_id ) ) {
		return $post_id;
	}

	// Check how many filled location fields are present in the form and prepare them for storage as meta values
	$location_set = array();
	for ( $i = 1; $i <= intval( $_POST['number_of_locations'] ); $i++) {
		$location = ( isset( $_POST['terra-brwn-location' . $i] ) ? sanitize_meta( 'terra-brwn-location' . $i, $_POST['terra-brwn-location' . $i], 'user' ) : '' );
		// don't write empty location fields
		if ( $location != "" ) {
			$location_data = array(
					"location" => $location,
					"lat" => ( isset( $_POST['terra-brwn-lat' . $i] ) ? sanitize_meta( 'terra-brwn-lat', $_POST['terra-brwn-lat' . $i], 'user' ) : '' ),
					"lng" => ( isset( $_POST['terra-brwn-lng' . $i] ) ? sanitize_meta( 'terra-brwn-lng', $_POST['terra-brwn-lng' . $i], 'user' ) : '' )
			);
			array_push( $location_set, $location_data);
		}
	}
	$location_set_JSON = json_encode( $location_set, JSON_UNESCAPED_UNICODE );
	
	// Store meta values in Wordpress
	// TODO: implement the sanitize-function for the meta value (depending on Google Maps API)
	$meta_key = 'terra-brwn-locations';
	$meta_value = get_post_meta( $post_id, $meta_key, true );
	if ( $location_set_JSON && '' == $meta_value ) {
    	add_post_meta( $post_id, $meta_key, $location_set_JSON, true );
	} elseif ( $location_set_JSON && $location_set_JSON != $meta_value ) {
		update_post_meta( $post_id, $meta_key, $location_set_JSON );
	} elseif ( '' == $location_set_JSON && $meta_value ) {
    	delete_post_meta( $post_id, $meta_key, $meta_value );
	}	
}

/**
 * include a map in WP Posts
 *
 * @param array $atts attributes for the map (e.g. title, width, height)
 * @param content $content
 */
function terra_brwn_include_map( $atts, $content = null ) {
	$defaults = shortcode_atts( array(
		'title' => 'Brwntwn',
		'width' => '100%',
		'height' => '100%',
		), $atts );
	echo '<div id="terra_brwn_map" style="
			width: '  . $defaults['width'] . '; 
			height: ' . $defaults['height'] . ';
			">';
	echo '</div>';
	
	// tell JavaScript where to find the PlugIn stuff
	set_plugin_path();
	// get location data from WP Posts and set them for JavaScript
	set_markers_for_JavaScript( gather_marker_data() );
}

/**
 * gather post information for markers to be used on the map
 *
 * The function will retrieve all relevant marker data for display in JSON format
 * [A, B, C, ...] where sets A, B, C, ... each are associative arrays with:
 *
 * - ID:    post ID as unique identifier for the post that the marker belongs to
 * - title: post title
 * - date:  post creation date
 * - lat:   marker latitude
 * - lng:   marker longitude
 * - link:  URL to the post
 * - cat:   post category
 *
 * TODO: filters for the posts
 *
 * @return JSON post information for markers
 */
function gather_marker_data() {
	$markers = array();
	 //walk all relevant post and retrieve all markers from each
	$wp_posts = get_posts( ["numberposts" => -1] );
	foreach ( $wp_posts as $post ) {
		if ( $post->post_type == "post" ) {

			// locations are stored in JSON format
			$location_set_JSON = $post->__get( 'terra-brwn-locations' );
			$location_set = json_decode( $location_set_JSON, true );
			for ($i = 0; $i < sizeof( $location_set ); $i++ ) {
				$location_data = $location_set[$i];
				$marker_data = array(
						'ID'    => $post->ID,
						'title' => bugfix_json_apostrophe( $post->post_title ),
						'date'  => $post->post_date,
						'lat'   => $location_data['lat'], 
						'lng'   => $location_data['lng'],
						'link'  => get_permalink( $post->ID ),
						'cat'   => bugfix_json_apostrophe( strtolower( get_the_category( $post->ID )[0]->name ) )
				);
				array_push( $markers, $marker_data );
			}
		}
	}
	$json = json_encode( $markers );
	return $json;
}

/**
 * echo the HTML code for setting markers in JavaScript
 * 
 * @param JSON $json marker data in JSON format
 */
function set_markers_for_JavaScript( $json ) {
	echo '<script type="text/javascript">' . 'set_markers(\'' . $json . '\');' .'</script>';
}

/**
 * get the location data for the current post from WP meta
 *
 * @return JSON location data
 */
function gather_locations() {
	$post = get_post();
	return $post->__get( 'terra-brwn-locations' );
}

/**
 * removes apostrophes from strings because the parse function in JavaScript seems to be troublesome
 *
 * @param String $value string to be stripped off apostrophes
 *
 * @return String original string without apostrophes
 */
function bugfix_json_apostrophe( $value ) {
	return str_replace( "'", "", $value );
}

/**
 * transfer the plugin path to javascript
 */
function set_plugin_path() {
	$plugin_path = plugins_url();
	echo '<script type="text/javascript">' . 'set_plugin_path(\'' . $plugin_path . '\');' .'</script>';
}

wp_enqueue_style( 'TerraBRWN', plugins_url( 'css/TerraBRWN.css', __FILE__ ) );
wp_enqueue_script( 'GoogleMapsAPI', 'https://maps.googleapis.com/maps/api/js?v=3.exp&signed_in=false' );
if ( ! is_admin() ) {
	wp_enqueue_script( 'TerraBRWNGoogleMapsFrontend', plugins_url( 'js/TerraBRWN_google_maps_frontend.js', __FILE__ ) );
}
add_shortcode( 'terrabrwn', 'terra_brwn_include_map' );
