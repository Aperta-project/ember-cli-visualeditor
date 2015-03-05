/*!
 * UnicodeJS v0.1.3
 * https://www.mediawiki.org/wiki/UnicodeJS
 *
 * Copyright 2013-2015 UnicodeJS Team and other contributors.
 * Released under the MIT license
 * http://unicodejs.mit-license.org/
 *
 * Date: 2015-02-05T02:13:05Z
 */
/*!
 * UnicodeJS namespace
 *
 * @copyright 2013–2015 UnicodeJS team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

( function () {
	var unicodeJS;

	/**
	 * Namespace for all UnicodeJS classes, static methods and static properties.
	 * @class
	 * @singleton
	 */
	unicodeJS = {};

	/**
	 * Split a string into Unicode characters, keeping surrogates paired.
	 *
	 * You probably want to call unicodeJS.graphemebreak.splitClusters instead.
	 *
	 * @param {string} text Text to split
	 * @return {string[]} Array of characters
	 */
	unicodeJS.splitCharacters = function ( text ) {
		return text.split( /(?![\uDC00-\uDFFF])/g );
		// TODO: think through handling of invalid UTF-16
	};

	/**
	 * Write a UTF-16 code unit as a javascript string literal.
	 *
	 * @private
	 * @param {number} codeUnit integer between 0x0000 and 0xFFFF
	 * @return {string} String literal ('\u' followed by 4 hex digits)
	 */
	function uEsc( codeUnit ) {
		return '\\u' + ( codeUnit + 0x10000 ).toString( 16 ).slice( -4 );
	}

	/**
	 * Return a regexp string for the code unit range min-max
	 *
	 * @private
	 * @param {number} min the minimum code unit in the range.
	 * @param {number} max the maximum code unit in the range.
	 * @param {boolean} [bracket] If true, then wrap range in [ ... ]
	 * @return {string} Regexp string which matches the range
	 */
	function codeUnitRange( min, max, bracket ) {
		var value;
		if ( min === max ) { // single code unit: never bracket
			return uEsc( min );
		}
		value = uEsc( min ) + '-' + uEsc( max );
		if ( bracket ) {
			return '[' + value + ']';
		} else {
			return value;
		}
	}

	/**
	 * Get a list of boxes in hi-lo surrogate space, corresponding to the given character range
	 *
	 * A box {hi: [x, y], lo: [z, w]} represents a regex [x-y][z-w] to match a surrogate pair
	 *
	 * Suppose ch1 and ch2 have surrogate pairs (hi1, lo1) and (hi2, lo2).
	 * Then the range of chars from ch1 to ch2 can be represented as the
	 * disjunction of three code unit ranges:
	 *
	 *     [hi1 - hi1][lo1 - 0xDFFF]
	 *      |
	 *     [hi1+1 - hi2-1][0xDC00 - 0xDFFF]
	 *      |
	 *     [hi2 - hi2][0xD800 - lo2]
	 *
	 * Often the notation can be optimised (e.g. when hi1 == hi2).
	 *
	 * @private
	 * @param {number} ch1 The min character of the range; must be over 0xFFFF
	 * @param {number} ch2 The max character of the range; must be at least ch1
	 * @return {Object} A list of boxes {hi: [x, y], lo: [z, w]}
	 */
	function getCodeUnitBoxes( ch1, ch2 ) {
		var loMin, loMax, hi1, hi2, lo1, lo2, boxes, hiMinAbove, hiMaxBelow;
		// min and max lo surrogates possible in UTF-16
		loMin = 0xDC00;
		loMax = 0xDFFF;

		// hi and lo surrogates for ch1
		/* jslint bitwise: true */
		hi1 = 0xD800 + ( ( ch1 - 0x10000 ) >> 10 );
		lo1 = 0xDC00 + ( ( ch1 - 0x10000 ) & 0x3FF );

		// hi and lo surrogates for ch2
		hi2 = 0xD800 + ( ( ch2 - 0x10000 ) >> 10 );
		lo2 = 0xDC00 + ( ( ch2 - 0x10000 ) & 0x3FF );
		/* jslint bitwise: false */

		if ( hi1 === hi2 ) {
			return [ { hi: [ hi1, hi2 ], lo: [ lo1, lo2 ] } ];
		}

		boxes = [];

		/* jslint bitwise: true */
		// minimum hi surrogate which only represents characters >= ch1
		hiMinAbove = 0xD800 + ( ( ch1 - 0x10000 + 0x3FF ) >> 10 );
		// maximum hi surrogate which only represents characters <= ch2
		hiMaxBelow = 0xD800 + ( ( ch2 - 0x10000 - 0x3FF ) >> 10 );
		/* jslint bitwise: false */

		if ( hi1 < hiMinAbove ) {
			boxes.push( { hi: [ hi1, hi1 ], lo: [ lo1, loMax ] } );
		}
		if ( hiMinAbove <= hiMaxBelow ) {
			boxes.push( { hi: [ hiMinAbove, hiMaxBelow ], lo: [ loMin, loMax ] } );
		}
		if ( hiMaxBelow < hi2 ) {
			boxes.push( { hi: [ hi2, hi2 ], lo: [ loMin, lo2 ] } );
		}
		return boxes;
	}

	/**
	 * Make a regexp string for an array of Unicode character ranges.
	 *
	 * If either character in a range is above 0xFFFF, then the range will
	 * be encoded as multiple surrogate pair ranges. It is an error for a
	 * range to overlap with the surrogate range 0xD800-0xDFFF (as this would
	 * only match ill-formed strings).
	 *
	 * @param {Array} ranges Array of ranges, each of which is a character or an interval
	 * @return {string} Regexp string for the disjunction of the ranges.
	 */
	unicodeJS.charRangeArrayRegexp = function ( ranges ) {
		var i, j, min, max, hi, lo, range, box,
			boxes = [],
			characterClass = [], // list of (\uXXXX code unit or interval), for BMP
			disjunction = []; // list of regex strings, to be joined with '|'

		for ( i = 0; i < ranges.length; i++ ) {
			range = ranges[i];
			// Handle single code unit
			if ( typeof range === 'number' && range <= 0xFFFF ) {
				if ( range >= 0xD800 && range <= 0xDFFF ) {
					throw new Error( 'Surrogate: ' + range.toString( 16 ) );
				}
				if ( range > 0x10FFFF ) {
					throw new Error( 'Character code too high: ' +
						range.toString( 16 ) );
				}
				characterClass.push( uEsc( range ) );
				continue;
			}

			// Handle single surrogate pair
			if ( typeof range === 'number' && range > 0xFFFF ) {
				/* jslint bitwise: true */
				hi = 0xD800 + ( ( range - 0x10000 ) >> 10 );
				lo = 0xDC00 + ( ( range - 0x10000 ) & 0x3FF );
				/* jslint bitwise: false */
				disjunction.push( uEsc( hi ) + uEsc( lo ) );
				continue;
			}

			// Handle interval
			min = range[0];
			max = range[1];
			if ( min > max ) {
				throw new Error( min.toString( 16 ) + ' > ' + max.toString( 16 ) );
			}
			if ( max > 0x10FFFF ) {
				throw new Error( 'Character code too high: ' +
					max.toString( 16 ) );
			}
			if ( max >= 0xD800 && min <= 0xDFFF ) {
				throw new Error( 'range includes surrogates: ' +
					min.toString( 16 ) + '-' + max.toString( 16 ) );
			}
			if ( max <= 0xFFFF ) {
				// interval is entirely BMP
				characterClass.push( codeUnitRange( min, max ) );
			} else if ( min <= 0xFFFF && max > 0xFFFF ) {
				// interval is BMP and non-BMP
				characterClass.push( codeUnitRange( min, 0xFFFF ) );
				boxes = getCodeUnitBoxes( 0x10000, max );
			} else if ( min > 0xFFFF ) {
				// interval is entirely non-BMP
				boxes = getCodeUnitBoxes( min, max );
			}

			// append hi-lo surrogate space boxes as code unit range pairs
			for ( j = 0; j < boxes.length; j++ ) {
				box = boxes[j];
				hi = codeUnitRange( box.hi[0], box.hi[1], true );
				lo = codeUnitRange( box.lo[0], box.lo[1], true );
				disjunction.push( hi + lo );
			}
		}

		// prepend BMP character class to the disjunction
		if ( characterClass.length === 1 && !characterClass[0].match( /-/ ) ) {
			disjunction.unshift( characterClass[0] ); // single character
		} else if ( characterClass.length > 0 ) {
			disjunction.unshift( '[' + characterClass.join( '' ) + ']' );
		}
		return disjunction.join( '|' );
	};

	// Expose
	/*jshint browser:true */
	window.unicodeJS = unicodeJS;
}() );

// This file is GENERATED by tools/unicodejs-properties.py
// DO NOT EDIT
unicodeJS.derivedcoreproperties = {
	// partial extraction only
	Alphabetic: [[0x0041, 0x005A], [0x0061, 0x007A], 0x00AA, 0x00B5, 0x00BA, [0x00C0, 0x00D6], [0x00D8, 0x00F6], [0x00F8, 0x02C1], [0x02C6, 0x02D1], [0x02E0, 0x02E4], 0x02EC, 0x02EE, 0x0345, [0x0370, 0x0374], 0x0376, 0x0377, [0x037A, 0x037D], 0x037F, 0x0386, [0x0388, 0x038A], 0x038C, [0x038E, 0x03A1], [0x03A3, 0x03F5], [0x03F7, 0x0481], [0x048A, 0x052F], [0x0531, 0x0556], 0x0559, [0x0561, 0x0587], [0x05B0, 0x05BD], 0x05BF, 0x05C1, 0x05C2, 0x05C4, 0x05C5, 0x05C7, [0x05D0, 0x05EA], [0x05F0, 0x05F2], [0x0610, 0x061A], [0x0620, 0x0657], [0x0659, 0x065F], [0x066E, 0x06D3], [0x06D5, 0x06DC], [0x06E1, 0x06E8], [0x06ED, 0x06EF], [0x06FA, 0x06FC], 0x06FF, [0x0710, 0x073F], [0x074D, 0x07B1], [0x07CA, 0x07EA], 0x07F4, 0x07F5, 0x07FA, [0x0800, 0x0817], [0x081A, 0x082C], [0x0840, 0x0858], [0x08A0, 0x08B2], [0x08E4, 0x08E9], [0x08F0, 0x093B], [0x093D, 0x094C], [0x094E, 0x0950], [0x0955, 0x0963], [0x0971, 0x0983], [0x0985, 0x098C], 0x098F, 0x0990, [0x0993, 0x09A8], [0x09AA, 0x09B0], 0x09B2, [0x09B6, 0x09B9], [0x09BD, 0x09C4], 0x09C7, 0x09C8, 0x09CB, 0x09CC, 0x09CE, 0x09D7, 0x09DC, 0x09DD, [0x09DF, 0x09E3], 0x09F0, 0x09F1, [0x0A01, 0x0A03], [0x0A05, 0x0A0A], 0x0A0F, 0x0A10, [0x0A13, 0x0A28], [0x0A2A, 0x0A30], 0x0A32, 0x0A33, 0x0A35, 0x0A36, 0x0A38, 0x0A39, [0x0A3E, 0x0A42], 0x0A47, 0x0A48, 0x0A4B, 0x0A4C, 0x0A51, [0x0A59, 0x0A5C], 0x0A5E, [0x0A70, 0x0A75], [0x0A81, 0x0A83], [0x0A85, 0x0A8D], [0x0A8F, 0x0A91], [0x0A93, 0x0AA8], [0x0AAA, 0x0AB0], 0x0AB2, 0x0AB3, [0x0AB5, 0x0AB9], [0x0ABD, 0x0AC5], [0x0AC7, 0x0AC9], 0x0ACB, 0x0ACC, 0x0AD0, [0x0AE0, 0x0AE3], [0x0B01, 0x0B03], [0x0B05, 0x0B0C], 0x0B0F, 0x0B10, [0x0B13, 0x0B28], [0x0B2A, 0x0B30], 0x0B32, 0x0B33, [0x0B35, 0x0B39], [0x0B3D, 0x0B44], 0x0B47, 0x0B48, 0x0B4B, 0x0B4C, 0x0B56, 0x0B57, 0x0B5C, 0x0B5D, [0x0B5F, 0x0B63], 0x0B71, 0x0B82, 0x0B83, [0x0B85, 0x0B8A], [0x0B8E, 0x0B90], [0x0B92, 0x0B95], 0x0B99, 0x0B9A, 0x0B9C, 0x0B9E, 0x0B9F, 0x0BA3, 0x0BA4, [0x0BA8, 0x0BAA], [0x0BAE, 0x0BB9], [0x0BBE, 0x0BC2], [0x0BC6, 0x0BC8], [0x0BCA, 0x0BCC], 0x0BD0, 0x0BD7, [0x0C00, 0x0C03], [0x0C05, 0x0C0C], [0x0C0E, 0x0C10], [0x0C12, 0x0C28], [0x0C2A, 0x0C39], [0x0C3D, 0x0C44], [0x0C46, 0x0C48], [0x0C4A, 0x0C4C], 0x0C55, 0x0C56, 0x0C58, 0x0C59, [0x0C60, 0x0C63], [0x0C81, 0x0C83], [0x0C85, 0x0C8C], [0x0C8E, 0x0C90], [0x0C92, 0x0CA8], [0x0CAA, 0x0CB3], [0x0CB5, 0x0CB9], [0x0CBD, 0x0CC4], [0x0CC6, 0x0CC8], [0x0CCA, 0x0CCC], 0x0CD5, 0x0CD6, 0x0CDE, [0x0CE0, 0x0CE3], 0x0CF1, 0x0CF2, [0x0D01, 0x0D03], [0x0D05, 0x0D0C], [0x0D0E, 0x0D10], [0x0D12, 0x0D3A], [0x0D3D, 0x0D44], [0x0D46, 0x0D48], [0x0D4A, 0x0D4C], 0x0D4E, 0x0D57, [0x0D60, 0x0D63], [0x0D7A, 0x0D7F], 0x0D82, 0x0D83, [0x0D85, 0x0D96], [0x0D9A, 0x0DB1], [0x0DB3, 0x0DBB], 0x0DBD, [0x0DC0, 0x0DC6], [0x0DCF, 0x0DD4], 0x0DD6, [0x0DD8, 0x0DDF], 0x0DF2, 0x0DF3, [0x0E01, 0x0E3A], [0x0E40, 0x0E46], 0x0E4D, 0x0E81, 0x0E82, 0x0E84, 0x0E87, 0x0E88, 0x0E8A, 0x0E8D, [0x0E94, 0x0E97], [0x0E99, 0x0E9F], [0x0EA1, 0x0EA3], 0x0EA5, 0x0EA7, 0x0EAA, 0x0EAB, [0x0EAD, 0x0EB9], [0x0EBB, 0x0EBD], [0x0EC0, 0x0EC4], 0x0EC6, 0x0ECD, [0x0EDC, 0x0EDF], 0x0F00, [0x0F40, 0x0F47], [0x0F49, 0x0F6C], [0x0F71, 0x0F81], [0x0F88, 0x0F97], [0x0F99, 0x0FBC], [0x1000, 0x1036], 0x1038, [0x103B, 0x103F], [0x1050, 0x1062], [0x1065, 0x1068], [0x106E, 0x1086], 0x108E, 0x109C, 0x109D, [0x10A0, 0x10C5], 0x10C7, 0x10CD, [0x10D0, 0x10FA], [0x10FC, 0x1248], [0x124A, 0x124D], [0x1250, 0x1256], 0x1258, [0x125A, 0x125D], [0x1260, 0x1288], [0x128A, 0x128D], [0x1290, 0x12B0], [0x12B2, 0x12B5], [0x12B8, 0x12BE], 0x12C0, [0x12C2, 0x12C5], [0x12C8, 0x12D6], [0x12D8, 0x1310], [0x1312, 0x1315], [0x1318, 0x135A], 0x135F, [0x1380, 0x138F], [0x13A0, 0x13F4], [0x1401, 0x166C], [0x166F, 0x167F], [0x1681, 0x169A], [0x16A0, 0x16EA], [0x16EE, 0x16F8], [0x1700, 0x170C], [0x170E, 0x1713], [0x1720, 0x1733], [0x1740, 0x1753], [0x1760, 0x176C], [0x176E, 0x1770], 0x1772, 0x1773, [0x1780, 0x17B3], [0x17B6, 0x17C8], 0x17D7, 0x17DC, [0x1820, 0x1877], [0x1880, 0x18AA], [0x18B0, 0x18F5], [0x1900, 0x191E], [0x1920, 0x192B], [0x1930, 0x1938], [0x1950, 0x196D], [0x1970, 0x1974], [0x1980, 0x19AB], [0x19B0, 0x19C9], [0x1A00, 0x1A1B], [0x1A20, 0x1A5E], [0x1A61, 0x1A74], 0x1AA7, [0x1B00, 0x1B33], [0x1B35, 0x1B43], [0x1B45, 0x1B4B], [0x1B80, 0x1BA9], [0x1BAC, 0x1BAF], [0x1BBA, 0x1BE5], [0x1BE7, 0x1BF1], [0x1C00, 0x1C35], [0x1C4D, 0x1C4F], [0x1C5A, 0x1C7D], [0x1CE9, 0x1CEC], [0x1CEE, 0x1CF3], 0x1CF5, 0x1CF6, [0x1D00, 0x1DBF], [0x1DE7, 0x1DF4], [0x1E00, 0x1F15], [0x1F18, 0x1F1D], [0x1F20, 0x1F45], [0x1F48, 0x1F4D], [0x1F50, 0x1F57], 0x1F59, 0x1F5B, 0x1F5D, [0x1F5F, 0x1F7D], [0x1F80, 0x1FB4], [0x1FB6, 0x1FBC], 0x1FBE, [0x1FC2, 0x1FC4], [0x1FC6, 0x1FCC], [0x1FD0, 0x1FD3], [0x1FD6, 0x1FDB], [0x1FE0, 0x1FEC], [0x1FF2, 0x1FF4], [0x1FF6, 0x1FFC], 0x2071, 0x207F, [0x2090, 0x209C], 0x2102, 0x2107, [0x210A, 0x2113], 0x2115, [0x2119, 0x211D], 0x2124, 0x2126, 0x2128, [0x212A, 0x212D], [0x212F, 0x2139], [0x213C, 0x213F], [0x2145, 0x2149], 0x214E, [0x2160, 0x2188], [0x24B6, 0x24E9], [0x2C00, 0x2C2E], [0x2C30, 0x2C5E], [0x2C60, 0x2CE4], [0x2CEB, 0x2CEE], 0x2CF2, 0x2CF3, [0x2D00, 0x2D25], 0x2D27, 0x2D2D, [0x2D30, 0x2D67], 0x2D6F, [0x2D80, 0x2D96], [0x2DA0, 0x2DA6], [0x2DA8, 0x2DAE], [0x2DB0, 0x2DB6], [0x2DB8, 0x2DBE], [0x2DC0, 0x2DC6], [0x2DC8, 0x2DCE], [0x2DD0, 0x2DD6], [0x2DD8, 0x2DDE], [0x2DE0, 0x2DFF], 0x2E2F, [0x3005, 0x3007], [0x3021, 0x3029], [0x3031, 0x3035], [0x3038, 0x303C], [0x3041, 0x3096], [0x309D, 0x309F], [0x30A1, 0x30FA], [0x30FC, 0x30FF], [0x3105, 0x312D], [0x3131, 0x318E], [0x31A0, 0x31BA], [0x31F0, 0x31FF], [0x3400, 0x4DB5], [0x4E00, 0x9FCC], [0xA000, 0xA48C], [0xA4D0, 0xA4FD], [0xA500, 0xA60C], [0xA610, 0xA61F], 0xA62A, 0xA62B, [0xA640, 0xA66E], [0xA674, 0xA67B], [0xA67F, 0xA69D], [0xA69F, 0xA6EF], [0xA717, 0xA71F], [0xA722, 0xA788], [0xA78B, 0xA78E], [0xA790, 0xA7AD], 0xA7B0, 0xA7B1, [0xA7F7, 0xA801], [0xA803, 0xA805], [0xA807, 0xA80A], [0xA80C, 0xA827], [0xA840, 0xA873], [0xA880, 0xA8C3], [0xA8F2, 0xA8F7], 0xA8FB, [0xA90A, 0xA92A], [0xA930, 0xA952], [0xA960, 0xA97C], [0xA980, 0xA9B2], [0xA9B4, 0xA9BF], 0xA9CF, [0xA9E0, 0xA9E4], [0xA9E6, 0xA9EF], [0xA9FA, 0xA9FE], [0xAA00, 0xAA36], [0xAA40, 0xAA4D], [0xAA60, 0xAA76], 0xAA7A, [0xAA7E, 0xAABE], 0xAAC0, 0xAAC2, [0xAADB, 0xAADD], [0xAAE0, 0xAAEF], [0xAAF2, 0xAAF5], [0xAB01, 0xAB06], [0xAB09, 0xAB0E], [0xAB11, 0xAB16], [0xAB20, 0xAB26], [0xAB28, 0xAB2E], [0xAB30, 0xAB5A], [0xAB5C, 0xAB5F], 0xAB64, 0xAB65, [0xABC0, 0xABEA], [0xAC00, 0xD7A3], [0xD7B0, 0xD7C6], [0xD7CB, 0xD7FB], [0xF900, 0xFA6D], [0xFA70, 0xFAD9], [0xFB00, 0xFB06], [0xFB13, 0xFB17], [0xFB1D, 0xFB28], [0xFB2A, 0xFB36], [0xFB38, 0xFB3C], 0xFB3E, 0xFB40, 0xFB41, 0xFB43, 0xFB44, [0xFB46, 0xFBB1], [0xFBD3, 0xFD3D], [0xFD50, 0xFD8F], [0xFD92, 0xFDC7], [0xFDF0, 0xFDFB], [0xFE70, 0xFE74], [0xFE76, 0xFEFC], [0xFF21, 0xFF3A], [0xFF41, 0xFF5A], [0xFF66, 0xFFBE], [0xFFC2, 0xFFC7], [0xFFCA, 0xFFCF], [0xFFD2, 0xFFD7], [0xFFDA, 0xFFDC], [0x10000, 0x1000B], [0x1000D, 0x10026], [0x10028, 0x1003A], 0x1003C, 0x1003D, [0x1003F, 0x1004D], [0x10050, 0x1005D], [0x10080, 0x100FA], [0x10140, 0x10174], [0x10280, 0x1029C], [0x102A0, 0x102D0], [0x10300, 0x1031F], [0x10330, 0x1034A], [0x10350, 0x1037A], [0x10380, 0x1039D], [0x103A0, 0x103C3], [0x103C8, 0x103CF], [0x103D1, 0x103D5], [0x10400, 0x1049D], [0x10500, 0x10527], [0x10530, 0x10563], [0x10600, 0x10736], [0x10740, 0x10755], [0x10760, 0x10767], [0x10800, 0x10805], 0x10808, [0x1080A, 0x10835], 0x10837, 0x10838, 0x1083C, [0x1083F, 0x10855], [0x10860, 0x10876], [0x10880, 0x1089E], [0x10900, 0x10915], [0x10920, 0x10939], [0x10980, 0x109B7], 0x109BE, 0x109BF, [0x10A00, 0x10A03], 0x10A05, 0x10A06, [0x10A0C, 0x10A13], [0x10A15, 0x10A17], [0x10A19, 0x10A33], [0x10A60, 0x10A7C], [0x10A80, 0x10A9C], [0x10AC0, 0x10AC7], [0x10AC9, 0x10AE4], [0x10B00, 0x10B35], [0x10B40, 0x10B55], [0x10B60, 0x10B72], [0x10B80, 0x10B91], [0x10C00, 0x10C48], [0x11000, 0x11045], [0x11082, 0x110B8], [0x110D0, 0x110E8], [0x11100, 0x11132], [0x11150, 0x11172], 0x11176, [0x11180, 0x111BF], [0x111C1, 0x111C4], 0x111DA, [0x11200, 0x11211], [0x11213, 0x11234], 0x11237, [0x112B0, 0x112E8], [0x11301, 0x11303], [0x11305, 0x1130C], 0x1130F, 0x11310, [0x11313, 0x11328], [0x1132A, 0x11330], 0x11332, 0x11333, [0x11335, 0x11339], [0x1133D, 0x11344], 0x11347, 0x11348, 0x1134B, 0x1134C, 0x11357, [0x1135D, 0x11363], [0x11480, 0x114C1], 0x114C4, 0x114C5, 0x114C7, [0x11580, 0x115B5], [0x115B8, 0x115BE], [0x11600, 0x1163E], 0x11640, 0x11644, [0x11680, 0x116B5], [0x118A0, 0x118DF], 0x118FF, [0x11AC0, 0x11AF8], [0x12000, 0x12398], [0x12400, 0x1246E], [0x13000, 0x1342E], [0x16800, 0x16A38], [0x16A40, 0x16A5E], [0x16AD0, 0x16AED], [0x16B00, 0x16B36], [0x16B40, 0x16B43], [0x16B63, 0x16B77], [0x16B7D, 0x16B8F], [0x16F00, 0x16F44], [0x16F50, 0x16F7E], [0x16F93, 0x16F9F], 0x1B000, 0x1B001, [0x1BC00, 0x1BC6A], [0x1BC70, 0x1BC7C], [0x1BC80, 0x1BC88], [0x1BC90, 0x1BC99], 0x1BC9E, [0x1D400, 0x1D454], [0x1D456, 0x1D49C], 0x1D49E, 0x1D49F, 0x1D4A2, 0x1D4A5, 0x1D4A6, [0x1D4A9, 0x1D4AC], [0x1D4AE, 0x1D4B9], 0x1D4BB, [0x1D4BD, 0x1D4C3], [0x1D4C5, 0x1D505], [0x1D507, 0x1D50A], [0x1D50D, 0x1D514], [0x1D516, 0x1D51C], [0x1D51E, 0x1D539], [0x1D53B, 0x1D53E], [0x1D540, 0x1D544], 0x1D546, [0x1D54A, 0x1D550], [0x1D552, 0x1D6A5], [0x1D6A8, 0x1D6C0], [0x1D6C2, 0x1D6DA], [0x1D6DC, 0x1D6FA], [0x1D6FC, 0x1D714], [0x1D716, 0x1D734], [0x1D736, 0x1D74E], [0x1D750, 0x1D76E], [0x1D770, 0x1D788], [0x1D78A, 0x1D7A8], [0x1D7AA, 0x1D7C2], [0x1D7C4, 0x1D7CB], [0x1E800, 0x1E8C4], [0x1EE00, 0x1EE03], [0x1EE05, 0x1EE1F], 0x1EE21, 0x1EE22, 0x1EE24, 0x1EE27, [0x1EE29, 0x1EE32], [0x1EE34, 0x1EE37], 0x1EE39, 0x1EE3B, 0x1EE42, 0x1EE47, 0x1EE49, 0x1EE4B, [0x1EE4D, 0x1EE4F], 0x1EE51, 0x1EE52, 0x1EE54, 0x1EE57, 0x1EE59, 0x1EE5B, 0x1EE5D, 0x1EE5F, 0x1EE61, 0x1EE62, 0x1EE64, [0x1EE67, 0x1EE6A], [0x1EE6C, 0x1EE72], [0x1EE74, 0x1EE77], [0x1EE79, 0x1EE7C], 0x1EE7E, [0x1EE80, 0x1EE89], [0x1EE8B, 0x1EE9B], [0x1EEA1, 0x1EEA3], [0x1EEA5, 0x1EEA9], [0x1EEAB, 0x1EEBB], [0x1F130, 0x1F149], [0x1F150, 0x1F169], [0x1F170, 0x1F189], [0x20000, 0x2A6D6], [0x2A700, 0x2B734], [0x2B740, 0x2B81D], [0x2F800, 0x2FA1D]]
};

