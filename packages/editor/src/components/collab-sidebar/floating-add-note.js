/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	Popover,
	Toolbar,
	ToolbarButton,
	ToolbarGroup,
	SVG,
	Path,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import {
	store as blockEditorStore,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';
import { store as interfaceStore } from '@wordpress/interface';
import { useAnchor } from '@wordpress/rich-text';

/**
 * Internal dependencies
 */
import { ALL_NOTES_SIDEBAR, FLOATING_NOTES_SIDEBAR } from './constants';
import { store as editorStore } from '../../store';
import { unlock } from '../../lock-unlock';
import { hasNoteFormatInRange, readInlineSelection } from './utils';

const { useBlockElement } = unlock( blockEditorPrivateApis );

// Milliseconds the selection must stay stable before the floating button
// appears. A short delay keeps the canvas from flickering a button on every
// transient selection change while the user is still dragging to highlight.
const SHOW_DELAY_MS = 300;

// Comment bubble with a plus in the middle — the "start a note" affordance,
// mirroring the on-select entry point in Google Docs. Composed locally rather
// than added to `@wordpress/icons` since it's specific to this entry point.
const addNoteIcon = (
	<SVG xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<Path d="M18 4H6c-1.1 0-2 .9-2 2v12.9c0 .6.5 1.1 1.1 1.1.3 0 .5-.1.8-.3L8.5 17H18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm.5 11c0 .3-.2.5-.5.5H7.9l-2.4 2.4V6c0-.3.2-.5.5-.5h12c.3 0 .5.2.5.5v9z" />
		<Path d="M11.25 6.75h1.5v2.75h2.75v1.5h-2.75v2.75h-1.5v-2.75H8.5v-1.5h2.75z" />
	</SVG>
);

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
	// Gate the button behind a short delay so it only surfaces once the
	// selection has settled. Re-keying on the captured range restarts the timer
	// whenever the selection changes (e.g. while the user is still dragging),
	// and clears it the moment the selection collapses.
	const selectionKey = inlineSelection
		? `${ inlineSelection.clientId }:${ inlineSelection.attributeKey }:${ inlineSelection.start }:${ inlineSelection.end }`
		: null;
	const [ isReady, setIsReady ] = useState( false );
	useEffect( () => {
		if ( ! selectionKey ) {
			setIsReady( false );
			return;
		}
		setIsReady( false );
		const timer = setTimeout( () => setIsReady( true ), SHOW_DELAY_MS );
		return () => clearTimeout( timer );
	}, [ selectionKey ] );

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

	if ( ! isReady || ! inlineSelection || ! blockElement || ! popoverAnchor ) {
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
			// Anchor at the top-right of the selection: matches the
			// Medium / Notion on-select pattern and reads as the natural
			// continuation point at the end of what the user just
			// highlighted. The Popover auto-flips to the bottom edge
			// when the selection sits flush against the block toolbar.
			placement="top-end"
			offset={ 8 }
			focusOnMount={ false }
			anchor={ popoverAnchor }
			// Drop the default popover background/border/shadow so the toolbar
			// frame is the only visible surface, matching the block toolbar
			// (which renders its popover with this same variant).
			variant="unstyled"
			// Render into the slot the inline rich-text popovers use so the
			// button is clipped to the editor canvas and flips/shifts to stay
			// within it, instead of floating over the header or footer chrome
			// when the selection is scrolled to the edge of the viewport.
			__unstableSlotName="__unstable-block-tools-after"
			className="editor-collab-sidebar__floating-add-note"
		>
			<Toolbar label={ __( 'Notes' ) }>
				<ToolbarGroup>
					<ToolbarButton
						icon={ addNoteIcon }
						label={ __( 'Add note' ) }
						// Prevent the mousedown from stealing focus from the
						// editor; the captured rich-text selection in the
						// block-editor store must survive long enough for
						// `useNoteActions.onCreate` to read it.
						onMouseDown={ ( event ) => event.preventDefault() }
						onClick={ onClick }
					/>
				</ToolbarGroup>
			</Toolbar>
		</Popover>
	);
}
