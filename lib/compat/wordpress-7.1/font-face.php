<?php
/**
 * Admin `Segoe UI Variable` font fix.
 *
 * @package gutenberg
 */

/**
 * Injects a `Segoe UI Variable` `@font-face` and prefers it in the admin font
 * stack so the medium (500) font weight renders on Windows.
 *
 * Core's `common.css` uses the static "Segoe UI", which has no 500 weight.
 * Preferring the local "Segoe UI Variable" variable font lets the browser
 * render 500; where it's unavailable the stack falls through. Mirrors the
 * design system fix for admin UI that still relies on the core stylesheet.
 *
 * @see https://github.com/WordPress/gutenberg/issues/79525
 *
 * @since 7.1.0
 */
function gutenberg_enqueue_segoe_ui_variable_font() {
	$css = <<<CSS
@font-face {
	font-family: "Segoe UI Variable";
	src: local("Segoe UI Variable Text");
	font-weight: 100 700;
}
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
}
CSS;

	// Appended after `common.css` so the `body` override wins on source order.
	wp_add_inline_style( 'common', $css );
}
add_action( 'admin_enqueue_scripts', 'gutenberg_enqueue_segoe_ui_variable_font' );
