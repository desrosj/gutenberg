/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { useDebounce } from '@wordpress/compose';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { __unstableStripHTML as stripHTML } from '@wordpress/dom';
import {
	store as blockEditorStore,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { AddNote } from './add-note';
import { NoteContent } from './note-content';
import { FloatingContainer } from './floating-container';
import {
	focusNoteThread,
	getNoteExcerpt,
	scrollNoteThreadIntoView,
} from './utils';
import { store as editorStore } from '../../store';
import { unlock } from '../../lock-unlock';
import { LintCard } from '../document-annotations/lint-card';

const { useBlockElement } = unlock( blockEditorPrivateApis );

// Per-block annotation thread. Owns chrome (floating positioning, click
// selects the block + spotlight, hover highlights, keyboard navigation,
// treeitem role, DOM id) and dispatches per-annotation rendering on
// `annotation.kind`.
//
// A single block has at most one thread, regardless of how many
// annotations it carries. New annotation kinds plug in here as additional
// dispatcher cases.
export function NoteThread( {
	thread,
	isSelected,
	sidebarRef,
	floating,
	onAddReply,
	onEditNote,
	onDeleteNote,
	onKeyDown,
} ) {
	const { id: threadId, blockClientId, annotations } = thread;
	const isFloating = !! floating;
	const { toggleBlockHighlight, selectBlock, toggleBlockSpotlight } = unlock(
		useDispatch( blockEditorStore )
	);
	const { selectNote } = unlock( useDispatch( editorStore ) );
	const relatedBlockElement = useBlockElement( blockClientId );
	const debouncedToggleBlockHighlight = useDebounce(
		toggleBlockHighlight,
		50
	);
	const floatingRef = useRef( null );
	const isKeyboardTabbingRef = useRef( false );

	// Primary note drives expand/collapse semantics. A 'new' placeholder is
	// not a primary note — it's the AddNote form shortcut in floating mode.
	const primaryNoteAnnotation = annotations.find(
		( a ) => a.kind === 'note' && a.id !== 'new'
	);
	const primaryNote = primaryNoteAnnotation?.note;
	const isExpandable = !! primaryNote;

	const registerThread = floating?.registerThread;
	const unregisterThread = floating?.unregisterThread;

	// Register block + floating elements with the board. The board's
	// ResizeObserver and autoUpdate track changes automatically.
	useEffect( () => {
		const floatingEl = floatingRef.current;
		if ( floatingEl && registerThread ) {
			registerThread( threadId, relatedBlockElement, floatingEl );
		}
		return () => unregisterThread?.( threadId );
	}, [ relatedBlockElement, threadId, registerThread, unregisterThread ] );

	// Scroll the thread into view when it becomes selected, and re-scroll
	// when its floating position settles after `useFloatingBoard` recomputes.
	useEffect( () => {
		if ( ! isSelected || ! isExpandable ) {
			return;
		}
		scrollNoteThreadIntoView( threadId, sidebarRef.current );
	}, [ isSelected, floating?.y, threadId, sidebarRef, isExpandable ] );

	const onMouseEnter = () => {
		if ( blockClientId ) {
			debouncedToggleBlockHighlight( blockClientId, true );
		}
	};

	const onMouseLeave = () => {
		if ( blockClientId ) {
			debouncedToggleBlockHighlight( blockClientId, false );
		}
	};

	const onFocus = () => {
		if ( blockClientId ) {
			toggleBlockHighlight( blockClientId, true );
		}
	};

	const onSelectThread = () => {
		if ( isSelected ) {
			return;
		}
		if ( isExpandable ) {
			selectNote( primaryNote.id );
		}
		focusNoteThread( threadId, sidebarRef.current );
		if ( blockClientId ) {
			toggleBlockSpotlight( blockClientId, true );
			// Pass `null` as the second parameter to prevent focusing the block.
			selectBlock( blockClientId, null );
		}
	};

	const onDeselectThread = () => {
		if ( isExpandable ) {
			selectNote( undefined );
		}
		if ( blockClientId ) {
			toggleBlockSpotlight( blockClientId, false );
		}
	};

	const onBlur = ( event ) => {
		// Don't deselect threads when the browser window/tab loses focus.
		if ( ! document.hasFocus() ) {
			return;
		}

		const isThreadFocused = event.relatedTarget?.closest(
			'.editor-collab-sidebar-panel__thread'
		);
		const isDialogFocused =
			event.relatedTarget?.closest( '[role="dialog"]' );
		const isTabbing = isKeyboardTabbingRef.current;

		// When another thread is clicked, do nothing because the current
		// thread is automatically closed.
		if ( isThreadFocused && ! isTabbing ) {
			return;
		}
		// When deleting a note, a dialog appears, but the thread should not
		// be collapsed.
		if ( isDialogFocused ) {
			return;
		}
		// When tabbing, do nothing if the focus is within the current thread.
		if (
			isTabbing &&
			event.currentTarget.contains( event.relatedTarget )
		) {
			return;
		}

		// Close on focus loss otherwise.
		if ( blockClientId ) {
			toggleBlockHighlight( blockClientId, false );
		}
		onDeselectThread();
	};

	const handleResolve = () => {
		if ( ! primaryNote ) {
			return;
		}
		onEditNote( { id: primaryNote.id, status: 'approved' } );
		onDeselectThread();
		if ( isFloating ) {
			relatedBlockElement?.focus();
		} else {
			focusNoteThread( threadId, sidebarRef.current );
		}
	};

	// 'new' note placeholder in floating mode: render AddNote directly as
	// its own floating element. Preserves existing behavior; the AddNote
	// component has its own card chrome.
	if (
		isFloating &&
		annotations.length === 1 &&
		annotations[ 0 ].kind === 'note' &&
		annotations[ 0 ].id === 'new'
	) {
		return (
			<AddNote
				onSubmit={ onAddReply }
				sidebarRef={ sidebarRef }
				floating={ { y: floating.y, ref: floatingRef } }
			/>
		);
	}

	const ariaLabel = ( () => {
		if ( primaryNote ) {
			const excerpt = getNoteExcerpt(
				stripHTML( primaryNote.content?.rendered || '' ),
				10
			);
			return blockClientId
				? /* translators: %s: note excerpt */
				  sprintf( __( 'Note: %s' ), excerpt )
				: /* translators: %s: note excerpt */
				  sprintf( __( 'Original block deleted. Note: %s' ), excerpt );
		}
		// Lint-only thread (or other non-note kinds).
		return __( 'Annotations for this block.' );
	} )();

	return (
		<FloatingContainer
			floating={
				isFloating ? { y: floating.y, ref: floatingRef } : undefined
			}
			className={ clsx( 'editor-collab-sidebar-panel__thread', {
				'is-selected': isSelected,
			} ) }
			id={ `note-thread-${ threadId }` }
			gap="md"
			onClick={ onSelectThread }
			onMouseEnter={ onMouseEnter }
			onMouseLeave={ onMouseLeave }
			onFocus={ onFocus }
			onBlur={ onBlur }
			onKeyUp={ ( event ) => {
				if ( event.key === 'Tab' ) {
					isKeyboardTabbingRef.current = false;
				}
			} }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Tab' ) {
					isKeyboardTabbingRef.current = true;
				} else {
					onKeyDown( event );
				}
			} }
			tabIndex={ 0 }
			role="treeitem"
			aria-label={ ariaLabel }
			aria-expanded={ isExpandable ? isSelected : undefined }
		>
			{ isExpandable && (
				<Button
					className="editor-collab-sidebar-panel__skip-to-note"
					variant="secondary"
					size="compact"
					onClick={ () => {
						focusNoteThread(
							primaryNote.id,
							sidebarRef.current,
							'textarea'
						);
					} }
				>
					{ __( 'Add new reply' ) }
				</Button>
			) }
			{ ! blockClientId && (
				<p className="editor-collab-sidebar-panel__deleted-block-notice">
					{ __( 'Original block deleted.' ) }
				</p>
			) }
			{ annotations.map( ( annotation ) => {
				switch ( annotation.kind ) {
					case 'note':
						return (
							<NoteContent
								key={ annotation.id }
								note={ annotation.note }
								isSelected={ isSelected }
								onAddReply={ onAddReply }
								onEditNote={ onEditNote }
								onDeleteNote={ onDeleteNote }
								onSelectThread={ onSelectThread }
								onDeselectThread={ onDeselectThread }
								onResolve={ handleResolve }
								sidebarRef={ sidebarRef }
							/>
						);
					case 'lint':
						return (
							<LintCard
								key={ annotation.id }
								item={ annotation }
							/>
						);
					default:
						return null;
				}
			} ) }
			{ !! blockClientId && (
				<Button
					className="editor-collab-sidebar-panel__skip-to-block"
					variant="secondary"
					size="compact"
					onClick={ ( event ) => {
						event.stopPropagation();
						relatedBlockElement?.focus();
					} }
				>
					{ __( 'Back to block' ) }
				</Button>
			) }
		</FloatingContainer>
	);
}
