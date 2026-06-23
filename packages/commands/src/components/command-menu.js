/**
 * External dependencies
 */
// eslint-disable-next-line @wordpress/use-recommended-components
import { Autocomplete } from '@wordpress/ui';
import commandScore from 'command-score';

/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import {
	useState,
	useEffect,
	useRef,
	useMemo,
	useCallback,
	isValidElement,
	Component,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Modal,
	TextHighlight,
	privateApis as componentsPrivateApis,
} from '@wordpress/components';
import {
	store as keyboardShortcutsStore,
	useShortcut,
} from '@wordpress/keyboard-shortcuts';
import { Icon, search as inputIcon, arrowRight } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { store as commandsStore } from '../store';
import { unlock } from '../lock-unlock';
import {
	recordUsage,
	useLoaderCollector,
	useRecentCommands,
} from './use-recent-commands';

const { withIgnoreIMEEvents } = unlock( componentsPrivateApis );

const inputLabel = __( 'Search commands and settings' );
const EMPTY_ARRAY = [];

/**
 * Icons enforced per command category.
 * Categories listed here will always use the specified icon,
 * ignoring whatever icon the command itself provides.
 */
const CATEGORY_ICONS = {
	view: arrowRight,
};

/**
 * Translatable labels for command categories.
 */
const CATEGORY_LABELS = {
	command: __( 'Command' ),
	view: __( 'View' ),
	edit: __( 'Edit' ),
	action: __( 'Action' ),
	workflow: __( 'Workflow' ),
};

/**
 * Function that checks if the parameter is a valid icon.
 * Taken from @wordpress/blocks/src/api/utils.js and copied
 * in case requirements diverge and to avoid a dependency on @wordpress/blocks.
 *
 * @param {*} icon Parameter to be checked.
 *
 * @return {boolean} True if the parameter is a valid icon and false otherwise.
 */

export function isValidIcon( icon ) {
	return (
		!! icon &&
		( typeof icon === 'string' ||
			isValidElement( icon ) ||
			typeof icon === 'function' ||
			icon instanceof Component )
	);
}

/**
 * Ranks and filters a list of commands against the search term using the same
 * fuzzy scoring algorithm previously provided by `cmdk` (`command-score`).
 * Commands are de-duplicated by name, score-0 matches are dropped, and the
 * result is sorted by descending relevance.
 *
 * @param {Object[]} commands The commands to rank.
 * @param {string}   search   The search term.
 *
 * @return {Object[]} The matching commands, ordered by relevance.
 */
function rankCommands( commands, search ) {
	const seen = new Set();
	const scored = [];
	for ( const command of commands ) {
		if ( seen.has( command.name ) ) {
			continue;
		}
		seen.add( command.name );
		const value = command.searchLabel ?? command.label;
		const score = commandScore( value, search, command.keywords ?? [] );
		if ( score > 0 ) {
			scored.push( { command, score } );
		}
	}
	scored.sort( ( a, b ) => b.score - a.score );
	return scored.map( ( { command } ) => command );
}

/**
 * De-duplicates a list of commands by name, preserving order.
 *
 * @param {Object[]} commands The commands to de-duplicate.
 *
 * @return {Object[]} The de-duplicated commands.
 */
function dedupeCommands( commands ) {
	const seen = new Set();
	const result = [];
	for ( const command of commands ) {
		if ( seen.has( command.name ) ) {
			continue;
		}
		seen.add( command.name );
		result.push( command );
	}
	return result;
}

function CommandItem( { command, search, category } ) {
	const { close } = useDispatch( commandsStore );
	const commandCategory = category ?? command.category;
	return (
		<Autocomplete.Item
			value={ command }
			className="commands-command-menu__item"
			onClick={ () => {
				recordUsage( command.name );
				command.callback( { close } );
			} }
		>
			{ CATEGORY_ICONS[ commandCategory ] ? (
				<Icon icon={ CATEGORY_ICONS[ commandCategory ] } />
			) : (
				isValidIcon( command.icon ) && <Icon icon={ command.icon } />
			) }
			<span className="commands-command-menu__item-label">
				<TextHighlight text={ command.label } highlight={ search } />
			</span>
			{ CATEGORY_LABELS[ commandCategory ] && (
				<span className="commands-command-menu__item-category">
					{ CATEGORY_LABELS[ commandCategory ] }
				</span>
			) }
		</Autocomplete.Item>
	);
}

