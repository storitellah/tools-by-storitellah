<?php
/**
 * Plugin Name:       Miter & Mat
 * Description:       Let visitors frame their photos in hardwood frame mockups: walnut, cherry, ash, maple and gold, with mats, backgrounds, layouts and PNG/ZIP export. Add it with the [miter_and_mat] shortcode or the Miter & Mat block.
 * Version:           1.0.0
 * Requires at least: 6.1
 * Requires PHP:      7.4
 * Author:            Storitellah
 * Author URI:        https://www.prints.storitellah.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       miter-and-mat
 *
 * @package MiterAndMat
 */

defined( 'ABSPATH' ) || exit;

define( 'MAM_VERSION', '1.0.0' );
define( 'MAM_URL', plugin_dir_url( __FILE__ ) );
define( 'MAM_OPTION', 'mam_settings' );

/**
 * Everything a site owner can choose. Keys match the ids the tool understands.
 *
 * Frames carry two names: the descriptive one (the default, safe for a shop)
 * and the name used on the page the styles were transcribed from.
 */
function mam_choices() {
	return array(
		'frame'      => array(
			'walnut-gallery'         => array( 'Walnut · Flat', 'Walnut Gallery' ),
			'black-walnut-gallery'   => array( 'Black Walnut · Flat', 'Black Walnut Gallery' ),
			'indigo-walnut-gallery'  => array( 'Indigo Walnut · Flat', 'Indigo Walnut Gallery' ),
			'cherry-gallery'         => array( 'Cherry · Flat', 'Cherry Gallery' ),
			'ash-gallery'            => array( 'Ash · Flat', 'Ash Gallery' ),
			'bleached-maple-gallery' => array( 'Whitewashed Maple · Flat', 'Bleached Maple Gallery' ),
			'walnut-round'           => array( 'Walnut · Rounded', 'Walnut Round' ),
			'black-walnut-round'     => array( 'Black Walnut · Rounded', 'Black Walnut Round' ),
			'indigo-walnut-round'    => array( 'Indigo Walnut · Rounded', 'Indigo Walnut Round' ),
			'cherry-round'           => array( 'Cherry · Rounded', 'Cherry Round' ),
			'ash-round'              => array( 'Ash · Rounded', 'Ash Round' ),
			'bleached-maple-round'   => array( 'Whitewashed Maple · Rounded', 'Bleached Maple Round' ),
			'stratton'               => array( 'Stained Pine · Stepped', 'Stratton' ),
			'richmond'               => array( 'Gold · Gilded', 'Richmond' ),
			'irvine-slim'            => array( 'Natural Oak · Slim', 'Irvine Slim' ),
			'white-gallery'          => array( 'White · Flat', 'White Gallery' ),
		),
		'matStyle'   => array(
			'single' => __( 'Beveled mat', 'miter-and-mat' ),
			'float'  => __( 'Float mount', 'miter-and-mat' ),
			'none'   => __( 'No mat', 'miter-and-mat' ),
		),
		'mat'        => array(
			'classic'  => __( 'Classic white', 'miter-and-mat' ),
			'offwhite' => __( 'Off-white', 'miter-and-mat' ),
			'black'    => __( 'Black', 'miter-and-mat' ),
			'red'      => __( 'Red', 'miter-and-mat' ),
			'linen1'   => __( 'Linen · white', 'miter-and-mat' ),
			'linen2'   => __( 'Linen · natural', 'miter-and-mat' ),
			'linen3'   => __( 'Linen · stone', 'miter-and-mat' ),
			'linen4'   => __( 'Linen · grey', 'miter-and-mat' ),
			'linen5'   => __( 'Linen · charcoal', 'miter-and-mat' ),
		),
		'background' => array(
			'white'      => __( 'White', 'miter-and-mat' ),
			'gallery'    => __( 'Gallery grey', 'miter-and-mat' ),
			'offwhite'   => __( 'Creamy off-white', 'miter-and-mat' ),
			'sage'       => __( 'Sage green', 'miter-and-mat' ),
			'plaster'    => __( 'Warm plaster', 'miter-and-mat' ),
			'blush'      => __( 'Blush', 'miter-and-mat' ),
			'dusty'      => __( 'Dusty blue', 'miter-and-mat' ),
			'terracotta' => __( 'Terracotta', 'miter-and-mat' ),
			'olive'      => __( 'Olive', 'miter-and-mat' ),
			'navy'       => __( 'Deep navy', 'miter-and-mat' ),
			'charcoal'   => __( 'Charcoal', 'miter-and-mat' ),
			'black'      => __( 'Black', 'miter-and-mat' ),
			'clear'      => __( 'Transparent', 'miter-and-mat' ),
		),
		'layout'     => array(
			'fit'  => __( 'Fit to frame', 'miter-and-mat' ),
			'1:1'  => '1:1',
			'4:5'  => '4:5',
			'2:3'  => '2:3',
			'3:2'  => '3:2',
			'16:9' => '16:9',
			'9:16' => '9:16',
		),
		'measure'    => array(
			'art'     => __( 'Art (long side)', 'miter-and-mat' ),
			'outside' => __( 'Outside of frame', 'miter-and-mat' ),
		),
		'theme'      => array(
			'light' => __( 'Light', 'miter-and-mat' ),
			'dark'  => __( 'Dark', 'miter-and-mat' ),
			'auto'  => __( "Follow the visitor's device", 'miter-and-mat' ),
		),
		'names'      => array(
			'descriptive' => __( 'Descriptive (Walnut · Flat, Cherry · Rounded…)', 'miter-and-mat' ),
			'source'      => __( 'As on the source page (Walnut Gallery, Cherry Round…)', 'miter-and-mat' ),
		),
	);
}

