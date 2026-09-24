=== Miter & Mat ===
Contributors: storitellah
Tags: frame, mockup, photo, prints, gallery
Requires at least: 6.1
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Let visitors frame their photos in hardwood frame mockups and download the result.

== Description ==

Miter & Mat adds a framing tool to any page. Visitors upload one photo or a
batch, pick a frame, a mat and a background, and download framed mockups as
PNGs (or as a ZIP for a batch).

* 16 frames: walnut, black walnut, indigo walnut, cherry, ash and whitewashed maple, each in flat and rounded profiles, plus stepped pine, gilded gold, slim oak and white. They are drawn digitally with real-looking grain, and every frame uses different boards.
* Every frame takes its photo's exact shape. One size setting controls the art's long side or the outside of the frame.
* Beveled mat, float mount or no mat, in nine mat colors or a custom one.
* 12 background colors, a custom color, or transparent.
* Output shapes: fit to frame, 1:1, 4:5, 2:3, 3:2, 16:9 and 9:16.
* Photos stay in the visitor's browser. Nothing is uploaded to your server or anywhere else, and the tool loads no third-party scripts or fonts.

== Installation ==

1. In WordPress, go to Plugins → Add New Plugin → Upload Plugin and choose `miter-and-mat.zip`.
2. Activate the plugin.
3. Optional: set the starting frame, background, accent color and height under Settings → Miter & Mat.
4. Add the "Miter & Mat" block to a page, or use the shortcode `[miter_and_mat]`.

== Frequently Asked Questions ==

= Can I set different defaults on different pages? =

Yes. Every setting can be overridden on the shortcode, for example
`[miter_and_mat frame="cherry-round" background="sage" layout="4:5" size="16"]`.
The block has the most common overrides in its sidebar. Settings → Miter & Mat
lists every id you can use.

= Does it work with page caching? =

Yes. The tool is a static file served from the plugin folder, and all the
work happens in the visitor's browser.

= Why is the tool in an iframe? =

It keeps your theme's styles and the tool's styles apart, so neither can break the other.
On phones the frame grows to fit the tool, so the page scrolls normally.

== Credits ==

JSZip (MIT or GPLv3). Bricolage Grotesque and IBM Plex fonts (SIL Open Font License). See the licenses folder.

== Changelog ==

= 1.0.0 =
* First release.
