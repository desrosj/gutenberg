/**
 * WordPress dependencies
 */
import {
	useSelect,
	useDispatch,
	select as globalSelect,
	dispatch,
} from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { useEffect, useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as commandsStore } from '../store';
import { unlock } from '../lock-unlock';

const MAX_RECENTLY_SAVED = 30;
const MAX_RECENTLY_DISPLAYED = 5;
const EMPTY_ARRAY = [];

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

/**
 * Runs a single command loader and reports its resolved commands and loading
 * state back to the caller. Designed to be called from a component rendered
 * once per loader, so the loader hook is invoked in isolation (respecting the
 * rules of hooks).
 *
 * @param {Object}   options
 * @param {Function} options.hook       The loader hook to run.
 * @param {string}   options.name       The loader name.
 * @param {string}   options.search     The current search term.
 * @param {Function} options.onResolved Callback receiving `( name, commands )`.
 */
export function useLoaderCollector( { hook, name, search, onResolved } ) {
	const { setLoaderLoading } = unlock( useDispatch( commandsStore ) );
	const { isLoading = false, commands = EMPTY_ARRAY } =
		hook( { search } ) ?? {};

	useEffect( () => {
		setLoaderLoading( name, isLoading );
	}, [ setLoaderLoading, name, isLoading ] );

	useEffect( () => {
		onResolved( name, commands );
	}, [ onResolved, name, commands ] );

	// Clear this loader's entries when it unmounts.
	useEffect( () => {
		return () => onResolved( name, EMPTY_ARRAY );
	}, [ onResolved, name ] );
}

/**
 * Resolves the recently used command names into command objects, in recency
 * order, limited to `MAX_RECENTLY_DISPLAYED`.
 *
 * @param {Array} commandPool The list of available command objects to resolve
 *                            recently used names against.
 * @return {Array} Recently used command objects.
 */
export function useRecentCommands( commandPool ) {
	const recentlyUsedNames = useSelect(
		( select ) =>
			select( preferencesStore ).get( 'core/commands', 'recentlyUsed' ) ??
			EMPTY_ARRAY,
		[]
	);

	return useMemo( () => {
		const recentNames = recentlyUsedNames.slice(
			0,
			MAX_RECENTLY_DISPLAYED
		);
		if ( ! recentNames.length ) {
			return EMPTY_ARRAY;
		}
		const pool = new Map();
		for ( const command of commandPool ) {
			if ( ! pool.has( command.name ) ) {
				pool.set( command.name, command );
			}
		}
		return recentNames
			.map( ( name ) => pool.get( name ) )
			.filter( Boolean );
	}, [ recentlyUsedNames, commandPool ] );
}
