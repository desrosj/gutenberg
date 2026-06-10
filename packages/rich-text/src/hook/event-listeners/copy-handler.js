/**
 * WordPress dependencies
 */
import { privateApis as composePrivateApis } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { toHTMLString } from '../../to-html-string';
import { isCollapsed } from '../../is-collapsed';
import { slice } from '../../slice';
import { remove } from '../../remove';
import { getTextContent } from '../../get-text-content';
import { ownsSelection } from '../../owns-selection';
import { unlock } from '../../lock-unlock';

const { subscribeDelegatedListener } = unlock( composePrivateApis );

export default ( props ) => ( element ) => {
	function onCopy( event ) {
		const { record } = props.current;
		const { ownerDocument } = element;
		if (
			isCollapsed( record.current ) ||
			( ! element.contains( ownerDocument.activeElement ) &&
				! ownsSelection( element ) )
		) {
			return;
		}

		const selectedRecord = slice( record.current );
		const plainText = getTextContent( selectedRecord );
		const html = toHTMLString( { value: selectedRecord } );
		event.clipboardData.setData( 'text/plain', plainText );
		event.clipboardData.setData( 'text/html', html );
		event.clipboardData.setData( 'rich-text', 'true' );
		event.preventDefault();

		if ( event.type === 'cut' ) {
			if ( ownerDocument.activeElement === element ) {
				ownerDocument.execCommand( 'delete' );
			} else {
				// `execCommand( 'delete' )` is not reliable when the element
				// doesn't hold focus itself (a focused editing host owns the
				// selection): it may remove the element entirely. Remove the
				// selected content through the record instead.
				const { handleChange } = props.current;
				handleChange( remove( record.current ) );
			}
		}
	}

	const { defaultView } = element.ownerDocument;
	const unsubscribeCopy = subscribeDelegatedListener(
		defaultView,
		'copy',
		onCopy
	);
	const unsubscribeCut = subscribeDelegatedListener(
		defaultView,
		'cut',
		onCopy
	);
	return () => {
		unsubscribeCopy();
		unsubscribeCut();
	};
};
