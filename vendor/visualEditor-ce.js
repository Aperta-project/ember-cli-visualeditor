/*!
 * VisualEditor ContentEditable namespace.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Namespace for all VisualEditor ContentEditable classes, static methods and static properties.
 * @class
 * @singleton
 */
ve.ce = {
	// nodeFactory: Initialized in ve.ce.NodeFactory.js
};

/* Static Properties */

/**
 * RegExp pattern for matching all whitespaces in HTML text.
 *
 * \u0020 (32) space
 * \u00A0 (160) non-breaking space
 *
 * @property
 */
ve.ce.whitespacePattern = /[\u0020\u00A0]/g;

/**
 * Data URI for minimal GIF image.
 */
ve.ce.minImgDataUri = 'data:image/gif;base64,R0lGODdhAQABAADcACwAAAAAAQABAAA';
ve.ce.unicornImgDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAATCAQAAADly58hAAAAAmJLR0QAAKqNIzIAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfeChIMMi319aEqAAAAzUlEQVQoz4XSMUoDURAG4K8NIljaeQZrCwsRb5FWL5Daa1iIjQewTycphAQloBEUAoogFmqMsiBmHSzcdfOWlcyU3/+YGXgsqJZMbvv/wLqZDCw1B9rCBSaOmgOHQsfQvVYT7wszIbPSxO9CCF8ebNXx1J2TIvDoxlrKU3mBIYz1U87mMISB3QqXk7e/A4bp1WV/CiE3sFHymZ4X4cO57yLWdVDyjoknr47/MPRcput1k+ljt/O4V1vu2bXViq9qPNW3WfGoxrk37UVfxQ999n1bP+Vh5gAAAABJRU5ErkJggg==';
ve.ce.chimeraImgDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAYAAAByUDbMAAAABGdBTUEAALGPC/xhBQAAAThJREFUOMvF088rRFEYxvGpKdnwJ8iStVnMytZ2ipJmI6xmZKEUe5aUULMzCxtlSkzNjCh2lClFSUpDmYj8KBZq6vreetLbrXs5Rjn1aWbuuee575z7nljsH8YkepoNaccsHrGFgWbCWpHCLZb+oroFzKOEbpeFHVp8gitsYltzSRyiqrkKhsKCevGMfWQwor/2ghns4BQTGMMcnlBA3Aa14U5VLeMDnqrq1/cDpHGv35eqrI5pG+Y/qYYp3WiN6zOHs8DcA7IK/BqLWMOuY5inQjwbNqheGnYMO9d+XtiwFu1BQU/y96ooKRO2Yq6vqog3jAbfZgKvuDELfGWFXQeu76GB9bD26MQRNnSMotTVJvGoxs2rx2oR/B47Rtd3pyBv3lCYnEtYWo0Yps8l7F3HKErjJ2G/Hp/F9YtlR3MQiAAAAABJRU5ErkJggg==';

/* Static Methods */

/**
 * Gets the plain text of a DOM element (that is a node canContainContent === true)
 *
 * In the returned string only the contents of text nodes are included, and the contents of
 * non-editable elements are excluded (but replaced with the appropriate number of snowman
 * characters so the offsets match up with the linear model).
 *
 * @method
 * @param {HTMLElement} element DOM element to get text of
 * @returns {string} Plain text of DOM element
 */
ve.ce.getDomText = function ( element ) {
	// Inspired by jQuery.text / Sizzle.getText
	var func = function ( element ) {
		var viewNode,
			nodeType = element.nodeType,
			$element = $( element ),
			text = '';

		if (
			nodeType === Node.ELEMENT_NODE ||
			nodeType === Node.DOCUMENT_NODE ||
			nodeType === Node.DOCUMENT_FRAGMENT_NODE
		) {
			if ( $element.hasClass( 've-ce-branchNode-blockSlugWrapper' ) ) {
				// Block slugs are not represented in the model at all, but they do
				// contain a single nbsp/FEFF character in the DOM, so make sure
				// that character isn't counted
				return '';
			} else if ( $element.hasClass( 've-ce-leafNode' ) ) {
				// For leaf nodes, don't return the content, but return
				// the right number of placeholder characters so the offsets match up.
				viewNode = $element.data( 'view' );
				// Only return snowmen for the first element in a sibling group: otherwise
				// we'll double-count this node
				if ( viewNode && element === viewNode.$element[0] ) {
					// \u2603 is the snowman character: ☃
					return new Array( viewNode.getOuterLength() + 1 ).join( '\u2603' );
				}
				// Second or subsequent sibling, don't double-count
				return '';
			} else {
				// Traverse its children
				for ( element = element.firstChild; element; element = element.nextSibling ) {
					text += func( element );
				}
			}
		} else if ( nodeType === Node.TEXT_NODE ) {
			return element.data;
		}
		return text;
	};
	// Return the text, replacing spaces and non-breaking spaces with spaces?
	// TODO: Why are we replacing spaces (\u0020) with spaces (' ')
	return func( element ).replace( ve.ce.whitespacePattern, ' ' );
};

/**
 * Gets a hash of a DOM element's structure.
 *
 * In the returned string text nodes are represented as "#" and elements are represented as "<type>"
 * and "</type>" where "type" is their element name. This effectively generates an HTML
 * serialization without any attributes or text contents. This can be used to observe structural
 * changes.
 *
 * @method
 * @param {HTMLElement} element DOM element to get hash of
 * @returns {string} Hash of DOM element
 */
