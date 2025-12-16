<?php
/**
 * Bootstraps the Experiments page in wp-admin.
 *
 * @package gutenberg
 */

add_action( 'admin_menu', 'gutenberg_register_experiments_menu_item' );
add_action( 'admin_enqueue_scripts', 'gutenberg_experiments_wp_admin_enqueue_scripts' );

/**
 * Registers the Experiments menu item under Gutenberg using the experiments page.
 */
function gutenberg_register_experiments_menu_item() {
	add_submenu_page(
		'gutenberg',
		__( 'Experiments Settings', 'gutenberg' ),
		__( 'Experiments', 'gutenberg' ),
		'manage_options',
		'experiments-wp-admin',
		'experiments_wp_admin_render_page'
	);
}

/**
 * Enqueue scripts and pass experiments data to JavaScript.
 *
 * @param string $hook_suffix The current admin page.
 */
function gutenberg_experiments_wp_admin_enqueue_scripts( $hook_suffix ) {
	// Only enqueue on our page
	if ( ! isset( $_GET['page'] ) || 'experiments-wp-admin' !== $_GET['page'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return;
	}

	// Pass experiments data to JavaScript as fallback
	wp_add_inline_script(
		'experiments-wp-admin-prerequisites',
		sprintf(
			'window.__GUTENBERG_EXPERIMENTS__ = %s;',
			wp_json_encode( gutenberg_get_experiments() )
		),
		'before'
	);
}

