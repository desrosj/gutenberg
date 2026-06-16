/**
 * WordPress dependencies
 */
import { select as globalSelect, dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

const MAX_RECENTLY_SAVED = 30;

/**
 * Records that a command was used, persisting it to the front of the list of
 * recently used commands.
 *
 * @param {string} name The command name.
 */
export function recordUsage( name ) {
	const current =
		globalSelect( preferencesStore ).get(
			'core/commands',
			'recentlyUsed'
		) ?? [];
	const next = [ name, ...current.filter( ( n ) => n !== name ) ].slice(
		0,
		MAX_RECENTLY_SAVED
	);
	dispatch( preferencesStore ).set( 'core/commands', 'recentlyUsed', next );
}
