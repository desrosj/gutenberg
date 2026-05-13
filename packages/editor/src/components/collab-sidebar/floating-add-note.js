/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Popover } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	store as blockEditorStore,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';
import { store as interfaceStore } from '@wordpress/interface';
import { useAnchor } from '@wordpress/rich-text';
import { comment as commentIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { ALL_NOTES_SIDEBAR, FLOATING_NOTES_SIDEBAR } from './constants';
import { store as editorStore } from '../../store';
import { unlock } from '../../lock-unlock';
import { hasNoteFormatInRange, readInlineSelection } from './utils';

const { useBlockElement } = unlock( blockEditorPrivateApis );

/**
 * Compute whether the current block-editor selection is a candidate for the
 * floating "Add note" entry point. Returns the captured inline range when it
 * is, or `null` to suppress the button. The button is hidden when the selection
 * is collapsed, spans multiple blocks, isn't inside a rich-text attribute, or
 * already overlaps an existing `core/note` marker — the rich-text toolbar
 * already handles re-selecting an existing note in that case.
 *
 * @return {?Object} `{ clientId, attributeKey, start, end }` or `null`.
 */
function useFloatingButtonSelection() {
	return useSelect( ( select ) => {
		const {
			getSelectionStart,
			getSelectionEnd,
			getBlockAttributes,
			hasMultiSelection,
		} = select( blockEditorStore );

		if ( hasMultiSelection() ) {
			return null;
		}

		const inlineSelection = readInlineSelection(
			getSelectionStart(),
			getSelectionEnd()
		);
		if ( ! inlineSelection ) {
			return null;
		}

		const attributes = getBlockAttributes( inlineSelection.clientId );
		if ( ! attributes ) {
			return null;
		}

		if (
			hasNoteFormatInRange(
				attributes[ inlineSelection.attributeKey ],
				inlineSelection.start,
				inlineSelection.end
			)
		) {
			return null;
		}

		return inlineSelection;
	}, [] );
}

export function FloatingAddNote() {
	const inlineSelection = useFloatingButtonSelection();
	// `useBlockElement` returns the rich-text wrapper (or null). Passing the
	// block element to `useAnchor` lets it derive a virtual anchor from the
	// live DOM range; `useAnchor` reads `ownerDocument.defaultView.getSelection()`,
	// so iframe canvases resolve to the iframe's selection automatically.
	const blockElement = useBlockElement( inlineSelection?.clientId );
	const popoverAnchor = useAnchor( {
		editableContentElement: blockElement,
	} );
	const dispatch = useDispatch();
	const currentArea = useSelect(
		( select ) =>
			select( interfaceStore ).getActiveComplementaryArea( 'core' ),
		[]
	);

	if ( ! inlineSelection || ! blockElement || ! popoverAnchor ) {
		return null;
	}

	const onClick = () => {
		// Mirror the rich-text toolbar button: prefer the visible sidebar when
		// one is already open, otherwise drop into the floating panel.
		const targetSidebar =
			currentArea === ALL_NOTES_SIDEBAR
				? ALL_NOTES_SIDEBAR
				: FLOATING_NOTES_SIDEBAR;
		if ( currentArea !== targetSidebar ) {
			dispatch( interfaceStore ).enableComplementaryArea(
				'core',
				targetSidebar
			);
		}
		unlock( dispatch( editorStore ) ).selectNote( 'new', { focus: true } );
	};

	return (
		<Popover
			placement="top"
			focusOnMount={ false }
			anchor={ popoverAnchor }
			className="editor-collab-sidebar__floating-add-note"
			variant="unstyled"
		>
			<Button
				size="small"
				variant="primary"
				icon={ commentIcon }
				label={ __( 'Add note' ) }
				showTooltip
				// Prevent the mousedown from stealing focus from the editor; the
				// captured rich-text selection in the block-editor store must
				// survive long enough for `useNoteActions.onCreate` to read it.
				onMouseDown={ ( event ) => event.preventDefault() }
				onClick={ onClick }
			>
				{ __( 'Add note' ) }
			</Button>
		</Popover>
	);
}
