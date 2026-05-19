/**
 * Shared utilities for waveform audio player functionality.
 * Used by both the WaveformPlayer component (editor) and view.js (frontend).
 */

/**
 * External dependencies
 */
import { colord } from 'colord';
import WaveformPlayerLib from '@arraypress/waveform-player';

/**
 * Configuration constants.
 * Note: DEFAULT_WAVEFORM_HEIGHT should match $waveform-player-height in style.scss.
 */
const DEFAULT_WAVEFORM_HEIGHT = 100;
export const WAVEFORM_BUTTON_WIDTH = 100;

/**
 * Format a time in seconds to a "m:ss" string.
 *
 * @param {number} seconds - The time in seconds.
 * @return {string} The formatted time string.
 */
export function formatTime( seconds ) {
	const mins = Math.floor( seconds / 60 );
	const secs = Math.floor( seconds % 60 );
	return `${ mins }:${ String( secs ).padStart( 2, '0' ) }`;
}

/**
 * Get computed style for an element, using ownerDocument for iframe compatibility.
 *
 * @param {Element} element - The element to get styles from.
 * @return {CSSStyleDeclaration} The computed style.
 */
function getComputedStyle( element ) {
	return element.ownerDocument.defaultView.getComputedStyle( element );
}

/**
 * Get all colors needed for the waveform player based on the element's styles.
 *
 * @param {Element} element - The element to derive colors from.
 * @return {Object} Object containing textColor, waveformColor, progressColor.
 */
export function getWaveformColors( element ) {
	const textColor = getComputedStyle( element ).color;
	const waveformColor = colord( textColor ).alpha( 0.3 ).toRgbString();
	const progressColor = colord( textColor ).alpha( 0.6 ).toRgbString();

	return { textColor, waveformColor, progressColor };
}

/**
 * Create a waveform container element with the specified attributes.
 *
 * @param {Object} options               - The options for the container.
 * @param {string} options.url           - The audio URL.
 * @param {string} options.title         - The track title.
 * @param {string} options.artist        - The track artist.
 * @param {string} options.artwork       - The album artwork URL.
 * @param {string} options.waveformColor - The waveform bar color.
 * @param {string} options.progressColor - The progress indicator color.
 * @param {string} options.buttonColor   - The play button color.
 * @param {number} options.height        - The waveform height in pixels.
 * @param {string} options.waveformStyle - The visualization style (bars, mirror, line, blocks, dots, seekbar).
 * @return {Element} The configured container element.
 */
export function createWaveformContainer( {
	url,
	title,
	artist,
	artwork,
	waveformColor,
	progressColor,
	buttonColor,
	height = DEFAULT_WAVEFORM_HEIGHT,
	waveformStyle = 'bars',
} ) {
	const container = document.createElement( 'div' );
	container.setAttribute( 'data-waveform-player', '' );
	container.setAttribute( 'data-url', url );
	container.setAttribute( 'data-height', String( height ) );
	container.setAttribute( 'data-waveform-style', waveformStyle );
	container.setAttribute( 'data-waveform-color', waveformColor );
	container.setAttribute( 'data-progress-color', progressColor );
	container.setAttribute( 'data-button-color', buttonColor );
	container.setAttribute( 'data-text-color', buttonColor );
	container.setAttribute( 'data-text-secondary-color', buttonColor );
	if ( title ) {
		container.setAttribute( 'data-title', title );
	}
	if ( artist ) {
		container.setAttribute( 'data-subtitle', artist );
	}
	if ( artwork ) {
		container.setAttribute( 'data-artwork', artwork );
	}
	return container;
}

/**
 * Apply contrasting color to SVG icon paths for visibility.
 * The icons should contrast with the button background (which uses textColor).
 *
 * @param {Element} container   - The waveform container element.
 * @param {string}  buttonColor - The button background color (textColor).
 */
export function styleSvgIcons( container, buttonColor ) {
	// Compute a contrasting color for the icons based on button brightness.
	const isButtonDark = colord( buttonColor ).isDark();
	const iconColor = isButtonDark ? '#ffffff' : '#000000';

	const svgPaths = container.querySelectorAll( 'svg path' );
	svgPaths.forEach( ( path ) => {
		path.style.fill = iconColor;
	} );
}

/**
 * Set up play button accessibility: aria-label that toggles on play/pause.
 *
 * @param {Element} container    - The waveform container element.
 * @param {Object}  labels       - Button labels.
 * @param {string}  labels.play  - Label for the play state.
 * @param {string}  labels.pause - Label for the pause state.
 */
export function setupPlayButtonAccessibility(
	container,
	{ play: playLabel = 'Play', pause: pauseLabel = 'Pause' } = {}
) {
	const playBtn = container.querySelector( '.waveform-btn' );
	if ( ! playBtn ) {
		return;
	}

	playBtn.setAttribute( 'aria-label', playLabel );

	const onPlay = () => playBtn.setAttribute( 'aria-label', pauseLabel );
	const onPause = () => playBtn.setAttribute( 'aria-label', playLabel );

	container.addEventListener( 'waveformplayer:play', onPlay );
	container.addEventListener( 'waveformplayer:pause', onPause );
	container.addEventListener( 'waveformplayer:ended', onPause );

	return () => {
		container.removeEventListener( 'waveformplayer:play', onPlay );
		container.removeEventListener( 'waveformplayer:pause', onPause );
		container.removeEventListener( 'waveformplayer:ended', onPause );
	};
}

