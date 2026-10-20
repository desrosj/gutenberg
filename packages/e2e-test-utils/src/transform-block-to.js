/**
 * Converts editor's block type.
 *
 * @param {string} name Block name.
 */
export async function transformBlockTo( name ) {
	await page.mouse.move( 0, 0 );
	await page.mouse.move( 10, 10 );
	const switcherToggle = await page.waitForSelector(
		'.block-editor-block-switcher__toggle'
	);
	await switcherToggle.evaluate( ( element ) => element.scrollIntoView() );
	await page.waitForSelector( '.block-editor-block-switcher__toggle', {
		visible: true,
	} );
	await switcherToggle.click();
	await page.waitForSelector( '.block-editor-block-switcher__container', {
		visible: true,
	} );

	// Find the block button option within the switcher popover.
	const xpath = `//*[contains(@class, "block-editor-block-switcher__popover")]//button[.='${ name }']`;
	const insertButton = await page.waitForXPath( xpath, { visible: true } );
	// Clicks may fail if the button is out of view. Assure it is before click.
	await insertButton.evaluate( ( element ) => element.scrollIntoView() );
	console.log( 'DIAG', JSON.stringify( await page.evaluate( ( n ) => {
		const x = ( q ) => { const r = document.evaluate( q, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null ); const out = []; for ( let i = 0; i < r.snapshotLength; i++ ) { const el = r.snapshotItem( i ); const b = el.getBoundingClientRect(); out.push( { html: el.outerHTML.slice( 0, 160 ), rect: [ b.x, b.y, b.width, b.height ].map( Math.round ), popover: !! el.closest( '.block-editor-block-switcher__popover' ) } ); } return out; };
		return { doc: x( `//button[.='${ n }']` ), scoped: x( `//*[contains(@class, "block-editor-block-switcher__popover")]//button[.='${ n }']` ), selected: window.wp.data.select( 'core/block-editor' ).getSelectedBlockClientIds().length };
	}, name ) ) );
	await insertButton.click();
	await page.waitFor( 500 );
	console.log( 'DIAG after', JSON.stringify( await page.evaluate( () => window.wp.data.select( 'core/block-editor' ).getBlocks().map( ( b ) => b.name + ':' + ( b.attributes.className || '' ) ) ) ) );

	// Wait for the transformed block to appear.
	const BLOCK_SELECTOR = '.block-editor-block-list__block';
	const BLOCK_NAME_SELECTOR = `[aria-label="Block: ${ name }"]`;
	await page.waitForSelector( `${ BLOCK_SELECTOR }${ BLOCK_NAME_SELECTOR }` );
}
