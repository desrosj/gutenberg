/**
 * Converts editor's block type.
 *
 * @param {string} name Block name.
 */
export async function convertBlock( name ) {
	const shot = async ( label ) => {
		const dir = '/home/runner/diag';
		require( 'fs' ).mkdirSync( dir, { recursive: true } );
		await page.screenshot( { path: `${ dir }/${ Date.now() }-${ name }-${ label }.png` } );
	};
	const describe = async ( selector ) => page.evaluate( ( sel ) => {
		return Array.from( document.querySelectorAll( sel ) ).map( ( el ) => {
			const r = el.getBoundingClientRect();
			return { rect: [ r.x, r.y, r.width, r.height ].map( Math.round ), visible: !! ( el.offsetWidth || el.offsetHeight ), parent: el.closest( '.components-popover, .editor-inserter__menu, .editor-block-switcher__popover' ) && el.closest( '.components-popover, .editor-inserter__menu, .editor-block-switcher__popover' ).className };
		} );
	}, selector );
	await page.mouse.move( 200, 300, { steps: 10 } );
	await page.mouse.move( 250, 350, { steps: 10 } );
	console.log( 'DIAG toggle', JSON.stringify( await describe( '.editor-block-switcher__toggle' ) ) );
	await shot( '1-before-toggle' );
	await page.click( '.editor-block-switcher__toggle' );
	await shot( '2-after-toggle' );
	const item = `.editor-block-types-list__item[aria-label="${ name }"]`;
	console.log( 'DIAG items', JSON.stringify( await describe( item ) ) );
	console.log( 'DIAG at-point', await page.evaluate( ( sel ) => {
		const el = document.querySelector( sel );
		if ( ! el ) {
			return 'no element';
		}
		const r = el.getBoundingClientRect();
		const hit = document.elementFromPoint( r.x + ( r.width / 2 ), r.y + ( r.height / 2 ) );
		return hit ? hit.outerHTML.slice( 0, 200 ) : 'nothing';
	}, item ) );
	await page.click( item );
	await shot( '3-after-item' );
	console.log( 'DIAG blocks', JSON.stringify( await page.evaluate( () => wp.data.select( 'core/editor' ).getBlocks().map( ( b ) => b.name ) ) ) );
}
