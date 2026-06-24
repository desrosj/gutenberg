/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';

/**
 * Keep the tab-list block's `tabs` attribute in sync with the core/tab-panel
 * blocks.
 *
 * The `tabs` attribute is the source of truth for tab labels, but the panels
 * determine how many tabs exist and in which order. This hook reconciles the
 * two by tracking each label against its panel's client ID, so labels follow
 * their panel across additions, removals, and reordering. Brand-new panels get
 * a default label.
 *
 * @param {Object}      props
 * @param {Array}       props.tabPanels       Raw core/tab-panel block objects.
 * @param {string|null} props.tabListClientId Client ID of the core/tab-list block.
 */
export default function useTabListItemsSync( { tabPanels, tabListClientId } ) {
	const { updateBlockAttributes, __unstableMarkNextChangeAsNotPersistent } =
		useDispatch( blockEditorStore );

	const currentTabs = useSelect(
		( select ) =>
			tabListClientId
				? select( blockEditorStore ).getBlockAttributes(
						tabListClientId
				  )?.tabs
				: null,
		[ tabListClientId ]
	);

	// The panel client IDs `currentTabs` is aligned to, captured the last time
	// `tabs` was written.
	const prevPanelIdsRef = useRef( null );

	useEffect( () => {
		if ( ! tabListClientId || ! currentTabs ) {
			return;
		}

		const panelIds = tabPanels.map( ( panel ) => panel.clientId );

		// Map each known panel (by client ID) to its current label. On the
		// first run there is no previous order, so fall back to the current
		// panel order, which matches the loaded document.
		const basis = prevPanelIdsRef.current ?? panelIds;
		const labelsById = new Map();
		basis.forEach( ( id, index ) => {
			if ( index < currentTabs.length ) {
				labelsById.set( id, currentTabs[ index ]?.label ?? '' );
			}
		} );

		// Rebuild `tabs` in the current panel order, carrying each panel's
		// label along. Panels with no known label (newly added) get a default.
		const newTabs = panelIds.map( ( id ) => ( {
			label: labelsById.has( id ) ? labelsById.get( id ) : __( 'Tab' ),
		} ) );

		prevPanelIdsRef.current = panelIds;

		if ( JSON.stringify( newTabs ) === JSON.stringify( currentTabs ) ) {
			return;
		}

		__unstableMarkNextChangeAsNotPersistent();
		updateBlockAttributes( tabListClientId, { tabs: newTabs } );
	}, [
		tabPanels,
		currentTabs,
		tabListClientId,
		updateBlockAttributes,
		__unstableMarkNextChangeAsNotPersistent,
	] );
}
