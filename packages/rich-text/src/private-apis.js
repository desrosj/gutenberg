/**
 * Internal dependencies
 */
import { lock } from './lock-unlock';
import { useRichText } from './hook';
import { ownsSelection } from './owns-selection';
import { subscribeOwnedListener } from './subscribe-owned-listener';

/**
 * Private @wordpress/rich-text APIs.
 */
export const privateApis = {};
lock( privateApis, {
	useRichText,
	ownsSelection,
	subscribeOwnedListener,
} );