function mam_defaults() {
	return array(
		'frame'      => 'walnut-gallery',
		'matStyle'   => 'single',
		'mat'        => 'classic',
		'background' => 'offwhite',
		'layout'     => 'fit',
		'measure'    => 'art',
		'size'       => 10,
		'theme'      => 'light',
		'names'      => 'descriptive',
		'accent'     => '',
		'height'     => 860,
		'credit'     => 1,
	);
}

function mam_options() {
	return wp_parse_args( (array) get_option( MAM_OPTION, array() ), mam_defaults() );
}

/**
 * Clean one set of values against the allowed choices. Unknown values fall
 * back to $fallback, so a typo in a shortcode never breaks the page.
 */
function mam_clean( $values, $fallback ) {
	$choices = mam_choices();
	$out     = array();
	foreach ( array( 'frame', 'matStyle', 'mat', 'background', 'layout', 'measure', 'theme', 'names' ) as $key ) {
		$v           = isset( $values[ $key ] ) ? (string) $values[ $key ] : '';
		$out[ $key ] = array_key_exists( $v, $choices[ $key ] ) ? $v : $fallback[ $key ];
	}
	$size          = isset( $values['size'] ) ? (float) $values['size'] : 0;
	$out['size']   = ( $size >= 4 && $size <= 48 ) ? $size : $fallback['size'];
	$height        = isset( $values['height'] ) ? absint( $values['height'] ) : 0;
	$out['height'] = ( $height >= 480 && $height <= 2400 ) ? $height : $fallback['height'];
	$accent        = isset( $values['accent'] ) ? sanitize_hex_color( (string) $values['accent'] ) : '';
	$out['accent'] = $accent ? $accent : $fallback['accent'];
	$out['credit'] = empty( $values['credit'] ) || in_array( strtolower( (string) $values['credit'] ), array( '0', 'no', 'false', 'off' ), true ) ? 0 : 1;
	return $out;
}

/**
 * Render the tool. The app runs in an iframe so the theme's CSS can't reach it
 * and it can't reach the theme.
 */
function mam_render( $atts = array() ) {
	$defaults = mam_options();
	$atts     = is_array( $atts ) ? $atts : array();
	// Shortcode attribute names arrive lowercased.
	if ( isset( $atts['matstyle'] ) && ! isset( $atts['matStyle'] ) ) {
		$atts['matStyle'] = $atts['matstyle'];
	}
	if ( ! isset( $atts['credit'] ) ) {
		$atts['credit'] = $defaults['credit'];
	}
	$o = mam_clean( array_merge( $defaults, array_filter( $atts, 'strlen' ) ), $defaults );

	$args = array(
		'embed'      => '1',
		'frame'      => $o['frame'],
		'matStyle'   => $o['matStyle'],
		'mat'        => $o['mat'],
		'background' => $o['background'],
		'layout'     => $o['layout'],
		'measure'    => $o['measure'],
		'size'       => $o['size'],
		'names'      => $o['names'],
		'credit'     => $o['credit'] ? '1' : '0',
		'ver'        => MAM_VERSION,
	);
	if ( 'auto' !== $o['theme'] ) {
		$args['theme'] = $o['theme'];
	}
	if ( $o['accent'] ) {
		$args['accent'] = ltrim( $o['accent'], '#' );
	}
	$src = add_query_arg( array_map( 'rawurlencode', $args ), MAM_URL . 'app/index.html' );

	wp_enqueue_script( 'mam-embed' );

	return sprintf(
		'<div class="mam-embed" style="width:100%%;max-width:100%%;"><iframe class="mam-frame" src="%1$s" title="%2$s" data-height="%3$d" style="display:block;width:100%%;height:%3$dpx;border:0;border-radius:4px;" loading="lazy"></iframe></div>',
		esc_url( $src ),
		esc_attr__( 'Frame your photo', 'miter-and-mat' ),
		(int) $o['height']
	);
}