// This file is GENERATED by tools/unicodejs-properties.py
// DO NOT EDIT
unicodeJS.derivedgeneralcategories = {
	// partial extraction only
	M: [[0x0300, 0x036F], [0x0483, 0x0489], [0x0591, 0x05BD], 0x05BF, 0x05C1, 0x05C2, 0x05C4, 0x05C5, 0x05C7, [0x0610, 0x061A], [0x064B, 0x065F], 0x0670, [0x06D6, 0x06DC], [0x06DF, 0x06E4], 0x06E7, 0x06E8, [0x06EA, 0x06ED], 0x0711, [0x0730, 0x074A], [0x07A6, 0x07B0], [0x07EB, 0x07F3], [0x0816, 0x0819], [0x081B, 0x0823], [0x0825, 0x0827], [0x0829, 0x082D], [0x0859, 0x085B], [0x08E4, 0x0903], [0x093A, 0x093C], [0x093E, 0x094F], [0x0951, 0x0957], 0x0962, 0x0963, [0x0981, 0x0983], 0x09BC, [0x09BE, 0x09C4], 0x09C7, 0x09C8, [0x09CB, 0x09CD], 0x09D7, 0x09E2, 0x09E3, [0x0A01, 0x0A03], 0x0A3C, [0x0A3E, 0x0A42], 0x0A47, 0x0A48, [0x0A4B, 0x0A4D], 0x0A51, 0x0A70, 0x0A71, 0x0A75, [0x0A81, 0x0A83], 0x0ABC, [0x0ABE, 0x0AC5], [0x0AC7, 0x0AC9], [0x0ACB, 0x0ACD], 0x0AE2, 0x0AE3, [0x0B01, 0x0B03], 0x0B3C, [0x0B3E, 0x0B44], 0x0B47, 0x0B48, [0x0B4B, 0x0B4D], 0x0B56, 0x0B57, 0x0B62, 0x0B63, 0x0B82, [0x0BBE, 0x0BC2], [0x0BC6, 0x0BC8], [0x0BCA, 0x0BCD], 0x0BD7, [0x0C00, 0x0C03], [0x0C3E, 0x0C44], [0x0C46, 0x0C48], [0x0C4A, 0x0C4D], 0x0C55, 0x0C56, 0x0C62, 0x0C63, [0x0C81, 0x0C83], 0x0CBC, [0x0CBE, 0x0CC4], [0x0CC6, 0x0CC8], [0x0CCA, 0x0CCD], 0x0CD5, 0x0CD6, 0x0CE2, 0x0CE3, [0x0D01, 0x0D03], [0x0D3E, 0x0D44], [0x0D46, 0x0D48], [0x0D4A, 0x0D4D], 0x0D57, 0x0D62, 0x0D63, 0x0D82, 0x0D83, 0x0DCA, [0x0DCF, 0x0DD4], 0x0DD6, [0x0DD8, 0x0DDF], 0x0DF2, 0x0DF3, 0x0E31, [0x0E34, 0x0E3A], [0x0E47, 0x0E4E], 0x0EB1, [0x0EB4, 0x0EB9], 0x0EBB, 0x0EBC, [0x0EC8, 0x0ECD], 0x0F18, 0x0F19, 0x0F35, 0x0F37, 0x0F39, 0x0F3E, 0x0F3F, [0x0F71, 0x0F84], 0x0F86, 0x0F87, [0x0F8D, 0x0F97], [0x0F99, 0x0FBC], 0x0FC6, [0x102B, 0x103E], [0x1056, 0x1059], [0x105E, 0x1060], [0x1062, 0x1064], [0x1067, 0x106D], [0x1071, 0x1074], [0x1082, 0x108D], 0x108F, [0x109A, 0x109D], [0x135D, 0x135F], [0x1712, 0x1714], [0x1732, 0x1734], 0x1752, 0x1753, 0x1772, 0x1773, [0x17B4, 0x17D3], 0x17DD, [0x180B, 0x180D], 0x18A9, [0x1920, 0x192B], [0x1930, 0x193B], [0x19B0, 0x19C0], 0x19C8, 0x19C9, [0x1A17, 0x1A1B], [0x1A55, 0x1A5E], [0x1A60, 0x1A7C], 0x1A7F, [0x1AB0, 0x1ABE], [0x1B00, 0x1B04], [0x1B34, 0x1B44], [0x1B6B, 0x1B73], [0x1B80, 0x1B82], [0x1BA1, 0x1BAD], [0x1BE6, 0x1BF3], [0x1C24, 0x1C37], [0x1CD0, 0x1CD2], [0x1CD4, 0x1CE8], 0x1CED, [0x1CF2, 0x1CF4], 0x1CF8, 0x1CF9, [0x1DC0, 0x1DF5], [0x1DFC, 0x1DFF], [0x20D0, 0x20F0], [0x2CEF, 0x2CF1], 0x2D7F, [0x2DE0, 0x2DFF], [0x302A, 0x302F], 0x3099, 0x309A, [0xA66F, 0xA672], [0xA674, 0xA67D], 0xA69F, 0xA6F0, 0xA6F1, 0xA802, 0xA806, 0xA80B, [0xA823, 0xA827], 0xA880, 0xA881, [0xA8B4, 0xA8C4], [0xA8E0, 0xA8F1], [0xA926, 0xA92D], [0xA947, 0xA953], [0xA980, 0xA983], [0xA9B3, 0xA9C0], 0xA9E5, [0xAA29, 0xAA36], 0xAA43, 0xAA4C, 0xAA4D, [0xAA7B, 0xAA7D], 0xAAB0, [0xAAB2, 0xAAB4], 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1, [0xAAEB, 0xAAEF], 0xAAF5, 0xAAF6, [0xABE3, 0xABEA], 0xABEC, 0xABED, 0xFB1E, [0xFE00, 0xFE0F], [0xFE20, 0xFE2D], 0x101FD, 0x102E0, [0x10376, 0x1037A], [0x10A01, 0x10A03], 0x10A05, 0x10A06, [0x10A0C, 0x10A0F], [0x10A38, 0x10A3A], 0x10A3F, 0x10AE5, 0x10AE6, [0x11000, 0x11002], [0x11038, 0x11046], [0x1107F, 0x11082], [0x110B0, 0x110BA], [0x11100, 0x11102], [0x11127, 0x11134], 0x11173, [0x11180, 0x11182], [0x111B3, 0x111C0], [0x1122C, 0x11237], [0x112DF, 0x112EA], [0x11301, 0x11303], 0x1133C, [0x1133E, 0x11344], 0x11347, 0x11348, [0x1134B, 0x1134D], 0x11357, 0x11362, 0x11363, [0x11366, 0x1136C], [0x11370, 0x11374], [0x114B0, 0x114C3], [0x115AF, 0x115B5], [0x115B8, 0x115C0], [0x11630, 0x11640], [0x116AB, 0x116B7], [0x16AF0, 0x16AF4], [0x16B30, 0x16B36], [0x16F51, 0x16F7E], [0x16F8F, 0x16F92], 0x1BC9D, 0x1BC9E, [0x1D165, 0x1D169], [0x1D16D, 0x1D172], [0x1D17B, 0x1D182], [0x1D185, 0x1D18B], [0x1D1AA, 0x1D1AD], [0x1D242, 0x1D244], [0x1E8D0, 0x1E8D6], [0xE0100, 0xE01EF]],
	Pc: [0x005F, 0x203F, 0x2040, 0x2054, 0xFE33, 0xFE34, [0xFE4D, 0xFE4F], 0xFF3F]
};

/*!
 * UnicodeJS character classes
 *
 * Support for unicode equivalents of JS regex character classes
 *
 * @copyright 2013–2015 UnicodeJS team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */
( function () {
	/**
	 * @class unicodeJS.characterclass
	 * @singleton
	 */
	var basicLatinDigitRange = [ 0x30, 0x39 ],
		joinControlRange = [ 0x200C, 0x200D ],
		characterclass = unicodeJS.characterclass = {};

	characterclass.patterns = {
		// \w is defined in http://unicode.org/reports/tr18/
		word: unicodeJS.charRangeArrayRegexp( [].concat(
			unicodeJS.derivedcoreproperties.Alphabetic,
			unicodeJS.derivedgeneralcategories.M,
			[ basicLatinDigitRange ],
			unicodeJS.derivedgeneralcategories.Pc,
			[ joinControlRange ]
		) )
	};
}() );

/*!
 * UnicodeJS TextString class.
 *
 * @copyright 2013–2015 UnicodeJS team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * This class provides a simple interface to fetching plain text
 * from a data source. The base class reads data from a string, but
 * an extended class could provide access to a more complex structure,
 * e.g. an array or an HTML document tree.
 *
 * @class unicodeJS.TextString
 * @constructor
 * @param {string} text Text
 */
unicodeJS.TextString = function UnicodeJSTextString( text ) {
	this.clusters = unicodeJS.graphemebreak.splitClusters( text );
};

/* Methods */

/**
 * Read grapheme cluster at specified position
 *
 * @method
 * @param {number} position Position to read from
 * @return {string|null} Grapheme cluster, or null if out of bounds
 */
unicodeJS.TextString.prototype.read = function ( position ) {
	var clusterAt = this.clusters[position];
	return clusterAt !== undefined ? clusterAt : null;
};

/**
 * Return number of grapheme clusters in the text string
 *
 * @method
 * @return {number} Number of grapheme clusters
 */
unicodeJS.TextString.prototype.getLength = function () {
	return this.clusters.length;
};

/**
 * Return a sub-TextString
 *
 * @param {number} start Start offset
 * @param {number} end End offset
 * @return {unicodeJS.TextString} New TextString object containing substring
 */
unicodeJS.TextString.prototype.substring = function ( start, end ) {
	var textString = new unicodeJS.TextString( '' );
	textString.clusters = this.clusters.slice( start, end );
	return textString;
};

/**
 * Get as a plain string
 *
 * @return {string} Plain javascript string
 */
unicodeJS.TextString.prototype.getString = function () {
	return this.clusters.join( '' );
};

// This file is GENERATED by tools/unicodejs-properties.py
// DO NOT EDIT
unicodeJS.graphemebreakproperties = {
	CR: [0x000D],
	LF: [0x000A],
	Control: [[0x0000, 0x0009], 0x000B, 0x000C, [0x000E, 0x001F], [0x007F, 0x009F], 0x00AD, [0x0600, 0x0605], 0x061C, 0x06DD, 0x070F, 0x180E, 0x200B, 0x200E, 0x200F, [0x2028, 0x202E], [0x2060, 0x206F], 0xFEFF, [0xFFF0, 0xFFFB], 0x110BD, [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], [0xE0000, 0xE00FF], [0xE01F0, 0xE0FFF]],
	Extend: [[0x0300, 0x036F], [0x0483, 0x0489], [0x0591, 0x05BD], 0x05BF, 0x05C1, 0x05C2, 0x05C4, 0x05C5, 0x05C7, [0x0610, 0x061A], [0x064B, 0x065F], 0x0670, [0x06D6, 0x06DC], [0x06DF, 0x06E4], 0x06E7, 0x06E8, [0x06EA, 0x06ED], 0x0711, [0x0730, 0x074A], [0x07A6, 0x07B0], [0x07EB, 0x07F3], [0x0816, 0x0819], [0x081B, 0x0823], [0x0825, 0x0827], [0x0829, 0x082D], [0x0859, 0x085B], [0x08E4, 0x0902], 0x093A, 0x093C, [0x0941, 0x0948], 0x094D, [0x0951, 0x0957], 0x0962, 0x0963, 0x0981, 0x09BC, 0x09BE, [0x09C1, 0x09C4], 0x09CD, 0x09D7, 0x09E2, 0x09E3, 0x0A01, 0x0A02, 0x0A3C, 0x0A41, 0x0A42, 0x0A47, 0x0A48, [0x0A4B, 0x0A4D], 0x0A51, 0x0A70, 0x0A71, 0x0A75, 0x0A81, 0x0A82, 0x0ABC, [0x0AC1, 0x0AC5], 0x0AC7, 0x0AC8, 0x0ACD, 0x0AE2, 0x0AE3, 0x0B01, 0x0B3C, 0x0B3E, 0x0B3F, [0x0B41, 0x0B44], 0x0B4D, 0x0B56, 0x0B57, 0x0B62, 0x0B63, 0x0B82, 0x0BBE, 0x0BC0, 0x0BCD, 0x0BD7, 0x0C00, [0x0C3E, 0x0C40], [0x0C46, 0x0C48], [0x0C4A, 0x0C4D], 0x0C55, 0x0C56, 0x0C62, 0x0C63, 0x0C81, 0x0CBC, 0x0CBF, 0x0CC2, 0x0CC6, 0x0CCC, 0x0CCD, 0x0CD5, 0x0CD6, 0x0CE2, 0x0CE3, 0x0D01, 0x0D3E, [0x0D41, 0x0D44], 0x0D4D, 0x0D57, 0x0D62, 0x0D63, 0x0DCA, 0x0DCF, [0x0DD2, 0x0DD4], 0x0DD6, 0x0DDF, 0x0E31, [0x0E34, 0x0E3A], [0x0E47, 0x0E4E], 0x0EB1, [0x0EB4, 0x0EB9], 0x0EBB, 0x0EBC, [0x0EC8, 0x0ECD], 0x0F18, 0x0F19, 0x0F35, 0x0F37, 0x0F39, [0x0F71, 0x0F7E], [0x0F80, 0x0F84], 0x0F86, 0x0F87, [0x0F8D, 0x0F97], [0x0F99, 0x0FBC], 0x0FC6, [0x102D, 0x1030], [0x1032, 0x1037], 0x1039, 0x103A, 0x103D, 0x103E, 0x1058, 0x1059, [0x105E, 0x1060], [0x1071, 0x1074], 0x1082, 0x1085, 0x1086, 0x108D, 0x109D, [0x135D, 0x135F], [0x1712, 0x1714], [0x1732, 0x1734], 0x1752, 0x1753, 0x1772, 0x1773, 0x17B4, 0x17B5, [0x17B7, 0x17BD], 0x17C6, [0x17C9, 0x17D3], 0x17DD, [0x180B, 0x180D], 0x18A9, [0x1920, 0x1922], 0x1927, 0x1928, 0x1932, [0x1939, 0x193B], 0x1A17, 0x1A18, 0x1A1B, 0x1A56, [0x1A58, 0x1A5E], 0x1A60, 0x1A62, [0x1A65, 0x1A6C], [0x1A73, 0x1A7C], 0x1A7F, [0x1AB0, 0x1ABE], [0x1B00, 0x1B03], 0x1B34, [0x1B36, 0x1B3A], 0x1B3C, 0x1B42, [0x1B6B, 0x1B73], 0x1B80, 0x1B81, [0x1BA2, 0x1BA5], 0x1BA8, 0x1BA9, [0x1BAB, 0x1BAD], 0x1BE6, 0x1BE8, 0x1BE9, 0x1BED, [0x1BEF, 0x1BF1], [0x1C2C, 0x1C33], 0x1C36, 0x1C37, [0x1CD0, 0x1CD2], [0x1CD4, 0x1CE0], [0x1CE2, 0x1CE8], 0x1CED, 0x1CF4, 0x1CF8, 0x1CF9, [0x1DC0, 0x1DF5], [0x1DFC, 0x1DFF], 0x200C, 0x200D, [0x20D0, 0x20F0], [0x2CEF, 0x2CF1], 0x2D7F, [0x2DE0, 0x2DFF], [0x302A, 0x302F], 0x3099, 0x309A, [0xA66F, 0xA672], [0xA674, 0xA67D], 0xA69F, 0xA6F0, 0xA6F1, 0xA802, 0xA806, 0xA80B, 0xA825, 0xA826, 0xA8C4, [0xA8E0, 0xA8F1], [0xA926, 0xA92D], [0xA947, 0xA951], [0xA980, 0xA982], 0xA9B3, [0xA9B6, 0xA9B9], 0xA9BC, 0xA9E5, [0xAA29, 0xAA2E], 0xAA31, 0xAA32, 0xAA35, 0xAA36, 0xAA43, 0xAA4C, 0xAA7C, 0xAAB0, [0xAAB2, 0xAAB4], 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1, 0xAAEC, 0xAAED, 0xAAF6, 0xABE5, 0xABE8, 0xABED, 0xFB1E, [0xFE00, 0xFE0F], [0xFE20, 0xFE2D], 0xFF9E, 0xFF9F, 0x101FD, 0x102E0, [0x10376, 0x1037A], [0x10A01, 0x10A03], 0x10A05, 0x10A06, [0x10A0C, 0x10A0F], [0x10A38, 0x10A3A], 0x10A3F, 0x10AE5, 0x10AE6, 0x11001, [0x11038, 0x11046], [0x1107F, 0x11081], [0x110B3, 0x110B6], 0x110B9, 0x110BA, [0x11100, 0x11102], [0x11127, 0x1112B], [0x1112D, 0x11134], 0x11173, 0x11180, 0x11181, [0x111B6, 0x111BE], [0x1122F, 0x11231], 0x11234, 0x11236, 0x11237, 0x112DF, [0x112E3, 0x112EA], 0x11301, 0x1133C, 0x1133E, 0x11340, 0x11357, [0x11366, 0x1136C], [0x11370, 0x11374], 0x114B0, [0x114B3, 0x114B8], 0x114BA, 0x114BD, 0x114BF, 0x114C0, 0x114C2, 0x114C3, 0x115AF, [0x115B2, 0x115B5], 0x115BC, 0x115BD, 0x115BF, 0x115C0, [0x11633, 0x1163A], 0x1163D, 0x1163F, 0x11640, 0x116AB, 0x116AD, [0x116B0, 0x116B5], 0x116B7, [0x16AF0, 0x16AF4], [0x16B30, 0x16B36], [0x16F8F, 0x16F92], 0x1BC9D, 0x1BC9E, 0x1D165, [0x1D167, 0x1D169], [0x1D16E, 0x1D172], [0x1D17B, 0x1D182], [0x1D185, 0x1D18B], [0x1D1AA, 0x1D1AD], [0x1D242, 0x1D244], [0x1E8D0, 0x1E8D6], [0xE0100, 0xE01EF]],
	RegionalIndicator: [[0x1F1E6, 0x1F1FF]],
	SpacingMark: [0x0903, 0x093B, [0x093E, 0x0940], [0x0949, 0x094C], 0x094E, 0x094F, 0x0982, 0x0983, 0x09BF, 0x09C0, 0x09C7, 0x09C8, 0x09CB, 0x09CC, 0x0A03, [0x0A3E, 0x0A40], 0x0A83, [0x0ABE, 0x0AC0], 0x0AC9, 0x0ACB, 0x0ACC, 0x0B02, 0x0B03, 0x0B40, 0x0B47, 0x0B48, 0x0B4B, 0x0B4C, 0x0BBF, 0x0BC1, 0x0BC2, [0x0BC6, 0x0BC8], [0x0BCA, 0x0BCC], [0x0C01, 0x0C03], [0x0C41, 0x0C44], 0x0C82, 0x0C83, 0x0CBE, 0x0CC0, 0x0CC1, 0x0CC3, 0x0CC4, 0x0CC7, 0x0CC8, 0x0CCA, 0x0CCB, 0x0D02, 0x0D03, 0x0D3F, 0x0D40, [0x0D46, 0x0D48], [0x0D4A, 0x0D4C], 0x0D82, 0x0D83, 0x0DD0, 0x0DD1, [0x0DD8, 0x0DDE], 0x0DF2, 0x0DF3, 0x0E33, 0x0EB3, 0x0F3E, 0x0F3F, 0x0F7F, 0x1031, 0x103B, 0x103C, 0x1056, 0x1057, 0x1084, 0x17B6, [0x17BE, 0x17C5], 0x17C7, 0x17C8, [0x1923, 0x1926], [0x1929, 0x192B], 0x1930, 0x1931, [0x1933, 0x1938], [0x19B5, 0x19B7], 0x19BA, 0x1A19, 0x1A1A, 0x1A55, 0x1A57, [0x1A6D, 0x1A72], 0x1B04, 0x1B35, 0x1B3B, [0x1B3D, 0x1B41], 0x1B43, 0x1B44, 0x1B82, 0x1BA1, 0x1BA6, 0x1BA7, 0x1BAA, 0x1BE7, [0x1BEA, 0x1BEC], 0x1BEE, 0x1BF2, 0x1BF3, [0x1C24, 0x1C2B], 0x1C34, 0x1C35, 0x1CE1, 0x1CF2, 0x1CF3, 0xA823, 0xA824, 0xA827, 0xA880, 0xA881, [0xA8B4, 0xA8C3], 0xA952, 0xA953, 0xA983, 0xA9B4, 0xA9B5, 0xA9BA, 0xA9BB, [0xA9BD, 0xA9C0], 0xAA2F, 0xAA30, 0xAA33, 0xAA34, 0xAA4D, 0xAAEB, 0xAAEE, 0xAAEF, 0xAAF5, 0xABE3, 0xABE4, 0xABE6, 0xABE7, 0xABE9, 0xABEA, 0xABEC, 0x11000, 0x11002, 0x11082, [0x110B0, 0x110B2], 0x110B7, 0x110B8, 0x1112C, 0x11182, [0x111B3, 0x111B5], 0x111BF, 0x111C0, [0x1122C, 0x1122E], 0x11232, 0x11233, 0x11235, [0x112E0, 0x112E2], 0x11302, 0x11303, 0x1133F, [0x11341, 0x11344], 0x11347, 0x11348, [0x1134B, 0x1134D], 0x11362, 0x11363, 0x114B1, 0x114B2, 0x114B9, 0x114BB, 0x114BC, 0x114BE, 0x114C1, 0x115B0, 0x115B1, [0x115B8, 0x115BB], 0x115BE, [0x11630, 0x11632], 0x1163B, 0x1163C, 0x1163E, 0x116AC, 0x116AE, 0x116AF, 0x116B6, [0x16F51, 0x16F7E], 0x1D166, 0x1D16D],
	L: [[0x1100, 0x115F], [0xA960, 0xA97C]],
	V: [[0x1160, 0x11A7], [0xD7B0, 0xD7C6]],
	T: [[0x11A8, 0x11FF], [0xD7CB, 0xD7FB]],
	LV: [0xAC00, 0xAC1C, 0xAC38, 0xAC54, 0xAC70, 0xAC8C, 0xACA8, 0xACC4, 0xACE0, 0xACFC, 0xAD18, 0xAD34, 0xAD50, 0xAD6C, 0xAD88, 0xADA4, 0xADC0, 0xADDC, 0xADF8, 0xAE14, 0xAE30, 0xAE4C, 0xAE68, 0xAE84, 0xAEA0, 0xAEBC, 0xAED8, 0xAEF4, 0xAF10, 0xAF2C, 0xAF48, 0xAF64, 0xAF80, 0xAF9C, 0xAFB8, 0xAFD4, 0xAFF0, 0xB00C, 0xB028, 0xB044, 0xB060, 0xB07C, 0xB098, 0xB0B4, 0xB0D0, 0xB0EC, 0xB108, 0xB124, 0xB140, 0xB15C, 0xB178, 0xB194, 0xB1B0, 0xB1CC, 0xB1E8, 0xB204, 0xB220, 0xB23C, 0xB258, 0xB274, 0xB290, 0xB2AC, 0xB2C8, 0xB2E4, 0xB300, 0xB31C, 0xB338, 0xB354, 0xB370, 0xB38C, 0xB3A8, 0xB3C4, 0xB3E0, 0xB3FC, 0xB418, 0xB434, 0xB450, 0xB46C, 0xB488, 0xB4A4, 0xB4C0, 0xB4DC, 0xB4F8, 0xB514, 0xB530, 0xB54C, 0xB568, 0xB584, 0xB5A0, 0xB5BC, 0xB5D8, 0xB5F4, 0xB610, 0xB62C, 0xB648, 0xB664, 0xB680, 0xB69C, 0xB6B8, 0xB6D4, 0xB6F0, 0xB70C, 0xB728, 0xB744, 0xB760, 0xB77C, 0xB798, 0xB7B4, 0xB7D0, 0xB7EC, 0xB808, 0xB824, 0xB840, 0xB85C, 0xB878, 0xB894, 0xB8B0, 0xB8CC, 0xB8E8, 0xB904, 0xB920, 0xB93C, 0xB958, 0xB974, 0xB990, 0xB9AC, 0xB9C8, 0xB9E4, 0xBA00, 0xBA1C, 0xBA38, 0xBA54, 0xBA70, 0xBA8C, 0xBAA8, 0xBAC4, 0xBAE0, 0xBAFC, 0xBB18, 0xBB34, 0xBB50, 0xBB6C, 0xBB88, 0xBBA4, 0xBBC0, 0xBBDC, 0xBBF8, 0xBC14, 0xBC30, 0xBC4C, 0xBC68, 0xBC84, 0xBCA0, 0xBCBC, 0xBCD8, 0xBCF4, 0xBD10, 0xBD2C, 0xBD48, 0xBD64, 0xBD80, 0xBD9C, 0xBDB8, 0xBDD4, 0xBDF0, 0xBE0C, 0xBE28, 0xBE44, 0xBE60, 0xBE7C, 0xBE98, 0xBEB4, 0xBED0, 0xBEEC, 0xBF08, 0xBF24, 0xBF40, 0xBF5C, 0xBF78, 0xBF94, 0xBFB0, 0xBFCC, 0xBFE8, 0xC004, 0xC020, 0xC03C, 0xC058, 0xC074, 0xC090, 0xC0AC, 0xC0C8, 0xC0E4, 0xC100, 0xC11C, 0xC138, 0xC154, 0xC170, 0xC18C, 0xC1A8, 0xC1C4, 0xC1E0, 0xC1FC, 0xC218, 0xC234, 0xC250, 0xC26C, 0xC288, 0xC2A4, 0xC2C0, 0xC2DC, 0xC2F8, 0xC314, 0xC330, 0xC34C, 0xC368, 0xC384, 0xC3A0, 0xC3BC, 0xC3D8, 0xC3F4, 0xC410, 0xC42C, 0xC448, 0xC464, 0xC480, 0xC49C, 0xC4B8, 0xC4D4, 0xC4F0, 0xC50C, 0xC528, 0xC544, 0xC560, 0xC57C, 0xC598, 0xC5B4, 0xC5D0, 0xC5EC, 0xC608, 0xC624, 0xC640, 0xC65C, 0xC678, 0xC694, 0xC6B0, 0xC6CC, 0xC6E8, 0xC704, 0xC720, 0xC73C, 0xC758, 0xC774, 0xC790, 0xC7AC, 0xC7C8, 0xC7E4, 0xC800, 0xC81C, 0xC838, 0xC854, 0xC870, 0xC88C, 0xC8A8, 0xC8C4, 0xC8E0, 0xC8FC, 0xC918, 0xC934, 0xC950, 0xC96C, 0xC988, 0xC9A4, 0xC9C0, 0xC9DC, 0xC9F8, 0xCA14, 0xCA30, 0xCA4C, 0xCA68, 0xCA84, 0xCAA0, 0xCABC, 0xCAD8, 0xCAF4, 0xCB10, 0xCB2C, 0xCB48, 0xCB64, 0xCB80, 0xCB9C, 0xCBB8, 0xCBD4, 0xCBF0, 0xCC0C, 0xCC28, 0xCC44, 0xCC60, 0xCC7C, 0xCC98, 0xCCB4, 0xCCD0, 0xCCEC, 0xCD08, 0xCD24, 0xCD40, 0xCD5C, 0xCD78, 0xCD94, 0xCDB0, 0xCDCC, 0xCDE8, 0xCE04, 0xCE20, 0xCE3C, 0xCE58, 0xCE74, 0xCE90, 0xCEAC, 0xCEC8, 0xCEE4, 0xCF00, 0xCF1C, 0xCF38, 0xCF54, 0xCF70, 0xCF8C, 0xCFA8, 0xCFC4, 0xCFE0, 0xCFFC, 0xD018, 0xD034, 0xD050, 0xD06C, 0xD088, 0xD0A4, 0xD0C0, 0xD0DC, 0xD0F8, 0xD114, 0xD130, 0xD14C, 0xD168, 0xD184, 0xD1A0, 0xD1BC, 0xD1D8, 0xD1F4, 0xD210, 0xD22C, 0xD248, 0xD264, 0xD280, 0xD29C, 0xD2B8, 0xD2D4, 0xD2F0, 0xD30C, 0xD328, 0xD344, 0xD360, 0xD37C, 0xD398, 0xD3B4, 0xD3D0, 0xD3EC, 0xD408, 0xD424, 0xD440, 0xD45C, 0xD478, 0xD494, 0xD4B0, 0xD4CC, 0xD4E8, 0xD504, 0xD520, 0xD53C, 0xD558, 0xD574, 0xD590, 0xD5AC, 0xD5C8, 0xD5E4, 0xD600, 0xD61C, 0xD638, 0xD654, 0xD670, 0xD68C, 0xD6A8, 0xD6C4, 0xD6E0, 0xD6FC, 0xD718, 0xD734, 0xD750, 0xD76C, 0xD788],
	LVT: [[0xAC01, 0xAC1B], [0xAC1D, 0xAC37], [0xAC39, 0xAC53], [0xAC55, 0xAC6F], [0xAC71, 0xAC8B], [0xAC8D, 0xACA7], [0xACA9, 0xACC3], [0xACC5, 0xACDF], [0xACE1, 0xACFB], [0xACFD, 0xAD17], [0xAD19, 0xAD33], [0xAD35, 0xAD4F], [0xAD51, 0xAD6B], [0xAD6D, 0xAD87], [0xAD89, 0xADA3], [0xADA5, 0xADBF], [0xADC1, 0xADDB], [0xADDD, 0xADF7], [0xADF9, 0xAE13], [0xAE15, 0xAE2F], [0xAE31, 0xAE4B], [0xAE4D, 0xAE67], [0xAE69, 0xAE83], [0xAE85, 0xAE9F], [0xAEA1, 0xAEBB], [0xAEBD, 0xAED7], [0xAED9, 0xAEF3], [0xAEF5, 0xAF0F], [0xAF11, 0xAF2B], [0xAF2D, 0xAF47], [0xAF49, 0xAF63], [0xAF65, 0xAF7F], [0xAF81, 0xAF9B], [0xAF9D, 0xAFB7], [0xAFB9, 0xAFD3], [0xAFD5, 0xAFEF], [0xAFF1, 0xB00B], [0xB00D, 0xB027], [0xB029, 0xB043], [0xB045, 0xB05F], [0xB061, 0xB07B], [0xB07D, 0xB097], [0xB099, 0xB0B3], [0xB0B5, 0xB0CF], [0xB0D1, 0xB0EB], [0xB0ED, 0xB107], [0xB109, 0xB123], [0xB125, 0xB13F], [0xB141, 0xB15B], [0xB15D, 0xB177], [0xB179, 0xB193], [0xB195, 0xB1AF], [0xB1B1, 0xB1CB], [0xB1CD, 0xB1E7], [0xB1E9, 0xB203], [0xB205, 0xB21F], [0xB221, 0xB23B], [0xB23D, 0xB257], [0xB259, 0xB273], [0xB275, 0xB28F], [0xB291, 0xB2AB], [0xB2AD, 0xB2C7], [0xB2C9, 0xB2E3], [0xB2E5, 0xB2FF], [0xB301, 0xB31B], [0xB31D, 0xB337], [0xB339, 0xB353], [0xB355, 0xB36F], [0xB371, 0xB38B], [0xB38D, 0xB3A7], [0xB3A9, 0xB3C3], [0xB3C5, 0xB3DF], [0xB3E1, 0xB3FB], [0xB3FD, 0xB417], [0xB419, 0xB433], [0xB435, 0xB44F], [0xB451, 0xB46B], [0xB46D, 0xB487], [0xB489, 0xB4A3], [0xB4A5, 0xB4BF], [0xB4C1, 0xB4DB], [0xB4DD, 0xB4F7], [0xB4F9, 0xB513], [0xB515, 0xB52F], [0xB531, 0xB54B], [0xB54D, 0xB567], [0xB569, 0xB583], [0xB585, 0xB59F], [0xB5A1, 0xB5BB], [0xB5BD, 0xB5D7], [0xB5D9, 0xB5F3], [0xB5F5, 0xB60F], [0xB611, 0xB62B], [0xB62D, 0xB647], [0xB649, 0xB663], [0xB665, 0xB67F], [0xB681, 0xB69B], [0xB69D, 0xB6B7], [0xB6B9, 0xB6D3], [0xB6D5, 0xB6EF], [0xB6F1, 0xB70B], [0xB70D, 0xB727], [0xB729, 0xB743], [0xB745, 0xB75F], [0xB761, 0xB77B], [0xB77D, 0xB797], [0xB799, 0xB7B3], [0xB7B5, 0xB7CF], [0xB7D1, 0xB7EB], [0xB7ED, 0xB807], [0xB809, 0xB823], [0xB825, 0xB83F], [0xB841, 0xB85B], [0xB85D, 0xB877], [0xB879, 0xB893], [0xB895, 0xB8AF], [0xB8B1, 0xB8CB], [0xB8CD, 0xB8E7], [0xB8E9, 0xB903], [0xB905, 0xB91F], [0xB921, 0xB93B], [0xB93D, 0xB957], [0xB959, 0xB973], [0xB975, 0xB98F], [0xB991, 0xB9AB], [0xB9AD, 0xB9C7], [0xB9C9, 0xB9E3], [0xB9E5, 0xB9FF], [0xBA01, 0xBA1B], [0xBA1D, 0xBA37], [0xBA39, 0xBA53], [0xBA55, 0xBA6F], [0xBA71, 0xBA8B], [0xBA8D, 0xBAA7], [0xBAA9, 0xBAC3], [0xBAC5, 0xBADF], [0xBAE1, 0xBAFB], [0xBAFD, 0xBB17], [0xBB19, 0xBB33], [0xBB35, 0xBB4F], [0xBB51, 0xBB6B], [0xBB6D, 0xBB87], [0xBB89, 0xBBA3], [0xBBA5, 0xBBBF], [0xBBC1, 0xBBDB], [0xBBDD, 0xBBF7], [0xBBF9, 0xBC13], [0xBC15, 0xBC2F], [0xBC31, 0xBC4B], [0xBC4D, 0xBC67], [0xBC69, 0xBC83], [0xBC85, 0xBC9F], [0xBCA1, 0xBCBB], [0xBCBD, 0xBCD7], [0xBCD9, 0xBCF3], [0xBCF5, 0xBD0F], [0xBD11, 0xBD2B], [0xBD2D, 0xBD47], [0xBD49, 0xBD63], [0xBD65, 0xBD7F], [0xBD81, 0xBD9B], [0xBD9D, 0xBDB7], [0xBDB9, 0xBDD3], [0xBDD5, 0xBDEF], [0xBDF1, 0xBE0B], [0xBE0D, 0xBE27], [0xBE29, 0xBE43], [0xBE45, 0xBE5F], [0xBE61, 0xBE7B], [0xBE7D, 0xBE97], [0xBE99, 0xBEB3], [0xBEB5, 0xBECF], [0xBED1, 0xBEEB], [0xBEED, 0xBF07], [0xBF09, 0xBF23], [0xBF25, 0xBF3F], [0xBF41, 0xBF5B], [0xBF5D, 0xBF77], [0xBF79, 0xBF93], [0xBF95, 0xBFAF], [0xBFB1, 0xBFCB], [0xBFCD, 0xBFE7], [0xBFE9, 0xC003], [0xC005, 0xC01F], [0xC021, 0xC03B], [0xC03D, 0xC057], [0xC059, 0xC073], [0xC075, 0xC08F], [0xC091, 0xC0AB], [0xC0AD, 0xC0C7], [0xC0C9, 0xC0E3], [0xC0E5, 0xC0FF], [0xC101, 0xC11B], [0xC11D, 0xC137], [0xC139, 0xC153], [0xC155, 0xC16F], [0xC171, 0xC18B], [0xC18D, 0xC1A7], [0xC1A9, 0xC1C3], [0xC1C5, 0xC1DF], [0xC1E1, 0xC1FB], [0xC1FD, 0xC217], [0xC219, 0xC233], [0xC235, 0xC24F], [0xC251, 0xC26B], [0xC26D, 0xC287], [0xC289, 0xC2A3], [0xC2A5, 0xC2BF], [0xC2C1, 0xC2DB], [0xC2DD, 0xC2F7], [0xC2F9, 0xC313], [0xC315, 0xC32F], [0xC331, 0xC34B], [0xC34D, 0xC367], [0xC369, 0xC383], [0xC385, 0xC39F], [0xC3A1, 0xC3BB], [0xC3BD, 0xC3D7], [0xC3D9, 0xC3F3], [0xC3F5, 0xC40F], [0xC411, 0xC42B], [0xC42D, 0xC447], [0xC449, 0xC463], [0xC465, 0xC47F], [0xC481, 0xC49B], [0xC49D, 0xC4B7], [0xC4B9, 0xC4D3], [0xC4D5, 0xC4EF], [0xC4F1, 0xC50B], [0xC50D, 0xC527], [0xC529, 0xC543], [0xC545, 0xC55F], [0xC561, 0xC57B], [0xC57D, 0xC597], [0xC599, 0xC5B3], [0xC5B5, 0xC5CF], [0xC5D1, 0xC5EB], [0xC5ED, 0xC607], [0xC609, 0xC623], [0xC625, 0xC63F], [0xC641, 0xC65B], [0xC65D, 0xC677], [0xC679, 0xC693], [0xC695, 0xC6AF], [0xC6B1, 0xC6CB], [0xC6CD, 0xC6E7], [0xC6E9, 0xC703], [0xC705, 0xC71F], [0xC721, 0xC73B], [0xC73D, 0xC757], [0xC759, 0xC773], [0xC775, 0xC78F], [0xC791, 0xC7AB], [0xC7AD, 0xC7C7], [0xC7C9, 0xC7E3], [0xC7E5, 0xC7FF], [0xC801, 0xC81B], [0xC81D, 0xC837], [0xC839, 0xC853], [0xC855, 0xC86F], [0xC871, 0xC88B], [0xC88D, 0xC8A7], [0xC8A9, 0xC8C3], [0xC8C5, 0xC8DF], [0xC8E1, 0xC8FB], [0xC8FD, 0xC917], [0xC919, 0xC933], [0xC935, 0xC94F], [0xC951, 0xC96B], [0xC96D, 0xC987], [0xC989, 0xC9A3], [0xC9A5, 0xC9BF], [0xC9C1, 0xC9DB], [0xC9DD, 0xC9F7], [0xC9F9, 0xCA13], [0xCA15, 0xCA2F], [0xCA31, 0xCA4B], [0xCA4D, 0xCA67], [0xCA69, 0xCA83], [0xCA85, 0xCA9F], [0xCAA1, 0xCABB], [0xCABD, 0xCAD7], [0xCAD9, 0xCAF3], [0xCAF5, 0xCB0F], [0xCB11, 0xCB2B], [0xCB2D, 0xCB47], [0xCB49, 0xCB63], [0xCB65, 0xCB7F], [0xCB81, 0xCB9B], [0xCB9D, 0xCBB7], [0xCBB9, 0xCBD3], [0xCBD5, 0xCBEF], [0xCBF1, 0xCC0B], [0xCC0D, 0xCC27], [0xCC29, 0xCC43], [0xCC45, 0xCC5F], [0xCC61, 0xCC7B], [0xCC7D, 0xCC97], [0xCC99, 0xCCB3], [0xCCB5, 0xCCCF], [0xCCD1, 0xCCEB], [0xCCED, 0xCD07], [0xCD09, 0xCD23], [0xCD25, 0xCD3F], [0xCD41, 0xCD5B], [0xCD5D, 0xCD77], [0xCD79, 0xCD93], [0xCD95, 0xCDAF], [0xCDB1, 0xCDCB], [0xCDCD, 0xCDE7], [0xCDE9, 0xCE03], [0xCE05, 0xCE1F], [0xCE21, 0xCE3B], [0xCE3D, 0xCE57], [0xCE59, 0xCE73], [0xCE75, 0xCE8F], [0xCE91, 0xCEAB], [0xCEAD, 0xCEC7], [0xCEC9, 0xCEE3], [0xCEE5, 0xCEFF], [0xCF01, 0xCF1B], [0xCF1D, 0xCF37], [0xCF39, 0xCF53], [0xCF55, 0xCF6F], [0xCF71, 0xCF8B], [0xCF8D, 0xCFA7], [0xCFA9, 0xCFC3], [0xCFC5, 0xCFDF], [0xCFE1, 0xCFFB], [0xCFFD, 0xD017], [0xD019, 0xD033], [0xD035, 0xD04F], [0xD051, 0xD06B], [0xD06D, 0xD087], [0xD089, 0xD0A3], [0xD0A5, 0xD0BF], [0xD0C1, 0xD0DB], [0xD0DD, 0xD0F7], [0xD0F9, 0xD113], [0xD115, 0xD12F], [0xD131, 0xD14B], [0xD14D, 0xD167], [0xD169, 0xD183], [0xD185, 0xD19F], [0xD1A1, 0xD1BB], [0xD1BD, 0xD1D7], [0xD1D9, 0xD1F3], [0xD1F5, 0xD20F], [0xD211, 0xD22B], [0xD22D, 0xD247], [0xD249, 0xD263], [0xD265, 0xD27F], [0xD281, 0xD29B], [0xD29D, 0xD2B7], [0xD2B9, 0xD2D3], [0xD2D5, 0xD2EF], [0xD2F1, 0xD30B], [0xD30D, 0xD327], [0xD329, 0xD343], [0xD345, 0xD35F], [0xD361, 0xD37B], [0xD37D, 0xD397], [0xD399, 0xD3B3], [0xD3B5, 0xD3CF], [0xD3D1, 0xD3EB], [0xD3ED, 0xD407], [0xD409, 0xD423], [0xD425, 0xD43F], [0xD441, 0xD45B], [0xD45D, 0xD477], [0xD479, 0xD493], [0xD495, 0xD4AF], [0xD4B1, 0xD4CB], [0xD4CD, 0xD4E7], [0xD4E9, 0xD503], [0xD505, 0xD51F], [0xD521, 0xD53B], [0xD53D, 0xD557], [0xD559, 0xD573], [0xD575, 0xD58F], [0xD591, 0xD5AB], [0xD5AD, 0xD5C7], [0xD5C9, 0xD5E3], [0xD5E5, 0xD5FF], [0xD601, 0xD61B], [0xD61D, 0xD637], [0xD639, 0xD653], [0xD655, 0xD66F], [0xD671, 0xD68B], [0xD68D, 0xD6A7], [0xD6A9, 0xD6C3], [0xD6C5, 0xD6DF], [0xD6E1, 0xD6FB], [0xD6FD, 0xD717], [0xD719, 0xD733], [0xD735, 0xD74F], [0xD751, 0xD76B], [0xD76D, 0xD787], [0xD789, 0xD7A3]]
};