/**
 * Log play errors, filtering out expected AbortError.
 *
 * @param {Error} error - The error from play().
 */
export function logPlayError( error ) {
	// The browser throws AbortError when a play() promise is interrupted
	// by a subsequent pause() or a new audio source load (track change).
	// This is normal during rapid user interaction and safe to ignore.
	if ( error.name === 'AbortError' ) {
		return;
	}
	// eslint-disable-next-line no-console
	console.error( 'Playlist play error:', error );
}

/**
 * Compute a hover color by increasing the alpha channel.
 *
 * @param {string} color       - The original rgba color string.
 * @param {number} alphaBoost  - The amount to increase alpha by.
 * @return {string} The adjusted color as an rgba string.
 */
function getHoverColor( color, alphaBoost = 0.2 ) {
	const parsed = colord( color );
	if ( ! parsed.isValid() ) {
		return color;
	}
	const { r, g, b, a } = parsed.toRgb();
	const newAlpha = Math.min( a + alphaBoost, 1 );
	return colord( { r, g, b, a: newAlpha } ).toRgbString();
}

/**
 * Set up hover effect on the waveform bars area.
 * On mouseenter, increases bar color intensity; on mouseleave, restores.
 *
 * @param {Object}  instance       - The WaveformPlayer library instance.
 * @param {Element} container      - The waveform container element.
 * @param {string}  waveformColor  - The original waveform bar color.
 * @param {string}  progressColor  - The original progress bar color.
 * @return {Function} Cleanup function to remove listeners.
 */
function setupWaveformHover(
	instance,
	container,
	waveformColor,
	progressColor
) {
	const waveformArea = container.querySelector( '.waveform-container' );
	if ( ! waveformArea ) {
		return () => {};
	}

	const hoverWaveformColor = getHoverColor( waveformColor );
	const hoverProgressColor = getHoverColor( progressColor );

	const onMouseEnter = () => {
		instance.options.waveformColor = hoverWaveformColor;
		instance.options.progressColor = hoverProgressColor;
		instance.drawWaveform();
	};

	const onMouseLeave = () => {
		instance.options.waveformColor = waveformColor;
		instance.options.progressColor = progressColor;
		instance.drawWaveform();
	};

	waveformArea.addEventListener( 'mouseenter', onMouseEnter );
	waveformArea.addEventListener( 'mouseleave', onMouseLeave );

	return () => {
		waveformArea.removeEventListener( 'mouseenter', onMouseEnter );
		waveformArea.removeEventListener( 'mouseleave', onMouseLeave );
	};
}

// SVG paths for playlist control icons (24x24 viewBox).
const ICON_PREV =
	'M6 6h2v12H6zm3.5 6l8.5 6V6z';
const ICON_NEXT =
	'M6 18l8.5-6L6 6v12zm10-12v12h2V6z';
const ICON_SHUFFLE =
	'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z';

/**
 * Create an SVG icon element.
 *
 * @param {string} pathD - The SVG path d attribute.
 * @return {SVGElement} The SVG element.
 */
function createSvgIcon( pathD ) {
	const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
	svg.setAttribute( 'viewBox', '0 0 24 24' );
	svg.setAttribute( 'width', '16' );
	svg.setAttribute( 'height', '16' );
	svg.setAttribute( 'aria-hidden', 'true' );
	const path = document.createElementNS(
		'http://www.w3.org/2000/svg',
		'path'
	);
	path.setAttribute( 'fill', 'currentColor' );
	path.setAttribute( 'd', pathD );
	svg.appendChild( path );
	return svg;
}

/**
 * Create playlist control buttons (prev, shuffle, next) and insert them
 * into the waveform player container.
 *
 * @param {Element}  container       - The waveform player container.
 * @param {Object}   callbacks       - Button click callbacks.
 * @param {Function} callbacks.onPrev          - Called when previous is clicked.
 * @param {Function} callbacks.onNext          - Called when next is clicked.
 * @param {Function} callbacks.onShuffleToggle - Called when shuffle is toggled.
 * @param {boolean}  isShuffled      - Initial shuffle state.
 * @return {Object} Object with setShuffled function and cleanup function.
 */