add_action(
	'init',
	function () {
		wp_register_script( 'mam-embed', MAM_URL . 'assets/embed.js', array(), MAM_VERSION, true );
		add_shortcode( 'miter_and_mat', 'mam_render' );

		wp_register_script(
			'mam-block',
			MAM_URL . 'assets/block.js',
			array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-server-side-render', 'wp-i18n' ),
			MAM_VERSION,
			true
		);
		$choices = mam_choices();
		$names   = mam_options()['names'];
		$frames  = array();
		foreach ( $choices['frame'] as $id => $pair ) {
			$frames[ $id ] = 'source' === $names ? $pair[1] : $pair[0];
		}
		wp_localize_script(
			'mam-block',
			'mamBlock',
			array(
				'frame'      => $frames,
				'background' => $choices['background'],
				'layout'     => $choices['layout'],
				'theme'      => $choices['theme'],
			)
		);

		register_block_type(
			'miter-and-mat/tool',
			array(
				'api_version'     => 3,
				'editor_script'   => 'mam-block',
				'render_callback' => function ( $attributes ) {
					return mam_render( array_map( 'strval', (array) $attributes ) );
				},
				'attributes'      => array(
					'frame'      => array( 'type' => 'string', 'default' => '' ),
					'background' => array( 'type' => 'string', 'default' => '' ),
					'layout'     => array( 'type' => 'string', 'default' => '' ),
					'theme'      => array( 'type' => 'string', 'default' => '' ),
					'height'     => array( 'type' => 'string', 'default' => '' ),
				),
			)
		);
	}
);

// Settings page ---------------------------------------------------------------

add_action(
	'admin_init',
	function () {
		register_setting(
			'mam',
			MAM_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => function ( $input ) {
					$input = (array) $input;
					if ( ! isset( $input['credit'] ) ) {
						$input['credit'] = 0;
					}
					return mam_clean( $input, mam_defaults() );
				},
				'default'           => mam_defaults(),
			)
		);
	}
);

add_action(
	'admin_menu',
	function () {
		add_options_page( __( 'Miter & Mat', 'miter-and-mat' ), __( 'Miter & Mat', 'miter-and-mat' ), 'manage_options', 'miter-and-mat', 'mam_settings_page' );
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=miter-and-mat' ) ) . '">' . esc_html__( 'Settings', 'miter-and-mat' ) . '</a>' );
		return $links;
	}
);

function mam_select( $key, $value, $list ) {
	printf( '<select id="mam-%1$s" name="%2$s[%1$s]">', esc_attr( $key ), esc_attr( MAM_OPTION ) );
	foreach ( $list as $id => $label ) {
		$label = is_array( $label ) ? $label[0] . ' (' . $label[1] . ')' : $label;
		printf( '<option value="%s"%s>%s</option>', esc_attr( $id ), selected( $value, $id, false ), esc_html( $label ) );
	}
	echo '</select>';
}