/*!
 * UnicodeJS Grapheme Break module
 *
 * Implementation of Unicode 7.0.0 Default Grapheme Cluster Boundary Specification
 * http://www.unicode.org/reports/tr29/#Default_Grapheme_Cluster_Table
 *
 * @copyright 2013–2015 UnicodeJS team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */
( function () {
	var property, disjunction, graphemeBreakRegexp,
		properties = unicodeJS.graphemebreakproperties,
		// Single unicode character (either a UTF-16 code unit or a surrogate pair)
		oneCharacter = '[^\\ud800-\\udfff]|[\\ud800-\\udbff][\\udc00-\\udfff]',
		/**
		 * @class unicodeJS.graphemebreak
		 * @singleton
		 */
		graphemebreak = unicodeJS.graphemebreak = {},
		patterns = {};

	// build regexes
	for ( property in properties ) {
		patterns[property] = unicodeJS.charRangeArrayRegexp( properties[property] );
	}

	// build disjunction for grapheme cluster split
	// See http://www.unicode.org/reports/tr29/ at "Grapheme Cluster Boundary Rules"
	disjunction = [
		// Break at the start and end of text.
		// GB1: sot ÷
		// GB2: ÷ eot
		// GB1 and GB2 are trivially satisfied

		// Do not break between a CR and LF. Otherwise, break before and after controls.
		// GB3: CR × LF
		'\\r\\n',

		// GB4: ( Control | CR | LF ) ÷
		// GB5: ÷ ( Control | CR | LF )
		patterns.Control,

		// Do not break Hangul syllable sequences.
		// GB6: L × ( L | V | LV | LVT )
		// GB7: ( LV | V ) × ( V | T )
		// GB8: ( LVT | T ) × T
		'(?:' + patterns.L + ')*' +
		'(?:' + patterns.V + ')+' +
		'(?:' + patterns.T + ')*',

		'(?:' + patterns.L + ')*' +
		'(?:' + patterns.LV + ')' +
		'(?:' + patterns.V + ')*' +
		'(?:' + patterns.T + ')*',

		'(?:' + patterns.L + ')*' +
		'(?:' + patterns.LVT + ')' +
		'(?:' + patterns.T + ')*',

		'(?:' + patterns.L + ')+',

		'(?:' + patterns.T + ')+',

		// Do not break between regional indicator symbols.
		// GB8a: Regional_Indicator × Regional_Indicator
		'(?:' + patterns.RegionalIndicator + ')+',

		// Do not break before extending characters.
		// GB9: × Extend

		// Only for extended grapheme clusters:
		// Do not break before SpacingMarks, or after Prepend characters.
		// GB9a: × SpacingMark
		// GB9b: Prepend ×
		// As of Unicode 7.0.0, no characters are "Prepend"
		// TODO: this will break if the extended thing is not oneCharacter
		// e.g. hangul jamo L+V+T. Does it matter?
		'(?:' + oneCharacter + ')' +
		'(?:' + patterns.Extend + '|' +
		patterns.SpacingMark + ')+',

		// Otherwise, break everywhere.
		// GB10: Any ÷ Any
		// Taking care not to split surrogates
		oneCharacter
	];
	graphemeBreakRegexp = new RegExp( '(' + disjunction.join( '|' ) + ')' );

	/**
	 * Split a string into grapheme clusters.
	 *
	 * @param {string} text Text to split
	 * @return {string[]} Array of clusters
	 */
	graphemebreak.splitClusters = function ( text ) {
		var i, parts, length, clusters = [];
		parts = text.split( graphemeBreakRegexp );
		for ( i = 0, length = parts.length; i < length; i++ ) {
			if ( parts[i] !== '' ) {
				clusters.push( parts[i] );
			}
		}
		return clusters;
	};
}() );

