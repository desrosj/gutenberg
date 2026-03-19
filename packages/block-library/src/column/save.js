/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useInnerBlocksProps, useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const { verticalAlignment, style } = attributes;

	const wrapperClasses = clsx( {
		[ `is-vertically-aligned-${ verticalAlignment }` ]: verticalAlignment,
	} );

	let flexBasis;
	const width = style?.dimensions?.width;
	if ( width && /\d/.test( width ) ) {
		flexBasis = width;
		// In some cases we need to round the width to a shorter float.
		if ( width?.endsWith( '%' ) ) {
			const multiplier = 1000000000000;
			// Shrink the number back to a reasonable float.
			flexBasis =
				Math.round( Number.parseFloat( width ) * multiplier ) /
					multiplier +
				'%';
		}
	}

	const blockProps = useBlockProps.save( {
		className: wrapperClasses,
		style: flexBasis ? { flexBasis } : undefined,
	} );
	const innerBlocksProps = useInnerBlocksProps.save( blockProps );

	return <div { ...innerBlocksProps } />;
}