function mam_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$o       = mam_options();
	$choices = mam_choices();
	$rows    = array(
		'frame'      => __( 'Starting frame', 'miter-and-mat' ),
		'matStyle'   => __( 'Mat style', 'miter-and-mat' ),
		'mat'        => __( 'Mat color', 'miter-and-mat' ),
		'background' => __( 'Background', 'miter-and-mat' ),
		'layout'     => __( 'Image shape', 'miter-and-mat' ),
		'measure'    => __( 'Size is measured on', 'miter-and-mat' ),
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Miter & Mat', 'miter-and-mat' ); ?></h1>
		<p><?php esc_html_e( 'These are the starting settings visitors see. They can change everything in the tool itself.', 'miter-and-mat' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'mam' ); ?>
			<table class="form-table" role="presentation">
				<?php foreach ( $rows as $key => $label ) : ?>
				<tr>
					<th scope="row"><label for="mam-<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label></th>
					<td><?php mam_select( $key, $o[ $key ], $choices[ $key ] ); ?></td>
				</tr>
				<?php endforeach; ?>
				<tr>
					<th scope="row"><label for="mam-size"><?php esc_html_e( 'Starting size (inches)', 'miter-and-mat' ); ?></label></th>
					<td><input type="number" id="mam-size" name="<?php echo esc_attr( MAM_OPTION ); ?>[size]" value="<?php echo esc_attr( $o['size'] ); ?>" min="4" max="48" step="0.25" class="small-text"></td>
				</tr>
				<tr>
					<th scope="row"><label for="mam-names"><?php esc_html_e( 'Frame names', 'miter-and-mat' ); ?></label></th>
					<td>
						<?php mam_select( 'names', $o['names'], $choices['names'] ); ?>
						<p class="description"><?php esc_html_e( 'Descriptive names avoid using another retailer\'s product names on your shop.', 'miter-and-mat' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="mam-theme"><?php esc_html_e( 'Tool theme', 'miter-and-mat' ); ?></label></th>
					<td><?php mam_select( 'theme', $o['theme'], $choices['theme'] ); ?></td>
				</tr>
				<tr>
					<th scope="row"><label for="mam-accent"><?php esc_html_e( 'Accent color', 'miter-and-mat' ); ?></label></th>
					<td>
						<input type="text" id="mam-accent" name="<?php echo esc_attr( MAM_OPTION ); ?>[accent]" value="<?php echo esc_attr( $o['accent'] ); ?>" placeholder="#6b3f24" class="regular-text" pattern="#[0-9a-fA-F]{6}">
						<p class="description"><?php esc_html_e( 'A hex color for buttons and selections, to match your site. Leave empty for walnut brown.', 'miter-and-mat' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="mam-height"><?php esc_html_e( 'Height on wide screens (px)', 'miter-and-mat' ); ?></label></th>
					<td>
						<input type="number" id="mam-height" name="<?php echo esc_attr( MAM_OPTION ); ?>[height]" value="<?php echo esc_attr( $o['height'] ); ?>" min="480" max="2400" step="10" class="small-text">
						<p class="description"><?php esc_html_e( 'On phones the tool grows to fit its content automatically.', 'miter-and-mat' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Footnote', 'miter-and-mat' ); ?></th>
					<td><label><input type="checkbox" name="<?php echo esc_attr( MAM_OPTION ); ?>[credit]" value="1" <?php checked( $o['credit'], 1 ); ?>> <?php esc_html_e( 'Show the note that previews are digital renderings', 'miter-and-mat' ); ?></label></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<h2><?php esc_html_e( 'Adding the tool to a page', 'miter-and-mat' ); ?></h2>
		<p><?php esc_html_e( 'In the block editor, add the "Miter & Mat" block. Anywhere else, use the shortcode:', 'miter-and-mat' ); ?></p>
		<p><code>[miter_and_mat]</code></p>
		<p><?php esc_html_e( 'Any setting above can be overridden per page:', 'miter-and-mat' ); ?></p>
		<p><code>[miter_and_mat frame="cherry-round" background="sage" layout="4:5" mat="linen2" size="16" height="900"]</code></p>
		<p class="description"><?php esc_html_e( 'Attributes: frame, matStyle, mat, background, layout, measure, size, theme, names, accent, height, credit. Values are the ids in the lists below.', 'miter-and-mat' ); ?></p>
		<details>
			<summary><?php esc_html_e( 'Ids you can use', 'miter-and-mat' ); ?></summary>
			<?php foreach ( array( 'frame', 'matStyle', 'mat', 'background', 'layout' ) as $key ) : ?>
				<p><strong><?php echo esc_html( $key ); ?>:</strong> <?php echo implode( ' ', array_map( function ( $id ) { return '<code>' . esc_html( $id ) . '</code>'; }, array_keys( $choices[ $key ] ) ) ); // phpcs:ignore WordPress.Security.EscapeOutput -- each id is escaped above. ?></p>
			<?php endforeach; ?>
		</details>
	</div>
	<?php
}