// This file is GENERATED by tools/unicodejs-properties.py
// DO NOT EDIT
unicodeJS.wordbreakproperties = {
	DoubleQuote: [0x0022],
	SingleQuote: [0x0027],
	HebrewLetter: [[0x05D0, 0x05EA], [0x05F0, 0x05F2], 0xFB1D, [0xFB1F, 0xFB28], [0xFB2A, 0xFB36], [0xFB38, 0xFB3C], 0xFB3E, 0xFB40, 0xFB41, 0xFB43, 0xFB44, [0xFB46, 0xFB4F]],
	CR: [0x000D],
	LF: [0x000A],
	Newline: [0x000B, 0x000C, 0x0085, 0x2028, 0x2029],
	Extend: [[0x0300, 0x036F], [0x0483, 0x0489], [0x0591, 0x05BD], 0x05BF, 0x05C1, 0x05C2, 0x05C4, 0x05C5, 0x05C7, [0x0610, 0x061A], [0x064B, 0x065F], 0x0670, [0x06D6, 0x06DC], [0x06DF, 0x06E4], 0x06E7, 0x06E8, [0x06EA, 0x06ED], 0x0711, [0x0730, 0x074A], [0x07A6, 0x07B0], [0x07EB, 0x07F3], [0x0816, 0x0819], [0x081B, 0x0823], [0x0825, 0x0827], [0x0829, 0x082D], [0x0859, 0x085B], [0x08E4, 0x0903], [0x093A, 0x093C], [0x093E, 0x094F], [0x0951, 0x0957], 0x0962, 0x0963, [0x0981, 0x0983], 0x09BC, [0x09BE, 0x09C4], 0x09C7, 0x09C8, [0x09CB, 0x09CD], 0x09D7, 0x09E2, 0x09E3, [0x0A01, 0x0A03], 0x0A3C, [0x0A3E, 0x0A42], 0x0A47, 0x0A48, [0x0A4B, 0x0A4D], 0x0A51, 0x0A70, 0x0A71, 0x0A75, [0x0A81, 0x0A83], 0x0ABC, [0x0ABE, 0x0AC5], [0x0AC7, 0x0AC9], [0x0ACB, 0x0ACD], 0x0AE2, 0x0AE3, [0x0B01, 0x0B03], 0x0B3C, [0x0B3E, 0x0B44], 0x0B47, 0x0B48, [0x0B4B, 0x0B4D], 0x0B56, 0x0B57, 0x0B62, 0x0B63, 0x0B82, [0x0BBE, 0x0BC2], [0x0BC6, 0x0BC8], [0x0BCA, 0x0BCD], 0x0BD7, [0x0C00, 0x0C03], [0x0C3E, 0x0C44], [0x0C46, 0x0C48], [0x0C4A, 0x0C4D], 0x0C55, 0x0C56, 0x0C62, 0x0C63, [0x0C81, 0x0C83], 0x0CBC, [0x0CBE, 0x0CC4], [0x0CC6, 0x0CC8], [0x0CCA, 0x0CCD], 0x0CD5, 0x0CD6, 0x0CE2, 0x0CE3, [0x0D01, 0x0D03], [0x0D3E, 0x0D44], [0x0D46, 0x0D48], [0x0D4A, 0x0D4D], 0x0D57, 0x0D62, 0x0D63, 0x0D82, 0x0D83, 0x0DCA, [0x0DCF, 0x0DD4], 0x0DD6, [0x0DD8, 0x0DDF], 0x0DF2, 0x0DF3, 0x0E31, [0x0E34, 0x0E3A], [0x0E47, 0x0E4E], 0x0EB1, [0x0EB4, 0x0EB9], 0x0EBB, 0x0EBC, [0x0EC8, 0x0ECD], 0x0F18, 0x0F19, 0x0F35, 0x0F37, 0x0F39, 0x0F3E, 0x0F3F, [0x0F71, 0x0F84], 0x0F86, 0x0F87, [0x0F8D, 0x0F97], [0x0F99, 0x0FBC], 0x0FC6, [0x102B, 0x103E], [0x1056, 0x1059], [0x105E, 0x1060], [0x1062, 0x1064], [0x1067, 0x106D], [0x1071, 0x1074], [0x1082, 0x108D], 0x108F, [0x109A, 0x109D], [0x135D, 0x135F], [0x1712, 0x1714], [0x1732, 0x1734], 0x1752, 0x1753, 0x1772, 0x1773, [0x17B4, 0x17D3], 0x17DD, [0x180B, 0x180D], 0x18A9, [0x1920, 0x192B], [0x1930, 0x193B], [0x19B0, 0x19C0], 0x19C8, 0x19C9, [0x1A17, 0x1A1B], [0x1A55, 0x1A5E], [0x1A60, 0x1A7C], 0x1A7F, [0x1AB0, 0x1ABE], [0x1B00, 0x1B04], [0x1B34, 0x1B44], [0x1B6B, 0x1B73], [0x1B80, 0x1B82], [0x1BA1, 0x1BAD], [0x1BE6, 0x1BF3], [0x1C24, 0x1C37], [0x1CD0, 0x1CD2], [0x1CD4, 0x1CE8], 0x1CED, [0x1CF2, 0x1CF4], 0x1CF8, 0x1CF9, [0x1DC0, 0x1DF5], [0x1DFC, 0x1DFF], 0x200C, 0x200D, [0x20D0, 0x20F0], [0x2CEF, 0x2CF1], 0x2D7F, [0x2DE0, 0x2DFF], [0x302A, 0x302F], 0x3099, 0x309A, [0xA66F, 0xA672], [0xA674, 0xA67D], 0xA69F, 0xA6F0, 0xA6F1, 0xA802, 0xA806, 0xA80B, [0xA823, 0xA827], 0xA880, 0xA881, [0xA8B4, 0xA8C4], [0xA8E0, 0xA8F1], [0xA926, 0xA92D], [0xA947, 0xA953], [0xA980, 0xA983], [0xA9B3, 0xA9C0], 0xA9E5, [0xAA29, 0xAA36], 0xAA43, 0xAA4C, 0xAA4D, [0xAA7B, 0xAA7D], 0xAAB0, [0xAAB2, 0xAAB4], 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1, [0xAAEB, 0xAAEF], 0xAAF5, 0xAAF6, [0xABE3, 0xABEA], 0xABEC, 0xABED, 0xFB1E, [0xFE00, 0xFE0F], [0xFE20, 0xFE2D], 0xFF9E, 0xFF9F, 0x101FD, 0x102E0, [0x10376, 0x1037A], [0x10A01, 0x10A03], 0x10A05, 0x10A06, [0x10A0C, 0x10A0F], [0x10A38, 0x10A3A], 0x10A3F, 0x10AE5, 0x10AE6, [0x11000, 0x11002], [0x11038, 0x11046], [0x1107F, 0x11082], [0x110B0, 0x110BA], [0x11100, 0x11102], [0x11127, 0x11134], 0x11173, [0x11180, 0x11182], [0x111B3, 0x111C0], [0x1122C, 0x11237], [0x112DF, 0x112EA], [0x11301, 0x11303], 0x1133C, [0x1133E, 0x11344], 0x11347, 0x11348, [0x1134B, 0x1134D], 0x11357, 0x11362, 0x11363, [0x11366, 0x1136C], [0x11370, 0x11374], [0x114B0, 0x114C3], [0x115AF, 0x115B5], [0x115B8, 0x115C0], [0x11630, 0x11640], [0x116AB, 0x116B7], [0x16AF0, 0x16AF4], [0x16B30, 0x16B36], [0x16F51, 0x16F7E], [0x16F8F, 0x16F92], 0x1BC9D, 0x1BC9E, [0x1D165, 0x1D169], [0x1D16D, 0x1D172], [0x1D17B, 0x1D182], [0x1D185, 0x1D18B], [0x1D1AA, 0x1D1AD], [0x1D242, 0x1D244], [0x1E8D0, 0x1E8D6], [0xE0100, 0xE01EF]],
	RegionalIndicator: [[0x1F1E6, 0x1F1FF]],
	Format: [0x00AD, [0x0600, 0x0605], 0x061C, 0x06DD, 0x070F, 0x180E, 0x200E, 0x200F, [0x202A, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], 0xFEFF, [0xFFF9, 0xFFFB], 0x110BD, [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], 0xE0001, [0xE0020, 0xE007F]],
	Katakana: [[0x3031, 0x3035], 0x309B, 0x309C, [0x30A0, 0x30FA], [0x30FC, 0x30FF], [0x31F0, 0x31FF], [0x32D0, 0x32FE], [0x3300, 0x3357], [0xFF66, 0xFF9D], 0x1B000],
	ALetter: [[0x0041, 0x005A], [0x0061, 0x007A], 0x00AA, 0x00B5, 0x00BA, [0x00C0, 0x00D6], [0x00D8, 0x00F6], [0x00F8, 0x02C1], [0x02C6, 0x02D1], [0x02E0, 0x02E4], 0x02EC, 0x02EE, [0x0370, 0x0374], 0x0376, 0x0377, [0x037A, 0x037D], 0x037F, 0x0386, [0x0388, 0x038A], 0x038C, [0x038E, 0x03A1], [0x03A3, 0x03F5], [0x03F7, 0x0481], [0x048A, 0x052F], [0x0531, 0x0556], 0x0559, [0x0561, 0x0587], 0x05F3, [0x0620, 0x064A], 0x066E, 0x066F, [0x0671, 0x06D3], 0x06D5, 0x06E5, 0x06E6, 0x06EE, 0x06EF, [0x06FA, 0x06FC], 0x06FF, 0x0710, [0x0712, 0x072F], [0x074D, 0x07A5], 0x07B1, [0x07CA, 0x07EA], 0x07F4, 0x07F5, 0x07FA, [0x0800, 0x0815], 0x081A, 0x0824, 0x0828, [0x0840, 0x0858], [0x08A0, 0x08B2], [0x0904, 0x0939], 0x093D, 0x0950, [0x0958, 0x0961], [0x0971, 0x0980], [0x0985, 0x098C], 0x098F, 0x0990, [0x0993, 0x09A8], [0x09AA, 0x09B0], 0x09B2, [0x09B6, 0x09B9], 0x09BD, 0x09CE, 0x09DC, 0x09DD, [0x09DF, 0x09E1], 0x09F0, 0x09F1, [0x0A05, 0x0A0A], 0x0A0F, 0x0A10, [0x0A13, 0x0A28], [0x0A2A, 0x0A30], 0x0A32, 0x0A33, 0x0A35, 0x0A36, 0x0A38, 0x0A39, [0x0A59, 0x0A5C], 0x0A5E, [0x0A72, 0x0A74], [0x0A85, 0x0A8D], [0x0A8F, 0x0A91], [0x0A93, 0x0AA8], [0x0AAA, 0x0AB0], 0x0AB2, 0x0AB3, [0x0AB5, 0x0AB9], 0x0ABD, 0x0AD0, 0x0AE0, 0x0AE1, [0x0B05, 0x0B0C], 0x0B0F, 0x0B10, [0x0B13, 0x0B28], [0x0B2A, 0x0B30], 0x0B32, 0x0B33, [0x0B35, 0x0B39], 0x0B3D, 0x0B5C, 0x0B5D, [0x0B5F, 0x0B61], 0x0B71, 0x0B83, [0x0B85, 0x0B8A], [0x0B8E, 0x0B90], [0x0B92, 0x0B95], 0x0B99, 0x0B9A, 0x0B9C, 0x0B9E, 0x0B9F, 0x0BA3, 0x0BA4, [0x0BA8, 0x0BAA], [0x0BAE, 0x0BB9], 0x0BD0, [0x0C05, 0x0C0C], [0x0C0E, 0x0C10], [0x0C12, 0x0C28], [0x0C2A, 0x0C39], 0x0C3D, 0x0C58, 0x0C59, 0x0C60, 0x0C61, [0x0C85, 0x0C8C], [0x0C8E, 0x0C90], [0x0C92, 0x0CA8], [0x0CAA, 0x0CB3], [0x0CB5, 0x0CB9], 0x0CBD, 0x0CDE, 0x0CE0, 0x0CE1, 0x0CF1, 0x0CF2, [0x0D05, 0x0D0C], [0x0D0E, 0x0D10], [0x0D12, 0x0D3A], 0x0D3D, 0x0D4E, 0x0D60, 0x0D61, [0x0D7A, 0x0D7F], [0x0D85, 0x0D96], [0x0D9A, 0x0DB1], [0x0DB3, 0x0DBB], 0x0DBD, [0x0DC0, 0x0DC6], 0x0F00, [0x0F40, 0x0F47], [0x0F49, 0x0F6C], [0x0F88, 0x0F8C], [0x10A0, 0x10C5], 0x10C7, 0x10CD, [0x10D0, 0x10FA], [0x10FC, 0x1248], [0x124A, 0x124D], [0x1250, 0x1256], 0x1258, [0x125A, 0x125D], [0x1260, 0x1288], [0x128A, 0x128D], [0x1290, 0x12B0], [0x12B2, 0x12B5], [0x12B8, 0x12BE], 0x12C0, [0x12C2, 0x12C5], [0x12C8, 0x12D6], [0x12D8, 0x1310], [0x1312, 0x1315], [0x1318, 0x135A], [0x1380, 0x138F], [0x13A0, 0x13F4], [0x1401, 0x166C], [0x166F, 0x167F], [0x1681, 0x169A], [0x16A0, 0x16EA], [0x16EE, 0x16F8], [0x1700, 0x170C], [0x170E, 0x1711], [0x1720, 0x1731], [0x1740, 0x1751], [0x1760, 0x176C], [0x176E, 0x1770], [0x1820, 0x1877], [0x1880, 0x18A8], 0x18AA, [0x18B0, 0x18F5], [0x1900, 0x191E], [0x1A00, 0x1A16], [0x1B05, 0x1B33], [0x1B45, 0x1B4B], [0x1B83, 0x1BA0], 0x1BAE, 0x1BAF, [0x1BBA, 0x1BE5], [0x1C00, 0x1C23], [0x1C4D, 0x1C4F], [0x1C5A, 0x1C7D], [0x1CE9, 0x1CEC], [0x1CEE, 0x1CF1], 0x1CF5, 0x1CF6, [0x1D00, 0x1DBF], [0x1E00, 0x1F15], [0x1F18, 0x1F1D], [0x1F20, 0x1F45], [0x1F48, 0x1F4D], [0x1F50, 0x1F57], 0x1F59, 0x1F5B, 0x1F5D, [0x1F5F, 0x1F7D], [0x1F80, 0x1FB4], [0x1FB6, 0x1FBC], 0x1FBE, [0x1FC2, 0x1FC4], [0x1FC6, 0x1FCC], [0x1FD0, 0x1FD3], [0x1FD6, 0x1FDB], [0x1FE0, 0x1FEC], [0x1FF2, 0x1FF4], [0x1FF6, 0x1FFC], 0x2071, 0x207F, [0x2090, 0x209C], 0x2102, 0x2107, [0x210A, 0x2113], 0x2115, [0x2119, 0x211D], 0x2124, 0x2126, 0x2128, [0x212A, 0x212D], [0x212F, 0x2139], [0x213C, 0x213F], [0x2145, 0x2149], 0x214E, [0x2160, 0x2188], [0x24B6, 0x24E9], [0x2C00, 0x2C2E], [0x2C30, 0x2C5E], [0x2C60, 0x2CE4], [0x2CEB, 0x2CEE], 0x2CF2, 0x2CF3, [0x2D00, 0x2D25], 0x2D27, 0x2D2D, [0x2D30, 0x2D67], 0x2D6F, [0x2D80, 0x2D96], [0x2DA0, 0x2DA6], [0x2DA8, 0x2DAE], [0x2DB0, 0x2DB6], [0x2DB8, 0x2DBE], [0x2DC0, 0x2DC6], [0x2DC8, 0x2DCE], [0x2DD0, 0x2DD6], [0x2DD8, 0x2DDE], 0x2E2F, 0x3005, 0x303B, 0x303C, [0x3105, 0x312D], [0x3131, 0x318E], [0x31A0, 0x31BA], [0xA000, 0xA48C], [0xA4D0, 0xA4FD], [0xA500, 0xA60C], [0xA610, 0xA61F], 0xA62A, 0xA62B, [0xA640, 0xA66E], [0xA67F, 0xA69D], [0xA6A0, 0xA6EF], [0xA717, 0xA71F], [0xA722, 0xA788], [0xA78B, 0xA78E], [0xA790, 0xA7AD], 0xA7B0, 0xA7B1, [0xA7F7, 0xA801], [0xA803, 0xA805], [0xA807, 0xA80A], [0xA80C, 0xA822], [0xA840, 0xA873], [0xA882, 0xA8B3], [0xA8F2, 0xA8F7], 0xA8FB, [0xA90A, 0xA925], [0xA930, 0xA946], [0xA960, 0xA97C], [0xA984, 0xA9B2], 0xA9CF, [0xAA00, 0xAA28], [0xAA40, 0xAA42], [0xAA44, 0xAA4B], [0xAAE0, 0xAAEA], [0xAAF2, 0xAAF4], [0xAB01, 0xAB06], [0xAB09, 0xAB0E], [0xAB11, 0xAB16], [0xAB20, 0xAB26], [0xAB28, 0xAB2E], [0xAB30, 0xAB5A], [0xAB5C, 0xAB5F], 0xAB64, 0xAB65, [0xABC0, 0xABE2], [0xAC00, 0xD7A3], [0xD7B0, 0xD7C6], [0xD7CB, 0xD7FB], [0xFB00, 0xFB06], [0xFB13, 0xFB17], [0xFB50, 0xFBB1], [0xFBD3, 0xFD3D], [0xFD50, 0xFD8F], [0xFD92, 0xFDC7], [0xFDF0, 0xFDFB], [0xFE70, 0xFE74], [0xFE76, 0xFEFC], [0xFF21, 0xFF3A], [0xFF41, 0xFF5A], [0xFFA0, 0xFFBE], [0xFFC2, 0xFFC7], [0xFFCA, 0xFFCF], [0xFFD2, 0xFFD7], [0xFFDA, 0xFFDC], [0x10000, 0x1000B], [0x1000D, 0x10026], [0x10028, 0x1003A], 0x1003C, 0x1003D, [0x1003F, 0x1004D], [0x10050, 0x1005D], [0x10080, 0x100FA], [0x10140, 0x10174], [0x10280, 0x1029C], [0x102A0, 0x102D0], [0x10300, 0x1031F], [0x10330, 0x1034A], [0x10350, 0x10375], [0x10380, 0x1039D], [0x103A0, 0x103C3], [0x103C8, 0x103CF], [0x103D1, 0x103D5], [0x10400, 0x1049D], [0x10500, 0x10527], [0x10530, 0x10563], [0x10600, 0x10736], [0x10740, 0x10755], [0x10760, 0x10767], [0x10800, 0x10805], 0x10808, [0x1080A, 0x10835], 0x10837, 0x10838, 0x1083C, [0x1083F, 0x10855], [0x10860, 0x10876], [0x10880, 0x1089E], [0x10900, 0x10915], [0x10920, 0x10939], [0x10980, 0x109B7], 0x109BE, 0x109BF, 0x10A00, [0x10A10, 0x10A13], [0x10A15, 0x10A17], [0x10A19, 0x10A33], [0x10A60, 0x10A7C], [0x10A80, 0x10A9C], [0x10AC0, 0x10AC7], [0x10AC9, 0x10AE4], [0x10B00, 0x10B35], [0x10B40, 0x10B55], [0x10B60, 0x10B72], [0x10B80, 0x10B91], [0x10C00, 0x10C48], [0x11003, 0x11037], [0x11083, 0x110AF], [0x110D0, 0x110E8], [0x11103, 0x11126], [0x11150, 0x11172], 0x11176, [0x11183, 0x111B2], [0x111C1, 0x111C4], 0x111DA, [0x11200, 0x11211], [0x11213, 0x1122B], [0x112B0, 0x112DE], [0x11305, 0x1130C], 0x1130F, 0x11310, [0x11313, 0x11328], [0x1132A, 0x11330], 0x11332, 0x11333, [0x11335, 0x11339], 0x1133D, [0x1135D, 0x11361], [0x11480, 0x114AF], 0x114C4, 0x114C5, 0x114C7, [0x11580, 0x115AE], [0x11600, 0x1162F], 0x11644, [0x11680, 0x116AA], [0x118A0, 0x118DF], 0x118FF, [0x11AC0, 0x11AF8], [0x12000, 0x12398], [0x12400, 0x1246E], [0x13000, 0x1342E], [0x16800, 0x16A38], [0x16A40, 0x16A5E], [0x16AD0, 0x16AED], [0x16B00, 0x16B2F], [0x16B40, 0x16B43], [0x16B63, 0x16B77], [0x16B7D, 0x16B8F], [0x16F00, 0x16F44], 0x16F50, [0x16F93, 0x16F9F], [0x1BC00, 0x1BC6A], [0x1BC70, 0x1BC7C], [0x1BC80, 0x1BC88], [0x1BC90, 0x1BC99], [0x1D400, 0x1D454], [0x1D456, 0x1D49C], 0x1D49E, 0x1D49F, 0x1D4A2, 0x1D4A5, 0x1D4A6, [0x1D4A9, 0x1D4AC], [0x1D4AE, 0x1D4B9], 0x1D4BB, [0x1D4BD, 0x1D4C3], [0x1D4C5, 0x1D505], [0x1D507, 0x1D50A], [0x1D50D, 0x1D514], [0x1D516, 0x1D51C], [0x1D51E, 0x1D539], [0x1D53B, 0x1D53E], [0x1D540, 0x1D544], 0x1D546, [0x1D54A, 0x1D550], [0x1D552, 0x1D6A5], [0x1D6A8, 0x1D6C0], [0x1D6C2, 0x1D6DA], [0x1D6DC, 0x1D6FA], [0x1D6FC, 0x1D714], [0x1D716, 0x1D734], [0x1D736, 0x1D74E], [0x1D750, 0x1D76E], [0x1D770, 0x1D788], [0x1D78A, 0x1D7A8], [0x1D7AA, 0x1D7C2], [0x1D7C4, 0x1D7CB], [0x1E800, 0x1E8C4], [0x1EE00, 0x1EE03], [0x1EE05, 0x1EE1F], 0x1EE21, 0x1EE22, 0x1EE24, 0x1EE27, [0x1EE29, 0x1EE32], [0x1EE34, 0x1EE37], 0x1EE39, 0x1EE3B, 0x1EE42, 0x1EE47, 0x1EE49, 0x1EE4B, [0x1EE4D, 0x1EE4F], 0x1EE51, 0x1EE52, 0x1EE54, 0x1EE57, 0x1EE59, 0x1EE5B, 0x1EE5D, 0x1EE5F, 0x1EE61, 0x1EE62, 0x1EE64, [0x1EE67, 0x1EE6A], [0x1EE6C, 0x1EE72], [0x1EE74, 0x1EE77], [0x1EE79, 0x1EE7C], 0x1EE7E, [0x1EE80, 0x1EE89], [0x1EE8B, 0x1EE9B], [0x1EEA1, 0x1EEA3], [0x1EEA5, 0x1EEA9], [0x1EEAB, 0x1EEBB], [0x1F130, 0x1F149], [0x1F150, 0x1F169], [0x1F170, 0x1F189]],
	MidLetter: [0x003A, 0x00B7, 0x02D7, 0x0387, 0x05F4, 0x2027, 0xFE13, 0xFE55, 0xFF1A],
	MidNum: [0x002C, 0x003B, 0x037E, 0x0589, 0x060C, 0x060D, 0x066C, 0x07F8, 0x2044, 0xFE10, 0xFE14, 0xFE50, 0xFE54, 0xFF0C, 0xFF1B],
	MidNumLet: [0x002E, 0x2018, 0x2019, 0x2024, 0xFE52, 0xFF07, 0xFF0E],
	Numeric: [[0x0030, 0x0039], [0x0660, 0x0669], 0x066B, [0x06F0, 0x06F9], [0x07C0, 0x07C9], [0x0966, 0x096F], [0x09E6, 0x09EF], [0x0A66, 0x0A6F], [0x0AE6, 0x0AEF], [0x0B66, 0x0B6F], [0x0BE6, 0x0BEF], [0x0C66, 0x0C6F], [0x0CE6, 0x0CEF], [0x0D66, 0x0D6F], [0x0DE6, 0x0DEF], [0x0E50, 0x0E59], [0x0ED0, 0x0ED9], [0x0F20, 0x0F29], [0x1040, 0x1049], [0x1090, 0x1099], [0x17E0, 0x17E9], [0x1810, 0x1819], [0x1946, 0x194F], [0x19D0, 0x19D9], [0x1A80, 0x1A89], [0x1A90, 0x1A99], [0x1B50, 0x1B59], [0x1BB0, 0x1BB9], [0x1C40, 0x1C49], [0x1C50, 0x1C59], [0xA620, 0xA629], [0xA8D0, 0xA8D9], [0xA900, 0xA909], [0xA9D0, 0xA9D9], [0xA9F0, 0xA9F9], [0xAA50, 0xAA59], [0xABF0, 0xABF9], [0x104A0, 0x104A9], [0x11066, 0x1106F], [0x110F0, 0x110F9], [0x11136, 0x1113F], [0x111D0, 0x111D9], [0x112F0, 0x112F9], [0x114D0, 0x114D9], [0x11650, 0x11659], [0x116C0, 0x116C9], [0x118E0, 0x118E9], [0x16A60, 0x16A69], [0x16B50, 0x16B59], [0x1D7CE, 0x1D7FF]],
	ExtendNumLet: [0x005F, 0x203F, 0x2040, 0x2054, 0xFE33, 0xFE34, [0xFE4D, 0xFE4F], 0xFF3F]
};

/*!
 * UnicodeJS Word Break module
 *
 * Implementation of Unicode 7.0.0 Default Word Boundary Specification
 * http://www.unicode.org/reports/tr29/#Default_Grapheme_Cluster_Table
 *
 * @copyright 2013–2015 UnicodeJS team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */
( function () {
	var property,
		properties = unicodeJS.wordbreakproperties,
		/**
		 * @class unicodeJS.wordbreak
		 * @singleton
		 */
		wordbreak = unicodeJS.wordbreak = {},
		patterns = {};

	// build regexes
	for ( property in properties ) {
		patterns[property] = new RegExp(
			unicodeJS.charRangeArrayRegexp( properties[property] )
		);
	}

	/**
	 * Return the wordbreak property value for the cluster
	 *
	 * This is a slight con, because Unicode wordbreak property values are defined
	 * per character, not per cluster, whereas we're already working with a string
	 * split into clusters.
	 *
	 * We are making a working assumption that we can implement the Unicode
	 * word boundary specification by taking the property value of the *first*
	 * character of the cluster. In particular, this implements WB4 for us, because
	 * non-initial Extend or Format characters disappear.
	 *
	 * See http://www.unicode.org/reports/tr29/#Word_Boundaries
	 *
	 * @private
	 * @param {string} cluster The grapheme cluster
	 * @return {string} The unicode wordbreak property value
	 */
	function getProperty( cluster ) {
		var character, property;
		// cluster is always converted to a string by RegExp#test
		// e.g. null -> 'null' and would match /[a-z]/
		// so return null for any non-string value
		if ( typeof cluster !== 'string' ) {
			return null;
		}
		character = unicodeJS.splitCharacters( cluster )[0];
		for ( property in patterns ) {
			if ( patterns[property].test( character ) ) {
				return property;
			}
		}
		return null;
	}

	/**
	 * Find the next word break offset.
	 * @param {unicodeJS.TextString} string TextString
	 * @param {number} pos Character position
	 * @param {boolean} [onlyAlphaNumeric=false] When set, ignores a break if the previous character is not alphaNumeric
	 * @return {number} Returns the next offset which is a word break
	 */
	wordbreak.nextBreakOffset = function ( string, pos, onlyAlphaNumeric ) {
		return wordbreak.moveBreakOffset( 1, string, pos, onlyAlphaNumeric );
	};

	/**
	 * Find the previous word break offset.
	 * @param {unicodeJS.TextString} string TextString
	 * @param {number} pos Character position
	 * @param {boolean} [onlyAlphaNumeric=false] When set, ignores a break if the previous character is not alphaNumeric
	 * @return {number} Returns the previous offset which is a word break
	 */
	wordbreak.prevBreakOffset = function ( string, pos, onlyAlphaNumeric ) {
		return wordbreak.moveBreakOffset( -1, string, pos, onlyAlphaNumeric );
	};

	/**
	 * Find the next word break offset in a specified direction.
	 * @param {number} direction Direction to search in, should be plus or minus one
	 * @param {unicodeJS.TextString} string TextString
	 * @param {number} pos Character position
	 * @param {boolean} [onlyAlphaNumeric=false] When set, ignores a break if the previous character is not alphaNumeric
	 * @return {number} Returns the previous offset which is word break
	 */
	wordbreak.moveBreakOffset = function ( direction, string, pos, onlyAlphaNumeric ) {
		var lastProperty, i = pos,
			// when moving backwards, use the character to the left of the cursor
			readCharOffset = direction > 0 ? 0 : -1;
		// Search backwards for the previous break point
		while ( string.read( i + readCharOffset ) !== null ) {
			i += direction;
			if ( unicodeJS.wordbreak.isBreak( string, i ) ) {
				// Check previous character was alpha-numeric if required
				if ( onlyAlphaNumeric ) {
					lastProperty = getProperty(
						string.read( i - direction + readCharOffset )
					);
					if ( lastProperty !== 'ALetter' &&
						lastProperty !== 'Numeric' &&
						lastProperty !== 'Katakana' &&
						lastProperty !== 'HebrewLetter' ) {
						continue;
					}
				}
				break;
			}
		}
		return i;
	};

	/**
	 * Evaluates if the specified position within some text is a word boundary.
	 * @param {unicodeJS.TextString} string Text string
	 * @param {number} pos Character position
	 * @return {boolean} Is the position a word boundary
	 */
	wordbreak.isBreak = function ( string, pos ) {
		// Break at the start and end of text.
		// WB1: sot ÷
		// WB2: ÷ eot
		if ( string.read( pos - 1 ) === null || string.read( pos ) === null ) {
			return true;
		}

		// get some context
		var lft = [],
			rgt = [],
			l = 0,
			r = 0;
		rgt.push( getProperty( string.read( pos + r  ) ) );
		lft.push( getProperty( string.read( pos - l - 1 ) ) );

		switch ( true ) {
			// Do not break within CRLF.
			// WB3: CR × LF
			case lft[0] === 'CR' && rgt[0] === 'LF':
				return false;

			// Otherwise break before and after Newlines (including CR and LF)
			// WB3a: (Newline | CR | LF) ÷
			case lft[0] === 'Newline' || lft[0] === 'CR' || lft[0] === 'LF':
			// WB3b: ÷ (Newline | CR | LF)
			case rgt[0] === 'Newline' || rgt[0] === 'CR' || rgt[0] === 'LF':
				return true;
		}

		// Ignore Format and Extend characters, except when they appear at the beginning of a region of text.
		// WB4: X (Extend | Format)* → X
		if ( rgt[0] === 'Extend' || rgt[0] === 'Format' ) {
			// The Extend|Format character is to the right, so it is attached
			// to a character to the left, don't split here
			return false;
		}
		// We've reached the end of an Extend|Format sequence, collapse it
		while ( lft[0] === 'Extend' || lft[0] === 'Format' ) {
			l++;
			if ( pos - l - 1 <= 0 ) {
				// start of document
				return true;
			}
			lft[lft.length - 1] = getProperty( string.read( pos - l - 1 ) );
		}

		// Do not break between most letters.
		// WB5: (ALetter | Hebrew_Letter) × (ALetter | Hebrew_Letter)
		if (
			( lft[0] === 'ALetter' || lft[0] === 'HebrewLetter' ) &&
			( rgt[0] === 'ALetter' || rgt[0] === 'HebrewLetter' )
		) {
			return false;
		}

		// some tests beyond this point require more context
		l++;
		r++;
		rgt.push( getProperty( string.read( pos + r ) ) );
		lft.push( getProperty( string.read( pos - l - 1 ) ) );

		switch ( true ) {
			// Do not break letters across certain punctuation.
			// WB6: (ALetter | Hebrew_Letter) × (MidLetter | MidNumLet | Single_Quote) (ALetter | Hebrew_Letter)
			case ( lft[0] === 'ALetter' || lft[0] === 'HebrewLetter' ) &&
				( rgt[1] === 'ALetter' || rgt[1] === 'HebrewLetter' ) &&
				( rgt[0] === 'MidLetter' || rgt[0] === 'MidNumLet' || rgt[0] === 'SingleQuote' ):
			// WB7: (ALetter | Hebrew_Letter) (MidLetter | MidNumLet | Single_Quote) × (ALetter | Hebrew_Letter)
			case ( rgt[0] === 'ALetter' || rgt[0] === 'HebrewLetter' ) &&
				( lft[1] === 'ALetter' || lft[1] === 'HebrewLetter' ) &&
				( lft[0] === 'MidLetter' || lft[0] === 'MidNumLet' || lft[0] === 'SingleQuote' ):
			// WB7a: Hebrew_Letter × Single_Quote
			case lft[0] === 'HebrewLetter' && rgt[0] === 'SingleQuote':
			// WB7b: Hebrew_Letter × Double_Quote Hebrew_Letter
			case lft[0] === 'HebrewLetter' && rgt[0] === 'DoubleQuote' && rgt[1] === 'HebrewLetter':
			// WB7c: Hebrew_Letter Double_Quote × Hebrew_Letter
			case lft[1] === 'HebrewLetter' && lft[0] === 'DoubleQuote' && rgt[0] === 'HebrewLetter':

			// Do not break within sequences of digits, or digits adjacent to letters (“3a”, or “A3”).
			// WB8: Numeric × Numeric
			case lft[0] === 'Numeric' && rgt[0] === 'Numeric':
			// WB9: (ALetter | Hebrew_Letter) × Numeric
			case ( lft[0] === 'ALetter' || lft[0] === 'HebrewLetter' ) && rgt[0] === 'Numeric':
			// WB10: Numeric × (ALetter | Hebrew_Letter)
			case lft[0] === 'Numeric' && ( rgt[0] === 'ALetter' || rgt[0] === 'HebrewLetter' ):
				return false;

			// Do not break within sequences, such as “3.2” or “3,456.789”.
			// WB11: Numeric (MidNum | MidNumLet | Single_Quote) × Numeric
			case rgt[0] === 'Numeric' && lft[1] === 'Numeric' &&
				( lft[0] === 'MidNum' || lft[0] === 'MidNumLet' || lft[0] === 'SingleQuote' ):
			// WB12: Numeric × (MidNum | MidNumLet | Single_Quote) Numeric
			case lft[0] === 'Numeric' && rgt[1] === 'Numeric' &&
				( rgt[0] === 'MidNum' || rgt[0] === 'MidNumLet' || rgt[0] === 'SingleQuote' ):
				return false;

			// Do not break between Katakana.
			// WB13: Katakana × Katakana
			case lft[0] === 'Katakana' && rgt[0] === 'Katakana':
				return false;

			// Do not break from extenders.
			// WB13a: (ALetter | Hebrew_Letter | Numeric | Katakana | ExtendNumLet) × ExtendNumLet
			case rgt[0] === 'ExtendNumLet' &&
				( lft[0] === 'ALetter' || lft[0] === 'HebrewLetter' || lft[0] === 'Numeric' || lft[0] === 'Katakana' || lft[0] === 'ExtendNumLet' ):
			// WB13b: ExtendNumLet × (ALetter | Hebrew_Letter | Numeric | Katakana)
			case lft[0] === 'ExtendNumLet' &&
				( rgt[0] === 'ALetter' || rgt[0] === 'HebrewLetter' || rgt[0] === 'Numeric' || rgt[0] === 'Katakana' ):
				return false;

			// Do not break between regional indicator symbols.
			// WB13c: Regional_Indicator × Regional_Indicator
			case lft[0] === 'RegionalIndicator' && rgt[0] === 'RegionalIndicator':
				return false;
		}
		// Otherwise, break everywhere (including around ideographs).
		// WB14: Any ÷ Any
		return true;
	};
}() );

/*!
 * RangeFix v0.1.1
 * https://github.com/edg2s/rangefix
 *
 * Copyright 2014 Ed Sanders.
 * Released under the MIT license
 */
( function () {

	var broken,
		rangeFix = {};

	/**
	 * Check if bugs are present in the native functions
	 *
	 * For getClientRects, constructs two lines of text and
	 * creates a range between them. Broken browsers will
	 * return three rectangles instead of two.
	 *
	 * For getBoundingClientRect, create a collapsed range
	 * and check if the resulting rect has non-zero offsets.
	 *
	 * getBoundingClientRect is also considered broken if
	 * getClientRects is broken.
	 *
	 * @private
	 * @return {Object} Object containing boolean properties 'getClientRects'
	 *                  and 'getBoundingClientRect' indicating bugs are present
	 *                  in these functions.
	 */
	function isBroken() {
		if ( broken === undefined ) {
			var boundingRect,
				p1 = document.createElement( 'p' ),
				p2 = document.createElement( 'p' ),
				t1 = document.createTextNode( 'aa' ),
				t2 = document.createTextNode( 'aa' ),
				range = document.createRange();

			broken = {};

			p1.appendChild( t1 );
			p2.appendChild( t2 );

			document.body.appendChild( p1 );
			document.body.appendChild( p2 );

			range.setStart( t1, 1 );
			range.setEnd( t2, 1 );
			broken.getClientRects = broken.getBoundingClientRect = range.getClientRects().length > 2;

			if ( !broken.getBoundingClientRect ) {
				// Safari doesn't return a valid bounding rect for collapsed ranges
				range.setEnd( t1, 1 );
				boundingRect = range.getBoundingClientRect();
				broken.getBoundingClientRect = boundingRect.top === 0 && boundingRect.left === 0;
			}

			document.body.removeChild( p1 );
			document.body.removeChild( p2 );
		}
		return broken;
	}

	/**
	 * Get client rectangles from a range
	 *
	 * @param {Range} range Range
	 * @return {ClientRectList|ClientRect[]} ClientRectList or list of ClientRect objects describing range
	 */
	rangeFix.getClientRects = function ( range ) {
		if ( !isBroken().getClientRects ) {
			return range.getClientRects();
		}

		// Chrome gets the end container rects wrong when spanning
		// nodes so we need to traverse up the tree from the endContainer until
		// we reach the common ancestor, then we can add on from start to where
		// we got up to
		// https://code.google.com/p/chromium/issues/detail?id=324437
		var rects = [],
			endContainer = range.endContainer,
			endOffset = range.endOffset,
			partialRange = document.createRange();

		while ( endContainer !== range.commonAncestorContainer ) {
			partialRange.setStart( endContainer, 0 );
			partialRange.setEnd( endContainer, endOffset );

			Array.prototype.push.apply( rects, partialRange.getClientRects() );

			endOffset = Array.prototype.indexOf.call( endContainer.parentNode.childNodes, endContainer );
			endContainer = endContainer.parentNode;
		}

		// Once we've reached the common ancestor, add on the range from the
		// original start position to where we ended up.
		partialRange = range.cloneRange();
		partialRange.setEnd( endContainer, endOffset );
		Array.prototype.push.apply( rects, partialRange.getClientRects() );
		return rects;
	};

	/**
	 * Get bounding rectangle from a range
	 *
	 * @param {Range} range Range
	 * @return {ClientRect|Object|null} ClientRect or ClientRect-like object describing
	 *                                  bounding rectangle, or null if not computable
	 */
	rangeFix.getBoundingClientRect = function ( range ) {
		var i, l, boundingRect,
			rects = this.getClientRects( range ),
			nativeBoundingRect = range.getBoundingClientRect();

		// If there are no rects return null, otherwise we'll fall through to
		// getBoundingClientRect, which in Chrome and Firefox becomes [0,0,0,0].
		if ( rects.length === 0 ) {
			return null;
		}

		if ( !isBroken().getBoundingClientRect ) {
			return nativeBoundingRect;
		}

		// When nativeRange is a collapsed cursor at the end of a line or
		// the start of a line, the bounding rect is [0,0,0,0] in Chrome.
		// getClientRects returns two rects, one correct, and one at the
		// end of the next line / start of the previous line. We can't tell
		// here which one to use so just pick the first. This matches
		// Firefox's behaviour, which tells you the cursor is at the end
		// of the previous line when it is at the start of the line.
		// See https://code.google.com/p/chromium/issues/detail?id=426017
		if ( nativeBoundingRect.width === 0 && nativeBoundingRect.height === 0 ) {
			return rects[0];
		}

		for ( i = 0, l = rects.length; i < l; i++ ) {
			if ( !boundingRect ) {
				boundingRect = {
					left: rects[i].left,
					top: rects[i].top,
					right: rects[i].right,
					bottom: rects[i].bottom
				};
			} else {
				boundingRect.left = Math.min( boundingRect.left, rects[i].left );
				boundingRect.top = Math.min( boundingRect.top, rects[i].top );
				boundingRect.right = Math.max( boundingRect.right, rects[i].right );
				boundingRect.bottom = Math.max( boundingRect.bottom, rects[i].bottom );
			}
		}
		if ( boundingRect ) {
			boundingRect.width = boundingRect.right - boundingRect.left;
			boundingRect.height = boundingRect.bottom - boundingRect.top;
		}
		return boundingRect;
	};

	// Expose
	window.RangeFix = rangeFix;

} )();

