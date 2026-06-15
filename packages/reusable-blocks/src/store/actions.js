/**
 * Returns a no-op thunk. This package is deprecated and converting reusable
 * blocks is now handled elsewhere, but the action remains for backward
 * compatibility.
 */
export const __experimentalConvertBlockToStatic = () => () => {};

/**
 * Returns a no-op thunk. This package is deprecated and converting blocks into
 * patterns is now handled elsewhere, but the action remains for backward
 * compatibility.
 */
export const __experimentalConvertBlocksToReusable = () => async () => {};

/**
 * Returns a no-op thunk. This package is deprecated and deleting reusable
 * blocks is now handled elsewhere, but the action remains for backward
 * compatibility.
 */
export const __experimentalDeleteReusableBlock = () => async () => {};

/**
 * Returns an action descriptor for the SET_EDITING_REUSABLE_BLOCK action. The
 * action is now inert because the reducer no longer responds to it, but it is
 * kept for backward compatibility.
 *
 * @param {string}  clientId  The clientID of the reusable block to target.
 * @param {boolean} isEditing Whether the block should be in editing state.
 * @return {Object} Action descriptor.
 */
export function __experimentalSetEditingReusableBlock( clientId, isEditing ) {
	return {
		type: 'SET_EDITING_REUSABLE_BLOCK',
		clientId,
		isEditing,
	};
}
