/* Miter & Mat block: a server-rendered embed with a few per-block overrides. */
( function ( wp, data ) {
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var TextControl = wp.components.TextControl;
	var ServerSideRender = wp.serverSideRender;

	function options( map ) {
		var list = [ { value: '', label: __( 'Use the site setting', 'miter-and-mat' ) } ];
		Object.keys( map ).forEach( function ( k ) {
			list.push( { value: k, label: map[ k ] } );
		} );
		return list;
	}

	wp.blocks.registerBlockType( 'miter-and-mat/tool', {
		apiVersion: 3,
		title: __( 'Miter & Mat', 'miter-and-mat' ),
		description: __( 'A tool visitors use to frame their photos in hardwood frame mockups.', 'miter-and-mat' ),
		icon: 'format-image',
		category: 'media',
		keywords: [ 'frame', 'mockup', 'photo', 'print' ],
		supports: { html: false, align: [ 'wide', 'full' ] },
		attributes: {
			frame: { type: 'string', default: '' },
			background: { type: 'string', default: '' },
			layout: { type: 'string', default: '' },
			theme: { type: 'string', default: '' },
			height: { type: 'string', default: '' }
		},
		edit: function ( props ) {
			var a = props.attributes;
			var set = function ( key ) {
				return function ( v ) {
					var o = {};
					o[ key ] = v;
					props.setAttributes( o );
				};
			};
			return el(
				'div',
				useBlockProps(),
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Starting settings', 'miter-and-mat' ) },
						el( SelectControl, { label: __( 'Frame', 'miter-and-mat' ), value: a.frame, options: options( data.frame ), onChange: set( 'frame' ) } ),
						el( SelectControl, { label: __( 'Background', 'miter-and-mat' ), value: a.background, options: options( data.background ), onChange: set( 'background' ) } ),
						el( SelectControl, { label: __( 'Image shape', 'miter-and-mat' ), value: a.layout, options: options( data.layout ), onChange: set( 'layout' ) } ),
						el( SelectControl, { label: __( 'Tool theme', 'miter-and-mat' ), value: a.theme, options: options( data.theme ), onChange: set( 'theme' ) } ),
						el( TextControl, { label: __( 'Height on wide screens (px)', 'miter-and-mat' ), type: 'number', value: a.height, onChange: set( 'height' ), help: __( 'Leave empty to use the site setting.', 'miter-and-mat' ) } )
					)
				),
				el( ServerSideRender, { block: 'miter-and-mat/tool', attributes: a } )
			);
		},
		save: function () {
			return null;
		}
	} );
} )( window.wp, window.mamBlock || {} );