/*!
 * VisualEditor namespace.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Namespace for all VisualEditor classes, static methods and static properties.
 * @class ve
 * @singleton
 */
window.ve = {};

/**
 * Get the current time, measured in milliseconds since January 1, 1970 (UTC).
 *
 * On browsers that implement the Navigation Timing API, this function will produce floating-point
 * values with microsecond precision that are guaranteed to be monotonic. On all other browsers,
 * it will fall back to using `Date.now`.
 *
 * @returns {number} Current time
 */
ve.now = ( function () {
	var perf = window.performance,
		navStart = perf && perf.timing && perf.timing.navigationStart;
	return navStart && typeof perf.now === 'function' ?
		function () { return navStart + perf.now(); } : Date.now;
}() );

/*!
 * VisualEditor utilities.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * @class ve
 */

/**
 * Checks if an object is an instance of one or more classes.
 *
 * @param {Object} subject Object to check
 * @param {Function[]} classes Classes to compare with
 * @returns {boolean} Object inherits from one or more of the classes
 */
ve.isInstanceOfAny = function ( subject, classes ) {
	var i = classes.length;

	while ( classes[--i] ) {
		if ( subject instanceof classes[i] ) {
			return true;
		}
	}
	return false;
};

/**
 * @method
 * @inheritdoc OO#getProp
 */
ve.getProp = OO.getProp;

/**
 * @method
 * @inheritdoc OO#setProp
 */
ve.setProp = OO.setProp;

/**
 * @method
 * @inheritdoc OO#cloneObject
 */
ve.cloneObject = OO.cloneObject;

/**
 * @method
 * @inheritdoc OO#cloneObject
 */
ve.getObjectValues = OO.getObjectValues;

/**
 * @method
 * @until ES5: Object#keys
 * @inheritdoc Object#keys
 */
ve.getObjectKeys = Object.keys;

/**
 * @method
 * @inheritdoc OO#compare
 */
ve.compare = OO.compare;

/**
 * @method
 * @inheritdoc OO#copy
 */
ve.copy = OO.copy;

/**
 * Copy an array of DOM elements, optionally into a different document.
 *
 * @param {HTMLElement[]} domElements DOM elements to copy
 * @param {HTMLDocument} [doc] Document to create the copies in; if unset, simply clone each element
 * @returns {HTMLElement[]} Copy of domElements with copies of each element
 */
ve.copyDomElements = function ( domElements, doc ) {
	return domElements.map( function ( domElement ) {
		return doc ? doc.importNode( domElement, true ) : domElement.cloneNode( true );
	} );
};

/**
 * Check to see if an object is a plain object (created using "{}" or "new Object").
 *
 * @method
 * @source <http://api.jquery.com/jQuery.isPlainObject/>
 * @param {Object} obj The object that will be checked to see if it's a plain object
 * @returns {boolean}
 */
ve.isPlainObject = $.isPlainObject;

/**
 * Check to see if an object is empty (contains no properties).
 *
 * @method
 * @source <http://api.jquery.com/jQuery.isEmptyObject/>
 * @param {Object} obj The object that will be checked to see if it's empty
 * @returns {boolean}
 */
ve.isEmptyObject = $.isEmptyObject;

/**
 * Wrapper for Array#indexOf.
 *
 * Values are compared without type coercion.
 *
 * @method
 * @source <http://api.jquery.com/jQuery.inArray/>
 * @until ES5: Array#indexOf
 * @param {Mixed} value Element to search for
 * @param {Array} array Array to search in
 * @param {number} [fromIndex=0] Index to being searching from
 * @returns {number} Index of value in array, or -1 if not found
 */
ve.indexOf = $.inArray;

/**
 * Merge properties of one or more objects into another.
 * Preserves original object's inheritance (e.g. Array, Object, whatever).
 * In case of array or array-like objects only the indexed properties
 * are copied over.
 * Beware: If called with only one argument, it will consider
 * 'target' as 'source' and 'this' as 'target'. Which means
 * ve.extendObject( { a: 1 } ); sets ve.a = 1;
 *
 * @method
 * @source <http://api.jquery.com/jQuery.extend/>
 * @param {boolean} [recursive=false]
 * @param {Mixed} [target] Object that will receive the new properties
 * @param {Mixed...} [sources] Variadic list of objects containing properties
 * to be merged into the target.
 * @returns {Mixed} Modified version of first or second argument
 */
ve.extendObject = $.extend;

/**
 * Splice one array into another.
 *
 * This is the equivalent of arr.splice( offset, remove, d1, d2, d3, ... ) except that arguments are
 * specified as an array rather than separate parameters.
 *
 * This method has been proven to be faster than using slice and concat to create a new array, but
 * performance tests should be conducted on each use of this method to verify this is true for the
 * particular use. Also, browsers change fast, never assume anything, always test everything.
 *
 * Includes a replacement for broken implementation of Array.prototype.splice() found in Opera 12.
 *
 * @param {Array|ve.dm.BranchNode} arr Target object (must have `splice` method, object will be modified)
 * @param {number} offset Offset in arr to splice at. This may NOT be negative, unlike the
 *  'index' parameter in Array#splice.
 * @param {number} remove Number of elements to remove at the offset. May be zero
 * @param {Array} data Array of items to insert at the offset. Must be non-empty if remove=0
 * @return {Array} Array of items removed
 */
ve.batchSplice = ( function () {
	var arraySplice;

	// This yields 'false' on Opera 12.15.
	function spliceWorks() {
		var n = 256,
			a = [];
		a[n] = 'a';
		a.splice( n + 1, 0, 'b' );
		return a[n] === 'a';
	}

	if ( spliceWorks() ) {
		arraySplice = Array.prototype.splice;
	} else {
		// Standard Array.prototype.splice() function implemented using .slice() and .push().
		arraySplice = function ( offset, remove/*, data... */ ) {
			var data, begin, removed, end;

			data = Array.prototype.slice.call( arguments, 2 );

			begin = this.slice( 0, offset );
			removed = this.slice( offset, remove );
			end = this.slice( offset + remove );

			this.length = 0;
			// This polyfill only been discovered to be necessary on Opera
			// and it seems to handle up to 1048575 function parameters.
			this.push.apply( this, begin );
			this.push.apply( this, data );
			this.push.apply( this, end );

			return removed;
		};
	}

	return function ( arr, offset, remove, data ) {
		// We need to splice insertion in in batches, because of parameter list length limits which vary
		// cross-browser - 1024 seems to be a safe batch size on all browsers
		var splice, spliced,
			index = 0,
			batchSize = 1024,
			toRemove = remove,
			removed = [];

		splice = Array.isArray( arr ) ? arraySplice : arr.splice;

		if ( data.length === 0 ) {
			// Special case: data is empty, so we're just doing a removal
			// The code below won't handle that properly, so we do it here
			return splice.call( arr, offset, remove );
		}

		while ( index < data.length ) {
			// Call arr.splice( offset, remove, i0, i1, i2, ..., i1023 );
			// Only set remove on the first call, and set it to zero on subsequent calls
			spliced = splice.apply(
				arr, [index + offset, toRemove].concat( data.slice( index, index + batchSize ) )
			);
			if ( toRemove > 0 ) {
				removed = spliced;
			}
			index += batchSize;
			toRemove = 0;
		}
		return removed;
	};
}() );

/**
 * Insert one array into another.
 *
 * Shortcut for `ve.batchSplice( dst, offset, 0, src )`.
 *
 * @see #batchSplice
 * @param {Array|ve.dm.BranchNode} arr Target object (must have `splice` method)
 * @param {number} offset Offset in arr where items will be inserted
 * @param {Array} data Items to insert at offset
 */
ve.insertIntoArray = function ( dst, offset, src ) {
	ve.batchSplice( dst, offset, 0, src );
};

/**
 * Push one array into another.
 *
 * This is the equivalent of arr.push( d1, d2, d3, ... ) except that arguments are
 * specified as an array rather than separate parameters.
 *
 * @param {Array|ve.dm.BranchNode} arr Object supporting .push() to insert at the end of the array. Will be modified
 * @param {Array} data Array of items to insert.
 * @returns {number} length of the new array
 */
ve.batchPush = function ( arr, data ) {
	// We need to push insertion in batches, because of parameter list length limits which vary
	// cross-browser - 1024 seems to be a safe batch size on all browsers
	var length,
		index = 0,
		batchSize = 1024;
	while ( index < data.length ) {
		// Call arr.push( i0, i1, i2, ..., i1023 );
		length = arr.push.apply(
			arr, data.slice( index, index + batchSize )
		);
		index += batchSize;
	}
	return length;
};

/**
 * Log data to the console.
 *
 * This implementation does nothing, to add a real implementation ve.debug needs to be loaded.
 *
 * @param {Mixed...} [args] Data to log
 */
ve.log = ve.log || function () {
	// don't do anything, this is just a stub
};

/**
 * Log error to the console.
 *
 * This implementation does nothing, to add a real implementation ve.debug needs to be loaded.
 *
 * @param {Mixed...} [args] Data to log
 */
ve.error = ve.error || function () {
	// don't do anything, this is just a stub
};

/**
 * Log an object to the console.
 *
 * This implementation does nothing, to add a real implementation ve.debug needs to be loaded.
 *
 * @param {Object} obj
 */
ve.dir = ve.dir || function () {
	// don't do anything, this is just a stub
};

/**
 * Return a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * Ported from: http://underscorejs.org/underscore.js
 *
 * @param {Function} func
 * @param {number} wait
 * @param {boolean} immediate
 * @returns {Function}
 */
ve.debounce = function ( func, wait, immediate ) {
	var timeout;
	return function () {
		var context = this,
			args = arguments,
			later = function () {
				timeout = null;
				if ( !immediate ) {
					func.apply( context, args );
				}
			};
		if ( immediate && !timeout ) {
			func.apply( context, args );
		}
		clearTimeout( timeout );
		timeout = setTimeout( later, wait );
	};
};

/**
 * Select the contents of an element
 *
 * @param {HTMLElement} element Element
 */
ve.selectElement = function ( element ) {
	var nativeRange = OO.ui.Element.static.getDocument( element ).createRange(),
		nativeSelection = OO.ui.Element.static.getWindow( element ).getSelection();
	nativeRange.setStart( element, 0 );
	nativeRange.setEnd( element, element.childNodes.length );
	nativeSelection.removeAllRanges();
	nativeSelection.addRange( nativeRange );
};

/**
 * Move the selection to the end of an input.
 *
 * @param {HTMLElement} element Input element
 */
ve.selectEnd = function ( element ) {
	element.focus();
	if ( element.selectionStart !== undefined ) {
		element.selectionStart = element.selectionEnd = element.value.length;
	} else if ( element.createTextRange ) {
		var textRange = element.createTextRange();
		textRange.collapse( false );
		textRange.select();
	}
};

/**
 * Get a localized message.
 *
 * @param {string} key Message key
 * @param {Mixed...} [params] Message parameters
 * @returns {string} Localized message
 */
ve.msg = function () {
	// Avoid using bind because ve.init.platform doesn't exist yet.
	// TODO: Fix dependency issues between ve.js and ve.init.platform
	return ve.init.platform.getMessage.apply( ve.init.platform, arguments );
};

/**
 * Get a config value.
 *
 * @param {string|string[]} key Config key, or list of keys
 * @returns {Mixed|Object} Config value, or keyed object of config values if list of keys provided
 */
ve.config = function () {
	// Avoid using bind because ve.init.platform doesn't exist yet.
	// TODO: Fix dependency issues between ve.js and ve.init.platform
	return ve.init.platform.getConfig.apply( ve.init.platform, arguments );
};

/**
 * Determine if the text consists of only unattached combining marks.
 *
 * @param {string} text Text to test
 * @returns {boolean} The text is unattached combining marks
 */
ve.isUnattachedCombiningMark = function ( text ) {
	return ( /^[\u0300-\u036F]+$/ ).test( text );
};

/**
 * Convert a grapheme cluster offset to a byte offset.
 *
 * @param {string} text Text in which to calculate offset
 * @param {number} clusterOffset Grapheme cluster offset
 * @returns {number} Byte offset
 */
ve.getByteOffset = function ( text, clusterOffset ) {
	return unicodeJS.graphemebreak.splitClusters( text )
		.slice( 0, clusterOffset )
		.join( '' )
		.length;
};

/**
 * Convert a byte offset to a grapheme cluster offset.
 *
 * @param {string} text Text in which to calculate offset
 * @param {number} byteOffset Byte offset
 * @returns {number} Grapheme cluster offset
 */
ve.getClusterOffset = function ( text, byteOffset ) {
	return unicodeJS.graphemebreak.splitClusters( text.slice( 0, byteOffset ) ).length;
};

/**
 * Get a text substring, taking care not to split grapheme clusters.
 *
 * @param {string} text Text to take the substring from
 * @param {number} start Start offset
 * @param {number} end End offset
 * @param {boolean} [outer=false] Include graphemes if the offset splits them
 * @returns {string} Substring of text
 */
ve.graphemeSafeSubstring = function ( text, start, end, outer ) {
	// TODO: improve performance by incrementally inspecting characters around the offsets
	var unicodeStart = ve.getByteOffset( text, ve.getClusterOffset( text, start ) ),
		unicodeEnd = ve.getByteOffset( text, ve.getClusterOffset( text, end ) );

	// If the selection collapses and we want an inner, then just return empty
	// otherwise we'll end up crossing over start and end
	if ( unicodeStart === unicodeEnd && !outer ) {
		return '';
	}

	// The above calculations always move to the right of a multibyte grapheme.
	// Depending on the outer flag, we may want to move to the left:
	if ( unicodeStart > start && outer ) {
		unicodeStart = ve.getByteOffset( text, ve.getClusterOffset( text, start ) - 1 );
	}
	if ( unicodeEnd > end && !outer ) {
		unicodeEnd = ve.getByteOffset( text, ve.getClusterOffset( text, end ) - 1 );
	}
	return text.slice( unicodeStart, unicodeEnd );
};

/**
 * Escape non-word characters so they can be safely used as HTML attribute values.
 *
 * This method is basically a copy of `mw.html.escape`.
 *
 * @param {string} value Attribute value to escape
 * @returns {string} Escaped attribute value
 */
