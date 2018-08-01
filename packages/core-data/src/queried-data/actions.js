/**
 * External dependencies
 */
import { castArray } from 'lodash';

/**
 * Returns an action object used in signalling that items have been received.
 *
 * @param {Array} items Items received.
 *
 * @return {Object} Action object.
 */
export function receiveItems( items ) {
	return {
		type: 'RECEIVE_ITEMS',
		items: castArray( items ),
	};
}

/**
 * Returns an action object used in signalling that queried data has been
 * received.
 *
 * @param {?Object} query Optional query object.
 * @param {Array}   items Queried items received.
 *
 * @return {Object} Action object.
 */
export function receiveQueriedItems( query = {}, items ) {
	return {
		...receiveItems( items ),
		query,
	};
}
