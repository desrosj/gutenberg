/**
 * Splits the TypeScript project graph into batches that can be built by
 * separate `tsc --build` processes.
 *
 * A single `tsc --build` of every project keeps the parsed sources of all
 * projects in memory, which can exceed the memory available on runners with
 * fewer resources. Building in dependency order across separate processes
 * caps the peak at the size of the largest batch: each process reads the
 * declaration files emitted by earlier batches instead of their sources.
 */

/**
 * External dependencies
 */
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

/**
 * Removes comments and trailing commas from a JSONC string, leaving string
 * literals untouched.
 *
 * @param {string} text JSONC source.
 * @return {string} JSON source.
 */
function stripJsonComments( text ) {
	let result = '';
	let inString = false;
	for ( let i = 0; i < text.length; i++ ) {
		const char = text[ i ];
		const next = text[ i + 1 ];
		if ( inString ) {
			result += char;
			if ( char === '\\' ) {
				result += next;
				i++;
			} else if ( char === '"' ) {
				inString = false;
			}
		} else if ( char === '"' ) {
			inString = true;
			result += char;
		} else if ( char === '/' && next === '/' ) {
			while ( i < text.length && text[ i ] !== '\n' ) {
				i++;
			}
			result += '\n';
		} else if ( char === '/' && next === '*' ) {
			i += 2;
			while (
				i < text.length &&
				! ( text[ i ] === '*' && text[ i + 1 ] === '/' )
			) {
				i++;
			}
			i++;
		} else {
			result += char;
		}
	}
	return result.replace( /,(\s*[}\]])/g, '$1' );
}

/**
 * Resolves a project reference path to its tsconfig file.
 *
 * @param {string} fromDir       Directory of the referencing tsconfig.
 * @param {string} referencePath Path from the `references` entry.
 * @return {string} Absolute path to the referenced tsconfig file.
 */
function resolveReference( fromDir, referencePath ) {
	const resolved = path.resolve( fromDir, referencePath );
	if ( existsSync( resolved ) && statSync( resolved ).isDirectory() ) {
		return path.join( resolved, 'tsconfig.json' );
	}
	return resolved;
}

/**
 * Reads the project references of a tsconfig file.
 *
 * @param {string} configPath Absolute path to a tsconfig file.
 * @return {string[]} Absolute paths of the referenced tsconfig files.
 */
function readReferences( configPath ) {
	const config = JSON.parse(
		stripJsonComments( readFileSync( configPath, 'utf8' ) )
	);
	return ( config.references || [] ).map( ( { path: referencePath } ) =>
		resolveReference( path.dirname( configPath ), referencePath )
	);
}

/**
 * Groups every project reachable from the root tsconfig into batches.
 *
 * Projects are grouped by dependency depth, so each batch only depends on
 * projects in earlier batches. Each depth level is then split into batches of
 * at most `batchSize` projects.
 *
 * @param {string} rootDir   Repository root.
 * @param {number} batchSize Maximum number of projects per batch.
 * @return {string[][]} Batches of tsconfig paths, relative to `rootDir`.
 */
export function getTypeScriptBuildBatches( rootDir, batchSize ) {
	const depths = new Map();
	const visiting = new Set();

	function getDepth( configPath ) {
		if ( depths.has( configPath ) ) {
			return depths.get( configPath );
		}
		if ( visiting.has( configPath ) ) {
			throw new Error( `Circular project reference: ${ configPath }` );
		}
		visiting.add( configPath );
		const depth =
			Math.max( -1, ...readReferences( configPath ).map( getDepth ) ) + 1;
		visiting.delete( configPath );
		depths.set( configPath, depth );
		return depth;
	}

	readReferences( path.join( rootDir, 'tsconfig.json' ) ).forEach( getDepth );

	const levels = [];
	for ( const [ configPath, depth ] of depths ) {
		( levels[ depth ] ??= [] ).push( path.relative( rootDir, configPath ) );
	}

	const batches = [];
	for ( const level of levels.filter( Boolean ) ) {
		level.sort();
		for ( let i = 0; i < level.length; i += batchSize ) {
			batches.push( level.slice( i, i + batchSize ) );
		}
	}
	return batches;
}