ve.escapeHtml = ( function () {
	function escape( value ) {
		switch ( value ) {
			case '\'':
				return '&#039;';
			case '"':
				return '&quot;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
		}
	}

	return function ( value ) {
		return value.replace( /['"<>&]/g, escape );
	};
}() );

/**
 * Generate HTML attributes.
 *
 * This method copies part of `mw.html.element` from MediaWiki.
 *
 * NOTE: While the values of attributes are escaped, the names of attributes (i.e. the keys in
 * the attributes objects) are NOT ESCAPED. The caller is responsible for making sure these are
 * sane tag/attribute names and do not contain unsanitized content from an external source
 * (e.g. from the user or from the web).
 *
 * @param {Object} [attributes] Key-value map of attributes for the tag
 * @returns {string} HTML attributes
 */
ve.getHtmlAttributes = function ( attributes ) {
	var attrName, attrValue,
		parts = [];

	if ( !ve.isPlainObject( attributes ) || ve.isEmptyObject( attributes ) ) {
		return '';
	}

	for ( attrName in attributes ) {
		attrValue = attributes[attrName];
		if ( attrValue === true ) {
			// Convert name=true to name=name
			attrValue = attrName;
		} else if ( attrValue === false ) {
			// Skip name=false
			continue;
		}
		parts.push( attrName + '="' + ve.escapeHtml( String( attrValue ) ) + '"' );
	}

	return parts.join( ' ' );
};

/**
 * Generate an opening HTML tag.
 *
 * This method copies part of `mw.html.element` from MediaWiki.
 *
 * NOTE: While the values of attributes are escaped, the tag name and the names of
 * attributes (i.e. the keys in the attributes objects) are NOT ESCAPED. The caller is
 * responsible for making sure these are sane tag/attribute names and do not contain
 * unsanitized content from an external source (e.g. from the user or from the web).
 *
 * @param {string} tag HTML tag name
 * @param {Object} [attributes] Key-value map of attributes for the tag
 * @returns {string} Opening HTML tag
 */
ve.getOpeningHtmlTag = function ( tagName, attributes ) {
	var attr = ve.getHtmlAttributes( attributes );
	return '<' + tagName + ( attr ? ' ' + attr : '' ) + '>';
};

/**
 * Get the attributes of a DOM element as an object with key/value pairs.
 *
 * @param {HTMLElement} element
 * @returns {Object}
 */
ve.getDomAttributes = function ( element ) {
	var i,
		result = {};
	for ( i = 0; i < element.attributes.length; i++ ) {
		result[element.attributes[i].name] = element.attributes[i].value;
	}
	return result;
};

/**
 * Set the attributes of a DOM element as an object with key/value pairs.
 *
 * Use the `null` or `undefined` value to ensure an attribute's absence.
 *
 * @param {HTMLElement} element DOM element to apply attributes to
 * @param {Object} attributes Attributes to apply
 * @param {string[]} [whitelist] List of attributes to exclusively allow (all lowercase names)
 */
ve.setDomAttributes = function ( element, attributes, whitelist ) {
	var key;
	// Duck-typing for attribute setting
	if ( !element.setAttribute || !element.removeAttribute ) {
		return;
	}
	for ( key in attributes ) {
		if ( whitelist && whitelist.indexOf( key.toLowerCase() ) === -1 ) {
			continue;
		}
		if ( attributes[key] === undefined || attributes[key] === null ) {
			element.removeAttribute( key );
		} else {
			element.setAttribute( key, attributes[key] );
		}
	}
};

/**
 * Build a summary of an HTML element.
 *
 * Summaries include node name, text, attributes and recursive summaries of children.
 * Used for serializing or comparing HTML elements.
 *
 * @private
 * @param {HTMLElement} element Element to summarize
 * @param {boolean} [includeHtml=false] Include an HTML summary for element nodes
 * @returns {Object} Summary of element.
 */
ve.getDomElementSummary = function ( element, includeHtml ) {
	var i,
		summary = {
			type: element.nodeName.toLowerCase(),
			text: element.textContent,
			attributes: {},
			children: []
		};

	if ( includeHtml && element.nodeType === Node.ELEMENT_NODE ) {
		summary.html = element.outerHTML;
	}

	// Gather attributes
	if ( element.attributes ) {
		for ( i = 0; i < element.attributes.length; i++ ) {
			summary.attributes[element.attributes[i].name] = element.attributes[i].value;
		}
	}
	// Summarize children
	if ( element.childNodes ) {
		for ( i = 0; i < element.childNodes.length; i++ ) {
			summary.children.push( ve.getDomElementSummary( element.childNodes[i], includeHtml ) );
		}
	}
	return summary;
};

/**
 * Callback for #copy to convert nodes to a comparable summary.
 *
 * @private
 * @param {Object} value Value in the object/array
 * @returns {Object} DOM element summary if value is a node, otherwise just the value
 */
ve.convertDomElements = function ( value ) {
	// Use duck typing rather than instanceof Node; the latter doesn't always work correctly
	if ( value && value.nodeType ) {
		return ve.getDomElementSummary( value );
	}
	return value;
};

/**
 * Check whether a given DOM element has a block element type.
 *
 * @param {HTMLElement|string} element Element or element name
 * @returns {boolean} Element is a block element
 */
ve.isBlockElement = function ( element ) {
	var elementName = typeof element === 'string' ? element : element.nodeName;
	return ve.indexOf( elementName.toLowerCase(), ve.elementTypes.block ) !== -1;
};

/**
 * Check whether a given DOM element is a void element (can't have children).
 *
 * @param {HTMLElement|string} element Element or element name
 * @returns {boolean} Element is a void element
 */
ve.isVoidElement = function ( element ) {
	var elementName = typeof element === 'string' ? element : element.nodeName;
	return ve.indexOf( elementName.toLowerCase(), ve.elementTypes.void ) !== -1;
};

ve.elementTypes = {
	block: [
		'div', 'p',
		// tables
		'table', 'tbody', 'thead', 'tfoot', 'caption', 'th', 'tr', 'td',
		// lists
		'ul', 'ol', 'li', 'dl', 'dt', 'dd',
		// HTML5 heading content
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup',
		// HTML5 sectioning content
		'article', 'aside', 'body', 'nav', 'section', 'footer', 'header', 'figure',
		'figcaption', 'fieldset', 'details', 'blockquote',
		// other
		'hr', 'button', 'canvas', 'center', 'col', 'colgroup', 'embed',
		'map', 'object', 'pre', 'progress', 'video'
	],
	void: [
		'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img',
		'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'
	]
};

/**
 * Create an HTMLDocument from an HTML string.
 *
 * The html parameter is supposed to be a full HTML document with a doctype and an `<html>` tag.
 * If you pass a document fragment, it may or may not work, this is at the mercy of the browser.
 *
 * To create an empty document, pass the empty string.
 *
 * If your input is both valid HTML and valid XML, and you need to work around style
 * normalization bugs in Internet Explorer, use #parseXhtml and #serializeXhtml.
 *
 * @param {string} html HTML string
 * @returns {HTMLDocument} Document constructed from the HTML string
 */
ve.createDocumentFromHtml = function ( html ) {
	// Try using DOMParser if available. This only works in Firefox 12+ and very modern
	// versions of other browsers (Chrome 30+, Opera 17+, IE10+)
	var newDocument, $iframe, iframe;
	try {
		if ( html === '' ) {
			// IE doesn't like empty strings
			html = '<body></body>';
		}
		newDocument = new DOMParser().parseFromString( html, 'text/html' );
		if ( newDocument ) {
			return newDocument;
		}
	} catch ( e ) { }

	// Here's what this fallback code should look like:
	//
	//     var newDocument = document.implementation.createHtmlDocument( '' );
	//     newDocument.open();
	//     newDocument.write( html );
	//     newDocument.close();
	//     return newDocument;
	//
	// Sadly, it's impossible:
	// * On IE 9, calling open()/write() on such a document throws an "Unspecified error" (sic).
	// * On Firefox 20, calling open()/write() doesn't actually do anything, including writing.
	//   This is reported as Firefox bug 867102.
	// * On Opera 12, calling open()/write() behaves as if called on window.document, replacing the
	//   entire contents of the page with new HTML. This is reported as Opera bug DSK-384486.
	//
	// Funnily, in all of those browsers it's apparently perfectly legal and possible to access the
	// newly created document's DOM itself, including modifying documentElement's innerHTML, which
	// would achieve our goal. But that requires some nasty magic to strip off the <html></html> tag
	// itself, so we're not doing that. (We can't use .outerHTML, either, as the spec disallows
	// assigning to it for the root element.)
	//
	// There is one more way - create an <iframe>, append it to current document, and access its
	// contentDocument. The only browser having issues with that is Opera (sometimes the accessible
	// value is not actually a Document, but something which behaves just like an empty regular
	// object...), so we're detecting that and using the innerHTML hack described above.

	// Create an invisible iframe
	$iframe = $( '<iframe frameborder="0" width="0" height="0" />' );
	iframe = $iframe.get( 0 );
	// Attach it to the document. We have to do this to get a new document out of it
	document.documentElement.appendChild( iframe );
	// Write the HTML to it
	newDocument = ( iframe.contentWindow && iframe.contentWindow.document ) || iframe.contentDocument;
	newDocument.open();
	newDocument.write( html ); // Party like it's 1995!
	newDocument.close();
	// Detach the iframe
	// FIXME detaching breaks access to newDocument in IE
	iframe.parentNode.removeChild( iframe );

	if ( !newDocument.documentElement || newDocument.documentElement.cloneNode( false ) === undefined ) {
		// Surprise! The document is not a document! Only happens on Opera.
		// (Or its nodes are not actually nodes, while the document
		// *is* a document. This only happens when debugging with Dragonfly.)
		newDocument = document.implementation.createHTMLDocument( '' );
		// Carefully unwrap the HTML out of the root node (and doctype, if any).
		// <html> might have some arguments here, but they're apparently not important.
		html = html.replace(/^\s*(?:<!doctype[^>]*>)?\s*<html[^>]*>/i, '' );
		html = html.replace(/<\/html>\s*$/i, '' );
		newDocument.documentElement.innerHTML = html;
	}

	return newDocument;
};

/**
 * Resolve a URL according to a given base.
 *
 * Passing a string for the base parameter causes a throwaway document to be created, which is
 * slow.
 *
 * @param {string} url URL to resolve
 * @param {HTMLDocument|string} base Document whose base URL to use, or base URL as a string
 * @returns {string} Resolved URL
 */
ve.resolveUrl = function ( url, base ) {
	var doc, node;
	if ( typeof base === 'string' ) {
		doc = ve.createDocumentFromHtml( '' );
		node = doc.createElement( 'base' );
		node.setAttribute( 'href', base );
		doc.head.appendChild( node );
	} else {
		doc = base;
	}

	node = doc.createElement( 'a' );
	node.setAttribute( 'href', url );
	// If doc.baseURI isn't set, node.href will be an empty string
	// This is crazy, returning the original URL is better
	return node.href || url;
};

/**
 * Get the actual inner HTML of a DOM node.
 *
 * In most browsers, .innerHTML is broken and eats newlines in `<pre>` elements, see
 * https://bugzilla.mozilla.org/show_bug.cgi?id=838954 . This function detects this behavior
 * and works around it, to the extent possible. `<pre>\nFoo</pre>` will become `<pre>Foo</pre>`
 * if the browser is broken, but newlines are preserved in all other cases.
 *
 * @param {HTMLElement} element HTML element to get inner HTML of
 * @returns {string} Inner HTML
 */
ve.properInnerHtml = function ( element ) {
	return ve.fixupPreBug( element ).innerHTML;
};

/**
 * Get the actual outer HTML of a DOM node.
 *
 * @see ve#properInnerHtml
 * @param {HTMLElement} element HTML element to get outer HTML of
 * @returns {string} Outer HTML
 */
ve.properOuterHtml = function ( element ) {
	return ve.fixupPreBug( element ).outerHTML;
};

/**
 * Helper function for #properInnerHtml, #properOuterHtml and #serializeXhtml.
 *
 * Detect whether the browser has broken `<pre>` serialization, and if so return a clone
 * of the node with extra newlines added to make it serialize properly. If the browser is not
 * broken, just return the original node.
 *
 * @param {HTMLElement} element HTML element to fix up
 * @returns {HTMLElement} Either element, or a fixed-up clone of it
 */
ve.fixupPreBug = function ( element ) {
	var div, $element;
	if ( ve.isPreInnerHtmlBroken === undefined ) {
		// Test whether newlines in `<pre>` are serialized back correctly
		div = document.createElement( 'div' );
		div.innerHTML = '<pre>\n\n</pre>';
		ve.isPreInnerHtmlBroken = div.innerHTML === '<pre>\n</pre>';
	}

	if ( !ve.isPreInnerHtmlBroken ) {
		return element;
	}

	// Workaround for bug 42469: if a `<pre>` starts with a newline, that means .innerHTML will
	// screw up and stringify it with one fewer newline. Work around this by adding a newline.
	// If we don't see a leading newline, we still don't know if the original HTML was
	// `<pre>Foo</pre>` or `<pre>\nFoo</pre>`, but that's a syntactic difference, not a
	// semantic one, and handling that is Parsoid's job.
	$element = $( element ).clone();
	$element.find( 'pre, textarea, listing' ).each( function () {
		var matches;
		if ( this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE ) {
			matches = this.firstChild.data.match( /^(\r\n|\r|\n)/ );
			if ( matches && matches[1] ) {
				// Prepend a newline exactly like the one we saw
				this.firstChild.insertData( 0, matches[1] );
			}
		}
	} );
	return $element.get( 0 );
};

/**
 * Helper function for #transformStyleAttributes.
 *
 * Normalize an attribute value. In compliant browsers, this should be
 * a no-op, but in IE style attributes are normalized on all elements and
 * bgcolor attributes are normalized on some elements (like `<tr>`).
 *
 * @param {string} name Attribute name
 * @param {string} value Attribute value
 * @param {string} [nodeName='div'] Element name
 * @return {string} Normalized attribute value
 */
ve.normalizeAttributeValue = function ( name, value, nodeName ) {
	var node = document.createElement( nodeName || 'div' );
	node.setAttribute( name, value );
	// IE normalizes invalid CSS to empty string, then if you normalize
	// an empty string again it becomes null. Return an empty string
	// instead of null to make this function idempotent.
	return node.getAttribute( name ) || '';
};

/**
 * Helper function for #parseXhtml and #serializeXhtml.
 *
 * Map attributes that are broken in IE to attributes prefixed with data-ve-
 * or vice versa.
 *
 * @param {string} html HTML string. Must also be valid XML
 * @param {boolean} unmask Map the masked attributes back to their originals
 * @returns {string} HTML string modified to mask/unmask broken attributes
 */
ve.transformStyleAttributes = function ( html, unmask ) {
	var xmlDoc, fromAttr, toAttr, i, len,
		maskAttrs = [
			'style', // IE normalizes 'color:#ffd' to 'color: rgb(255, 255, 221);'
			'bgcolor', // IE normalizes '#FFDEAD' to '#ffdead'
			'color' // IE normalized 'Red' to 'red'
		];

	// Parse the HTML into an XML DOM
	xmlDoc = new DOMParser().parseFromString( html, 'text/xml' );

	// Go through and mask/unmask each attribute on all elements that have it
	for ( i = 0, len = maskAttrs.length; i < len; i++ ) {
		fromAttr = unmask ? 'data-ve-' + maskAttrs[i] : maskAttrs[i];
		toAttr = unmask ? maskAttrs[i] : 'data-ve-' + maskAttrs[i];
		/*jshint loopfunc:true */
		$( xmlDoc ).find( '[' + fromAttr + ']' ).each( function () {
			var toAttrValue, fromAttrNormalized,
				fromAttrValue = this.getAttribute( fromAttr );

			if ( unmask ) {
				this.removeAttribute( fromAttr );

				// If the data-ve- version doesn't normalize to the same value,
				// the attribute must have changed, so don't overwrite it
				fromAttrNormalized = ve.normalizeAttributeValue( toAttr, fromAttrValue, this.nodeName );
				// toAttr can't not be set, but IE returns null if the value was ''
				toAttrValue = this.getAttribute( toAttr ) || '';
				if ( toAttrValue !== fromAttrNormalized ) {
					return;
				}
			}

			this.setAttribute( toAttr, fromAttrValue );
		} );
	}

	// HACK: Inject empty text nodes into empty non-void tags to prevent
	// things like <a></a> from being serialized as <a /> and wreaking havoc
	$( xmlDoc ).find( ':empty:not(' + ve.elementTypes.void.join( ',' ) + ')' ).each( function () {
		this.appendChild( xmlDoc.createTextNode( '' ) );
	} );

	// Serialize back to a string
	return new XMLSerializer().serializeToString( xmlDoc );
};

/**
 * Parse an HTML string into an HTML DOM, while masking attributes affected by
 * normalization bugs if a broken browser is detected.
 * Since this process uses an XML parser, the input must be valid XML as well as HTML.
 *
 * @param {string} html HTML string. Must also be valid XML
 * @return {HTMLDocument} HTML DOM
 */
ve.parseXhtml = function ( html ) {
	// Feature-detect style attribute breakage in IE
	if ( ve.isStyleAttributeBroken === undefined ) {
		ve.isStyleAttributeBroken = ve.normalizeAttributeValue( 'style', 'color:#ffd' ) !== 'color:#ffd';
	}
	if ( ve.isStyleAttributeBroken ) {
		html = ve.transformStyleAttributes( html, false );
	}
	return ve.createDocumentFromHtml( html );
};

/**
 * Serialize an HTML DOM created with #parseXhtml back to an HTML string, unmasking any
 * attributes that were masked.
 *
 * @param {HTMLDocument} doc HTML DOM
 * @return {string} Serialized HTML string
 */
ve.serializeXhtml = function ( doc ) {
	var xml;
	// Feature-detect style attribute breakage in IE
	if ( ve.isStyleAttributeBroken === undefined ) {
		ve.isStyleAttributeBroken = ve.normalizeAttributeValue( 'style', 'color:#ffd' ) !== 'color:#ffd';
	}
	if ( !ve.isStyleAttributeBroken ) {
		// Use outerHTML if possible because in Firefox, XMLSerializer URL-encodes
		// hrefs but outerHTML doesn't
		return ve.properOuterHtml( doc.documentElement );
	}

	xml = new XMLSerializer().serializeToString( ve.fixupPreBug( doc.documentElement ) );
	// HACK: strip out xmlns
	xml = xml.replace( '<html xmlns="http://www.w3.org/1999/xhtml"', '<html' );
	return ve.transformStyleAttributes( xml, true );
};

/**
 * Wrapper for node.normalize(). The native implementation is broken in IE,
 * so we use our own implementation in that case.
 *
 * @param {Node} node Node to normalize
 */
ve.normalizeNode = function ( node ) {
	var p, nodeIterator, textNode;
	if ( ve.isNormalizeBroken === undefined ) {
		// Feature-detect IE11's broken .normalize() implementation.
		// We know that it fails to remove the empty text node at the end
		// in this example, but for mysterious reasons it also fails to merge
		// text nodes in other cases and we don't quite know why. So if we detect
		// that .normalize() is broken, fall back to a completely manual version.
		p = document.createElement( 'p' );
		p.appendChild( document.createTextNode( 'Foo' ) );
		p.appendChild( document.createTextNode( 'Bar' ) );
		p.appendChild( document.createTextNode( '' ) );
		p.normalize();
		ve.isNormalizeBroken = p.childNodes.length !== 1;
	}

	if ( ve.isNormalizeBroken ) {
		// Perform normalization manually
		nodeIterator = node.ownerDocument.createNodeIterator(
			node,
			NodeFilter.SHOW_TEXT,
			function () { return NodeFilter.FILTER_ACCEPT; },
			false
		);
		while ( ( textNode = nodeIterator.nextNode() ) ) {
			// Remove if empty
			if ( textNode.data === '' ) {
				textNode.parentNode.removeChild( textNode );
				continue;
			}
			// Merge in any adjacent text nodes
			while ( textNode.nextSibling && textNode.nextSibling.nodeType === Node.TEXT_NODE ) {
				textNode.appendData( textNode.nextSibling.data );
				textNode.parentNode.removeChild( textNode.nextSibling );
			}
		}
	} else {
		// Use native implementation
		node.normalize();
	}
};

/**
 * Translate rect by some fixed vector and return a new offset object
 * @param {Object} rect Offset object containing all or any of top, left, bottom, right, width & height
 * @param {number} x Horizontal translation
 * @param {number} y Vertical translation
 * @return {Object} Translated rect
 */
ve.translateRect = function ( rect, x, y ) {
	var translatedRect = {};
	if ( rect.top !== undefined ) {
		translatedRect.top = rect.top + y;
	}
	if ( rect.bottom !== undefined ) {
		translatedRect.bottom = rect.bottom + y;
	}
	if ( rect.left !== undefined ) {
		translatedRect.left = rect.left + x;
	}
	if ( rect.right !== undefined ) {
		translatedRect.right = rect.right + x;
	}
	if ( rect.width !== undefined ) {
		translatedRect.width = rect.width;
	}
	if ( rect.height !== undefined ) {
		translatedRect.height = rect.height;
	}
	return translatedRect;
};

/**
 * Get the start and end rectangles (in a text flow sense) from a list of rectangles
 * @param {Array} rects Full list of rectangles
 * @return {Object|null} Object containing two rectangles: start and end, or null if there are no rectangles
 */
ve.getStartAndEndRects = function ( rects ) {
	var i, l, startRect, endRect;
	if ( !rects || !rects.length ) {
		return null;
	}
	for ( i = 0, l = rects.length; i < l; i++ ) {
		if ( !startRect || rects[i].top < startRect.top ) {
			// Use ve.extendObject as ve.copy copies non-plain objects by reference
			startRect = ve.extendObject( {}, rects[i] );
		} else if ( rects[i].top === startRect.top ) {
			// Merge rects with the same top coordinate
			startRect.left = Math.min( startRect.left, rects[i].left );
			startRect.right = Math.max( startRect.right, rects[i].right );
			startRect.width = startRect.right - startRect.left;
		}
		if ( !endRect || rects[i].bottom > endRect.bottom ) {
			// Use ve.extendObject as ve.copy copies non-plain objects by reference
			endRect = ve.extendObject( {}, rects[i] );
		} else if ( rects[i].bottom === endRect.bottom ) {
			// Merge rects with the same bottom coordinate
			endRect.left = Math.min( endRect.left, rects[i].left );
			endRect.right = Math.max( endRect.right, rects[i].right );
			endRect.width = startRect.right - startRect.left;
		}
	}
	return {
		start: startRect,
		end: endRect
	};
};

/**
 * Find the nearest common ancestor of DOM nodes
 *
 * @param {Node...} DOM nodes in the same document
 * @returns {Node|null} Nearest common ancestor node
 */
ve.getCommonAncestor = function () {
	var i, j, nodeCount, chain, node,
		minHeight = null,
		chains = [],
		args = Array.prototype.slice.call( arguments );
	nodeCount = args.length;
	if ( nodeCount === 0 ) {
		throw new Error( 'Need at least one node' );
	}
	// Build every chain
	for ( i = 0; i < nodeCount; i++ ) {
		chain = [];
		node = args[ i ];
		while ( node !== null ) {
			chain.unshift( node );
			node = node.parentNode;
		}
		if ( chain.length === 0 ) {
			return null;
		}
		if ( i > 0 && chain[ 0 ] !== chains[ chains.length - 1 ][ 0 ] ) {
			return null;
		}
		if ( minHeight === null || minHeight > chain.length ) {
			minHeight = chain.length;
		}
		chains.push( chain );
	}

	// Step through chains in parallel, until they differ
	// All chains are guaranteed to start with documentNode
	for ( i = 1; i < minHeight; i++ ) {
		node = chains[ 0 ][ i ];
		for ( j = 1; j < nodeCount; j++ ) {
			if ( node !== chains[ j ][ i ] ) {
				return chains[ 0 ][ i - 1 ];
			}
		}
	}
	return chains[ 0 ][ minHeight - 1 ];
};

/**
 * Get the offset path from ancestor to offset in descendant
 *
 * @param {Node} ancestor The ancestor node
 * @param {Node} node The descendant node
 * @param {number} nodeOffset The offset in the descendant node
 * @return {number[]} The offset path
 */
ve.getOffsetPath = function ( ancestor, node, nodeOffset ) {
	var path = [ nodeOffset ];
	while ( node !== ancestor ) {
		if ( node.parentNode === null ) {
			ve.log( node, 'is not a descendant of', ancestor );
			throw new Error( 'Not a descendant' );
		}
		path.unshift(
			Array.prototype.indexOf.call( node.parentNode.childNodes, node )
		);
		node = node.parentNode;
	}
	return path;
};

/**
 * Compare two offset paths for position in document
 *
 * @param {number[]} path1 First offset path
 * @param {number[]} path2 Second offset path
 * @return {number} negative, zero or positive number
 */
ve.compareOffsetPaths = function ( path1, path2 ) {
	var i, len;
	for ( i = 0, len = Math.min( path1.length, path2.length ); i < len; i++ ) {
		if ( path1[ i ] !== path2[ i ] ) {
			return path1[ i ] - path2[ i ];
		}
	}
	return path1.length - path2.length;
};

/**
 * Compare two nodes for position in document
 *
 * @param {Node} node1 First node
 * @param {number} offset1 First offset
 * @param {Node} node2 Second node
 * @param {number} offset2 Second offset
 * @return {number} negative, zero or positive number
 */
ve.compareDocumentOrder = function ( node1, offset1, node2, offset2 ) {

	var commonAncestor = ve.getCommonAncestor( node1, node2 );
	if ( commonAncestor === null ) {
		throw new Error( 'No common ancestor' );
	}
	return ve.compareOffsetPaths(
		ve.getOffsetPath( commonAncestor, node1, offset1 ),
		ve.getOffsetPath( commonAncestor, node2, offset2 )
	);
};

/**
 * Get the client platform string from the browser.
 *
 * HACK: This is a wrapper for calling getSystemPlatform() on the current platform
 * except that if the platform hasn't been constructed yet, it falls back to using
 * the base class implementation in {ve.init.Platform}. A proper solution would be
 * not to need this information before the platform is constructed.
 *
 * @see ve.init.Platform#getSystemPlatform
 * @returns {string} Client platform string
 */
ve.getSystemPlatform = function () {
	return ( ve.init.platform && ve.init.platform.constructor || ve.init.Platform ).static.getSystemPlatform();
};

/*!
 * VisualEditor UserInterface TriggerListener class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Trigger listener
 *
 * @class
 *
 * @constructor
 * @param {string[]} commands Commands to listen to triggers for
 */
ve.TriggerListener = function VeUiTriggerListener( commands ) {
	// Properties
	this.commands = [];
	this.commandsByTrigger = {};
	this.triggers = {};

	this.setupCommands( commands );
};

/* Inheritance */

OO.initClass( ve.TriggerListener );

/* Methods */

/**
 * Setup commands
 *
 * @param {string[]} commands Commands to listen to triggers for
 */
ve.TriggerListener.prototype.setupCommands = function ( commands ) {
	var i, j, command, triggers;
	this.commands = commands;
	if ( commands.length ) {
		for ( i = this.commands.length - 1; i >= 0; i-- ) {
			command = this.commands[i];
			triggers = ve.ui.triggerRegistry.lookup( command );
			if ( triggers ) {
				for ( j = triggers.length - 1; j >= 0; j-- ) {
					this.commandsByTrigger[triggers[j].toString()] = ve.ui.commandRegistry.lookup( command );
				}
				this.triggers[command] = triggers;
			}
		}
	}
};

/**
 * Get list of commands.
 *
 * @returns {string[]} Commands
 */
ve.TriggerListener.prototype.getCommands = function () {
	return this.commands;
};

/**
 * Get command associated with trigger string.
 *
 * @method
 * @param {string} trigger Trigger string
 * @returns {ve.ui.Command|undefined} Command
 */
ve.TriggerListener.prototype.getCommandByTrigger = function ( trigger ) {
	return this.commandsByTrigger[trigger];
};

/**
 * Get triggers for a specified name.
 *
 * @param {string} name Trigger name
 * @returns {ve.ui.Trigger[]|undefined} Triggers
 */
ve.TriggerListener.prototype.getTriggers = function ( name ) {
	return this.triggers[name];
};

/*!
 * VisualEditor tracking methods.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

( function () {
	var callbacks = $.Callbacks( 'memory' ),
		queue = [];

	/**
	 * Track an analytic event.
	 *
	 * VisualEditor uses this method internally to track internal changes of state that are of analytic
	 * interest, either because they provide data about how users interact with the editor, or because
	 * they contain exception info, latency measurements, or other metrics that help gauge performance
	 * and reliability. VisualEditor does not transmit these events by default, but it provides a
	 * generic interface for routing these events to an analytics framework.
	 *
	 * @member ve
	 * @param {string} topic Event name
	 * @param {Object} [data] Additional data describing the event, encoded as an object
	 */
	ve.track = function ( topic, data ) {
		queue.push( { topic: topic, timeStamp: ve.now(), data: data } );
		callbacks.fire( queue );
	};

	/**
	 * Register a handler for subset of analytic events, specified by topic
	 *
	 * Handlers will be called once for each tracked event, including any events that fired before the
	 * handler was registered; 'this' is set to a plain object with a 'timeStamp' property indicating
	 * the exact time at which the event fired, a string 'topic' property naming the event, and a
	 * 'data' property which is an object of event-specific data. The event topic and event data are
	 * also passed to the callback as the first and second arguments, respectively.
	 *
	 * @member ve
	 * @param {string} topic Handle events whose name starts with this string prefix
	 * @param {Function} callback Handler to call for each matching tracked event
	 */
	ve.trackSubscribe = function ( topic, callback ) {
		var seen = 0;

		callbacks.add( function ( queue ) {
			var event;
			for ( ; seen < queue.length; seen++ ) {
				event = queue[ seen ];
				if ( event.topic.indexOf( topic ) === 0 ) {
					callback.call( event, event.topic, event.data );
				}
			}
		} );
	};

	/**
	 * Register a handler for all analytic events
	 *
	 * Like ve#trackSubscribe, but binds the callback to all events, regardless of topic.
	 *
	 * @member ve
	 * @param {Function} callback
	 */
	ve.trackSubscribeAll = function ( callback ) {
		ve.trackSubscribe( '', callback );
	};
}() );

/*!
 * VisualEditor Initialization namespace.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Namespace for all VisualEditor Initialization classes, static methods and static properties.
 * @class
 * @singleton
 */
ve.init = {
	// platform: Initialized in a file containing a subclass of ve.init.Platform
};

/*!
 * VisualEditor Initialization Platform class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic Initialization platform.
 *
 * @abstract
 * @mixins OO.EventEmitter
 *
 * @constructor
 */
ve.init.Platform = function VeInitPlatform() {
	// Mixin constructors
	OO.EventEmitter.call( this );
};

/* Inheritance */

OO.mixinClass( ve.init.Platform, OO.EventEmitter );

/* Static Methods */

/**
 * Get client platform string from browser.
 *
 * @static
 * @method
 * @inheritable
 * @returns {string} Client platform string
 */
ve.init.Platform.static.getSystemPlatform = function () {
	var platforms = ['win', 'mac', 'linux', 'sunos', 'solaris', 'iphone'],
		match = new RegExp( '(' + platforms.join( '|' ) + ')' ).exec( window.navigator.platform.toLowerCase() );
	if ( match ) {
		return match[1];
	}
};

/**
 * Check whether we are running in Internet Explorer.
 *
 * HACK: This should not be needed, and it should eventually be removed. If this hasn't died
 * in a fire by the end of September 2015, Roan has failed.
 *
 * @static
 * @method
 * @inheritable
 * @returns {boolean} Whether we are in IE
 */
ve.init.Platform.static.isInternetExplorer = function () {
	return navigator.userAgent.indexOf( 'Trident' ) !== -1 || navigator.userAgent.indexOf( 'Edge' ) !== -1;
};

/* Methods */

/**
 * Get a regular expression that matches allowed external link URLs.
 *
 * @method
 * @abstract
 * @returns {RegExp} Regular expression object
 */
ve.init.Platform.prototype.getExternalLinkUrlProtocolsRegExp = function () {
	throw new Error( 've.init.Platform.getExternalLinkUrlProtocolsRegExp must be overridden in subclass' );
};

/**
 * Get a config value from the platform.
 *
 * @method
 * @abstract
 * @param {string|string[]} key Config key, or list of keys
 * @returns {Mixed|Object} Config value, or keyed object of config values if list of keys provided
 */
ve.init.Platform.prototype.getConfig = function () {
	throw new Error( 've.init.Platform.getConfig must be overridden in subclass' );
};

/**
 * Add multiple messages to the localization system.
 *
 * @method
 * @abstract
 * @param {Object} messages Containing plain message values
 */
ve.init.Platform.prototype.addMessages = function () {
	throw new Error( 've.init.Platform.addMessages must be overridden in subclass' );
};

/**
 * Get a message from the localization system.
 *
 * @method
 * @abstract
 * @param {string} key Message key
 * @param {Mixed...} [args] List of arguments which will be injected at $1, $2, etc. in the message
 * @returns {string} Localized message, or key or '<' + key + '>' if message not found
 */
ve.init.Platform.prototype.getMessage = function () {
	throw new Error( 've.init.Platform.getMessage must be overridden in subclass' );
};

/**
 * Add multiple parsed messages to the localization system.
 *
 * @method
 * @abstract
 * @param {Object} messages Map of message-key/html pairs
 */
ve.init.Platform.prototype.addParsedMessages = function () {
	throw new Error( 've.init.Platform.addParsedMessages must be overridden in subclass' );
};

/**
 * Get a parsed message as HTML string.
 *
 * Does not support $# replacements.
 *
 * @method
 * @abstract
 * @param {string} key Message key
 * @returns {string} Parsed localized message as HTML string
 */
ve.init.Platform.prototype.getParsedMessage = function () {
	throw new Error( 've.init.Platform.getParsedMessage must be overridden in subclass' );
};

/**
 * Get the user language and any fallback languages.
 *
 * @method
 * @abstract
 * @returns {string[]} User language strings
 */
ve.init.Platform.prototype.getUserLanguages = function () {
	throw new Error( 've.init.Platform.getUserLanguages must be overridden in subclass' );
};

/**
 * Get a list of URL entry points where media can be found.
 *
 * @method
 * @abstract
 * @returns {string[]} API URLs
 */
ve.init.Platform.prototype.getMediaSources = function () {
	throw new Error( 've.init.Platform.getMediaSources must be overridden in subclass' );
};

/**
 * Get a list of all language codes.
 *
 * @method
 * @abstract
 * @returns {string[]} Language codes
 */
ve.init.Platform.prototype.getLanguageCodes = function () {
	throw new Error( 've.init.Platform.getLanguageCodes must be overridden in subclass' );
};

/**
 * Get a language's name from its code, in the current user language if possible.
 *
 * @method
 * @abstract
 * @param {string} code Language code
 * @returns {string} Language name
 */
ve.init.Platform.prototype.getLanguageName = function () {
	throw new Error( 've.init.Platform.getLanguageName must be overridden in subclass' );
};

/**
 * Get a language's autonym from its code.
 *
 * @method
 * @abstract
 * @param {string} code Language code
 * @returns {string} Language autonym
 */
ve.init.Platform.prototype.getLanguageAutonym = function () {
	throw new Error( 've.init.Platform.getLanguageAutonym must be overridden in subclass' );
};

/**
 * Get a language's direction from its code.
 *
 * @method
 * @abstract
 * @param {string} code Language code
 * @returns {string} Language direction
 */
ve.init.Platform.prototype.getLanguageDirection = function () {
	throw new Error( 've.init.Platform.getLanguageDirection must be overridden in subclass' );
};

/**
 * Initialize the platform. The default implementation is to do nothing and return a resolved
 * promise. Subclasses should override this if they have asynchronous initialization work to do.
 *
 * External callers should not call this. Instead, call #getInitializedPromise.
 *
 * @private
 * @returns {jQuery.Promise} Promise that will be resolved once initialization is done
 */
ve.init.Platform.prototype.initialize = function () {
	return $.Deferred().resolve().promise();
};

/**
 * Get a promise to track when the platform has initialized. The platform won't be ready for use
 * until this promise is resolved.
 *
 * Since the initialization only happens once, and the same (resolved) promise
 * is returned when called again, and since the Platform instance is global
 * (shared between different Target instances) it is important not to rely
 * on this promise being asynchronous.
 *
 * @returns {jQuery.Promise} Promise that will be resolved once the platform is ready
 */
ve.init.Platform.prototype.getInitializedPromise = function () {
	if ( !this.initialized ) {
		this.initialized = this.initialize();
	}
	return this.initialized;
};

/*!
 * VisualEditor Initialization Target class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic Initialization target.
 *
 * @class
 * @abstract
 * @extends OO.ui.Element
 * @mixins OO.EventEmitter
 *
 * @constructor
 * @param {Object} toolbarConfig Configuration options for the toolbar
 */
ve.init.Target = function VeInitTarget( toolbarConfig ) {
	// Parent constructor
	OO.ui.Element.call( this );

	// Mixin constructors
	OO.EventEmitter.call( this );

	// Properties
	this.surfaces = [];
	this.surface = null;
	this.toolbar = null;
	this.toolbarConfig = toolbarConfig;
	this.documentTriggerListener = new ve.TriggerListener( this.constructor.static.documentCommands );
	this.targetTriggerListener = new ve.TriggerListener( this.constructor.static.targetCommands );

	// Initialization
	this.$element.addClass( 've-init-target' );

	if ( ve.init.platform.constructor.static.isInternetExplorer() ) {
		this.$element.addClass( 've-init-target-ie' );
	}

	// Events
	this.onDocumentKeyDownHandler = this.onDocumentKeyDown.bind( this );
	this.onTargetKeyDownHandler = this.onTargetKeyDown.bind( this );
	this.bindHandlers();

	// Register
	ve.init.target = this;
};

/* Inheritance */

OO.inheritClass( ve.init.Target, OO.ui.Element );

OO.mixinClass( ve.init.Target, OO.EventEmitter );

/* Static Properties */

ve.init.Target.static.toolbarGroups = [
	// History
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-history' ),
		include: [ 'undo', 'redo' ]
	},
	// Format
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-paragraph-format' ),
		type: 'menu',
		indicator: 'down',
		title: OO.ui.deferMsg( 'visualeditor-toolbar-format-tooltip' ),
		include: [ { group: 'format' } ],
		promote: [ 'paragraph' ],
		demote: [ 'preformatted', 'blockquote' ]
	},
	// Basic style
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-text-style' ),
		title: OO.ui.deferMsg( 'visualeditor-toolbar-style-tooltip' ),
		include: [ 'bold', 'italic' ]
	},
	// Style
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-text-style' ),
		type: 'list',
		indicator: 'down',
		icon: 'text-style',
		title: OO.ui.deferMsg( 'visualeditor-toolbar-style-tooltip' ),
		include: [ { group: 'textStyle' }, 'language', 'clear' ],
		demote: [ 'strikethrough', 'code', 'underline', 'language', 'clear' ]
	},
	// Link
	{
		header: OO.ui.deferMsg( 'visualeditor-linkinspector-title' ),
		include: [ 'link' ]
	},
	// Structure
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-structure' ),
		type: 'list',
		icon: 'bullet-list',
		indicator: 'down',
		include: [ { group: 'structure' } ],
		demote: [ 'outdent', 'indent' ]
	},
	// Insert
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-insert' ),
		type: 'list',
		icon: 'insert',
		label: '',
		title: OO.ui.deferMsg( 'visualeditor-toolbar-insert' ),
		indicator: 'down',
		include: '*',
		demote: [ 'specialcharacter' ]
	},
	// Table
	{
		header: OO.ui.deferMsg( 'visualeditor-toolbar-table' ),
		type: 'list',
		icon: 'table-insert',
		indicator: 'down',
		include: [ { group: 'table' } ],
		demote: [ 'deleteTable' ]
	}
];

/**
 * List of commands which can be triggered anywhere from within the document
 *
 * @type {string[]} List of command names
 */
ve.init.Target.static.documentCommands = ['commandHelp'];

/**
 * List of commands which can be triggered from within the target element
 *
 * @type {string[]} List of command names
 */
ve.init.Target.static.targetCommands = ['findAndReplace', 'findNext', 'findPrevious'];

/**
 * List of commands to exclude from the target entirely
 *
 * @type {string[]} List of command names
 */
ve.init.Target.static.excludeCommands = [];

/**
 * Surface import rules
 *
 * One set for external (non-VE) paste sources and one for all paste sources.
 *
 * @see ve.dm.ElementLinearData#sanitize
 * @type {Object}
 */
ve.init.Target.static.importRules = {
	external: {
		blacklist: [
			// Annotations
			// TODO: allow spans
			'textStyle/span',
			// Nodes
			'alienInline', 'alienBlock', 'comment'
		]
	},
	all: null
};

/* Methods */

/**
 * Bind event handlers to target and document
 */
ve.init.Target.prototype.bindHandlers = function () {
	$( this.getElementDocument() ).on( 'keydown', this.onDocumentKeyDownHandler );
	this.$element.on( 'keydown', this.onTargetKeyDownHandler );
};

/**
 * Unbind event handlers on target and document
 */
ve.init.Target.prototype.unbindHandlers = function () {
	$( this.getElementDocument() ).off( 'keydown', this.onDocumentKeyDownHandler );
	this.$element.off( 'keydown', this.onTargetKeyDownHandler );
};

/**
 * Destroy the target
 */
ve.init.Target.prototype.destroy = function () {
	this.clearSurfaces();
	if ( this.toolbar ) {
		this.toolbar.destroy();
		this.toolbar = null;
	}
	this.$element.remove();
	this.unbindHandlers();
	ve.init.target = null;
};

/**
 * Handle key down events on the document
 *
 * @param {jQuery.Event} e Key down event
 */
ve.init.Target.prototype.onDocumentKeyDown = function ( e ) {
	var command, trigger = new ve.ui.Trigger( e );
	if ( trigger.isComplete() ) {
		command = this.documentTriggerListener.getCommandByTrigger( trigger.toString() );
		if ( command && command.execute( this.getSurface() ) ) {
			e.preventDefault();
		}
	}
};

/**
 * Handle key down events on the target
 *
 * @param {jQuery.Event} e Key down event
 */
ve.init.Target.prototype.onTargetKeyDown = function ( e ) {
	var command, trigger = new ve.ui.Trigger( e );
	if ( trigger.isComplete() ) {
		command = this.targetTriggerListener.getCommandByTrigger( trigger.toString() );
		if ( command && command.execute( this.getSurface() ) ) {
			e.preventDefault();
		}
	}
};

/**
 * Create a surface.
 *
 * @method
 * @param {ve.dm.Document} dmDoc Document model
 * @param {Object} [config] Configuration options
 * @returns {ve.ui.Surface}
 */
ve.init.Target.prototype.createSurface = function ( dmDoc, config ) {
	config = ve.extendObject( {
		excludeCommands: OO.simpleArrayUnion(
			this.constructor.static.excludeCommands,
			this.constructor.static.documentCommands,
			this.constructor.static.targetCommands
		),
		importRules: this.constructor.static.importRules
	}, config );
	return new ve.ui.DesktopSurface( dmDoc, config );
};

