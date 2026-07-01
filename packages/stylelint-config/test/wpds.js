/**
 * Internal dependencies
 */
const utils = require( './utils' );
const getStylelintResult = utils.getStylelintResult;

describe( 'flags design token fallback values', () => {
	let result;

	beforeEach( () => {
		result = getStylelintResult( './wpds-invalid.css' );
	} );

	it( 'did error', () => {
		return result.then( ( data ) => expect( data.errored ).toBeTruthy() );
	} );

	it( 'flags correct number of warnings', () => {
		return result.then( ( data ) =>
			expect( data.results[ 0 ].warnings ).toHaveLength( 1 )
		);
	} );

	it( 'snapshot matches warnings', () => {
		return result.then( ( data ) =>
			expect( data.results[ 0 ].warnings ).toMatchSnapshot()
		);
	} );
} );