ve.ce.getDomHash = function ( element ) {
	var nodeType = element.nodeType,
		nodeName = element.nodeName,
		hash = '';

	if ( nodeType === Node.TEXT_NODE || nodeType === Node.CDATA_SECTION_NODE ) {
		return '#';
	} else if ( nodeType === Node.ELEMENT_NODE || nodeType === Node.DOCUMENT_NODE ) {
		hash += '<' + nodeName + '>';
		if ( !$( element ).hasClass( 've-ce-branchNode-blockSlugWrapper' ) ) {
			// Traverse its children
			for ( element = element.firstChild; element; element = element.nextSibling ) {
				hash += ve.ce.getDomHash( element );
			}
		}
		hash += '</' + nodeName + '>';
		// Merge adjacent text node representations
		hash = hash.replace( /##+/g, '#' );
	}
	return hash;
};

/**
 * Get the first cursor offset immediately after a node.
 *
 * @param {Node} node DOM node
 * @returns {Object}
 * @returns {Node} return.node
 * @returns {number} return.offset
 */
ve.ce.nextCursorOffset = function ( node ) {
	var nextNode, offset;
	if ( node.nextSibling !== null && node.nextSibling.nodeType === Node.TEXT_NODE ) {
		nextNode = node.nextSibling;
		offset = 0;
	} else {
		nextNode = node.parentNode;
		offset = 1 + Array.prototype.indexOf.call( node.parentNode.childNodes, node );
	}
	return { node: nextNode, offset: offset };
};

/**
 * Get the first cursor offset immediately before a node.
 *
 * @param {Node} node DOM node
 * @returns {Object}
 * @returns {Node} return.node
 * @returns {number} return.offset
 */
ve.ce.previousCursorOffset = function ( node ) {
	var previousNode, offset;
	if ( node.previousSibling !== null && node.previousSibling.nodeType === Node.TEXT_NODE ) {
		previousNode = node.previousSibling;
		offset = previousNode.data.length;
	} else {
		previousNode = node.parentNode;
		offset = Array.prototype.indexOf.call( node.parentNode.childNodes, node );
	}
	return { node: previousNode, offset: offset };
};

/**
 * Gets the linear offset from a given DOM node and offset within it.
 *
 * @method
 * @param {HTMLElement} domNode DOM node
 * @param {number} domOffset DOM offset within the DOM node
 * @returns {number} Linear model offset
 * @throws {Error} domOffset is out of bounds
 * @throws {Error} domNode has no ancestor with a .data( 'view' )
 * @throws {Error} domNode is not in document
 */
ve.ce.getOffset = function ( domNode, domOffset ) {
	var node, view, offset, startNode, maxOffset, lengthSum = 0,
		$domNode = $( domNode );

	if ( $domNode.hasClass( 've-ce-unicorn' ) ) {
		if ( domOffset !== 0 ) {
			throw new Error( 'Non-zero offset in unicorn' );
		}
		return $domNode.data( 'dmOffset' );
	}

	/**
	 * Move to the previous "traversal node" in "traversal sequence".
	 *
	 * - A node is a "traversal node" if it is either a leaf node or a "view node"
	 * - A "view node" is one that has $( n ).data( 'view' ) instanceof ve.ce.Node
	 * - "Traversal sequence" is defined on every node (not just traversal nodes).
	 *   It is like document order, except that each parent node appears
	 *   in the sequence both immediately before and immediately after its child nodes.
	 *
	 * Important properties:
	 * - Non-traversal nodes don't have any width in DM (e.g. bold).
	 * - Certain traversal nodes also have no width (namely, those within an alienated node).
	 * - Both the start and end of a (non-alienated) parent traversal node has width
	 *   (which is one reason why traversal sequence is important).
	 * - In VE-normalized HTML, a text node cannot be a sibling of a non-leaf view node
	 *   (because all non-alienated text nodes are inside a ContentBranchNode).
	 * - Traversal-consecutive non-view nodes are either all alienated or all not alienated.
	 *
	 * @param {Node} n Node to traverse from
	 * @returns {Node} Previous traversal node from n
	 * @throws {Error} domNode has no ancestor with a .data( 'view' )
	 */
	function traverse( n ) {
		while ( !n.previousSibling ) {
			n = n.parentNode;
			if ( !n ) {
				throw new Error( 'domNode has no ancestor with a .data( \'view\' )' );
			}
			if ( $( n ).data( 'view' ) instanceof ve.ce.Node ) {
				return n;
			}
		}
		n = n.previousSibling;
		if ( $( n ).data( 'view' ) instanceof ve.ce.Node ) {
			return n;
		}
		while ( n.lastChild ) {
			n = n.lastChild;
			if ( $( n ).data( 'view' ) instanceof ve.ce.Node ) {
				return n;
			}
		}
		return n;
	}

	// Validate domOffset
	if ( domNode.nodeType === Node.ELEMENT_NODE ) {
		maxOffset = domNode.childNodes.length;
	} else {
		maxOffset = domNode.data.length;
	}
	if ( domOffset < 0 || domOffset > maxOffset) {
		throw new Error( 'domOffset is out of bounds' );
	}

	// Figure out what node to start traversing at (startNode)
	if ( domNode.nodeType === Node.ELEMENT_NODE ) {
		if ( domNode.childNodes.length === 0 ) {
			// domNode has no children, and the offset is inside of it
			// If domNode is a view node, return the offset inside of it
			// Otherwise, start traversing at domNode
			startNode = domNode;
			view = $( startNode ).data( 'view' );
			if ( view instanceof ve.ce.Node ) {
				return view.getOffset() + ( view.isWrapped() ? 1 : 0 );
			}
			node = startNode;
		} else if ( domOffset === domNode.childNodes.length ) {
			// Offset is at the end of domNode, after the last child. Set startNode to the
			// very rightmost descendant node of domNode (i.e. the last child of the last child
			// of the last child, etc.)
			// However, if the last child or any of the last children we encounter on the way
			// is a view node, return the offset after it. This will be the correct return value
			// because non-traversal nodes don't have a DM width.
			startNode = domNode.lastChild;

			view = $( startNode ).data( 'view' );
			if ( view instanceof ve.ce.Node ) {
				return view.getOffset() + view.getOuterLength();
			}
			while ( startNode.lastChild ) {
				startNode = startNode.lastChild;
				view = $( startNode ).data( 'view' );
				if ( view instanceof ve.ce.Node ) {
					return view.getOffset() + view.getOuterLength();
				}
			}
			node = startNode;
		} else {
			// Offset is right before childNodes[domOffset]. Set startNode to this node
			// (i.e. the node right after the offset), then traverse back once.
			startNode = domNode.childNodes[domOffset];
			node = traverse( startNode );
		}
	} else {
		// Text inside of a block slug doesn't count
		if ( !$( domNode.parentNode ).hasClass( 've-ce-branchNode-blockSlug' ) ) {
			lengthSum += domOffset;
		}
		startNode = domNode;
		node = traverse( startNode );
	}

	// Walk the traversal nodes in reverse traversal sequence, until we find a view node.
	// Add the width of each text node we meet. (Non-text node non-view nodes can only be widthless).
	// Later, if it transpires that we're inside an alienated node, then we will throw away all the
	// text node lengths, because the alien's content has no DM width.
	while ( true ) {
		// First node that has a ve.ce.Node, stop
		// Note that annotations have a .data( 'view' ) too, but that's a ve.ce.Annotation,
		// not a ve.ce.Node
		view = $( node ).data( 'view' );
		if ( view instanceof ve.ce.Node ) {
			break;
		}

		// Text inside of a block slug doesn't count
		if ( node.nodeType === Node.TEXT_NODE && !$( node.parentNode ).hasClass( 've-ce-branchNode-blockSlug' ) ) {
			lengthSum += node.data.length;
		}
		// else: non-text nodes that don't have a .data( 'view' ) don't exist in the DM
		node = traverse( node );
	}

	offset = view.getOffset();

	if ( $.contains( node, startNode ) ) {
		// node is an ancestor of startNode
		if ( !view.getModel().isContent() ) {
			// Add 1 to take the opening into account
			offset += view.getModel().isWrapped() ? 1 : 0;
		}
		if ( view.getModel().canContainContent() ) {
			offset += lengthSum;
		}
		// else: we're inside an alienated node: throw away all the text node lengths,
		// because the alien's content has no DM width
	} else if ( view.parent ) {
		// node is not an ancestor of startNode
		// startNode comes after node, so add node's length
		offset += view.getOuterLength();
		if ( view.isContent() ) {
			// view is a leaf node inside of a CBN, so we started inside of a CBN
			// (otherwise we would have hit the CBN when entering it), so the text we summed up
			// needs to be counted.
			offset += lengthSum;
		}
	} else {
		throw new Error( 'Node is not in document' );
	}

	return offset;
};

/**
 * Gets the linear offset of a given slug
 *
 * @method
 * @param {jQuery} $node jQuery slug selection
 * @returns {number} Linear model offset
 * @throws {Error}
 */
ve.ce.getOffsetOfSlug = function ( $node ) {
	var model;
	if ( $node.index() === 0 ) {
		model = $node.parent().data( 'view' ).getModel();
		return model.getOffset() + ( model.isWrapped() ? 1 : 0 );
	} else if ( $node.prev().length ) {
		model = $node.prev().data( 'view' ).getModel();
		return model.getOffset() + model.getOuterLength();
	} else {
		throw new Error( 'Incorrect slug location' );
	}
};

/**
 * Check if keyboard shortcut modifier key is pressed.
 *
 * @method
 * @param {jQuery.Event} e Key press event
 * @returns {boolean} Modifier key is pressed
 */
ve.ce.isShortcutKey = function ( e ) {
	return !!( e.ctrlKey || e.metaKey );
};

/**
 * Find the DM range of a DOM selection
 *
 * @param {Object} selection DOM-selection-like object
 * @param {Node} selection.anchorNode
 * @param {number} selection.anchorOffset
 * @param {Node} selection.focusNode
 * @param {number} selection.focusOffset
 * @returns {ve.Range|null} DM range, or null if nothing in the CE document is selected
 */
ve.ce.veRangeFromSelection = function ( selection ) {
	try {
		return new ve.Range(
			ve.ce.getOffset( selection.anchorNode, selection.anchorOffset ),
			ve.ce.getOffset( selection.focusNode, selection.focusOffset )
		);
	} catch ( e ) {
		return null;
	}
};

/*!
 * VisualEditor Content Editable Range State class
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable range state (a snapshot of CE selection/content state)
 *
 * @class
 *
 * @constructor
 * @param {ve.ce.RangeState|null} old Previous range state
 * @param {jQuery} $surfaceElement The CE Surface $element
 * @param {ve.ce.DocumentNode} docNode The current document node
 * @param {boolean} selectionOnly The caller promises the content has not changed from old
 */
ve.ce.RangeState = function VeCeRangeState( old, $surfaceElement, docNode, selectionOnly ) {
	/**
	 * @property {boolean} branchNodeChanged Whether the CE branch node changed
	 */
	this.branchNodeChanged = null;

	/**
	 * @property {boolean} selectionChanged Whether the DOM range changed
	 */
	this.selectionChanged = null;

	/**
	 * @property {boolean} contentChanged Whether the content changed
	 */
	this.contentChanged = null;

	/**
	 * @property {boolean} leftBlockSlug Whether the range left a block slug
	 */
	this.leftBlockSlug = null;

	/**
	 * @property {boolean} enteredBlockSlug Whether the range entered a block slug
	 */
	this.enteredBlockSlug = null;

	/**
	 * @property {ve.Range|null} veRange The current selection range
	 */
	this.veRange = null;

	/**
	 * @property {ve.ce.BranchNode|null} node The current branch node
	 */
	this.node = null;

	/**
	 * @property {jQuery|null} $slugWrapper The current slug wrapper
	 */
	this.$slugWrapper = null;

	/**
	 * @property {string} text Plain text of current branch node
	 */
	this.text = null;

	/**
	 * @property {string} DOM Hash of current branch node
	 */
	this.hash = null;

	this.saveState( old, $surfaceElement, docNode, selectionOnly );
};

/* Inheritance */

OO.initClass( ve.ce.RangeState );

/* Methods */

/**
 * Saves a snapshot of the current range state
 * @method
 * @param {ve.ce.RangeState|null} old Previous range state
 * @param {jQuery} $surfaceElement The CE Surface $element
 * @param {ve.ce.DocumentNode} docNode The current document node
 * @param {boolean} selectionOnly The caller promises the content has not changed from old
 */
ve.ce.RangeState.prototype.saveState = function ( old, $surfaceElement, docNode, selectionOnly ) {
	var $nodeOrSlug, selection, anchorNodeChanged;

	// Freeze selection out of live object.
	selection = ( function ( liveSelection ) {
		return {
			focusNode: liveSelection.focusNode,
			focusOffset: liveSelection.focusOffset,
			anchorNode: liveSelection.anchorNode,
			anchorOffset: liveSelection.anchorOffset
		};
	}( docNode.getElementDocument().getSelection() ) );

	// Use a blank selection if the selection is outside this surface
	// (or if the selection is inside another surface inside this one)
	if (
		selection.rangeCount && $(
			selection.getRangeAt( 0 ).commonAncestorContainer
		).closest( '.ve-ce-surface' )[0] !== $surfaceElement[0]
	) {
		selection = {
			focusNode: null,
			focusOffset: null,
			anchorNode: null,
			anchorOffset: null
		};
	}

	// Get new range information
	if ( old && !old.compareSelection( selection ) ) {
		// No change; use old values for speed
		this.selectionChanged = false;
		this.veRange = old.veRange;
		this.$slugWrapper = old.$slugWrapper;
		this.leftBlockSlug = false;
		this.enteredBlockSlug = false;
	} else {
		this.selectionChanged = true;
		this.veRange = ve.ce.veRangeFromSelection( selection );
	}

	anchorNodeChanged = !old || old.compareAnchorNode( selection );

	if ( !anchorNodeChanged ) {
		this.node = old.node;
		this.$slugWrapper = old.$slugWrapper;
	} else {
		$nodeOrSlug = $( selection.anchorNode ).closest(
			'.ve-ce-branchNode, .ve-ce-branchNode-blockSlugWrapper'
		);
		if ( $nodeOrSlug.length === 0 ) {
			this.node = null;
			this.$slugWrapper = null;
		} else if ( $nodeOrSlug.hasClass( 've-ce-branchNode-blockSlugWrapper' ) ) {
			this.node = null;
			this.$slugWrapper = $nodeOrSlug;
		} else {
			this.node = $nodeOrSlug.data( 'view' );
			this.$slugWrapper = null;
			// Check this node belongs to our document
			if ( this.node && this.node.root !== docNode ) {
				this.node = null;
				this.veRange = null;
			}
		}
	}

	this.branchNodeChanged = ( !old || this.node !== old.node );

	// Compute text/hash, for change comparison
	if ( selectionOnly && !anchorNodeChanged ) {
		this.text = old.text;
		this.hash = old.hash;
	} else if ( this.node === null ) {
		this.text = null;
		this.hash = null;
	} else {
		this.text = ve.ce.getDomText( this.node.$element[0] );
		this.hash = ve.ce.getDomHash( this.node.$element[0] );
	}

	this.leftBlockSlug = (
		old &&
		old.$slugWrapper &&
		!old.$slugWrapper.is( this.$slugWrapper )
	);
	this.enteredBlockSlug = (
		old &&
		this.$slugWrapper &&
		this.$slugWrapper.length > 0 &&
		!this.$slugWrapper.is( old.$slugWrapper )
	);

	// Only set contentChanged if we're still in the same branch node/block slug
	this.contentChanged = (
		!selectionOnly &&
		old &&
		old.node === this.node && (
			old.hash === null ||
			old.text === null ||
			old.hash !== this.hash ||
			old.text !== this.text
		)
	);

	// Save selection for future comparisons. (But it is not properly frozen, because the nodes
	// are live and mutable, and therefore the offsets may come to point to places that are
	// misleadingly different from when the selection was saved).
	this.misleadingSelection = selection;
};

/**
 * Compare a selection object for changes from the snapshotted state.
 *
 * The meaning of "changes" is slightly misleading, because the offsets were taken
 * at two different instants, between which content outside of the selection may
 * have changed. This can in theory cause false negatives (unnoticed changes).
 *
 * @param {Object} selection Selection to compare
 * @returns {boolean} Whether there is a change
 */
ve.ce.RangeState.prototype.compareSelection = function ( selection ) {
	return (
		this.misleadingSelection.focusNode !== selection.focusNode ||
		this.misleadingSelection.focusOffset !== selection.focusOffset ||
		this.misleadingSelection.anchorNode !== selection.anchorNode ||
		this.misleadingSelection.anchorOffset !== selection.anchorOffset
	);
};

/**
 * Compare a selection object for a change of anchor node from the snapshotted state.
 *
 * @param {Object} selection Selection to compare
 * @returns {boolean} Whether the anchor node has changed
 */
ve.ce.RangeState.prototype.compareAnchorNode = function ( selection ) {
	return this.misleadingSelection.anchorNode !== selection.anchorNode;
};

/*!
 * VisualEditor ContentEditable AnnotationFactory class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable annotation factory.
 *
 * @class
 * @extends OO.Factory
 * @constructor
 */
ve.ce.AnnotationFactory = function VeCeAnnotationFactory() {
	// Parent constructor
	OO.Factory.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ce.AnnotationFactory, OO.Factory );

/* Methods */

/**
 * Get a plain text description of an annotation model.
 *
 * @param {ve.dm.Annotation} annotation Annotation to describe
 * @returns {string} Description of the annotation
 * @throws {Error} Unknown annotation type
 */
ve.ce.AnnotationFactory.prototype.getDescription = function ( annotation ) {
	var type = annotation.constructor.static.name;
	if ( Object.prototype.hasOwnProperty.call( this.registry, type ) ) {
		return this.registry[type].static.getDescription( annotation );
	}
	throw new Error( 'Unknown annotation type: ' + type );
};

/**
 * Check if an annotation needs to force continuation
 * @param {string} type Annotation type
 * @returns {boolean} Whether the annotation needs to force continuation
 */
ve.ce.AnnotationFactory.prototype.isAnnotationContinuationForced = function ( type ) {
	if ( Object.prototype.hasOwnProperty.call( this.registry, type ) ) {
		return this.registry[type].static.forceContinuation;
	}
	return false;
};

/* Initialization */

// TODO: Move instantiation to a different file
ve.ce.annotationFactory = new ve.ce.AnnotationFactory();

/*!
 * VisualEditor ContentEditable NodeFactory class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable node factory.
 *
 * @class
 * @extends OO.Factory
 * @constructor
 */
ve.ce.NodeFactory = function VeCeNodeFactory() {
	// Parent constructor
	OO.Factory.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ce.NodeFactory, OO.Factory );

/* Methods */

/**
 * Get a plain text description of a node model.
 *
 * @param {ve.dm.Node} node Node to describe
 * @returns {string} Description of the node
 * @throws {Error} Unknown node type
 */
ve.ce.NodeFactory.prototype.getDescription = function ( node ) {
	var type = node.constructor.static.name;
	if ( Object.prototype.hasOwnProperty.call( this.registry, type ) ) {
		return this.registry[type].static.getDescription( node );
	}
	throw new Error( 'Unknown node type: ' + type );
};

/**
 * Check if a node type splits on Enter
 *
 * @param {string} type Node type
 * @returns {boolean} The node can have grandchildren
 * @throws {Error} Unknown node type
 */
ve.ce.NodeFactory.prototype.splitNodeOnEnter = function ( type ) {
	if ( Object.prototype.hasOwnProperty.call( this.registry, type ) ) {
		return this.registry[type].static.splitOnEnter;
	}
	throw new Error( 'Unknown node type: ' + type );
};

/**
 * Get primary command for node type.
 *
 * @method
 * @param {string} type Node type
 * @returns {string|null} Primary command name
 * @throws {Error} Unknown node type
 */
ve.ce.NodeFactory.prototype.getNodePrimaryCommandName = function ( type ) {
	if ( Object.prototype.hasOwnProperty.call( this.registry, type ) ) {
		return this.registry[type].static.primaryCommandName;
	}
	throw new Error( 'Unknown node type: ' + type );
};

/* Initialization */

// TODO: Move instantiation to a different file
ve.ce.nodeFactory = new ve.ce.NodeFactory();

/*!
 * VisualEditor ContentEditable Document class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable document.
 *
 * @class
 * @extends ve.Document
 *
 * @constructor
 * @param {ve.dm.Document} model Model to observe
 * @param {ve.ce.Surface} surface Surface document is part of
 */
ve.ce.Document = function VeCeDocument( model, surface ) {
	// Parent constructor
	ve.Document.call( this, new ve.ce.DocumentNode(
		model.getDocumentNode(), surface, { $: surface.$ }
	) );

	this.getDocumentNode().$element.prop( {
		lang: model.getLang(),
		dir: model.getDir()
	} );

	// Properties
	this.model = model;
};

/* Inheritance */

OO.inheritClass( ve.ce.Document, ve.Document );

/* Methods */

/**
 * Get a slug at an offset.
 *
 * @method
 * @param {number} offset Offset to get slug at
 * @returns {HTMLElement} Slug at offset
 */
ve.ce.Document.prototype.getSlugAtOffset = function ( offset ) {
	var node = this.getBranchNodeFromOffset( offset );
	return node ? node.getSlugAtOffset( offset ) : null;
};

/**
 * Get a DOM node and DOM element offset for a document offset.
 *
 * @method
 * @param {number} offset Linear model offset
 * @returns {Object} Object containing a node and offset property where node is an HTML element and
 * offset is the byte position within the element
 * @throws {Error} Offset could not be translated to a DOM element and offset
 */
ve.ce.Document.prototype.getNodeAndOffset = function ( offset ) {
	var nao, currentNode, nextNode, previousNode;
	function getNext( node ) {
		while ( node.nextSibling === null ) {
			node = node.parentNode;
			if ( node === null ) {
				return null;
			}
		}
		node = node.nextSibling;
		while ( node.firstChild ) {
			node = node.firstChild;
		}
		return node;
	}
	function getPrevious( node ) {
		while ( node.previousSibling === null ) {
			node = node.parentNode;
			if ( node === null ) {
				return null;
			}
		}
		node = node.previousSibling;
		while ( node.lastChild ) {
			node = node.lastChild;
		}
		return node;
	}

	nao = this.getNodeAndOffsetUnadjustedForUnicorn( offset );
	currentNode = nao.node;
	nextNode = getNext( currentNode );
	previousNode = getPrevious( currentNode );

	// Adjust for unicorn if necessary, then return
	if (
		( (
			currentNode.nodeType === Node.TEXT_NODE &&
			nao.offset === currentNode.data.length
		) || (
			currentNode.nodeType === Node.ELEMENT_NODE &&
			currentNode.classList.contains( 've-ce-branchNode-inlineSlug' )
		) ) &&
		nextNode &&
		nextNode.nodeType === Node.ELEMENT_NODE &&
		nextNode.classList.contains( 've-ce-pre-unicorn' )
	) {
		// At text offset or slug just before the pre unicorn; return the point just after it
		return ve.ce.nextCursorOffset( nextNode );
	} else if ( currentNode.nodeType === Node.ELEMENT_NODE &&
		currentNode.childNodes.length > nao.offset &&
		currentNode.childNodes[nao.offset].nodeType === Node.ELEMENT_NODE &&
		currentNode.childNodes[nao.offset].classList.contains( 've-ce-pre-unicorn' )
	) {
		// At element offset just before the pre unicorn; return the point just after it
		return { node: nao.node, offset: nao.offset + 1 };
	} else if (
		( (
			currentNode.nodeType === Node.TEXT_NODE &&
			nao.offset === 0
		) || (
			currentNode.nodeType === Node.ELEMENT_NODE &&
			currentNode.classList.contains( 've-ce-branchNode-inlineSlug' )
		) ) &&
		previousNode &&
		previousNode.nodeType === Node.ELEMENT_NODE &&
		previousNode.classList.contains( 've-ce-post-unicorn' )
	) {
		// At text offset or slug just after the post unicorn; return the point just before it
		return ve.ce.previousCursorOffset( previousNode );
	} else if ( currentNode.nodeType === Node.ELEMENT_NODE &&
		nao.offset > 0 &&
		currentNode.childNodes[nao.offset - 1].nodeType === Node.ELEMENT_NODE &&
		currentNode.childNodes[nao.offset - 1].classList.contains( 've-ce-post-unicorn' )
	) {
		// At element offset just after the post unicorn; return the point just before it
		return { node: nao.node, offset: nao.offset - 1 };
	} else {
		return nao;
	}
};

/**
 * @private
 */
ve.ce.Document.prototype.getNodeAndOffsetUnadjustedForUnicorn = function ( offset ) {
	var node, startOffset, current, stack, item, $item, length, model,
		countedNodes = [],
		slug = this.getSlugAtOffset( offset );
	// Check for a slug that is empty (apart from a chimera)
	if ( slug && ( !slug.firstChild || $( slug.firstChild ).hasClass( 've-ce-chimera' ) ) ) {
		return { node: slug, offset: 0 };
	}
	node = this.getBranchNodeFromOffset( offset );
	startOffset = node.getOffset() + ( ( node.isWrapped() ) ? 1 : 0 );
	current = [node.$element.contents(), 0];
	stack = [current];
	while ( stack.length > 0 ) {
		if ( current[1] >= current[0].length ) {
			stack.pop();
			current = stack[ stack.length - 1 ];
			continue;
		}
		item = current[0][current[1]];
		if ( item.nodeType === Node.TEXT_NODE ) {
			length = item.textContent.length;
			if ( offset >= startOffset && offset <= startOffset + length ) {
				return {
					node: item,
					offset: offset - startOffset
				};
			} else {
				startOffset += length;
			}
		} else if ( item.nodeType === Node.ELEMENT_NODE ) {
			$item = current[0].eq( current[1] );
			if ( $item.hasClass( 've-ce-unicorn' ) ) {
				if ( offset === startOffset ) {
					// Return if empty unicorn pair at the correct offset
					if ( $( $item[0].previousSibling ).hasClass( 've-ce-unicorn' ) ) {
						return {
							node: $item[0].parentNode,
							offset: current[1] - 1
						};
					} else if ( $( $item[0].nextSibling ).hasClass( 've-ce-unicorn' ) ) {
						return {
							node: $item[0].parentNode,
							offset: current[1] + 1
						};
					}
					// Else algorithm will/did descend into unicorned range
				}
				// Else algorithm will skip this unicorn
			} else if ( $item.is( '.ve-ce-branchNode, .ve-ce-leafNode' ) ) {
				model = $item.data( 'view' ).model;
				// DM nodes can render as multiple elements in the view, so check
				// we haven't already counted it.
				if ( ve.indexOf( model, countedNodes ) === -1 ) {
					length = model.getOuterLength();
					countedNodes.push( model );
					if ( offset >= startOffset && offset < startOffset + length ) {
						stack.push( [$item.contents(), 0] );
						current[1]++;
						current = stack[stack.length - 1];
						continue;
					} else {
						startOffset += length;
					}
				}
			} else {
				// Maybe ve-ce-branchNode-slug
				stack.push( [$item.contents(), 0] );
				current[1]++;
				current = stack[stack.length - 1];
				continue;
			}
		}
		current[1]++;
	}
	throw new Error( 'Offset could not be translated to a DOM element and offset: ' + offset );
};

/**
 * Get the directionality of some selection.
 *
 * @method
 * @param {ve.dm.Selection} selection Selection
 * @returns {string|null} 'rtl', 'ltr' or null if unknown
 */
ve.ce.Document.prototype.getDirectionFromSelection = function ( selection ) {
	var effectiveNode, range, selectedNodes;

	if ( selection instanceof ve.dm.LinearSelection ) {
		range = selection.getRange();
	} else if ( selection instanceof ve.dm.TableSelection ) {
		range = selection.tableRange;
	} else {
		return null;
	}

	selectedNodes = this.selectNodes( range, 'covered' );

	if ( selectedNodes.length > 1 ) {
		// Selection of multiple nodes
		// Get the common parent node
		effectiveNode = this.selectNodes( range, 'siblings' )[0].node.getParent();
	} else {
		// selection of a single node
		effectiveNode = selectedNodes[0].node;

		while ( effectiveNode.isContent() ) {
			// This means that we're in a leaf node, like TextNode
			// those don't read the directionality properly, we will
			// have to climb up the parentage chain until we find a
			// wrapping node like paragraph or list item, etc.
			effectiveNode = effectiveNode.parent;
		}
	}

	return effectiveNode.$element.css( 'direction' );
};

/*!
 * VisualEditor ContentEditable View class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic base class for CE views.
 *
 * @abstract
 * @extends OO.ui.Element
 * @mixins OO.EventEmitter
 *
 * @constructor
 * @param {ve.dm.Model} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.View = function VeCeView( model, config ) {
	// Setting this property before calling the parent constructor allows overridden #getTagName
	// methods in view classes to have access to the model when they are called for the first time
	// inside of OO.ui.Element
	this.model = model;

	// Parent constructor
	OO.ui.Element.call( this, config );

	// Mixin constructors
	OO.EventEmitter.call( this );

	// Properties
	this.live = false;

	// Events
	this.connect( this, {
		setup: 'onSetup',
		teardown: 'onTeardown'
	} );

	// Render attributes from original DOM elements
	ve.dm.Converter.renderHtmlAttributeList(
		this.model.getHtmlAttributes(),
		this.$element,
		this.constructor.static.renderHtmlAttributes,
		// computed attributes
		true
	);
};

/* Inheritance */

OO.inheritClass( ve.ce.View, OO.ui.Element );

OO.mixinClass( ve.ce.View, OO.EventEmitter );

/* Events */

/**
 * @event setup
 */

/**
 * @event teardown
 */

/* Static members */

/**
 * Allowed attributes for DOM elements, in the same format as ve.dm.Model#storeHtmlAttributes
 *
 * This list includes attributes that are generally safe to include in HTML loaded from a
 * foreign source and displaying it inside the browser. It doesn't include any event attributes,
 * for instance, which would allow arbitrary JavaScript execution. This alone is not enough to
 * make HTML safe to display, but it helps.
 *
 * TODO: Rather than use a single global list, set these on a per-view basis to something that makes
 * sense for that view in particular.
 *
 * @static
 * @property {boolean|string|RegExp|Array|Object}
 * @inheritable
 */
ve.ce.View.static.renderHtmlAttributes = [
	'abbr', 'about', 'align', 'alt', 'axis', 'bgcolor', 'border', 'cellpadding', 'cellspacing',
	'char', 'charoff', 'cite', 'class', 'clear', 'color', 'colspan', 'datatype', 'datetime',
	'dir', 'face', 'frame', 'headers', 'height', 'href', 'id', 'itemid', 'itemprop', 'itemref',
	'itemscope', 'itemtype', 'lang', 'noshade', 'nowrap', 'property', 'rbspan', 'rel',
	'resource', 'rev', 'rowspan', 'rules', 'scope', 'size', 'span', 'src', 'start', 'style',
	'summary', 'title', 'type', 'typeof', 'valign', 'value', 'width'
];

/* Methods */

/**
 * Get an HTML document from the model, to use for URL resolution.
 *
 * The default implementation returns null; subclasses should override this if they can provide
 * a resolution document.
 *
 * @see #getResolvedAttribute
 * @returns {HTMLDocument|null} HTML document to use for resolution, or null if not available
 */
ve.ce.View.prototype.getModelHtmlDocument = function () {
	return null;
};

/**
 * Handle setup event.
 *
 * @method
 */
ve.ce.View.prototype.onSetup = function () {
	this.$element.data( 'view', this );
};

/**
 * Handle teardown event.
 *
 * @method
 */
ve.ce.View.prototype.onTeardown = function () {
	this.$element.removeData( 'view' );
};

/**
 * Get the model the view observes.
 *
 * @method
 * @returns {ve.dm.Model} Model the view observes
 */
ve.ce.View.prototype.getModel = function () {
	return this.model;
};

/**
 * Check if the view is attached to the live DOM.
 *
 * @method
 * @returns {boolean} View is attached to the live DOM
 */
ve.ce.View.prototype.isLive = function () {
	return this.live;
};

/**
 * Set live state.
 *
 * @method
 * @param {boolean} live The view has been attached to the live DOM (use false on detach)
 * @fires setup
 * @fires teardown
 */
ve.ce.View.prototype.setLive = function ( live ) {
	this.live = live;
	if ( this.live ) {
		this.emit( 'setup' );
	} else {
		this.emit( 'teardown' );
	}
};

/**
 * Check if the node is inside a contentEditable node
 *
 * @return {boolean} Node is inside a contentEditable node
 */
ve.ce.View.prototype.isInContentEditable = function () {
	var node = this.$element[0].parentNode;
	while ( node && node.contentEditable === 'inherit' ) {
		node = node.parentNode;
	}
	return !!( node && node.contentEditable === 'true' );
};

/**
 * Get a resolved URL from a model attribute.
 *
 * @abstract
 * @method
 * @param {string} key Attribute name whose value is a URL
 * @returns {string} URL resolved according to the document's base
 */
ve.ce.View.prototype.getResolvedAttribute = function ( key ) {
	var plainValue = this.model.getAttribute( key ),
		doc = this.getModelHtmlDocument();
	return doc && typeof plainValue === 'string' ? ve.resolveUrl( plainValue, doc ) : plainValue;
};

/*!
 * VisualEditor ContentEditable Annotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic ContentEditable annotation.
 *
 * This is an abstract class, annotations should extend this and call this constructor from their
 * constructor. You should not instantiate this class directly.
 *
 * Subclasses of ve.dm.Annotation should have a corresponding subclass here that controls rendering.
 *
 * @abstract
 * @extends ve.ce.View
 *
 * @constructor
 * @param {ve.dm.Annotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.Annotation = function VeCeAnnotation( model, parentNode, config ) {
	// Parent constructor
	ve.ce.View.call( this, model, config );

	// Properties
	this.parentNode = parentNode || null;
};

/* Inheritance */

OO.inheritClass( ve.ce.Annotation, ve.ce.View );

/* Static Properties */

ve.ce.Annotation.static.tagName = 'span';

/**
 * Whether this annotation's continuation (or lack thereof) needs to be forced.
 *
 * This should be set to true only for annotations that aren't continued by browsers but are in DM,
 * or the other way around, or those where behavior is inconsistent between browsers.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ce.Annotation.static.forceContinuation = false;

/* Static Methods */

/**
 * Get a plain text description.
 *
 * @static
 * @inheritable
 * @param {ve.dm.Annotation} annotation Annotation model
 * @returns {string} Description of annotation
 */
ve.ce.Annotation.static.getDescription = function () {
	return '';
};

/* Methods */

/**
 * Get the content branch node this annotation is rendered in, if any.
 * @returns {ve.ce.ContentBranchNode|null} Content branch node or null if none
 */
ve.ce.Annotation.prototype.getParentNode = function () {
	return this.parentNode;
};

/** */
ve.ce.Annotation.prototype.getModelHtmlDocument = function () {
	return this.parentNode && this.parentNode.getModelHtmlDocument();
};

/*!
 * VisualEditor ContentEditable Node class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic ContentEditable node.
 *
 * @abstract
 * @extends ve.ce.View
 * @mixins ve.Node
 *
 * @constructor
 * @param {ve.dm.Node} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.Node = function VeCeNode( model, config ) {
	// Parent constructor
	ve.ce.View.call( this, model, config );

	// Mixin constructor
	ve.Node.call( this );

	// Properties
	this.parent = null;
};

/* Inheritance */

OO.inheritClass( ve.ce.Node, ve.ce.View );

OO.mixinClass( ve.ce.Node, ve.Node );

/* Static Members */

/**
 * Whether Enter splits this node type.
 *
 * When the user presses Enter, we split the node they're in (if splittable), then split its parent
 * if splittable, and continue traversing up the tree and stop at the first non-splittable node.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ce.Node.static.splitOnEnter = false;

/**
 * Command to execute when Enter is pressed while this node is selected, or when the node is double-clicked.
 *
 * @static
 * @property {string|null}
 * @inheritable
 */
ve.ce.Node.static.primaryCommandName = null;

/* Static Methods */

/**
 * Get a plain text description.
 *
 * @static
 * @inheritable
 * @param {ve.dm.Node} node Node model
 * @returns {string} Description of node
 */
ve.ce.Node.static.getDescription = function () {
	return '';
};

/* Methods */

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.getChildNodeTypes = function () {
	return this.model.getChildNodeTypes();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.getParentNodeTypes = function () {
	return this.model.getParentNodeTypes();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.getSuggestedParentNodeTypes = function () {
	return this.model.getSuggestedParentNodeTypes();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.canHaveChildren = function () {
	return this.model.canHaveChildren();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.canHaveChildrenNotContent = function () {
	return this.model.canHaveChildrenNotContent();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.isWrapped = function () {
	return this.model.isWrapped();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.canContainContent = function () {
	return this.model.canContainContent();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.isContent = function () {
	return this.model.isContent();
};

/**
 * @inheritdoc ve.Node
 *
 * If this is set to true it should implement:
 *
 *     setFocused( boolean val )
 *     boolean isFocused()
 */
ve.ce.Node.prototype.isFocusable = function () {
	return this.model.isFocusable();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.hasSignificantWhitespace = function () {
	return this.model.hasSignificantWhitespace();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.handlesOwnChildren = function () {
	return this.model.handlesOwnChildren();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.getLength = function () {
	return this.model.getLength();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.getOuterLength = function () {
	return this.model.getOuterLength();
};

/**
 * @inheritdoc ve.Node
 */
ve.ce.Node.prototype.getOffset = function () {
	return this.model.getOffset();
};

/**
 * Check if the node can be split.
 *
 * @returns {boolean} Node can be split
 */
ve.ce.Node.prototype.splitOnEnter = function () {
	return this.constructor.static.splitOnEnter;
};

/**
 * Release all memory.
 */
ve.ce.Node.prototype.destroy = function () {
	this.parent = null;
	this.model.disconnect( this );
};

/** */
ve.ce.Node.prototype.getModelHtmlDocument = function () {
	return this.model.getDocument() && this.model.getDocument().getHtmlDocument();
};

/*!
 * VisualEditor ContentEditable BranchNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable branch node.
 *
 * Branch nodes can have branch or leaf nodes as children.
 *
 * @class
 * @abstract
 * @extends ve.ce.Node
 * @mixins ve.BranchNode
 * @constructor
 * @param {ve.dm.BranchNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.BranchNode = function VeCeBranchNode( model, config ) {
	// Mixin constructor
	ve.BranchNode.call( this );

	// Parent constructor
	ve.ce.Node.call( this, model, config );

	// Properties
	this.tagName = this.$element.get( 0 ).nodeName.toLowerCase();
	this.slugNodes = [];

	// Events
	this.model.connect( this, { splice: 'onSplice' } );

	// Initialization
	this.onSplice.apply( this, [0, 0].concat( model.getChildren() ) );
};

/* Inheritance */

OO.inheritClass( ve.ce.BranchNode, ve.ce.Node );

OO.mixinClass( ve.ce.BranchNode, ve.BranchNode );

/* Events */

/**
 * @event rewrap
 * @param {jQuery} $old
 * @param {jQuery} $new
 */

/* Static Properties */

/**
 * Inline slug template.
 *
 * TODO: Make iframe safe
 *
 * @static
 * @property {HTMLElement}
 */
ve.ce.BranchNode.inlineSlugTemplate = $( '<span>' )
	.addClass( 've-ce-branchNode-slug ve-ce-branchNode-inlineSlug' )
	.append(
		$( '<img>' )
			.prop( 'src', ve.ce.minImgDataUri )
			.css( { width: '0', height: '0' } )
			.addClass( 've-ce-chimera' )
	)
	.get( 0 );

/**
 * Inline slug template for input debugging.
 *
 * TODO: Make iframe safe
 *
 * @static
 * @property {HTMLElement}
 */
ve.ce.BranchNode.inputDebugInlineSlugTemplate = $( '<span>' )
	.addClass( 've-ce-branchNode-slug ve-ce-branchNode-inlineSlug' )
	.append(
		$( '<img>' )
			.prop( 'src', ve.ce.chimeraImgDataUri )
			.addClass( 've-ce-chimera' )
	)
	.get( 0 );

/**
 * Block slug template.
 *
 * TODO: Make iframe safe
 *
 * @static
 * @property {HTMLElement}
 */
ve.ce.BranchNode.blockSlugTemplate = $( '<div>' )
	.addClass( 've-ce-branchNode-blockSlugWrapper ve-ce-branchNode-blockSlugWrapper-unfocused' )
	.append(
		$( '<p>' )
			// TODO: work around ce=false IE9 bug
			.prop( 'contentEditable', 'false' )
			.addClass( 've-ce-branchNode-slug ve-ce-branchNode-blockSlug' )
			.html( '&#xFEFF;' )
	)
	.get( 0 );

/* Methods */

/**
 * Handle setup event.
 *
 * @method
 */
ve.ce.BranchNode.prototype.onSetup = function () {
	ve.ce.Node.prototype.onSetup.call( this );
	this.$element.addClass( 've-ce-branchNode' );
};

/**
 * Handle teardown event.
 *
 * @method
 */
ve.ce.BranchNode.prototype.onTeardown = function () {
	ve.ce.Node.prototype.onTeardown.call( this );
	this.$element.removeClass( 've-ce-branchNode' );
};

/**
 * Update the DOM wrapper.
 *
 * WARNING: The contents, .data( 'view' ) and any classes the wrapper already has will be moved to
 * the new wrapper, but other attributes and any other information added using $.data() will be
 * lost upon updating the wrapper. To retain information added to the wrapper, subscribe to the
 * 'rewrap' event and copy information from the {$old} wrapper the {$new} wrapper.
 *
 * @method
 * @fires rewrap
 */
ve.ce.BranchNode.prototype.updateTagName = function () {
	var $wrapper,
		tagName = this.getTagName();

	if ( tagName !== this.tagName ) {
		this.emit( 'teardown' );
		$wrapper = this.$( document.createElement( tagName ) );
		// Move contents
		$wrapper.append( this.$element.contents() );
		// Swap elements
		this.$element.replaceWith( $wrapper );
		// Use new element from now on
		this.$element = $wrapper;
		this.emit( 'setup' );
		// Remember which tag name we are using now
		this.tagName = tagName;
	}
};

/**
 * Handles model update events.
 *
 * @param {ve.dm.Transaction} transaction
 */
ve.ce.BranchNode.prototype.onModelUpdate = function ( transaction ) {
	this.emit( 'childUpdate', transaction );
};

/**
 * Handle splice events.
 *
 * ve.ce.Node objects are generated from the inserted ve.dm.Node objects, producing a view that's a
 * mirror of its model.
 *
 * @method
 * @param {number} index Index to remove and or insert nodes at
 * @param {number} howmany Number of nodes to remove
 * @param {ve.dm.BranchNode...} [nodes] Variadic list of nodes to insert
 */
ve.ce.BranchNode.prototype.onSplice = function ( index ) {
	var i, j,
		length,
		args = Array.prototype.slice.call( arguments ),
		$anchor,
		afterAnchor,
		node,
		parentNode,
		removals;
	// Convert models to views and attach them to this node
	if ( args.length >= 3 ) {
		for ( i = 2, length = args.length; i < length; i++ ) {
			args[i] = ve.ce.nodeFactory.create( args[i].getType(), args[i], { $: this.$ } );
			args[i].model.connect( this, { update: 'onModelUpdate' } );
		}
	}
	removals = this.children.splice.apply( this.children, args );
	for ( i = 0, length = removals.length; i < length; i++ ) {
		removals[i].model.disconnect( this, { update: 'onModelUpdate' } );
		removals[i].setLive( false );
		removals[i].detach();
		removals[i].$element.detach();
	}
	if ( args.length >= 3 ) {
		if ( index ) {
			// Get the element before the insertion point
			$anchor = this.children[ index - 1 ].$element.last();
		}
		for ( i = args.length - 1; i >= 2; i-- ) {
			args[i].attach( this );
			if ( index ) {
				// DOM equivalent of $anchor.after( args[i].$element );
				afterAnchor = $anchor[0].nextSibling;
				parentNode = $anchor[0].parentNode;
				for ( j = 0, length = args[i].$element.length; j < length; j++ ) {
					parentNode.insertBefore( args[i].$element[j], afterAnchor );
				}
			} else {
				// DOM equivalent of this.$element.prepend( args[j].$element );
				node = this.$element[0];
				for ( j = args[i].$element.length - 1; j >= 0; j-- ) {
					node.insertBefore( args[i].$element[j], node.firstChild );
				}
			}
			if ( this.live !== args[i].isLive() ) {
				args[i].setLive( this.live );
			}
		}
	}

	this.setupSlugs();
};

/**
 * Setup slugs where needed.
 *
 * Existing slugs will be removed before new ones are added.
 *
 * @method
 */
ve.ce.BranchNode.prototype.setupSlugs = function () {
	var i, slugTemplate, slugNode, child,
		isBlock = this.canHaveChildrenNotContent(),
		doc = this.getElementDocument();

	// Remove all slugs in this branch
	for ( i in this.slugNodes ) {
		if ( this.slugNodes[i] !== undefined && this.slugNodes[i].parentNode ) {
			this.slugNodes[i].parentNode.removeChild( this.slugNodes[i] );
		}
		delete this.slugNodes[i];
	}

	if ( isBlock ) {
		slugTemplate = ve.ce.BranchNode.blockSlugTemplate;
	} else if ( ve.inputDebug ) {
		slugTemplate = ve.ce.BranchNode.inputDebugInlineSlugTemplate;
	} else {
		slugTemplate = ve.ce.BranchNode.inlineSlugTemplate;
	}

	for ( i in this.getModel().slugPositions ) {
		slugNode = doc.importNode( slugTemplate, true );
		// FIXME: InternalListNode has an empty $element, so we assume that the slug goes at the
		// end instead. This is a hack and the internal list needs to die in a fire.
		if ( this.children[i] && this.children[i].$element[0] ) {
			child = this.children[i].$element[0];
			// child.parentNode might not be equal to this.$element[0]: e.g. annotated inline nodes
			child.parentNode.insertBefore( slugNode, child );
		} else {
			this.$element[0].appendChild( slugNode );
		}
		this.slugNodes[i] = slugNode;
	}
};

/**
 * Get a slug at an offset.
 *
 * @method
 * @param {number} offset Offset to get slug at
 * @returns {HTMLElement}
 */
ve.ce.BranchNode.prototype.getSlugAtOffset = function ( offset ) {
	var i,
		startOffset = this.model.getOffset() + ( this.isWrapped() ? 1 : 0 );

	if ( offset === startOffset ) {
		return this.slugNodes[0] || null;
	}
	for ( i = 0; i < this.children.length; i++ ) {
		startOffset += this.children[i].model.getOuterLength();
		if ( offset === startOffset ) {
			return this.slugNodes[i + 1] || null;
		}
	}
};

/**
 * Set live state on child nodes.
 *
 * @method
 * @param {boolean} live New live state
 */
ve.ce.BranchNode.prototype.setLive = function ( live ) {
	ve.ce.Node.prototype.setLive.call( this, live );
	for ( var i = 0; i < this.children.length; i++ ) {
		this.children[i].setLive( live );
	}
};

/**
 * Release all memory.
 */
ve.ce.BranchNode.prototype.destroy = function () {
	var i, len;
	for ( i = 0, len = this.children.length; i < len; i++ ) {
		this.children[i].destroy();
	}

	ve.ce.Node.prototype.destroy.call( this );
};

/*!
 * VisualEditor ContentEditable ContentBranchNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable content branch node.
 *
 * Content branch nodes can only have content nodes as children.
 *
 * @abstract
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.BranchNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.ContentBranchNode = function VeCeContentBranchNode( model, config ) {
	// Parent constructor
	ve.ce.BranchNode.call( this, model, config );

	// Properties
	this.lastTransaction = null;
	this.unicornAnnotations = null;
	this.unicorns = null;

	// Events
	this.connect( this, { childUpdate: 'onChildUpdate' } );
};

/* Inheritance */

OO.inheritClass( ve.ce.ContentBranchNode, ve.ce.BranchNode );

/* Static Members */

/**
 * Whether Enter splits this node type. Must be true for ContentBranchNodes.
 *
 * Warning: overriding this to false in a subclass will cause crashes on Enter key handling.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ce.ContentBranchNode.static.splitOnEnter = true;

/* Static Methods */

/**
 * Append the return value of #getRenderedContents to a DOM element.
 *
 * @param {HTMLElement} container DOM element
 * @param {HTMLElement} wrapper Wrapper returned by #getRenderedContents
 */
ve.ce.ContentBranchNode.static.appendRenderedContents = function ( container, wrapper ) {
	function resolveOriginals( domElement ) {
		var i, len, child;
		for ( i = 0, len = domElement.childNodes.length; i < len; i++ ) {
			child = domElement.childNodes[i];
			if ( child.veOrigNode ) {
				domElement.replaceChild( child.veOrigNode, child );
			} else if ( child.childNodes && child.childNodes.length ) {
				resolveOriginals( child );
			}
		}
	}

	/* Resolve references to the original nodes. */
	resolveOriginals( wrapper );
	while ( wrapper.firstChild ) {
		container.appendChild( wrapper.firstChild );
	}
};

/* Methods */

/**
 * Handle splice events.
 *
 * Rendering is only done once per transaction. If a paragraph has multiple nodes in it then it's
 * possible to receive multiple `childUpdate` events for a single transaction such as annotating
 * across them. State is tracked by storing and comparing the length of the surface model's complete
 * history.
 *
 * This is used to automatically render contents.
 * @see ve.ce.BranchNode#onSplice
 *
 * @method
 */
ve.ce.ContentBranchNode.prototype.onChildUpdate = function ( transaction ) {
	if ( transaction === null || transaction === this.lastTransaction ) {
		this.lastTransaction = transaction;
		return;
	}
	this.renderContents();
};

/**
 * Handle splice events.
 *
 * This is used to automatically render contents.
 * @see ve.ce.BranchNode#onSplice
 *
 * @method
 */
ve.ce.ContentBranchNode.prototype.onSplice = function ( index, howmany ) {
	// Parent method
	ve.ce.BranchNode.prototype.onSplice.apply( this, arguments );

	// HACK: adjust slugNodes indexes if isRenderingLocked. This should be sufficient to
	// keep this.slugNodes valid - only text changes can occur, which cannot create a
	// requirement for a new slug (it can make an existing slug redundant, but it is
	// harmless to leave it there).
	if (
		this.root instanceof ve.ce.DocumentNode &&
		this.root.getSurface().isRenderingLocked
	) {
		this.slugNodes.splice.apply( this.slugNodes, [ index, howmany ].concat( new Array( arguments.length - 2 ) ) );
	}

	// Rerender to make sure annotations are applied correctly
	this.renderContents();
};

/** @inheritdoc */
ve.ce.ContentBranchNode.prototype.setupSlugs = function () {
	// Respect render lock
	if (
		this.root instanceof ve.ce.DocumentNode &&
		this.root.getSurface().isRenderingLocked()
	) {
		return;
	}
	ve.ce.BranchNode.prototype.setupSlugs.apply( this, arguments );
};

/**
 * Get an HTML rendering of the contents.
 *
 * If you are actually going to append the result to a DOM, you need to
 * do this with #appendRenderedContents, which resolves the cloned
 * nodes returned by this function back to their originals.
 *
 * @method
 * @returns {HTMLElement} Wrapper containing rendered contents
 * @returns {Object} return.unicornInfo Unicorn information
 */
ve.ce.ContentBranchNode.prototype.getRenderedContents = function () {
	var i, ilen, j, jlen, item, itemAnnotations, ann, clone, dmSurface, dmSelection, relCursor,
		unicorn, img1, img2, annotationsChanged, childLength, offset, htmlItem, ceSurface,
		nextItemAnnotations, linkAnnotations,
		store = this.model.doc.getStore(),
		annotationStack = new ve.dm.AnnotationSet( store ),
		annotatedHtml = [],
		doc = this.getElementDocument(),
		wrapper = doc.createElement( 'div' ),
		current = wrapper,
		unicornInfo = {},
		buffer = '',
		node = this;

	function openAnnotation( annotation ) {
		annotationsChanged = true;
		if ( buffer !== '' ) {
			current.appendChild( doc.createTextNode( buffer ) );
			buffer = '';
		}
		// Create a new DOM node and descend into it
		ann = ve.ce.annotationFactory.create(
			annotation.getType(), annotation, node, { $: node.$ }
		).$element[0];
		current.appendChild( ann );
		current = ann;
	}

	function closeAnnotation() {
		annotationsChanged = true;
		if ( buffer !== '' ) {
			current.appendChild( doc.createTextNode( buffer ) );
			buffer = '';
		}
		// Traverse up
		current = current.parentNode;
	}

	// Gather annotated HTML from the child nodes
	for ( i = 0, ilen = this.children.length; i < ilen; i++ ) {
		annotatedHtml = annotatedHtml.concat( this.children[i].getAnnotatedHtml() );
	}

	// Set relCursor to collapsed selection offset, or -1 if none
	// (in which case we don't need to worry about preannotation)
	relCursor = -1;
	if ( this.getRoot() ) {
		ceSurface = this.getRoot().getSurface();
		dmSurface = ceSurface.getModel();
		dmSelection = dmSurface.getTranslatedSelection();
		if ( dmSelection instanceof ve.dm.LinearSelection && dmSelection.isCollapsed() ) {
			// subtract 1 for CBN opening tag
			relCursor = dmSelection.getRange().start - this.getOffset() - 1;
		}
	}

	// Set cursor status for renderContents. If hasCursor, splice unicorn marker at the
	// collapsed selection offset. It will be rendered later if it is needed, else ignored
	if ( relCursor < 0 || relCursor > this.getLength() ) {
		unicornInfo.hasCursor = false;
	} else {
		unicornInfo.hasCursor = true;
		offset = 0;
		for ( i = 0, ilen = annotatedHtml.length; i < ilen; i++ ) {
			htmlItem = annotatedHtml[i][0];
			childLength = ( typeof htmlItem === 'string' ) ? 1 : 2;
			if ( offset <= relCursor && relCursor < offset + childLength ) {
				unicorn = [
					{}, // unique object, for testing object equality later
					dmSurface.getInsertionAnnotations().storeIndexes
				];
				annotatedHtml.splice( i, 0, unicorn );
				break;
			}
			offset += childLength;
		}
		// Special case for final position
		if ( i === ilen && offset === relCursor ) {
			unicorn = [
				{}, // unique object, for testing object equality later
				dmSurface.getInsertionAnnotations().storeIndexes
			];
			annotatedHtml.push( unicorn );
		}
	}

	// Render HTML with annotations
	for ( i = 0, ilen = annotatedHtml.length; i < ilen; i++ ) {
		if ( Array.isArray( annotatedHtml[i] ) ) {
			item = annotatedHtml[i][0];
			itemAnnotations = new ve.dm.AnnotationSet( store, annotatedHtml[i][1] );
		} else {
			item = annotatedHtml[i];
			itemAnnotations = new ve.dm.AnnotationSet( store );
		}

		// Remove 'a' from the unicorn, if the following item has no 'a'
		if ( unicorn && item === unicorn[0] && i < ilen - 1 ) {
			linkAnnotations = itemAnnotations.getAnnotationsByName( 'link' );
			nextItemAnnotations = new ve.dm.AnnotationSet(
				store,
				Array.isArray( annotatedHtml[i + 1] ) ? annotatedHtml[i + 1][1] : undefined
			);
			if ( !nextItemAnnotations.containsAllOf( linkAnnotations ) ) {
				itemAnnotations.removeSet( linkAnnotations );
			}
		}

		// annotationsChanged gets set to true by openAnnotation and closeAnnotation
		annotationsChanged = false;
		ve.dm.Converter.openAndCloseAnnotations( annotationStack, itemAnnotations,
			openAnnotation, closeAnnotation
		);

		// Handle the actual item
		if ( typeof item === 'string' ) {
			buffer += item;
		} else if ( unicorn && item === unicorn[0] ) {
			if ( annotationsChanged ) {
				if ( buffer !== '' ) {
					current.appendChild( doc.createTextNode( buffer ) );
					buffer = '';
				}
				img1 = doc.createElement( 'img' );
				img2 = doc.createElement( 'img' );
				img1.className = 've-ce-unicorn ve-ce-pre-unicorn';
				img2.className = 've-ce-unicorn ve-ce-post-unicorn';
				$( img1 ).data( 'dmOffset', ( this.getOffset() + 1 + i ) );
				$( img2 ).data( 'dmOffset', ( this.getOffset() + 1 + i ) );
				if ( ve.inputDebug ) {
					img1.setAttribute( 'src', ve.ce.unicornImgDataUri );
					img2.setAttribute( 'src', ve.ce.unicornImgDataUri );
				} else {
					img1.setAttribute( 'src', ve.ce.minImgDataUri );
					img2.setAttribute( 'src', ve.ce.minImgDataUri );
					img1.style.width = '0px';
					img2.style.width = '0px';
					img1.style.height = '0px';
					img2.style.height = '0px';
				}
				current.appendChild( img1 );
				current.appendChild( img2 );
				unicornInfo.annotations = dmSurface.getInsertionAnnotations();
				unicornInfo.unicorns = [ img1, img2 ];
			} else {
				unicornInfo.unicornAnnotations = null;
				unicornInfo.unicorns = null;
			}
		} else {
			if ( buffer !== '' ) {
				current.appendChild( doc.createTextNode( buffer ) );
				buffer = '';
			}
			// DOM equivalent of $( current ).append( item.clone() );
			for ( j = 0, jlen = item.length; j < jlen; j++ ) {
				// Append a clone so as to not relocate the original node
				clone = item[j].cloneNode( true );
				// Store a reference to the original node in a property
				clone.veOrigNode = item[j];
				current.appendChild( clone );
			}
		}
	}
	if ( buffer !== '' ) {
		current.appendChild( doc.createTextNode( buffer ) );
		buffer = '';
	}
	wrapper.unicornInfo = unicornInfo;
	return wrapper;
};

/**
 * Render contents.
 *
 * @method
 * @return {boolean} Whether the contents have changed
 */
ve.ce.ContentBranchNode.prototype.renderContents = function () {
	var i, len, element, rendered, unicornInfo, oldWrapper, newWrapper,
		node = this;
	if (
		this.root instanceof ve.ce.DocumentNode &&
		this.root.getSurface().isRenderingLocked()
	) {
		return false;
	}

	if ( this.root instanceof ve.ce.DocumentNode ) {
		this.root.getSurface().setContentBranchNodeChanged();
	}

	rendered = this.getRenderedContents();
	unicornInfo = rendered.unicornInfo;
	delete rendered.unicornInfo;

	// Return if unchanged. Test by building the new version and checking DOM-equality.
	// However we have to normalize to cope with consecutive text nodes. We can't normalize
	// the attached version, because that would close IMEs.

	oldWrapper = this.$element[0].cloneNode( true );
	newWrapper = this.$element[0].cloneNode( false );
	while ( rendered.firstChild ) {
		newWrapper.appendChild( rendered.firstChild );
	}
	ve.normalizeNode( oldWrapper );
	ve.normalizeNode( newWrapper );
	if ( newWrapper.isEqualNode( oldWrapper ) ) {
		return false;
	}

	this.unicornAnnotations = unicornInfo.annotations || null;
	this.unicorns = unicornInfo.unicorns || null;

	// Detach all child nodes from this.$element
	for ( i = 0, len = this.$element.length; i < len; i++ ) {
		element = this.$element[i];
		while ( element.firstChild ) {
			element.removeChild( element.firstChild );
		}
	}

	// Reattach nodes
	this.constructor.static.appendRenderedContents( this.$element[0], newWrapper );

	// Set unicorning status
	if ( this.getRoot() ) {
		if ( !unicornInfo.hasCursor ) {
			this.getRoot().getSurface().setNotUnicorning( this );
		} else if ( this.unicorns ) {
			this.getRoot().getSurface().setUnicorning( this );
		} else {
			this.getRoot().getSurface().setNotUnicorningAll( this );
		}
	}
	this.hasCursor = null;

	// Add slugs
	this.setupSlugs();

	// Highlight the node in debug mode
	if ( ve.debug ) {
		this.$element.css( 'backgroundColor', '#eee' );
		setTimeout( function () {
			node.$element.css( 'backgroundColor', '' );
		}, 500 );
	}

	return true;
};

/**
 * Handle teardown event.
 *
 * @method
 */
ve.ce.ContentBranchNode.prototype.onTeardown = function () {
	var ceSurface = this.getRoot().getSurface();

	// Parent method
	ve.ce.BranchNode.prototype.onTeardown.call( this );

	ceSurface.setNotUnicorning( this );
};

/*!
 * VisualEditor ContentEditable LeafNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable leaf node.
 *
 * Leaf nodes can not have any children.
 *
 * @abstract
 * @extends ve.ce.Node
 * @mixins ve.LeafNode
 *
 * @constructor
 * @param {ve.dm.LeafNode} model
 * @param {Object} [config]
 */
ve.ce.LeafNode = function VeCeLeafNode( model ) {
	// Mixin constructor
	ve.LeafNode.call( this );

	// Parent constructor
	ve.ce.Node.apply( this, arguments );

	// DOM changes
	if ( model.isWrapped() ) {
		this.$element.addClass( 've-ce-leafNode' );
	}
};

/* Inheritance */

OO.inheritClass( ve.ce.LeafNode, ve.ce.Node );

OO.mixinClass( ve.ce.LeafNode, ve.LeafNode );

/* Static Properties */

ve.ce.LeafNode.static.tagName = 'span';

/* Methods */

/** */
ve.ce.LeafNode.prototype.onSetup = function () {
	ve.ce.Node.prototype.onSetup.call( this );
	this.$element.addClass( 've-ce-leafNode' );
};

/** */
ve.ce.LeafNode.prototype.onTeardown = function () {
	ve.ce.Node.prototype.onTeardown.call( this );
	this.$element.removeClass( 've-ce-leafNode' );
};

/**
 * Get annotated HTML fragments.
 *
 * @see ve.ce.ContentBranchNode
 *
 * An HTML fragment can be:
 * - a plain text string
 * - a jQuery object
 * - an array with a plain text string or jQuery object at index 0 and a ve.dm.AnnotationSet at index 1,
 *   i.e. ['textstring', ve.dm.AnnotationSet] or [$jQueryObj, ve.dm.AnnotationSet]
 *
 * The default implementation should be fine in most cases. A subclass only needs to override this
 * if the annotations aren't necessarily the same across the entire node (like in ve.ce.TextNode).
 *
 * @method
 * @returns {Array} Array of HTML fragments, i.e.
 *  [ string | jQuery | [string|jQuery, ve.dm.AnnotationSet] ]
 */
ve.ce.LeafNode.prototype.getAnnotatedHtml = function () {
	return [ [ this.$element, this.getModel().getAnnotations() ] ];
};

/*!
 * VisualEditor ContentEditable AlignableNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable Alignable node.
 *
 * @class
 * @abstract
 *
 * @constructor
 */
ve.ce.AlignableNode = function VeCeAlignableNode( $alignable, config ) {
	config = config || {};

	this.$alignable = $alignable || this.$element;

	// Events
	this.connect( this, { setup: 'onAlignableSetup' } );
	this.model.connect( this, { attributeChange: 'onAlignableAttributeChange' } );
};

/* Inheritance */

OO.initClass( ve.ce.AlignableNode );

/* Events */

/**
 * @event align
 * @param {string} align New alignment
 */

/**
 * Handle attribute change events
 *
 * @param {string} key Key
 * @param {string} from Old value
 * @param {string} to New value
 */
ve.ce.AlignableNode.prototype.onAlignableAttributeChange = function ( key, from, to ) {
	var cssClasses;
	if ( key === 'align' ) {
		cssClasses = this.model.constructor.static.cssClasses;
		if ( from && cssClasses[from] ) {
			this.$alignable.removeClass( cssClasses[from] );
		}
		if ( to && cssClasses[to] ) {
			this.$alignable.addClass( cssClasses[to] );
		}
		this.emit( 'align', to );
	}
};

/**
 * Handle node setup
 */
ve.ce.AlignableNode.prototype.onAlignableSetup = function () {
	var align = this.model.getAttribute( 'align' ),
		cssClasses = this.model.constructor.static.cssClasses;
	if ( align && cssClasses[align] ) {
		this.$alignable.addClass( cssClasses[align] );
		this.emit( 'align', align );
	}
};

/*!
 * VisualEditor ContentEditable FocusableNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable focusable node.
 *
 * Focusable elements have a special treatment by ve.ce.Surface. When the user selects only a single
 * node, if it is focusable, the surface will set the focusable node's focused state. Other systems,
 * such as the context, may also use a focusable node's $focusable property as a hint of where the
 * primary element in the node is. Typically, and by default, the primary element is the root
 * element, but in some cases it may need to be configured to be a specific child element within the
 * node's DOM rendering.
 *
 * If your focusable node changes size and the highlight must be redrawn, call redrawHighlights().
 * 'resizeEnd' and 'rerender' are already bound to call this.
 *
 * @class
 * @abstract
 *
 * @constructor
 * @param {jQuery} [$focusable=this.$element] Primary element user is focusing on
 */
ve.ce.FocusableNode = function VeCeFocusableNode( $focusable ) {
	// Properties
	this.focused = false;
	this.highlighted = false;
	this.isSetup = false;
	this.$highlights = this.$( '<div>' ).addClass( 've-ce-focusableNode-highlights' );
	this.$focusable = $focusable || this.$element;
	this.surface = null;
	this.rects = null;
	this.boundingRect = null;
	this.startAndEndRects = null;

	// Events
	this.connect( this, {
		setup: 'onFocusableSetup',
		teardown: 'onFocusableTeardown',
		resizeStart: 'onFocusableResizeStart',
		resizeEnd: 'onFocusableResizeEnd',
		rerender: 'onFocusableRerender'
	} );
};

/* Inheritance */

OO.initClass( ve.ce.FocusableNode );

/* Events */

/**
 * @event focus
 */

/**
 * @event blur
 */

/* Methods */

/**
 * Create a highlight element.
 *
 * @returns {jQuery} A highlight element
 */
ve.ce.FocusableNode.prototype.createHighlight = function () {
	return this.$( '<div>' )
		.addClass( 've-ce-focusableNode-highlight' )
		.prop( {
			title: this.constructor.static.getDescription( this.model ),
			draggable: false
		} )
		.append( this.$( '<img>' )
			.addClass( 've-ce-focusableNode-highlight-relocatable-marker' )
			.attr( 'src', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' )
			.on( {
				dragstart: this.onFocusableDragStart.bind( this ),
				dragend: this.onFocusableDragEnd.bind( this )
			} )
		);
};

/**
 * Handle node setup.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.onFocusableSetup = function () {
	// Exit if already setup or not attached
	if ( this.isSetup || !this.root ) {
		return;
	}

	this.surface = this.getRoot().getSurface();

	// DOM changes
	this.$element
		.addClass( 've-ce-focusableNode' )
		.prop( 'contentEditable', 'false' );

	// Events
	this.$focusable.on( {
		'mouseenter.ve-ce-focusableNode': this.onFocusableMouseEnter.bind( this ),
		'mousedown.ve-ce-focusableNode touchend.ve-ce-focusableNode': this.onFocusableMouseDown.bind( this )
	} );
	// $element is ce=false so make sure nothing happens when you click
	// on it, just in case the browser decides to do something.
	// If $element == $focusable then this can be skipped as $focusable already
	// handles mousedown events.
	if ( !this.$element.is( this.$focusable ) ) {
		this.$element.on( {
			'mousedown.ve-ce-focusableNode': function ( e ) { e.preventDefault(); }
		} );
	}

	this.isSetup = true;
};

/**
 * Handle node teardown.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.onFocusableTeardown = function () {
	// Exit if not setup or not attached
	if ( !this.isSetup || !this.root ) {
		return;
	}

	// Events
	this.$focusable.off( '.ve-ce-focusableNode' );
	this.$element.off( '.ve-ce-focusableNode' );

	// Highlights
	this.clearHighlights();

	// DOM changes
	this.$element
		.removeClass( 've-ce-focusableNode' )
		.removeProp( 'contentEditable' );

	this.isSetup = false;
	this.surface = null;
};

/**
 * Handle highlight mouse down events.
 *
 * @method
 * @param {jQuery.Event} e Mouse down event
 */
ve.ce.FocusableNode.prototype.onFocusableMouseDown = function ( e ) {
	var range,
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection(),
		nodeRange = this.model.getOuterRange();

	if ( !this.isInContentEditable() ) {
		return;
	}
	// Wait for native selection to change before correcting
	setTimeout( function () {
		range = selection instanceof ve.dm.LinearSelection && selection.getRange();
		surfaceModel.getLinearFragment(
			e.shiftKey && range ?
				ve.Range.static.newCoveringRange(
					[ range, nodeRange ], range.from > nodeRange.from
				) :
				nodeRange
		).select();
	} );
};

/**
 * Handle highlight double click events.
 *
 * @method
 * @param {jQuery.Event} e Double click event
 */
ve.ce.FocusableNode.prototype.onFocusableDblClick = function () {
	if ( !this.isInContentEditable() ) {
		return;
	}
	this.executeCommand();
};

/**
 * Execute the command associated with this node.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.executeCommand = function () {
	if ( !this.model.isInspectable() ) {
		return false;
	}
	var command = ve.ui.commandRegistry.getCommandForNode( this );
	if ( command ) {
		command.execute( this.surface.getSurface() );
	}
};

/**
 * Handle element drag start.
 *
 * @method
 * @param {jQuery.Event} e Drag start event
 */
ve.ce.FocusableNode.prototype.onFocusableDragStart = function () {
	if ( this.surface ) {
		// Allow dragging this node in the surface
		this.surface.startRelocation( this );
	}
	this.$highlights.addClass( 've-ce-focusableNode-highlights-relocating' );
};

/**
 * Handle element drag end.
 *
 * If a relocation actually takes place the node is destroyed before this events fires.
 *
 * @method
 * @param {jQuery.Event} e Drag end event
 */
ve.ce.FocusableNode.prototype.onFocusableDragEnd = function () {
	// endRelocation is usually triggered by onDocumentDrop in the surface, but if it isn't
	// trigger it here instead
	if ( this.surface ) {
		this.surface.endRelocation();
	}
	this.$highlights.removeClass( 've-ce-focusableNode-highlights-relocating' );
};

/**
 * Handle mouse enter events.
 *
 * @method
 * @param {jQuery.Event} e Mouse enter event
 */
ve.ce.FocusableNode.prototype.onFocusableMouseEnter = function () {
	if ( !this.root.getSurface().dragging && !this.root.getSurface().resizing && this.isInContentEditable() ) {
		this.createHighlights();
	}
};

/**
 * Handle surface mouse move events.
 *
 * @method
 * @param {jQuery.Event} e Mouse move event
 */
ve.ce.FocusableNode.prototype.onSurfaceMouseMove = function ( e ) {
	var $target = this.$( e.target );
	if (
		!$target.hasClass( 've-ce-focusableNode-highlight' ) &&
		$target.closest( '.ve-ce-focusableNode' ).length === 0
	) {
		this.clearHighlights();
	}
};

/**
 * Handle surface mouse out events.
 *
 * @method
 * @param {jQuery.Event} e Mouse out event
 */
ve.ce.FocusableNode.prototype.onSurfaceMouseOut = function ( e ) {
	if ( e.relatedTarget === null ) {
		this.clearHighlights();
	}
};

/**
 * Handle resize start events.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.onFocusableResizeStart = function () {
	this.clearHighlights();
};

/**
 * Handle resize end event.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.onFocusableResizeEnd = function () {
	this.redrawHighlights();
};

/**
 * Handle rerender event.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.onFocusableRerender = function () {
	if ( this.focused ) {
		this.redrawHighlights();
		// reposition menu
		this.surface.getSurface().getContext().updateDimensions( true );
	}
};

/**
 * Check if node is focused.
 *
 * @method
 * @returns {boolean} Node is focused
 */
ve.ce.FocusableNode.prototype.isFocused = function () {
	return this.focused;
};

/**
 * Set the selected state of the node.
 *
 * @method
 * @param {boolean} value Node is focused
 * @fires focus
 * @fires blur
 */
ve.ce.FocusableNode.prototype.setFocused = function ( value ) {
	value = !!value;
	if ( this.focused !== value ) {
		this.focused = value;
		if ( this.focused ) {
			this.emit( 'focus' );
			this.$element.addClass( 've-ce-focusableNode-focused' );
			this.createHighlights();
			this.surface.appendHighlights( this.$highlights, this.focused );
			this.surface.$element.off( '.ve-ce-focusableNode' );
		} else {
			this.emit( 'blur' );
			this.$element.removeClass( 've-ce-focusableNode-focused' );
			this.clearHighlights();
		}
	}
};

/**
 * Creates highlights.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.createHighlights = function () {
	if ( this.highlighted ) {
		return;
	}

	this.$highlights.on( {
		mousedown: this.onFocusableMouseDown.bind( this ),
		dblclick: this.onFocusableDblClick.bind( this )
	} );

	this.highlighted = true;

	this.positionHighlights();

	this.surface.appendHighlights( this.$highlights, this.focused );

	// Events
	if ( !this.focused ) {
		this.surface.$element.on( {
			'mousemove.ve-ce-focusableNode': this.onSurfaceMouseMove.bind( this ),
			'mouseout.ve-ce-focusableNode': this.onSurfaceMouseOut.bind( this )
		} );
	}
	this.surface.connect( this, { position: 'positionHighlights' } );
};

/**
 * Clears highlight.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.clearHighlights = function () {
	if ( !this.highlighted ) {
		return;
	}
	this.$highlights.remove().empty();
	this.surface.$element.off( '.ve-ce-focusableNode' );
	this.surface.disconnect( this, { position: 'positionHighlights' } );
	this.highlighted = false;
	this.boundingRect = null;
};

/**
 * Redraws highlight.
 *
 * @method
 */
ve.ce.FocusableNode.prototype.redrawHighlights = function () {
	this.clearHighlights();
	this.createHighlights();
};

/**
 * Calculate position of highlights
 */
ve.ce.FocusableNode.prototype.calculateHighlights = function () {
	var i, l,
		rects = [],
		filteredRects = [],
		surfaceOffset = this.surface.getSurface().getBoundingClientRect();

	function contains( rect1, rect2 ) {
		return rect2.left >= rect1.left &&
			rect2.top >= rect1.top &&
			rect2.right <= rect1.right &&
			rect2.bottom <= rect1.bottom;
	}

	this.$focusable.find( '*' ).addBack().each( function () {
		var i, j, il, jl, contained, clientRects;

		if ( $( this ).hasClass( 've-ce-noHighlight' ) ) {
			return;
		}

		clientRects = this.getClientRects();

		for ( i = 0, il = clientRects.length; i < il; i++ ) {
			contained = false;
			for ( j = 0, jl = rects.length; j < jl; j++ ) {
				// This rect is contained by an existing rect, discard
				if ( contains( rects[j], clientRects[i] ) ) {
					contained = true;
					break;
				}
				// An existing rect is contained by this rect, discard the existing rect
				if ( contains( clientRects[i], rects[j] ) ) {
					rects.splice( j, 1 );
					j--;
					jl--;
				}
			}
			if ( !contained ) {
				rects.push( clientRects[i] );
			}
		}
	} );

	// Elements with a width/height of 0 return a clientRect with a width/height of 1
	// As elements with an actual width/height of 1 aren't that useful anyway, just
	// throw away anything that is <=1
	filteredRects = rects.filter( function ( rect ) {
		return rect.width > 1 && rect.height > 1;
	} );
	// But if this filtering doesn't leave any rects at all, then we do want to use the 1px rects
	if ( filteredRects.length > 0 ) {
		rects = filteredRects;
	}

	this.boundingRect = null;
	// startAndEndRects is lazily evaluated in getStartAndEndRects from rects
	this.startAndEndRects = null;

	for ( i = 0, l = rects.length; i < l; i++ ) {
		// Translate to relative
		rects[i] = ve.translateRect( rects[i], -surfaceOffset.left, -surfaceOffset.top );
		this.$highlights.append(
			this.createHighlight().css( {
				top: rects[i].top,
				left: rects[i].left,
				width: rects[i].width,
				height: rects[i].height
			} )
		);

		if ( !this.boundingRect ) {
			this.boundingRect = ve.copy( rects[i] );
		} else {
			this.boundingRect.top = Math.min( this.boundingRect.top, rects[i].top );
			this.boundingRect.left = Math.min( this.boundingRect.left, rects[i].left );
			this.boundingRect.bottom = Math.max( this.boundingRect.bottom, rects[i].bottom );
			this.boundingRect.right = Math.max( this.boundingRect.right, rects[i].right );
		}
	}
	if ( this.boundingRect ) {
		this.boundingRect.width = this.boundingRect.right - this.boundingRect.left;
		this.boundingRect.height = this.boundingRect.bottom - this.boundingRect.top;
	}

	this.rects = rects;
};

/**
 * Positions highlights, and remove collapsed ones
 *
 * @method
 */
ve.ce.FocusableNode.prototype.positionHighlights = function () {
	if ( !this.highlighted ) {
		return;
	}

	var i, l;

	this.calculateHighlights();
	this.$highlights.empty();

	for ( i = 0, l = this.rects.length; i < l; i++ ) {
		this.$highlights.append(
			this.createHighlight().css( {
				top: this.rects[i].top,
				left: this.rects[i].left,
				width: this.rects[i].width,
				height: this.rects[i].height
			} )
		);
	}
};

/**
 * Get list of rectangles outlining the shape of the node relative to the surface
 *
 * @return {Object[]} List of rectangle objects
 */
ve.ce.FocusableNode.prototype.getRects = function () {
	if ( !this.highlighted ) {
		this.calculateHighlights();
	}
	return this.rects;
};

/**
 * Get the bounding rectangle of the focusable node highlight relative to the surface
 *
 * @return {Object|null} Top, left, bottom & right positions of the focusable node relative to the surface
 */
ve.ce.FocusableNode.prototype.getBoundingRect = function () {
	if ( !this.highlighted ) {
		this.calculateHighlights();
	}
	return this.boundingRect;
};

/**
 * Get start and end rectangles of an inline focusable node relative to the surface
 *
 * @return {Object|null} Start and end rectangles
 */
ve.ce.FocusableNode.prototype.getStartAndEndRects = function () {
	if ( !this.highlighted ) {
		this.calculateHighlights();
	}
	if ( !this.startAndEndRects ) {
		this.startAndEndRects = ve.getStartAndEndRects( this.rects );
	}
	return this.startAndEndRects;
};

/*!
 * VisualEditor ContentEditable ResizableNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable resizable node.
 *
 * @class
 * @abstract
 *
 * @constructor
 * @param {jQuery} [$resizable=this.$element] Resizable DOM element
 * @param {Object} [config] Configuration options
 * @param {number|null} [config.snapToGrid=10] Snap to a grid of size X when the shift key is held. Null disables.
 * @param {boolean} [config.outline=false] Resize using an outline of the element only, don't live preview.
 * @param {boolean} [config.showSizeLabel=true] Show a label with the current dimensions while resizing
 * @param {boolean} [config.showScaleLabel=true] Show a label with the current scale while resizing
 */
ve.ce.ResizableNode = function VeCeResizableNode( $resizable, config ) {
	config = config || {};

	// Properties
	this.$resizable = $resizable || this.$element;
	this.resizing = false;
	this.$resizeHandles = this.$( '<div>' );
	this.snapToGrid = config.snapToGrid !== undefined ? config.snapToGrid : 10;
	this.outline = !!config.outline;
	this.showSizeLabel = config.showSizeLabel !== false;
	this.showScaleLabel = config.showScaleLabel !== false;
	// Only gets enabled when the original dimensions are provided
	this.canShowScaleLabel = false;
	if ( this.showSizeLabel || this.showScaleLabel ) {
		this.$sizeText = this.$( '<span>' ).addClass( 've-ce-resizableNode-sizeText' );
		this.$sizeLabel = this.$( '<div>' ).addClass( 've-ce-resizableNode-sizeLabel' ).append( this.$sizeText );
	}
	this.resizableOffset = null;

	// Events
	this.connect( this, {
		focus: 'onResizableFocus',
		blur: 'onResizableBlur',
		teardown: 'onResizableTeardown',
		resizing: 'onResizableResizing',
		resizeEnd: 'onResizableFocus',
		rerender: 'onResizableFocus',
		align: 'onResizableAlign'
	} );
	this.model.connect( this, {
		attributeChange: 'onResizableAttributeChange'
	} );

	// Initialization
	this.$resizeHandles
		.addClass( 've-ce-resizableNode-handles' )
		.append( this.$( '<div>' )
			.addClass( 've-ce-resizableNode-nwHandle' )
			.data( 'handle', 'nw' ) )
		.append( this.$( '<div>' )
			.addClass( 've-ce-resizableNode-neHandle' )
			.data( 'handle', 'ne' ) )
		.append( this.$( '<div>' )
			.addClass( 've-ce-resizableNode-seHandle' )
			.data( 'handle', 'se' ) )
		.append( this.$( '<div>' )
			.addClass( 've-ce-resizableNode-swHandle' )
			.data( 'handle', 'sw' ) );
};

/* Inheritance */

OO.initClass( ve.ce.ResizableNode );

/* Events */

/**
 * @event resizeStart
 */

/**
 * @event resizing
 * @param {Object} dimensions Dimension object containing width & height
 */

/**
 * @event resizeEnd
 */

/* Methods */

/**
 * Get and cache the relative offset of the $resizable node
 *
 * @returns {Object} Position coordinates, containing top & left
 */
ve.ce.ResizableNode.prototype.getResizableOffset = function () {
	if ( !this.resizableOffset ) {
		this.resizableOffset = OO.ui.Element.static.getRelativePosition(
			this.$resizable, this.getRoot().getSurface().getSurface().$element
		);
	}
	return this.resizableOffset;
};

/** */
ve.ce.ResizableNode.prototype.setOriginalDimensions = function ( dimensions ) {
	var scalable = this.model.getScalable();

	scalable.setOriginalDimensions( dimensions );

	// If dimensions are valid and the scale label is desired, enable it
	this.canShowScaleLabel = this.showScaleLabel &&
		scalable.getOriginalDimensions().width &&
		scalable.getOriginalDimensions().height;
};

/**
 * Hide the size label
 */
ve.ce.ResizableNode.prototype.hideSizeLabel = function () {
	var node = this;
	// Defer the removal of this class otherwise other DOM changes may cause
	// the opacity transition to not play out smoothly
	setTimeout( function () {
		node.$sizeLabel.removeClass( 've-ce-resizableNode-sizeLabel-resizing' );
	} );
	// Actually hide the size label after it's done animating
	setTimeout( function () {
		node.$sizeLabel.addClass( 'oo-ui-element-hidden' );
	}, 200 );
};

/**
 * Update the contents and position of the size label
 */
ve.ce.ResizableNode.prototype.updateSizeLabel = function () {
	if ( !this.showSizeLabel && !this.canShowScaleLabel ) {
		return;
	}

	var top, height,
		scalable = this.model.getScalable(),
		dimensions = scalable.getCurrentDimensions(),
		offset = this.getResizableOffset(),
		minWidth = ( this.showSizeLabel ? 100 : 0 ) + ( this.showScaleLabel ? 30 : 0 );

	// Put the label on the outside when too narrow
	if ( dimensions.width < minWidth ) {
		top = offset.top + dimensions.height;
		height = 30;
	} else {
		top = offset.top;
		height = dimensions.height;
	}
	this.$sizeLabel
		.removeClass( 'oo-ui-element-hidden' )
		.addClass( 've-ce-resizableNode-sizeLabel-resizing' )
		.css( {
			top: top,
			left: offset.left,
			width: dimensions.width,
			height: height,
			lineHeight: height + 'px'
		} );
	this.$sizeText.empty();
	if ( this.showSizeLabel ) {
		this.$sizeText.append( this.$( '<span>' )
			.addClass( 've-ce-resizableNode-sizeText-size' )
			.text( Math.round( dimensions.width ) + ' × ' + Math.round( dimensions.height ) )
		);
	}
	if ( this.canShowScaleLabel ) {
		this.$sizeText.append( this.$( '<span>' )
			.addClass( 've-ce-resizableNode-sizeText-scale' )
			.text( Math.round( 100 * scalable.getCurrentScale() ) + '%' )
		);
	}
	this.$sizeText.toggleClass( 've-ce-resizableNode-sizeText-warning', scalable.isTooSmall() || scalable.isTooLarge() );
};

/**
 * Show specific resize handles
 *
 * @param {string[]} [handles] List of handles to show: 'nw', 'ne', 'sw', 'se'. Show all if undefined.
 */
ve.ce.ResizableNode.prototype.showHandles = function ( handles ) {
	var i, len,
		add = [],
		remove = [],
		allDirections = [ 'nw', 'ne', 'sw', 'se' ];

	for ( i = 0, len = allDirections.length; i < len; i++ ) {
		if ( handles === undefined || handles.indexOf( allDirections[i] ) !== -1 ) {
			remove.push( 've-ce-resizableNode-hide-' + allDirections[i] );
		} else {
			add.push( 've-ce-resizableNode-hide-' + allDirections[i] );
		}
	}

	this.$resizeHandles
		.addClass( add.join( ' ' ) )
		.removeClass( remove.join( ' ' ) );
};

/**
 * Handle node focus.
 *
 * @method
 */
ve.ce.ResizableNode.prototype.onResizableFocus = function () {
	var surface = this.getRoot().getSurface();

	this.$resizeHandles.appendTo( surface.getSurface().$controls );
	if ( this.$sizeLabel ) {
		this.$sizeLabel.appendTo( surface.getSurface().$controls );
	}

	// Call getScalable to pre-fetch the extended data
	this.model.getScalable();

	this.setResizableHandlesSizeAndPosition();

	this.$resizeHandles
		.find( '.ve-ce-resizableNode-neHandle' )
			.css( { marginRight: -this.$resizable.width() } )
			.end()
		.find( '.ve-ce-resizableNode-swHandle' )
			.css( { marginBottom: -this.$resizable.height() } )
			.end()
		.find( '.ve-ce-resizableNode-seHandle' )
			.css( {
				marginRight: -this.$resizable.width(),
				marginBottom: -this.$resizable.height()
			} );

	this.$resizeHandles.children()
		.off( '.ve-ce-resizableNode' )
		.on(
			'mousedown.ve-ce-resizableNode',
			this.onResizeHandlesCornerMouseDown.bind( this )
		);

	surface.connect( this, { position: 'setResizableHandlesSizeAndPosition' } );

};

/**
 * Handle node blur.
 *
 * @method
 */
ve.ce.ResizableNode.prototype.onResizableBlur = function () {
	// Node may have already been torn down, e.g. after delete
	if ( !this.getRoot() ) {
		return;
	}

	var surface = this.getRoot().getSurface();

	this.$resizeHandles.detach();
	if ( this.$sizeLabel ) {
		this.$sizeLabel.detach();
	}

	surface.disconnect( this, { position: 'setResizableHandlesSizeAndPosition' } );

};

/**
 * Respond to AlignableNodes changing their alignment by hiding useless resize handles.
 *
 * @param {string} align Alignment
 */
ve.ce.ResizableNode.prototype.onResizableAlign = function ( align ) {
	switch ( align ) {
		case 'right':
			this.showHandles( ['sw'] );
			break;
		case 'left':
			this.showHandles( ['se'] );
			break;
		case 'center':
			this.showHandles( ['sw', 'se'] );
			break;
		default:
			this.showHandles();
			break;
	}
};

/**
 * Handle teardown event.
 *
 * @method
 */
ve.ce.ResizableNode.prototype.onResizableTeardown = function () {
	this.onResizableBlur();
};

/**
 * Handle resizing event.
 *
 * @method
 * @param {Object} dimensions Dimension object containing width & height
 */
ve.ce.ResizableNode.prototype.onResizableResizing = function ( dimensions ) {
	// Clear cached resizable offset position as it may have changed
	this.resizableOffset = null;
	this.model.getScalable().setCurrentDimensions( dimensions );
	if ( !this.outline ) {
		this.$resizable.css( this.model.getScalable().getCurrentDimensions() );
		this.setResizableHandlesPosition();
	}
	this.updateSizeLabel();
};

/**
 * Handle attribute change events from the model.
 *
 * @method
 * @param {string} key Attribute key
 * @param {string} from Old value
 * @param {string} to New value
 */
ve.ce.ResizableNode.prototype.onResizableAttributeChange = function ( key, from, to ) {
	if ( key === 'width' || key === 'height' ) {
		this.$resizable.css( key, to );
	}
};

/**
 * Handle bounding box handle mousedown.
 *
 * @method
 * @param {jQuery.Event} e Click event
 * @fires resizeStart
 */
ve.ce.ResizableNode.prototype.onResizeHandlesCornerMouseDown = function ( e ) {
	// Hide context menu
	// TODO: Maybe there's a more generic way to handle this sort of thing? For relocation it's
	// handled in ve.ce.Surface
	this.root.getSurface().getSurface().getContext().toggle( false );

	// Set bounding box width and undo the handle margins
	this.$resizeHandles
		.addClass( 've-ce-resizableNode-handles-resizing' )
		.css( {
			width: this.$resizable.width(),
			height: this.$resizable.height()
		} );

	this.$resizeHandles.children().css( 'margin', 0 );

	// Values to calculate adjusted bounding box size
	this.resizeInfo = {
		mouseX: e.screenX,
		mouseY: e.screenY,
		top: this.$resizeHandles.position().top,
		left: this.$resizeHandles.position().left,
		height: this.$resizeHandles.height(),
		width: this.$resizeHandles.width(),
		handle: $( e.target ).data( 'handle' )
	};

	// Bind resize events
	this.resizing = true;
	this.root.getSurface().resizing = true;

	this.model.getScalable().setCurrentDimensions( {
		width: this.resizeInfo.width,
		height: this.resizeInfo.height
	} );
	this.updateSizeLabel();
	this.$( this.getElementDocument() ).on( {
		'mousemove.ve-ce-resizableNode': this.onDocumentMouseMove.bind( this ),
		'mouseup.ve-ce-resizableNode': this.onDocumentMouseUp.bind( this )
	} );
	this.emit( 'resizeStart' );

	return false;
};

/**
 * Set the proper size and position for resize handles
 *
 * @method
 */
ve.ce.ResizableNode.prototype.setResizableHandlesSizeAndPosition = function () {
	var width = this.$resizable.width(),
		height = this.$resizable.height();

	// Clear cached resizable offset position as it may have changed
	this.resizableOffset = null;

	this.setResizableHandlesPosition();

	this.$resizeHandles
		.css( {
			width: 0,
			height: 0
		} )
		.find( '.ve-ce-resizableNode-neHandle' )
			.css( { marginRight: -width } )
			.end()
		.find( '.ve-ce-resizableNode-swHandle' )
			.css( { marginBottom: -height } )
			.end()
		.find( '.ve-ce-resizableNode-seHandle' )
			.css( {
				marginRight: -width,
				marginBottom: -height
			} );
};

/**
 * Set the proper position for resize handles
 *
 * @method
 */
ve.ce.ResizableNode.prototype.setResizableHandlesPosition = function () {
	var offset = this.getResizableOffset();

	this.$resizeHandles.css( {
		top: offset.top,
		left: offset.left
	} );
};

/**
 * Handle body mousemove.
 *
 * @method
 * @param {jQuery.Event} e Click event
 * @fires resizing
 */
ve.ce.ResizableNode.prototype.onDocumentMouseMove = function ( e ) {
	var diff = {},
		dimensions = {
			width: 0,
			height: 0,
			top: this.resizeInfo.top,
			left: this.resizeInfo.left
		};

	if ( this.resizing ) {
		// X and Y diff
		switch ( this.resizeInfo.handle ) {
			case 'se':
				diff.x = e.screenX - this.resizeInfo.mouseX;
				diff.y = e.screenY - this.resizeInfo.mouseY;
				break;
			case 'nw':
				diff.x = this.resizeInfo.mouseX - e.screenX;
				diff.y = this.resizeInfo.mouseY - e.screenY;
				break;
			case 'ne':
				diff.x = e.screenX - this.resizeInfo.mouseX;
				diff.y = this.resizeInfo.mouseY - e.screenY;
				break;
			case 'sw':
				diff.x = this.resizeInfo.mouseX - e.screenX;
				diff.y = e.screenY - this.resizeInfo.mouseY;
				break;
		}

		dimensions = this.model.getScalable().getBoundedDimensions( {
			width: this.resizeInfo.width + diff.x,
			height: this.resizeInfo.height + diff.y
		}, e.shiftKey && this.snapToGrid );

		// Fix the position
		switch ( this.resizeInfo.handle ) {
			case 'ne':
				dimensions.top = this.resizeInfo.top +
					( this.resizeInfo.height - dimensions.height );
				break;
			case 'sw':
				dimensions.left = this.resizeInfo.left +
					( this.resizeInfo.width - dimensions.width );
				break;
			case 'nw':
				dimensions.top = this.resizeInfo.top +
					( this.resizeInfo.height - dimensions.height );
				dimensions.left = this.resizeInfo.left +
					( this.resizeInfo.width - dimensions.width );
				break;
		}

		// Update bounding box
		this.$resizeHandles.css( dimensions );
		this.emit( 'resizing', {
			width: dimensions.width,
			height: dimensions.height
		} );
	}
};

/**
 * Handle body mouseup.
 *
 * @method
 * @fires resizeEnd
 */
ve.ce.ResizableNode.prototype.onDocumentMouseUp = function () {
	var attrChanges,
		offset = this.model.getOffset(),
		width = this.$resizeHandles.outerWidth(),
		height = this.$resizeHandles.outerHeight(),
		surfaceModel = this.getRoot().getSurface().getModel(),
		documentModel = surfaceModel.getDocument(),
		selection = surfaceModel.getSelection();

	this.$resizeHandles.removeClass( 've-ce-resizableNode-handles-resizing' );
	this.$( this.getElementDocument() ).off( '.ve-ce-resizableNode' );
	this.resizing = false;
	this.root.getSurface().resizing = false;
	this.hideSizeLabel();

	// Apply changes to the model
	attrChanges = this.getAttributeChanges( width, height );
	if ( !ve.isEmptyObject( attrChanges ) ) {
		surfaceModel.change(
			ve.dm.Transaction.newFromAttributeChanges( documentModel, offset, attrChanges ),
			selection
		);
	}

	// Update the context menu. This usually happens with the redraw, but not if the
	// user doesn't perform a drag
	this.root.getSurface().getSurface().getContext().updateDimensions();

	this.emit( 'resizeEnd' );
};

/**
 * Generate an object of attributes changes from the new width and height.
 *
 * @param {number} width New image width
 * @param {number} height New image height
 * @returns {Object} Attribute changes
 */
ve.ce.ResizableNode.prototype.getAttributeChanges = function ( width, height ) {
	var attrChanges = {};
	if ( this.model.getAttribute( 'width' ) !== width ) {
		attrChanges.width = width;
	}
	if ( this.model.getAttribute( 'height' ) !== height ) {
		attrChanges.height = height;
	}
	return attrChanges;
};

/*!
 * VisualEditor ContentEditable Surface class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable surface.
 *
 * @class
 * @extends OO.ui.Element
 * @mixins OO.EventEmitter
 *
 * @constructor
 * @param {jQuery} $container
 * @param {ve.dm.Surface} model Surface model to observe
 * @param {ve.ui.Surface} ui Surface user interface
 * @param {Object} [config] Configuration options
 */
ve.ce.Surface = function VeCeSurface( model, ui, options ) {
	var surface = this;

	// Parent constructor
	OO.ui.Element.call( this, options );

	// Mixin constructors
	OO.EventEmitter.call( this );

	// Properties
	this.surface = ui;
	this.model = model;
	this.documentView = new ve.ce.Document( model.getDocument(), this );
	this.surfaceObserver = new ve.ce.SurfaceObserver( this );
	this.selectionTimeout = null;
	this.$window = this.$( this.getElementWindow() );
	this.$document = this.$( this.getElementDocument() );
	this.$documentNode = this.getDocument().getDocumentNode().$element;
	// Window.getSelection returns a live singleton representing the document's selection
	this.nativeSelection = this.getElementWindow().getSelection();
	this.eventSequencer = new ve.EventSequencer( [
		'keydown', 'keypress', 'keyup',
		'compositionstart', 'compositionend',
		'input'
	] );
	this.clipboard = [];
	this.clipboardId = String( Math.random() );
	this.renderLocks = 0;
	this.dragging = false;
	this.relocatingNode = false;
	this.selecting = false;
	this.resizing = false;
	this.focused = false;
	this.deactivated = false;
	this.$deactivatedSelection = this.$( '<div>' );
	this.activeTableNode = null;
	this.contentBranchNodeChanged = false;
	this.$highlightsFocused = this.$( '<div>' );
	this.$highlightsBlurred = this.$( '<div>' );
	this.$highlights = this.$( '<div>' ).append(
		this.$highlightsFocused, this.$highlightsBlurred
	);
	this.$findResults = this.$( '<div>' );
	this.$dropMarker = this.$( '<div>' ).addClass( 've-ce-focusableNode-dropMarker' );
	this.$lastDropTarget = null;
	this.lastDropPosition = null;
	this.$pasteTarget = this.$( '<div>' );
	this.pasting = false;
	this.copying = false;
	this.pasteSpecial = false;
	this.focusedNode = null;
	// This is set on entering changeModel, then unset when leaving.
	// It is used to test whether a reflected change event is emitted.
	this.newModelSelection = null;
	// These are set during cursor moves (but not text additions/deletions at the cursor)
	this.cursorEvent = null;
	// A frozen selection from the start of a cursor keydown. The nodes are live and mutable,
	// and therefore the offsets may come to point to places that are misleadingly different
	// from when the selection was saved.
	this.misleadingCursorStartSelection = null;
	this.cursorDirectionality = null;
	this.unicorningNode = null;
	this.setUnicorningRecursionGuard = false;

	this.hasSelectionChangeEvents = 'onselectionchange' in this.getElementDocument();

	// Events
	this.surfaceObserver.connect( this, {
		contentChange: 'onSurfaceObserverContentChange',
		rangeChange: 'onSurfaceObserverRangeChange',
		branchNodeChange: 'onSurfaceObserverBranchNodeChange',
		slugEnter: 'onSurfaceObserverSlugEnter'
	} );
	this.model.connect( this, {
		select: 'onModelSelect',
		documentUpdate: 'onModelDocumentUpdate',
		insertionAnnotationsChange: 'onInsertionAnnotationsChange'
	} );

	this.onDocumentMouseUpHandler = this.onDocumentMouseUp.bind( this );
	this.$documentNode.on( {
		// mouse events shouldn't be sequenced as the event sequencer
		// is detached on blur
		mousedown: this.onDocumentMouseDown.bind( this ),
		// mouseup is bound to the whole document on mousedown
		mousemove: this.onDocumentMouseMove.bind( this ),
		cut: this.onCut.bind( this ),
		copy: this.onCopy.bind( this )
	} );

	this.onWindowResizeHandler = this.onWindowResize.bind( this );
	this.$window.on( 'resize', this.onWindowResizeHandler );

	this.onDocumentFocusInOutHandler = this.onDocumentFocusInOut.bind( this );
	this.$document.on( 'focusin focusout', this.onDocumentFocusInOutHandler );
	// It is possible for a mousedown to clear the selection
	// without triggering a focus change event (e.g. if the
	// document has been programmatically blurred) so trigger
	// a focus change to check if we still have a selection
	this.debounceFocusChange = ve.debounce( this.onFocusChange ).bind( this );
	this.$document.on( 'mousedown', this.debounceFocusChange );

	this.$pasteTarget.on( {
		cut: this.onCut.bind( this ),
		copy: this.onCopy.bind( this ),
		paste: this.onPaste.bind( this )
	} );

	this.$documentNode
		// Bug 65714: MSIE possibly needs `beforepaste` to also be bound; to test.
		.on( 'paste', this.onPaste.bind( this ) )
		.on( 'focus', 'a', function () {
			// Opera <= 12 triggers 'blur' on document node before any link is
			// focused and we don't want that
			surface.$documentNode[0].focus();
		} );

	if ( this.hasSelectionChangeEvents ) {
		this.$document.on( 'selectionchange', this.onDocumentSelectionChange.bind( this ) );
	} else {
		this.$documentNode.on( 'mousemove', this.onDocumentSelectionChange.bind( this ) );
	}

	this.$element.on( {
		dragstart: this.onDocumentDragStart.bind( this ),
		dragover: this.onDocumentDragOver.bind( this ),
		drop: this.onDocumentDrop.bind( this )
	} );

	// Add listeners to the eventSequencer. They won't get called until
	// eventSequencer.attach(node) has been called.
	this.eventSequencer.on( {
		keydown: this.onDocumentKeyDown.bind( this ),
		keyup: this.onDocumentKeyUp.bind( this ),
		keypress: this.onDocumentKeyPress.bind( this ),
		input: this.onDocumentInput.bind( this )
	} ).after( {
		keydown: this.afterDocumentKeyDown.bind( this )
	} );

	// Initialization
	this.$element.addClass( 've-ce-surface' );
	this.$highlights.addClass( 've-ce-surface-highlights' );
	this.$highlightsFocused.addClass( 've-ce-surface-highlights-focused' );
	this.$highlightsBlurred.addClass( 've-ce-surface-highlights-blurred' );
	this.$deactivatedSelection.addClass( 've-ce-surface-deactivatedSelection' );
	this.$pasteTarget
		.addClass( 've-ce-surface-paste' )
		.prop( {
			tabIndex: -1,
			contentEditable: 'true'
		} );

	// Add elements to the DOM
	this.$element.append( this.$documentNode, this.$pasteTarget );
	this.surface.$blockers.append( this.$highlights );
	this.surface.$selections.append( this.$deactivatedSelection );
};

/* Inheritance */

OO.inheritClass( ve.ce.Surface, OO.ui.Element );

OO.mixinClass( ve.ce.Surface, OO.EventEmitter );

/* Events */

/**
 * @event selectionStart
 */

/**
 * @event selectionEnd
 */

/**
 * @event relocationStart
 */

/**
 * @event relocationEnd
 */

/**
 * When the surface changes its position (only if it happens
 * after initialize has already been called).
 *
 * @event position
 */

/**
 * @event focus
 * Note that it's possible for a focus event to occur immediately after a blur event, if the focus
 * moves to or from a FocusableNode. In this case the surface doesn't lose focus conceptually, but
 * a pair of blur-focus events is emitted anyway.
 */

/**
 * @event blur
 * Note that it's possible for a focus event to occur immediately after a blur event, if the focus
 * moves to or from a FocusableNode. In this case the surface doesn't lose focus conceptually, but
 * a pair of blur-focus events is emitted anyway.
 */

/* Static properties */

/**
 * Attributes considered 'unsafe' for copy/paste
 *
 * These attributes may be dropped by the browser during copy/paste, so
 * any element containing these attributes will have them JSON encoded into
 * data-ve-attributes on copy.
 *
 * @type {string[]}
 */
ve.ce.Surface.static.unsafeAttributes = [
	// RDFa: Firefox ignores these
	'about',
	'content',
	'datatype',
	'property',
	'rel',
	'resource',
	'rev',
	'typeof',
	// CSS: Values are often added or modified
	'style'
];

/* Static methods */

/**
 * When pasting, browsers normalize HTML to varying degrees.
 * This hash creates a comparable string for validating clipboard contents.
 *
 * @param {Node[]} nodes Clipboard HTML nodes
 * @returns {string} Hash
 */
ve.ce.Surface.static.getClipboardHash = function ( nodes ) {
	var i, l, node, hash = '';
	// Collect text contents, or just node name for content-less nodes.
	for ( i = 0, l = nodes.length; i < l; i++ ) {
		node = nodes[i];
		// Only use node types which are know to copy (e.g. not comment nodes)
		if ( node.nodeType === Node.TEXT_NODE ) {
			hash += node.textContent;
		} else if ( node.nodeType === Node.ELEMENT_NODE ) {
			hash += '<' + node.nodeName + '>' + this.getClipboardHash( node.childNodes );
		}
	}
	// Whitespace may be added/removed, so strip it all
	return hash.replace( /\s/gm, '' );
};

/* Methods */

/**
 * Destroy the surface, removing all DOM elements.
 *
 * @method
 */
ve.ce.Surface.prototype.destroy = function () {
	var documentNode = this.documentView.getDocumentNode();

	// Detach observer and event sequencer
	this.surfaceObserver.detach();
	this.eventSequencer.detach();

	// Make document node not live
	documentNode.setLive( false );

	// Disconnect events
	this.surfaceObserver.disconnect( this );
	this.model.disconnect( this );

	// Disconnect DOM events on the document
	this.$document.off( 'focusin focusout', this.onDocumentFocusInOutHandler );
	this.$document.off( 'mousedown', this.documentFocusChangeHandler );

	// Disconnect DOM events on the window
	this.$window.off( 'resize', this.onWindowResizeHandler );

	// HACK: Blur to make selection/cursor disappear (needed in Firefox
	// in some cases, and in iOS to hide the keyboard)
	this.$documentNode[0].blur();

	// Remove DOM elements (also disconnects their events)
	this.$element.remove();
	this.$highlights.remove();
};

/**
 * Get linear model offset from absolute coords
 *
 * @param {number} x X offset
 * @param {number} y Y offset
 * @return {number} Linear model offset, or -1 if coordinates are out of bounds
 */
ve.ce.Surface.prototype.getOffsetFromCoords = function ( x, y ) {
	var offset, caretPosition, range, textRange, $marker,
		doc = this.getElementDocument();

	try {
		if ( doc.caretPositionFromPoint ) {
			// Gecko
			// http://dev.w3.org/csswg/cssom-view/#extensions-to-the-document-interface
			caretPosition = document.caretPositionFromPoint( x, y );
			offset = ve.ce.getOffset( caretPosition.offsetNode, caretPosition.offset );
		} else if ( doc.caretRangeFromPoint ) {
			// Webkit
			// http://www.w3.org/TR/2009/WD-cssom-view-20090804/
			range = document.caretRangeFromPoint( x, y );
			offset = ve.ce.getOffset( range.startContainer, range.startOffset );
		} else if ( document.body.createTextRange ) {
			// Trident
			// http://msdn.microsoft.com/en-gb/library/ie/ms536632(v=vs.85).aspx
			textRange = document.body.createTextRange();
			textRange.moveToPoint( x, y );
			textRange.pasteHTML( '<span class="ve-ce-textRange-drop-marker">&nbsp;</span>' );
			$marker = this.$( '.ve-ce-textRange-drop-marker' );
			offset = ve.ce.getOffset( $marker.get( 0 ), 0 );
			$marker.remove();
		}
		return offset;
	} catch ( e ) {
		// Both ve.ce.getOffset and TextRange.moveToPoint can throw out of bounds exceptions
		return -1;
	}
};

/**
 * Get a client rect from the range's end node
 *
 * This function is used internally by getSelectionRects and
 * getSelectionBoundingRect as a fallback when Range.getClientRects
 * fails. The width is hard-coded to 0 as the function is used to
 * locate the selection focus position.
 *
 * @private
 * @param {Range} range Range to get client rect for
 * @return {Object} ClientRect-like object
 */
ve.ce.Surface.prototype.getNodeClientRectFromRange = function ( range ) {
	var rect, side, x, adjacentNode, unicornRect,
		node = range.endContainer;

	while ( node && node.nodeType !== Node.ELEMENT_NODE ) {
		node = node.parentNode;
	}

	if ( !node ) {
		return null;
	}

	// When possible, pretend the cursor is the left/right border of the node
	// (depending on directionality) as a fallback.

	// We would use getBoundingClientRect(), but in iOS7 that's relative to the
	// document rather than to the viewport
	rect = node.getClientRects()[0];
	if ( !rect ) {
		// FF can return null when focusNode is invisible
		return null;
	}

	side = this.getModel().getDocument().getDir() === 'rtl' ? 'right' : 'left';
	adjacentNode = range.endContainer.childNodes[ range.endOffset ];
	if ( range.collapsed && $( adjacentNode ).hasClass( 've-ce-unicorn' ) ) {
		// We're next to a unicorn; use its left/right position
		unicornRect = adjacentNode.getClientRects()[0];
		if ( !unicornRect ) {
			return null;
		}
		x = unicornRect[ side ];
	} else {
		x = rect[ side ];
	}

	return {
		top: rect.top,
		bottom: rect.bottom,
		left: x,
		right: x,
		width: 0,
		height: rect.height
	};
};

/**
 * Get the rectangles of the selection relative to the surface.
 *
 * @method
 * @param {ve.dm.Selection} [selection] Optional selection to get the rectangles for, defaults to current selection
 * @returns {Object[]|null} Selection rectangles
 */
ve.ce.Surface.prototype.getSelectionRects = function ( selection ) {
	var i, l, range, nativeRange, surfaceRect, focusedNode, rect,
		rects = [],
		relativeRects = [];

	selection = selection || this.getModel().getSelection();
	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return null;
	}

	range = selection.getRange();
	focusedNode = this.getFocusedNode( range );

	if ( focusedNode ) {
		return focusedNode.getRects();
	}

	nativeRange = this.getNativeRange( range );
	if ( !nativeRange ) {
		return null;
	}

	// Calling getClientRects sometimes fails:
	// * in Firefox on page load when the address bar is still focused
	// * in empty paragraphs
	try {
		rects = RangeFix.getClientRects( nativeRange );
		if ( !rects.length ) {
			throw new Error( 'getClientRects returned empty list' );
		}
	} catch ( e ) {
		rect = this.getNodeClientRectFromRange( nativeRange );
		if ( rect ) {
			rects = [ rect ];
		}
	}

	surfaceRect = this.getSurface().getBoundingClientRect();
	if ( !rects || !surfaceRect ) {
		return null;
	}

	for ( i = 0, l = rects.length; i < l; i++ ) {
		relativeRects.push( ve.translateRect( rects[i], -surfaceRect.left, -surfaceRect.top ) );
	}
	return relativeRects;
};

/**
 * Get the start and end rectangles of the selection relative to the surface.
 *
 * @method
 * @param {ve.dm.Selection} [selection] Optional selection to get the rectangles for, defaults to current selection
 * @returns {Object|null} Start and end selection rectangles
 */
ve.ce.Surface.prototype.getSelectionStartAndEndRects = function ( selection ) {
	var range, focusedNode;

	selection = selection || this.getModel().getSelection();
	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return null;
	}

	range = selection.getRange();
	focusedNode = this.getFocusedNode( range );

	if ( focusedNode ) {
		return focusedNode.getStartAndEndRects();
	}

	return ve.getStartAndEndRects( this.getSelectionRects() );
};

/**
 * Get the coordinates of the selection's bounding rectangle relative to the surface.
 *
 * Returned coordinates are relative to the surface.
 *
 * @method
 * @param {ve.dm.Selection} [selection] Optional selection to get the rectangles for, defaults to current selection
 * @returns {Object|null} Selection rectangle, with keys top, bottom, left, right, width, height
 */
ve.ce.Surface.prototype.getSelectionBoundingRect = function ( selection ) {
	var range, nativeRange, boundingRect, surfaceRect, focusedNode;

	selection = selection || this.getModel().getSelection();
	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return null;
	}

	range = selection.getRange();
	focusedNode = this.getFocusedNode( range );

	if ( focusedNode ) {
		return focusedNode.getBoundingRect();
	}

	nativeRange = this.getNativeRange( range );
	if ( !nativeRange ) {
		return null;
	}

	try {
		boundingRect = RangeFix.getBoundingClientRect( nativeRange );
		if ( !boundingRect ) {
			throw new Error( 'getBoundingClientRect returned null' );
		}
	} catch ( e ) {
		boundingRect = this.getNodeClientRectFromRange( nativeRange );
	}

	surfaceRect = this.getSurface().getBoundingClientRect();
	if ( !boundingRect || !surfaceRect ) {
		return null;
	}
	return ve.translateRect( boundingRect, -surfaceRect.left, -surfaceRect.top );
};

/*! Initialization */

/**
 * Initialize surface.
 *
 * This should be called after the surface has been attached to the DOM.
 *
 * @method
 */
ve.ce.Surface.prototype.initialize = function () {
	this.documentView.getDocumentNode().setLive( true );
	// Turn off native object editing. This must be tried after the surface has been added to DOM.
	try {
		this.$document[0].execCommand( 'enableObjectResizing', false, false );
		this.$document[0].execCommand( 'enableInlineTableEditing', false, false );
	} catch ( e ) { /* Silently ignore */ }
};

/**
 * Enable editing.
 *
 * @method
 */
ve.ce.Surface.prototype.enable = function () {
	this.documentView.getDocumentNode().enable();
};

/**
 * Disable editing.
 *
 * @method
 */
ve.ce.Surface.prototype.disable = function () {
	this.documentView.getDocumentNode().disable();
};

/**
 * Give focus to the surface, reapplying the model selection, or selecting the first content offset
 * if the model selection is null.
 *
 * This is used when switching between surfaces, e.g. when closing a dialog window. Calling this
 * function will also reapply the selection, even if the surface is already focused.
 */
ve.ce.Surface.prototype.focus = function () {
	var node,
		surface = this,
		selection = this.getModel().getSelection();

	// Focus the documentNode for text selections, or the pasteTarget for focusedNode selections
	if ( this.focusedNode || selection instanceof ve.dm.TableSelection ) {
		this.$pasteTarget[0].focus();
	} else if ( selection instanceof ve.dm.LinearSelection ) {
		node = this.getDocument().getNodeAndOffset( selection.getRange().start ).node;
		$( node ).closest( '[contenteditable=true]' )[0].focus();
	} else if ( selection instanceof ve.dm.NullSelection ) {
		this.getModel().selectFirstContentOffset();
		return;
	}

	// If we are calling focus after replacing a node the selection may be gone
	// but onDocumentFocus won't fire so restore the selection here too.
	this.onModelSelect();
	setTimeout( function () {
		// In some browsers (e.g. Chrome) giving the document node focus doesn't
		// necessarily give you a selection (e.g. if the first child is a <figure>)
		// so if the surface isn't 'focused' (has no selection) give it a selection
		// manually
		// TODO: rename isFocused and other methods to something which reflects
		// the fact they actually mean "has a native selection"
		if ( !surface.isFocused() ) {
			surface.getModel().selectFirstContentOffset();
		}
	} );
	// onDocumentFocus takes care of the rest
};

/**
 * Handler for focusin and focusout events. Filters events and debounces to #onFocusChange.
 * @param {jQuery.Event} e focusin/out event
 */
ve.ce.Surface.prototype.onDocumentFocusInOut = function ( e ) {
	// Filter out focusin/out events on iframes
	// IE11 emits these when the focus moves into/out of an iframed document,
	// but these events are misleading because the focus in this document didn't
	// actually move.
	if ( e.target.nodeName.toLowerCase() === 'iframe' ) {
		return;
	}
	this.debounceFocusChange();
};

/**
 * Handle global focus change.
 */
ve.ce.Surface.prototype.onFocusChange = function () {
	var hasFocus = false;

	hasFocus = OO.ui.contains(
		[
			this.$documentNode[0],
			this.$pasteTarget[0]
		],
		this.nativeSelection.anchorNode,
		true
	);

	if ( this.deactivated ) {
		if ( OO.ui.contains( this.$documentNode[0], this.nativeSelection.anchorNode, true ) ) {
			this.onDocumentFocus();
		}
	} else {
		if ( hasFocus && !this.isFocused() ) {
			this.onDocumentFocus();
		}
		if ( !hasFocus && this.isFocused() ) {
			this.onDocumentBlur();
		}
	}
};

/**
 * Deactivate the surface, stopping the surface observer and replacing the native
 * range with a fake rendered one.
 *
 * Used by dialogs so they can take focus without losing the original document selection.
 */
ve.ce.Surface.prototype.deactivate = function () {
	if ( !this.deactivated ) {
		// Disable the surface observer, there can be no observeable changes
		// until the surface is activated
		this.surfaceObserver.disable();
		this.deactivated = true;
		// Remove ranges so the user can't accidentally type into the document
		this.nativeSelection.removeAllRanges();
		this.updateDeactivatedSelection();
	}
};

/**
 * Reactivate the surface and restore the native selection
 */
ve.ce.Surface.prototype.activate = function () {
	if ( this.deactivated ) {
		this.deactivated = false;
		this.updateDeactivatedSelection();
		this.surfaceObserver.enable();
		if ( OO.ui.contains( this.$documentNode[0], this.nativeSelection.anchorNode, true ) ) {
			// The selection has been placed back in the document, either by the user clicking
			// or by the closing window updating the model. Poll in case it was the user clicking.
			this.surfaceObserver.pollOnce();
		} else {
			// Clear focused node so onModelSelect re-selects it if necessary
			this.focusedNode = null;
			this.onModelSelect();
		}
	}
};

/**
 * Update the fake selection while the surface is deactivated.
 *
 * While the surface is deactivated, all calls to showSelection will get redirected here.
 */
ve.ce.Surface.prototype.updateDeactivatedSelection = function () {
	var i, l, rects,
		selection = this.getModel().getSelection();

	this.$deactivatedSelection.empty();

	if (
		!this.deactivated || this.focusedNode ||
		!( selection instanceof ve.dm.LinearSelection ) ||
		selection.isCollapsed()
	) {
		return;
	}
	rects = this.getSelectionRects( selection );
	if ( rects ) {
		for ( i = 0, l = rects.length; i < l; i++ ) {
			this.$deactivatedSelection.append( this.$( '<div>' ).css( {
				top: rects[i].top,
				left: rects[i].left,
				width: rects[i].width,
				height: rects[i].height
			} ) );
		}
	}
};

/**
 * Handle document focus events.
 *
 * This is triggered by a global focusin/focusout event noticing a selection on the document.
 *
 * @method
 * @fires focus
 */
ve.ce.Surface.prototype.onDocumentFocus = function () {
	if ( this.getModel().getSelection().isNull() ) {
		// If the document is being focused by a non-mouse/non-touch user event,
		// find the first content offset and place the cursor there.
		this.getModel().selectFirstContentOffset();
	}
	this.eventSequencer.attach( this.$element );
	this.surfaceObserver.startTimerLoop();
	this.focused = true;
	this.activate();
	this.emit( 'focus' );
};

/**
 * Handle document blur events.
 *
 * This is triggered by a global focusin/focusout event noticing no selection on the document.
 *
 * @method
 * @fires blur
 */
ve.ce.Surface.prototype.onDocumentBlur = function () {
	this.eventSequencer.detach();
	this.surfaceObserver.stopTimerLoop();
	this.surfaceObserver.pollOnce();
	this.surfaceObserver.clear();
	this.dragging = false;
	this.focused = false;
	if ( this.focusedNode ) {
		this.focusedNode.setFocused( false );
		this.focusedNode = null;
	}
	this.getModel().setNullSelection();
	this.emit( 'blur' );
};

/**
 * Check if surface is focused.
 *
 * @returns {boolean} Surface is focused
 */
ve.ce.Surface.prototype.isFocused = function () {
	return this.focused;
};

/**
 * Handle document mouse down events.
 *
 * @method
 * @param {jQuery.Event} e Mouse down event
 */
ve.ce.Surface.prototype.onDocumentMouseDown = function ( e ) {
	if ( e.which !== 1 ) {
		return;
	}

	// Remember the mouse is down
	this.dragging = true;

	// Bind mouseup to the whole document in case of dragging out of the surface
	this.$document.on( 'mouseup', this.onDocumentMouseUpHandler );

	this.surfaceObserver.stopTimerLoop();
	// In some browsers the selection doesn't change until after the event
	// so poll in the 'after' function
	setTimeout( this.afterDocumentMouseDown.bind( this, e, this.getModel().getSelection() ) );

	// Handle triple click
	// HACK: do not do triple click handling in IE, because their click counting is broken
	if ( e.originalEvent.detail >= 3 && !ve.init.platform.constructor.static.isInternetExplorer() ) {
		// Browser default behaviour for triple click won't behave as we want
		e.preventDefault();

		this.getModel().getFragment().expandLinearSelection( 'closest', ve.dm.BranchNode ).adjustLinearSelection( 1, -1 ).select();
	}
};

/**
 * Deferred until after document mouse down
 *
 * @param {jQuery.Event} e Mouse down event
 * @param {ve.dm.Selection} selectionBefore Selection before the mouse event
 */
ve.ce.Surface.prototype.afterDocumentMouseDown = function ( e, selectionBefore ) {
	// TODO: guard with incRenderLock?
	this.surfaceObserver.pollOnce();
	if ( e.shiftKey ) {
		this.fixShiftClickSelect( selectionBefore );
	}
};

/**
 * Handle document mouse up events.
 *
 * @method
 * @param {jQuery.Event} e Mouse up event
 * @fires selectionEnd
 */
ve.ce.Surface.prototype.onDocumentMouseUp = function ( e ) {
	this.$document.off( 'mouseup', this.onDocumentMouseUpHandler );
	this.surfaceObserver.startTimerLoop();
	// In some browsers the selection doesn't change until after the event
	// so poll in the 'after' function
	setTimeout( this.afterDocumentMouseUp.bind( this, e, this.getModel().getSelection() ) );
};

/**
 * Deferred until after document mouse up
 *
 * @param {jQuery.Event} e Mouse up event
 * @param {ve.dm.Selection} selectionBefore Selection before the mouse event
 */
ve.ce.Surface.prototype.afterDocumentMouseUp = function ( e, selectionBefore ) {
	// TODO: guard with incRenderLock?
	this.surfaceObserver.pollOnce();
	if ( e.shiftKey ) {
		this.fixShiftClickSelect( selectionBefore );
	}
	if ( !e.shiftKey && this.selecting ) {
		this.emit( 'selectionEnd' );
		this.selecting = false;
	}
	this.dragging = false;
};

/**
 * Fix shift-click selection
 *
 * When shift-clicking on links Chrome tries to collapse the selection
 * so check for this and fix manually.
 *
 * This can occur on mousedown or, if the existing selection covers the
 * link, on mouseup.
 *
 * https://code.google.com/p/chromium/issues/detail?id=345745
 *
 * @param {ve.dm.Selection} selectionBefore Selection before the mouse event
 */
ve.ce.Surface.prototype.fixShiftClickSelect = function ( selectionBefore ) {
	if ( !( selectionBefore instanceof ve.dm.LinearSelection ) ) {
		return;
	}
	var newSelection = this.getModel().getSelection();
	if ( newSelection.isCollapsed() && !newSelection.equals( selectionBefore ) ) {
		this.getModel().setLinearSelection( new ve.Range( selectionBefore.getRange().from, newSelection.getRange().to ) );
	}
};

/**
 * Handle document mouse move events.
 *
 * @method
 * @param {jQuery.Event} e Mouse move event
 * @fires selectionStart
 */
ve.ce.Surface.prototype.onDocumentMouseMove = function () {
	// Detect beginning of selection by moving mouse while dragging
	if ( this.dragging && !this.selecting ) {
		this.selecting = true;
		this.emit( 'selectionStart' );
	}
};

/**
 * Handle document selection change events.
 *
 * @method
 * @param {jQuery.Event} e Selection change event
 */
ve.ce.Surface.prototype.onDocumentSelectionChange = function () {
	if ( !this.dragging ) {
		// Optimisation
		return;
	}

	this.surfaceObserver.pollOnceSelection();
};

/**
 * Handle document drag start events.
 *
 * @method
 * @param {jQuery.Event} e Drag start event
 */
ve.ce.Surface.prototype.onDocumentDragStart = function ( e ) {
	var dataTransfer = e.originalEvent.dataTransfer;
	try {
		dataTransfer.setData( 'application-x/VisualEditor', JSON.stringify( this.getModel().getSelection() ) );
	} catch ( err ) {
		// IE doesn't support custom data types, but overwriting the actual drag data should be avoided
		// TODO: Do this with an internal state to avoid overwriting drag data even in IE
		dataTransfer.setData( 'text', '__ve__' + JSON.stringify( this.getModel().getSelection() ) );
	}
};

/**
 * Handle document drag over events.
 *
 * @method
 * @param {jQuery.Event} e Drag over event
 */
ve.ce.Surface.prototype.onDocumentDragOver = function ( e ) {
	if ( !this.relocatingNode ) {
		return;
	}
	var $target, $dropTarget, node, dropPosition, nodeType, inHandlesOwnChildren;

	if ( !this.relocatingNode.isContent() ) {
		e.preventDefault();
		$target = $( e.target ).closest( '.ve-ce-branchNode, .ve-ce-leafNode' );
		if ( $target.length ) {
			// Find the nearest node which will accept this node type
			nodeType = this.relocatingNode.getType();
			node = $target.data( 'view' );
			while ( node.parent && !node.parent.isAllowedChildNodeType( nodeType ) ) {
				node = node.parent;
			}
			if ( node.parent ) {
				inHandlesOwnChildren = false;
				node.parent.traverseUpstream( function ( n ) {
					if ( n.handlesOwnChildren() ) {
						inHandlesOwnChildren = true;
						return false;
					}
				} );
			}
			if ( node.parent && !inHandlesOwnChildren ) {
				$dropTarget = node.$element;
				dropPosition = e.originalEvent.pageY - $dropTarget.offset().top > $dropTarget.outerHeight() / 2 ? 'bottom' : 'top';
			} else {
				$dropTarget = this.$lastDropTarget;
				dropPosition = this.lastDropPosition;
			}
		}
		if ( this.$lastDropTarget && (
			!this.$lastDropTarget.is( $dropTarget ) || dropPosition !== this.lastDropPosition
		) ) {
			this.$dropMarker.detach();
			$dropTarget = null;
		}
		if ( $dropTarget && (
			!$dropTarget.is( this.$lastDropTarget ) || dropPosition !== this.lastDropPosition
		) ) {
			this.$dropMarker.width( $dropTarget.width() );
			if ( dropPosition === 'top' ) {
				this.$dropMarker.insertBefore( $dropTarget );
			} else {
				this.$dropMarker.insertAfter( $dropTarget );
			}
		}
		if ( $dropTarget !== undefined ) {
			this.$lastDropTarget = $dropTarget;
			this.lastDropPosition = dropPosition;
		}
	}
	if ( this.selecting ) {
		this.emit( 'selectionEnd' );
		this.selecting = false;
		this.dragging = false;
	}
};

/**
 * Handle document drop events.
 *
 * Limits native drag and drop behaviour.
 *
 * @method
 * @param {jQuery.Event} e Drop event
 */
ve.ce.Surface.prototype.onDocumentDrop = function ( e ) {
	// Properties may be nullified by other events, so cache before setTimeout
	var selectionJSON, dragSelection, dragRange, originFragment, originData,
		targetRange, targetOffset, targetFragment, dragHtml, dragText,
		i, l, name, insert,
		fileHandlers = [],
		dataTransfer = e.originalEvent.dataTransfer,
		$dropTarget = this.$lastDropTarget,
		dropPosition = this.lastDropPosition;

	// Prevent native drop event from modifying view
	e.preventDefault();

	try {
		selectionJSON = dataTransfer.getData( 'application-x/VisualEditor' );
	} catch ( err ) {
		selectionJSON = dataTransfer.getData( 'text' );
		if ( selectionJSON.slice( 0, 6 ) === '__ve__' ) {
			selectionJSON = selectionJSON.slice( 6 );
		} else {
			selectionJSON = null;
		}
	}

	if ( this.relocatingNode ) {
		dragRange = this.relocatingNode.getModel().getOuterRange();
	} else if ( selectionJSON ) {
		dragSelection = ve.dm.Selection.static.newFromJSON( this.getModel().getDocument(), selectionJSON );
		if ( dragSelection instanceof ve.dm.LinearSelection ) {
			dragRange = dragSelection.getRange();
		}
	} else if ( dataTransfer.files.length ) {
		for ( i = 0, l = dataTransfer.files.length; i < l; i++ ) {
			name = ve.ui.dataTransferHandlerFactory.getHandlerNameForType( dataTransfer.files[i].type );
			if ( name ) {
				fileHandlers.push(
					ve.ui.dataTransferHandlerFactory.create( name, this.surface, dataTransfer.files[i] )
				);
			}
		}
	} else {
		try {
			dragHtml = dataTransfer.getData( 'text/html' );
			if ( !dragHtml ) {
				dragText = dataTransfer.getData( 'text/plain' );
			}
		} catch ( err ) {
			dragText = dataTransfer.getData( 'text' );
		}
	}

	if ( ( dragRange && !dragRange.isCollapsed() ) || fileHandlers.length || dragHtml || dragText  ) {
		if ( this.relocatingNode && !this.relocatingNode.getModel().isContent() ) {
			// Block level drag and drop: use the lastDropTarget to get the targetOffset
			if ( $dropTarget ) {
				targetRange = $dropTarget.data( 'view' ).getModel().getOuterRange();
				if ( dropPosition === 'top' ) {
					targetOffset = targetRange.start;
				} else {
					targetOffset = targetRange.end;
				}
			} else {
				return;
			}
		} else {
			targetOffset = this.getOffsetFromCoords(
				e.originalEvent.pageX - this.$document.scrollLeft(),
				e.originalEvent.pageY - this.$document.scrollTop()
			);
			if ( targetOffset === -1 ) {
				return;
			}
		}

		targetFragment = this.getModel().getLinearFragment( new ve.Range( targetOffset ) );

		if ( dragRange ) {
			// Get a fragment and data of the node being dragged
			originFragment = this.getModel().getLinearFragment( dragRange );
			originData = originFragment.getData();

			// Remove node from old location
			originFragment.removeContent();

			// Re-insert data at new location
			targetFragment.insertContent( originData );
		} else if ( fileHandlers.length ) {
			insert = function ( docOrData ) {
				if ( docOrData instanceof ve.dm.Document ) {
					targetFragment.collapseToEnd().insertDocument( docOrData );
				} else {
					targetFragment.collapseToEnd().insertContent( docOrData );
				}
			};
			for ( i = 0, l = fileHandlers.length; i < l; i++ ) {
				fileHandlers[i].getInsertableData().done( insert );
			}
		} else if ( dragHtml ) {
			targetFragment.insertHtml( dragHtml, this.getSurface().getImportRules() );
		} else if ( dragText ) {
			targetFragment.insertContent( dragText );
		}
	}
	this.endRelocation();
};

/**
 * Handle document key down events.
 *
 * @method
 * @param {jQuery.Event} e Key down event
 * @fires selectionStart
 */
ve.ce.Surface.prototype.onDocumentKeyDown = function ( e ) {
	var trigger, focusedNode,
		selection = this.getModel().getSelection(),
		updateFromModel = false;

	if ( selection instanceof ve.dm.NullSelection ) {
		return;
	}

	if ( e.which === 229 ) {
		// Ignore fake IME events (emitted in IE and Chromium)
		return;
	}

	this.surfaceObserver.stopTimerLoop();
	this.incRenderLock();
	try {
		// TODO: is this correct?
		this.surfaceObserver.pollOnce();
	} finally {
		this.decRenderLock();
	}

	this.storeKeyDownState( e );

	switch ( e.keyCode ) {
		case OO.ui.Keys.LEFT:
		case OO.ui.Keys.RIGHT:
		case OO.ui.Keys.UP:
		case OO.ui.Keys.DOWN:
			if ( !this.dragging && !this.selecting && e.shiftKey ) {
				this.selecting = true;
				this.emit( 'selectionStart' );
			}

			if ( selection instanceof ve.dm.LinearSelection ) {
				this.handleLinearArrowKey( e );
				updateFromModel = true;
			} else if ( selection instanceof ve.dm.TableSelection ) {
				this.handleTableArrowKey( e );
			}
			break;
		case OO.ui.Keys.END:
		case OO.ui.Keys.HOME:
		case OO.ui.Keys.PAGEUP:
		case OO.ui.Keys.PAGEDOWN:
			if ( selection instanceof ve.dm.TableSelection ) {
				this.handleTableArrowKey( e );
			}
			break;
		case OO.ui.Keys.ENTER:
			e.preventDefault();
			focusedNode = this.getFocusedNode();
			if ( focusedNode ) {
				focusedNode.executeCommand();
			} else if ( selection instanceof ve.dm.LinearSelection ) {
				this.handleLinearEnter( e );
				updateFromModel = true;
			} else if ( selection instanceof ve.dm.TableSelection ) {
				this.handleTableEnter( e );
			}
			break;
		case OO.ui.Keys.BACKSPACE:
		case OO.ui.Keys.DELETE:
			if ( selection instanceof ve.dm.LinearSelection ) {
				if ( this.handleLinearDelete( e ) ) {
					e.preventDefault();
				}
				updateFromModel = true;
			} else if ( selection instanceof ve.dm.TableSelection ) {
				e.preventDefault();
				this.handleTableDelete( e );
			}
			break;
		case OO.ui.Keys.ESCAPE:
			if ( this.getActiveTableNode() ) {
				this.handleTableEditingEscape( e );
			}
			break;
		default:
			trigger = new ve.ui.Trigger( e );
			if ( trigger.isComplete() && this.surface.execute( trigger ) ) {
				e.preventDefault();
				e.stopPropagation();
				updateFromModel = true;
			}
			break;
	}
	if ( !updateFromModel ) {
		this.incRenderLock();
	}
	try {
		this.surfaceObserver.pollOnce();
	} finally {
		if ( !updateFromModel ) {
			this.decRenderLock();
		}
	}
	this.surfaceObserver.startTimerLoop();
};

/**
 * Handle document key press events.
 *
 * @method
 * @param {jQuery.Event} e Key press event
 */
ve.ce.Surface.prototype.onDocumentKeyPress = function ( e ) {
	// Filter out non-character keys. Doing this prevents:
	// * Unexpected content deletion when selection is not collapsed and the user presses, for
	//   example, the Home key (Firefox fires 'keypress' for it)
	// TODO: Should be covered with Selenium tests.
	if (
		// Catches most keys that don't produce output (charCode === 0, thus no character)
		e.which === 0 || e.charCode === 0 ||
		// Opera 12 doesn't always adhere to that convention
		e.keyCode === OO.ui.Keys.TAB || e.keyCode === OO.ui.Keys.ESCAPE ||
		// Ignore all keypresses with Ctrl / Cmd modifier keys
		ve.ce.isShortcutKey( e )
	) {
		return;
	}

	this.handleInsertion();
};

/**
 * Deferred until after document key down event
 *
 * @param {jQuery.Event} e keydown event
 */
ve.ce.Surface.prototype.afterDocumentKeyDown = function ( e ) {
	var direction, focusableNode, startOffset, endOffset, offsetDiff,
		range, fixupCursorForUnicorn,
		surface = this,
		isArrow = (
			e.keyCode === OO.ui.Keys.UP ||
			e.keyCode === OO.ui.Keys.DOWN ||
			e.keyCode === OO.ui.Keys.LEFT ||
			e.keyCode === OO.ui.Keys.RIGHT
		);

	/**
	 * Determine whether a position is editable, and if so which focusable node it is in
	 *
	 * We can land inside ce=false in many browsers:
	 * - Firefox has normal cursor positions at most node boundaries inside ce=false
	 * - Chromium has superfluous cursor positions around a ce=false img
	 * - IE hardly restricts editing at all inside ce=false
	 * If ce=false then we have landed inside the focusable node.
	 * If we land in a non-text position, assume we should have hit the node
	 * immediately after the position we hit (in the direction of motion)

	 * @private
	 * @param {Node} DOM node of cursor position
	 * @param {number} offset Offset of cursor position
	 * @param {number} direction Cursor motion direction (1=forward, -1=backward)
	 * @returns {ve.ce.Node|null} node, or null if not in a focusable node
	 */
	function getSurroundingFocusableNode( node, offset, direction ) {
		var focusNode, $ceNode, focusableNode;
		if ( node.nodeType === Node.TEXT_NODE ) {
			focusNode = node;
		} else if ( direction > 0 && offset < node.childNodes.length ) {
			focusNode = node.childNodes[ offset ];
		} else if ( direction < 0 && offset > 0 ) {
			focusNode = node.childNodes[ offset - 1 ];
		} else {
			focusNode = node;
		}
		$ceNode = $( focusNode ).closest(
			'[contenteditable], .ve-ce-branchNode'
		);
		if ( $ceNode.prop( 'contenteditable' ) !== 'false' ) {
			return null;
		}
		focusableNode = $ceNode.closest(
			'.ve-ce-branchNode, .ve-ce-leafNode'
		).data( 'view' );
		if ( !focusableNode || !focusableNode.isFocusable() ) {
			return null;
		}
		return focusableNode;
	}

	/**
	 * Compute the direction of cursor movement, if any
	 *
	 * Even if the user pressed a cursor key in the interior of the document, there may not
	 * be any movement: browser BIDI and ce=false handling can be quite quirky
	 *
	 * @returns {number|null} -1 for startwards, 1 for endwards, null for none
	 */
	function getDirection() {
		return (
			isArrow &&
			surface.misleadingCursorStartSelection.focusNode &&
			surface.nativeSelection.focusNode &&
			ve.compareDocumentOrder(
				surface.nativeSelection.focusNode,
				surface.nativeSelection.focusOffset,
				surface.misleadingCursorStartSelection.focusNode,
				surface.misleadingCursorStartSelection.focusOffset
			)
		) || null;
	}

	if ( e !== this.cursorEvent ) {
		return;
	}

	// Restore the selection and stop, if we cursored out of a table edit cell.
	// Assumption: if we cursored out of a table cell, then none of the fixups below this point
	// would have got the selection back inside the cell. Therefore it's OK to check here.
	if ( isArrow && this.restoreActiveTableNodeSelection() ) {
		return;
	}

	// If we arrowed a collapsed cursor across a focusable node, select the node instead
	if (
		isArrow &&
		!e.ctrlKey &&
		!e.altKey &&
		!e.metaKey &&
		this.misleadingCursorStartSelection.isCollapsed &&
		this.nativeSelection.isCollapsed &&
		( direction = getDirection() ) !== null
	) {
		focusableNode = getSurroundingFocusableNode(
			this.nativeSelection.focusNode,
			this.nativeSelection.focusOffset,
			direction
		);

		if ( !focusableNode ) {
			// Calculate the DM offsets of our motion
			try {
				startOffset = ve.ce.getOffset(
					this.misleadingCursorStartSelection.focusNode,
					this.misleadingCursorStartSelection.focusOffset
				);
				endOffset = ve.ce.getOffset(
					this.nativeSelection.focusNode,
					this.nativeSelection.focusOffset
				);
				offsetDiff = endOffset - startOffset;
			} catch ( ex ) {
				startOffset = endOffset = offsetDiff = undefined;
			}

			if ( Math.abs( offsetDiff ) === 2 ) {
				// Test whether we crossed a focusable node
				// (this applies even if we cursored up/down)
				focusableNode = (
					this.model.documentModel.documentNode
					.getNodeFromOffset( ( startOffset + endOffset ) / 2 )
				);

				if ( focusableNode.isFocusable() ) {
					range = new ve.Range( startOffset, endOffset );
				} else {
					focusableNode = undefined;
				}
			}
		}

		if ( focusableNode ) {
			if ( !range ) {
				range = focusableNode.getOuterRange();
				if ( direction < 0 ) {
					range = range.flip();
				}
			}
			this.model.setLinearSelection( range );
			if ( e.keyCode === OO.ui.Keys.LEFT ) {
				this.cursorDirectionality = direction > 0 ? 'rtl' : 'ltr';
			} else if ( e.keyCode === OO.ui.Keys.RIGHT ) {
				this.cursorDirectionality = direction < 0 ? 'rtl' : 'ltr';
			}
			// else up/down pressed; leave this.cursorDirectionality as null
			// (it was set by setLinearSelection calling onModelSelect)
		}
	}

	fixupCursorForUnicorn = (
		!e.shiftKey &&
		( e.keyCode === OO.ui.Keys.LEFT || e.keyCode === OO.ui.Keys.RIGHT )
	);
	this.incRenderLock();
	try {
		this.surfaceObserver.pollOnce();
	} finally {
		this.decRenderLock();
	}
	this.checkUnicorns( fixupCursorForUnicorn );
};

/**
 * Check whether the selection has moved out of the unicorned area (i.e. is not currently between
 * two unicorns) and if so, destroy the unicorns. If there are no active unicorns, this function
 * does nothing.
 *
 * If the unicorns are destroyed as a consequence of the user moving the cursor across a unicorn
 * with the arrow keys, the cursor will have to be moved again to produce the cursor movement
 * the user expected. Set the fixupCursor parameter to true to enable this behavior.
 *
 * @param {boolean} fixupCursor If destroying unicorns, fix the cursor position for expected movement
 */
ve.ce.Surface.prototype.checkUnicorns = function ( fixupCursor ) {
	var preUnicorn, postUnicorn, range, node, fixup;
	if ( !this.unicorningNode || !this.unicorningNode.unicorns ) {
		return;
	}
	preUnicorn = this.unicorningNode.unicorns[ 0 ];
	postUnicorn = this.unicorningNode.unicorns[ 1 ];

	if ( this.nativeSelection.rangeCount === 0 ) {
		// XXX do we want to clear unicorns in this case?
		return;
	}
	range = this.nativeSelection.getRangeAt( 0 );

	// Test whether the selection endpoint is between unicorns. If so, do nothing.
	// Unicorns can only contain text, so just move backwards until we hit a non-text node.
	node = range.endContainer;
	if ( node.nodeType === Node.ELEMENT_NODE ) {
		node = range.endOffset > 0 ? node.childNodes[ range.endOffset - 1 ] : null;
	}
	while ( node !== null && node.nodeType === Node.TEXT_NODE ) {
		node = node.previousSibling;
	}
	if ( node === preUnicorn ) {
		return;
	}

	// Selection endpoint is not between unicorns.
	// Test whether it is before or after the pre-unicorn (i.e. before/after both unicorns)
	if ( ve.compareDocumentOrder(
		range.endContainer,
		range.endOffset,
		preUnicorn.parentNode,
		Array.prototype.indexOf.call( preUnicorn.parentNode.childNodes, preUnicorn )
	) < 0 ) {
		// before the pre-unicorn
		fixup = -1;
	} else {
		// at or after the pre-unicorn (actually must be after the post-unicorn)
		fixup = 1;
	}
	if ( fixupCursor ) {
		this.incRenderLock();
		try {
			this.moveModelCursor( fixup );
		} finally {
			this.decRenderLock();
		}
	}
	this.renderSelectedContentBranchNode();
	this.showSelection( this.getModel().getSelection() );
};

/**
 * Handle document key up events.
 *
 * @method
 * @param {jQuery.Event} e Key up event
 * @fires selectionEnd
 */
ve.ce.Surface.prototype.onDocumentKeyUp = function ( e ) {
	// Detect end of selecting by letting go of shift
	if ( !this.dragging && this.selecting && e.keyCode === OO.ui.Keys.SHIFT ) {
		this.selecting = false;
		this.emit( 'selectionEnd' );
	}

	var nativeRange, clientRect, scrollTo;

	if ( !this.surface.toolbarHeight ) {
		return;
	}

	nativeRange = this.getNativeRange();
	if ( !nativeRange ) {
		return null;
	}

	clientRect = RangeFix.getBoundingClientRect( nativeRange );

	if ( clientRect && clientRect.top < this.surface.toolbarHeight ) {
		scrollTo = this.getScrollPosition() + clientRect.top - this.surface.toolbarHeight;
		this.setScrollPosition( scrollTo );
	}
};

/**
 * Handle cut events.
 *
 * @method
 * @param {jQuery.Event} e Cut event
 */
ve.ce.Surface.prototype.onCut = function ( e ) {
	var surface = this;
	this.onCopy( e );
	setTimeout( function () {
		surface.getModel().getFragment().delete().select();
	} );
};

/**
 * Handle copy events.
 *
 * @method
 * @param {jQuery.Event} e Copy event
 */
ve.ce.Surface.prototype.onCopy = function ( e ) {
	var originalRange,
		clipboardIndex, clipboardItem, pasteData,
		scrollTop, unsafeSelector, range, slice,
		selection = this.getModel().getSelection(),
		view = this,
		htmlDoc = this.getModel().getDocument().getHtmlDocument(),
		clipboardData = e.originalEvent.clipboardData;

	if ( selection instanceof ve.dm.LinearSelection ||
		( selection instanceof ve.dm.TableSelection && selection.isSingleCell() )
	) {
		range = selection.getRanges()[0];
	} else {
		return;
	}

	slice = this.model.documentModel.cloneSliceFromRange( range );

	this.$pasteTarget.empty();

	pasteData = slice.data.clone();

	// Clone the elements in the slice
	slice.data.cloneElements( true );

	ve.dm.converter.getDomSubtreeFromModel( slice, this.$pasteTarget[0], true );

	// Some browsers strip out spans when they match the styling of the
	// paste target (e.g. plain spans) so we must protect against this
	// by adding a dummy class, which we can remove after paste.
	this.$pasteTarget.find( 'span' ).addClass( 've-pasteProtect' );

	// href absolutization either doesn't occur (because we copy HTML to the clipboard
	// directly with clipboardData#setData) or it resolves against the wrong document
	// (window.document instead of ve.dm.Document#getHtmlDocument) so do it manually
	// with ve#resolveUrl
	this.$pasteTarget.find( 'a' ).attr( 'href', function ( i, href ) {
		return ve.resolveUrl( href, htmlDoc );
	} );

	// Some attributes (e.g RDFa attributes in Firefox) aren't preserved by copy
	unsafeSelector = '[' + ve.ce.Surface.static.unsafeAttributes.join( '],[') + ']';
	this.$pasteTarget.find( unsafeSelector ).each( function () {
		var i, val,
			attrs = {},
			ua = ve.ce.Surface.static.unsafeAttributes;

		i = ua.length;
		while ( i-- ) {
			val = this.getAttribute( ua[i] );
			if ( val !== null ) {
				attrs[ua[i]] = val;
			}
		}
		this.setAttribute( 'data-ve-attributes', JSON.stringify( attrs ) );
	} );

	clipboardItem = { slice: slice, hash: null };
	clipboardIndex = this.clipboard.push( clipboardItem ) - 1;

	// Check we have a W3C clipboardData API
	if (
		clipboardData && clipboardData.items
	) {
		// Webkit allows us to directly edit the clipboard
		// Disable the default event so we can override the data
		e.preventDefault();

		clipboardData.setData( 'text/xcustom', this.clipboardId + '-' + clipboardIndex );
		// As we've disabled the default event we need to set the normal clipboard data
		// It is apparently impossible to set text/xcustom without setting the other
		// types manually too.
		clipboardData.setData( 'text/html', this.$pasteTarget.html() );
		clipboardData.setData( 'text/plain', this.$pasteTarget.text() );
	} else {
		clipboardItem.hash = this.constructor.static.getClipboardHash( this.$pasteTarget.contents() );
		this.$pasteTarget.prepend(
			this.$( '<span>' ).attr( 'data-ve-clipboard-key', this.clipboardId + '-' + clipboardIndex ).html( '&nbsp;' )
		);

		// If direct clipboard editing is not allowed, we must use the pasteTarget to
		// select the data we want to go in the clipboard

		// If we have a range in the document, preserve it so it can restored
		originalRange = this.getNativeRange();
		if ( originalRange ) {
			// Save scroll position before changing focus to "offscreen" paste target
			scrollTop = this.getScrollPosition();

			// Prevent surface observation due to native range changing
			this.surfaceObserver.disable();
			ve.selectElement( this.$pasteTarget[0] );

			// Restore scroll position after changing focus
			this.setScrollPosition( scrollTop );

			setTimeout( function () {
				// Change focus back
				view.$documentNode[0].focus();
				view.nativeSelection.removeAllRanges();
				view.nativeSelection.addRange( originalRange.cloneRange() );
				// Restore scroll position
				view.setScrollPosition( scrollTop );
				view.surfaceObserver.clear();
				view.surfaceObserver.enable();
			} );
		} else {
			// If nativeRange is null, the pasteTarget *should* already be selected...
			ve.selectElement( this.$pasteTarget[0] );
		}
	}
};

/**
 * Handle native paste event
 *
 * @param {jQuery.Event} e Paste event
 */
ve.ce.Surface.prototype.onPaste = function ( e ) {
	var surface = this;
	// Prevent pasting until after we are done
	if ( this.pasting ) {
		return false;
	}
	this.surfaceObserver.disable();
	this.pasting = true;
	this.beforePaste( e );
	setTimeout( function () {
		surface.afterPaste( e );
		surface.surfaceObserver.clear();
		surface.surfaceObserver.enable();

		// Allow pasting again
		surface.pasting = false;
		surface.pasteSpecial = false;
		surface.beforePasteData = null;
	} );
};

/**
 * Handle pre-paste events.
 *
 * @param {jQuery.Event} e Paste event
 */
ve.ce.Surface.prototype.beforePaste = function ( e ) {
	var tx, range, node, nodeRange, contextElement, nativeRange,
		context, leftText, rightText, textNode, textStart, textEnd,
		selection = this.getModel().getSelection(),
		clipboardData = e.originalEvent.clipboardData,
		doc = this.getModel().getDocument();

	if ( selection instanceof ve.dm.LinearSelection ||
		( selection instanceof ve.dm.TableSelection && selection.isSingleCell() )
	) {
		range = selection.getRanges()[0];
	} else {
		return;
	}

	this.beforePasteData = {};
	if ( clipboardData ) {
		this.beforePasteData.custom = clipboardData.getData( 'text/xcustom' );
		this.beforePasteData.html = clipboardData.getData( 'text/html' );
		if ( this.beforePasteData.html ) {
			// http://msdn.microsoft.com/en-US/en-%20us/library/ms649015(VS.85).aspx
			this.beforePasteData.html = this.beforePasteData.html
				.replace( /^[\s\S]*<!-- *StartFragment *-->/, '' )
				.replace( /<!-- *EndFragment *-->[\s\S]*$/, '' );
		}
	}

	// Pasting into a range? Remove first.
	if ( !range.isCollapsed() ) {
		tx = ve.dm.Transaction.newFromRemoval( doc, range );
		selection = selection.translateByTransaction( tx );
		this.model.change( tx, selection );
		range = selection.getRanges()[0];
	}

	// Save scroll position before changing focus to "offscreen" paste target
	this.beforePasteData.scrollTop = this.getScrollPosition();

	this.$pasteTarget.empty();

	// Get node from cursor position
	node = doc.getBranchNodeFromOffset( range.start );
	if ( node.canContainContent() ) {
		// If this is a content branch node, then add its DM HTML
		// to the paste target to give CE some context.
		textStart = textEnd = 0;
		nodeRange = node.getRange();
		contextElement = node.getClonedElement();
		context = [ contextElement ];
		// If there is content to the left of the cursor, put a placeholder
		// character to the left of the cursor
		if ( range.start > nodeRange.start ) {
			leftText = '☀';
			context.push( leftText );
			textStart = textEnd = 1;
		}
		// If there is content to the right of the cursor, put a placeholder
		// character to the right of the cursor
		if ( range.end < nodeRange.end ) {
			rightText = '☂';
			context.push( rightText );
		}
		// If there is no text context, select some text to be replaced
		if ( !leftText && !rightText ) {
			context.push( '☁' );
			textEnd = 1;
		}
		context.push( { type: '/' + context[0].type } );

		// Throw away 'internal', specifically inner whitespace,
		// before conversion as it can affect textStart/End offsets.
		delete contextElement.internal;
		ve.dm.converter.getDomSubtreeFromModel(
			new ve.dm.Document(
				new ve.dm.ElementLinearData( doc.getStore(), context ),
				doc.getHtmlDocument(), undefined, doc.getInternalList(),
				doc.getLang(), doc.getDir()
			),
			this.$pasteTarget[0]
		);

		// Giving the paste target focus too late can cause problems in FF (!?)
		// so do it up here.
		this.$pasteTarget[0].focus();

		nativeRange = this.getElementDocument().createRange();
		// Assume that the DM node only generated one child
		textNode = this.$pasteTarget.children().contents()[0];
		// Place the cursor between the placeholder characters
		nativeRange.setStart( textNode, textStart );
		nativeRange.setEnd( textNode, textEnd );
		this.nativeSelection.removeAllRanges();
		this.nativeSelection.addRange( nativeRange );

		this.beforePasteData.context = context;
		this.beforePasteData.leftText = leftText;
		this.beforePasteData.rightText = rightText;
	} else {
		// If we're not in a content branch node, don't bother trying to do
		// anything clever with paste context
		this.$pasteTarget[0].focus();
	}

	// Restore scroll position after focusing the paste target
	this.setScrollPosition( this.beforePasteData.scrollTop );

};

/**
 * Handle post-paste events.
 *
 * @param {jQuery.Event} e Paste event
 */
ve.ce.Surface.prototype.afterPaste = function () {
	var clipboardKey, clipboardId, clipboardIndex, range,
		$elements, parts, pasteData, slice, tx, internalListRange,
		data, doc, htmlDoc,
		context, left, right, contextRange,
		importantSpan = 'span[id],span[typeof],span[rel]',
		importRules = this.getSurface().getImportRules(),
		beforePasteData = this.beforePasteData || {},
		selection = this.model.getSelection(),
		view = this;

	// If the selection doesn't collapse after paste then nothing was inserted
	if ( !this.nativeSelection.isCollapsed ) {
		return;
	}

	if ( selection instanceof ve.dm.LinearSelection ||
		( selection instanceof ve.dm.TableSelection && selection.isSingleCell() )
	) {
		range = selection.getRanges()[0];
	} else {
		return;
	}

	// Remove the pasteProtect class. See #onCopy.
	this.$pasteTarget.find( 'span' ).removeClass( 've-pasteProtect' );

	// Remove style attributes. Any valid styles will be restored by data-ve-attributes.
	this.$pasteTarget.find( '[style]' ).removeAttr( 'style' );

	// Restore attributes. See #onCopy.
	this.$pasteTarget.find( '[data-ve-attributes]' ).each( function () {
		var attrs;
		try {
			attrs = JSON.parse( this.getAttribute( 'data-ve-attributes' ) );
		} catch ( e ) {
			// Invalid JSON
			return;
		}
		$( this ).attr( attrs );
		this.removeAttribute( 'data-ve-attributes' );
	} );

	// Find the clipboard key
	if ( beforePasteData.custom ) {
		clipboardKey = beforePasteData.custom;
	} else {
		if ( beforePasteData.html ) {
			$elements = this.$( $.parseHTML( beforePasteData.html ) );

			// Try to find the clipboard key hidden in the HTML
			$elements = $elements.filter( function () {
				var val = this.getAttribute && this.getAttribute( 'data-ve-clipboard-key' );
				if ( val ) {
					clipboardKey = val;
					// Remove the clipboard key span once read
					return false;
				}
				return true;
			} );
		} else {
			// HTML in pasteTarget my get wrapped, so use the recursive $.find to look for the clipboard key
			clipboardKey = this.$pasteTarget.find( 'span[data-ve-clipboard-key]' ).data( 've-clipboard-key' );
			// $elements is used by getClipboardHash so generate it too
			$elements = this.$pasteTarget.contents();
		}
	}

	// Remove the clipboard key
	this.$pasteTarget.find( 'span[data-ve-clipboard-key]' ).remove();

	// If we have a clipboard key, validate it and fetch data
	if ( clipboardKey ) {
		parts = clipboardKey.split( '-' );
		clipboardId = parts[0];
		clipboardIndex = parts[1];
		if ( clipboardId === this.clipboardId && this.clipboard[clipboardIndex] ) {
			// Hash validation: either text/xcustom was used or the hash must be
			// equal to the hash of the pasted HTML to assert that the HTML
			// hasn't been modified in another editor before being pasted back.
			if ( beforePasteData.custom ||
				this.clipboard[clipboardIndex].hash ===
					this.constructor.static.getClipboardHash( $elements.toArray() )
			) {
				slice = this.clipboard[clipboardIndex].slice;
			}
		}
	}

	if ( slice ) {
		// Internal paste
		try {
			// Try to paste in the original data
			// Take a copy to prevent the data being annotated a second time in the catch block
			// and to prevent actions in the data model affecting view.clipboard
			pasteData = new ve.dm.ElementLinearData(
				slice.getStore(),
				ve.copy( slice.getOriginalData() )
			);

			if ( importRules.all || this.pasteSpecial ) {
				pasteData.sanitize( importRules.all || {}, this.pasteSpecial );
			}

			// Annotate
			ve.dm.Document.static.addAnnotationsToData( pasteData.getData(), this.model.getInsertionAnnotations() );

			// Transaction
			tx = ve.dm.Transaction.newFromInsertion(
				this.documentView.model,
				range.start,
				pasteData.getData()
			);
		} catch ( err ) {
			// If that fails, use the balanced data
			// Take a copy to prevent actions in the data model affecting view.clipboard
			pasteData = new ve.dm.ElementLinearData(
				slice.getStore(),
				ve.copy( slice.getBalancedData() )
			);

			if ( importRules.all || this.pasteSpecial ) {
				pasteData.sanitize( importRules.all || {}, this.pasteSpecial );
			}

			// Annotate
			ve.dm.Document.static.addAnnotationsToData( pasteData.getData(), this.model.getInsertionAnnotations() );

			// Transaction
			tx = ve.dm.Transaction.newFromInsertion(
				this.documentView.model,
				range.start,
				pasteData.getData()
			);
		}
	} else {
		if ( clipboardKey && beforePasteData.html ) {
			// If the clipboardKey is set (paste from other VE instance), and clipboard
			// data is available, then make sure important spans haven't been dropped
			if ( !$elements ) {
				$elements = this.$( $.parseHTML( beforePasteData.html ) );
			}
			if (
				// HACK: Allow the test runner to force the use of clipboardData
				clipboardKey === 'useClipboardData-0' || (
					$elements.find( importantSpan ).andSelf().filter( importantSpan ).length > 0 &&
					this.$pasteTarget.find( importantSpan ).length === 0
				)
			) {
				// CE destroyed an important span, so revert to using clipboard data
				htmlDoc = ve.createDocumentFromHtml( beforePasteData.html );
				// Remove the pasteProtect class. See #onCopy.
				$( htmlDoc ).find( 'span' ).removeClass( 've-pasteProtect' );
				beforePasteData.context = null;
			}
		}
		if ( !htmlDoc ) {
			// If there were no problems, let CE do its sanitizing as it may
			// contain all sorts of horrible metadata (head tags etc.)
			// TODO: IE will always take this path, and so may have bugs with span unwrapping
			// in edge cases (e.g. pasting a single MWReference)
			htmlDoc = ve.createDocumentFromHtml( this.$pasteTarget.html() );
		}
		// External paste
		doc = ve.dm.converter.getModelFromDom( htmlDoc, this.getModel().getDocument().getHtmlDocument() );
		data = doc.data;
		// Clear metadata
		doc.metadata = new ve.dm.MetaLinearData( doc.getStore(), new Array( 1 + data.getLength() ) );
		// If the clipboardKey isn't set (paste from non-VE instance) use external import rules
		if ( !clipboardKey ) {
			data.sanitize( importRules.external, this.pasteSpecial );
			if ( importRules.all ) {
				data.sanitize( importRules.all );
			}
		} else if ( importRules.all || this.pasteSpecial ) {
			data.sanitize( importRules.all || {}, this.pasteSpecial );
		}
		data.remapInternalListKeys( this.model.getDocument().getInternalList() );

		// Initialize node tree
		doc.buildNodeTree();

		// If the paste was given context, calculate the range of the inserted data
		if ( beforePasteData.context ) {
			internalListRange = doc.getInternalList().getListNode().getOuterRange();
			context = new ve.dm.ElementLinearData(
				doc.getStore(),
				ve.copy( beforePasteData.context )
			);
			if ( this.pasteSpecial ) {
				// The context may have been sanitized, so sanitize here as well for comparison
				context.sanitize( importRules, this.pasteSpecial, true );
			}

			// Remove matching context from the left
			left = 0;
			while (
				context.getLength() &&
				ve.dm.ElementLinearData.static.compareElements(
					data.getData( left ),
					data.isElementData( left ) ? context.getData( 0 ) : beforePasteData.leftText
				)
			) {
				left++;
				context.splice( 0, 1 );
			}

			// Remove matching context from the right
			right = internalListRange.start;
			while (
				context.getLength() &&
				ve.dm.ElementLinearData.static.compareElements(
					data.getData( right - 1 ),
					data.isElementData( right - 1 ) ? context.getData( context.getLength() - 1 ) : beforePasteData.rightText
				)
			) {
				right--;
				context.splice( context.getLength() - 1, 1 );
			}
			// HACK: Strip trailing linebreaks probably introduced by Chrome bug
			while ( data.getType( right - 1 ) === 'break' ) {
				right--;
			}
			contextRange = new ve.Range( left, right );
		}

		tx = ve.dm.Transaction.newFromDocumentInsertion(
			this.documentView.model,
			range.start,
			doc,
			contextRange
		);
	}

	// Restore focus and scroll position
	this.$documentNode[0].focus();
	// Firefox sometimes doesn't change scrollTop immediately when pasting
	// line breaks so wait until we fix it.
	setTimeout( function () {
		view.setScrollPosition( beforePasteData.scrollTop );
	} );

	selection = selection.translateByTransaction( tx );
	this.model.change( tx, selection.collapseToStart() );
	// Move cursor to end of selection
	this.model.setSelection( selection.collapseToEnd() );
};

/**
 * Select all the contents within the current context
 */
ve.ce.Surface.prototype.selectAll = function () {
	var internalListRange, range, matrix,
		selection = this.getModel().getSelection();

	if ( selection instanceof ve.dm.LinearSelection ) {
		if ( this.getActiveTableNode() && this.getActiveTableNode().getEditingFragment() ) {
			range = this.getActiveTableNode().getEditingRange();
			range = new ve.Range( range.from + 1, range.to - 1 );
		} else {
			internalListRange = this.getModel().getDocument().getInternalList().getListNode().getOuterRange();
			range = new ve.Range(
				this.getNearestCorrectOffset( 0, 1 ),
				this.getNearestCorrectOffset( internalListRange.start, -1 )
			);
		}
		this.getModel().setLinearSelection( range );
	} else if ( selection instanceof ve.dm.TableSelection ) {
		matrix = selection.getTableNode().getMatrix();
		this.getModel().setSelection(
			new ve.dm.TableSelection(
				selection.getDocument(), selection.tableRange,
				0, 0, matrix.getColCount() - 1, matrix.getRowCount() - 1
			)
		);

	}
};

/**
 * Handle document composition end events.
 *
 * @method
 * @param {jQuery.Event} e Input event
 */
ve.ce.Surface.prototype.onDocumentInput = function () {
	this.incRenderLock();
	try {
		this.surfaceObserver.pollOnce();
	} finally {
		this.decRenderLock();
	}
};

/*! Custom Events */

/**
 * Handle model select events.
 *
 * @see ve.dm.Surface#method-change
 */
ve.ce.Surface.prototype.onModelSelect = function () {
	var focusedNode,
		selection = this.getModel().getSelection();

	this.cursorDirectionality = null;
	this.contentBranchNodeChanged = false;

	if ( selection instanceof ve.dm.LinearSelection ) {
		focusedNode = this.findFocusedNode( selection.getRange() );

		// If focus has changed, update nodes and this.focusedNode
		if ( focusedNode !== this.focusedNode ) {
			if ( this.focusedNode ) {
				this.focusedNode.setFocused( false );
				this.focusedNode = null;
			}
			if ( focusedNode ) {
				focusedNode.setFocused( true );
				this.focusedNode = focusedNode;

				// If dragging, we already have a native selection, so don't mess with it
				if ( !this.dragging ) {
					// As FF won't fire a copy event with nothing selected, make
					// a dummy selection of one space in the pasteTarget.
					// onCopy will ignore this native selection and use the DM selection
					this.$pasteTarget.text( ' ' );
					ve.selectElement( this.$pasteTarget[0] );
					this.$pasteTarget[0].focus();
					// Since the selection is no longer in the documentNode, clear the SurfaceObserver's
					// selection state. Otherwise, if the user places the selection back into the documentNode
					// in exactly the same place where it was before, the observer won't consider that a change.
					this.surfaceObserver.clear();
				}
			}
		}
	} else {
		if ( selection instanceof ve.dm.TableSelection ) {
			this.$pasteTarget.text( ' ' );
			ve.selectElement( this.$pasteTarget[0] );
			this.$pasteTarget[0].focus();
		}
		if ( this.focusedNode ) {
			this.focusedNode.setFocused( false );
		}
		this.focusedNode = null;
	}

	// Ignore the selection if changeModelSelection is currently being
	// called with the same (object-identical) selection object
	// (i.e. if the model is calling us back)
	if ( !this.isRenderingLocked() && selection !== this.newModelSelection ) {
		this.showSelection( selection );
		this.checkUnicorns( false );
	}
	// Update the selection state in the SurfaceObserver
	this.surfaceObserver.pollOnceNoEmit();
	// Check if we moved out of a slug
	this.updateSlug();
};

/**
 * Get the focused node (optionally at a specified range), or null if one is not present
 *
 * @param {ve.Range} [range] Optional range to check for focused node, defaults to current selection's range
 * @return {ve.ce.Node|null} Focused node
 */
ve.ce.Surface.prototype.getFocusedNode = function ( range ) {
	if ( !range ) {
		return this.focusedNode;
	}
	var selection = this.getModel().getSelection();
	if (
		selection instanceof ve.dm.LinearSelection &&
		range.equalsSelection( selection.getRange() )
	) {
		return this.focusedNode;
	}
	return this.findFocusedNode( range );
};

/**
 * Find the focusedNode at a specified range
 *
 * @param {ve.Range} range Range to search at for a focusable node
 * @return {ve.ce.Node|null} Focused node
 */
ve.ce.Surface.prototype.findFocusedNode = function ( range ) {
	var startNode, endNode,
		documentNode = this.documentView.getDocumentNode();
	// Detect when only a single focusable element is selected
	if ( !range.isCollapsed() ) {
		startNode = documentNode.getNodeFromOffset( range.start + 1 );
		if ( startNode && startNode.isFocusable() ) {
			endNode = documentNode.getNodeFromOffset( range.end - 1 );
			if ( startNode === endNode ) {
				return startNode;
			}
		}
	} else {
		// Check if the range is inside a focusable node with a collapsed selection
		startNode = documentNode.getNodeFromOffset( range.start );
		if ( startNode && startNode.isFocusable() ) {
			return startNode;
		}
	}
	return null;
};

/**
 * Handle documentUpdate events on the surface model.
 */
ve.ce.Surface.prototype.onModelDocumentUpdate = function () {
	var surface = this;
	if ( this.contentBranchNodeChanged ) {
		// Update the selection state from model
		this.onModelSelect();
	}
	// Update the state of the SurfaceObserver
	this.surfaceObserver.pollOnceNoEmit();
	// Wait for other documentUpdate listeners to run before emitting
	setTimeout( function () {
		surface.emit( 'position' );
	} );
};

/**
 * Handle insertionAnnotationsChange events on the surface model.
 * @param {ve.dm.AnnotationSet} insertionAnnotations
 */
ve.ce.Surface.prototype.onInsertionAnnotationsChange = function () {
	var changed = this.renderSelectedContentBranchNode();
	if ( !changed ) {
		return;
	}
	// Must re-apply the selection after re-rendering
	this.showSelection( this.surface.getModel().getSelection() );
	this.surfaceObserver.pollOnceNoEmit();
};

/**
 * Re-render the ContentBranchNode the selection is currently in.
 *
 * @return {boolean} Whether a re-render actually happened
 */
ve.ce.Surface.prototype.renderSelectedContentBranchNode = function () {
	var selection, ceNode;
	selection = this.model.getSelection();
	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return false;
	}
	ceNode = this.documentView.getBranchNodeFromOffset( selection.getRange().start );
	if ( ceNode === null ) {
		return false;
	}
	if ( !( ceNode instanceof ve.ce.ContentBranchNode ) ) {
		// not a content branch node
		return false;
	}
	return ceNode.renderContents();
};

/**
 * Handle branch node change events.
 *
 * @see ve.ce.SurfaceObserver#pollOnce
 *
 * @method
 * @param {ve.ce.BranchNode} oldBranchNode Node from which the range anchor has just moved
 * @param {ve.ce.BranchNode} newBranchNode Node into which the range anchor has just moved
 */
ve.ce.Surface.prototype.onSurfaceObserverBranchNodeChange = function ( oldBranchNode ) {
	if ( oldBranchNode instanceof ve.ce.ContentBranchNode ) {
		oldBranchNode.renderContents();
	}
};

/**
 * Handle selection change events.
 *
 * @see ve.ce.SurfaceObserver#pollOnce
 *
 * @method
 * @param {ve.Range|null} oldRange
 * @param {ve.Range|null} newRange
 */
ve.ce.Surface.prototype.onSurfaceObserverRangeChange = function ( oldRange, newRange ) {
	if ( oldRange && oldRange.equalsSelection( newRange ) ) {
		// Ignore when the newRange is just a flipped oldRange
		return;
	}
	this.incRenderLock();
	try {
		this.changeModel(
			null,
			newRange ?
				new ve.dm.LinearSelection( this.getModel().getDocument(), newRange ) :
				new ve.dm.NullSelection( this.getModel().getDocument() )
		);
	} finally {
		this.decRenderLock();
	}
	this.checkUnicorns( false );
};

/**
 * Handle slug enter events.
 *
 * @see ve.ce.SurfaceObserver#pollOnce
 */
ve.ce.Surface.prototype.onSurfaceObserverSlugEnter = function () {
	var fragment, offset, $paragraph,
		model = this.getModel(),
		doc = model.getDocument();

	this.updateSlug();
	// Wait until after updateSlug() to get selection
	fragment = model.getFragment();
	if ( !( fragment.getSelection() instanceof ve.dm.LinearSelection ) ) {
		// This shouldn't happen
		return;
	}
	offset = fragment.getSelection().getRange().start;
	model.pushStaging( true );
	this.changeModel( ve.dm.Transaction.newFromInsertion(
		doc, offset, [
			{ type: 'paragraph', internal: { generated: 'slug' } },
			{ type: '/paragraph' }
		]
	), new ve.dm.LinearSelection( doc, new ve.Range( offset + 1 ) ) );
	this.slugFragment = fragment;

	// Fake a slug transition on the new paragraph
	// Clear wrappers from previous former slugs
	this.$element.find( '.ve-ce-branchNode-blockSlugWrapper-former' ).remove();
	// Style paragraph as an unfocused slug, then remove unfocused class to trigger transition
	// The order is important: if we set -former before -former-unfocused, we'll get two transitions
	$paragraph = this.getDocument().getBranchNodeFromOffset( offset + 1 ).$element;
	$paragraph.wrap( this.$( '<div>' ).addClass( 've-ce-branchNode-blockSlugWrapper-former-unfocused' ) );
	// Restore selection now that we've wrapped the node the selection was in
	this.onModelSelect();
	$paragraph.parent()
		// Enable transitions
		.addClass( 've-ce-branchNode-blockSlugWrapper-former' )
		// Remove unfocused again to trigger transition
		.removeClass( 've-ce-branchNode-blockSlugWrapper-former-unfocused' );
};

/**
 * Unslug if needed.
 *
 * If the slug is no longer empty, commit the staged changes.
 * If the slug is still empty and the cursor has moved out of it,
 * clear the staged changes.
 * If the slug is still empty and the cursor is still inside it,
 * or if there is no active slug, do nothing.
 */
ve.ce.Surface.prototype.updateSlug = function () {
	// Prevent recursion
	if ( this.updatingSlug ) {
		return;
	}
	this.updatingSlug = true;

	if ( this.slugFragment ) {
		var range, $slug, anchor,
			slugFragmentRange = this.slugFragment.getSelection().getRange(),
			model = this.getModel();

		if ( model.getSelection() instanceof ve.dm.LinearSelection ) {
			range = model.getSelection().getRange();
		}

		if ( slugFragmentRange.getLength() === 2 ) {
			if ( !range || !slugFragmentRange.containsOffset( range.start ) ) {
				model.popStaging();
				// After popStaging we may have removed a paragraph before our current
				// cursor position. Polling with the SurfaceObserver won't notice a change
				// in the rangy range as our cursor doesn't move within its node so we
				// need to clear it first.
				this.surfaceObserver.clear();
				this.surfaceObserver.pollOnceNoEmit();

				// Fake a transition on the slug that came back
				$slug = $( this.documentView.getSlugAtOffset( slugFragmentRange.start ) );
				anchor = $slug[0].previousSibling;
				$slug
					// Remove from the DOM temporarily (needed for Firefox)
					.detach()
					// Switch from unfocused to focused (no transition)
					.removeClass( 've-ce-branchNode-blockSlugWrapper-unfocused' )
					.addClass( 've-ce-branchNode-blockSlugWrapper-focused' )
					// Reattach to the DOM
					.insertAfter( anchor )
					// Force reflow (needed for Chrome)
					.height();
				$slug
					// Switch from focused to unfocused (with transition)
					.removeClass( 've-ce-branchNode-blockSlugWrapper-focused' )
					.addClass( 've-ce-branchNode-blockSlugWrapper-unfocused' );

				this.slugFragment = null;
			}
		} else {
			// Unwrap the ve-ce-branchNode-blockSlugWrapper wrapper from the paragraph
			this.getDocument().getBranchNodeFromOffset( slugFragmentRange.start + 1 ).$element.unwrap();
			// Modifying the DOM above breaks cursor position, so restore
			this.showSelection( this.getModel().getSelection() );

			model.applyStaging();
			this.slugFragment = null;
		}
	}

	this.updatingSlug = false;
};

/**
 * Handle content change events.
 *
 * @see ve.ce.SurfaceObserver#pollOnce
 *
 * @method
 * @param {ve.ce.Node} node CE node the change occurred in
 * @param {Object} previous Old data
 * @param {Object} previous.text Old plain text content
 * @param {Object} previous.hash Old DOM hash
 * @param {ve.Range} previous.range Old selection
 * @param {Object} next New data
 * @param {Object} next.text New plain text content
 * @param {Object} next.hash New DOM hash
 * @param {ve.Range} next.range New selection
 */
ve.ce.Surface.prototype.onSurfaceObserverContentChange = function ( node, previous, next ) {
	var data, range, len, annotations, offsetDiff, sameLeadingAndTrailing,
		previousStart, nextStart, newRange, replacementRange,
		fromLeft = 0,
		fromRight = 0,
		nodeOffset = node.getModel().getOffset(),
		previousData = previous.text.split( '' ),
		nextData = next.text.split( '' ),
		lengthDiff = next.text.length - previous.text.length,
		nextDataString = new ve.dm.DataString( nextData ),
		surface = this;

	/**
	 * Given a naïvely computed set of annotations to apply to the content we're about to insert,
	 * this function will check if we're inserting at a word break, check if there are any
	 * annotations in the set that need to be split at a word break, and remove those.
	 *
	 * @private
	 * @param {ve.dm.AnnotationSet} annotations Annotations to apply. Will be modified.
	 * @param {ve.Range} range Range covering removed content, or collapsed range at insertion offset.
	 */
	function filterForWordbreak( annotations, range ) {
		var i, length, annotation, annotationIndex, annotationsLeft, annotationsRight,
			left = range.start,
			right = range.end,
			// - nodeOffset - 1 to adjust from absolute to relative
			// adjustment from prev to next not needed because we're before the replacement
			breakLeft = unicodeJS.wordbreak.isBreak( nextDataString, left - nodeOffset - 1 ),
			// - nodeOffset - 1 to adjust from absolute to relative
			// + lengthDiff to adjust from prev to next
			breakRight = unicodeJS.wordbreak.isBreak( nextDataString, right + lengthDiff - nodeOffset - 1 );

		if ( !breakLeft && !breakRight ) {
			// No word breaks either side, so nothing to do
			return;
		}

		annotationsLeft = surface.getModel().getDocument().data.getAnnotationsFromOffset( left - 1 );
		annotationsRight = surface.getModel().getDocument().data.getAnnotationsFromOffset( right );

		for ( i = 0, length = annotations.getLength(); i < length; i++ ) {
			annotation = annotations.get( i );
			annotationIndex = annotations.getIndex( i );
			if (
				// This annotation splits on wordbreak, and...
				annotation.constructor.static.splitOnWordbreak &&
				(
					// either we're at its right-hand boundary (its end is to our left) and
					// there's a wordbreak to our left
					( breakLeft && !annotationsRight.containsIndex( annotationIndex ) ) ||
					// or we're at its left-hand boundary (its beginning is to our right) and
					// there's a wordbreak to our right
					( breakRight && !annotationsLeft.containsIndex( annotationIndex ) )
				)
			) {
				annotations.removeAt( i );
				i--;
				length--;
			}
		}
	}

	if ( previous.range && next.range ) {
		offsetDiff = ( previous.range.isCollapsed() && next.range.isCollapsed() ) ?
			next.range.start - previous.range.start : null;
		previousStart = previous.range.start - nodeOffset - 1;
		nextStart = next.range.start - nodeOffset - 1;
		sameLeadingAndTrailing = offsetDiff !== null && (
			(
				lengthDiff > 0 &&
				previous.text.slice( 0, previousStart ) ===
					next.text.slice( 0, previousStart ) &&
				previous.text.slice( previousStart ) ===
					next.text.slice( nextStart )
			) ||
			(
				lengthDiff < 0 &&
				previous.text.slice( 0, nextStart ) ===
					next.text.slice( 0, nextStart ) &&
				previous.text.slice( previousStart - lengthDiff + offsetDiff ) ===
					next.text.slice( nextStart )
			)
		);

		// Simple insertion
		if ( lengthDiff > 0 && offsetDiff === lengthDiff && sameLeadingAndTrailing ) {
			data = nextData.slice( previousStart, nextStart );
			// Apply insertion annotations
			annotations = node.unicornAnnotations || this.model.getInsertionAnnotations();
			if ( annotations.getLength() ) {
				filterForWordbreak( annotations, new ve.Range( previous.range.start ) );
				ve.dm.Document.static.addAnnotationsToData( data, annotations );
			}

			this.incRenderLock();
			try {
				this.changeModel(
					ve.dm.Transaction.newFromInsertion(
						this.documentView.model, previous.range.start, data
					),
					new ve.dm.LinearSelection( this.documentView.model, next.range )
				);
			} finally {
				this.decRenderLock();
			}
			setTimeout( function () {
				surface.checkSequences();
			} );
			return;
		}

		// Simple deletion
		if ( ( offsetDiff === 0 || offsetDiff === lengthDiff ) && sameLeadingAndTrailing ) {
			if ( offsetDiff === 0 ) {
				range = new ve.Range( next.range.start, next.range.start - lengthDiff );
			} else {
				range = new ve.Range( next.range.start, previous.range.start );
			}
			this.incRenderLock();
			try {
				this.changeModel(
					ve.dm.Transaction.newFromRemoval( this.documentView.model,
						range ),
					new ve.dm.LinearSelection( this.documentView.model, next.range )
				);
			} finally {
				this.decRenderLock();
			}
			return;
		}
	}

	// Complex change

	len = Math.min( previousData.length, nextData.length );
	// Count same characters from left
	while ( fromLeft < len && previousData[fromLeft] === nextData[fromLeft] ) {
		++fromLeft;
	}
	// Count same characters from right
	while (
		fromRight < len - fromLeft &&
		previousData[previousData.length - 1 - fromRight] ===
		nextData[nextData.length - 1 - fromRight]
	) {
		++fromRight;
	}
	replacementRange = new ve.Range(
		nodeOffset + 1 + fromLeft,
		nodeOffset + 1 + previousData.length - fromRight
	);
	data = nextData.slice( fromLeft, nextData.length - fromRight );

	if ( node.unicornAnnotations ) {
		// This CBN is unicorned. Use the stored annotations.
		annotations = node.unicornAnnotations;
	} else {
		// Guess that we want to use the annotations from the first changed character
		// This could be wrong, e.g. slice->slide could happen by changing 'ic' to 'id'
		annotations = this.model.getDocument().data.getAnnotationsFromOffset( replacementRange.start );
	}
	if ( annotations.getLength() ) {
		filterForWordbreak( annotations, replacementRange );
		ve.dm.Document.static.addAnnotationsToData( data, annotations );
	}
	newRange = next.range;
	if ( newRange.isCollapsed() ) {
		newRange = new ve.Range( this.getNearestCorrectOffset( newRange.start, 1 ) );
	}

	this.changeModel(
		ve.dm.Transaction.newFromReplacement( this.documentView.model, replacementRange, data ),
		new ve.dm.LinearSelection( this.documentView.model, newRange )
	);
	this.queueCheckSequences = true;
	setTimeout( function () {
		surface.checkSequences();
	} );
};

/**
 * Check the current surface offset for sequence matches
 */
ve.ce.Surface.prototype.checkSequences = function () {
	var i, sequences,
		executed = false,
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection();

	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return;
	}

	sequences = ve.ui.sequenceRegistry.findMatching( surfaceModel.getDocument().data, selection.getRange().end );

	// sequences.length will likely be 0 or 1 so don't cache
	for ( i = 0; i < sequences.length; i++ ) {
		executed = sequences[i].execute( this.surface ) || executed;
	}
	if ( executed ) {
		this.showSelection( this.surface.getModel().getSelection() );
	}
};

/**
 * Handle window resize event.
 *
 * @param {jQuery.Event} e Window resize event
 */
ve.ce.Surface.prototype.onWindowResize = ve.debounce( function () {
	this.emit( 'position' );
}, 50 );

/*! Relocation */

/**
 * Start a relocation action.
 *
 * @see ve.ce.FocusableNode
 *
 * @method
 * @param {ve.ce.Node} node Node being relocated
 */
ve.ce.Surface.prototype.startRelocation = function ( node ) {
	this.relocatingNode = node;
	this.emit( 'relocationStart', node );
};

/**
 * Complete a relocation action.
 *
 * @see ve.ce.FocusableNode
 *
 * @method
 * @param {ve.ce.Node} node Node being relocated
 */
ve.ce.Surface.prototype.endRelocation = function () {
	if ( this.relocatingNode ) {
		this.emit( 'relocationEnd', this.relocatingNode );
		this.relocatingNode = null;
		if ( this.$lastDropTarget ) {
			this.$dropMarker.detach();
			this.$lastDropTarget = null;
			this.lastDropPosition = null;
		}
	}
};

/**
 * Set the active table node
 *
 * @param {ve.ce.TableNode|null} tableNode Table node
 */
ve.ce.Surface.prototype.setActiveTableNode = function ( tableNode ) {
	this.activeTableNode = tableNode;
};

/**
 * Get the active table node
 *
 * @return {ve.ce.TableNode|null} Table node
 */
ve.ce.Surface.prototype.getActiveTableNode = function () {
	return this.activeTableNode;
};

/*! Utilities */

/**
 * Store the current selection range, and a key down event if relevant
 *
 * @param {jQuery.Event|null} e Key down event
 */
ve.ce.Surface.prototype.storeKeyDownState = function ( e ) {
	if ( this.nativeSelection.rangeCount === 0 ) {
		this.cursorEvent = null;
		this.misleadingCursorStartSelection = null;
		return;
	}
	this.cursorEvent = e;
	this.misleadingCursorStartSelection = null;
	if (
		e.keyCode === OO.ui.Keys.UP ||
		e.keyCode === OO.ui.Keys.DOWN ||
		e.keyCode === OO.ui.Keys.LEFT ||
		e.keyCode === OO.ui.Keys.RIGHT
	) {
		this.misleadingCursorStartSelection = {
			isCollapsed: this.nativeSelection.isCollapsed,
			anchorNode: this.nativeSelection.anchorNode,
			anchorOffset: this.nativeSelection.anchorOffset,
			focusNode: this.nativeSelection.focusNode,
			focusOffset: this.nativeSelection.focusOffset
		};
	}
};

/**
 * Move the DM surface cursor
 *
 * @param {number} offset Distance to move (negative = toward document start)
 */
ve.ce.Surface.prototype.moveModelCursor = function ( offset ) {
	var selection = this.model.getSelection();
	if ( selection instanceof ve.dm.LinearSelection ) {
		this.model.setLinearSelection( this.model.getDocument().getRelativeRange(
			selection.getRange(),
			offset,
			'character',
			false
		) );
	}
};

/**
 * Get the directionality at the current focused node
 * @returns {string} 'ltr' or 'rtl'
 */
ve.ce.Surface.prototype.getFocusedNodeDirectionality = function () {
	var cursorNode,
		range = this.model.getSelection().getRange();

	// Use stored directionality if we have one.
	if ( this.cursorDirectionality ) {
		return this.cursorDirectionality;
	}

	// Else fall back on the CSS directionality of the focused node at the DM selection focus,
	// which is less reliable because it does not take plaintext bidi into account.
	// (range.to will actually be at the edge of the focused node, but the
	// CSS directionality will be the same).
	cursorNode = this.getDocument().getNodeAndOffset( range.to ).node;
	if ( cursorNode.nodeType === Node.TEXT_NODE ) {
		cursorNode = cursorNode.parentNode;
	}
	return this.$( cursorNode ).css( 'direction' );
};

/**
 * Restore the selection from the model if it is outside the active table node
 *
 * This is only useful if the DOM selection and the model selection are out of sync
 * @returns {boolean} Whether the selection was restored
 */
ve.ce.Surface.prototype.restoreActiveTableNodeSelection = function () {
	var activeTableNode, editingRange;
	if (
		( activeTableNode = this.getActiveTableNode() ) &&
		( editingRange = activeTableNode.getEditingRange() ) &&
		!editingRange.containsRange( ve.ce.veRangeFromSelection( this.nativeSelection ) )
	) {
		this.showSelection( this.getModel().getSelection() );
		return true;
	} else {
		return false;
	}
};

/**
 * Handle up or down arrow key events with a linear selection.
 *
 * @param {jQuery.Event} e Up or down key down event
 */
ve.ce.Surface.prototype.handleLinearArrowKey = function ( e ) {
	var nativeRange, collapseNode, collapseOffset, direction, directionality, upOrDown,
		startFocusNode, startFocusOffset,
		range = this.model.getSelection().getRange(),
		surface = this;

	// TODO: onDocumentKeyDown did this already
	this.surfaceObserver.stopTimerLoop();
	// TODO: onDocumentKeyDown did this already
	this.surfaceObserver.pollOnce();

	upOrDown = e.keyCode === OO.ui.Keys.UP || e.keyCode === OO.ui.Keys.DOWN;

	if ( this.focusedNode ) {
		if ( upOrDown ) {
			direction = e.keyCode === OO.ui.Keys.DOWN ? 1 : -1;
		} else {
			directionality = this.getFocusedNodeDirectionality();
			/*jshint bitwise:false */
			if ( e.keyCode === OO.ui.Keys.LEFT ^ directionality === 'rtl' ) {
				// leftarrow in ltr, or rightarrow in rtl
				direction = -1;
			} else {
				// leftarrow in rtl, or rightarrow in ltr
				direction = 1;
			}
		}

		if ( !this.focusedNode.isContent() ) {
			// Block focusable node: move back/forward in DM (and DOM) and preventDefault
			range = this.model.getDocument().getRelativeRange(
				range,
				direction,
				'character',
				e.shiftKey,
				this.getActiveTableNode() ? this.getActiveTableNode().getEditingRange() : null
			);
			this.model.setLinearSelection( range );
			e.preventDefault();
			return;
		}
		// Else inline focusable node

		if ( e.shiftKey ) {
			// There is no DOM range to expand (because the selection is faked), so
			// use "collapse to focus - observe - expand". Define "focus" to be the
			// edge of the focusedNode in the direction of motion (so the selection
			// always grows). This means that clicking on the focusableNode then
			// modifying the selection will always include the node.
			if ( direction === -1 ^ range.isBackwards() ) {
				range = range.flip();
			}
			this.model.setLinearSelection( new ve.Range( range.to ) );
		} else {
			// Move to start/end of node in the model in DM (and DOM)
			range = new ve.Range( direction === 1 ? range.end : range.start );
			this.model.setLinearSelection( range );
			if ( !upOrDown ) {
				// un-shifted left/right: we've already moved so preventDefault
				e.preventDefault();
				return;
			}
			// Else keep going with the cursor in the new place
		}
		// Else keep DM range and DOM selection as-is
	}

	if ( !this.nativeSelection.extend && range.isBackwards() ) {
		// If the browser doesn't support backwards selections, but the dm range
		// is backwards, then use "collapse to anchor - observe - expand".
		collapseNode = this.nativeSelection.anchorNode;
		collapseOffset = this.nativeSelection.anchorOffset;
	} else if ( !range.isCollapsed() && upOrDown ) {
		// If selection is expanded and cursoring is up/down, use
		// "collapse to focus - observe - expand" to work round quirks.
		collapseNode = this.nativeSelection.focusNode;
		collapseOffset = this.nativeSelection.focusOffset;
	}
	// Else don't collapse the selection

	if ( collapseNode ) {
		nativeRange = this.getElementDocument().createRange();
		nativeRange.setStart( collapseNode, collapseOffset );
		nativeRange.setEnd( collapseNode, collapseOffset );
		this.nativeSelection.removeAllRanges();
		this.nativeSelection.addRange( nativeRange );
	}

	startFocusNode = this.nativeSelection.focusNode;
	startFocusOffset = this.nativeSelection.focusOffset;

	// Re-expand (or fixup) the selection after the native action, if necessary
	this.eventSequencer.afterOne( { keydown: function () {
		var viewNode, newRange, afterDirection;

		// Chrome bug lets you cursor into a multi-line contentEditable=false with up/down...
		viewNode = $( surface.nativeSelection.focusNode ).closest( '.ve-ce-leafNode,.ve-ce-branchNode' ).data( 'view' );
		if ( !viewNode ) {
			// Irrelevant selection (or none)
			return;
		}

		if ( viewNode.isFocusable() ) {
			// We've landed in a focusable node; fixup the range
			if ( upOrDown ) {
				// The intended direction is clear, even if the cursor did not move
				// or did something completely preposterous
				afterDirection = e.keyCode === OO.ui.Keys.DOWN ? 1 : -1;
			} else {
				// Observe which way the cursor moved
				afterDirection = ve.compareDocumentOrder(
					startFocusNode,
					startFocusNode,
					surface.nativeSelection.focusNode,
					surface.nativeSelection.focusOffset
				);
			}
			newRange = (
				afterDirection === 1 ?
				viewNode.getOuterRange() :
				viewNode.getOuterRange().flip()
			);
		} else {
			// Check where the range has moved to
			surface.surfaceObserver.pollOnceNoEmit();
			newRange = new ve.Range( surface.surfaceObserver.getRange().to );
		}

		// Adjust range to use old anchor, if necessary
		if ( e.shiftKey ) {
			newRange = new ve.Range( range.from, newRange.to );
			surface.getModel().setLinearSelection( newRange );
		}
		surface.surfaceObserver.pollOnce();
	} } );
};

/**
 * Handle arrow key events with a table selection.
 *
 * @param {jQuery.Event} e Arrow key down event
 */
ve.ce.Surface.prototype.handleTableArrowKey = function ( e ) {
	var tableNode, newSelection,
		checkDir = false,
		selection = this.getModel().getSelection(),
		colOffset = 0,
		rowOffset = 0;

	switch ( e.keyCode ) {
		case OO.ui.Keys.LEFT:
			colOffset = -1;
			checkDir = true;
			break;
		case OO.ui.Keys.RIGHT:
			colOffset = 1;
			checkDir = true;
			break;
		case OO.ui.Keys.UP:
			rowOffset = -1;
			break;
		case OO.ui.Keys.DOWN:
			rowOffset = 1;
			break;
		case OO.ui.Keys.HOME:
			colOffset = -Infinity;
			break;
		case OO.ui.Keys.END:
			colOffset = Infinity;
			break;
		case OO.ui.Keys.PAGEUP:
			rowOffset = -Infinity;
			break;
		case OO.ui.Keys.PAGEDOWN:
			rowOffset = Infinity;
			break;
	}

	e.preventDefault();

	if ( colOffset && checkDir ) {
		tableNode = this.documentView.getBranchNodeFromOffset( selection.tableRange.start + 1 );
		if ( tableNode.$element.css( 'direction' ) !== 'ltr' ) {
			colOffset *= -1;
		}
	}
	if ( !e.shiftKey && !selection.isSingleCell() ) {
		selection = selection.collapseToFrom();
	}
	newSelection = selection.newFromAdjustment(
		e.shiftKey ? 0 : colOffset,
		e.shiftKey ? 0 : rowOffset,
		colOffset,
		rowOffset
	);
	this.getModel().setSelection( newSelection );
};

/**
 * Handle insertion of content.
 */
ve.ce.Surface.prototype.handleInsertion = function () {
	// Don't allow a user to delete a focusable node just by typing
	if ( this.focusedNode ) {
		return;
	}

	var range, annotations,
		cellSelection,
		hasChanged = false,
		selection = this.model.getSelection(),
		documentModel = this.model.getDocument();

	if ( selection instanceof ve.dm.TableSelection ) {
		cellSelection = selection.collapseToFrom();
		annotations = documentModel.data.getAnnotationsFromRange( cellSelection.getRanges()[0] );
		this.model.setSelection( cellSelection );
		this.handleTableDelete();
		this.documentView.getBranchNodeFromOffset( selection.tableRange.start + 1 ).setEditing( true );
		this.model.setInsertionAnnotations( annotations );
		selection = this.model.getSelection();
	}

	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return;
	}

	range = selection.getRange();

	// Handles removing expanded selection before inserting new text
	if ( !range.isCollapsed() ) {
		// Pull annotations from the first character in the selection
		annotations = documentModel.data.getAnnotationsFromRange(
			new ve.Range( range.start, range.start + 1 )
		);
		if ( !this.documentView.rangeInsideOneLeafNode( range ) ) {
			this.model.change(
				ve.dm.Transaction.newFromRemoval(
					this.documentView.model,
					range
				),
				new ve.dm.LinearSelection( documentModel, new ve.Range( range.start ) )
			);
			hasChanged = true;
			this.surfaceObserver.clear();
			range = this.model.getSelection().getRange();
		}
		this.model.setInsertionAnnotations( annotations );
	}

	if ( hasChanged ) {
		this.surfaceObserver.stopTimerLoop();
		this.surfaceObserver.pollOnce();
	}
};

/**
 * Handle enter key down events with a linear selection.
 *
 * @param {jQuery.Event} e Enter key down event
 */
ve.ce.Surface.prototype.handleLinearEnter = function ( e ) {
	var txRemove, txInsert, outerParent, outerChildrenCount, list, prevContentOffset,
		insertEmptyParagraph, node,
		range = this.model.getSelection().getRange(),
		cursor = range.from,
		documentModel = this.model.getDocument(),
		emptyParagraph = [{ type: 'paragraph' }, { type: '/paragraph' }],
		advanceCursor = true,
		stack = [],
		outermostNode = null,
		nodeModel = null,
		nodeModelRange = null;

	// Handle removal first
	if ( !range.isCollapsed() ) {
		txRemove = ve.dm.Transaction.newFromRemoval( documentModel, range );
		range = txRemove.translateRange( range );
		// We do want this to propagate to the surface
		this.model.change( txRemove, new ve.dm.LinearSelection( documentModel, range ) );
	}

	node = this.documentView.getBranchNodeFromOffset( range.from );
	if ( node !== null ) {
		// assertion: node is certainly a contentBranchNode
		nodeModel = node.getModel();
		nodeModelRange = nodeModel.getRange();
	}

	if (node && node.handleEnter) {
		return node.handleEnter(this);
	}

	// Handle insertion
	if ( node === null ) {
		throw new Error( 'node === null' );
	} else if (
		nodeModel.getType() !== 'paragraph' &&
		(
			cursor === nodeModelRange.from ||
			cursor === nodeModelRange.to
		)
	) {
		// If we're at the start/end of something that's not a paragraph, insert a paragraph
		// before/after. Insert after for empty nodes (from === to).
		if ( cursor === nodeModelRange.to ) {
			txInsert = ve.dm.Transaction.newFromInsertion(
				documentModel, nodeModel.getOuterRange().to, emptyParagraph
			);
		} else if ( cursor === nodeModelRange.from ) {
			txInsert = ve.dm.Transaction.newFromInsertion(
				documentModel, nodeModel.getOuterRange().from, emptyParagraph
			);
			advanceCursor = false;
		}
	} else if ( e.shiftKey && nodeModel.hasSignificantWhitespace() ) {
		// Insert newline
		txInsert = ve.dm.Transaction.newFromInsertion( documentModel, range.from, '\n' );
	} else if ( !node.splitOnEnter() ) {
		// Cannot split, so insert some appropriate node

		insertEmptyParagraph = false;
		if ( documentModel.hasSlugAtOffset( range.from ) ) {
			insertEmptyParagraph = true;
		} else {
			prevContentOffset = documentModel.data.getNearestContentOffset(
				cursor,
				-1
			);
			if ( prevContentOffset === -1 ) {
				insertEmptyParagraph = true;
			}
		}

		if ( insertEmptyParagraph ) {
			txInsert = ve.dm.Transaction.newFromInsertion(
				documentModel, cursor, emptyParagraph
			);
		} else {
			// Act as if cursor were at previous content offset
			cursor = prevContentOffset;
			node = this.documentView.getBranchNodeFromOffset( cursor );
			txInsert = undefined;
			// Continue to traverseUpstream below. That will succeed because all
			// ContentBranchNodes have splitOnEnter === true.
			// HACK / WIP: we want to be able to veto the split behavior in certain cases
			// which are not covered by the current impl.
			// Particularly we want to use ce.ContentBranchNode as it solves the rendering
			// of annotated text, but allow splitOnEnter = false
			return;
		}
		insertEmptyParagraph = undefined;
	}

	// Assertion: if txInsert === undefined then node.splitOnEnter() === true

	if ( txInsert === undefined ) {
		// This node has splitOnEnter = true. Traverse upstream until the first node
		// that has splitOnEnter = false, splitting each node as it is reached. Set
		// outermostNode to the last splittable node.

		node.traverseUpstream( function ( node ) {
			if ( !node.splitOnEnter() ) {
				return false;
			}
			stack.splice(
				stack.length / 2,
				0,
				{ type: '/' + node.type },
				node.getModel().getClonedElement()
			);
			outermostNode = node;
			if ( e.shiftKey ) {
				return false;
			} else {
				return true;
			}
		} );

		outerParent = outermostNode.getModel().getParent();
		outerChildrenCount = outerParent.getChildren().length;

		if (
			// This is a list item
			outermostNode.type === 'listItem' &&
			// This is the last list item
			outerParent.getChildren()[outerChildrenCount - 1] === outermostNode.getModel() &&
			// There is one child
			outermostNode.children.length === 1 &&
			// The child is empty
			node.getModel().length === 0
		) {
			// Enter was pressed in an empty list item.
			list = outermostNode.getModel().getParent();
			if ( list.getChildren().length === 1 ) {
				// The list item we're about to remove is the only child of the list
				// Remove the list
				txInsert = ve.dm.Transaction.newFromRemoval(
					documentModel, list.getOuterRange()
				);
			} else {
				// Remove the list item
				txInsert = ve.dm.Transaction.newFromRemoval(
					documentModel, outermostNode.getModel().getOuterRange()
				);
				this.model.change( txInsert );
				range = txInsert.translateRange( range );
				// Insert a paragraph
				txInsert = ve.dm.Transaction.newFromInsertion(
					documentModel, list.getOuterRange().to, emptyParagraph
				);
			}
			advanceCursor = false;
		} else {
			// We must process the transaction first because getRelativeContentOffset can't help us yet
			txInsert = ve.dm.Transaction.newFromInsertion( documentModel, range.from, stack );
		}
	}

	// Commit the transaction
	this.model.change( txInsert );
	range = txInsert.translateRange( range );

	// Now we can move the cursor forward
	if ( advanceCursor ) {
		cursor = documentModel.data.getRelativeContentOffset( range.from, 1 );
	} else {
		cursor = documentModel.data.getNearestContentOffset( range.from );
	}
	if ( cursor === -1 ) {
		// Cursor couldn't be placed in a nearby content node, so create an empty paragraph
		this.model.change(
			ve.dm.Transaction.newFromInsertion(
				documentModel, range.from, emptyParagraph
			)
		);
		this.model.setLinearSelection( new ve.Range( range.from + 1 ) );
	} else {
		this.model.setLinearSelection( new ve.Range( cursor ) );
	}
	// Reset and resume polling
	this.surfaceObserver.clear();
};

/**
 * Handle enter key down events with a table selection.
 *
 * @param {jQuery.Event} e Enter key down event
 */
ve.ce.Surface.prototype.handleTableEnter = function ( e ) {
	var selection = this.getModel().getSelection(),
		tableNode = this.documentView.getBranchNodeFromOffset( selection.tableRange.start + 1 );

	e.preventDefault();
	tableNode.setEditing( true );
};

/**
 * Handle delete and backspace key down events with a linear selection.
 *
 * The handler just schedules a poll to observe the native content removal, unless
 * one of the following is true:
 * - The ctrlKey is down; or
 * - The selection is expanded; or
 * - We are directly adjacent to an element node in the deletion direction.
 * In these cases, it will perform the content removal itself.
 *
 * @param {jQuery.Event} e Delete key down event
 * @return {boolean} Whether the content was removed by this method
 */
ve.ce.Surface.prototype.handleLinearDelete = function ( e ) {
	var docLength, startNode, tableEditingRange,
		direction = e.keyCode === OO.ui.Keys.DELETE ? 1 : -1,
		unit = ( e.altKey === true || e.ctrlKey === true ) ? 'word' : 'character',
		offset = 0,
		rangeToRemove = this.getModel().getSelection().getRange(),
		documentModel = this.getModel().getDocument(),
		data = documentModel.data;

	if ( rangeToRemove.isCollapsed() ) {
		// Use native behaviour then poll, unless we are adjacent to some element (or CTRL
		// is down, in which case we can't reliably predict whether the native behaviour
		// would delete far enough to remove some element)
		offset = rangeToRemove.start;
		if ( !e.ctrlKey && (
			( direction === -1 && !data.isElementData( offset - 1 ) ) ||
			( direction === 1 && !data.isElementData( offset ) )
		) ) {
			this.eventSequencer.afterOne( {
				keydown: this.surfaceObserver.pollOnce.bind( this.surfaceObserver )
			} );
			return false;
		}

		// In case when the range is collapsed use the same logic that is used for cursor left and
		// right movement in order to figure out range to remove.
		rangeToRemove = documentModel.getRelativeRange( rangeToRemove, direction, unit, true );
		tableEditingRange = this.getActiveTableNode() ? this.getActiveTableNode().getEditingRange() : null;
		if ( tableEditingRange && !tableEditingRange.containsRange( rangeToRemove ) ) {
			return true;
		}
		offset = rangeToRemove.start;
		docLength = data.getLength();
		if ( offset < docLength ) {
			while ( offset < docLength && data.isCloseElementData( offset ) ) {
				offset++;
			}
			// If the user tries to delete a focusable node from a collapsed selection,
			// just select the node and cancel the deletion.
			startNode = documentModel.getDocumentNode().getNodeFromOffset( offset + 1 );
			if ( startNode.isFocusable() ) {
				this.getModel().setLinearSelection( startNode.getOuterRange() );
				return true;
			}
		}
		if ( rangeToRemove.isCollapsed() ) {
			// For instance beginning or end of the document.
			return true;
		}
	}

	this.getModel().getLinearFragment( rangeToRemove ).delete( direction );
	// Rerender selection even if it didn't change
	// TODO: is any of this necessary?
	this.focus();
	this.surfaceObserver.clear();
	return false;
};

/**
 * Handle delete and backspace key down events with a table selection.
 *
 * Performs a strip-delete removing all the cell contents but not altering the structure.
 *
 * @param {jQuery.Event} e Delete key down event
 */
ve.ce.Surface.prototype.handleTableDelete = function () {
	var i, l,
		surfaceModel = this.getModel(),
		fragments = [],
		ranges = surfaceModel.getSelection().getRanges();

	for ( i = 0, l = ranges.length; i < l; i++ ) {
		// Create auto-updating fragments from ranges
		fragments.push( surfaceModel.getLinearFragment( ranges[i], true ) );
	}

	for ( i = 0, l = fragments.length; i < l; i++ ) {
		// Replace contents with empty wrapper paragraphs
		fragments[i].insertContent( [
			{ type: 'paragraph', internal: { generated: 'wrapper' } },
			{ type: '/paragraph' }
		] );
	}
};

/**
 * Handle escape key down events with a linear selection while table editing.
 *
 * @param {jQuery.Event} e Delete key down event
 */
ve.ce.Surface.prototype.handleTableEditingEscape = function ( e ) {
	e.preventDefault();
	e.stopPropagation();
	this.getActiveTableNode().setEditing( false );
};

/**
 * Get an approximate range covering data visible in the viewport
 *
 * It is assumed that vertical offset increases as you progress through the DM.
 * Items with custom positioning may throw off results given by this method, so
 * it should only be treated as an approximation.
 *
 * @return {ve.Range} Range covering data visible in the viewport
 */
ve.ce.Surface.prototype.getViewportRange = function () {
	var surface = this,
		documentModel = this.getModel().getDocument(),
		data = documentModel.data,
		surfaceRect = this.getSurface().getBoundingClientRect(),
		padding = 50,
		top = Math.max( this.surface.toolbarHeight - surfaceRect.top - padding, 0 ),
		bottom = top + this.$window.height() - this.surface.toolbarHeight + ( padding * 2 ),
		documentRange = new ve.Range( 0, this.getModel().getDocument().getInternalList().getListNode().getOuterRange().start );

	function binarySearch( offset, range, side ) {
		var mid, rect,
			start = range.start,
			end = range.end,
			lastLength = Infinity;
		while ( range.getLength() < lastLength ) {
			lastLength = range.getLength();
			mid = data.getNearestContentOffset(
				Math.round( ( range.start + range.end ) / 2 )
			);
			rect = surface.getSelectionBoundingRect( new ve.dm.LinearSelection( documentModel, new ve.Range( mid ) ) );
			if ( rect[side] > offset ) {
				end = mid;
				range = new ve.Range( range.start, end );
			} else {
				start = mid;
				range = new ve.Range( start, range.end );
			}
		}
		return side === 'bottom' ? start : end;
	}

	return new ve.Range(
		binarySearch( top, documentRange, 'bottom' ),
		binarySearch( bottom, documentRange, 'top' )
	);
};

/**
 * Show selection
 *
 * @method
 * @param {ve.dm.Selection} selection Selection to show
 */
ve.ce.Surface.prototype.showSelection = function ( selection ) {
	if ( this.deactivated ) {
		// Defer until view has updated
		setTimeout( this.updateDeactivatedSelection.bind( this ) );
		return;
	}

	if ( !( selection instanceof ve.dm.LinearSelection ) || this.focusedNode ) {
		return;
	}

	var endRange,
		range = selection.getRange(),
		rangeSelection = this.getRangeSelection( range ),
		nativeRange = this.getElementDocument().createRange();

	this.nativeSelection.removeAllRanges();
	if ( rangeSelection.end ) {
		nativeRange.setStart( rangeSelection.start.node, rangeSelection.start.offset );
		nativeRange.setEnd( rangeSelection.end.node, rangeSelection.end.offset );
		if ( rangeSelection.isBackwards && this.nativeSelection.extend ) {
			endRange = nativeRange.cloneRange();
			endRange.collapse( false );
			this.nativeSelection.addRange( endRange );
			try {
				this.nativeSelection.extend( nativeRange.startContainer, nativeRange.startOffset );
			} catch ( e ) {
				// Firefox sometimes fails when nodes are different,
				// see https://bugzilla.mozilla.org/show_bug.cgi?id=921444
				this.nativeSelection.addRange( nativeRange );
			}
		} else {
			this.nativeSelection.addRange( nativeRange );
		}
	} else {
		nativeRange.setStart( rangeSelection.start.node, rangeSelection.start.offset );
		this.nativeSelection.addRange( nativeRange );
	}
	// Setting a range doesn't give focus in all browsers so make sure this happens
	// Also set focus after range to prevent scrolling to top
	if ( !OO.ui.contains( this.getElementDocument().activeElement, rangeSelection.start.node, true ) ) {
		$( rangeSelection.start.node ).closest( '[contenteditable=true]' ).focus();
	}
};

/**
 * Get selection for a range.
 *
 * @method
 * @param {ve.Range} range Range to get selection for
 * @returns {Object} Object containing start and end node/offset selections, and an isBackwards flag.
 */
ve.ce.Surface.prototype.getRangeSelection = function ( range ) {
	range = new ve.Range(
		this.getNearestCorrectOffset( range.from, -1 ),
		this.getNearestCorrectOffset( range.to, 1 )
	);

	if ( !range.isCollapsed() ) {
		return {
			start: this.documentView.getNodeAndOffset( range.start ),
			end: this.documentView.getNodeAndOffset( range.end ),
			isBackwards: range.isBackwards()
		};
	} else {
		return {
			start: this.documentView.getNodeAndOffset( range.start )
		};
	}
};

/**
 * Get a native range object for a specified range
 *
 * Native ranges are only used by linear selections.
 *
 * Doesn't correct backwards selection so should be used for measurement only.
 *
 * @param {ve.Range} [range] Optional range to get the native range for, defaults to current selection's range
 * @return {Range|null} Native range object, or null if there is no suitable selection
 */
ve.ce.Surface.prototype.getNativeRange = function ( range ) {
	var nativeRange, rangeSelection,
		selection = this.getModel().getSelection();

	if (
		range && !this.deactivated &&
		selection instanceof ve.dm.LinearSelection && selection.getRange().equalsSelection( range )
	) {
		// Range requested is equivalent to native selection so reset
		range = null;
	}
	if ( !range ) {
		// Use native range, unless selection is null
		if ( !( selection instanceof ve.dm.LinearSelection ) ) {
			return null;
		}
		if ( this.nativeSelection.rangeCount > 0 ) {
			try {
				return this.nativeSelection.getRangeAt( 0 );
			} catch ( e ) {}
		}
		return null;
	}

	nativeRange = document.createRange();
	rangeSelection = this.getRangeSelection( range );

	nativeRange.setStart( rangeSelection.start.node, rangeSelection.start.offset );
	if ( rangeSelection.end ) {
		nativeRange.setEnd( rangeSelection.end.node, rangeSelection.end.offset );
	}
	return nativeRange;
};

/**
 * Append passed highlights to highlight container.
 *
 * @method
 * @param {jQuery} $highlights Highlights to append
 * @param {boolean} focused Highlights are currently focused
 */
ve.ce.Surface.prototype.appendHighlights = function ( $highlights, focused ) {
	// Only one item can be blurred-highlighted at a time, so remove the others.
	// Remove by detaching so they don't lose their event handlers, in case they
	// are attached again.
	this.$highlightsBlurred.children().detach();
	if ( focused ) {
		this.$highlightsFocused.append( $highlights );
	} else {
		this.$highlightsBlurred.append( $highlights );
	}
};

/*! Helpers */

/**
 * Get the nearest offset that a cursor can be placed at.
 *
 * TODO: Find a better name and a better place for this method
 *
 * @method
 * @param {number} offset Offset to start looking at
 * @param {number} [direction=-1] Direction to look in, +1 or -1
 * @returns {number} Nearest offset a cursor can be placed at
 */
ve.ce.Surface.prototype.getNearestCorrectOffset = function ( offset, direction ) {
	var contentOffset, structuralOffset,
		documentModel = this.getModel().getDocument(),
		data = documentModel.data;

	direction = direction > 0 ? 1 : -1;
	if (
		data.isContentOffset( offset ) ||
		documentModel.hasSlugAtOffset( offset )
	) {
		return offset;
	}

	contentOffset = data.getNearestContentOffset( offset, direction );
	structuralOffset = data.getNearestStructuralOffset( offset, direction, true );

	if ( !documentModel.hasSlugAtOffset( structuralOffset ) && contentOffset !== -1 ) {
		return contentOffset;
	}

	if ( direction === 1 ) {
		if ( contentOffset < offset ) {
			return structuralOffset;
		} else {
			return Math.min( contentOffset, structuralOffset );
		}
	} else {
		if ( contentOffset > offset ) {
			return structuralOffset;
		} else {
			return Math.max( contentOffset, structuralOffset );
		}
	}
};

/*! Getters */

/**
 * Get the top-level surface.
 *
 * @method
 * @returns {ve.ui.Surface} Surface
 */
ve.ce.Surface.prototype.getSurface = function () {
	return this.surface;
};

/**
 * Get the surface model.
 *
 * @method
 * @returns {ve.dm.Surface} Surface model
 */
ve.ce.Surface.prototype.getModel = function () {
	return this.model;
};

/**
 * Get the document view.
 *
 * @method
 * @returns {ve.ce.Document} Document view
 */
ve.ce.Surface.prototype.getDocument = function () {
	return this.documentView;
};

/**
 * Check whether there are any render locks
 *
 * @method
 * @returns {boolean} Render is locked
 */
ve.ce.Surface.prototype.isRenderingLocked = function () {
	return this.renderLocks > 0;
};

/**
 * Add a single render lock (to disable rendering)
 *
 * @method
 */
ve.ce.Surface.prototype.incRenderLock = function () {
	this.renderLocks++;
};

/**
 * Remove a single render lock
 *
 * @method
 */
ve.ce.Surface.prototype.decRenderLock = function () {
	this.renderLocks--;
};

/**
 * Change the model only, not the CE surface
 *
 * This avoids event storms when the CE surface is already correct
 *
 * @method
 * @param {ve.dm.Transaction|ve.dm.Transaction[]|null} transactions One or more transactions to
 * process, or null to process none
 * @param {ve.dm.Selection} selection New selection
 * @throws {Error} If calls to this method are nested
 */
ve.ce.Surface.prototype.changeModel = function ( transaction, selection ) {
	if ( this.newModelSelection !== null ) {
		throw new Error( 'Nested change of newModelSelection' );
	}
	this.newModelSelection = selection;
	try {
		this.model.change( transaction, selection );
	} finally {
		this.newModelSelection = null;
	}
};

/**
 * Inform the surface that one of its ContentBranchNodes' rendering has changed.
 * @see ve.ce.ContentBranchNode#renderContents
 */
ve.ce.Surface.prototype.setContentBranchNodeChanged = function () {
	this.contentBranchNodeChanged = true;
	this.cursorEvent = null;
	this.cursorStartRange = null;
};

/**
 * Set the node that has the current unicorn.
 *
 * If another node currently has a unicorn, it will be rerendered, which will
 * cause it to release its unicorn.
 *
 * @param {ve.ce.ContentBranchNode} node The node claiming the unicorn
 */
ve.ce.Surface.prototype.setUnicorning = function ( node ) {
	if ( this.setUnicorningRecursionGuard ) {
		throw new Error( 'setUnicorning recursing' );
	}
	if ( this.unicorningNode && this.unicorningNode !== node ) {
		this.setUnicorningRecursionGuard = true;
		try {
			this.unicorningNode.renderContents();
		} finally {
			this.setUnicorningRecursionGuard = false;
		}
	}
	this.unicorningNode = node;
};

/**
 * Release the current unicorn held by a given node.
 *
 * If the node doesn't hold the current unicorn, nothing happens.
 * This function does not cause any node to be rerendered.
 *
 * @param {ve.ce.ContentBranchNode} node The node releasing the unicorn
 */
ve.ce.Surface.prototype.setNotUnicorning = function ( node ) {
	if ( this.unicorningNode === node ) {
		this.unicorningNode = null;
	}
};

/**
 * Ensure that no node has a unicorn.
 *
 * If the given node currently has the unicorn, it will be released and
 * no rerender will happen. If another node has the unicorn, that node
 * will be rerendered to get rid of the unicorn.
 *
 * @param {ve.ce.ContentBranchNode} node The node releasing the unicorn
 */
ve.ce.Surface.prototype.setNotUnicorningAll = function ( node ) {
	if ( this.unicorningNode === node ) {
		// Don't call back node.renderContents()
		this.unicorningNode = null;
	}
	this.setUnicorning( null );
};

ve.ce.Surface.prototype.setScrollPosition = function ( pos ) {
	this.$window.scrollTop(pos);
};

ve.ce.Surface.prototype.getScrollPosition = function () {
	return this.$window.scrollTop();
};

/*!
 * VisualEditor ContentEditable Surface class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable surface observer.
 *
 * @class
 * @mixins OO.EventEmitter
 *
 * @constructor
 * @param {ve.ce.Surface} surface Surface to observe
 */
ve.ce.SurfaceObserver = function VeCeSurfaceObserver( surface ) {
	// Mixin constructors
	OO.EventEmitter.call( this );

	// Properties
	this.surface = surface;
	this.documentView = surface.getDocument();
	this.domDocument = this.documentView.getDocumentNode().getElementDocument();
	this.polling = false;
	this.disabled = false;
	this.timeoutId = null;
	this.pollInterval = 250; // ms
	this.rangeState = null;
};

/* Inheritance */

OO.mixinClass( ve.ce.SurfaceObserver, OO.EventEmitter );

/* Events */

/**
 * When #poll sees a change this event is emitted (before the
 * properties are updated).
 *
 * @event contentChange
 * @param {HTMLElement} node DOM node the change occurred in
 * @param {Object} previous Old data
 * @param {Object} previous.text Old plain text content
 * @param {Object} previous.hash Old DOM hash
 * @param {ve.Range} previous.range Old selection
 * @param {Object} next New data
 * @param {Object} next.text New plain text content
 * @param {Object} next.hash New DOM hash
 * @param {ve.Range} next.range New selection
 */

/**
 * When #poll observes a change in the document and the new selection anchor
 * branch node does not equal the last known one, this event is emitted.
 *
 * @event branchNodeChange
 * @param {ve.ce.BranchNode} oldBranchNode
 * @param {ve.ce.BranchNode} newBranchNode
 */

/**
 * When #poll observes a change in the document and the new selection does
 * not equal the last known selection, this event is emitted (before the
 * properties are updated).
 *
 * @event rangeChange
 * @param {ve.Range|null} oldRange Old range
 * @param {ve.Range|null} newRange New range
 */

/**
 * When #poll observes that the cursor was moved into a block slug
 *
 * @event slugEnter
 */

/* Methods */

/**
 * Clear polling data.
 *
 * @method
 */
ve.ce.SurfaceObserver.prototype.clear = function () {
	this.rangeState = null;
};

/**
 * Detach from the document view
 *
 * @method
 */
ve.ce.SurfaceObserver.prototype.detach = function () {
	this.surface = null;
	this.documentView = null;
	this.domDocument = null;
};

/**
 * Start the setTimeout synchronisation loop
 *
 * @method
 */
ve.ce.SurfaceObserver.prototype.startTimerLoop = function () {
	this.polling = true;
	this.timerLoop( true ); // will not sync immediately, because timeoutId should be null
};

/**
 * Loop once with `setTimeout`
 * @method
 * @param {boolean} firstTime Wait before polling
 */
ve.ce.SurfaceObserver.prototype.timerLoop = function ( firstTime ) {
	if ( this.timeoutId ) {
		// in case we're not running from setTimeout
		clearTimeout( this.timeoutId );
		this.timeoutId = null;
	}
	if ( !firstTime ) {
		this.pollOnce();
	}
	// only reach this point if pollOnce does not throw an exception
	if ( this.pollInterval !== null ) {
		this.timeoutId = this.setTimeout(
			this.timerLoop.bind( this ),
			this.pollInterval
		);
	}
};

/**
 * Stop polling
 *
 * @method
 */
ve.ce.SurfaceObserver.prototype.stopTimerLoop = function () {
	if ( this.polling === true ) {
		this.polling = false;
		clearTimeout( this.timeoutId );
		this.timeoutId = null;
	}
};

/**
 * Disable the surface observer
 */
ve.ce.SurfaceObserver.prototype.disable = function () {
	this.disabled = true;
};

/**
 * Enable the surface observer
 */
ve.ce.SurfaceObserver.prototype.enable = function () {
	this.disabled = false;
};

/**
 * Poll for changes.
 *
 * TODO: fixing selection in certain cases, handling selection across multiple nodes in Firefox
 *
 * FIXME: Does not work well (rangeChange is not emitted) when cursor is placed inside a block slug
 * with a mouse.
 *
 * @method
 * @fires contentChange
 * @fires rangeChange
 */
ve.ce.SurfaceObserver.prototype.pollOnce = function () {
	this.pollOnceInternal( true );
};

/**
 * Poll to update SurfaceObserver, but don't emit change events
 *
 * @method
 */
ve.ce.SurfaceObserver.prototype.pollOnceNoEmit = function () {
	this.pollOnceInternal( false );
};

/**
 * Poll to update SurfaceObserver, but only check for selection changes
 *
 * Used as an optimisation when you know the content hasn't changed
 *
 * @method
 */
ve.ce.SurfaceObserver.prototype.pollOnceSelection = function () {
	this.pollOnceInternal( true, true );
};

/**
 * Poll for changes.
 *
 * TODO: fixing selection in certain cases, handling selection across multiple nodes in Firefox
 *
 * FIXME: Does not work well (rangeChange is not emitted) when cursor is placed inside a block slug
 * with a mouse.
 *
 * @method
 * @private
 * @param {boolean} emitChanges Emit change events if selection changed
 * @param {boolean} selectionOnly Check for selection changes only
 * @fires contentChange
 * @fires rangeChange
 * @fires slugEnter
 */
ve.ce.SurfaceObserver.prototype.pollOnceInternal = function ( emitChanges, selectionOnly ) {
	var oldState, newState,
		observer = this;

	if ( !this.domDocument || this.disabled ) {
		return;
	}

	oldState = this.rangeState;
	newState = new ve.ce.RangeState(
		oldState,
		this.surface.$element,
		this.documentView.getDocumentNode(),
		selectionOnly
	);

	if ( newState.leftBlockSlug ) {
		oldState.$slugWrapper
			.addClass( 've-ce-branchNode-blockSlugWrapper-unfocused' )
			.removeClass( 've-ce-branceNode-blockSlugWrapper-focused' );
	}

	if ( newState.enteredBlockSlug ) {
		newState.$slugWrapper
			.addClass( 've-ce-branchNode-blockSlugWrapper-focused' )
			.removeClass( 've-ce-branchNode-blockSlugWrapper-unfocused' );
	}

	this.rangeState = newState;

	if ( newState.enteredBlockSlug || newState.leftBlockSlug ) {
		// Emit 'position' on the surface view after the animation completes
		this.setTimeout( function () {
			if ( observer.surface ) {
				observer.surface.emit( 'position' );
			}
		}, 200 );
	}

	if ( !selectionOnly && newState.node !== null && newState.contentChanged && emitChanges ) {
		this.emit(
			'contentChange',
			newState.node,
			{ text: oldState.text, hash: oldState.hash, range: oldState.veRange },
			{ text: newState.text, hash: newState.hash, range: newState.veRange }
		);
	}

	if ( newState.branchNodeChanged ) {
		this.emit(
			'branchNodeChange',
			( oldState && oldState.node && oldState.node.root ? oldState.node : null ),
			newState.node
		);
	}

	if ( newState.selectionChanged && emitChanges ) {
		this.emit(
			'rangeChange',
			( oldState ? oldState.veRange : null ),
			newState.veRange
		);
	}

	if ( newState.enteredBlockSlug && emitChanges ) {
		this.emit( 'slugEnter' );
	}
};

/**
 * Wrapper for setTimeout, for ease of debugging
 *
 * @param {Function} callback Callback
 * @param {number} timeout Timeout ms
 */
ve.ce.SurfaceObserver.prototype.setTimeout = function ( callback, timeout ) {
	return setTimeout( callback, timeout );
};

/**
 * Get the range last observed.
 *
 * Used when you have just polled, but don't want to wait for a 'rangeChange' event.
 *
 * @return {ve.Range} Range
 */
ve.ce.SurfaceObserver.prototype.getRange = function () {
	if ( !this.rangeState ) {
		return null;
	}
	return this.rangeState.veRange;
};

/*!
 * VisualEditor ContentEditable GeneratedContentNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable generated content node.
 *
 * @class
 * @abstract
 *
 * @constructor
 */
ve.ce.GeneratedContentNode = function VeCeGeneratedContentNode() {
	// Properties
	this.generatingPromise = null;

	// Events
	this.model.connect( this, { update: 'onGeneratedContentNodeUpdate' } );
	this.connect( this, { teardown: 'abortGenerating' } );

	// Initialization
	this.update();
};

/* Events */

/**
 * @event setup
 */

/**
 * @event teardown
 */

/**
 * @event rerender
 */

/* Static members */

ve.ce.GeneratedContentNode.static = {};

// this.$element is just a wrapper for the real content, so don't duplicate attributes on it
ve.ce.GeneratedContentNode.static.renderHtmlAttributes = false;

/* Abstract methods */

/**
 * Start a deferred process to generate the contents of the node.
 *
 * If successful, the returned promise must be resolved with the generated DOM elements passed
 * in as the first parameter, i.e. promise.resolve( domElements ); . Any other parameters to
 * .resolve() are ignored.
 *
 * If the returned promise object is abortable (has an .abort() method), .abort() will be called if
 * a newer update is started before the current update has finished. When a promise is aborted, it
 * should cease its work and shouldn't be resolved or rejected. If an outdated update's promise
 * is resolved or rejected anyway (which may happen if an aborted promise misbehaves, or if the
 * promise wasn't abortable), this is ignored and doneGenerating()/failGenerating() is not called.
 *
 * Additional data may be passed in the config object to instruct this function to render something
 * different than what's in the model. This data is implementation-specific and is passed through
 * by forceUpdate().
 *
 * @abstract
 * @param {Object} [config] Optional additional data
 * @returns {jQuery.Promise} Promise object, may be abortable
 */
ve.ce.GeneratedContentNode.prototype.generateContents = function () {
	throw new Error( 've.ce.GeneratedContentNode subclass must implement generateContents' );
};

/* Methods */

/**
 * Handler for the update event
 */
ve.ce.GeneratedContentNode.prototype.onGeneratedContentNodeUpdate = function () {
	this.update();
};

/**
 * Make an array of DOM elements suitable for rendering.
 *
 * Subclasses can override this to provide their own cleanup steps. This function takes an
 * array of DOM elements cloned within the source document and returns an array of DOM elements
 * cloned into the target document. If it's important that the DOM elements still be associated
 * with the original document, you should modify domElements before calling the parent
 * implementation, otherwise you should call the parent implementation first and modify its
 * return value.
 *
 * @param {HTMLElement[]} domElements Clones of the DOM elements from the store
 * @returns {HTMLElement[]} Clones of the DOM elements in the right document, with modifications
 */
ve.ce.GeneratedContentNode.prototype.getRenderedDomElements = function ( domElements ) {
	var i, len, attr, $rendering,
		doc = this.getElementDocument();

	/**
	 * Callback for jQuery.fn.each that resolves the value of attr to the computed
	 * property value. Called in the context of an HTMLElement.
	 * @private
	 */
	function resolveAttribute() {
		var origDoc = domElements[0].ownerDocument,
			nodeInOrigDoc = origDoc.createElement( this.nodeName );
		nodeInOrigDoc.setAttribute( attr, this.getAttribute( attr ) );
		this.setAttribute( attr, nodeInOrigDoc[attr] );
	}

	// Clone the elements into the target document
	$rendering = $( ve.copyDomElements( domElements, doc ) );

	// Filter out link and style tags for bug 50043
	// Previously filtered out meta tags, but restore these as they
	// can be made visible.
	$rendering = $rendering.not( 'link, style' );
	// Also remove link and style tags nested inside other tags
	$rendering.find( 'link, style' ).remove();

	if ( $rendering.length ) {
		// Span wrap root text nodes so they can be measured
		for ( i = 0, len = $rendering.length; i < len; i++ ) {
			if ( $rendering[i].nodeType === Node.TEXT_NODE ) {
				$rendering[i] = this.$( '<span>' ).append( $rendering[i] )[0];
			}
		}
	} else {
		$rendering = this.$( '<span>' );
	}

	// Render the computed values of some attributes
	for ( i = 0, len = ve.dm.Converter.computedAttributes.length; i < len; i++ ) {
		attr = ve.dm.Converter.computedAttributes[i];
		$rendering.find( '[' + attr + ']' )
			.add( $rendering.filter( '[' + attr + ']' ) )
			.each( resolveAttribute );
	}

	return $rendering.toArray();
};

/**
 * Rerender the contents of this node.
 *
 * @param {Object|string|Array} generatedContents Generated contents, in the default case an HTMLElement array
 * @fires setup
 * @fires teardown
 */
ve.ce.GeneratedContentNode.prototype.render = function ( generatedContents ) {
	if ( this.live ) {
		this.emit( 'teardown' );
	}
	var $newElements = this.$( this.getRenderedDomElements( ve.copyDomElements( generatedContents ) ) );
	if ( !this.$element[0].parentNode ) {
		// this.$element hasn't been attached yet, so just overwrite it
		this.$element = $newElements;
	} else {
		// Switch out this.$element (which can contain multiple siblings) in place
		this.$element.first().replaceWith( $newElements );
		this.$element.remove();
		this.$element = $newElements;
	}

	// Update focusable and resizable elements if necessary
	if ( this.$focusable ) {
		this.$focusable = this.getFocusableElement();
	}
	if ( this.$resizable ) {
		this.$resizable = this.getResizableElement();
	}

	if ( this.live ) {
		this.emit( 'setup' );
		this.afterRender();
	}
};

/**
 * Trigger rerender events after rendering the contents of the node.
 *
 * Nodes may override this method if the rerender event needs to be deferred (e.g. until images have loaded)
 *
 * @fires rerender
 */
ve.ce.GeneratedContentNode.prototype.afterRender = function () {
	this.emit( 'rerender' );
};

/**
 * Update the contents of this node based on the model and config data. If this combination of
 * model and config data has been rendered before, the cached rendering in the store will be used.
 *
 * @param {Object} [config] Optional additional data to pass to generateContents()
 */
ve.ce.GeneratedContentNode.prototype.update = function ( config ) {
	var store = this.model.doc.getStore(),
		index = store.indexOfHash( OO.getHash( [ this.model, config ] ) );
	if ( index !== null ) {
		this.render( store.value( index ) );
	} else {
		this.forceUpdate( config );
	}
};

/**
 * Force the contents to be updated. Like update(), but bypasses the store.
 *
 * @param {Object} [config] Optional additional data to pass to generateContents()
 */
ve.ce.GeneratedContentNode.prototype.forceUpdate = function ( config ) {
	var promise, node = this;

	if ( this.generatingPromise ) {
		// Abort the currently pending generation process if possible
		this.abortGenerating();
	} else {
		// Only call startGenerating if we weren't generating before
		this.startGenerating();
	}

	// Create a new promise
	promise = this.generatingPromise = this.generateContents( config );
	promise
		// If this promise is no longer the currently pending one, ignore it completely
		.done( function ( generatedContents ) {
			if ( node.generatingPromise === promise ) {
				node.doneGenerating( generatedContents, config );
			}
		} )
		.fail( function () {
			if ( node.generatingPromise === promise ) {
				node.failGenerating();
			}
		} );
};

/**
 * Called when the node starts generating new content.
 *
 * This function is only called when the node wasn't already generating content. If a second update
 * comes in, this function will only be called if the first update has already finished (i.e.
 * doneGenerating or failGenerating has already been called).
 *
 * @method
 */
ve.ce.GeneratedContentNode.prototype.startGenerating = function () {
	this.$element.addClass( 've-ce-generatedContentNode-generating' );
};

/**
 * Abort the currently pending generation, if any, and remove the generating CSS class.
 *
 * This invokes .abort() on the pending promise if the promise has that method. It also ensures
 * that if the promise does get resolved or rejected later, this is ignored.
 */
ve.ce.GeneratedContentNode.prototype.abortGenerating = function () {
	var promise = this.generatingPromise;
	if ( promise ) {
		// Unset this.generatingPromise first so that if the promise is resolved or rejected
		// from within .abort(), this is ignored as it should be
		this.generatingPromise = null;
		if ( $.isFunction( promise.abort ) ) {
			promise.abort();
		}
	}
	this.$element.removeClass( 've-ce-generatedContentNode-generating' );
};

/**
 * Called when the node successfully finishes generating new content.
 *
 * @method
 * @param {Object|string|Array} generatedContents Generated contents
 * @param {Object} [config] Config object passed to forceUpdate()
 */
ve.ce.GeneratedContentNode.prototype.doneGenerating = function ( generatedContents, config ) {
	var store, hash;

	// Because doneGenerating is invoked asynchronously, the model node may have become detached
	// in the meantime. Handle this gracefully.
	if ( this.model.doc ) {
		store = this.model.doc.getStore();
		hash = OO.getHash( [ this.model, config ] );
		store.index( generatedContents, hash );
	}

	this.$element.removeClass( 've-ce-generatedContentNode-generating' );
	this.generatingPromise = null;
	this.render( generatedContents );
};

/**
 * Called when the has failed to generate new content.
 *
 * @method
 */
ve.ce.GeneratedContentNode.prototype.failGenerating = function () {
	this.$element.removeClass( 've-ce-generatedContentNode-generating' );
	this.generatingPromise = null;
};

/**
 * Get the focusable element
 *
 * @return {jQuery} Focusable element
 */
ve.ce.GeneratedContentNode.prototype.getFocusableElement = function () {
	return this.$element;
};

/**
 * Get the resizable element
 *
 * @return {jQuery} Resizable element
 */
ve.ce.GeneratedContentNode.prototype.getResizableElement = function () {
	return this.$element;
};

/*!
 * VisualEditor ContentEditable AlienNode, AlienBlockNode and AlienInlineNode classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable alien node.
 *
 * @class
 * @abstract
 * @extends ve.ce.LeafNode
 * @mixins ve.ce.FocusableNode
 * @mixins ve.ce.GeneratedContentNode
 *
 * @constructor
 * @param {ve.dm.AlienNode} model
 * @param {Object} [config]
 */
ve.ce.AlienNode = function VeCeAlienNode() {
	// Parent constructor
	ve.ce.AlienNode.super.apply( this, arguments );

	// Mixin constructors
	ve.ce.FocusableNode.call( this );
	ve.ce.GeneratedContentNode.call( this );

	// DOM changes
	this.$highlights.addClass( 've-ce-alienNode-highlights' );
};

/* Inheritance */

OO.inheritClass( ve.ce.AlienNode, ve.ce.LeafNode );

OO.mixinClass( ve.ce.AlienNode, ve.ce.FocusableNode );

OO.mixinClass( ve.ce.AlienNode, ve.ce.GeneratedContentNode );

/* Static Properties */

ve.ce.AlienNode.static.name = 'alien';

/* Methods */

/**
 * @inheritdoc
 */
ve.ce.AlienNode.prototype.createHighlight = function () {
	// Mixin method
	return ve.ce.FocusableNode.prototype.createHighlight.call( this )
		.addClass( 've-ce-alienNode-highlight' )
		.prop( 'title', ve.msg( 'visualeditor-aliennode-tooltip' ) );
};

/**
 * @inheritdoc
 */
ve.ce.AlienNode.prototype.generateContents = function ( config ) {
	var deferred = $.Deferred();
	deferred.resolve( ( config && config.domElements ) || this.model.getAttribute( 'domElements' ) || [] );
	return deferred.promise();
};

/* Concrete subclasses */

/**
 * ContentEditable alien block node.
 *
 * @class
 * @extends ve.ce.AlienNode
 *
 * @constructor
 * @param {ve.dm.AlienBlockNode} model
 * @param {Object} [config]
 */
ve.ce.AlienBlockNode = function VeCeAlienBlockNode() {
	// Parent constructor
	ve.ce.AlienBlockNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.AlienBlockNode, ve.ce.AlienNode );

/* Static Properties */

ve.ce.AlienBlockNode.static.name = 'alienBlock';

/**
 * ContentEditable alien inline node.
 *
 * @class
 * @extends ve.ce.AlienNode
 *
 * @constructor
 * @param {ve.dm.AlienInlineNode} model
 * @param {Object} [config]
 */
ve.ce.AlienInlineNode = function VeCeAlienInlineNode() {
	// Parent constructor
	ve.ce.AlienInlineNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.AlienInlineNode, ve.ce.AlienNode );

/* Static Properties */

ve.ce.AlienInlineNode.static.name = 'alienInline';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.AlienNode );
ve.ce.nodeFactory.register( ve.ce.AlienBlockNode );
ve.ce.nodeFactory.register( ve.ce.AlienInlineNode );

/*!
 * VisualEditor ContentEditable BlockquoteNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * ContentEditable Blockquote node.
 *
 * @class
 * @extends ve.ce.ContentBranchNode
 * @constructor
 * @param {ve.dm.BlockquoteNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.BlockquoteNode = function VeCeBlockquoteNode( model, config ) {
	// Parent constructor
	ve.ce.ContentBranchNode.call( this, model, config );
};

/* Inheritance */

OO.inheritClass( ve.ce.BlockquoteNode, ve.ce.ContentBranchNode );

/* Static Properties */

ve.ce.BlockquoteNode.static.name = 'blockquote';

ve.ce.BlockquoteNode.static.tagName = 'blockquote';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.BlockquoteNode );

/*!
 * VisualEditor ContentEditable BreakNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable break node.
 *
 * @class
 * @extends ve.ce.LeafNode
 * @constructor
 * @param {ve.dm.BreakNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.BreakNode = function VeCeBreakNode() {
	// Parent constructor
	ve.ce.BreakNode.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-breakNode' );
};

/* Inheritance */

OO.inheritClass( ve.ce.BreakNode, ve.ce.LeafNode );

/* Static Properties */

ve.ce.BreakNode.static.name = 'break';

ve.ce.BreakNode.static.tagName = 'br';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.BreakNode );

/*!
 * VisualEditor ContentEditable CenterNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable center node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.CenterNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.CenterNode = function VeCeCenterNode() {
	// Parent constructor
	ve.ce.CenterNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.CenterNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.CenterNode.static.name = 'center';

ve.ce.CenterNode.static.tagName = 'center';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.CenterNode );

/*!
 * VisualEditor ContentEditable CommentNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable comment node.
 *
 * @class
 * @extends ve.ce.LeafNode
 * @mixins ve.ce.FocusableNode
 * @mixins OO.ui.IndicatorElement
 *
 * @constructor
 * @param {ve.dm.CommentNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.CommentNode = function VeCeCommentNode( model, config ) {
	// Parent constructor
	ve.ce.CommentNode.super.call( this, model, config );

	// Mixin constructors
	ve.ce.FocusableNode.call( this, this.$element, config );
	OO.ui.IndicatorElement.call( this, $.extend( {}, config, {
		$indicator: this.$element, indicator: 'alert'
	} ) );

	// DOM changes
	this.$element
		.addClass( 've-ce-commentNode' )
		// Add em space for selection highlighting
		.text( '\u2003' );
};

/* Inheritance */

OO.inheritClass( ve.ce.CommentNode, ve.ce.LeafNode );
OO.mixinClass( ve.ce.CommentNode, ve.ce.FocusableNode );
OO.mixinClass( ve.ce.CommentNode, OO.ui.IndicatorElement );

/* Static Properties */

ve.ce.CommentNode.static.name = 'comment';

ve.ce.CommentNode.static.primaryCommandName = 'comment';

/* Static Methods */

/**
 * @inheritdoc
 */
ve.ce.CommentNode.static.getDescription = function ( model ) {
	return model.getAttribute( 'text' );
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.CommentNode );

/*!
 * VisualEditor ContentEditable DefinitionListItemNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable definition list item node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.DefinitionListItemNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.DefinitionListItemNode = function VeCeDefinitionListItemNode() {
	// Parent constructor
	ve.ce.DefinitionListItemNode.super.apply( this, arguments );

	// Events
	this.model.connect( this, { update: 'onUpdate' } );
};

/* Inheritance */

OO.inheritClass( ve.ce.DefinitionListItemNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.DefinitionListItemNode.static.name = 'definitionListItem';

ve.ce.DefinitionListItemNode.static.splitOnEnter = true;

/* Methods */

/**
 * Get the HTML tag name.
 *
 * Tag name is selected based on the model's style attribute.
 *
 * @returns {string} HTML tag name
 * @throws {Error} If style is invalid
 */
ve.ce.DefinitionListItemNode.prototype.getTagName = function () {
	var style = this.model.getAttribute( 'style' ),
		types = { definition: 'dd', term: 'dt' };

	if ( !Object.prototype.hasOwnProperty.call( types, style ) ) {
		throw new Error( 'Invalid style' );
	}
	return types[style];
};

/**
 * Handle model update events.
 *
 * If the style changed since last update the DOM wrapper will be replaced with an appropriate one.
 *
 * @method
 */
ve.ce.DefinitionListItemNode.prototype.onUpdate = function () {
	this.updateTagName();
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.DefinitionListItemNode );

/*!
 * VisualEditor ContentEditable DefinitionListNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable definition list node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.DefinitionListNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.DefinitionListNode = function VeCeDefinitionListNode() {
	// Parent constructor
	ve.ce.DefinitionListNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.DefinitionListNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.DefinitionListNode.static.name = 'definitionList';

ve.ce.DefinitionListNode.static.tagName = 'dl';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.DefinitionListNode );

/*!
 * VisualEditor ContentEditable DivNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable div node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.DivNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.DivNode = function VeCeDivNode() {
	// Parent constructor
	ve.ce.DivNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.DivNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.DivNode.static.name = 'div';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.DivNode );

/*!
 * VisualEditor ContentEditable DocumentNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable document node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.DocumentNode} model Model to observe
 * @param {ve.ce.Surface} surface Surface document is part of
 * @param {Object} [config] Configuration options
 */
ve.ce.DocumentNode = function VeCeDocumentNode( model, surface, config ) {
	// Parent constructor
	ve.ce.DocumentNode.super.call( this, model, config );

	// Properties
	this.surface = surface;

	// Set root
	this.setRoot( this );

	// DOM changes
	this.$element.addClass( 've-ce-documentNode' );
	this.$element.prop( { contentEditable: 'true', spellcheck: true } );
};

/* Inheritance */

OO.inheritClass( ve.ce.DocumentNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.DocumentNode.static.name = 'document';

/* Methods */

/**
 * Get the outer length.
 *
 * For a document node is the same as the inner length, which is why we override it here.
 *
 * @method
 * @returns {number} Length of the entire node
 */
ve.ce.DocumentNode.prototype.getOuterLength = function () {
	return this.length;
};

/**
 * Get the surface the document is attached to.
 *
 * @method
 * @returns {ve.ce.Surface} Surface the document is attached to
 */
ve.ce.DocumentNode.prototype.getSurface = function () {
	return this.surface;
};

/**
 * Disable editing.
 *
 * @method
 */
ve.ce.DocumentNode.prototype.disable = function () {
	this.$element.prop( 'contentEditable', 'false' );
};

/**
 * Enable editing.
 *
 * @method
 */
ve.ce.DocumentNode.prototype.enable = function () {
	this.$element.prop( 'contentEditable', 'true' );
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.DocumentNode );

/*!
 * VisualEditor ContentEditable HeadingNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable heading node.
 *
 * @class
 * @extends ve.ce.ContentBranchNode
 * @constructor
 * @param {ve.dm.HeadingNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.HeadingNode = function VeCeHeadingNode() {
	// Parent constructor
	ve.ce.HeadingNode.super.apply( this, arguments );

	// Events
	this.model.connect( this, { update: 'onUpdate' } );
};

/* Inheritance */

OO.inheritClass( ve.ce.HeadingNode, ve.ce.ContentBranchNode );

/* Static Properties */

ve.ce.HeadingNode.static.name = 'heading';

/* Methods */

/**
 * Get the HTML tag name.
 *
 * Tag name is selected based on the model's level attribute.
 *
 * @returns {string} HTML tag name
 * @throws {Error} If level is invalid
 */
ve.ce.HeadingNode.prototype.getTagName = function () {
	var level = this.model.getAttribute( 'level' ),
		types = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' };

	if ( !Object.prototype.hasOwnProperty.call( types, level ) ) {
		throw new Error( 'Invalid level' );
	}
	return types[level];
};

/**
 * Handle model update events.
 *
 * If the level changed since last update the DOM wrapper will be replaced with an appropriate one.
 *
 * @method
 */
ve.ce.HeadingNode.prototype.onUpdate = function () {
	this.updateTagName();
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.HeadingNode );

/*!
 * VisualEditor InternalItemNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable internal item node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.InternalItemNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.InternalItemNode = function VeCeInternalItemNode() {
	// Parent constructor
	ve.ce.InternalItemNode.super.apply( this, arguments );

	this.$element.addClass( 've-ce-internalItemNode' );
};

/* Inheritance */

OO.inheritClass( ve.ce.InternalItemNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.InternalItemNode.static.name = 'internalItem';

ve.ce.InternalItemNode.static.tagName = 'span';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.InternalItemNode );

/*!
 * VisualEditor InternalListNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable internal list node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.InternalListNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.InternalListNode = function VeCeInternalListNode() {
	// Parent constructor
	ve.ce.InternalListNode.super.apply( this, arguments );

	// An internal list has no rendering
	this.$element = this.$( [] );
};

/* Inheritance */

OO.inheritClass( ve.ce.InternalListNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.InternalListNode.static.name = 'internalList';

/* Methods */

/**
 * Deliberately empty: don't build an entire CE tree with DOM elements for things that won't render
 * @inheritdoc
 */
ve.ce.InternalListNode.prototype.onSplice = function () {
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.InternalListNode );

/*!
 * VisualEditor ContentEditable ListItemNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable list item node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.ListItemNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.ListItemNode = function VeCeListItemNode() {
	// Parent constructor
	ve.ce.ListItemNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.ListItemNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.ListItemNode.static.name = 'listItem';

ve.ce.ListItemNode.static.tagName = 'li';

ve.ce.ListItemNode.static.splitOnEnter = true;

/* Registration */

ve.ce.nodeFactory.register( ve.ce.ListItemNode );

/*!
 * VisualEditor ContentEditable ListNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable list node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.ListNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.ListNode = function VeCeListNode() {
	// Parent constructor
	ve.ce.ListNode.super.apply( this, arguments );

	// Events
	this.model.connect( this, { update: 'onUpdate' } );
};

/* Inheritance */

OO.inheritClass( ve.ce.ListNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.ListNode.static.name = 'list';

/* Methods */

/**
 * Get the HTML tag name.
 *
 * Tag name is selected based on the model's style attribute.
 *
 * @returns {string} HTML tag name
 * @throws {Error} If style is invalid
 */
ve.ce.ListNode.prototype.getTagName = function () {
	var style = this.model.getAttribute( 'style' ),
		types = { bullet: 'ul', number: 'ol' };

	if ( !Object.prototype.hasOwnProperty.call( types, style ) ) {
		throw new Error( 'Invalid style' );
	}
	return types[style];
};

/**
 * Handle model update events.
 *
 * If the style changed since last update the DOM wrapper will be replaced with an appropriate one.
 *
 * @method
 */
ve.ce.ListNode.prototype.onUpdate = function () {
	this.updateTagName();
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.ListNode );

/*!
 * VisualEditor ContentEditable ParagraphNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable paragraph node.
 *
 * @class
 * @extends ve.ce.ContentBranchNode
 * @constructor
 * @param {ve.dm.ParagraphNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.ParagraphNode = function VeCeParagraphNode() {
	// Parent constructor
	ve.ce.ParagraphNode.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-paragraphNode' );
	if (
		this.model.getElement().internal &&
		this.model.getElement().internal.generated === 'wrapper'
	) {
		this.$element.addClass( 've-ce-generated-wrapper' );
	}
};

/* Inheritance */

OO.inheritClass( ve.ce.ParagraphNode, ve.ce.ContentBranchNode );

/* Static Properties */

ve.ce.ParagraphNode.static.name = 'paragraph';

ve.ce.ParagraphNode.static.tagName = 'p';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.ParagraphNode );

/*!
 * VisualEditor ContentEditable PreformattedNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable preformatted node.
 *
 * @class
 * @extends ve.ce.ContentBranchNode
 * @constructor
 * @param {ve.dm.PreformattedNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.PreformattedNode = function VeCePreformattedNode() {
	// Parent constructor
	ve.ce.PreformattedNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.PreformattedNode, ve.ce.ContentBranchNode );

/* Static Properties */

ve.ce.PreformattedNode.static.name = 'preformatted';

ve.ce.PreformattedNode.static.tagName = 'pre';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.PreformattedNode );

/*!
 * VisualEditor ContentEditable TableCaptionNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable table caption node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.TableCaptionNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.TableCaptionNode = function VeCeTableCaptionNode() {
	// Parent constructor
	ve.ce.TableCaptionNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.TableCaptionNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.TableCaptionNode.static.name = 'tableCaption';

ve.ce.TableCaptionNode.static.tagName = 'caption';

/* Methods */

/**
 * @inheritdoc
 */
ve.ce.TableCaptionNode.prototype.onSetup = function () {
	// Parent method
	ve.ce.TableCaptionNode.super.prototype.onSetup.call( this );

	// DOM changes
	this.$element
		.addClass( 've-ce-tableCaptionNode' )
		.prop( 'contentEditable', 'true' );
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.TableCaptionNode );

/*!
 * VisualEditor ContentEditable TableCellNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable table cell node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.TableCellNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.TableCellNode = function VeCeTableCellNode() {
	// Parent constructor
	ve.ce.TableCellNode.super.apply( this, arguments );

	// Events
	this.model.connect( this, {
		update: 'onUpdate',
		attributeChange: 'onAttributeChange'
	} );
};

/* Inheritance */

OO.inheritClass( ve.ce.TableCellNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.TableCellNode.static.name = 'tableCell';

/* Methods */

/**
 * @inheritdoc
 */
ve.ce.TableCellNode.prototype.onSetup = function () {
	var rowspan = this.model.getRowspan(),
		colspan = this.model.getColspan();

	// Parent method
	ve.ce.TableCellNode.super.prototype.onSetup.call( this );

	// Exit if already setup or not attached
	if ( this.isSetup || !this.root ) {
		return;
	}

	// DOM changes
	this.$element
		// The following classes can be used here:
		// ve-ce-tableCellNode-data
		// ve-ce-tableCellNode-header
		.addClass( 've-ce-tableCellNode ve-ce-tableCellNode-' + this.model.getAttribute( 'style' ) );

	if ( rowspan > 1 ) {
		this.$element.attr( 'rowspan', rowspan );
	}
	if ( colspan > 1 ) {
		this.$element.attr( 'colspan', colspan );
	}
};

/**
 * Get the HTML tag name.
 *
 * Tag name is selected based on the model's style attribute.
 *
 * @returns {string} HTML tag name
 * @throws {Error} Invalid style
 */
ve.ce.TableCellNode.prototype.getTagName = function () {
	var style = this.model.getAttribute( 'style' ),
		types = { data: 'td', header: 'th' };

	if ( !Object.prototype.hasOwnProperty.call( types, style ) ) {
		throw new Error( 'Invalid style' );
	}
	return types[style];
};

/**
 * Set the editing mode of a table cell node
 *
 * @param {boolean} enable Enable editing
 */
ve.ce.TableCellNode.prototype.setEditing = function ( enable ) {
	this.$element
		.toggleClass( 've-ce-tableCellNode-editing', enable )
		.prop( 'contentEditable', enable.toString() );
};

/**
 * Handle model update events.
 *
 * If the style changed since last update the DOM wrapper will be replaced with an appropriate one.
 *
 * @method
 */
ve.ce.TableCellNode.prototype.onUpdate = function () {
	this.updateTagName();
};

/**
 * Handle attribute changes to keep the live HTML element updated.
 */
ve.ce.TableCellNode.prototype.onAttributeChange = function ( key, from, to ) {
	switch ( key ) {
		case 'colspan':
		case 'rowspan':
			if ( to > 1 ) {
				this.$element.attr( key, to );
			} else {
				this.$element.removeAttr( key );
			}
			break;
		case 'style':
			this.updateTagName();
			break;
	}
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.TableCellNode );

/*!
 * VisualEditor ContentEditable TableNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable table node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.TableNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.TableNode = function VeCeTableNode() {
	// Parent constructor
	ve.ce.TableNode.super.apply( this, arguments );

	this.surface = null;
	this.active = false;
	this.startCell = null;
	this.editingFragment = null;
};

/* Inheritance */

OO.inheritClass( ve.ce.TableNode, ve.ce.BranchNode );

/* Methods */

/**
 * @inheritdoc
 */
ve.ce.TableNode.prototype.onSetup = function () {
	// Parent method
	ve.ce.TableNode.super.prototype.onSetup.call( this );

	// Exit if already setup or not attached
	if ( this.isSetup || !this.root ) {
		return;
	}
	this.surface = this.getRoot().getSurface();

	// DOM changes
	this.$element
		.addClass( 've-ce-tableNode' )
		.prop( 'contentEditable', 'false' );

	// Overlay
	this.$selectionBox = this.$( '<div>' ).addClass( 've-ce-tableNodeOverlay-selection-box' );
	this.$selectionBoxAnchor = this.$( '<div>' ).addClass( 've-ce-tableNodeOverlay-selection-box-anchor' );
	this.colContext = new ve.ui.TableContext( this, 'table-col', {
		$: this.$,
		classes: ['ve-ui-tableContext-colContext'],
		indicator: 'down'
	} );
	this.rowContext = new ve.ui.TableContext( this, 'table-row', {
		$: this.$,
		classes: ['ve-ui-tableContext-rowContext'],
		indicator: 'next'
	} );

	this.$overlay = this.$( '<div>' )
		.addClass( 've-ce-tableNodeOverlay oo-ui-element-hidden' )
		.append( [
			this.$selectionBox,
			this.$selectionBoxAnchor,
			this.colContext.$element,
			this.rowContext.$element,
			this.$rowBracket,
			this.$colBracket
		] );
	this.surface.surface.$blockers.append( this.$overlay );

	// Events
	this.$element.on( {
		'mousedown.ve-ce-tableNode': this.onTableMouseDown.bind( this ),
		'dblclick.ve-ce-tableNode': this.onTableDblClick.bind( this )
	} );
	this.onTableMouseUpHandler = this.onTableMouseUp.bind( this );
	this.onTableMouseMoveHandler = this.onTableMouseMove.bind( this );
	// Select and position events both fire updateOverlay, so debounce. Also makes
	// sure that this.selectedRectangle is up to date before redrawing.
	this.updateOverlayDebounced = ve.debounce( this.updateOverlay.bind( this ) );
	this.surface.getModel().connect( this, { select: 'onSurfaceModelSelect' } );
	this.surface.connect( this, { position: this.updateOverlayDebounced } );
};

/**
 * @inheritdoc
 */
ve.ce.TableNode.prototype.onTeardown = function () {
	// Parent method
	ve.ce.TableNode.super.prototype.onTeardown.call( this );
	// Events
	this.$element.off( '.ve-ce-tableNode' );
	this.surface.getModel().disconnect( this );
	this.surface.disconnect( this );
	this.$overlay.remove();
};

/**
 * Handle table double click events
 *
 * @param {jQuery.Event} e Double click event
 */
ve.ce.TableNode.prototype.onTableDblClick = function ( e ) {
	if ( !this.getCellNodeFromTarget( e.target ) ) {
		return;
	}
	if ( this.surface.getModel().getSelection() instanceof ve.dm.TableSelection ) {
		this.setEditing( true );
	}
};

/**
 * Handle mouse down or touch start events
 *
 * @param {jQuery.Event} e Mouse down or touch start event
 */
ve.ce.TableNode.prototype.onTableMouseDown = function ( e ) {
	var cellNode, startCell, endCell, selection, newSelection;

	if ( e.type === 'touchstart' && e.originalEvent.touches.length > 1 ) {
		// Ignore multi-touch
		return;
	}

	cellNode = this.getCellNodeFromTarget( e.target );
	if ( !cellNode ) {
		return;
	}

	endCell = this.getModel().getMatrix().lookupCell( cellNode.getModel() );
	if ( !endCell ) {
		e.preventDefault();
		return;
	}
	selection = this.surface.getModel().getSelection();
	startCell = e.shiftKey && this.active ? { col: selection.fromCol, row: selection.fromRow } : endCell;
	newSelection = new ve.dm.TableSelection(
		this.getModel().getDocument(),
		this.getModel().getOuterRange(),
		startCell.col,
		startCell.row,
		endCell.col,
		endCell.row,
		true
	);
	if ( this.editingFragment ) {
		if ( newSelection.equals( this.editingFragment.getSelection() ) ) {
			// Clicking on the editing cell, don't prevent default
			return;
		} else {
			this.setEditing( false, true );
		}
	}
	this.surface.getModel().setSelection( newSelection );
	this.startCell = startCell;
	this.surface.$document.on( {
		'mouseup touchend': this.onTableMouseUpHandler,
		'mousemove touchmove': this.onTableMouseMoveHandler
	} );
	e.preventDefault();
};

/**
 * Get the table and cell node from an event target
 *
 * @param {HTMLElement} target Element target to find nearest cell node to
 * @return {ve.ce.TableCellNode|null} Table cell node, or null if none found
 */
ve.ce.TableNode.prototype.getCellNodeFromTarget = function ( target ) {
	var $target = $( target ),
		$table = $target.closest( 'table' );

	// Nested table, ignore
	if ( !this.$element.is( $table ) ) {
		return null;
	}

	return $target.closest( 'td, th' ).data( 'view' );
};

/**
 * Handle mouse/touch move events
 *
 * @param {jQuery.Event} e Mouse/touch move event
 */
ve.ce.TableNode.prototype.onTableMouseMove = function ( e ) {
	var cell, selection, touch, target, cellNode;

	// 'touchmove' doesn't give a correct e.target, so calculate it from coordinates
	if ( e.type === 'touchmove' ) {
		if ( e.originalEvent.touches.length > 1 ) {
			// Ignore multi-touch
			return;
		}
		touch = e.originalEvent.touches[0];
		target = this.surface.getElementDocument().elementFromPoint( touch.clientX, touch.clientY );
	} else {
		target = e.target;
	}

	cellNode = this.getCellNodeFromTarget( target );
	if ( !cellNode ) {
		return;
	}

	cell = this.getModel().matrix.lookupCell( cellNode.getModel() );
	if ( !cell ) {
		return;
	}

	selection = new ve.dm.TableSelection(
		this.getModel().getDocument(),
		this.getModel().getOuterRange(),
		this.startCell.col, this.startCell.row, cell.col, cell.row,
		true
	);
	this.surface.getModel().setSelection( selection );
};

/**
 * Handle mouse up or touch end events
 *
 * @param {jQuery.Event} e Mouse up or touch end event
 */
ve.ce.TableNode.prototype.onTableMouseUp = function () {
	this.startCell = null;
	this.surface.$document.off( {
		'mouseup touchend': this.onTableMouseUpHandler,
		'mousemove touchmove': this.onTableMouseMoveHandler
	} );
};

/**
 * Set the editing state of the table
 *
 * @param {boolean} isEditing The table is being edited
 * @param {boolean} noSelect Don't change the selection
 */
ve.ce.TableNode.prototype.setEditing = function ( isEditing, noSelect ) {
	if ( isEditing ) {
		var cell, selection = this.surface.getModel().getSelection();
		if ( !selection.isSingleCell() ) {
			selection = selection.collapseToFrom();
			this.surface.getModel().setSelection( selection );
		}
		this.editingFragment = this.surface.getModel().getFragment( selection );
		cell = this.getCellNodesFromSelection( selection )[0];
		cell.setEditing( true );
		if ( !noSelect ) {
		// TODO: Find content offset/slug offset within cell
			this.surface.getModel().setLinearSelection( new ve.Range( cell.getModel().getRange().end - 1 ) );
		}
	} else if ( this.editingFragment ) {
		this.getCellNodesFromSelection( this.editingFragment.getSelection() )[0].setEditing( false );
		if ( !noSelect ) {
			this.surface.getModel().setSelection( this.editingFragment.getSelection() );
		}
		this.editingFragment = null;
	}
	this.$element.toggleClass( 've-ce-tableNode-editing', isEditing );
	this.$overlay.toggleClass( 've-ce-tableNodeOverlay-editing', isEditing );
};

/**
 * Get fragment with table selection covering cell being edited
 *
 * @return {ve.dm.SurfaceFragment} Fragment, or null if not cell editing
 */
ve.ce.TableNode.prototype.getEditingFragment = function () {
	return this.editingFragment;
};

/**
 * Get range of cell being edited from editing fragment
 *
 * @return {ve.Range} Range, or null if not cell editing
 */
ve.ce.TableNode.prototype.getEditingRange = function () {
	var fragment = this.getEditingFragment();
	return fragment ? fragment.getSelection().getRanges()[0] : null;
};

/**
 * Handle select events from the surface model.
 *
 * @param {ve.dm.Selection} selection Selection
 */
ve.ce.TableNode.prototype.onSurfaceModelSelect = function ( selection ) {
	// The table is active if it is a linear selection inside a cell being edited
	// or a table selection matching this table.
	var active = (
			this.editingFragment !== null &&
			selection instanceof ve.dm.LinearSelection &&
			this.editingFragment.getSelection().getRanges()[0].containsRange( selection.getRange() )
		) ||
		(
			selection instanceof ve.dm.TableSelection &&
			selection.tableRange.equals( this.getModel().getOuterRange() )
		);

	if ( active ) {
		if ( !this.active ) {
			this.$overlay.removeClass( 'oo-ui-element-hidden' );
			// Only register touchstart event after table has become active to prevent
			// accidental focusing of the table while scrolling
			this.$element.on( 'touchstart.ve-ce-tableNode', this.onTableMouseDown.bind( this ) );
		}
		this.surface.setActiveTableNode( this );
		this.updateOverlayDebounced();
	} else if ( !active && this.active ) {
		this.$overlay.addClass( 'oo-ui-element-hidden' );
		if ( this.editingFragment ) {
			this.setEditing( false, true );
		}
		if ( this.surface.getActiveTableNode() === this ) {
			this.surface.setActiveTableNode( null );
		}
		this.$element.off( 'touchstart.ve-ce-tableNode' );
	}
	this.$element.toggleClass( 've-ce-tableNode-active', active );
	this.active = active;
};

/**
 * Update the overlay positions
 */
ve.ce.TableNode.prototype.updateOverlay = function () {
	if ( !this.active ) {
		return;
	}

	var i, l, nodes, cellOffset, anchorNode, anchorOffset, selectionOffset,
		top, left, bottom, right,
		selection = this.editingFragment ?
			this.editingFragment.getSelection() :
			this.surface.getModel().getSelection(),
		// getBoundingClientRect is more accurate but must be used consistently
		// due to the iOS7 bug where it is relative to the document.
		tableOffset = this.getFirstSectionNode().$element[0].getBoundingClientRect(),
		surfaceOffset = this.surface.getSurface().$element[0].getBoundingClientRect();

	if ( !tableOffset ) {
		return;
	}

	nodes = this.getCellNodesFromSelection( selection );
	anchorNode = this.getCellNodesFromSelection( selection.collapseToFrom() )[0];
	anchorOffset = ve.translateRect( anchorNode.$element[0].getBoundingClientRect(), -tableOffset.left, -tableOffset.top );

	top = Infinity;
	bottom = -Infinity;
	left = Infinity;
	right = -Infinity;

	// Compute a bounding box for the given cell elements
	for ( i = 0, l = nodes.length; i < l; i++) {
		cellOffset = nodes[i].$element[0].getBoundingClientRect();

		top = Math.min( top, cellOffset.top );
		bottom = Math.max( bottom, cellOffset.bottom );
		left = Math.min( left, cellOffset.left );
		right = Math.max( right, cellOffset.right );
	}

	selectionOffset = ve.translateRect(
		{ top: top, bottom: bottom, left: left, right: right, width: right - left, height: bottom - top },
		-tableOffset.left, -tableOffset.top
	);

	// Resize controls
	this.$selectionBox.css( {
		top: selectionOffset.top,
		left: selectionOffset.left,
		width: selectionOffset.width,
		height: selectionOffset.height
	} );
	this.$selectionBoxAnchor.css( {
		top: anchorOffset.top,
		left: anchorOffset.left,
		width: anchorOffset.width,
		height: anchorOffset.height
	} );

	// Position controls
	this.$overlay.css( {
		top: tableOffset.top - surfaceOffset.top,
		left: tableOffset.left - surfaceOffset.left,
		width: tableOffset.width
	} );
	this.colContext.$element.css( {
		left: selectionOffset.left
	} );
	this.colContext.indicator.$element.css( {
		width: selectionOffset.width
	} );
	this.colContext.popup.$element.css( {
		'margin-left': selectionOffset.width / 2
	} );
	this.rowContext.$element.css( {
		top: selectionOffset.top
	} );
	this.rowContext.indicator.$element.css( {
		height: selectionOffset.height
	} );
	this.rowContext.popup.$element.css( {
		'margin-top': selectionOffset.height / 2
	} );

	// Classes
	this.$selectionBox
		.toggleClass( 've-ce-tableNodeOverlay-selection-box-fullRow', selection.isFullRow() )
		.toggleClass( 've-ce-tableNodeOverlay-selection-box-fullCol', selection.isFullCol() );
};

/**
 * Get the first section node of the table, skipping over any caption nodes
 *
 * @return {ve.ce.TableSectionNode} First table section node
 */
ve.ce.TableNode.prototype.getFirstSectionNode = function () {
	var i = 0;
	while ( !( this.children[i] instanceof ve.ce.TableSectionNode ) ) {
		i++;
	}
	return this.children[i];
};

/**
 * Get a cell node from a single cell selection
 *
 * @param {ve.dm.TableSelection} selection Single cell table selection
 * @return {ve.ce.TableCellNode[]} Cell nodes
 */
ve.ce.TableNode.prototype.getCellNodesFromSelection = function ( selection ) {
	var i, l, cellModel, cellView,
		cells = selection.getMatrixCells(),
		nodes = [];

	for ( i = 0, l = cells.length; i < l; i++ ) {
		cellModel = cells[i].node;
		cellView = this.getNodeFromOffset( cellModel.getOffset() - this.model.getOffset() );
		nodes.push( cellView );
	}
	return nodes;
};

/* Static Properties */

ve.ce.TableNode.static.name = 'table';

ve.ce.TableNode.static.tagName = 'table';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.TableNode );

/*!
 * VisualEditor ContentEditable TableRowNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable table row node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.TableRowNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.TableRowNode = function VeCeTableRowNode() {
	// Parent constructor
	ve.ce.TableRowNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.TableRowNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.TableRowNode.static.name = 'tableRow';

ve.ce.TableRowNode.static.tagName = 'tr';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.TableRowNode );

/*!
 * VisualEditor ContentEditable TableSectionNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable table section node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.TableSectionNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.TableSectionNode = function VeCeTableSectionNode() {
	// Parent constructor
	ve.ce.TableSectionNode.super.apply( this, arguments );

	// Events
	this.model.connect( this, { update: 'onUpdate' } );
};

/* Inheritance */

OO.inheritClass( ve.ce.TableSectionNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.TableSectionNode.static.name = 'tableSection';

/* Methods */

/**
 * Get the HTML tag name.
 *
 * Tag name is selected based on the model's style attribute.
 *
 * @returns {string} HTML tag name
 * @throws {Error} If style is invalid
 */
ve.ce.TableSectionNode.prototype.getTagName = function () {
	var style = this.model.getAttribute( 'style' ),
		types = { header: 'thead', body: 'tbody', footer: 'tfoot' };

	if ( !Object.prototype.hasOwnProperty.call( types, style ) ) {
		throw new Error( 'Invalid style' );
	}
	return types[style];
};

/**
 * Handle model update events.
 *
 * If the style changed since last update the DOM wrapper will be replaced with an appropriate one.
 *
 * @method
 */
ve.ce.TableSectionNode.prototype.onUpdate = function () {
	this.updateTagName();
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.TableSectionNode );

/*!
 * VisualEditor ContentEditable TextNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable text node.
 *
 * @class
 * @extends ve.ce.LeafNode
 * @constructor
 * @param {ve.dm.TextNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.TextNode = function VeCeTextNode() {
	// Parent constructor
	ve.ce.TextNode.super.apply( this, arguments );

	this.$element = $( [] );
};

/* Inheritance */

OO.inheritClass( ve.ce.TextNode, ve.ce.LeafNode );

/* Static Properties */

ve.ce.TextNode.static.name = 'text';

ve.ce.TextNode.static.splitOnEnter = true;

ve.ce.TextNode.whitespaceHtmlCharacters = {
	'\n': '\u21b5', // &crarr; / ↵
	'\t': '\u279e' // &#10142; / ➞
};

/* Methods */

/**
 * Get an HTML rendering of the text.
 *
 * @method
 * @returns {Array} Array of rendered HTML fragments with annotations
 */
ve.ce.TextNode.prototype.getAnnotatedHtml = function () {
	var i, chr,
		data = this.model.getDocument().getDataFromNode( this.model ),
		whitespaceHtmlChars = ve.ce.TextNode.whitespaceHtmlCharacters,
		significantWhitespace = this.getModel().getParent().hasSignificantWhitespace();

	function setChar( chr, index, data ) {
		if ( Array.isArray( data[index] ) ) {
			// Don't modify the original array, clone it first
			data[index] = data[index].slice( 0 );
			data[index][0] = chr;
		} else {
			data[index] = chr;
		}
	}

	function getChar( index, data ) {
		if ( Array.isArray( data[index] ) ) {
			return data[index][0];
		} else {
			return data[index];
		}
	}

	if ( !significantWhitespace ) {
		// Replace spaces with &nbsp; where needed
		// \u00a0 == &#160; == &nbsp;
		if ( data.length > 0 ) {
			// Leading space
			if ( getChar( 0, data ) === ' ' ) {
				setChar( '\u00a0', 0, data );
			}
		}
		if ( data.length > 1 ) {
			// Trailing space
			if ( getChar( data.length - 1, data ) === ' ' ) {
				setChar( '\u00a0', data.length - 1, data );
			}
		}

		for ( i = 0; i < data.length; i++ ) {
			chr = getChar( i, data );

			// Replace any sequence of 2+ spaces with an alternating pattern
			// (space-nbsp-space-nbsp-...).
			// The leading and trailing space, if present, have already been converted
			// to nbsp, so we know that i is between 1 and data.length - 2.
			if ( chr === ' ' && getChar( i + 1, data ) === ' ' ) {
				setChar( '\u00a0', i + 1, data );
			}

			// Show meaningful whitespace characters
			if ( Object.prototype.hasOwnProperty.call( whitespaceHtmlChars, chr ) ) {
				setChar( whitespaceHtmlChars[chr], i, data );
			}
		}
	}
	return data;
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.TextNode );

/*!
 * VisualEditor ContentEditable ImageNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable image node.
 *
 * @class
 * @abstract
 * @mixins ve.ce.FocusableNode
 * @mixins ve.ce.ResizableNode
 *
 * @constructor
 * @param {jQuery} $figure Image or figure element
 * @param {jQuery} [$image] Actual image element, if $figure is just a container
 * @param {Object} [config] Configuration options
 */
ve.ce.ImageNode = function VeCeImageNode( $figure, $image, config ) {
	config = ve.extendObject( {
		enforceMax: false,
		minDimensions: { width: 1, height: 1 }
	}, config );

	this.$figure = $figure;
	this.$image = $image || $figure;

	// Mixin constructors
	ve.ce.FocusableNode.call( this, this.$figure, config );
	ve.ce.ResizableNode.call( this, this.$image, config );

	// Events
	this.$image.on( 'load', this.onLoad.bind( this ) );
	this.model.connect( this, { attributeChange: 'onAttributeChange' } );

	// Initialization
	this.$element.addClass( 've-ce-imageNode' );
};

/* Inheritance */

OO.mixinClass( ve.ce.ImageNode, ve.ce.FocusableNode );

OO.mixinClass( ve.ce.ImageNode, ve.ce.ResizableNode );

/* Static Methods */

/**
 * @inheritdoc ve.ce.Node
 */
ve.ce.ImageNode.static.getDescription = function ( model ) {
	return model.getAttribute( 'src' );
};

/* Methods */

/**
 * Update the rendering of the 'align', src', 'width' and 'height' attributes
 * when they change in the model.
 *
 * @method
 * @param {string} key Attribute key
 * @param {string} from Old value
 * @param {string} to New value
 */
ve.ce.ImageNode.prototype.onAttributeChange = function ( key, from, to ) {
	switch ( key ) {
		case 'src':
			this.$image.prop( 'src', this.getResolvedAttribute( 'src' ) );
			break;

		case 'width':
		case 'height':
			this.$image.css( key, to !== null ? to : '' );
			break;
	}
};

/**
 * Handle the image load
 *
 * @method
 * @param {jQuery.Event} e Load event
 */
ve.ce.ImageNode.prototype.onLoad = function () {
	this.setOriginalDimensions( {
		width: this.$image.prop( 'naturalWidth' ),
		height: this.$image.prop( 'naturalHeight' )
	} );
};

/*!
 * VisualEditor ContentEditable block image node class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable block image node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @mixins ve.ce.ImageNode
 * @mixins ve.ce.AlignableNode
 *
 * @constructor
 * @param {ve.dm.BlockImageNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.BlockImageNode = function VeCeBlockImageNode( model, config ) {
	config = ve.extendObject( {
		minDimensions: { width: 1, height: 1 }
	}, config );

	// Parent constructor
	ve.ce.BlockImageNode.super.call( this, model, config );

	// Build DOM
	this.$image = this.$( '<img>' )
		.prop( 'src', this.getResolvedAttribute( 'src' ) )
		.prependTo( this.$element );

	// Mixin constructors
	ve.ce.ImageNode.call( this, this.$element, this.$image, config );
	ve.ce.AlignableNode.call( this, this.$element, config );

	// Initialization
	this.$element.addClass( 've-ce-blockImageNode' );
	this.$image
		.prop( {
			alt: this.model.getAttribute( 'alt' ),
			src: this.getResolvedAttribute( 'src' )
		} )
		.css( {
			width: this.model.getAttribute( 'width' ),
			height: this.model.getAttribute( 'height' )
		} );
};

/* Inheritance */

OO.inheritClass( ve.ce.BlockImageNode, ve.ce.BranchNode );

OO.mixinClass( ve.ce.BlockImageNode, ve.ce.ImageNode );

OO.mixinClass( ve.ce.BlockImageNode, ve.ce.AlignableNode );

/* Static Properties */

ve.ce.BlockImageNode.static.name = 'blockImage';

ve.ce.BlockImageNode.static.tagName = 'figure';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.BlockImageNode );

/*!
 * VisualEditor ContentEditable block image caption node class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable block image caption item node.
 *
 * @class
 * @extends ve.ce.BranchNode
 * @constructor
 * @param {ve.dm.BlockImageCaptionNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.BlockImageCaptionNode = function VeCeBlockImageCaptionNode() {
	// Parent constructor
	ve.ce.BlockImageCaptionNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ce.BlockImageCaptionNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.BlockImageCaptionNode.static.name = 'imageCaption';

ve.ce.BlockImageCaptionNode.static.tagName = 'figcaption';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.BlockImageCaptionNode );

/*!
 * VisualEditor ContentEditable InlineImageNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable inline image node.
 *
 * @class
 * @extends ve.ce.LeafNode
 * @mixins ve.ce.ImageNode
 * @mixins ve.ce.ResizableNode
 *
 * @constructor
 * @param {ve.dm.InlineImageNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.InlineImageNode = function VeCeInlineImageNode( model, config ) {
	config = ve.extendObject( {
		minDimensions: { width: 1, height: 1 }
	}, config );

	// Parent constructor
	ve.ce.InlineImageNode.super.call( this, model, config );

	// Mixin constructors
	ve.ce.ImageNode.call( this, this.$element, null, config );

	// Initialization
	this.$element
		.addClass( 've-ce-inlineImageNode' )
		.prop( {
			alt: this.model.getAttribute( 'alt' ),
			src: this.getResolvedAttribute( 'src' )
		} )
		.css( {
			width: this.model.getAttribute( 'width' ),
			height: this.model.getAttribute( 'height' )
		} );
};

/* Inheritance */

OO.inheritClass( ve.ce.InlineImageNode, ve.ce.LeafNode );

OO.mixinClass( ve.ce.InlineImageNode, ve.ce.ImageNode );

/* Static Properties */

ve.ce.InlineImageNode.static.name = 'inlineImage';

ve.ce.InlineImageNode.static.tagName = 'img';

/* Registration */

ve.ce.nodeFactory.register( ve.ce.InlineImageNode );

ve.ce.SectionNode = function VeCeSectionNode() {
  // Parent constructor
  ve.ce.SectionNode.super.apply( this, arguments );

  this.$element.addClass('ve-ce-sectionnode');
};

/* Inheritance */

OO.inheritClass( ve.ce.SectionNode, ve.ce.BranchNode );

/* Static Properties */

ve.ce.SectionNode.static.name = 'section';

ve.ce.SectionNode.static.tagName = 'section';

/* Methods */

/* Registration */

ve.ce.nodeFactory.register( ve.ce.SectionNode );

/*!
 * VisualEditor ContentEditable LanguageAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable language annotation.
 *
 * @class
 * @extends ve.ce.Annotation
 * @constructor
 * @param {ve.dm.LanguageAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.LanguageAnnotation = function VeCeLanguageAnnotation() {
	// Parent constructor
	ve.ce.LanguageAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element
		.addClass( 've-ce-languageAnnotation' )
		.addClass( 've-ce-bidi-isolate' )
		.prop( {
			lang: this.model.getAttribute( 'lang' ),
			dir: this.model.getAttribute( 'dir' ),
			title: this.constructor.static.getDescription( this.model )
		} );
};

/* Inheritance */

OO.inheritClass( ve.ce.LanguageAnnotation, ve.ce.Annotation );

/* Static Properties */

ve.ce.LanguageAnnotation.static.name = 'meta/language';

ve.ce.LanguageAnnotation.static.tagName = 'span';

/* Static Methods */

/**
 * @inheritdoc
 */
ve.ce.LanguageAnnotation.static.getDescription = function ( model ) {
	var lang = ( model.getAttribute( 'lang' ) || '' ).toLowerCase(),
		name = ve.init.platform.getLanguageName( lang ),
		dir = ( model.getAttribute( 'dir' ) || '' ).toUpperCase();

	if ( !dir || dir === ve.init.platform.getLanguageDirection( lang ).toUpperCase() ) {
		return ve.msg( 'visualeditor-languageannotation-description', name );
	}

	return ve.msg( 'visualeditor-languageannotation-description-with-dir', name, dir );
};

/* Registration */

ve.ce.annotationFactory.register( ve.ce.LanguageAnnotation );

/*!
 * VisualEditor ContentEditable LinkAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable link annotation.
 *
 * @class
 * @extends ve.ce.Annotation
 * @constructor
 * @param {ve.dm.LinkAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.LinkAnnotation = function VeCeLinkAnnotation() {
	// Parent constructor
	ve.ce.LinkAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element
		.addClass( 've-ce-linkAnnotation' )
		.prop( {
			href: ve.resolveUrl( this.model.getHref(), this.getModelHtmlDocument() ),
			title: this.constructor.static.getDescription( this.model )
		} )
		// Some browsers will try to let links do their thing
		// (e.g. iOS Safari when the keyboard is closed)
		.on( 'click', function ( e ) {
			// Don't prevent a modified click which in some browsers deliberately opens the link
			if ( !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey ) {
				e.preventDefault();
			}
		} );
};

/* Inheritance */

OO.inheritClass( ve.ce.LinkAnnotation, ve.ce.Annotation );

/* Static Properties */

ve.ce.LinkAnnotation.static.name = 'link';

ve.ce.LinkAnnotation.static.tagName = 'a';

ve.ce.LinkAnnotation.static.forceContinuation = true;

/* Static Methods */

/**
 * @inheritdoc
 */
ve.ce.LinkAnnotation.static.getDescription = function ( model ) {
	return model.getHref();
};

/* Registration */

ve.ce.annotationFactory.register( ve.ce.LinkAnnotation );

/*!
 * VisualEditor ContentEditable TextStyleAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable text style annotation.
 *
 * @class
 * @abstract
 * @extends ve.ce.Annotation
 * @constructor
 * @param {ve.dm.TextStyleAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.TextStyleAnnotation = function VeCeTextStyleAnnotation() {
	// Parent constructor
	ve.ce.TextStyleAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-textStyleAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.TextStyleAnnotation, ve.ce.Annotation );

/* Static Properties */

ve.ce.TextStyleAnnotation.static.name = 'textStyle';

/* Methods */

ve.ce.TextStyleAnnotation.prototype.getTagName = function () {
	return this.getModel().getAttribute( 'nodeName' ) || this.constructor.static.tagName;
};

/* Registration */

ve.ce.annotationFactory.register( ve.ce.TextStyleAnnotation );

/*!
 * VisualEditor ContentEditable AbbreviationAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable abbreviation annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.AbbreviationAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.AbbreviationAnnotation = function VeCeAbbreviationAnnotation() {
	// Parent constructor
	ve.ce.AbbreviationAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-abbreviationAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.AbbreviationAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.AbbreviationAnnotation.static.name = 'textStyle/abbreviation';

ve.ce.AbbreviationAnnotation.static.tagName = 'abbr';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.AbbreviationAnnotation );

/*!
 * VisualEditor ContentEditable BigAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable big annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.BigAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.BigAnnotation = function VeCeBigAnnotation() {
	// Parent constructor
	ve.ce.BigAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-bigAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.BigAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.BigAnnotation.static.name = 'textStyle/big';

ve.ce.BigAnnotation.static.tagName = 'big';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.BigAnnotation );

/*!
 * VisualEditor ContentEditable BoldAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable bold annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.BoldAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.BoldAnnotation = function VeCeBoldAnnotation() {
	// Parent constructor
	ve.ce.BoldAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-boldAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.BoldAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.BoldAnnotation.static.name = 'textStyle/bold';

ve.ce.BoldAnnotation.static.tagName = 'b';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.BoldAnnotation );

/*!
 * VisualEditor ContentEditable CodeAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable code annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.CodeAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.CodeAnnotation = function VeCeCodeAnnotation() {
	// Parent constructor
	ve.ce.CodeAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-codeAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.CodeAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.CodeAnnotation.static.name = 'textStyle/code';

ve.ce.CodeAnnotation.static.tagName = 'code';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.CodeAnnotation );

/*!
 * VisualEditor ContentEditable CodeSampleAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable code sample annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.CodeSampleAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.CodeSampleAnnotation = function VeCeCodeSampleAnnotation() {
	// Parent constructor
	ve.ce.CodeSampleAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-codeSampleAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.CodeSampleAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.CodeSampleAnnotation.static.name = 'textStyle/codeSample';

ve.ce.CodeSampleAnnotation.static.tagName = 'samp';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.CodeSampleAnnotation );

/*!
 * VisualEditor ContentEditable DatetimeAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable datetime annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.DatetimeAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.DatetimeAnnotation = function VeCeDatetimeAnnotation() {
	// Parent constructor
	ve.ce.DatetimeAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-datetimeAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.DatetimeAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.DatetimeAnnotation.static.name = 'textStyle/datetime';

ve.ce.DatetimeAnnotation.static.tagName = 'time';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.DatetimeAnnotation );

/*!
 * VisualEditor ContentEditable DefinitionAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable definition annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.DefinitionAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.DefinitionAnnotation = function VeCeDefinitionAnnotation() {
	// Parent constructor
	ve.ce.DefinitionAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-definitionAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.DefinitionAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.DefinitionAnnotation.static.name = 'textStyle/definition';

ve.ce.DefinitionAnnotation.static.tagName = 'dfn';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.DefinitionAnnotation );

/*!
 * VisualEditor ContentEditable HighlightAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable highlight annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.HighlightAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.HighlightAnnotation = function VeCeHighlightAnnotation() {
	// Parent constructor
	ve.ce.HighlightAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-highlightAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.HighlightAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.HighlightAnnotation.static.name = 'textStyle/highlight';

ve.ce.HighlightAnnotation.static.tagName = 'mark';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.HighlightAnnotation );

/*!
 * VisualEditor ContentEditable ItalicAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable italic annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.ItalicAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.ItalicAnnotation = function VeCeItalicAnnotation() {
	// Parent constructor
	ve.ce.ItalicAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-italicAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.ItalicAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.ItalicAnnotation.static.name = 'textStyle/italic';

ve.ce.ItalicAnnotation.static.tagName = 'i';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.ItalicAnnotation );

/*!
 * VisualEditor ContentEditable QuotationAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable quotation annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.QuotationAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.QuotationAnnotation = function VeCeQuotationAnnotation() {
	// Parent constructor
	ve.ce.QuotationAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-quotationAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.QuotationAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.QuotationAnnotation.static.name = 'textStyle/quotation';

ve.ce.QuotationAnnotation.static.tagName = 'q';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.QuotationAnnotation );

/*!
 * VisualEditor ContentEditable SmallAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable small annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.SmallAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.SmallAnnotation = function VeCeSmallAnnotation() {
	// Parent constructor
	ve.ce.SmallAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-smallAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.SmallAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.SmallAnnotation.static.name = 'textStyle/small';

ve.ce.SmallAnnotation.static.tagName = 'small';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.SmallAnnotation );

/*!
 * VisualEditor ContentEditable SpanAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable span annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.SpanAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.SpanAnnotation = function VeCeSpanAnnotation() {
	// Parent constructor
	ve.ce.SpanAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-spanAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.SpanAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.SpanAnnotation.static.name = 'textStyle/span';

ve.ce.SpanAnnotation.static.tagName = 'span';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.SpanAnnotation );

/*!
 * VisualEditor ContentEditable StrikethroughAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable strikethrough annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.StrikethroughAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.StrikethroughAnnotation = function VeCeStrikethroughAnnotation() {
	// Parent constructor
	ve.ce.StrikethroughAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-strikethroughAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.StrikethroughAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.StrikethroughAnnotation.static.name = 'textStyle/strikethrough';

ve.ce.StrikethroughAnnotation.static.tagName = 's';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.StrikethroughAnnotation );

/*!
 * VisualEditor ContentEditable SubscriptAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable subscript annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.SubscriptAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.SubscriptAnnotation = function VeCeSubscriptAnnotation() {
	// Parent constructor
	ve.ce.SubscriptAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-subscriptAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.SubscriptAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.SubscriptAnnotation.static.name = 'textStyle/subscript';

ve.ce.SubscriptAnnotation.static.tagName = 'sub';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.SubscriptAnnotation );

/*!
 * VisualEditor ContentEditable SuperscriptAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable superscript annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.SuperscriptAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.SuperscriptAnnotation = function VeCeSuperscriptAnnotation() {
	// Parent constructor
	ve.ce.SuperscriptAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-superscriptAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.SuperscriptAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.SuperscriptAnnotation.static.name = 'textStyle/superscript';

ve.ce.SuperscriptAnnotation.static.tagName = 'sup';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.SuperscriptAnnotation );

/*!
 * VisualEditor ContentEditable UnderlineAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable underline annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.UnderlineAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.UnderlineAnnotation = function VeCeUnderlineAnnotation() {
	// Parent constructor
	ve.ce.UnderlineAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-underlineAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.UnderlineAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.UnderlineAnnotation.static.name = 'textStyle/underline';

ve.ce.UnderlineAnnotation.static.tagName = 'u';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.UnderlineAnnotation );

/*!
 * VisualEditor ContentEditable UserInputAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable user input annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.UserInputAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.UserInputAnnotation = function VeCeUserInputAnnotation() {
	// Parent constructor
	ve.ce.UserInputAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-userInputAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.UserInputAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.UserInputAnnotation.static.name = 'textStyle/userInput';

ve.ce.UserInputAnnotation.static.tagName = 'kbd';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.UserInputAnnotation );

/*!
 * VisualEditor ContentEditable VariableAnnotation class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * ContentEditable variable annotation.
 *
 * @class
 * @extends ve.ce.TextStyleAnnotation
 * @constructor
 * @param {ve.dm.VariableAnnotation} model Model to observe
 * @param {ve.ce.ContentBranchNode} [parentNode] Node rendering this annotation
 * @param {Object} [config] Configuration options
 */
ve.ce.VariableAnnotation = function VeCeVariableAnnotation() {
	// Parent constructor
	ve.ce.VariableAnnotation.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-variableAnnotation' );
};

/* Inheritance */

OO.inheritClass( ve.ce.VariableAnnotation, ve.ce.TextStyleAnnotation );

/* Static Properties */

ve.ce.VariableAnnotation.static.name = 'textStyle/variable';

ve.ce.VariableAnnotation.static.tagName = 'var';

/* Registration */

ve.ce.annotationFactory.register( ve.ce.VariableAnnotation );
