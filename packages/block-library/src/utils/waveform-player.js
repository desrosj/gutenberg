/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';
import { useEvent, useRefEffect } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { initWaveformPlayer } from './waveform-utils';

const EMPTY_ARTIST_PLACEHOLDER = '\u00a0';

/**
 * A reusable WaveformPlayer component for the block editor.
 *
 * Renders an audio waveform visualization with play/pause controls.
 * Automatically inherits colors from the parent block's text color.
 *
 * @param {Object}   props               - Component props.
 * @param {string}   props.src           - The audio file URL.
 * @param {string}   props.title         - The track title.
 * @param {string}   props.artist        - The artist name.
 * @param {string}   props.image         - The artwork image URL.
 * @param {string}   props.waveformStyle - Waveform style (bars, mirror, line, blocks, dots, seekbar).
 * @param {Function} props.onEnded       - Callback when the track finishes playing.
 * @return {Element} The WaveformPlayer element.
 */
export function WaveformPlayer( {
	src,
	title,
	artist,
	image,
	waveformStyle,
	onEnded,
} ) {
	// Store onEnded in a stable callback so it doesn't need to be a useRefEffect dependency.
	// The callback changes reference on every render (its dependency chain
	// includes an unstable array), which would cause useRefEffect to destroy
	// and recreate the entire player on every re-render, making it disappear
	// during editor resizes.
	const onEndedEvent = useEvent( onEnded );

	const playerRef = useRef();

	// Due to how WaveformPlayer is implemented, the artwork element within the
	// player element only exists when an image was present when the player was
	// created. Recreate the player when one is added or removed so that
	// element is created or torn down.
	const hasImage = !! image;

	// WaveformPlayer needs an audio source on init, but the source may change
	// throughout its lifetime.
	const hasSrc = !! src;

	const ref = useRefEffect(
		( element ) => {
			if ( ! hasSrc ) {
				return;
			}

			let cancelled = false;
			let playerDestroy;

			function init() {
				if ( cancelled ) {
					return;
				}
				const player = initWaveformPlayer( element, {
					src,
					title,
					artist: artist || EMPTY_ARTIST_PLACEHOLDER,
					image,
					waveformStyle,
					onEnded: () => onEndedEvent?.(),
				} );
				playerRef.current = player;
				const { destroy } = player;
				playerDestroy = destroy;
			}

			// Defer initialization so the element inherits the correct
			// text color, which is used to derive waveform colors. In the
			// editor iframe, theme styles (CSS custom properties) are
			// injected dynamically, so getComputedStyle may return the
			// default black on first render.
			// Using a requestAnimationFrame loop isn't sufficient to solve the issue.
			// TODO - find a better option than a setTimeout, so we're not relying on an arbitrary number.
			const timeoutId = setTimeout( init, 100 );

			return () => {
				cancelled = true;
				clearTimeout( timeoutId );
				playerRef.current = undefined;
				playerDestroy?.();
			};
		},
		[ onEndedEvent, hasSrc, waveformStyle, hasImage ]
	);

	useEffect( () => {
		if ( playerRef.current?.instance ) {
			const player = playerRef.current.instance;
			if ( player.titleEl ) {
				player.titleEl.textContent = title;
			}
			if ( player.subtitleEl ) {
				player.subtitleEl.textContent = artist;
				player.subtitleEl.style.display = artist ? '' : 'none';
			}
			if ( player.artworkEl ) {
				player.artworkEl.src = image;
			}
		}
	}, [ title, artist, image ] );

	useEffect( () => {
		if ( src && playerRef.current?.instance ) {
			const wasPlaying = playerRef.current.instance.isPlaying;
			const promise = playerRef.current.instance.loadTrack(
				src,
				title,
				artist,
				{
					artwork: image,
				}
			);
			if ( ! wasPlaying ) {
				promise.then( () => {
					playerRef.current.instance.pause();
				} );
			}
		}
	}, [ src ] );

	return <div ref={ ref } className="wp-block-playlist__waveform-player" />;
}
