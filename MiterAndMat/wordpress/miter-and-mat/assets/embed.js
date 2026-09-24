/* Miter & Mat: size the tool's iframe. On wide screens it uses the height set
   in the settings; on phones the tool stacks its controls under the preview and
   reports its full height, so the iframe grows to fit and the page scrolls. */
( function () {
	window.addEventListener( 'message', function ( e ) {
		if ( ! e.data || e.data.type !== 'miter-and-mat:height' ) {
			return;
		}
		var frames = document.querySelectorAll( 'iframe.mam-frame' );
		for ( var i = 0; i < frames.length; i++ ) {
			var f = frames[ i ];
			if ( f.contentWindow !== e.source ) {
				continue;
			}
			var base = parseInt( f.getAttribute( 'data-height' ), 10 ) || 860;
			var h = f.clientWidth < 760 ? Math.max( 480, Math.ceil( e.data.height ) ) : base;
			f.style.height = h + 'px';
		}
	} );
} )();
