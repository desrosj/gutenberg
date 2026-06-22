/**
 * WordPress dependencies
 */
import {
	SelectControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { Stack, VisuallyHidden } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { CROP_CONTROL_ATTR } from '../../hooks/use-crop-gesture-handlers';
import MediaEditorImageControls from '../media-editor-image-controls';
import type { AspectRatioPreset } from '../../image-editor/core/constants';
import type { CropShape } from '../../state';

export interface MediaEditorCropPanelProps {
	/** Selected crop output shape. */
	cropShape: CropShape;
	/** Setter for the crop output shape. */
	onCropShapeChange: ( shape: CropShape ) => void;
	/**
	 * Selected aspect-ratio preset value as a string (so it round-trips
	 * through `<SelectControl>`). `'0'` = free, `'-1'` = original, any
	 * positive number = fixed ratio.
	 */
	aspectRatioValue: string;
	/** Setter for the aspect-ratio preset value. */
	onAspectRatioChange: ( value: string ) => void;
	/** Aspect-ratio presets to display in the selector. */
	aspectRatioOptions: AspectRatioPreset[];
	/**
	 * When `true`, render the rotate/flip/zoom image controls at the top of
	 * the panel. Used on wide viewports where the footer no longer carries
	 * them.
	 */
	showTransformControls?: boolean;
}

/**
 * Sidebar panel for crop controls. Renders the aspect-ratio selector, plus the
 * rotate/flip and zoom controls on wide viewports (these move to the footer
 * toolbar when the sidebar collapses).
 * @param props
 * @param props.cropShape
 * @param props.onCropShapeChange
 * @param props.aspectRatioValue
 * @param props.onAspectRatioChange
 * @param props.aspectRatioOptions
 * @param props.showTransformControls
 */
export default function MediaEditorCropPanel( {
	cropShape,
	onCropShapeChange,
	aspectRatioValue,
	onAspectRatioChange,
	aspectRatioOptions,
	showTransformControls = false,
}: MediaEditorCropPanelProps ) {
	return (
		// Tag the whole panel as a crop-control region so the modal's
		// Cmd+Z handler doesn't mistake the SelectControl input for a
		// metadata field (which would suppress undo).
		<Stack
			direction="column"
			gap="xl"
			{ ...{ [ CROP_CONTROL_ATTR ]: true } }
		>
			<VisuallyHidden render={ <h2 /> }>
				{ __( 'Crop options' ) }
			</VisuallyHidden>
			{ showTransformControls && <MediaEditorImageControls withLabels /> }
			<ToggleGroupControl
				__next40pxDefaultSize
				__shouldNotWarnDeprecated36pxSize
				isBlock
				label={ __( 'Shape' ) }
				help={
					cropShape === 'circle'
						? __(
								'Circle crops will be saved as PNG files to preserve transparency.'
						  )
						: undefined
				}
				value={ cropShape }
				onChange={ ( value ) => {
					if ( value === 'rectangle' || value === 'circle' ) {
						onCropShapeChange( value );
					}
				} }
			>
				<ToggleGroupControlOption
					value="rectangle"
					label={ __( 'Rectangle' ) }
				/>
				<ToggleGroupControlOption
					value="circle"
					label={ __( 'Circle' ) }
				/>
			</ToggleGroupControl>
			{ cropShape === 'rectangle' && (
				<SelectControl
					__next40pxDefaultSize
					label={ __( 'Aspect ratio' ) }
					value={ aspectRatioValue }
					onChange={ onAspectRatioChange }
					options={ aspectRatioOptions.map( ( preset ) => ( {
						label: preset.label,
						value: preset.value.toString(),
					} ) ) }
				/>
			) }
		</Stack>
	);
}
