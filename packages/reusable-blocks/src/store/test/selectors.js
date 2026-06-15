/**
 * Internal dependencies
 */
import { __experimentalIsEditingReusableBlock } from '../selectors';

describe( '__experimentalIsEditingReusableBlock', () => {
	it( 'returns false', () => {
		expect( __experimentalIsEditingReusableBlock( {}, 1 ) ).toBe( false );
	} );
} );
