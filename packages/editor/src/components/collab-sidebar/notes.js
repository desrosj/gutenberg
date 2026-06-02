/**
 * WordPress dependencies
 */
import { useEffect, useMemo, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { Stack } from '@wordpress/ui';
import {
	store as blockEditorStore,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { NoteThread } from './note-thread';
import {
	focusNoteThread,
	getNoteIdsFromMetadata,
	pickPrimaryNote,
} from './utils';
import { useFloatingBoard, useNoteActions } from './hooks';
import { AddNote } from './add-note';
import { store as editorStore } from '../../store';
import { useNoteItems } from '../document-annotations';

const { useBlockElement } = unlock( blockEditorPrivateApis );

// Builds the list of threads to render in the panel by grouping annotation
// items by block. Each block-with-annotations becomes one thread containing
// an ordered list of its annotations (notes first, then lints).
//
// Orphan notes (those whose block was deleted) remain per-note threads at
// the end. A pending 'new' note in floating mode is appended as its own
// thread for the selected block — the existing AddNote shortcut still
// applies.
function buildThreads( {
	noteItems,
	lintItems,
	orderedBlockIds,
	isFloating,
	selectedNote,
	selectedBlockClientId,
} ) {
	const noteItemsByBlock = new Map();
	const orphanNoteItems = [];
	for ( const noteItem of noteItems ) {
		if ( noteItem.blockClientId ) {
			if ( ! noteItemsByBlock.has( noteItem.blockClientId ) ) {
				noteItemsByBlock.set( noteItem.blockClientId, [] );
			}
			noteItemsByBlock.get( noteItem.blockClientId ).push( noteItem );
		} else {
			orphanNoteItems.push( noteItem );
		}
	}

	const lintItemsByBlock = new Map();
	for ( const lintItem of lintItems ) {
		if ( ! lintItemsByBlock.has( lintItem.blockClientId ) ) {
			lintItemsByBlock.set( lintItem.blockClientId, [] );
		}
		lintItemsByBlock.get( lintItem.blockClientId ).push( lintItem );
	}

	const threads = [];
	for ( const blockId of orderedBlockIds ) {
		const blockNotes = noteItemsByBlock.get( blockId ) || [];
		const blockLints = lintItemsByBlock.get( blockId ) || [];
		const annotations = [ ...blockNotes, ...blockLints ];
		if ( annotations.length === 0 ) {
			continue;
		}
		const primaryNote = annotations.find(
			( a ) => a.kind === 'note' && a.id !== 'new'
		);
		threads.push( {
			id: primaryNote ? primaryNote.id : `lint-thread:${ blockId }`,
			blockClientId: blockId,
			annotations,
		} );
	}

	// Orphans (notes whose block was deleted): one thread per note, appended.
	for ( const orphan of orphanNoteItems ) {
		threads.push( {
			id: orphan.id,
			blockClientId: null,
			annotations: [ orphan ],
		} );
	}

	// Pending 'new' note placeholder in floating mode: appended as its own
	// thread. The NoteThread shell short-circuits to render AddNote directly
	// for this case.
	if ( isFloating && selectedNote === 'new' && selectedBlockClientId ) {
		threads.push( {
			id: 'new',
			blockClientId: selectedBlockClientId,
			annotations: [
				{
					kind: 'note',
					id: 'new',
					blockClientId: selectedBlockClientId,
					note: {
						id: 'new',
						blockClientId: selectedBlockClientId,
						content: { rendered: '' },
					},
				},
			],
		} );
	}

	return threads;
}

export function Notes( {
	notes,
	lintItems = [],
	sidebarRef,
	isFloating = false,
	styles,
} ) {
	const {
		onCreate: onAddReply,
		onEdit: onEditNote,
		onDelete,
	} = useNoteActions();
	const { selectNote } = unlock( useDispatch( editorStore ) );
	const { selectBlock, toggleBlockSpotlight } = unlock(
		useDispatch( blockEditorStore )
	);

	const { noteId, selectedBlockClientId, orderedBlockIds } = useSelect(
		( select ) => {
			const {
				getBlockAttributes,
				getSelectedBlockClientId,
				getClientIdsWithDescendants,
			} = select( blockEditorStore );
			const clientId = getSelectedBlockClientId();
			return {
				noteId: clientId
					? getBlockAttributes( clientId )?.metadata?.noteId
					: null,
				selectedBlockClientId: clientId,
				orderedBlockIds: getClientIdsWithDescendants(),
			};
		},
		[]
	);
	const { selectedNote, noteFocused } = useSelect( ( select ) => {
		const { getSelectedNote, isNoteFocused } = unlock(
			select( editorStore )
		);
		return {
			selectedNote: getSelectedNote(),
			noteFocused: isNoteFocused(),
		};
	}, [] );

	const relatedBlockElement = useBlockElement( selectedBlockClientId );

	const noteItems = useNoteItems( notes );

	const threads = useMemo(
		() =>
			buildThreads( {
				noteItems,
				lintItems,
				orderedBlockIds,
				isFloating,
				selectedNote,
				selectedBlockClientId,
			} ),
		[
			noteItems,
			lintItems,
			orderedBlockIds,
			isFloating,
			selectedNote,
			selectedBlockClientId,
		]
	);

	// Convenience: thread index by primary-note id, so we can find a thread
	// after deleting a note.
	const findThreadIndexByNoteId = ( noteRecordId ) =>
		threads.findIndex( ( t ) =>
			t.annotations.some(
				( a ) => a.kind === 'note' && a.id === noteRecordId
			)
		);

	const handleDelete = async ( note ) => {
		const currentIndex = findThreadIndexByNoteId( note.id );
		const nextThread = threads[ currentIndex + 1 ];
		const prevThread = threads[ currentIndex - 1 ];

		await onDelete( note );

		if ( note.parent !== 0 ) {
			// Move focus to the parent thread when a reply was deleted.
			selectNote( note.parent );
			focusNoteThread( note.parent, sidebarRef.current );
			return;
		}

		const adjacentThread = nextThread ?? prevThread;
		if ( adjacentThread ) {
			const adjacentPrimary = adjacentThread.annotations.find(
				( a ) => a.kind === 'note' && a.id !== 'new'
			);
			if ( adjacentPrimary ) {
				selectNote( adjacentPrimary.id );
			}
			focusNoteThread( adjacentThread.id, sidebarRef.current );
			if ( adjacentThread.blockClientId ) {
				toggleBlockSpotlight( adjacentThread.blockClientId, true );
				// Pass `null` as the second parameter to prevent focusing the block.
				selectBlock( adjacentThread.blockClientId, null );
			}
		} else {
			selectNote( undefined );
			toggleBlockSpotlight( note.blockClientId, false );
			// Move focus to the related block.
			relatedBlockElement?.focus();
		}
	};

	// Pick the most relevant thread for the selected block. Derived outside
	// the effect so the effect body stays minimal.
	const targetNoteId = useMemo( () => {
		const blockNoteIds = getNoteIdsFromMetadata( { noteId } );
		const blockThreads = notes.filter( ( t ) =>
			blockNoteIds.includes( t.id )
		);
		return pickPrimaryNote( blockThreads )?.id;
	}, [ noteId, notes ] );

	// Sync the selected note to the new block's primary thread when the
	// block context changes. The ref tracks the previous block id so the
	// effect only fires on block transitions, leaving in-block note changes
	// (Escape, Cancel, "new" form) alone.
	const prevBlockIdRef = useRef( selectedBlockClientId );
	useEffect( () => {
		if ( prevBlockIdRef.current === selectedBlockClientId ) {
			return;
		}
		prevBlockIdRef.current = selectedBlockClientId;
		selectNote( targetNoteId );
	}, [ selectedBlockClientId, targetNoteId, selectNote ] );

	// Focus the selected note when requested.
	useEffect( () => {
		if ( noteFocused && selectedNote ) {
			focusNoteThread(
				selectedNote,
				sidebarRef.current,
				selectedNote === 'new' ? 'textarea' : undefined
			);
			// Clear focus flag to avoid re-triggering.
			selectNote( selectedNote );
		}
	}, [ noteFocused, selectedNote, selectNote, sidebarRef ] );

	const { notePositions, registerThread, unregisterThread } =
		useFloatingBoard( {
			threads,
			selectedNoteId: selectedNote,
			isFloating,
			sidebarRef,
		} );

	const hasThreads = threads.length > 0;

	const isThreadSelected = ( thread ) => {
		const primary = thread.annotations.find(
			( a ) => a.kind === 'note' && a.id !== 'new'
		);
		if ( primary ) {
			return selectedNote === primary.id;
		}
		// Lint-only threads: visually "active" when their block is selected.
		return (
			!! thread.blockClientId &&
			thread.blockClientId === selectedBlockClientId
		);
	};

	const navigate = ( event, thread, isSelected ) => {
		if ( event.defaultPrevented ) {
			return;
		}

		const currentIndex = threads.findIndex( ( t ) => t.id === thread.id );
		const isSelfTarget = event.currentTarget === event.target;

		// Arrow / Home / End navigation is uniform across thread kinds.
		if (
			event.key === 'ArrowDown' &&
			currentIndex < threads.length - 1 &&
			isSelfTarget
		) {
			focusNoteThread(
				threads[ currentIndex + 1 ].id,
				sidebarRef.current
			);
			return;
		}
		if ( event.key === 'ArrowUp' && currentIndex > 0 && isSelfTarget ) {
			focusNoteThread(
				threads[ currentIndex - 1 ].id,
				sidebarRef.current
			);
			return;
		}
		if ( event.key === 'Home' && isSelfTarget ) {
			focusNoteThread( threads[ 0 ].id, sidebarRef.current );
			return;
		}
		if ( event.key === 'End' && isSelfTarget ) {
			focusNoteThread(
				threads[ threads.length - 1 ].id,
				sidebarRef.current
			);
			return;
		}

		const primaryNote = thread.annotations.find(
			( a ) => a.kind === 'note' && a.id !== 'new'
		);
		const isExpandable = !! primaryNote;

		if ( ! isExpandable ) {
			// Lint-only thread: Enter / ArrowRight selects the block;
			// Escape clears spotlight.
			if (
				( event.key === 'Enter' || event.key === 'ArrowRight' ) &&
				isSelfTarget &&
				thread.blockClientId
			) {
				selectBlock( thread.blockClientId, null );
				toggleBlockSpotlight( thread.blockClientId, true );
			} else if ( event.key === 'Escape' && thread.blockClientId ) {
				toggleBlockSpotlight( thread.blockClientId, false );
			}
			return;
		}

		// Expandable thread: expand/collapse via selectedNote state.
		if (
			( event.key === 'Enter' || event.key === 'ArrowRight' ) &&
			isSelfTarget &&
			! isSelected
		) {
			selectNote( primaryNote.id );
			if ( !! thread.blockClientId ) {
				// Pass `null` as the second parameter to prevent focusing the block.
				selectBlock( thread.blockClientId, null );
				toggleBlockSpotlight( thread.blockClientId, true );
			}
		} else if (
			( ( event.key === 'Enter' || event.key === 'ArrowLeft' ) &&
				isSelfTarget &&
				isSelected ) ||
			event.key === 'Escape'
		) {
			selectNote( undefined );
			if ( thread.blockClientId ) {
				toggleBlockSpotlight( thread.blockClientId, false );
			}
			focusNoteThread( thread.id, sidebarRef.current );
		}
	};

	return (
		<Stack
			className="editor-collab-sidebar-panel"
			style={ styles }
			role="tree"
			direction="column"
			gap="md"
			justify="flex-start"
			ref={ ( node ) => {
				// Sometimes previous sidebar unmounts after the new one mounts.
				// This ensures we always have the latest reference.
				if ( node ) {
					sidebarRef.current = node;
				}
			} }
			aria-label={
				isFloating ? __( 'Unresolved notes' ) : __( 'All notes' )
			}
		>
			{ ! hasThreads && ! isFloating ? (
				<AddNote onSubmit={ onAddReply } sidebarRef={ sidebarRef } />
			) : (
				<>
					{ ! isFloating && selectedNote === 'new' && (
						<AddNote
							onSubmit={ onAddReply }
							sidebarRef={ sidebarRef }
						/>
					) }
					{ threads.map( ( thread ) => (
						<NoteThread
							key={ thread.id }
							thread={ thread }
							onAddReply={ onAddReply }
							onDeleteNote={ handleDelete }
							onEditNote={ onEditNote }
							isSelected={ isThreadSelected( thread ) }
							sidebarRef={ sidebarRef }
							floating={
								isFloating
									? {
											y: notePositions[ thread.id ],
											registerThread,
											unregisterThread,
									  }
									: undefined
							}
							onKeyDown={ ( event ) =>
								navigate(
									event,
									thread,
									isThreadSelected( thread )
								)
							}
						/>
					) ) }
				</>
			) }
		</Stack>
	);
}
