/**
 * Internal dependencies
 */
import reducer from '../reducer';

describe( 'reducer', () => {
	it( 'defaults to empty editing state', () => {
		expect( reducer( undefined, {} ) ).toEqual( {
			isEditingReusableBlock: {},
		} );
	} );

	it( 'ignores legacy actions', () => {
		const state = reducer( undefined, {} );

		expect(
			reducer( state, {
				type: 'SET_EDITING_REUSABLE_BLOCK',
				clientId: 1,
				isEditing: true,
			} )
		).toBe( state );
	} );
} );
