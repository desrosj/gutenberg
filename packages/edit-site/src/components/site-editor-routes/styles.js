/**
 * WordPress dependencies
 */
import { privateApis as routerPrivateApis } from '@wordpress/router';
import { privateApis as editorPrivateApis } from '@wordpress/editor';
import { addQueryArgs } from '@wordpress/url';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { generateGlobalStyles } from '@wordpress/global-styles-engine';

/**
 * Internal dependencies
 */
import Editor from '../editor';
import { store as editSiteStore } from '../../store';
import { unlock } from '../../lock-unlock';
import SidebarNavigationScreenGlobalStyles from '../sidebar-navigation-screen-global-styles';
import SidebarGlobalStyles from '../sidebar-global-styles';

const { useLocation, useHistory } = unlock( routerPrivateApis );
const { StyleBookPreview, useGlobalStyles } = unlock( editorPrivateApis );

function StylesPreviewArea() {
	const { path, query } = useLocation();
	const history = useHistory();
	const isStylebook = query.preview === 'stylebook';
	const baseSettings = useSelect(
		( select ) => select( editSiteStore ).getSettings(),
		[]
	);
	// Compose the editor settings with freshly generated global styles so the
	// style book reflects live Global Styles edits and renders correctly on a
	// fresh page load (when no editor canvas has populated the editor store).
	const { merged: mergedConfig } = useGlobalStyles();
	const settings = useMemo( () => {
		const [ globalStyles ] = generateGlobalStyles( mergedConfig, [], {
			disableRootPadding: true,
		} );
		const nonGlobalStyles = ( baseSettings?.styles ?? [] ).filter(
			( style ) => ! style.isGlobalStyles
		);
		return {
			...baseSettings,
			styles: [ ...nonGlobalStyles, ...globalStyles ],
		};
	}, [ baseSettings, mergedConfig ] );

	// Get section from URL query params
	const section = query.section ?? '/';
	const onChangeSection = ( updatedSection ) => {
		history.navigate(
			addQueryArgs( path, {
				section: updatedSection,
			} )
		);
	};

	if ( isStylebook ) {
		return (
			<StyleBookPreview
				path={ section }
				onPathChange={ onChangeSection }
				settings={ settings }
			/>
		);
	}

	return <Editor />;
}

export const stylesRoute = {
	name: 'styles',
	path: '/styles',
	areas: {
		content: <SidebarGlobalStyles />,
		sidebar: <SidebarNavigationScreenGlobalStyles backPath="/" />,
		preview: <StylesPreviewArea />,
		mobileContent: <SidebarGlobalStyles />,
	},
	widths: {
		content: 380,
	},
};