// Runs a single command loader and reports its resolved commands up to the
// parent via `onResolved`. Renders nothing; it exists solely to call the
// loader hook in isolation (respecting the rules of hooks) and to aggregate
// dynamic commands into the shared item list.
function LoaderRunner( { loader, search, onResolved } ) {
	useLoaderCollector( {
		hook: loader.hook,
		name: loader.name,
		search,
		onResolved,
	} );

	return null;
}

// The "hook" prop is actually a custom React hook, so to avoid breaking the
// rules of hooks the `LoaderRunner` needs to be remounted whenever the hook
// identity changes.
function LoaderRunnerWrapper( { loader, ...props } ) {
	const [ tracked, setTracked ] = useState( () => ( {
		hook: loader.hook,
		key: 0,
	} ) );

	if ( tracked.hook !== loader.hook ) {
		// Derive new state during render and skip this pass so the next render
		// mounts a fresh `LoaderRunner` for the new hook.
		setTracked( ( prev ) => ( { hook: loader.hook, key: prev.key + 1 } ) );
		return null;
	}

	return <LoaderRunner key={ tracked.key } loader={ loader } { ...props } />;
}

/**
 * @ignore
 */
export function CommandMenu() {
	const { registerShortcut } = useDispatch( keyboardShortcutsStore );
	const [ search, setSearch ] = useState( '' );
	const {
		isOpen: paletteIsOpen,
		loadersLoading,
		staticCommands,
		contextualCommands,
		staticLoaders,
		contextualLoaders,
	} = useSelect( ( select ) => {
		const { getCommands, getCommandLoaders, isOpen } =
			select( commandsStore );
		return {
			isOpen: isOpen(),
			loadersLoading: unlock( select( commandsStore ) ).isLoading(),
			staticCommands: getCommands( false ),
			contextualCommands: getCommands( true ),
			staticLoaders: getCommandLoaders( false ),
			contextualLoaders: getCommandLoaders( true ),
		};
	}, [] );
	const { open, close } = useDispatch( commandsStore );

	// Aggregate the commands resolved by each dynamic loader. Each loader runs
	// in its own `LoaderRunner` component and reports back here.
	const [ resolvedMap, setResolvedMap ] = useState( () => new Map() );
	const onResolved = useCallback( ( loaderName, cmds ) => {
		setResolvedMap( ( prev ) => {
			const prevCmds = prev.get( loaderName );
			if (
				prevCmds &&
				prevCmds.length === cmds.length &&
				prevCmds.every( ( c, i ) => c.name === cmds[ i ].name )
			) {
				return prev;
			}
			const next = new Map( prev );
			next.set( loaderName, cmds );
			return next;
		} );
	}, [] );

	const loaders = useMemo(
		() => [ ...contextualLoaders, ...staticLoaders ],
		[ contextualLoaders, staticLoaders ]
	);
	const contextualLoaderNames = useMemo(
		() => new Set( contextualLoaders.map( ( loader ) => loader.name ) ),
		[ contextualLoaders ]
	);

	const { allLoaderCommands, contextualLoaderCommands } = useMemo( () => {
		const all = [];
		const contextual = [];
		for ( const [ name, cmds ] of resolvedMap ) {
			all.push( ...cmds );
			if ( contextualLoaderNames.has( name ) ) {
				contextual.push( ...cmds );
			}
		}
		return {
			allLoaderCommands: all,
			contextualLoaderCommands: contextual,
		};
	}, [ resolvedMap, contextualLoaderNames ] );

	const allCommands = useMemo(
		() => [
			...contextualCommands,
			...staticCommands,
			...allLoaderCommands,
		],
		[ contextualCommands, staticCommands, allLoaderCommands ]
	);

	const recentCommands = useRecentCommands( allCommands );

	// Build the grouped item list passed to `Autocomplete`. The groups shown
	// depend on whether a search term is present, mirroring the previous
	// Recent / Suggestions / Results behavior.
	const groups = useMemo( () => {
		if ( search ) {
			const results = rankCommands( allCommands, search );
			return results.length
				? [
						{
							key: 'results',
							label: __( 'Results' ),
							search,
							items: results,
						},
				  ]
				: EMPTY_ARRAY;
		}

		const result = [];

		// Recent.
		if ( recentCommands.length ) {
			result.push( {
				key: 'recent',
				label: __( 'Recent' ),
				search: '',
				items: recentCommands,
			} );
		}

		// Suggestions (contextual commands and loaders only).
		const suggestions = dedupeCommands( [
			...contextualCommands,
			...contextualLoaderCommands,
		] );
		if ( suggestions.length ) {
			result.push( {
				key: 'suggestions',
				label: __( 'Suggestions' ),
				search: '',
				items: suggestions,
			} );
		}

		return result;
	}, [
		search,
		allCommands,
		recentCommands,
		contextualCommands,
		contextualLoaderCommands,
	] );

	const inputRef = useRef();
	useEffect( () => {
		// Focus the command palette input when mounting the modal.
		if ( paletteIsOpen ) {
			inputRef.current?.focus();
		}
	}, [ paletteIsOpen ] );

	useEffect( () => {
		registerShortcut( {
			name: 'core/commands',
			category: 'global',
			description: __( 'Open the command palette.' ),
			keyCombination: {
				modifier: 'primary',
				character: 'k',
			},
		} );
	}, [ registerShortcut ] );

	useShortcut(
		'core/commands',
		/** @type {React.KeyboardEventHandler} */
		withIgnoreIMEEvents( ( event ) => {
			// Bails to avoid obscuring the effect of the preceding handler(s).
			if ( event.defaultPrevented ) {
				return;
			}

			event.preventDefault();
			if ( paletteIsOpen ) {
				close();
			} else {
				open();
			}
		} ),
		{
			bindGlobal: true,
		}
	);

	const closeAndReset = () => {
		setSearch( '' );
		close();
	};

	if ( ! paletteIsOpen ) {
		return false;
	}

	const showEmpty = !! search && ! loadersLoading && ! groups.length;

	return (
		<Modal
			className="commands-command-menu"
			overlayClassName="commands-command-menu__overlay"
			onRequestClose={ closeAndReset }
			__experimentalHideHeader
			size="medium"
			contentLabel={ __( 'Command palette' ) }
		>
			<div className="commands-command-menu__container">
				<Autocomplete.Root
					items={ groups }
					mode="none"
					value={ search }
					onValueChange={ setSearch }
					open
					inline
					autoHighlight
					aria-label={ inputLabel }
				>
					{ loaders.map( ( loader ) => (
						<LoaderRunnerWrapper
							key={ loader.name }
							loader={ loader }
							search={ search }
							onResolved={ onResolved }
						/>
					) ) }
					<div className="commands-command-menu__header">
						<Icon
							className="commands-command-menu__header-search-icon"
							icon={ inputIcon }
						/>
						<Autocomplete.Input
							ref={ inputRef }
							placeholder={ inputLabel }
							aria-label={ inputLabel }
							className="commands-command-menu__input"
							// Render a plain input so the palette keeps its
							// borderless appearance instead of the design
							// system's bordered input control.
							render={ <input /> }
						/>
					</div>
					<Autocomplete.List
						className="commands-command-menu__list"
						aria-label={ __( 'Command suggestions' ) }
					>
						{ showEmpty && (
							<Autocomplete.Empty className="commands-command-menu__empty">
								{ __( 'No results found.' ) }
							</Autocomplete.Empty>
						) }
						<Autocomplete.ListBody className="commands-command-menu__list-scrollable-container">
							<Autocomplete.Collection>
								{ ( group ) => (
									<Autocomplete.Group
										key={ group.key }
										items={ group.items }
										className="commands-command-menu__group"
									>
										<Autocomplete.GroupLabel className="commands-command-menu__group-label">
											{ group.label }
										</Autocomplete.GroupLabel>
										<Autocomplete.Collection>
											{ ( command ) => (
												<CommandItem
													key={ command.name }
													command={ command }
													search={ group.search }
													category={
														command.category
													}
												/>
											) }
										</Autocomplete.Collection>
									</Autocomplete.Group>
								) }
							</Autocomplete.Collection>
						</Autocomplete.ListBody>
					</Autocomplete.List>
				</Autocomplete.Root>
			</div>
		</Modal>
	);
}