/**
 * Add a surface to the target
 *
 * @param {ve.dm.Document} dmDoc Document model
 * @param {Object} [config] Configuration options
 * @returns {ve.ui.Surface}
 */
ve.init.Target.prototype.addSurface = function ( dmDoc, config ) {
	var surface = this.createSurface( dmDoc, config );
	this.surfaces.push( surface );
	surface.getView().connect( this, { focus: this.onSurfaceViewFocus.bind( this, surface ) } );
	return surface;
};

/**
 * Destroy and remove all surfaces from the target
 */
ve.init.Target.prototype.clearSurfaces = function () {
	while ( this.surfaces.length ) {
		this.surfaces.pop().destroy();
	}
};

/**
 * Handle focus events from a surface's view
 *
 * @param {ve.ui.Surface} surface Surface firing the event
 */
ve.init.Target.prototype.onSurfaceViewFocus = function ( surface ) {
	this.setSurface( surface );
};

/**
 * Set the target's active surface
 *
 * @param {ve.ui.Surface} surface Surface
 */
ve.init.Target.prototype.setSurface = function ( surface ) {
	if ( surface !== this.surface ) {
		this.surface = surface;
		this.setupToolbar( surface );
	}
};

/**
 * Get the target's active surface
 *
 * @return {ve.ui.Surface} Surface
 */
ve.init.Target.prototype.getSurface = function () {
	return this.surface;
};

/**
 * Get the target's toolbar
 *
 * @return {ve.ui.TargetToolbar} Toolbar
 */
ve.init.Target.prototype.getToolbar = function () {
	if ( !this.toolbar ) {
		this.toolbar = new ve.ui.TargetToolbar( this, this.toolbarConfig );
	}
	return this.toolbar;
};

/**
 * Set up the toolbar, attaching it to a surface.
 *
 * @param {ve.ui.Surface} surface Surface
 */
ve.init.Target.prototype.setupToolbar = function ( surface ) {
	this.getToolbar().setup( this.constructor.static.toolbarGroups, surface );
	this.getToolbar().$element.insertBefore( surface.$element );
	this.getToolbar().$bar.append( surface.getToolbarDialogs().$element );
};

/*!
 * VisualEditor Range class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * @class
 *
 * @constructor
 * @param {number} from Starting offset
 * @param {number} [to=from] Ending offset
 */
ve.Range = function VeRange( from, to ) {
	this.from = from || 0;
	this.to = to === undefined ? this.from : to;
	this.start = this.from < this.to ? this.from : this.to;
	this.end = this.from < this.to ? this.to : this.from;
};

/* Inheritance */

OO.initClass( ve.Range );

/**
 * @property {number} from Starting offset
 */

/**
 * @property {number} to Ending offset
 */

/**
 * @property {number} start Starting offset (the lesser of #to and #from)
 */

/**
 * @property {number} end Ending offset (the greater of #to and #from)
 */

/* Static Methods */

/**
 * Create a new range from a JSON serialization of a range
 *
 * @see ve.Range#toJSON
 *
 * @param {string} json JSON serialization
 * @return {ve.Range} New range
 */
ve.Range.static.newFromJSON = function ( json ) {
	return this.newFromHash( JSON.parse( json ) );
};

/**
 * Create a new range from a range hash object
 *
 * @see ve.Range#toJSON
 *
 * @param {Object} hash Hash object
 * @return {ve.Range} New range
 */
ve.Range.static.newFromHash = function ( hash ) {
	return new ve.Range( hash.from, hash.to );
};

/**
 * Create a range object that covers all of the given ranges.
 *
 * @static
 * @param {Array} ranges Array of ve.Range objects (at least one)
 * @param {boolean} backwards Return a backwards range
 * @returns {ve.Range} Range that spans all of the given ranges
 */
ve.Range.static.newCoveringRange = function ( ranges, backwards ) {
	var minStart, maxEnd, i, range;
	if ( !ranges || ranges.length === 0 ) {
		throw new Error( 'newCoveringRange() requires at least one range' );
	}
	minStart = ranges[0].start;
	maxEnd = ranges[0].end;
	for ( i = 1; i < ranges.length; i++ ) {
		if ( ranges[i].start < minStart ) {
			minStart = ranges[i].start;
		}
		if ( ranges[i].end > maxEnd ) {
			maxEnd = ranges[i].end;
		}
	}
	if ( backwards ) {
		range = new ve.Range( maxEnd, minStart );
	} else {
		range = new ve.Range( minStart, maxEnd );
	}
	return range;
};

/* Methods */

/**
 * Get a clone.
 *
 * @returns {ve.Range} Clone of range
 */
ve.Range.prototype.clone = function () {
	return new this.constructor( this.from, this.to );
};

/**
 * Check if an offset is within the range.
 *
 * Specifically we mean the whole element at a specific offset, so in effect
 * this is the same as #containsRange( new ve.Range( offset, offset + 1 ) ).
 *
 * @param {number} offset Offset to check
 * @returns {boolean} If offset is within the range
 */
ve.Range.prototype.containsOffset = function ( offset ) {
	return offset >= this.start && offset < this.end;
};

/**
 * Check if another range is within the range.
 *
 * @param {ve.Range} offset Range to check
 * @returns {boolean} If other range is within the range
 */
ve.Range.prototype.containsRange = function ( range ) {
	return range.start >= this.start && range.end <= this.end;
};

/**
 * Get the length of the range.
 *
 * @returns {number} Length of range
 */
ve.Range.prototype.getLength = function () {
	return this.end - this.start;
};

/**
 * Gets a range with reversed direction.
 *
 * @returns {ve.Range} A new range
 */
ve.Range.prototype.flip = function () {
	return new ve.Range( this.to, this.from );
};

/**
 * Get a range that's a translated version of this one.
 *
 * @param {number} distance Distance to move range by
 * @returns {ve.Range} New translated range
 */
ve.Range.prototype.translate = function ( distance ) {
	return new ve.Range( this.from + distance, this.to + distance );
};

/**
 * Check if two ranges are equal, taking direction into account.
 *
 * @param {ve.Range|null} other
 * @returns {boolean}
 */
ve.Range.prototype.equals = function ( other ) {
	return other && this.from === other.from && this.to === other.to;
};

/**
 * Check if two ranges are equal, ignoring direction.
 *
 * @param {ve.Range|null} other
 * @returns {boolean}
 */
ve.Range.prototype.equalsSelection = function ( other ) {
	return other && this.end === other.end && this.start === other.start;
};

/**
 * Create a new range with a limited length.
 *
 * @param {number} length Length of the new range (negative for truncate from right)
 * @returns {ve.Range} A new range
 */
ve.Range.prototype.truncate = function ( length ) {
	if ( length >= 0 ) {
		return new ve.Range(
			this.start, Math.min( this.start + length, this.end )
		);
	} else {
		return new ve.Range(
			Math.max( this.end + length, this.start ), this.end
		);
	}
};

/**
 * Expand a range to include another range, preserving direction.
 *
 * @param {ve.Range} other Range to expand to include
 * @return {ve.Range} Range covering this range and other
 */
ve.Range.prototype.expand = function ( other ) {
	return ve.Range.static.newCoveringRange( [this, other], this.isBackwards() );
};

/**
 * Check if the range is collapsed.
 *
 * A collapsed range has equal start and end values making its length zero.
 *
 * @returns {boolean} Range is collapsed
 */
ve.Range.prototype.isCollapsed = function () {
	return this.from === this.to;
};

/**
 * Check if the range is backwards, i.e. from > to
 *
 * @returns {boolean} Range is backwards
 */
ve.Range.prototype.isBackwards = function () {
	return this.from > this.to;
};

/**
 * Get a object summarizing the range for JSON serialization
 *
 * @returns {Object} Object for JSON serialization
 */
ve.Range.prototype.toJSON = function () {
	return {
		type: 'range',
		from: this.from,
		to: this.to
	};
};

/*!
 * VisualEditor Node class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic node.
 *
 * @abstract
 * @mixins OO.EventEmitter
 *
 * @constructor
 */
ve.Node = function VeNode() {
	// Properties
	this.type = this.constructor.static.name;
	this.parent = null;
	this.root = null;
	this.doc = null;
};

/**
 * @event attach
 * @param {ve.Node} parent
 */

/**
 * @event detach
 * @param {ve.Node} parent
 */

/**
 * @event root
 */

/**
 * @event unroot
 */

/* Abstract Methods */

/**
 * Get allowed child node types.
 *
 * @method
 * @abstract
 * @returns {string[]|null} List of node types allowed as children or null if any type is allowed
 */
ve.Node.prototype.getChildNodeTypes = function () {
	throw new Error( 've.Node.getChildNodeTypes must be overridden in subclass' );
};

/**
 * Get allowed parent node types.
 *
 * @method
 * @abstract
 * @returns {string[]|null} List of node types allowed as parents or null if any type is allowed
 */
ve.Node.prototype.getParentNodeTypes = function () {
	throw new Error( 've.Node.getParentNodeTypes must be overridden in subclass' );
};

/**
 * Check if the specified type is an allowed child node type
 *
 * @param {string} type Node type
 * @return {boolean} The type is allowed
 */
ve.Node.prototype.isAllowedChildNodeType = function ( type ) {
	var childTypes = this.getChildNodeTypes();
	return childTypes === null || ve.indexOf( type, childTypes ) !== -1;
};

/**
 * Check if the specified type is an allowed child node type
 *
 * @param {string} type Node type
 * @return {boolean} The type is allowed
 */
ve.Node.prototype.isAllowedParentNodeType = function ( type ) {
	var parentTypes = this.getParentNodeTypes();
	return parentTypes === null || ve.indexOf( type, parentTypes ) !== -1;
};

/**
 * Get suggested parent node types.
 *
 * @method
 * @abstract
 * @returns {string[]|null} List of node types suggested as parents or null if any type is suggested
 */
ve.Node.prototype.getSuggestedParentNodeTypes = function () {
	throw new Error( 've.Node.getSuggestedParentNodeTypes must be overridden in subclass' );
};

/**
 * Check if the node can have children.
 *
 * @method
 * @abstract
 * @returns {boolean} Node can have children
 */
ve.Node.prototype.canHaveChildren = function () {
	throw new Error( 've.Node.canHaveChildren must be overridden in subclass' );
};

/**
 * Check if the node can have children but not content nor be content.
 *
 * @method
 * @abstract
 * @returns {boolean} Node can have children but not content nor be content
 */
ve.Node.prototype.canHaveChildrenNotContent = function () {
	throw new Error( 've.Node.canHaveChildrenNotContent must be overridden in subclass' );
};

/**
 * Check if the node can contain content.
 *
 * @method
 * @abstract
 * @returns {boolean} Node can contain content
 */
ve.Node.prototype.canContainContent = function () {
	throw new Error( 've.Node.canContainContent must be overridden in subclass' );
};

/**
 * Check if the node is content.
 *
 * @method
 * @abstract
 * @returns {boolean} Node is content
 */
ve.Node.prototype.isContent = function () {
	throw new Error( 've.Node.isContent must be overridden in subclass' );
};

/**
 * Check if the node has a wrapped element in the document data.
 *
 * @method
 * @abstract
 * @returns {boolean} Node represents a wrapped element
 */
ve.Node.prototype.isWrapped = function () {
	throw new Error( 've.Node.isWrapped must be overridden in subclass' );
};

/**
 * Check if the node is focusable
 *
 * @method
 * @abstract
 * @returns {boolean} Node is focusable
 */
ve.Node.prototype.isFocusable = function () {
	throw new Error( 've.Node.isFocusable must be overridden in subclass' );
};

/**
 * Check if the node has significant whitespace.
 *
 * Can only be true if canContainContent is also true.
 *
 * @method
 * @abstract
 * @returns {boolean} Node has significant whitespace
 */
ve.Node.prototype.hasSignificantWhitespace = function () {
	throw new Error( 've.Node.hasSignificantWhitespace must be overridden in subclass' );
};

/**
 * Check if the node handles its own children
 *
 * @method
 * @abstract
 * @returns {boolean} Node handles its own children
 */
ve.Node.prototype.handlesOwnChildren = function () {
	throw new Error( 've.Node.handlesOwnChildren must be overridden in subclass' );
};

/**
 * Get the length of the node.
 *
 * @method
 * @abstract
 * @returns {number} Node length
 */
ve.Node.prototype.getLength = function () {
	throw new Error( 've.Node.getLength must be overridden in subclass' );
};

/**
 * Get the offset of the node within the document.
 *
 * If the node has no parent than the result will always be 0.
 *
 * @method
 * @abstract
 * @returns {number} Offset of node
 * @throws {Error} Node not found in parent's children array
 */
ve.Node.prototype.getOffset = function () {
	throw new Error( 've.Node.getOffset must be overridden in subclass' );
};

/**
 * Get the range inside the node.
 *
 * @method
 * @param {boolean} backwards Return a backwards range
 * @returns {ve.Range} Inner node range
 */
ve.Node.prototype.getRange = function ( backwards ) {
	var offset = this.getOffset() + ( this.isWrapped() ? 1 : 0 ),
		range = new ve.Range( offset, offset + this.getLength() );
	return backwards ? range.flip() : range;
};

/**
 * Get the outer range of the node, which includes wrappers if present.
 *
 * @method
 * @param {boolean} backwards Return a backwards range
 * @returns {ve.Range} Node outer range
 */
ve.Node.prototype.getOuterRange = function ( backwards ) {
	var range = new ve.Range( this.getOffset(), this.getOffset() + this.getOuterLength() );
	return backwards ? range.flip() : range;
};

/**
 * Get the outer length of the node, which includes wrappers if present.
 *
 * @method
 * @returns {number} Node outer length
 */
ve.Node.prototype.getOuterLength = function () {
	return this.getLength() + ( this.isWrapped() ? 2 : 0 );
};

/* Methods */

/**
 * Get the symbolic node type name.
 *
 * @method
 * @returns {string} Symbolic name of element type
 */
ve.Node.prototype.getType = function () {
	return this.type;
};

/**
 * Get a reference to the node's parent.
 *
 * @method
 * @returns {ve.Node} Reference to the node's parent
 */
ve.Node.prototype.getParent = function () {
	return this.parent;
};

/**
 * Get the root node of the tree the node is currently attached to.
 *
 * @method
 * @returns {ve.Node} Root node
 */
ve.Node.prototype.getRoot = function () {
	return this.root;
};

/**
 * Set the root node.
 *
 * This method is overridden by nodes with children.
 *
 * @method
 * @param {ve.Node} root Node to use as root
 * @fires root
 * @fires unroot
 */
ve.Node.prototype.setRoot = function ( root ) {
	if ( root !== this.root ) {
		this.root = root;
		if ( this.getRoot() ) {
			this.emit( 'root' );
		} else {
			this.emit( 'unroot' );
		}
	}
};

/**
 * Get the document the node is a part of.
 *
 * @method
 * @returns {ve.Document} Document the node is a part of
 */
ve.Node.prototype.getDocument = function () {
	return this.doc;
};

/**
 * Set the document the node is a part of.
 *
 * This method is overridden by nodes with children.
 *
 * @method
 * @param {ve.Document} doc Document this node is a part of
 */
ve.Node.prototype.setDocument = function ( doc ) {
	this.doc = doc;
};

/**
 * Attach the node to another as a child.
 *
 * @method
 * @param {ve.Node} parent Node to attach to
 * @fires attach
 */
ve.Node.prototype.attach = function ( parent ) {
	this.parent = parent;
	this.setRoot( parent.getRoot() );
	this.setDocument( parent.getDocument() );
	this.emit( 'attach', parent );
};

/**
 * Detach the node from its parent.
 *
 * @method
 * @fires detach
 */
ve.Node.prototype.detach = function () {
	var parent = this.parent;
	this.parent = null;
	this.setRoot( null );
	this.setDocument( null );
	this.emit( 'detach', parent );
};

/**
 * Traverse tree of nodes (model or view) upstream.
 *
 * For each traversed node, the callback function will be passed the traversed node as a parameter.
 *
 * @method
 * @param {Function} callback Callback method to be called for every traversed node. Returning false stops the traversal.
 */
ve.Node.prototype.traverseUpstream = function ( callback ) {
	var node = this;
	while ( node ) {
		if ( callback( node ) === false ) {
			break;
		}
		node = node.getParent();
	}
};

/*!
 * VisualEditor BranchNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Branch node mixin.
 *
 * Extenders are expected to inherit from ve.Node.
 *
 * Branch nodes are immutable, which is why there are no methods for adding or removing children.
 * DataModel classes will add this functionality, and other subclasses will implement behavior that
 * mimics changes made to DataModel nodes.
 *
 * @class
 * @abstract
 * @constructor
 * @param {ve.Node[]} children Array of children to add
 */
ve.BranchNode = function VeBranchNode( children ) {
	this.children = Array.isArray( children ) ? children : [];
};

/* Methods */

/**
 * Check if the node has children.
 *
 * @method
 * @returns {boolean} Whether the node has children
 */
ve.BranchNode.prototype.hasChildren = function () {
	return true;
};

/**
 * Get child nodes.
 *
 * @method
 * @returns {ve.Node[]} List of child nodes
 */
ve.BranchNode.prototype.getChildren = function () {
	return this.children;
};

/**
 * Get the index of a child node.
 *
 * @method
 * @param {ve.dm.Node} node Child node to find index of
 * @returns {number} Index of child node or -1 if node was not found
 */
ve.BranchNode.prototype.indexOf = function ( node ) {
	return ve.indexOf( node, this.children );
};

/**
 * Set the root node.
 *
 * @method
 * @see ve.Node#setRoot
 * @param {ve.Node} root Node to use as root
 */
ve.BranchNode.prototype.setRoot = function ( root ) {
	if ( root === this.root ) {
		// Nothing to do, don't recurse into all descendants
		return;
	}
	this.root = root;
	for ( var i = 0; i < this.children.length; i++ ) {
		this.children[i].setRoot( root );
	}
};

/**
 * Set the document the node is a part of.
 *
 * @method
 * @see ve.Node#setDocument
 * @param {ve.Document} root Node to use as root
 */
ve.BranchNode.prototype.setDocument = function ( doc ) {
	if ( doc === this.doc ) {
		// Nothing to do, don't recurse into all descendants
		return;
	}
	this.doc = doc;
	for ( var i = 0; i < this.children.length; i++ ) {
		this.children[i].setDocument( doc );
	}
};

/**
 * Get a node from an offset.
 *
 * This method is pretty expensive. If you need to get different slices of the same content, get
 * the content first, then slice it up locally.
 *
 * TODO: Rewrite this method to not use recursion, because the function call overhead is expensive
 *
 * @method
 * @param {number} offset Offset get node for
 * @param {boolean} [shallow] Do not iterate into child nodes of child nodes
 * @returns {ve.Node|null} Node at offset, or null if none was found
 */
ve.BranchNode.prototype.getNodeFromOffset = function ( offset, shallow ) {
	if ( offset === 0 ) {
		return this;
	}
	// TODO a lot of logic is duplicated in selectNodes(), abstract that into a traverser or something
	if ( this.children.length ) {
		var i, length, nodeLength, childNode,
			nodeOffset = 0;
		for ( i = 0, length = this.children.length; i < length; i++ ) {
			childNode = this.children[i];
			if ( offset === nodeOffset ) {
				// The requested offset is right before childNode,
				// so it's not inside any of this's children, but inside this
				return this;
			}
			nodeLength = childNode.getOuterLength();
			if ( offset >= nodeOffset && offset < nodeOffset + nodeLength ) {
				if ( !shallow && childNode.hasChildren() && childNode.getChildren().length ) {
					return this.getNodeFromOffset.call( childNode, offset - nodeOffset - 1 );
				} else {
					return childNode;
				}
			}
			nodeOffset += nodeLength;
		}
		if ( offset === nodeOffset ) {
			// The requested offset is right before this.children[i],
			// so it's not inside any of this's children, but inside this
			return this;
		}
	}
	return null;
};

/*!
 * VisualEditor LeafNode mixin.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Leaf node mixin.
 *
 * @class
 * @abstract
 * @constructor
 */
ve.LeafNode = function VeLeafNode() {
	//
};

/* Methods */

/**
 * Check if the node has children.
 *
 * @method
 * @returns {boolean} Whether the node has children
 */
ve.LeafNode.prototype.hasChildren = function () {
	return false;
};

/*!
 * VisualEditor Document class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic document.
 *
 * @class
 * @mixins OO.EventEmitter
 *
 * @constructor
 * @param {ve.Node} documentNode Document node
 */
ve.Document = function VeDocument( documentNode ) {
	// Mixin constructors
	OO.EventEmitter.call( this );

	// Properties
	this.documentNode = documentNode;
};

/* Inheritance */

OO.mixinClass( ve.Document, OO.EventEmitter );

/* Methods */

/**
 * Get the root of the document's node tree.
 *
 * @method
 * @returns {ve.Node} Root of node tree
 */
ve.Document.prototype.getDocumentNode = function () {
	return this.documentNode;
};

/**
 * Get a node a an offset.
 *
 * @method
 * @param {number} offset Offset to get node at
 * @returns {ve.Node|null} Node at offset
 */
ve.Document.prototype.getBranchNodeFromOffset = function ( offset ) {
	var node = this.getDocumentNode().getNodeFromOffset( offset );
	if ( node && !node.hasChildren() ) {
		node = node.getParent();
	}
	return node;
};

/**
 * Gets a list of nodes and the ranges within them that a selection of the document covers.
 *
 * @method
 * @param {ve.Range} range Range within document to select nodes
 * @param {string} [mode='leaves'] Type of selection to perform:
 *
 * - `leaves`: Return all leaf nodes in the given range (descends all the way down)
 * - `branches`': Return all branch nodes in the given range
 * - `covered`: Do not descend into nodes that are entirely covered by the range. The result
 *   is similar to that of 'leaves' except that if a node is entirely covered, its
 *   children aren't returned separately.
 * - `siblings`: Return a set of adjacent siblings covered by the range (descends as long as the
 *   range is in a single node)
 * @returns {Array} List of objects describing nodes in the selection and the ranges therein:
 *
 * - `node`: Reference to a ve.Node
 * - `range`: ve.Range, missing if the entire node is covered
 * - `index`: Index of the node in its parent, missing if node has no parent
 * - `indexInNode`: If range is a zero-length range between two children of node,
 *   this is set to the index of the child following range (or to
 *   `node.children.length + 1` if range is between the last child and
 *   the end). If range is a zero-length range inside an empty non-content branch node, this is 0.
 *   Missing in all other cases.
 * - `nodeRange`: Range covering the inside of the entire node, not including wrapper
 * - `nodeOuterRange`: Range covering the entire node, including wrapper
 * - `parentOuterRange`: Outer range of node's parent. Missing if there is no parent
 *   or if indexInNode is set.
 *
 * @throws {Error} Invalid mode
 * @throws {Error} Invalid start offset
 * @throws {Error} Invalid end offset
 * @throws {Error} Failed to select any nodes
 */
ve.Document.prototype.selectNodes = function ( range, mode ) {
	var node, prevNode, nextNode, left, right, parentFrame,
		startInside, endInside, startBetween, endBetween,
		nodeRange, parentRange,
		isWrapped, isPrevUnwrapped, isNextUnwrapped, isEmptyBranch,
		doc = this.getDocumentNode(),
		retval = [],
		start = range.start,
		end = range.end,
		stack = [ {
			// Node we are currently stepping through
			// Note each iteration visits a child of node, not node itself
			node: doc,
			// Index of the child in node we're visiting
			index: 0,
			// First offset inside node
			startOffset: 0
		} ],
		currentFrame = stack[0],
		startFound = false;

	mode = mode || 'leaves';
	if ( mode !== 'leaves' && mode !== 'branches' && mode !== 'covered' && mode !== 'siblings' ) {
		throw new Error( 'Invalid mode: ' + mode );
	}

	if ( start < 0 || start > doc.getLength() ) {
		throw new Error( 'Invalid start offset: ' + start );
	}
	if ( end < 0 || end > doc.getLength() ) {
		throw new Error( 'Invalid end offset: ' + end );
	}

	if ( !doc.children || doc.children.length === 0 ) {
		// Document has no children. This is weird
		nodeRange = new ve.Range( 0, doc.getLength() );
		return [ {
			node: doc,
			range: new ve.Range( start, end ),
			index: 0,
			nodeRange: nodeRange,
			nodeOuterRange: nodeRange
		} ];
	}
	left = doc.children[0].isWrapped() ? 1 : 0;

	do {
		node = currentFrame.node.children[currentFrame.index];
		prevNode = currentFrame.node.children[currentFrame.index - 1];
		nextNode = currentFrame.node.children[currentFrame.index + 1];
		right = left + node.getLength();
		// Is the start inside node?
		startInside = start >= left && start <= right;
		// Is the end inside node?
		endInside = end >= left && end <= right;
		// Does the node have wrapping elements around it
		isWrapped = node.isWrapped();
		// Is there an unwrapped node right before this node?
		isPrevUnwrapped = prevNode ? !prevNode.isWrapped() : false;
		// Is there an unwrapped node right after this node?
		isNextUnwrapped = nextNode ? !nextNode.isWrapped() : false;
		// Is this node an empty non-content branch node?
		isEmptyBranch = ( node.getLength() === 0 || node.handlesOwnChildren() ) &&
			!node.isContent() && !node.canContainContent();
		// Is the start between prevNode's closing and node or between the parent's opening and node?
		startBetween = ( isWrapped ? start === left - 1 : start === left ) && !isPrevUnwrapped;
		// Is the end between node and nextNode's opening or between node and the parent's closing?
		endBetween = ( isWrapped ? end === right + 1 : end === right ) && !isNextUnwrapped;
		parentRange = new ve.Range(
			currentFrame.startOffset,
			currentFrame.startOffset + currentFrame.node.getLength()
		);

		if ( isWrapped && end === left - 1 && currentFrame.index === 0 ) {
			// The selection ends here with an empty range at the beginning of the node
			// TODO duplicated code
			isWrapped = currentFrame.node.isWrapped();
			retval.push( {
				node: currentFrame.node,
				indexInNode: 0,
				range: new ve.Range( end, end ),
				nodeRange: parentRange,
				nodeOuterRange: new ve.Range(
					parentRange.start - isWrapped, parentRange.end + isWrapped
				)
			} );
			parentFrame = stack[stack.length - 2];
			if ( parentFrame ) {
				retval[retval.length - 1].index = parentFrame.index;
			}
			return retval;
		}

		if ( start === end && ( startBetween || endBetween ) && isWrapped ) {
			// Empty range in the parent, outside of any child
			isWrapped = currentFrame.node.isWrapped();
			retval = [ {
				node: currentFrame.node,
				indexInNode: currentFrame.index + ( endBetween ? 1 : 0 ),
				range: new ve.Range( start, end ),
				nodeRange: parentRange,
				nodeOuterRange: new ve.Range(
					parentRange.start - isWrapped, parentRange.end + isWrapped
				)
			} ];
			parentFrame = stack[stack.length - 2];
			if ( parentFrame ) {
				retval[0].index = parentFrame.index;
			}
			return retval;
		} else if ( startBetween ) {
			// start is between the previous sibling and node
			// so the selection covers all or part of node

			// Descend if
			// - we are in leaves mode, OR
			// - we are in covered mode and the end is inside node OR
			// - we are in branches mode and node is a branch (can have grandchildren)
			// AND
			// the node is non-empty and doesn't handle its own children
			if ( ( mode === 'leaves' ||
					( mode === 'covered' && endInside ) ||
					( mode === 'branches' && node.canHaveChildrenNotContent() ) ) &&
				node.children && node.children.length && !node.handlesOwnChildren()
			) {
				// Descend into node
				currentFrame = {
					node: node,
					index: 0,
					startOffset: left
				};
				stack.push( currentFrame );
				startFound = true;
				// If the first child of node has an opening, skip over it
				if ( node.children[0].isWrapped() ) {
					left++;
				}
				continue;
			} else if ( !endInside ) {
				// All of node is covered
				retval.push( {
					node: node,
					// no 'range' because the entire node is covered
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} );
				startFound = true;
			} else {
				// Part of node is covered
				return [ {
					node: node,
					range: new ve.Range( start, end ),
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} ];
			}
		} else if ( startInside && endInside ) {
			if ( node.children && node.children.length &&
				( mode !== 'branches' || node.canHaveChildrenNotContent() ) ) {
				// Descend into node
				currentFrame = {
					node: node,
					index: 0,
					startOffset: left
				};
				stack.push( currentFrame );
				// If the first child of node has an opening, skip over it
				if ( node.children[0].isWrapped() ) {
					left++;
				}
				continue;
			} else {
				// node is a leaf node and the range is entirely inside it
				retval = [ {
					node: node,
					range: new ve.Range( start, end ),
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} ];
				if ( isEmptyBranch ) {
					retval[0].indexInNode = 0;
				}
				return retval;
			}
		} else if ( startInside ) {
			if ( ( mode === 'leaves' ||
					mode === 'covered' ||
					( mode === 'branches' && node.canHaveChildrenNotContent() ) ) &&
				node.children && node.children.length
			) {
				// node is a branch node and the start is inside it
				// Descend into it
				currentFrame = {
					node: node,
					index: 0,
					startOffset: left
				};
				stack.push( currentFrame );
				// If the first child of node has an opening, skip over it
				if ( node.children[0].isWrapped() ) {
					left++;
				}
				continue;
			} else {
				// node is a leaf node and the start is inside it
				// Add to retval and keep going
				retval.push( {
					node: node,
					range: new ve.Range( start, right ),
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} );
				startFound = true;
			}
		} else if ( endBetween ) {
			// end is between node and the next sibling
			// start is not inside node, so the selection covers
			// all of node, then ends

			if (
				( mode === 'leaves' || ( mode === 'branches' && node.canHaveChildrenNotContent() ) ) &&
				node.children && node.children.length
			) {
				// Descend into node
				currentFrame = {
					node: node,
					index: 0,
					startOffset: left
				};
				stack.push( currentFrame );
				// If the first child of node has an opening, skip over it
				if ( node.children[0].isWrapped() ) {
					left++;
				}
				continue;
			} else {
				// All of node is covered
				retval.push( {
					node: node,
					// no 'range' because the entire node is covered
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} );
				return retval;
			}
		} else if ( endInside ) {
			if ( ( mode === 'leaves' ||
					mode === 'covered' ||
					( mode === 'branches' && node.canHaveChildrenNotContent() ) ) &&
				node.children && node.children.length
			) {
				// node is a branch node and the end is inside it
				// Descend into it
				currentFrame = {
					node: node,
					index: 0,
					startOffset: left
				};
				stack.push( currentFrame );
				// If the first child of node has an opening, skip over it
				if ( node.children[0].isWrapped() ) {
					left++;
				}
				continue;
			} else {
				// node is a leaf node and the end is inside it
				// Add to retval and return
				retval.push( {
					node: node,
					range: new ve.Range( left, end ),
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} );
				return retval;
			}
		} else if ( startFound && end > right ) {
			// Neither the start nor the end is inside node, but we found the start earlier,
			// so node must be between the start and the end
			// Add the entire node, so no range property

			if (
				( mode === 'leaves' || ( mode === 'branches' && node.canHaveChildrenNotContent() ) ) &&
				node.children && node.children.length
			) {
				// Descend into node
				currentFrame = {
					node: node,
					index: 0,
					startOffset: left
				};
				stack.push( currentFrame );
				// If the first child of node has an opening, skip over it
				if ( node.children[0].isWrapped() ) {
					left++;
				}
				continue;
			} else {
				// All of node is covered
				retval.push( {
					node: node,
					// no 'range' because the entire node is covered
					index: currentFrame.index,
					nodeRange: new ve.Range( left, right ),
					nodeOuterRange: new ve.Range( left - isWrapped, right + isWrapped ),
					parentOuterRange: new ve.Range(
						parentRange.start - currentFrame.node.isWrapped(),
						parentRange.end + currentFrame.node.isWrapped()
					)
				} );
			}
		}

		// Move to the next node
		if ( nextNode ) {
			// The next node exists
			// Advance the index; the start of the next iteration will essentially
			// do node = nextNode;
			currentFrame.index++;
			// Advance to the first offset inside nextNode
			left = right +
				// Skip over node's closing, if present
				( node.isWrapped() ? 1 : 0 ) +
				// Skip over nextNode's opening, if present
				( nextNode.isWrapped() ? 1 : 0 );
		} else {
			// There is no next node, move up the stack until there is one
			left = right +
				// Skip over node's closing, if present
				( node.isWrapped() ? 1 : 0 );
			while ( !nextNode ) {
				// Check if the start is right past the end of this node, at the end of
				// the parent
				if ( node.isWrapped() && start === left ) {
					// TODO duplicated code
					parentRange = new ve.Range( currentFrame.startOffset,
						currentFrame.startOffset + currentFrame.node.getLength()
					);
					isWrapped = currentFrame.node.isWrapped();
					retval = [ {
						node: currentFrame.node,
						indexInNode: currentFrame.index + 1,
						range: new ve.Range( left, left ),
						nodeRange: parentRange,
						nodeOuterRange: new ve.Range(
							parentRange.start - isWrapped, parentRange.end + isWrapped
						)
					} ];
					parentFrame = stack[stack.length - 2];
					if ( parentFrame ) {
						retval[0].index = parentFrame.index;
					}
				}

				// Move up the stack
				stack.pop();
				if ( stack.length === 0 ) {
					// This shouldn't be possible
					return retval;
				}
				currentFrame = stack[stack.length - 1];
				currentFrame.index++;
				nextNode = currentFrame.node.children[currentFrame.index];
				// Skip over the parent node's closing
				// (this is present for sure, because the parent has children)
				left++;
			}

			// Skip over nextNode's opening if present
			if ( nextNode.isWrapped() ) {
				left++;
			}
		}
	} while ( end >= left - 1 );
	if ( retval.length === 0 ) {
		throw new Error( 'Failed to select any nodes' );
	}
	return retval;
};

