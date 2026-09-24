<?php
/**
 * Remove the plugin's settings when it is deleted.
 *
 * @package MiterAndMat
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;
delete_option( 'mam_settings' );
