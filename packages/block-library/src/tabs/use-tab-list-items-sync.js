/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

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

	useEffect( () => {
		if ( ! tabListClientId || ! currentTabs ) {
			return;
		}

		// Match each existing label to its tab panel by the stored client ID.
		// `tabPanelClientId` is a local (unsaved) attribute, so on a freshly
		// loaded document it is empty; fall back to positional alignment, which
		// matches the saved order.
		const labelsByClientId = new Map();
		currentTabs.forEach( ( tab, index ) => {
			const id = tab.tabPanelClientId ?? tabPanels[ index ]?.clientId;
			if ( id ) {
				labelsByClientId.set( id, tab.label ?? '' );
			}
		} );

		// Rebuild `tabs` in the current tab panel order, carrying each panel's
		// label along. A newly added panel has no stored label and gets a
		// default. Each entry records its tab panel's client ID so the binding
		// survives reordering and undo without extra bookkeeping.
		const newTabs = tabPanels.map( ( tabPanel ) => ( {
			label: labelsByClientId.has( tabPanel.clientId )
				? labelsByClientId.get( tabPanel.clientId )
				: __( 'Tab' ),
			tabPanelClientId: tabPanel.clientId,
		} ) );

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
