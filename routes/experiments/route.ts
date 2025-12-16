/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

interface Experiment {
	id: string;
	label: string;
	description: string;
	group: string;
	separateOption?: boolean;
}

export const route = {
	title: () => __( 'Experiments' ),
	loader: async (): Promise< { experiments: Experiment[] } > => {
		// Get experiments data from window object (passed from PHP)
		const experiments = ( window as any ).__GUTENBERG_EXPERIMENTS__ || [];
		return { experiments };
	},
};