/**
 * Get groups of sibling nodes covered by the given range.
 *
 * @param {ve.Range} range Range
 * @returns {Array} Array of objects. Each object has the following keys:
 *
 *  - nodes: Array of sibling nodes covered by a part of range
 *  - parent: Parent of all of these nodes
 *  - grandparent: parent's parent
 */
ve.Document.prototype.getCoveredSiblingGroups = function ( range ) {
	var i, firstCoveredSibling, lastCoveredSibling, node, parentNode, siblingNode,
		leaves = this.selectNodes( range, 'leaves' ),
		groups = [],
		lastEndOffset = 0;
	for ( i = 0; i < leaves.length; i++ ) {
		if ( leaves[i].nodeOuterRange.end <= lastEndOffset ) {
			// This range is contained within a range we've already processed
			continue;
		}
		node = leaves[i].node;
		// Traverse up to a content branch from content elements
		if ( node.isContent() ) {
			node = node.getParent();
		}
		parentNode = node.getParent();
		if ( !parentNode ) {
			break;
		}
		// Group this with its covered siblings
		groups.push( {
			parent: parentNode,
			grandparent: parentNode.getParent(),
			nodes: []
		} );
		firstCoveredSibling = node;
		// Seek forward to the last covered sibling
		siblingNode = firstCoveredSibling;
		do {
			// Add this to its sibling's group
			groups[groups.length - 1].nodes.push( siblingNode );
			lastCoveredSibling = siblingNode;
			i++;
			if ( leaves[i] === undefined ) {
				break;
			}
			// Traverse up to a content branch from content elements
			siblingNode = leaves[i].node;
			if ( siblingNode.isContent() ) {
				siblingNode = siblingNode.getParent();
			}
		} while ( siblingNode.getParent() === parentNode );
		i--;
		lastEndOffset = parentNode.getOuterRange().end;
	}
	return groups;
};

/**
 * Test whether a range lies within a single leaf node.
 *
 * @param {ve.Range} range The range to test
 * @returns {boolean} Whether the range lies within a single node
 */
ve.Document.prototype.rangeInsideOneLeafNode = function ( range ) {
	var selected = this.selectNodes( range, 'leaves' );
	return selected.length === 1 && selected[0].nodeRange.containsRange( range ) && selected[0].indexInNode === undefined;
};

/*!
 * VisualEditor EventSequencer class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * EventSequencer class with on-event and after-event listeners.
 *
 * After-event listeners are fired as soon as possible after the
 * corresponding native event. They are similar to the setTimeout(f, 0)
 * idiom, except that they are guaranteed to execute before any subsequent
 * on-event listener. Therefore, events are executed in the 'right order'.
 *
 * This matters when many events are added to the task queue in one go.
 * For instance, browsers often queue 'keydown' and 'keypress' in immediate
 * sequence, so a setTimeout(f, 0) defined in the keydown listener will run
 * *after* the keypress listener (i.e. in the 'wrong' order). EventSequencer
 * ensures that this does not happen.
 *
 * All these listeners receive the jQuery event as an argument. If an on-event
 * listener needs to pass information to a corresponding after-event listener,
 * it can do so by adding properties into the jQuery event itself.
 *
 * There are also 'onLoop' and 'afterLoop' listeners, which only fire once per
 * Javascript event loop iteration, respectively before and after all the
 * other listeners fire.
 *
 * There is special handling for sequences (keydown,keypress), where the
 * keypress handler is called before the native keydown action happens. In
 * this case, after-keydown handlers fire after on-keypress handlers.
 *
 * For further event loop / task queue information, see:
 * http://www.whatwg.org/specs/web-apps/current-work/multipage/webappapis.html#event-loops
 *
 * @class ve.EventSequencer
 */

/**
 *
 * To fire after-event listeners promptly, the EventSequencer may need to
 * listen to some events for which it has no registered on-event or
 * after-event listeners. For instance, to ensure an after-keydown listener
 * is be fired before the native keyup action, you must include both
 * 'keydown' and 'keyup' in the eventNames Array.
 *
 * @constructor
 * @param {string[]} eventNames List of event Names to listen to
 */
ve.EventSequencer = function VeEventSequencer( eventNames ) {
	var i, len, eventName, eventSequencer = this;
	this.$node = null;
	this.eventNames = eventNames;
	this.eventHandlers = {};

	/**
	 * Generate an event handler for a specific event
	 *
	 * @private
	 * @param {string} eventName The event's name
	 * @returns {Function} An event handler
	 */
	function makeEventHandler( eventName ) {
		return function ( ev ) {
			return eventSequencer.onEvent( eventName, ev );
		};
	}

	/**
	 * @property {Object[]}
	 *  - id {number} Id for setTimeout
	 *  - func {Function} Post-event listener
	 *  - ev {jQuery.Event} Browser event
	 *  - eventName {string} Name, such as keydown
	 */
	this.pendingCalls = [];

	/**
	 * @property {Object.<string,Function[]>}
	 */
	this.onListenersForEvent = {};

	/**
	 * @property {Object.<string,Function[]>}
	 */
	this.afterListenersForEvent = {};

	/**
	 * @property {Object.<string,Function[]>}
	 */
	this.afterOneListenersForEvent = {};

	for ( i = 0, len = eventNames.length; i < len; i++ ) {
		eventName = eventNames[i];
		this.onListenersForEvent[eventName] = [];
		this.afterListenersForEvent[eventName] = [];
		this.afterOneListenersForEvent[eventName] = [];
		this.eventHandlers[eventName] = makeEventHandler( eventName );
	}

	/**
	 * @property {Function[]}
	 */
	this.onLoopListeners = [];

	/**
	 * @property {Function[]}
	 */
	this.afterLoopListeners = [];

	/**
	 * @property {Function[]}
	 */
	this.afterLoopOneListeners = [];

	/**
	 * @property {boolean}
	 */
	this.doneOnLoop = false;

	/**
	 * @property {number}
	 */
	this.afterLoopTimeoutId = null;
};

/**
 * Attach to a node, to listen to its jQuery events
 *
 * @method
 * @param {jQuery} $node The node to attach to
 * @chainable
 */
ve.EventSequencer.prototype.attach = function ( $node ) {
	this.detach();
	this.$node = $node.on( this.eventHandlers );
	return this;
};

/**
 * Detach from a node (if attached), to stop listen to its jQuery events
 *
 * @method
 * @chainable
 */
ve.EventSequencer.prototype.detach = function () {
	if ( this.$node === null ) {
		return;
	}
	this.runPendingCalls();
	this.$node.off( this.eventHandlers );
	this.$node = null;
	return this;
};

/**
 * Add listeners to be fired at the start of the Javascript event loop iteration
 * @method
 * @param {Function[]} listeners Listeners that take no arguments
 * @chainable
 */
ve.EventSequencer.prototype.onLoop = function ( listeners ) {
	ve.batchPush( this.onLoopListeners, listeners );
	return this;
};

/**
 * Add listeners to be fired just before the browser native action
 * @method
 * @param {Object.<string,Function>} listeners Function for each event
 * @chainable
 */
ve.EventSequencer.prototype.on = function ( listeners ) {
	var eventName;
	for ( eventName in listeners ) {
		this.onListenersForEvent[eventName].push( listeners[eventName] );
	}
	return this;
};

/**
 * Add listeners to be fired as soon as possible after the native action
 * @method
 * @param {Object.<string,Function>} listeners Function for each event
 * @chainable
 */
ve.EventSequencer.prototype.after = function ( listeners ) {
	var eventName;
	for ( eventName in listeners ) {
		this.afterListenersForEvent[eventName].push( listeners[eventName] );
	}
	return this;
};

/**
 * Add listeners to be fired once, as soon as possible after the native action
 * @method
 * @param {Object.<string,Function[]>} listeners Function for each event
 * @chainable
 */
ve.EventSequencer.prototype.afterOne = function ( listeners ) {
	var eventName;
	for ( eventName in listeners ) {
		this.afterOneListenersForEvent[eventName].push( listeners[eventName] );
	}
	return this;
};

/**
 * Add listeners to be fired at the end of the Javascript event loop iteration
 * @method
 * @param {Function|Function[]} listeners Listener(s) that take no arguments
 * @chainable
 */
ve.EventSequencer.prototype.afterLoop = function ( listeners ) {
	if ( !Array.isArray( listeners ) ) {
		listeners = [listeners];
	}
	ve.batchPush( this.afterLoopListeners, listeners );
	return this;
};

/**
 * Add listeners to be fired once, at the end of the Javascript event loop iteration
 * @method
 * @param {Function|Function[]} listeners Listener(s) that take no arguments
 * @chainable
 */
ve.EventSequencer.prototype.afterLoopOne = function ( listeners ) {
	if ( !Array.isArray( listeners ) ) {
		listeners = [listeners];
	}
	ve.batchPush( this.afterLoopOneListeners, listeners );
	return this;
};

/**
 * Generic listener method which does the sequencing
 * @private
 * @method
 * @param {string} eventName Javascript name of the event, e.g. 'keydown'
 * @param {jQuery.Event} ev The browser event
 */
ve.EventSequencer.prototype.onEvent = function ( eventName, ev ) {
	var i, len, onListener, onListeners, pendingCall, eventSequencer, id;
	this.runPendingCalls( eventName );
	if ( !this.doneOnLoop ) {
		this.doneOnLoop = true;
		this.doOnLoop();
	}

	onListeners = this.onListenersForEvent[ eventName ] || [];

	// Length cache 'len' is required, as an onListener could add another onListener
	for ( i = 0, len = onListeners.length; i < len; i++ ) {
		onListener = onListeners[i];
		this.callListener( 'on', eventName, i, onListener, ev );
	}
	// Create a cancellable pending call. We need one even if there are no after*Listeners, to
	// call resetAfterLoopTimeout which resets doneOneLoop to false.
	// - Create the pendingCall object first
	// - then create the setTimeout invocation to modify pendingCall.id
	// - then set pendingCall.id to the setTimeout id, so the call can cancel itself
	pendingCall = { id: null, ev: ev, eventName: eventName };
	eventSequencer = this;
	id = this.postpone( function () {
		if ( pendingCall.id === null ) {
			// clearTimeout seems not always to work immediately
			return;
		}
		eventSequencer.resetAfterLoopTimeout();
		pendingCall.id = null;
		eventSequencer.afterEvent( eventName, ev );
	} );
	pendingCall.id = id;
	this.pendingCalls.push( pendingCall );
};

/**
 * Generic after listener method which gets queued
 * @private
 * @method
 * @param {string} eventName Javascript name of the event, e.g. 'keydown'
 * @param {jQuery.Event} ev The browser event
 */
ve.EventSequencer.prototype.afterEvent = function ( eventName, ev ) {
	var i, len, afterListeners, afterOneListeners;

	// Snapshot the listener lists, and blank *OneListener list.
	// This ensures reasonable behaviour if a function called adds another listener.
	afterListeners = ( this.afterListenersForEvent[eventName] || [] ).slice();
	afterOneListeners = ( this.afterOneListenersForEvent[eventName] || [] ).slice();
	( this.afterOneListenersForEvent[eventName] || [] ).length = 0;

	for ( i = 0, len = afterListeners.length; i < len; i++ ) {
		this.callListener( 'after', eventName, i, afterListeners[i], ev );
	}

	for ( i = 0, len = afterOneListeners.length; i < len; i++ ) {
		this.callListener( 'afterOne', eventName, i, afterOneListeners[i], ev );
	}
};

/**
 * Call each onLoopListener once
 * @private
 * @method
 */
ve.EventSequencer.prototype.doOnLoop = function () {
	var i, len;
	// Length cache 'len' is required, as the functions called may add another listener
	for ( i = 0, len = this.onLoopListeners.length; i < len; i++ ) {
		this.callListener( 'onLoop', null, i, this.onLoopListeners[i], null );
	}
};

/**
 * Call each afterLoopListener once, unless the setTimeout is already cancelled
 * @private
 * @method
 * @param {number} myTimeoutId The calling setTimeout id
 */
ve.EventSequencer.prototype.doAfterLoop = function ( myTimeoutId ) {
	var i, len, afterLoopListeners, afterLoopOneListeners;

	if ( this.afterLoopTimeoutId !== myTimeoutId ) {
		// cancelled; do nothing
		return;
	}
	this.afterLoopTimeoutId = null;

	// Snapshot the listener lists, and blank *OneListener list.
	// This ensures reasonable behaviour if a function called adds another listener.
	afterLoopListeners = this.afterLoopListeners.slice();
	afterLoopOneListeners = this.afterLoopOneListeners.slice();
	this.afterLoopOneListeners.length = 0;

	for ( i = 0, len = this.afterLoopListeners.length; i < len; i++ ) {
		this.callListener( 'afterLoop', null, i, this.afterLoopListeners[i], null );
	}

	for ( i = 0, len = this.afterLoopOneListeners.length; i < len; i++ ) {
		this.callListener( 'afterLoopOne', null, i, this.afterLoopOneListeners[i], null );
	}
};

/**
 * Push any pending doAfterLoop to end of task queue (cancel, then re-set)
 * @private
 * @method
 */
ve.EventSequencer.prototype.resetAfterLoopTimeout = function () {
	var timeoutId, eventSequencer = this;
	if ( this.afterLoopTimeoutId !== null ) {
		this.cancelPostponed( this.afterLoopTimeoutId );
	}
	timeoutId = this.postpone( function () {
		eventSequencer.doAfterLoop( timeoutId );
	} );
	this.afterLoopTimeoutId = timeoutId;
};

/**
 * Run any pending listeners, and clear the pending queue
 * @private
 * @method
 * @param {string} eventName The name of the event currently being triggered
 */
ve.EventSequencer.prototype.runPendingCalls = function ( eventName ) {
	var i, pendingCall,
	afterKeyDownCalls = [];
	for ( i = 0; i < this.pendingCalls.length; i++ ) {
		// Length cache not possible, as a pending call appends another pending call.
		// It's important that this list remains mutable, in the case that this
		// function indirectly recurses.
		pendingCall = this.pendingCalls[i];
		if ( pendingCall.id === null ) {
			// the call has already run
			continue;
		}
		if ( eventName === 'keypress' && pendingCall.eventName === 'keydown' ) {
			// Delay afterKeyDown till after keypress
			afterKeyDownCalls.push( pendingCall );
			continue;
		}

		this.cancelPostponed( pendingCall.id );
		pendingCall.id = null;
		// Force to run now. It's important that we set id to null before running,
		// so that there's no chance a recursive call will call the listener again.
		this.afterEvent( pendingCall.eventName, pendingCall.ev );
	}
	// This is safe: we only ever appended to the list, so it's definitely exhausted now.
	this.pendingCalls.length = 0;
	this.pendingCalls.push.apply( this.pendingCalls, afterKeyDownCalls );
};

/**
 * Make a postponed call.
 *
 * This is a separate function because that makes it easier to replace when testing
 *
 * @param {Function} callback The function to call
 * @returns {number} Unique postponed timeout id
 */
ve.EventSequencer.prototype.postpone = function ( callback ) {
	return setTimeout( callback );
};

/**
 * Cancel a postponed call.
 *
 * This is a separate function because that makes it easier to replace when testing
 *
 * @param {number} callId Unique postponed timeout id
 */
ve.EventSequencer.prototype.cancelPostponed = function ( timeoutId ) {
	clearTimeout( timeoutId );
};

/*
 * Single method to perform all listener calls, for ease of debugging
 * @param {string} timing on|after|afterOne|onLoop|afterLoop|afterLoopOne
 * @param {string} eventName Name of the event
 * @param {number} i The sequence of the listener
 * @param {Function} listener The listener to call
 * @param {jQuery.Event} ev The browser event
 */
ve.EventSequencer.prototype.callListener = function ( timing, eventName, i, listener, ev ) {
	listener( ev );
};

/*!
 * VisualEditor stand-alone Initialization namespace.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Namespace for all VisualEditor stand-alone Initialization classes, static methods and static
 * properties.
 * @class
 * @singleton
 */
ve.init.sa = {
};

/*!
 * VisualEditor Standalone Initialization Platform class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Initialization Standalone platform.
 *
 * @class
 * @extends ve.init.Platform
 *
 * @constructor
 */
ve.init.sa.Platform = function VeInitSaPlatform() {
	// Parent constructor
	ve.init.Platform.call( this );

	// Properties
	this.externalLinkUrlProtocolsRegExp = /^https?\:\/\//;
	this.messagePaths = [];
	this.parsedMessages = {};
	this.userLanguages = ['en'];
};

/* Inheritance */

OO.inheritClass( ve.init.sa.Platform, ve.init.Platform );

/* Methods */

/** @inheritdoc */
ve.init.sa.Platform.prototype.getExternalLinkUrlProtocolsRegExp = function () {
	return this.externalLinkUrlProtocolsRegExp;
};

/**
 * Add an i18n message folder path
 *
 * @param {string} path Message folder path
 */
ve.init.sa.Platform.prototype.addMessagePath = function ( path ) {
	this.messagePaths.push( path );
};

/**
 * Get message folder paths
 *
 * @returns {string[]} Message folder paths
 */
ve.init.sa.Platform.prototype.getMessagePaths = function () {
	return this.messagePaths;
};

/** @inheritdoc */
ve.init.sa.Platform.prototype.addMessages = function ( messages ) {
	$.i18n().load( messages, $.i18n().locale );
};

/**
 * @method
 * @inheritdoc
 */
ve.init.sa.Platform.prototype.getMessage = $.i18n;

/** @inheritdoc */
ve.init.sa.Platform.prototype.addParsedMessages = function ( messages ) {
	for ( var key in messages ) {
		this.parsedMessages[key] = messages[key];
	}
};

/** @inheritdoc */
ve.init.sa.Platform.prototype.getParsedMessage = function ( key ) {
	if ( Object.prototype.hasOwnProperty.call( this.parsedMessages, key ) ) {
		return this.parsedMessages[key];
	}
	// Fallback to regular messages, html escaping applied.
	return this.getMessage( key ).replace( /['"<>&]/g, function escapeCallback( s ) {
		switch ( s ) {
			case '\'':
				return '&#039;';
			case '"':
				return '&quot;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
		}
	} );
};

/** @inheritdoc */
ve.init.sa.Platform.prototype.getLanguageCodes = function () {
	return Object.keys( $.uls.data.getAutonyms() );
};

/**
 * @method
 * @inheritdoc
 */
ve.init.sa.Platform.prototype.getLanguageName = $.uls.data.getAutonym;

/**
 * @method
 * @inheritdoc
 */
ve.init.sa.Platform.prototype.getLanguageAutonym = $.uls.data.getAutonym;

/**
 * @method
 * @inheritdoc
 */
ve.init.sa.Platform.prototype.getLanguageDirection = $.uls.data.getDir;

/** @inheritdoc */
ve.init.sa.Platform.prototype.getUserLanguages = function () {
	return this.userLanguages;
};

/** @inheritdoc */
ve.init.sa.Platform.prototype.initialize = function () {
	var i, iLen, j, jLen, partialLocale, localeParts, filename, deferred,
		messagePaths = this.getMessagePaths(),
		locale = $.i18n().locale,
		languages = [ locale, 'en' ], // Always use 'en' as the final fallback
		languagesCovered = {},
		promises = [],
		fallbacks = $.i18n.fallbacks[locale];

	if ( !fallbacks ) {
		// Try to find something that has fallbacks (which means it's a language we know about)
		// by stripping things from the end. But collect all the intermediate ones in case we
		// go past languages that don't have fallbacks but do exist.
		localeParts = locale.split( '-' );
		localeParts.pop();
		while ( localeParts.length && !fallbacks ) {
			partialLocale = localeParts.join( '-' );
			languages.push( partialLocale );
			fallbacks = $.i18n.fallbacks[partialLocale];
			localeParts.pop();
		}
	}

	if ( fallbacks ) {
		languages = languages.concat( fallbacks );
	}

	this.userLanguages = languages;

	for ( i = 0, iLen = languages.length; i < iLen; i++ ) {
		if ( languagesCovered[languages[i]] ) {
			continue;
		}
		languagesCovered[languages[i]] = true;

		// Lower-case the language code for the filename. jQuery.i18n does not case-fold
		// language codes, so we should not case-fold the second argument in #load.
		filename = languages[i].toLowerCase() + '.json';

		for ( j = 0, jLen = messagePaths.length; j < jLen; j++ ) {
			deferred = $.Deferred();
			$.i18n().load( messagePaths[j] + filename, languages[i] )
				.always( deferred.resolve );
			promises.push( deferred.promise() );
		}
	}
	return $.when.apply( $, promises );
};

/* Initialization */

ve.init.platform = new ve.init.sa.Platform();

/* Extension */

OO.ui.getUserLanguages = ve.init.platform.getUserLanguages.bind( ve.init.platform );

OO.ui.msg = ve.init.platform.getMessage.bind( ve.init.platform );

/*!
 * VisualEditor Standalone Initialization Target class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Initialization Standalone target.
 *
 * @class
 * @extends ve.init.Target
 *
 * @constructor
 * @param {string} [surfaceType] Type of surface to use, 'desktop' or 'mobile'
 * @throws {Error} Unknown surfaceType
 */
ve.init.sa.Target = function VeInitSaTarget( surfaceType ) {
	// Parent constructor
	ve.init.Target.call( this, { shadow: true, actions: true, floatable: true } );

	this.surfaceType = surfaceType || this.constructor.static.defaultSurfaceType;
	this.actions = null;

	switch ( this.surfaceType ) {
		case 'desktop':
			this.surfaceClass = ve.ui.DesktopSurface;
			break;
		case 'mobile':
			this.surfaceClass = ve.ui.MobileSurface;
			break;
		default:
			throw new Error( 'Unknown surfaceType: ' + this.surfaceType );
	}

	// The following classes can be used here:
	// ve-init-sa-target-mobile
	// ve-init-sa-target-desktop
	this.$element.addClass( 've-init-sa-target ve-init-sa-target-' + this.surfaceType );
};

/* Inheritance */

OO.inheritClass( ve.init.sa.Target, ve.init.Target );

/* Static properties */

ve.init.sa.Target.static.defaultSurfaceType = 'desktop';

/* Methods */

/**
 * @inheritdoc
 */
ve.init.sa.Target.prototype.addSurface = function () {
	var surface = ve.init.sa.Target.super.prototype.addSurface.apply( this, arguments );
	this.$element.append( $( '<div>' ).append( surface.$element ) );
	if ( !this.getSurface() ) {
		this.setSurface( surface );
	}
	surface.initialize();
	return surface;
};

/**
 * @inheritdoc
 */
ve.init.sa.Target.prototype.createSurface = function ( dmDoc, config ) {
	config = ve.extendObject( {
		excludeCommands: OO.simpleArrayUnion(
			this.constructor.static.excludeCommands,
			this.constructor.static.documentCommands,
			this.constructor.static.targetCommands
		),
		importRules: this.constructor.static.importRules
	}, config );
	return new this.surfaceClass( dmDoc, config );
};

/**
 * @inheritdoc
 */
ve.init.sa.Target.prototype.setupToolbar = function ( surface ) {
	// Parent method
	ve.init.sa.Target.super.prototype.setupToolbar.call( this, surface );

	if ( !this.getToolbar().initialized ) {
		this.getToolbar().$element.addClass( 've-init-sa-target-toolbar' );
		this.actions = new ve.ui.TargetToolbar( this );
		this.getToolbar().$actions.append( this.actions.$element );
	}
	this.getToolbar().initialize();

	this.actions.setup( [
		{
			type: 'list',
			icon: 'menu',
			title: ve.msg( 'visualeditor-pagemenu-tooltip' ),
			include: [ 'findAndReplace', 'commandHelp' ]
		}
	], this.getSurface() );

	// HACK: On mobile place the context inside toolbar.$bar which floats
	if ( this.surfaceType === 'mobile' ) {
		this.getToolbar().$bar.append( surface.context.$element );
	}
};
