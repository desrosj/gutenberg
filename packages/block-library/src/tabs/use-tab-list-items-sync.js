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
 * The `tabs` attribute is the source of truth for tab labels, but the tab
 * panels determine how many tabs exist and in which order. This hook reconciles
 * the two by tracking each label against its tab panel's client ID, so labels
 * follow their tab panel across additions, removals, and reordering.
 *
 * A brand-new tab panel gets a default label, except when it was created by
 * duplicating another panel: the tab-panel block mirrors its label into a local
 * (non-serialized) `label` attribute, which duplication copies, so a duplicated
 * panel inherits its source's label instead of the default.
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
		// panel's label along. A newly added tab panel has no known label: a
		// duplicated one carries its source's label in its local `label`
		// attribute, while a freshly inserted one has none and gets a default.
		const newTabs = tabPanelClientIds.map( ( id, index ) => ( {
			label: labelsByClientId.has( id )
				? labelsByClientId.get( id )
				: tabPanels[ index ].attributes.label || __( 'Tab' ),
		} ) );

		prevTabPanelClientIdsRef.current = tabPanelClientIds;

		// Mirror each resolved label into its tab panel's local `label`
		// attribute (never serialized) so a later duplication can carry it.
		tabPanels.forEach( ( tabPanel, index ) => {
			const label = newTabs[ index ].label?.toString() ?? '';
			if ( ( tabPanel.attributes.label ?? '' ) !== label ) {
				__unstableMarkNextChangeAsNotPersistent();
				updateBlockAttributes( tabPanel.clientId, { label } );
			}
		} );

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
