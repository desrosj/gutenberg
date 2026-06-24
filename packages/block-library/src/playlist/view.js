/**
 * WordPress dependencies
 */
import { store, getContext, getElement } from '@wordpress/interactivity';

/**
 * Internal dependencies
 */
import {
	initWaveformPlayer,
	logPlayError,
	setupPlayButtonArtwork,
	getNextShuffledTrack,
	isShuffleCycleComplete,
} from '../utils/waveform-utils';

/**
 * Store player state for each element.
 */
const playerState = new WeakMap();

const { state } = store(
	'core/playlist',
	{
		state: {
			playlists: {},
			get isCurrentTrack() {
				const { currentId, trackId } = getContext();
				return currentId === trackId;
			},
		},
		actions: {
			changeTrack() {
				const context = getContext();
				context.currentId = context.trackId;
			},
		},
		callbacks: {
			initWaveformPlayer() {
				const context = getContext();
				const { ref } = getElement();

				if ( ! context.currentId || ! ref ) {
					return;
				}

				const track =
					state.playlists[ context.playlistId ]?.tracks[
						context.currentId
					];
				if ( ! track?.url ) {
					return;
				}

				const existing = playerState.get( ref );

				// Skip if we already initialized with this exact URL.
				if ( existing?.url === track.url ) {
					return;
				}

				// Autoplay if we're switching from a different track (user action),
				// but not on initial page load (when existing has no URL).
				const shouldAutoPlay = !! existing?.url;

				initPlayer( ref, track, shouldAutoPlay, context );
			},
		},
	},
	{ lock: true }
);

/**
 * Initialize the waveform player for a given element.
 *
 * @param {Element} ref            - The container element.
 * @param {Object}  track          - The track data.
 * @param {boolean} shouldAutoPlay - Whether to auto-play after initialization.
 * @param {Object}  context        - The Interactivity API context.
 */
function initPlayer( ref, track, shouldAutoPlay, context ) {
	const existing = playerState.get( ref );

	// If a player already exists, load the new track without recreating.
	if ( existing?.instance ) {
		existing.instance
			.loadTrack( track.url, track.title, track.artist, {
				artwork: track.image,
			} )
			.then( () => {
				existing.url = track.url;
				setupPlayButtonArtwork(
					existing.container,
					existing.instance,
					track.image
				);
				if ( shouldAutoPlay ) {
					existing.instance.play()?.catch( logPlayError );
				}
			} )
			.catch( logPlayError );
		return;
	}

	// Read translated labels from server-rendered data attributes.
	const labels = {
		play: ref.dataset.labelPlay,
		pause: ref.dataset.labelPause,
		previous: ref.dataset.labelPrevious,
		next: ref.dataset.labelNext,
		shuffle: ref.dataset.labelShuffle,
		repeat: ref.dataset.labelRepeat,
	};

	// Advance to the next shuffled track, recording it so no track repeats
	// until every other track has played once.
	const advanceShuffled = () => {
		const { nextId, playedIds } = getNextShuffledTrack(
			context.tracks,
			context.currentId,
			context.playedTracks
		);
		context.playedTracks = playedIds;
		context.currentId = nextId;
	};

	// Initialize using the shared core.
	const player = initWaveformPlayer( ref, {
		src: track.url,
		title: track.title,
		artist: track.artist,
		image: track.image,
		autoPlay: shouldAutoPlay,
		labels,
		waveformStyle: context.waveformStyle,
		onEnded: () => {
			if ( context.isRepeating ) {
				player.instance.play()?.catch( logPlayError );
				return;
			}
			if ( context.isShuffled ) {
				if (
					isShuffleCycleComplete(
						context.tracks,
						context.currentId,
						context.playedTracks
					)
				) {
					return;
				}
				advanceShuffled();
				return;
			}
			// Advance to next track (autoPlay handles playback).
			const currentIndex = context.tracks.findIndex(
				( trackId ) => trackId === context.currentId
			);
			const nextTrack =
				context.tracks[ currentIndex + 1 ];
			if ( nextTrack ) {
				context.currentId = nextTrack;
			}
		},
		onPrev: () => {
			const currentIndex = context.tracks.findIndex(
				( uniqueId ) => uniqueId === context.currentId
			);
			const prevTrack =
				context.tracks[ currentIndex - 1 ] ||
				context.tracks[ context.tracks.length - 1 ];
			if ( prevTrack ) {
				context.currentId = prevTrack;
			}
		},
		onNext: () => {
			if ( context.isShuffled ) {
				advanceShuffled();
				return;
			}
			const currentIndex = context.tracks.findIndex(
				( uniqueId ) => uniqueId === context.currentId
			);
			const nextTrack =
				context.tracks[ currentIndex + 1 ] || context.tracks[ 0 ];
			if ( nextTrack ) {
				context.currentId = nextTrack;
			}
		},
		onShuffleToggle: () => {
			context.isShuffled = ! context.isShuffled;
			// Start a fresh shuffle cycle whenever shuffle is toggled.
			context.playedTracks = [];
		},
		onRepeatToggle: () => {
			context.isRepeating = ! context.isRepeating;
		},
		isShuffled: context.isShuffled,
		isRepeating: context.isRepeating,
	} );

	// Store state for cleanup, including instance for loadTrack reuse.
	playerState.set( ref, {
		url: track.url,
		container: player.container,
		instance: player.instance,
		destroy: player.destroy,
	} );
}
