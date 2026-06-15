/**
 * Internal dependencies
 */
import {
	__experimentalConvertBlockToStatic,
	__experimentalConvertBlocksToReusable,
	__experimentalDeleteReusableBlock,
	__experimentalSetEditingReusableBlock,
} from '../actions';

describe( 'Actions', () => {
	it( '__experimentalSetEditingReusableBlock returns an action object', () => {
		expect( __experimentalSetEditingReusableBlock( 3, true ) ).toEqual( {
			type: 'SET_EDITING_REUSABLE_BLOCK',
			clientId: 3,
			isEditing: true,
		} );
	} );

	it( 'thunk action creators are no-ops that do not throw', async () => {
		expect( () =>
			__experimentalConvertBlockToStatic( 'client-id' )()
		).not.toThrow();
		await expect(
			__experimentalConvertBlocksToReusable( [ 'client-id' ] )()
		).resolves.toBeUndefined();
		await expect(
			__experimentalDeleteReusableBlock( 1 )()
		).resolves.toBeUndefined();
	} );
} );
