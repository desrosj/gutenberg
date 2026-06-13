/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';
import { privateApis as editorPrivateApis } from '@wordpress/editor';
import { useEditorAssets, useEditorSettings } from '@wordpress/lazy-editor';
import { Spinner } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { unlock } from '@wordpress/routes-lock-unlock';

const { StyleBookPreview } = unlock( editorPrivateApis );

function Canvas() {
	const { isReady: assetsReady } = useEditorAssets();
	const globalStylesId = useSelect(
		( select ) =>
			(
				select( coreStore ) as any
			 ).__experimentalGetCurrentGlobalStylesId(),
		[]
	);
	const { editorSettings } = useEditorSettings( {
		stylesId: globalStylesId,
	} );
	const navigate = useNavigate();
	const search = useSearch( { strict: false } ) as any;

	// Get section from URL query params
	const section = ( search.section ?? '/' ) as string;

	const onChangeSection = ( updatedSection: string ) => {
		navigate( {
			search: {
				...search,
				section: updatedSection,
			},
		} );
	};

	if ( ! assetsReady ) {
		return (
			<div
				style={ {
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
				} }
			>
				<Spinner />
			</div>
		);
	}

	return (
		<StyleBookPreview
			path={ section }
			onPathChange={ onChangeSection }
			settings={ editorSettings }
		/>
	);
}

export const canvas = Canvas;
