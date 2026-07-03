/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';

const EMPTY_ARRAY = [];

/**
 * Keep the tab-list block's `tabs` attribute in sync with the core/tab-panel
 * blocks.
 *
 * The `tabs` attribute is the source of truth for tab labels, but the tab
 * panels determine how many tabs exist and in which order. This hook reconciles
 * the two by tracking each label against its tab panel's client ID, so labels
 * follow their tab panel across additions, removals, and reordering.
 *
 * @param {string} clientId Client ID of the core/tabs block.
 */
export default function useTabListItemsSync( clientId ) {
	const { updateBlockAttributes, __unstableMarkNextChangeAsNotPersistent } =
		useDispatch( blockEditorStore );

	const { tabPanels, tabListClientId, currentTabs } = useSelect(
		( select ) => {
			const { getBlocks, getBlockAttributes } =
				select( blockEditorStore );
			const innerBlocks = getBlocks( clientId );

			const tabPanelsBlock = innerBlocks.find(
				( block ) => block.name === 'core/tab-panels'
			);
			const tabListBlock = innerBlocks.find(
				( block ) => block.name === 'core/tab-list'
			);
			const _tabListClientId = tabListBlock?.clientId ?? null;

			return {
				tabPanels: tabPanelsBlock?.innerBlocks ?? EMPTY_ARRAY,
				tabListClientId: _tabListClientId,
				currentTabs: _tabListClientId
					? getBlockAttributes( _tabListClientId )?.tabs
					: null,
			};
		},
		[ clientId ]
	);

	// The tab panel client IDs `currentTabs` is aligned to, captured the last
	// time `tabs` was written.
	const prevTabPanelClientIdsRef = useRef( null );

	useEffect( () => {
		if ( ! tabListClientId || ! currentTabs ) {
			return;
		}

		const tabPanelClientIds = tabPanels.map(
			( tabPanel ) => tabPanel.clientId
		);

		// `currentTabs` has no client IDs of its own; each label is matched to a
		// tab panel purely by position. This is the tab panel order from when
		// `currentTabs` was last written, so `currentTabs[ i ]` is the label for
		// tab panel `tabPanelClientIdsForCurrentTabs[ i ]`. On the first run
		// nothing has been written yet, so fall back to the current order, which
		// matches the freshly loaded document.
		const tabPanelClientIdsForCurrentTabs =
			prevTabPanelClientIdsRef.current ?? tabPanelClientIds;
		const labelsByClientId = new Map();
		tabPanelClientIdsForCurrentTabs.forEach( ( id, index ) => {
			if ( index < currentTabs.length ) {
				labelsByClientId.set( id, currentTabs[ index ]?.label ?? '' );
			}
		} );

		// Rebuild `tabs` in the current tab panel order, carrying each tab
		// panel's label along. A newly added tab panel has no known label and
		// gets a default.
		const newTabs = tabPanelClientIds.map( ( id ) => ( {
			label: labelsByClientId.has( id )
				? labelsByClientId.get( id )
				: __( 'Tab' ),
		} ) );

		prevTabPanelClientIdsRef.current = tabPanelClientIds;

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
