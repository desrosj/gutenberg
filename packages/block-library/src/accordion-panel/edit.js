/**
 * WordPress dependencies
 */
import {
	useBlockProps,
	useInnerBlocksProps,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';

export default function Edit( { attributes, clientId } ) {
	const { allowedBlocks, templateLock, openByDefault } = attributes;

	const isParentSelected = useSelect(
		( select ) => {
			const {
				getBlockParentsByBlockName,
				isBlockSelected,
				hasSelectedInnerBlock,
			} = select( blockEditorStore );

			const parentAccordionItemIds = getBlockParentsByBlockName(
				clientId,
				'core/accordion-item'
			);

			if ( ! parentAccordionItemIds.length ) {
				return false;
			}
			const parentClientId = parentAccordionItemIds[ 0 ];
			return (
				isBlockSelected( parentClientId ) ||
				hasSelectedInnerBlock( parentClientId, true )
			);
		},
		[ clientId ]
	);

	const blockProps = useBlockProps( {
		'aria-hidden': ! isParentSelected && ! openByDefault,
		role: 'region',
	} );

	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		allowedBlocks,
		template: [ [ 'core/paragraph', {} ] ],
		templateLock,
	} );

	return <div { ...innerBlocksProps } />;
}