function setupPlaylistControls(
	container,
	{ onPrev, onNext, onShuffleToggle },
	isShuffled = false
) {
	const controlsDiv = document.createElement( 'div' );
	controlsDiv.className = 'wp-block-playlist__controls';

	const prevBtn = document.createElement( 'button' );
	prevBtn.className = 'wp-block-playlist__control-btn';
	prevBtn.setAttribute( 'aria-label', 'Previous track' );
	prevBtn.appendChild( createSvgIcon( ICON_PREV ) );

	const shuffleBtn = document.createElement( 'button' );
	shuffleBtn.className = 'wp-block-playlist__control-btn';
	shuffleBtn.setAttribute( 'aria-label', 'Shuffle' );
	if ( isShuffled ) {
		shuffleBtn.classList.add( 'is-active' );
	}
	shuffleBtn.appendChild( createSvgIcon( ICON_SHUFFLE ) );

	const nextBtn = document.createElement( 'button' );
	nextBtn.className = 'wp-block-playlist__control-btn';
	nextBtn.setAttribute( 'aria-label', 'Next track' );
	nextBtn.appendChild( createSvgIcon( ICON_NEXT ) );

	controlsDiv.appendChild( prevBtn );
	controlsDiv.appendChild( shuffleBtn );
	controlsDiv.appendChild( nextBtn );

	const onPrevClick = () => onPrev?.();
	const onShuffleClick = () => {
		shuffleBtn.classList.toggle( 'is-active' );
		onShuffleToggle?.();
	};
	const onNextClick = () => onNext?.();

	prevBtn.addEventListener( 'click', onPrevClick );
	shuffleBtn.addEventListener( 'click', onShuffleClick );
	nextBtn.addEventListener( 'click', onNextClick );

	// Insert controls after the waveform track row.
	const waveformTrack = container.querySelector( '.waveform-track' );
	if ( waveformTrack ) {
		waveformTrack.after( controlsDiv );
	} else {
		container.appendChild( controlsDiv );
	}

	return {
		setShuffled: ( shuffled ) => {
			shuffleBtn.classList.toggle( 'is-active', shuffled );
		},
		cleanup: () => {
			prevBtn.removeEventListener( 'click', onPrevClick );
			shuffleBtn.removeEventListener( 'click', onShuffleClick );
			nextBtn.removeEventListener( 'click', onNextClick );
			controlsDiv.remove();
		},
	};
}

/**
 * Initialize a WaveformPlayer instance on an element.
 *
 * This is the shared core logic used by both the React component (editor)
 * and the Interactivity API (frontend).
 *
 * @param {Element}  element                    - The container element (must be in DOM).
 * @param {Object}   options                    - Configuration options.
 * @param {string}   options.src                - The audio file URL.
 * @param {string}   options.title              - The track title.
 * @param {string}   options.artist             - The artist name.
 * @param {string}   options.image              - The artwork image URL.
 * @param {boolean}  options.autoPlay           - Whether to auto-play when ready.
 * @param {Function} options.onEnded            - Callback when track ends.
 * @param {Object}   options.labels             - Translated button labels.
 * @param {string}   options.visualizationStyle - Waveform style (bars, mirror, line, blocks, dots, seekbar).
 * @param {Function} options.onPrev             - Callback for previous track.
 * @param {Function} options.onNext             - Callback for next track.
 * @param {Function} options.onShuffleToggle    - Callback for shuffle toggle.
 * @param {boolean}  options.isShuffled         - Initial shuffle state.
 * @return {Object} Object with instance, container, and destroy function.
 */
export function initWaveformPlayer(
	element,
	{
		src,
		title,
		artist,
		image,
		autoPlay,
		onEnded,
		labels,
		visualizationStyle,
		onPrev,
		onNext,
		onShuffleToggle,
		isShuffled,
	}
) {
	// Get colors from computed styles.
	const { textColor, waveformColor, progressColor } =
		getWaveformColors( element );

	// Create the waveform container.
	const container = createWaveformContainer( {
		url: src,
		title,
		artist,
		artwork: image,
		waveformColor,
		progressColor,
		buttonColor: textColor,
		waveformStyle: visualizationStyle,
	} );
	element.appendChild( container );

	// Initialize the WaveformPlayer library.
	const instance = new WaveformPlayerLib( container );

	// Set up event handlers.
	let cleanupAccessibility;
	let cleanupHover;
	let cleanupControls;
	const handlers = {
		ready: () => {
			styleSvgIcons( container, textColor );
			cleanupAccessibility = setupPlayButtonAccessibility(
				container,
				labels
			);
			cleanupHover = setupWaveformHover(
				instance,
				container,
				waveformColor,
				progressColor
			);

			// Set up playlist controls if callbacks are provided.
			if ( onPrev || onNext || onShuffleToggle ) {
				const controls = setupPlaylistControls(
					container,
					{ onPrev, onNext, onShuffleToggle },
					isShuffled
				);
				cleanupControls = controls.cleanup;
			}

			if ( autoPlay ) {
				instance.play()?.catch( logPlayError );
			}
		},
		ended: () => onEnded?.(),
	};

	container.addEventListener( 'waveformplayer:ready', handlers.ready );
	container.addEventListener( 'waveformplayer:ended', handlers.ended );

	// Return instance, container, and cleanup function.
	return {
		instance,
		container,
		destroy: () => {
			cleanupAccessibility?.();
			cleanupHover?.();
			cleanupControls?.();
			container.removeEventListener(
				'waveformplayer:ready',
				handlers.ready
			);
			container.removeEventListener(
				'waveformplayer:ended',
				handlers.ended
			);
			instance.destroy();
			container.remove();
		},
	};
}
