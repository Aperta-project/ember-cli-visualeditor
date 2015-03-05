/*!
 * VisualEditor UserInterface namespace.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Namespace for all VisualEditor UserInterface classes, static methods and static properties.
 *
 * @class
 * @singleton
 */
ve.ui = {
	// 'actionFactory' instantiated in ve.ui.ActionFactory.js
	// 'commandRegistry' instantiated in ve.ui.CommandRegistry.js
	// 'triggerRegistry' instantiated in ve.ui.TriggerRegistry.js
	// 'toolFactory' instantiated in ve.ui.ToolFactory.js
	// 'dataTransferHandlerFactory' instantiated in ve.ui.DataTransferHandlerFactory.js
	windowFactory: new OO.Factory()
};

ve.ui.windowFactory.register( OO.ui.MessageDialog );

/*!
 * VisualEditor UserInterface Overlay class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Container for content that should appear in front of everything else.
 *
 * @class
 * @abstract
 * @extends OO.ui.Element
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.Overlay = function VeUiOverlay( config ) {
	// Parent constructor
	OO.ui.Element.call( this, config );

	// Initialization
	this.$element.addClass( 've-ui-overlay' );
};

/* Inheritance */

OO.inheritClass( ve.ui.Overlay, OO.ui.Element );

/*!
 * VisualEditor UserInterface Surface class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * A surface is a top-level object which contains both a surface model and a surface view.
 *
 * @class
 * @abstract
 * @extends OO.ui.Element
 * @mixins OO.EventEmitter
 *
 * @constructor
 * @param {HTMLDocument|Array|ve.dm.LinearData|ve.dm.Document|ve.dm.Surface} dataOrDocOrSurface Document data to edit
 * @param {Object} [config] Configuration options
 * @cfg {string[]} [excludeCommands] List of commands to exclude
 * @cfg {Object} [importRules] Import rules
 */
ve.ui.Surface = function VeUiSurface( dataOrDocOrSurface, config ) {
	config = config || {};

	var documentModel;

	// Parent constructor
	OO.ui.Element.call( this, config );

	// Mixin constructor
	OO.EventEmitter.call( this, config );

	// Properties
	this.globalOverlay = new ve.ui.Overlay( { classes: ['ve-ui-overlay-global'] } );
	this.localOverlay = new ve.ui.Overlay( { $: this.$, classes: ['ve-ui-overlay-local'] } );
	this.$selections = this.$( '<div>' );
	this.$blockers = this.$( '<div>' );
	this.$controls = this.$( '<div>' );
	this.$menus = this.$( '<div>' );
	this.triggerListener = new ve.TriggerListener( OO.simpleArrayDifference(
		Object.keys( ve.ui.commandRegistry.registry ), config.excludeCommands || []
	) );
	if ( dataOrDocOrSurface instanceof ve.dm.Document ) {
		// ve.dm.Document
		documentModel = dataOrDocOrSurface;
	} else if ( dataOrDocOrSurface instanceof ve.dm.LinearData || Array.isArray( dataOrDocOrSurface ) ) {
		// LinearData or raw linear data
		documentModel = new ve.dm.Document( dataOrDocOrSurface );
	} else if ( dataOrDocOrSurface instanceof ve.dm.Surface ) {
		this.model = dataOrDocOrSurface;
		this.documentModel = this.model.getDocument();
	} else {
		// HTMLDocument
		documentModel = ve.dm.converter.getModelFromDom( dataOrDocOrSurface );
	}
	this.model = this.model || new ve.dm.Surface( documentModel );
	this.view = new ve.ce.Surface( this.model, this, { $: this.$ } );
	this.dialogs = this.createDialogWindowManager();
	this.importRules = config.importRules || {};
	this.enabled = true;
	this.context = this.createContext();
	this.progresses = [];
	this.showProgressDebounced = ve.debounce( this.showProgress.bind( this ) );
	this.filibuster = null;
	this.debugBar = null;

	this.toolbarHeight = 0;
	this.toolbarDialogs = new ve.ui.ToolbarDialogWindowManager( {
		$: this.$,
		factory: ve.ui.windowFactory,
		modal: false
	} );

	// Initialization
	this.$menus.append( this.context.$element );
	this.$element
		.addClass( 've-ui-surface' )
		.append( this.view.$element );
	this.view.$element.after( this.localOverlay.$element );
	this.localOverlay.$element.append( this.$selections, this.$blockers, this.$controls, this.$menus );
	this.globalOverlay.$element.append( this.dialogs.$element );
};

/* Inheritance */

OO.inheritClass( ve.ui.Surface, OO.ui.Element );

OO.mixinClass( ve.ui.Surface, OO.EventEmitter );

/* Events */

/**
 * When a surface is destroyed.
 *
 * @event destroy
 */

/* Methods */

/**
 * Destroy the surface, releasing all memory and removing all DOM elements.
 *
 * @method
 * @fires destroy
 */
ve.ui.Surface.prototype.destroy = function () {
	// Stop periodic history tracking in model
	this.model.stopHistoryTracking();

	// Disconnect events
	this.dialogs.disconnect( this );

	// Destroy the ce.Surface, the ui.Context and window managers
	this.view.destroy();
	this.context.destroy();
	this.dialogs.destroy();
	this.toolbarDialogs.destroy();
	if ( this.debugBar ) {
		this.debugBar.destroy();
	}

	// Remove DOM elements
	this.$element.remove();
	this.globalOverlay.$element.remove();

	// Let others know we have been destroyed
	this.emit( 'destroy' );
};

/**
 * Initialize surface.
 *
 * This must be called after the surface has been attached to the DOM.
 */
ve.ui.Surface.prototype.initialize = function () {
	// Attach globalOverlay to the global <body>, not the local frame's <body>
	$( 'body' ).append( this.globalOverlay.$element );

	if ( ve.debug ) {
		this.setupDebugBar();
	}

	// The following classes can be used here:
	// ve-ui-surface-dir-ltr
	// ve-ui-surface-dir-rtl
	this.$element.addClass( 've-ui-surface-dir-' + this.getDir() );

	this.getView().initialize();
	this.getModel().startHistoryTracking();
};

/**
 * Create a context.
 *
 * @method
 * @abstract
 * @return {ve.ui.Context} Context
 * @throws {Error} If this method is not overridden in a concrete subclass
 */
ve.ui.Surface.prototype.createContext = function () {
	throw new Error( 've.ui.Surface.createContext must be overridden in subclass' );
};

/**
 * Create a dialog window manager.
 *
 * @method
 * @abstract
 * @return {ve.ui.WindowManager} Dialog window manager
 * @throws {Error} If this method is not overridden in a concrete subclass
 */
ve.ui.Surface.prototype.createDialogWindowManager = function () {
	throw new Error( 've.ui.Surface.createDialogWindowManager must be overridden in subclass' );
};

/**
 * Set up the debug bar and insert it into the DOM.
 */
ve.ui.Surface.prototype.setupDebugBar = function () {
	this.debugBar = new ve.ui.DebugBar( this );
	this.debugBar.$element.insertAfter( this.$element );
};

/**
 * Get the bounding rectangle of the surface, relative to the viewport.
 * @returns {Object} Object with top, bottom, left, right, width and height properties.
 */
ve.ui.Surface.prototype.getBoundingClientRect = function () {
	// We would use getBoundingClientRect(), but in iOS7 that's relative to the
	// document rather than to the viewport
	return this.$element[0].getClientRects()[0];
};

/**
 * Check if editing is enabled.
 *
 * @method
 * @returns {boolean} Editing is enabled
 */
ve.ui.Surface.prototype.isEnabled = function () {
	return this.enabled;
};

/**
 * Get the surface model.
 *
 * @method
 * @returns {ve.dm.Surface} Surface model
 */
ve.ui.Surface.prototype.getModel = function () {
	return this.model;
};

/**
 * Get the surface view.
 *
 * @method
 * @returns {ve.ce.Surface} Surface view
 */
ve.ui.Surface.prototype.getView = function () {
	return this.view;
};

/**
 * Get the context menu.
 *
 * @method
 * @returns {ve.ui.Context} Context user interface
 */
ve.ui.Surface.prototype.getContext = function () {
	return this.context;
};

/**
 * Get dialogs window set.
 *
 * @method
 * @returns {ve.ui.WindowManager} Dialogs window set
 */
ve.ui.Surface.prototype.getDialogs = function () {
	return this.dialogs;
};

/**
 * Get toolbar dialogs window set.
 * @returns {ve.ui.WindowManager} Toolbar dialogs window set
 */
ve.ui.Surface.prototype.getToolbarDialogs = function () {
	return this.toolbarDialogs;
};

/**
 * Get the local overlay.
 *
 * Local overlays are attached to the same frame as the surface.
 *
 * @method
 * @returns {ve.ui.Overlay} Local overlay
 */
ve.ui.Surface.prototype.getLocalOverlay = function () {
	return this.localOverlay;
};

/**
 * Get the global overlay.
 *
 * Global overlays are attached to the top-most frame.
 *
 * @method
 * @returns {ve.ui.Overlay} Global overlay
 */
ve.ui.Surface.prototype.getGlobalOverlay = function () {
	return this.globalOverlay;
};

/**
 * Disable editing.
 *
 * @method
 */
ve.ui.Surface.prototype.disable = function () {
	this.view.disable();
	this.model.disable();
	this.enabled = false;
};

/**
 * Enable editing.
 *
 * @method
 */
ve.ui.Surface.prototype.enable = function () {
	this.enabled = true;
	this.view.enable();
	this.model.enable();
};

/**
 * Execute an action or command.
 *
 * @method
 * @param {ve.ui.Trigger|string} triggerOrAction Trigger or symbolic name of action
 * @param {string} [method] Action method name
 * @param {Mixed...} [args] Additional arguments for action
 * @returns {boolean} Action or command was executed
 */
ve.ui.Surface.prototype.execute = function ( triggerOrAction, method ) {
	var command, obj, ret;

	if ( !this.enabled ) {
		return;
	}

	if ( triggerOrAction instanceof ve.ui.Trigger ) {
		command = this.triggerListener.getCommandByTrigger( triggerOrAction.toString() );
		if ( command ) {
			// Have command call execute with action arguments
			return command.execute( this );
		}
	} else if ( typeof triggerOrAction === 'string' && typeof method === 'string' ) {
		// Validate method
		if ( ve.ui.actionFactory.doesActionSupportMethod( triggerOrAction, method ) ) {
			// Create an action object and execute the method on it
			obj = ve.ui.actionFactory.create( triggerOrAction, this );
			ret = obj[method].apply( obj, Array.prototype.slice.call( arguments, 2 ) );
			return ret === undefined || !!ret;
		}
	}
	return false;
};

/**
 * Set the current height of the toolbar.
 *
 * Used for scroll-into-view calculations.
 *
 * @param {number} toolbarHeight Toolbar height
 */
ve.ui.Surface.prototype.setToolbarHeight = function ( toolbarHeight ) {
	this.toolbarHeight = toolbarHeight;
};

/**
 * Create a progress bar in the progress dialog
 *
 * @param {jQuery.Promise} progressCompletePromise Promise which resolves when the progress action is complete
 * @param {jQuery|string|Function} label Progress bar label
 * @return {jQuery.Promise} Promise which resolves with a progress bar widget and a promise which fails if cancelled
 */
ve.ui.Surface.prototype.createProgress = function ( progressCompletePromise, label ) {
	var progressBarDeferred = $.Deferred();

	this.progresses.push( {
		label: label,
		progressCompletePromise: progressCompletePromise,
		progressBarDeferred: progressBarDeferred
	} );

	this.showProgressDebounced();

	return progressBarDeferred.promise();
};

ve.ui.Surface.prototype.showProgress = function () {
	var dialogs = this.dialogs,
		progresses = this.progresses;

	dialogs.openWindow( 'progress', { progresses: progresses } );
	this.progresses = [];
};

/**
 * Get sanitization rules for rich paste
 *
 * @returns {Object} Import rules
 */
ve.ui.Surface.prototype.getImportRules = function () {
	return this.importRules;
};

/**
 * Surface 'dir' property (GUI/User-Level Direction)
 *
 * @returns {string} 'ltr' or 'rtl'
 */
ve.ui.Surface.prototype.getDir = function () {
	return this.$element.css( 'direction' );
};

ve.ui.Surface.prototype.initFilibuster = function () {
	var surface = this;
	this.filibuster = new ve.Filibuster()
		.wrapClass( ve.EventSequencer )
		.wrapNamespace( ve.dm, 've.dm', [
			// blacklist
			ve.dm.LinearSelection.prototype.getDescription,
			ve.dm.TableSelection.prototype.getDescription,
			ve.dm.NullSelection.prototype.getDescription
		] )
		.wrapNamespace( ve.ce, 've.ce' )
		.wrapNamespace( ve.ui, 've.ui', [
			// blacklist
			ve.ui.Surface.prototype.startFilibuster,
			ve.ui.Surface.prototype.stopFilibuster
		] )
		.setObserver( 'dm doc', function () {
			return JSON.stringify( surface.model.documentModel.data.data );
		} )
		.setObserver( 'dm selection', function () {
			var selection = surface.model.selection;
			if ( !selection ) {
				return null;
			}
			return selection.getDescription();
		} )
		.setObserver( 'DOM doc', function () {
			return ve.serializeNodeDebug( surface.view.$element[0] );
		} )
		.setObserver( 'DOM selection', function () {
			var nativeRange,
				nativeSelection = surface.view.nativeSelection;
			if ( nativeSelection.rangeCount === 0 ) {
				return null;
			}
			nativeRange = nativeSelection.getRangeAt( 0 );
			return JSON.stringify( {
				startContainer: ve.serializeNodeDebug( nativeRange.startContainer ),
				startOffset: nativeRange.startOffset,
				endContainer: (
					nativeRange.startContainer === nativeRange.endContainer ?
					'(=startContainer)' :
					ve.serializeNodeDebug( nativeRange.endContainer )
				),
				endOffset: nativeRange.endOffset
			} );
		} );
};

ve.ui.Surface.prototype.startFilibuster = function () {
	if ( !this.filibuster ) {
		this.initFilibuster();
	} else {
		this.filibuster.clearLogs();
	}
	this.filibuster.start();
};

ve.ui.Surface.prototype.stopFilibuster = function () {
	this.filibuster.stop();
};

/*!
 * VisualEditor UserInterface Context class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface context.
 *
 * @class
 * @abstract
 * @extends OO.ui.Element
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {Object} [config] Configuration options
 */
ve.ui.Context = function VeUiContext( surface, config ) {
	// Parent constructor
	OO.ui.Element.call( this, config );

	// Properties
	this.surface = surface;
	this.visible = false;
	this.inspector = null;
	this.inspectors = this.createInspectorWindowManager();
	this.menu = new ve.ui.ContextSelectWidget( { $: this.$ } );
	this.lastSelectedNode = null;
	this.afterContextChangeTimeout = null;
	this.afterContextChangeHandler = this.afterContextChange.bind( this );
	this.updateDimensionsDebounced = ve.debounce( this.updateDimensions.bind( this ) );

	// Events
	this.surface.getModel().connect( this, { contextChange: 'onContextChange' } );
	this.inspectors.connect( this, { opening: 'onInspectorOpening' } );
	this.menu.connect( this, { choose: 'onContextItemChoose' } );

	// Initialization
	// Hide element using a class, not this.toggle, as child implementations
	// of toggle may require the instance to be fully constructed before running.
	this.$element
		.addClass( 've-ui-context oo-ui-element-hidden' );
	this.menu.toggle( false );
	this.inspectors.$element.addClass( 've-ui-context-inspectors' );
};

/* Inheritance */

OO.inheritClass( ve.ui.Context, OO.ui.Element );

/* Methods */

/**
 * Handle context change event.
 *
 * While an inspector is opening or closing, all changes are ignored so as to prevent inspectors
 * that change the selection from within their setup or teardown processes changing context state.
 *
 * The response to selection changes is deferred to prevent teardown processes handlers that change
 * the selection from causing this function to recurse. These responses are also debounced for
 * efficiency, so that if there are three selection changes in the same tick, #afterContextChange only
 * runs once.
 *
 * @see #afterContextChange
 */
ve.ui.Context.prototype.onContextChange = function () {
	if ( this.inspector && ( this.inspector.isOpening() || this.inspector.isClosing() ) ) {
		// Cancel debounced change handler
		clearTimeout( this.afterContextChangeTimeout );
		this.afterContextChangeTimeout = null;
		this.lastSelectedNode = this.surface.getModel().getSelectedNode();
	} else {
		if ( this.afterContextChangeTimeout === null ) {
			// Ensure change is handled on next cycle
			this.afterContextChangeTimeout = setTimeout( this.afterContextChangeHandler );
		}
	}
	// Purge available tools cache
	this.availableTools = null;
};

/**
 * Handle debounced context change events.
 */
ve.ui.Context.prototype.afterContextChange = function () {
	var selectedNode = this.surface.getModel().getSelectedNode();

	// Reset debouncing state
	this.afterContextChangeTimeout = null;

	if ( this.isVisible() ) {
		if ( this.menu.isVisible() ) {
			if ( this.isInspectable() ) {
				// Change state: menu -> menu
				this.populateMenu();
				this.updateDimensionsDebounced();
			} else {
				// Change state: menu -> closed
				this.menu.toggle( false );
				this.toggle( false );
			}
		} else if ( this.inspector && ( !selectedNode || ( selectedNode !== this.lastSelectedNode ) ) ) {
			// Change state: inspector -> (closed|menu)
			// Unless there is a selectedNode that hasn't changed (e.g. your inspector is editing a node)
			this.inspector.close();
		}
	} else {
		if ( this.isInspectable() ) {
			// Change state: closed -> menu
			this.menu.toggle( true );
			this.populateMenu();
			this.toggle( true );
		}
	}

	this.lastSelectedNode = selectedNode;
};

/**
 * Handle an inspector opening event.
 *
 * @param {OO.ui.Window} win Window that's being opened
 * @param {jQuery.Promise} opening Promise resolved when window is opened; when the promise is
 *   resolved the first argument will be a promise which will be resolved when the window begins
 *   closing, the second argument will be the opening data
 * @param {Object} data Window opening data
 */
ve.ui.Context.prototype.onInspectorOpening = function ( win, opening ) {
	var context = this,
		observer = this.surface.getView().surfaceObserver;
	this.inspector = win;

	// Shut down the SurfaceObserver as soon as possible, so it doesn't get confused
	// by the selection moving around in IE. Will be reenabled when inspector closes.
	// FIXME this should be done in a nicer way, managed by the Surface classes
	observer.pollOnce();
	observer.stopTimerLoop();

	opening
		.progress( function ( data ) {
			if ( data.state === 'setup' ) {
				if ( context.menu.isVisible() ) {
					// Change state: menu -> inspector
					context.menu.toggle( false );
				} else if ( !context.isVisible() ) {
					// Change state: closed -> inspector
					context.toggle( true );
				}
			}
			context.updateDimensionsDebounced();
		} )
		.always( function ( opened ) {
			opened.always( function ( closed ) {
				closed.always( function () {
					var inspectable = !!context.getAvailableTools().length;

					context.inspector = null;

					// Reenable observer
					observer.startTimerLoop();

					if ( inspectable ) {
						// Change state: inspector -> menu
						context.menu.toggle( true );
						context.populateMenu();
						context.updateDimensionsDebounced();
					} else {
						// Change state: inspector -> closed
						context.toggle( false );
					}

					// Restore selection
					if ( context.getSurface().getModel().getSelection() ) {
						context.getSurface().getView().focus();
					}
				} );
			} );
		} );
};

/**
 * Handle context item choose events.
 *
 * @param {ve.ui.ContextOptionWidget} item Chosen item
 */
ve.ui.Context.prototype.onContextItemChoose = function ( item ) {
	if ( item ) {
		item.getCommand().execute( this.surface );
	}
};

/**
 * Check if context is visible.
 *
 * @return {boolean} Context is visible
 */
ve.ui.Context.prototype.isVisible = function () {
	return this.visible;
};

/**
 * Check if current content is inspectable.
 *
 * @return {boolean} Content is inspectable
 */
ve.ui.Context.prototype.isInspectable = function () {
	return !!this.getAvailableTools().length;
};

/**
 * Check if current content is inspectable.
 *
 * @return {boolean} Content is inspectable
 */
ve.ui.Context.prototype.hasInspector = function () {
	var i, availableTools = this.getAvailableTools();
	for ( i = availableTools.length - 1; i >= 0; i-- ) {
		if ( availableTools[i].tool.prototype instanceof ve.ui.InspectorTool ) {
			return true;
		}
	}
	return false;
};

/**
 * Get available tools.
 *
 * Result is cached, and cleared when the model or selection changes.
 *
 * @returns {Object[]} List of objects containing `tool` and `model` properties, representing each
 *   compatible tool and the node or annotation it is compatible with
 */
ve.ui.Context.prototype.getAvailableTools = function () {
	if ( !this.availableTools ) {
		if ( this.surface.getModel().getSelection() instanceof ve.dm.LinearSelection ) {
			this.availableTools = ve.ui.toolFactory.getToolsForFragment(
				this.surface.getModel().getFragment()
			);
		} else {
			this.availableTools = [];
		}
	}
	return this.availableTools;
};

/**
 * Get the surface the context is being used with.
 *
 * @return {ve.ui.Surface}
 */
ve.ui.Context.prototype.getSurface = function () {
	return this.surface;
};

/**
 * Get inspector window set.
 *
 * @return {ve.ui.WindowManager}
 */
ve.ui.Context.prototype.getInspectors = function () {
	return this.inspectors;
};

/**
 * Get context menu.
 *
 * @return {ve.ui.ContextSelectWidget}
 */
ve.ui.Context.prototype.getMenu = function () {
	return this.menu;
};

/**
 * Create a inspector window manager.
 *
 * @method
 * @abstract
 * @return {ve.ui.WindowManager} Inspector window manager
 * @throws {Error} If this method is not overridden in a concrete subclass
 */
ve.ui.Context.prototype.createInspectorWindowManager = function () {
	throw new Error( 've.ui.Context.createInspectorWindowManager must be overridden in subclass' );
};

/**
 * Create a context item widget
 *
 * @param {Object} tool Object containing tool and model properties.
 * @return {ve.ui.ContextOptionWidget} Context item widget
 */
ve.ui.Context.prototype.createItem = function ( tool ) {
	return new ve.ui.ContextOptionWidget(
		tool.tool, tool.model, { $: this.$, data: tool.tool.static.name }
	);
};

/**
 * Update the contents of the menu.
 *
 * @chainable
 */
ve.ui.Context.prototype.populateMenu = function () {
	var i, len,
		items = [],
		tools = this.getAvailableTools();

	this.menu.clearItems();
	if ( tools.length ) {
		for ( i = 0, len = tools.length; i < len; i++ ) {
			items.push( this.createItem( tools[i] ) );
		}
		this.menu.addItems( items );
	}

	return this;
};

/**
 * Toggle the visibility of the context.
 *
 * @param {boolean} [show] Show the context, omit to toggle
 * @return {jQuery.Promise} Promise resolved when context is finished showing/hiding
 */
ve.ui.Context.prototype.toggle = function ( show ) {
	show = show === undefined ? !this.visible : !!show;
	if ( show !== this.visible ) {
		this.visible = show;
		this.$element.toggleClass( 'oo-ui-element-hidden', !this.visible );
	}
	return $.Deferred().resolve().promise();
};

/**
 * Update the size and position of the context.
 *
 * @chainable
 */
ve.ui.Context.prototype.updateDimensions = function () {
	// Override in subclass if context is positioned relative to content
	return this;
};

/**
 * Destroy the context, removing all DOM elements.
 */
ve.ui.Context.prototype.destroy = function () {
	// Disconnect events
	this.surface.getModel().disconnect( this );
	this.inspectors.disconnect( this );
	this.menu.disconnect( this );

	// Destroy inspectors WindowManager
	this.inspectors.destroy();

	// Stop timers
	clearTimeout( this.afterContextChangeTimeout );

	this.$element.remove();
	return this;
};

/*!
 * VisualEditor UserInterface Table Context class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Context menu for editing tables.
 *
 * Two are usually generated for column and row actions separately.
 *
 * @class
 * @extends OO.ui.Element
 *
 * @constructor
 * @param {ve.ce.TableNode} tableNode
 * @param {string} toolGroup Tool group to use, 'table-col' or 'table-row'
 * @param {Object} [config] Configuration options
 * @cfg {string} [indicator] Indicator to use on button
 */
ve.ui.TableContext = function VeUiTableContext( tableNode, toolGroup, config ) {
	config = config || {};

	// Parent constructor
	ve.ui.TableContext.super.call( this, config );

	// Properties
	this.tableNode = tableNode;
	this.toolGroup = toolGroup;
	this.surface = tableNode.surface.getSurface();
	this.visible = false;
	this.indicator = new OO.ui.IndicatorWidget( {
		$: this.$,
		classes: ['ve-ui-tableContext-indicator'],
		indicator: config.indicator
	} );
	this.menu = new ve.ui.ContextSelectWidget( { $: this.$ } );
	this.popup = new OO.ui.PopupWidget( {
		$: this.$,
		$container: this.surface.$element,
		width: 150
	} );

	// Events
	this.indicator.$element.on( 'mousedown', this.onIndicatorMouseDown.bind( this ) );
	this.menu.connect( this, { choose: 'onContextItemChoose' } );
	this.onDocumentMouseDownHandler = this.onDocumentMouseDown.bind( this );

	// Initialization
	this.populateMenu();
	this.menu.$element.addClass( 've-ui-tableContext-menu' );
	this.popup.$body.append( this.menu.$element );
	this.$element.addClass( 've-ui-tableContext' ).append( this.indicator.$element, this.popup.$element );
};

/* Inheritance */

OO.inheritClass( ve.ui.TableContext, OO.ui.Element );

/* Methods */

/**
 * Populate menu items.
 */
ve.ui.TableContext.prototype.populateMenu = function () {
	var i, l, tool,
		items = [],
		toolList = ve.ui.toolFactory.getTools( [ { group: this.toolGroup } ] );

	this.menu.clearItems();
	for ( i = 0, l = toolList.length; i < l; i++ ) {
		tool = ve.ui.toolFactory.lookup( toolList[i] );
		items.push( new ve.ui.ContextOptionWidget(
			tool, this.tableNode.getModel(), { $: this.$, data: tool.static.name }
		) );
	}
	this.menu.addItems( items );
};

/**
 * Handle context item choose events.
 *
 * @param {ve.ui.ContextOptionWidget} item Chosen item
 */
ve.ui.TableContext.prototype.onContextItemChoose = function ( item ) {
	if ( item ) {
		item.getCommand().execute( this.surface );
		this.toggle( false );
	}
};

/**
 * Handle mouse down events on the indicator
 *
 * @param {jQuery.Event} e Mouse down event
 */
ve.ui.TableContext.prototype.onIndicatorMouseDown = function ( e ) {
	e.preventDefault();
	this.toggle();
};

/**
 * Handle document mouse down events
 *
 * @param {jQuery.Event} e Mouse down event
 */
ve.ui.TableContext.prototype.onDocumentMouseDown = function ( e ) {
	if ( !$( e.target ).closest( this.$element ).length ) {
		this.toggle( false );
	}
};

/**
 * Toggle visibility
 *
 * @param {boolean} [show] Show the context menu
 */
ve.ui.TableContext.prototype.toggle = function ( show ) {
	var dir,
		surfaceModel = this.surface.getModel(),
		surfaceView = this.surface.getView();
	this.popup.toggle( show );
	if ( this.popup.isVisible() ) {
		this.tableNode.setEditing( false );
		surfaceModel.connect( this, { select: 'toggle' } );
		surfaceView.$document.on( 'mousedown', this.onDocumentMouseDownHandler );
		dir = surfaceView.getDocument().getDirectionFromSelection( surfaceModel.getSelection() ) || surfaceModel.getDocument().getDir();
		this.$element
			.removeClass( 've-ui-dir-block-rtl ve-ui-dir-block-ltr' )
			.addClass( 've-ui-dir-block-' + dir );
	} else {
		surfaceModel.disconnect( this );
		surfaceView.$document.off( 'mousedown', this.onDocumentMouseDownHandler );
	}
};

/*!
 * VisualEditor UserInterface Tool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface annotation tool.
 *
 * @class
 * @abstract
 * @extends OO.ui.Tool
 *
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Tool = function VeUiTool( toolGroup, config ) {
	// Parent constructor
	OO.ui.Tool.call( this, toolGroup, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.Tool, OO.ui.Tool );

/* Static Properties */

/**
 * Command to execute when tool is selected.
 *
 * @static
 * @property {string|null}
 * @inheritable
 */
ve.ui.Tool.static.commandName = null;

/**
 * Deactivate tool after it's been selected.
 *
 * Use this for tools which don't display as active when relevant content is selected, such as
 * insertion-only tools.
 *
 * @static
 * @property {boolean}
 * @inheritable
 */
ve.ui.Tool.static.deactivateOnSelect = true;

/**
 * Get the symbolic command name for this tool.
 *
 * @return {ve.ui.Command}
 */
ve.ui.Tool.static.getCommandName = function () {
	return this.commandName;
};

/* Methods */

/**
 * Handle the toolbar state being updated.
 *
 * @method
 * @param {ve.dm.SurfaceFragment|null} fragment Surface fragment
 * @param {Object|null} direction Context direction with 'inline' & 'block' properties
 */
ve.ui.Tool.prototype.onUpdateState = function ( fragment ) {
	var command = this.getCommand();
	if ( command !== null ) {
		this.setDisabled( !command || !fragment || !command.isExecutable( fragment ) );
	}
};

/**
 * @inheritdoc
 */
ve.ui.Tool.prototype.onSelect = function () {
	var command = this.getCommand();
	if ( command instanceof ve.ui.Command ) {
		command.execute( this.toolbar.getSurface() );
	}
	if ( this.constructor.static.deactivateOnSelect ) {
		this.setActive( false );
	}
};

/**
 * Get the command for this tool.
 *
 * @return {ve.ui.Command|null|undefined} Undefined means command not found, null means no command set
 */
ve.ui.Tool.prototype.getCommand = function () {
	if ( this.constructor.static.commandName === null ) {
		return null;
	}
	return ve.ui.commandRegistry.lookup( this.constructor.static.commandName );
};

/*!
 * VisualEditor UserInterface Toolbar class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface surface toolbar.
 *
 * @class
 * @extends OO.ui.Toolbar
 *
 * @constructor
 * @param {Object} [options] Configuration options
 * @cfg {boolean} [floatable] Toolbar floats when scrolled off the page
 */
ve.ui.Toolbar = function VeUiToolbar( config ) {
	config = config || {};

	// Parent constructor
	OO.ui.Toolbar.call( this, ve.ui.toolFactory, ve.ui.toolGroupFactory, config );

	// Properties
	this.floating = false;
	this.floatable = !!config.floatable;
	this.$window = null;
	this.elementOffset = null;
	this.windowEvents = {
		// Must use Function#bind (or a closure) instead of direct reference
		// because we need a unique function references for each Toolbar instance
		// to avoid $window.off() from unbinding other toolbars' event handlers.
		resize: this.onWindowResize.bind( this ),
		scroll: this.onWindowScroll.bind( this )
	};
	// Default directions
	this.contextDirection = { inline: 'ltr', block: 'ltr' };
	// The following classes can be used here:
	// ve-ui-dir-inline-ltr
	// ve-ui-dir-inline-rtl
	// ve-ui-dir-block-ltr
	// ve-ui-dir-block-rtl
	this.$element
		.addClass( 've-ui-toolbar' )
		.addClass( 've-ui-dir-inline-' + this.contextDirection.inline )
		.addClass( 've-ui-dir-block-' + this.contextDirection.block );
};

/* Inheritance */

OO.inheritClass( ve.ui.Toolbar, OO.ui.Toolbar );

/* Events */

/**
 * @event updateState
 * @param {ve.dm.SurfaceFragment|null} fragment Surface fragment. Null if no surface is active.
 * @param {Object|null} direction Context direction with 'inline' & 'block' properties if a surface exists. Null if no surface is active.
 */

/* Methods */

/**
 * inheritdoc
 */
ve.ui.Toolbar.prototype.setup = function ( groups, surface ) {
	this.detach();

	this.surface = surface;

	// Parent method
	ve.ui.Toolbar.super.prototype.setup.call( this, groups );

	// Events
	this.getSurface().getModel().connect( this, { contextChange: 'onContextChange' } );
	this.getSurface().getToolbarDialogs().connect( this, {
		opening: 'onToolbarWindowOpeningOrClosing',
		closing: 'onToolbarWindowOpeningOrClosing'
	} );
};

/**
 * inheritdoc
 */
ve.ui.Toolbar.prototype.isToolAvailable = function ( name ) {
	if ( !ve.ui.Toolbar.super.prototype.isToolAvailable.apply( this, arguments ) ) {
		return false;
	}
	// Check the tool's command is available on the surface
	var commandName,
		tool = this.getToolFactory().lookup( name );
	if ( !tool ) {
		return false;
	}
	// FIXME should use .static.getCommandName(), but we have tools that aren't ve.ui.Tool subclasses :(
	commandName = tool.static.commandName;
	return !commandName || ve.indexOf( commandName, this.getCommands() ) !== -1;
};

/**
 * Handle window resize events while toolbar floating is enabled.
 *
 * @param {jQuery.Event} e Window resize event
 */
ve.ui.Toolbar.prototype.onWindowScroll = function () {
	var scrollTop = this.$window.scrollTop();

	if ( scrollTop > this.elementOffset.top ) {
		this.float();
	} else if ( this.floating ) {
		this.unfloat();
	}
};

/**
 * Handle window resize events while toolbar floating is enabled.
 *
 * Toolbar will stick to the top of the screen unless it would be over or under the last visible
 * branch node in the root of the document being edited, at which point it will stop just above it.
 *
 * @param {jQuery.Event} e Window scroll event
 */
ve.ui.Toolbar.prototype.onWindowResize = function () {
	// Update offsets after resize (see #float)
	this.calculateOffset();

	if ( this.floating ) {
		this.$bar.css( {
			left: this.elementOffset.left,
			right: this.elementOffset.right
		} );
	}
};

/**
 * Handle windows opening or closing in the toolbar window manager.
 *
 * @param {OO.ui.Window} win
 * @param {jQuery.Promise} openingOrClosing
 * @param {Object} data
 */
ve.ui.Toolbar.prototype.onToolbarWindowOpeningOrClosing = function ( win, openingOrClosing ) {
	var toolbar = this;
	openingOrClosing.then( function () {
		// Wait for window transition
		setTimeout( function () {
			if ( toolbar.floating ) {
				// Re-calculate height
				toolbar.unfloat();
				toolbar.float();
			}
		}, 250 );
	} );
};

/**
 * Handle context changes on the surface.
 *
 * @fires updateState
 */
ve.ui.Toolbar.prototype.onContextChange = function () {
	this.updateToolState();
};

/**
 * Update the state of the tools
 */
ve.ui.Toolbar.prototype.updateToolState = function () {
	if ( !this.getSurface() ) {
		this.emit( 'updateState', null, null );
		return;
	}

	var dirInline, dirBlock, fragmentAnnotation,
		fragment = this.getSurface().getModel().getFragment();

	// Update context direction for button icons UI.
	// By default, inline and block directions are the same.
	// If no context direction is available, use document model direction.
	dirInline = dirBlock = this.surface.getView().documentView.getDirectionFromSelection( fragment.getSelection() ) ||
		fragment.getDocument().getDir();

	// 'inline' direction is different only if we are inside a language annotation
	fragmentAnnotation = fragment.getAnnotations();
	if ( fragmentAnnotation.hasAnnotationWithName( 'meta/language' ) ) {
		dirInline = fragmentAnnotation.getAnnotationsByName( 'meta/language' ).get( 0 ).getAttribute( 'dir' );
	}

	if ( dirInline !== this.contextDirection.inline ) {
		// remove previous class:
		this.$element.removeClass( 've-ui-dir-inline-rtl ve-ui-dir-inline-ltr' );
		// The following classes can be used here:
		// ve-ui-dir-inline-ltr
		// ve-ui-dir-inline-rtl
		this.$element.addClass( 've-ui-dir-inline-' + dirInline );
		this.contextDirection.inline = dirInline;
	}
	if ( dirBlock !== this.contextDirection.block ) {
		this.$element.removeClass( 've-ui-dir-block-rtl ve-ui-dir-block-ltr' );
		// The following classes can be used here:
		// ve-ui-dir-block-ltr
		// ve-ui-dir-block-rtl
		this.$element.addClass( 've-ui-dir-block-' + dirBlock );
		this.contextDirection.block = dirBlock;
	}
	this.emit( 'updateState', fragment, this.contextDirection );
};

/**
 * Get triggers for a specified name.
 *
 * @param {string} name Trigger name
 * @returns {ve.ui.Trigger[]|undefined} Triggers
 */
ve.ui.Toolbar.prototype.getTriggers = function ( name ) {
	return this.getSurface().triggerListener.getTriggers( name );
};

/**
 * Get a list of commands available to this toolbar's surface
 *
 * @return {string[]} Command names
 */
ve.ui.Toolbar.prototype.getCommands = function () {
	return this.getSurface().triggerListener.getCommands();
};

/**
 * @inheritdoc
 */
ve.ui.Toolbar.prototype.getToolAccelerator = function ( name ) {
	var messages = ve.ui.triggerRegistry.getMessages( name );

	return messages ? messages.join( ', ' ) : undefined;
};

/**
 * Gets the surface which the toolbar controls.
 *
 * @returns {ve.ui.Surface} Surface being controlled
 */
ve.ui.Toolbar.prototype.getSurface = function () {
	return this.surface;
};

/**
 * Sets up handles and preloads required information for the toolbar to work.
 * This must be called immediately after it is attached to a visible document.
 */
ve.ui.Toolbar.prototype.initialize = function () {
	// Parent method
	OO.ui.Toolbar.prototype.initialize.call( this );

	// Properties
	this.$window = this.$( this.getElementWindow() );
	this.calculateOffset();

	// Initial state
	this.updateToolState();

	if ( this.floatable ) {
		this.$window.on( this.windowEvents );
		// The page may start with a non-zero scroll position
		this.onWindowScroll();
	}
};

/**
 * Calculate the left and right offsets of the toolbar
 */
ve.ui.Toolbar.prototype.calculateOffset = function () {
	this.elementOffset = this.$element.offset();
	this.elementOffset.right = this.$window.width() - this.$element.outerWidth() - this.elementOffset.left;
};

/**
 * Detach toolbar from surface and all event listeners
 */
ve.ui.Toolbar.prototype.detach = function () {
	this.unfloat();

	// Events
	if ( this.$window ) {
		this.$window.off( this.windowEvents );
	}
	if ( this.getSurface() ) {
		this.getSurface().getModel().disconnect( this );
		this.getSurface().getToolbarDialogs().disconnect( this );
		this.getSurface().getToolbarDialogs().clearWindows();
		this.surface = null;
	}
};

/**
 * Destroys toolbar, removing event handlers and DOM elements.
 *
 * Call this whenever you are done using a toolbar.
 */
ve.ui.Toolbar.prototype.destroy = function () {
	// Parent method
	OO.ui.Toolbar.prototype.destroy.call( this );

	// Detach surface last, because tool destructors need getSurface()
	this.detach();
};

/**
 * Float the toolbar.
 */
ve.ui.Toolbar.prototype.float = function () {
	if ( !this.floating ) {
		var height = this.$element.height();
		// When switching into floating mode, set the height of the wrapper and
		// move the bar to the same offset as the in-flow element
		this.$element
			.css( 'height', height )
			.addClass( 've-ui-toolbar-floating' );
		this.$bar.css( {
			left: this.elementOffset.left,
			right: this.elementOffset.right
		} );
		this.floating = true;
		this.surface.setToolbarHeight( height );
	}
};

/**
 * Reset the toolbar to it's default non-floating position.
 */
ve.ui.Toolbar.prototype.unfloat = function () {
	if ( this.floating ) {
		this.$element
			.css( 'height', '' )
			.removeClass( 've-ui-toolbar-floating' );
		this.$bar.css( { left: '', right: '' } );
		this.floating = false;
		this.surface.setToolbarHeight( 0 );
	}
};

/*!
 * VisualEditor UserInterface TargetToolbar class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface target toolbar.
 *
 * @class
 * @extends ve.ui.Toolbar
 *
 * @constructor
 * @param {ve.init.Target} target Target to control
 * @param {Object} [config] Configuration options
 */
ve.ui.TargetToolbar = function VeUiTargetToolbar( target, config ) {
	// Parent constructor
	ve.ui.TargetToolbar.super.call( this, config );

	// Properties
	this.target = target;
};

/* Inheritance */

OO.inheritClass( ve.ui.TargetToolbar, ve.ui.Toolbar );

/* Methods */

/**
 * Gets the target which the toolbar controls.
 *
 * @returns {ve.init.Target} Target being controlled
 */
ve.ui.TargetToolbar.prototype.getTarget = function () {
	return this.target;
};

/**
 * @inheritdoc
 */
ve.ui.TargetToolbar.prototype.getTriggers = function ( name ) {
	var triggers = ve.ui.TargetToolbar.super.prototype.getTriggers.apply( this, arguments );
	return triggers ||
		this.getTarget().targetTriggerListener.getTriggers( name ) ||
		this.getTarget().documentTriggerListener.getTriggers( name );
};

/**
 * @inheritdoc
 */
ve.ui.TargetToolbar.prototype.getCommands = function () {
	return ve.ui.TargetToolbar.super.prototype.getCommands.apply( this, arguments ).concat(
		this.getTarget().targetTriggerListener.getCommands(),
		this.getTarget().documentTriggerListener.getCommands()
	);
};

/*!
 * VisualEditor UserInterface ToolFactory class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Factory for tools.
 *
 * @class
 * @extends OO.ui.ToolFactory
 *
 * @constructor
 */
ve.ui.ToolFactory = function OoUiToolFactory() {
	// Parent constructor
	OO.ui.ToolFactory.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ui.ToolFactory, OO.ui.ToolFactory );

/* Methods */

/**
 * Get a list of tools for a fragment.
 *
 * The lowest compatible item in each inheritance chain will be used.
 *
 * @method
 * @param {ve.dm.SurfaceFragment} fragment Fragment to find compatible tools for
 * @returns {Object[]} List of objects containing `tool` and `model` properties, representing each
 *   compatible tool and the node or annotation it is compatible with
 */
ve.ui.ToolFactory.prototype.getToolsForFragment = function ( fragment ) {
	var i, iLen, j, jLen, name, tools, model,
		models = fragment.getSelectedModels(),
		names = {},
		matches = [];

	// Collect tool/model pairs, unique by tool name
	for ( i = 0, iLen = models.length; i < iLen; i++ ) {
		model = models[i];
		tools = this.collectCompatibleTools( model );
		for ( j = 0, jLen = tools.length; j < jLen; j++ ) {
			name = tools[j].static.name;
			if ( !names[name] ) {
				matches.push( { tool: tools[j], model: model } );
			}
			names[name] = true;
		}
	}

	return matches;
};

/**
 * Collect the most specific compatible tools for an annotation or node.
 *
 * @param {ve.dm.Annotation|ve.dm.Node} model Annotation or node
 * @returns {Function[]} List of compatible tools
 */
ve.ui.ToolFactory.prototype.collectCompatibleTools = function ( model ) {
	var i, len, name, candidate, add,
		candidates = [];

	for ( name in this.registry ) {
		candidate = this.registry[name];
		if ( candidate.static.isCompatibleWith( model ) ) {
			add = true;
			for ( i = 0, len = candidates.length; i < len; i++ ) {
				if ( candidate.prototype instanceof candidates[i] ) {
					candidates.splice( i, 1, candidate );
					add = false;
					break;
				} else if ( candidates[i].prototype instanceof candidate ) {
					add = false;
					break;
				}
			}
			if ( add ) {
				candidates.push( candidate );
			}
		}
	}

	return candidates;
};

/* Initialization */

ve.ui.toolFactory = new ve.ui.ToolFactory();

ve.ui.toolGroupFactory = new OO.ui.ToolGroupFactory();

/*!
 * VisualEditor UserInterface Command class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Command that executes an action.
 *
 * @class
 *
 * @constructor
 * @param {string} name Symbolic name for the command
 * @param {string} action Action to execute when command is triggered
 * @param {string} method Method to call on action when executing
 * @param {Object} [options] Command options
 * @param {string[]|null} [options.supportedSelections] List of supported selection types, or null for all
 * @param {Array} [options.args] Additional arguments to pass to the action when executing
 */
ve.ui.Command = function VeUiCommand( name, action, method, options ) {
	options = options || {};
	this.name = name;
	this.action = action;
	this.method = method;
	this.supportedSelections = options.supportedSelections || null;
	this.args = options.args || [];
};

/* Methods */

/**
 * Execute command on a surface.
 *
 * @param {ve.ui.Surface} surface Surface to execute command on
 * @return {boolean} Command was executed
 */
ve.ui.Command.prototype.execute = function ( surface ) {
	if ( this.isExecutable( surface.getModel().getFragment() ) ) {
		return surface.execute.apply( surface, [ this.action, this.method ].concat( this.args ) );
	} else {
		return false;
	}
};

/**
 * Check if this command is executable on a given surface fragment
 *
 * @param {ve.dm.SurfaceFragment} fragment Surface fragment
 * @return {boolean} The command can execute on this fragment
 */
ve.ui.Command.prototype.isExecutable = function ( fragment ) {
	return !this.supportedSelections ||
		ve.indexOf( fragment.getSelection().constructor.static.name, this.supportedSelections ) !== -1;
};

/**
 * Get command action.
 *
 * @returns {string} action Action to execute when command is triggered
 */
ve.ui.Command.prototype.getAction = function () {
	return this.action;
};

/**
 * Get command method.
 *
 * @returns {string} method Method to call on action when executing
 */
ve.ui.Command.prototype.getMethod = function () {
	return this.method;
};

/**
 * Get command name.
 *
 * @returns {string} name The symbolic name of the command.
 */
ve.ui.Command.prototype.getName = function () {
	return this.name;
};

/**
 * Get command arguments.
 *
 * @returns {Array} args Additional arguments to pass to the action when executing
 */
ve.ui.Command.prototype.getArgs = function () {
	return this.args;
};

/*!
 * VisualEditor CommandRegistry class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Command registry.
 *
 * @class
 * @extends OO.Registry
 * @constructor
 */
ve.ui.CommandRegistry = function VeCommandRegistry() {
	// Parent constructor
	OO.Registry.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ui.CommandRegistry, OO.Registry );

/* Methods */

/**
 * Register a command with the factory.
 *
 * @method
 * @param {ve.ui.Command} command Command object
 * @throws {Error} If command is not an instance of ve.ui.Command
 */
ve.ui.CommandRegistry.prototype.register = function ( command ) {
	// Validate arguments
	if ( !( command instanceof ve.ui.Command ) ) {
		throw new Error(
			'command must be an instance of ve.ui.Command, cannot be a ' + typeof command
		);
	}

	OO.Registry.prototype.register.call( this, command.getName(), command );
};

/**
 * Returns the primary command for for node.
 *
 * @param {ve.ce.Node} node Node to get command for
 * @returns {ve.ui.Command}
 */
ve.ui.CommandRegistry.prototype.getCommandForNode = function ( node ) {
	return this.lookup( node.constructor.static.primaryCommandName );
};

/* Initialization */

ve.ui.commandRegistry = new ve.ui.CommandRegistry();

/* Registrations */

ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'bold', 'annotation', 'toggle',
		{ args: ['textStyle/bold'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'italic', 'annotation', 'toggle',
		{ args: ['textStyle/italic'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'code', 'annotation', 'toggle',
		{ args: ['textStyle/code'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'strikethrough', 'annotation', 'toggle',
		{ args: ['textStyle/strikethrough'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'underline', 'annotation', 'toggle',
		{ args: ['textStyle/underline'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'subscript', 'annotation', 'toggle',
		{ args: ['textStyle/subscript'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'superscript', 'annotation', 'toggle',
		{ args: ['textStyle/superscript'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'link', 'window', 'open',
		{ args: ['link'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'specialcharacter', 'window', 'open',
		{ args: ['specialcharacter'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'number', 'list', 'toggle',
		{ args: ['number'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'bullet', 'list', 'toggle',
		{ args: ['bullet'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'numberWrapOnce', 'list', 'wrapOnce',
		{ args: ['number', true], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'bulletWrapOnce', 'list', 'wrapOnce',
		{ args: ['bullet', true], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'commandHelp', 'window', 'open', { args: ['commandHelp'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'findAndReplace', 'window', 'toggle', { args: ['findAndReplace'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'findNext', 'window', 'open', { args: ['findAndReplace', null, 'findNext'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'findPrevious', 'window', 'open', { args: ['findAndReplace', null, 'findPrevious'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'code', 'annotation', 'toggle',
		{ args: ['textStyle/code'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'strikethrough', 'annotation', 'toggle',
		{ args: ['textStyle/strikethrough'], supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'language', 'window', 'open',
		{ args: ['language'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'paragraph', 'format', 'convert',
		{ args: ['paragraph'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'heading1', 'format', 'convert',
		{ args: ['heading', { level: 1 } ], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'heading2', 'format', 'convert',
		{ args: ['heading', { level: 2 } ], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'heading3', 'format', 'convert',
		{ args: ['heading', { level: 3 } ], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'heading4', 'format', 'convert',
		{ args: ['heading', { level: 4 } ], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'heading5', 'format', 'convert',
		{ args: ['heading', { level: 5 } ], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'heading6', 'format', 'convert',
		{ args: ['heading', { level: 6 } ], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'preformatted', 'format', 'convert',
		{ args: ['preformatted'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'blockquote', 'format', 'convert',
		{ args: ['blockquote'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'pasteSpecial', 'content', 'pasteSpecial',
		{ supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'selectAll', 'content', 'selectAll',
		{ supportedSelections: ['linear', 'table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'comment', 'window', 'open',
		{ args: ['comment'], supportedSelections: ['linear'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'insertTable', 'table', 'create',
		{
			args: [ {
				header: true,
				rows: 3,
				cols: 4
			} ],
			supportedSelections: ['linear']
		}
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'deleteTable', 'table', 'delete',
		{ args: ['table'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'insertRowBefore', 'table', 'insert',
		{ args: ['row', 'before'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'insertRowAfter', 'table', 'insert',
		{ args: ['row', 'after'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'deleteRow', 'table', 'delete',
		{ args: ['row'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'insertColumnBefore', 'table', 'insert',
		{ args: ['col', 'before'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'insertColumnAfter', 'table', 'insert',
		{ args: ['col', 'after'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command( 'deleteColumn', 'table', 'delete',
		{ args: ['col'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'tableCellHeader', 'table', 'changeCellStyle',
		{ args: ['header'], supportedSelections: ['table'] }
	)
);
ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'tableCellData', 'table', 'changeCellStyle',
		{ args: ['data'], supportedSelections: ['table'] }
	)
);

/*!
 * VisualEditor UserInterface Trigger class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Key trigger.
 *
 * @class
 *
 * @constructor
 * @param {jQuery.Event|string} [e] Event or string to create trigger from
 * @param {boolean} [allowInvalidPrimary] Allow invalid primary keys
 */
ve.ui.Trigger = function VeUiTrigger( e, allowInvalidPrimary ) {
	// Properties
	this.modifiers = {
		meta: false,
		ctrl: false,
		alt: false,
		shift: false
	};
	this.primary = false;

	// Initialization
	var i, len, key, parts,
		keyAliases = ve.ui.Trigger.static.keyAliases,
		primaryKeys = ve.ui.Trigger.static.primaryKeys,
		primaryKeyMap = ve.ui.Trigger.static.primaryKeyMap;
	if ( e instanceof jQuery.Event ) {
		this.modifiers.meta = e.metaKey || false;
		this.modifiers.ctrl = e.ctrlKey || false;
		this.modifiers.alt = e.altKey || false;
		this.modifiers.shift = e.shiftKey || false;
		this.primary = primaryKeyMap[e.which] || false;
	} else if ( typeof e === 'string' ) {
		// Normalization: remove whitespace and force lowercase
		parts = e.replace( /\s*/g, '' ).toLowerCase().split( '+' );
		for ( i = 0, len = parts.length; i < len; i++ ) {
			key = parts[i];
			// Resolve key aliases
			if ( Object.prototype.hasOwnProperty.call( keyAliases, key ) ) {
				key = keyAliases[key];
			}
			// Apply key to trigger
			if ( Object.prototype.hasOwnProperty.call( this.modifiers, key ) ) {
				// Modifier key
				this.modifiers[key] = true;
			} else if ( primaryKeys.indexOf( key ) !== -1 || allowInvalidPrimary ) {
				// WARNING: Only the last primary key will be used
				this.primary = key;
			}
		}
	}
};

/* Static Properties */

ve.ui.Trigger.static = {};

/**
 * Symbolic modifier key names.
 *
 * The order of this array affects the canonical order of a trigger string.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ui.Trigger.static.modifierKeys = ['meta', 'ctrl', 'alt', 'shift'];

/**
 * Symbolic primary key names.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ui.Trigger.static.primaryKeys = [
	// Special keys
	'backspace',
	'tab',
	'enter',
	'escape',
	'page-up',
	'page-down',
	'end',
	'home',
	'left',
	'up',
	'right',
	'down',
	'delete',
	'clear',
	// Numbers
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	// Letters
	'a',
	'b',
	'c',
	'd',
	'e',
	'f',
	'g',
	'h',
	'i',
	'j',
	'k',
	'l',
	'm',
	'n',
	'o',
	'p',
	'q',
	'r',
	's',
	't',
	'u',
	'v',
	'w',
	'x',
	'y',
	'z',
	// Numpad special keys
	'multiply',
	'add',
	'subtract',
	'decimal',
	'divide',
	// Function keys
	'f1',
	'f2',
	'f3',
	'f4',
	'f5',
	'f6',
	'f7',
	'f8',
	'f9',
	'f10',
	'f11',
	'f12',
	// Punctuation
	';',
	'=',
	',',
	'-',
	'.',
	'/',
	'`',
	'[',
	'\\',
	']',
	'\''
];

/**
 * Filter to use when rendering string for a specific platform.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ui.Trigger.static.platformFilters = {
	mac: ( function () {
		var names = {
			meta: '⌘',
			shift: '⇧',
			backspace: '⌫',
			ctrl: '^',
			alt: '⎇',
			escape: '⎋'
		};
		return function ( keys ) {
			var i, len;
			for ( i = 0, len = keys.length; i < len; i++ ) {
				keys[i] = names[keys[i]] || keys[i];
			}
			return keys.join( '' ).toUpperCase();
		};
	} )()
};

/**
 * Aliases for modifier or primary key names.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ui.Trigger.static.keyAliases = {
	// Platform differences
	command: 'meta',
	apple: 'meta',
	windows: 'meta',
	option: 'alt',
	return: 'enter',
	// Shorthand
	esc: 'escape',
	cmd: 'meta',
	del: 'delete',
	// Longhand
	control: 'ctrl',
	alternate: 'alt',
	// Symbols
	'⌘': 'meta',
	'⎇': 'alt',
	'⇧': 'shift',
	'⏎': 'enter',
	'⌫': 'backspace',
	'⎋': 'escape'
};

/**
 * Mapping of key codes and symbolic key names.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ui.Trigger.static.primaryKeyMap = {
	// Special keys
	8: 'backspace',
	9: 'tab',
	12: 'clear',
	13: 'enter',
	27: 'escape',
	33: 'page-up',
	34: 'page-down',
	35: 'end',
	36: 'home',
	37: 'left',
	38: 'up',
	39: 'right',
	40: 'down',
	46: 'delete',
	// Numbers
	48: '0',
	49: '1',
	50: '2',
	51: '3',
	52: '4',
	53: '5',
	54: '6',
	55: '7',
	56: '8',
	57: '9',
	// Punctuation
	59: ';',
	61: '=',
	// Letters
	65: 'a',
	66: 'b',
	67: 'c',
	68: 'd',
	69: 'e',
	70: 'f',
	71: 'g',
	72: 'h',
	73: 'i',
	74: 'j',
	75: 'k',
	76: 'l',
	77: 'm',
	78: 'n',
	79: 'o',
	80: 'p',
	81: 'q',
	82: 'r',
	83: 's',
	84: 't',
	85: 'u',
	86: 'v',
	87: 'w',
	88: 'x',
	89: 'y',
	90: 'z',
	// Numpad numbers
	96: '0',
	97: '1',
	98: '2',
	99: '3',
	100: '4',
	101: '5',
	102: '6',
	103: '7',
	104: '8',
	105: '9',
	// Numpad special keys
	106: 'multiply',
	107: 'add',
	109: 'subtract',
	110: 'decimal',
	111: 'divide',
	// Function keys
	112: 'f1',
	113: 'f2',
	114: 'f3',
	115: 'f4',
	116: 'f5',
	117: 'f6',
	118: 'f7',
	119: 'f8',
	120: 'f9',
	121: 'f10',
	122: 'f11',
	123: 'f12',
	// Punctuation
	186: ';',
	187: '=',
	188: ',',
	189: '-',
	190: '.',
	191: '/',
	192: '`',
	219: '[',
	220: '\\',
	221: ']',
	222: '\''
};

/* Methods */

/**
 * Check if trigger is complete.
 *
 * For a trigger to be complete, there must be a valid primary key.
 *
 * @returns {boolean} Trigger is complete
 */
ve.ui.Trigger.prototype.isComplete = function () {
	return this.primary !== false;
};

/**
 * Get a trigger string.
 *
 * Trigger strings are canonical representations of triggers made up of the symbolic names of all
 * active modifier keys and the primary key joined together with a '+' sign.
 *
 * To normalize a trigger string simply create a new trigger from a string and then run this method.
 *
 * An incomplete trigger will return an empty string.
 *
 * @returns {string} Canonical trigger string
 */
ve.ui.Trigger.prototype.toString = function () {
	var i, len,
		modifierKeys = ve.ui.Trigger.static.modifierKeys,
		keys = [];
	// Add modifier keywords in the correct order
	for ( i = 0, len = modifierKeys.length; i < len; i++ ) {
		if ( this.modifiers[modifierKeys[i]] ) {
			keys.push( modifierKeys[i] );
		}
	}
	// Check that there were modifiers and the primary key is whitelisted
	if ( this.primary ) {
		// Add a symbolic name for the primary key
		keys.push( this.primary );
		return keys.join( '+' );
	}
	// Alternatively return an empty string
	return '';
};

/**
 * Get a trigger message.
 *
 * This is similar to #toString but the resulting string will be formatted in a way that makes it
 * appear more native for the platform.
 *
 * @returns {string} Message for trigger
 */
ve.ui.Trigger.prototype.getMessage = function () {
	var keys,
		platformFilters = ve.ui.Trigger.static.platformFilters,
		platform = ve.getSystemPlatform();

	keys = this.toString().split( '+' );
	if ( Object.prototype.hasOwnProperty.call( platformFilters, platform ) ) {
		return platformFilters[platform]( keys );
	}
	return keys.map( function ( key ) {
		return key[0].toUpperCase() + key.slice( 1 ).toLowerCase();
	} ).join( '+' );
};

/*!
 * VisualEditor UserInterface TriggerRegistry class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Trigger registry.
 *
 * @class
 * @extends OO.Registry
 * @constructor
 */
ve.ui.TriggerRegistry = function VeUiTriggerRegistry() {
	// Parent constructor
	ve.ui.TriggerRegistry.super.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ui.TriggerRegistry, OO.Registry );

/* Methods */

/**
 * Register a constructor with the factory.
 *
 * The only supported platforms are 'mac' and 'pc'. All platforms not identified as 'mac' will be
 * considered to be 'pc', including 'win', 'linux', 'solaris', etc.
 *
 * @method
 * @param {string|string[]} name Symbolic name or list of symbolic names
 * @param {ve.ui.Trigger[]|Object} triggers Trigger object(s) or map of trigger object(s) keyed by
 * platform name e.g. 'mac' or 'pc'
 * @throws {Error} Trigger must be an instance of ve.ui.Trigger
 * @throws {Error} Incomplete trigger
 */
ve.ui.TriggerRegistry.prototype.register = function ( name, triggers ) {
	var i, l, triggerList,
		platform = ve.getSystemPlatform(),
		platformKey = platform === 'mac' ? 'mac' : 'pc';

	if ( ve.isPlainObject( triggers ) ) {
		if ( Object.prototype.hasOwnProperty.call( triggers, platformKey ) ) {
			triggerList = Array.isArray( triggers[platformKey] ) ? triggers[platformKey] : [ triggers[platformKey] ];
		} else {
			return;
		}
	} else {
		triggerList = Array.isArray( triggers ) ? triggers : [ triggers ];
	}

	// Validate arguments
	for ( i = 0, l = triggerList.length; i < l; i++ ) {
		if ( !( triggerList[i] instanceof ve.ui.Trigger ) ) {
			throw new Error( 'Trigger must be an instance of ve.ui.Trigger' );
		}
		if ( !triggerList[i].isComplete() ) {
			throw new Error( 'Incomplete trigger' );
		}
	}

	ve.ui.TriggerRegistry.super.prototype.register.call( this, name, triggerList );
};

/**
 * Get trigger messages for a trigger by name
 *
 * @param {string} name Symbolic name
 * @return {string[]} List of trigger messages
 */
ve.ui.TriggerRegistry.prototype.getMessages = function ( name ) {
	return ( this.lookup( name ) || [] ).map( function ( trigger ) { return trigger.getMessage(); } );
};

/* Initialization */

ve.ui.triggerRegistry = new ve.ui.TriggerRegistry();

/* Registrations */

ve.ui.triggerRegistry.register(
	'undo', { mac: new ve.ui.Trigger( 'cmd+z' ), pc: new ve.ui.Trigger( 'ctrl+z' ) }
);
ve.ui.triggerRegistry.register(
	'redo', {
		mac: [
			new ve.ui.Trigger( 'cmd+shift+z' ),
			new ve.ui.Trigger( 'cmd+y' )
		],
		pc: [
			new ve.ui.Trigger( 'ctrl+shift+z' ),
			new ve.ui.Trigger( 'ctrl+y' )
		]
	}
);
ve.ui.triggerRegistry.register(
	'bold', { mac: new ve.ui.Trigger( 'cmd+b' ), pc: new ve.ui.Trigger( 'ctrl+b' ) }
);
ve.ui.triggerRegistry.register(
	'italic', { mac: new ve.ui.Trigger( 'cmd+i' ), pc: new ve.ui.Trigger( 'ctrl+i' ) }
);
ve.ui.triggerRegistry.register(
	'link', { mac: new ve.ui.Trigger( 'cmd+k' ), pc: new ve.ui.Trigger( 'ctrl+k' ) }
);
ve.ui.triggerRegistry.register(
	'clear', {
		mac: [
			new ve.ui.Trigger( 'cmd+\\' ),
			new ve.ui.Trigger( 'cmd+m' )
		],
		pc: [
			new ve.ui.Trigger( 'ctrl+\\' ),
			new ve.ui.Trigger( 'ctrl+m' )
		]
	}
);
ve.ui.triggerRegistry.register(
	'underline', { mac: new ve.ui.Trigger( 'cmd+u' ), pc: new ve.ui.Trigger( 'ctrl+u' ) }
);
ve.ui.triggerRegistry.register(
	'code', { mac: new ve.ui.Trigger( 'cmd+shift+6' ), pc: new ve.ui.Trigger( 'ctrl+shift+6' ) }
);
ve.ui.triggerRegistry.register(
	'strikethrough', { mac: new ve.ui.Trigger( 'cmd+shift+5' ), pc: new ve.ui.Trigger( 'ctrl+shift+5' ) }
);
ve.ui.triggerRegistry.register(
	'subscript', { mac: new ve.ui.Trigger( 'cmd+,' ), pc: new ve.ui.Trigger( 'ctrl+,' ) }
);
ve.ui.triggerRegistry.register(
	'superscript', { mac: new ve.ui.Trigger( 'cmd+.' ), pc: new ve.ui.Trigger( 'ctrl+.' ) }
);
ve.ui.triggerRegistry.register(
	'indent', new ve.ui.Trigger( 'tab' )
);
ve.ui.triggerRegistry.register(
	'outdent', new ve.ui.Trigger( 'shift+tab' )
);
ve.ui.triggerRegistry.register(
	'commandHelp', {
		mac: [
			new ve.ui.Trigger( 'cmd+/' ),
			new ve.ui.Trigger( 'cmd+shift+/' ) // =cmd+? on most systems, but not all
		],
		pc: [
			new ve.ui.Trigger( 'ctrl+/' ),
			new ve.ui.Trigger( 'ctrl+shift+/' ) // =ctrl+? on most systems, but not all
		]
	}
);
// Ctrl+0-7 below are not mapped to Cmd+0-7 on Mac because Chrome reserves those for switching tabs
ve.ui.triggerRegistry.register(
	'paragraph', new ve.ui.Trigger( 'ctrl+0' )
);
ve.ui.triggerRegistry.register(
	'heading1', new ve.ui.Trigger( 'ctrl+1' )
);
ve.ui.triggerRegistry.register(
	'heading2', new ve.ui.Trigger( 'ctrl+2' )
);
ve.ui.triggerRegistry.register(
	'heading3', new ve.ui.Trigger( 'ctrl+3' )
);
ve.ui.triggerRegistry.register(
	'heading4', new ve.ui.Trigger( 'ctrl+4' )
);
ve.ui.triggerRegistry.register(
	'heading5', new ve.ui.Trigger( 'ctrl+5' )
);
ve.ui.triggerRegistry.register(
	'heading6', new ve.ui.Trigger( 'ctrl+6' )
);
ve.ui.triggerRegistry.register(
	'preformatted', new ve.ui.Trigger( 'ctrl+7' )
);
ve.ui.triggerRegistry.register(
	'blockquote', new ve.ui.Trigger( 'ctrl+8' )
);
ve.ui.triggerRegistry.register(
	'selectAll', { mac: new ve.ui.Trigger( 'cmd+a' ), pc: new ve.ui.Trigger( 'ctrl+a' ) }
);
ve.ui.triggerRegistry.register(
	'pasteSpecial', { mac: new ve.ui.Trigger( 'cmd+shift+v' ), pc: new ve.ui.Trigger( 'ctrl+shift+v' ) }
);
ve.ui.triggerRegistry.register(
	'findAndReplace', { mac: new ve.ui.Trigger( 'cmd+f' ), pc: new ve.ui.Trigger( 'ctrl+f' ) }
);
ve.ui.triggerRegistry.register(
	'findNext', {
		mac: new ve.ui.Trigger( 'cmd+g' ),
		pc: [
			new ve.ui.Trigger( 'ctrl+g' ),
			new ve.ui.Trigger( 'f3' )
		]
	}
);
ve.ui.triggerRegistry.register(
	'findPrevious', {
		mac: new ve.ui.Trigger( 'cmd+shift+g' ),
		pc: [
			new ve.ui.Trigger( 'shift+ctrl+g' ),
			new ve.ui.Trigger( 'shift+f3' )
		]
	}
);

/*!
 * VisualEditor UserInterface Sequence class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Key sequence.
 *
 * @class
 *
 * @constructor
 * @param {string} name Symbolic name
 * @param {string} commandName Command name this sequence executes
 * @param {string|Array} data Data to match
 * @param {number} [strip] Number of data elements to strip after execution (from the right)
 */
ve.ui.Sequence = function VeUiSequence( name, commandName, data, strip ) {
	this.name = name;
	this.commandName = commandName;
	this.data = data;
	this.strip = strip;
};

/* Inheritance */

OO.initClass( ve.ui.Sequence );

/* Methods */

/**
 * Check if the sequence matches a given offset in the data
 *
 * @param {string|Array} data String or linear data
 * @param {number} offset Offset
 * @return {boolean} Sequence matches
 */
ve.ui.Sequence.prototype.match = function ( data, offset ) {
	var i, j = offset - 1;

	for ( i = this.data.length - 1; i >= 0; i--, j-- ) {
		if ( typeof this.data[i] === 'string' ) {
			if ( this.data[i] !== data.getCharacterData( j ) ) {
				return false;
			}
		} else if ( !ve.compare( this.data[i], data.getData( j ), true ) ) {
			return false;
		}
	}
	return true;
};

/**
 * Execute the command associated with the sequence
 *
 * @param {ve.ui.Surface} surface surface
 * @return {boolean} The command executed
 * @throws {Error} Command not found
 */
ve.ui.Sequence.prototype.execute = function ( surface ) {
	var range, executed, stripFragment,
		surfaceModel = surface.getModel(),
		command = ve.ui.commandRegistry.lookup( this.getCommandName() );

	if ( !command ) {
		throw new Error( 'Command not found: ' + this.getCommandName() ) ;
	}

	if ( this.strip ) {
		range = surfaceModel.getSelection().getRange();
		stripFragment = surfaceModel.getLinearFragment( new ve.Range( range.end, range.end - this.strip ) );
	}

	surfaceModel.breakpoint();

	executed = command.execute( surface );

	if ( executed && stripFragment ) {
		stripFragment.removeContent();
	}

	return executed;
};

/**
 * Get the symbolic name of the sequence
 *
 * @return {string} Symbolic name
 */
ve.ui.Sequence.prototype.getName = function () {
	return this.name;
};

/**
 * Get the command name which the sequence will execute
 *
 * @return {string} Command name
 */
ve.ui.Sequence.prototype.getCommandName = function () {
	return this.commandName;
};

/*!
 * VisualEditor UserInterface SequenceRegistry class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Sequence registry.
 *
 * @class
 * @extends OO.Registry
 * @constructor
 */
ve.ui.SequenceRegistry = function VeUiSequenceRegistry() {
	// Parent constructor
	ve.ui.SequenceRegistry.super.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ui.SequenceRegistry, OO.Registry );

/**
 * Register a sequence with the factory.
 *
 * @method
 * @param {ve.ui.Sequence} sequence Sequence object
 * @throws {Error} If sequence is not an instance of ve.ui.Sequence
 */
ve.ui.SequenceRegistry.prototype.register = function ( sequence ) {
	// Validate arguments
	if ( !( sequence instanceof ve.ui.Sequence ) ) {
		throw new Error(
			'sequence must be an instance of ve.ui.Sequence, cannot be a ' + typeof sequence
		);
	}

	ve.ui.SequenceRegistry.super.prototype.register.call( this, sequence.getName(), sequence );
};

/**
 * Find sequence matches a given offset in the data
 *
 * @param {ve.dm.ElementLinearData} data Linear data
 * @param {number} offset Offset
 * @return {ve.ui.Sequence[]} Sequences which match
 */
ve.ui.SequenceRegistry.prototype.findMatching = function ( data, offset ) {
	var name, sequences = [];
	for ( name in this.registry ) {
		if ( this.registry[name].match( data, offset ) ) {
			sequences.push( this.registry[name] );
		}
	}
	return sequences;
};

/* Initialization */

ve.ui.sequenceRegistry = new ve.ui.SequenceRegistry();

/* Registrations */

ve.ui.sequenceRegistry.register(
	new ve.ui.Sequence( 'bulletStar', 'bulletWrapOnce', [ { type: 'paragraph' }, '*', ' ' ], 2 )
);
ve.ui.sequenceRegistry.register(
	new ve.ui.Sequence( 'numberDot', 'numberWrapOnce', [ { type: 'paragraph' }, '1', '.', ' ' ], 3 )
);

/*!
 * VisualEditor UserInterface Action class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Generic action.
 *
 * An action is built around a surface for one-time use. It is a generic way of extending the
 * functionality of a surface. Actions are accessible via {ve.ui.Surface.prototype.execute}.
 *
 * @class
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.Action = function VeUiAction( surface ) {
	// Properties
	this.surface = surface;
};

/* Static Properties */

ve.ui.Action.static = {};

/**
 * List of allowed methods for the action.
 *
 * To avoid use of methods not intended to be executed via surface.execute(), the methods must be
 * whitelisted here. This information is checked by ve.ui.Surface before executing an action.
 *
 * If a method returns a value, it will be cast to boolean and be used to determine if the action
 * was canceled. Not returning anything, or returning undefined will be treated the same as
 * returning true. A canceled action will yield to other default behavior. For example, when
 * triggering an action from a keystroke, a canceled action will allow normal insertion behavior to
 * be carried out.
 *
 * @static
 * @property
 * @inheritable
 */
ve.ui.Action.static.methods = [];

/*!
 * VisualEditor UserInterface ActionFactory class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Action factory.
 *
 * @class
 * @extends OO.Factory
 * @constructor
 */
ve.ui.ActionFactory = function VeUiActionFactory() {
	// Parent constructor
	OO.Factory.call( this );
};

/* Inheritance */

OO.inheritClass( ve.ui.ActionFactory, OO.Factory );

/* Methods */

/**
 * Check if an action supports a method.
 *
 * @method
 * @param {string} action Name of action
 * @param {string} method Name of method
 * @returns {boolean} The action supports the method
 */
ve.ui.ActionFactory.prototype.doesActionSupportMethod = function ( action, method ) {
	if ( Object.prototype.hasOwnProperty.call( this.registry, action ) ) {
		return this.registry[action].static.methods.indexOf( method ) !== -1;
	}
	throw new Error( 'Unknown action: ' + action );
};

/* Initialization */

ve.ui.actionFactory = new ve.ui.ActionFactory();

/*!
 * VisualEditor UserInterface data transfer handler class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Data transfer handler.
 *
 * @class
 * @abstract
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface
 * @param {File} file File to handle
 */
ve.ui.DataTransferHandler = function VeUiDataTransferHandler( surface, file ) {
	// Properties
	this.surface = surface;
	this.file = file;

	this.insertableDataDeferred = $.Deferred();

	this.reader = new FileReader();

	this.progress = false;
	this.progressBar = null;

	// Events
	this.reader.addEventListener( 'progress', this.onFileProgress.bind( this ) );
	this.reader.addEventListener( 'load', this.onFileLoad.bind( this ) );
	this.reader.addEventListener( 'loadend', this.onFileLoadEnd.bind( this ) );
};

/* Inheritance */

OO.initClass( ve.ui.DataTransferHandler );

/* Static properties */

/**
 * Symbolic name for this handler. Must be unique.
 *
 * @static
 * @property {string}
 * @inheritable
 */
ve.ui.DataTransferHandler.static.name = null;

/**
 * List of mime types supported by this handler
 *
 * @static
 * @property {string[]}
 * @inheritable
 */
ve.ui.DataTransferHandler.static.types = [];

/* Methods */

/**
 * Process the file
 *
 * Implementations should aim to resolve this.insertableDataDeferred.
 */
ve.ui.DataTransferHandler.prototype.process = function () {
	throw new Error( 've.ui.DataTransferHandler subclass must implement process' );
};

/**
 * Insert the file at a specified fragment
 *
 * @return {jQuery.Promise} Promise which resolves with data to insert
 */
ve.ui.DataTransferHandler.prototype.getInsertableData = function () {
	this.process();

	return this.insertableDataDeferred.promise();
};

/**
 * Handle progress events from the file reader
 *
 * @param {Event} e Progress event
 */
ve.ui.DataTransferHandler.prototype.onFileProgress = function () {};

/**
 * Handle load events from the file reader
 *
 * @param {Event} e Load event
 */
ve.ui.DataTransferHandler.prototype.onFileLoad = function () {};

/**
 * Handle load end events from the file reader
 *
 * @param {Event} e Load end event
 */
ve.ui.DataTransferHandler.prototype.onFileLoadEnd = function () {};

/**
 * Abort the data transfer handler
 */
ve.ui.DataTransferHandler.prototype.abort = function () {
	this.insertableDataDeferred.reject();
};

/**
 * Create a progress bar with a specified label
 *
 * @param {jQuery.Promise} progressCompletePromise Promise which resolves when the progress action is complete
 * @param {jQuery|string|Function} [label] Progress bar label, defaults to file name
 */
ve.ui.DataTransferHandler.prototype.createProgress = function ( progressCompletePromise, label ) {
	var handler = this;

	this.surface.createProgress( progressCompletePromise, label || this.file.name ).done( function ( progressBar, cancelPromise ) {
		// Set any progress that was achieved before this resolved
		progressBar.setProgress( handler.progress );
		handler.progressBar = progressBar;
		cancelPromise.fail( handler.abort.bind( handler ) );
	} );
};

/**
 * Set progress bar progress
 *
 * Progress is stored in a property in case the progress bar doesn't exist yet.
 *
 * @param {number} progress Progress percent
 */
ve.ui.DataTransferHandler.prototype.setProgress = function ( progress ) {
	this.progress = progress;
	if ( this.progressBar ) {
		this.progressBar.setProgress( this.progress );
	}
};

/*!
 * VisualEditor DataTransferHandlerFactory class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Drop handler Factory.
 *
 * @class
 * @extends OO.Factory
 * @constructor
 */
ve.ui.DataTransferHandlerFactory = function VeUiDataTransferHandlerFactory() {
	// Parent constructor
	ve.ui.DataTransferHandlerFactory.super.apply( this, arguments );

	this.handlerNamesByType = {};
};

/* Inheritance */

OO.inheritClass( ve.ui.DataTransferHandlerFactory, OO.Factory );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.DataTransferHandlerFactory.prototype.register = function ( constructor ) {
	// Parent method
	ve.ui.DataTransferHandlerFactory.super.prototype.register.call( this, constructor );

	var i, l, types = constructor.static.types;
	for ( i = 0, l = types.length; i < l; i++ ) {
		this.handlerNamesByType[types[i]] = constructor.static.name;
	}
};

/**
 * Returns the primary command for for node.
 *
 * @param {string} type File type
 * @returns {string|undefined} Handler name, or undefined if not found
 */
ve.ui.DataTransferHandlerFactory.prototype.getHandlerNameForType = function ( type ) {
	return this.handlerNamesByType[type];
};

/* Initialization */

ve.ui.dataTransferHandlerFactory = new ve.ui.DataTransferHandlerFactory();

/*!
 * VisualEditor UserInterface WindowManager class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Window manager.
 *
 * @class
 * @extends OO.ui.WindowManager
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {ve.ui.Overlay} [overlay] Overlay to use for menus
 */
ve.ui.WindowManager = function VeUiWindowManager( config ) {
	// Configuration initialization
	config = config || {};

	// Parent constructor
	ve.ui.WindowManager.super.call( this, config );

	// Properties
	this.overlay = config.overlay || null;
};

/* Inheritance */

OO.inheritClass( ve.ui.WindowManager, OO.ui.WindowManager );

/* Methods */

/**
 * Get overlay for menus.
 *
 * @return {ve.ui.Overlay|null} Menu overlay, null if none was configured
 */
ve.ui.WindowManager.prototype.getOverlay = function () {
	return this.overlay;
};

/**
 * @inheritdoc
 */
ve.ui.WindowManager.prototype.getReadyDelay = function () {
	// HACK: Really this should be measured by OOjs UI so it can vary by theme
	return 250;
};

/*!
 * VisualEditor UserInterface AnnotationAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Annotation action.
 *
 * @class
 * @extends ve.ui.Action
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.AnnotationAction = function VeUiAnnotationAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.AnnotationAction, ve.ui.Action );

/* Static Properties */

ve.ui.AnnotationAction.static.name = 'annotation';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.AnnotationAction.static.methods = [ 'set', 'clear', 'toggle', 'clearAll' ];

/* Methods */

/**
 * Set an annotation.
 *
 * @method
 * @param {string} name Annotation name, for example: 'textStyle/bold'
 * @param {Object} [data] Additional annotation data
 * @return {boolean} Action was executed
 */
ve.ui.AnnotationAction.prototype.set = function ( name, data ) {
	var i, trimmedFragment,
		fragment = this.surface.getModel().getFragment(),
		annotationClass = ve.dm.annotationFactory.lookup( name ),
		removes = annotationClass.static.removes;

	if ( fragment.getSelection() instanceof ve.dm.LinearSelection ) {
		trimmedFragment = fragment.trimLinearSelection();
		if ( !trimmedFragment.getSelection().isCollapsed() ) {
			fragment = trimmedFragment;
		}
	}

	for ( i = removes.length - 1; i >= 0; i-- ) {
		fragment.annotateContent( 'clear', removes[i] );
	}
	fragment.annotateContent( 'set', name, data );
	return true;
};

/**
 * Clear an annotation.
 *
 * @method
 * @param {string} name Annotation name, for example: 'textStyle/bold'
 * @param {Object} [data] Additional annotation data
 * @return {boolean} Action was executed
 */
ve.ui.AnnotationAction.prototype.clear = function ( name, data ) {
	this.surface.getModel().getFragment().annotateContent( 'clear', name, data );
	return true;
};

/**
 * Toggle an annotation.
 *
 * If the selected text is completely covered with the annotation already the annotation will be
 * cleared. Otherwise the annotation will be set.
 *
 * @method
 * @param {string} name Annotation name, for example: 'textStyle/bold'
 * @param {Object} [data] Additional annotation data
 * @return {boolean} Action was executed
 */
ve.ui.AnnotationAction.prototype.toggle = function ( name, data ) {
	var existingAnnotations, insertionAnnotations, removesAnnotations,
		surfaceModel = this.surface.getModel(),
		fragment = surfaceModel.getFragment(),
		annotation = ve.dm.annotationFactory.create( name, data ),
		removes = annotation.constructor.static.removes;

	if ( !fragment.getSelection().isCollapsed() ) {
		if ( !fragment.getAnnotations().containsComparable( annotation ) ) {
			this.set( name, data );
		} else {
			fragment.annotateContent( 'clear', name );
		}
	} else {
		insertionAnnotations = surfaceModel.getInsertionAnnotations();
		existingAnnotations = insertionAnnotations.getAnnotationsByName( annotation.name );
		if ( existingAnnotations.isEmpty() ) {
			removesAnnotations = insertionAnnotations.filter( function ( annotation ) {
				return ve.indexOf( annotation.name, removes ) !== -1;
			} );
			surfaceModel.removeInsertionAnnotations( removesAnnotations );
			surfaceModel.addInsertionAnnotations( annotation );
		} else {
			surfaceModel.removeInsertionAnnotations( existingAnnotations );
		}
	}
	return true;
};

/**
 * Clear all annotations.
 *
 * @method
 * @return {boolean} Action was executed
 */
ve.ui.AnnotationAction.prototype.clearAll = function () {
	var i, len, arr,
		surfaceModel = this.surface.getModel(),
		fragment = surfaceModel.getFragment(),
		annotations = fragment.getAnnotations( true );

	arr = annotations.get();
	// TODO: Allow multiple annotations to be set or cleared by ve.dm.SurfaceFragment, probably
	// using an annotation set and ideally building a single transaction
	for ( i = 0, len = arr.length; i < len; i++ ) {
		fragment.annotateContent( 'clear', arr[i].name, arr[i].data );
	}
	surfaceModel.setInsertionAnnotations( null );
	return true;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.AnnotationAction );

/*!
 * VisualEditor UserInterface ContentAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Content action.
 *
 * @class
 * @extends ve.ui.Action
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.ContentAction = function VeUiContentAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.ContentAction, ve.ui.Action );

/* Static Properties */

ve.ui.ContentAction.static.name = 'content';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.ContentAction.static.methods = [ 'insert', 'remove', 'select', 'pasteSpecial', 'selectAll' ];

/* Methods */

/**
 * Insert content.
 *
 * @method
 * @param {string|Array} content Content to insert, can be either a string or array of data
 * @param {boolean} annotate Content should be automatically annotated to match surrounding content
 * @return {boolean} Action was executed
 */
ve.ui.ContentAction.prototype.insert = function ( content, annotate ) {
	this.surface.getModel().getFragment().insertContent( content, annotate );
	return true;
};

/**
 * Remove content.
 *
 * @method
 * @return {boolean} Action was executed
 */
ve.ui.ContentAction.prototype.remove = function () {
	this.surface.getModel().getFragment().removeContent();
	return true;
};

/**
 * Select content.
 *
 * @method
 * @param {ve.dm.Selection} selection Selection
 * @return {boolean} Action was executed
 */
ve.ui.ContentAction.prototype.select = function ( selection ) {
	this.surface.getModel().setSelection( selection );
	return true;
};

/**
 * Select all content.
 *
 * @method
 * @return {boolean} Action was executed
 */
ve.ui.ContentAction.prototype.selectAll = function () {
	this.surface.getView().selectAll();
	return true;
};

/**
 * Paste special.
 *
 * @method
 * @return {boolean} Action was executed
 */
ve.ui.ContentAction.prototype.pasteSpecial = function () {
	this.surface.getView().pasteSpecial = true;
	// Return false to allow the paste event to occur
	return false;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.ContentAction );

/*!
 * VisualEditor UserInterface FormatAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Format action.
 *
 * @class
 * @extends ve.ui.Action
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.FormatAction = function VeUiFormatAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.FormatAction, ve.ui.Action );

/* Static Properties */

ve.ui.FormatAction.static.name = 'format';

/**
 * List of allowed methods for this action.
 *
 * @static
 * @property
 */
ve.ui.FormatAction.static.methods = [ 'convert' ];

/* Methods */

/**
 * Convert the format of content.
 *
 * Conversion splits and unwraps all lists and replaces content branch nodes.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @param {string} type
 * @param {Object} attributes
 * @return {boolean} Action was executed
 */
ve.ui.FormatAction.prototype.convert = function ( type, attributes ) {
	var selected, i, length, contentBranch, txs,
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection(),
		fragmentForSelection = surfaceModel.getFragment( selection, true ),
		doc = surfaceModel.getDocument(),
		fragments = [];

	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return;
	}

	// We can't have headings or pre's in a list, so if we're trying to convert
	// things that are in lists to a heading or a pre, split the list
	selected = doc.selectNodes( selection.getRange(), 'leaves' );
	for ( i = 0, length = selected.length; i < length; i++ ) {
		contentBranch = selected[i].node.isContent() ?
			selected[i].node.getParent() :
			selected[i].node;

		fragments.push( surfaceModel.getLinearFragment( contentBranch.getOuterRange(), true ) );
	}

	for ( i = 0, length = fragments.length; i < length; i++ ) {
		fragments[i].isolateAndUnwrap( type );
	}
	selection = fragmentForSelection.getSelection();

	txs = ve.dm.Transaction.newFromContentBranchConversion( doc, selection.getRange(), type, attributes );
	surfaceModel.change( txs, selection );
	this.surface.getView().focus();
	return true;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.FormatAction );

/*!
 * VisualEditor UserInterface HistoryAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * History action.
 *
 * @class
 * @extends ve.ui.Action
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.HistoryAction = function VeUiHistoryAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.HistoryAction, ve.ui.Action );

/* Static Properties */

ve.ui.HistoryAction.static.name = 'history';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.HistoryAction.static.methods = [ 'undo', 'redo' ];

/* Methods */

/**
 * Step backwards in time.
 *
 * @method
 * @return {boolean} Action was executed
 */
ve.ui.HistoryAction.prototype.undo = function () {
	this.surface.getModel().undo();
	return true;
};

/**
 * Step forwards in time.
 *
 * @method
 * @return {boolean} Action was executed
 */
ve.ui.HistoryAction.prototype.redo = function () {
	this.surface.getModel().redo();
	return true;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.HistoryAction );

/*!
 * VisualEditor UserInterface IndentationAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Indentation action.
 *
 * @class
 * @extends ve.ui.Action
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.IndentationAction = function VeUiIndentationAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.IndentationAction, ve.ui.Action );

/* Static Properties */

ve.ui.IndentationAction.static.name = 'indentation';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.IndentationAction.static.methods = [ 'increase', 'decrease' ];

/* Methods */

/**
 * Indent content.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @method
 * @returns {boolean} Indentation increase occurred
 */
ve.ui.IndentationAction.prototype.increase = function () {
	var i, group, groups,
		fragments = [],
		increased = false,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument(),
		fragment = surfaceModel.getFragment();

	if ( !( fragment.getSelection() instanceof ve.dm.LinearSelection ) ) {
		return;
	}

	groups = documentModel.getCoveredSiblingGroups( fragment.getSelection().getRange() );

	// Build fragments from groups (we need their ranges since the nodes will be rebuilt on change)
	for ( i = 0; i < groups.length; i++ ) {
		group = groups[i];
		if ( group.grandparent && group.grandparent.getType() === 'list' ) {
			fragments.push( surfaceModel.getLinearFragment( group.parent.getRange(), true ) );
			increased = true;
		}
	}

	// Process each fragment (their ranges are automatically adjusted on change)
	for ( i = 0; i < fragments.length; i++ ) {
		this.indentListItem(
			documentModel.getBranchNodeFromOffset( fragments[i].getSelection().getRange().start )
		);
	}

	fragment.select();

	return increased;
};

/**
 * Unindent content.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @method
 * @returns {boolean} Indentation decrease occurred
 */
ve.ui.IndentationAction.prototype.decrease = function () {
	var i, group, groups,
		fragments = [],
		decreased = false,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument(),
		fragment = surfaceModel.getFragment();

	if ( !( fragment.getSelection() instanceof ve.dm.LinearSelection ) ) {
		return;
	}

	groups = documentModel.getCoveredSiblingGroups( fragment.getSelection().getRange() );

	// Build fragments from groups (we need their ranges since the nodes will be rebuilt on change)
	for ( i = 0; i < groups.length; i++ ) {
		group = groups[i];
		if ( group.grandparent && group.grandparent.getType() === 'list' ) {
			fragments.push( surfaceModel.getLinearFragment( group.parent.getRange(), true ) );
			decreased = true;
		} else if ( group.parent && group.parent.getType() === 'list' ) {
			// In a slug, the node will be the listItem.
			fragments.push( surfaceModel.getLinearFragment( group.nodes[0].getRange(), true ) );
			decreased = true;
		}

	}

	// Process each fragment (their ranges are automatically adjusted on change)
	for ( i = 0; i < fragments.length; i++ ) {
		this.unindentListItem(
			documentModel.getBranchNodeFromOffset( fragments[i].getSelection().getRange().start )
		);
	}

	fragment.select();

	return decreased;
};

/**
 * Indent a list item.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @method
 * @param {ve.dm.ListItemNode} listItem List item to indent
 * @throws {Error} listItem must be a ve.dm.ListItemNode
 */
ve.ui.IndentationAction.prototype.indentListItem = function ( listItem ) {
	if ( !( listItem instanceof ve.dm.ListItemNode ) ) {
		throw new Error( 'listItem must be a ve.dm.ListItemNode' );
	}
	/*
	 * Indenting a list item is done as follows:
	 *
	 * 1. Wrap the listItem in a list and a listItem (<li> --> <li><ul><li>)
	 * 2. Merge this wrapped listItem into the previous listItem if present
	 *    (<li>Previous</li><li><ul><li>This --> <li>Previous<ul><li>This)
	 * 3. If this results in the wrapped list being preceded by another list,
	 *    merge those lists.
	 */
	var tx, range,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument(),
		selection = surfaceModel.getSelection(),
		listType = listItem.getParent().getAttribute( 'style' ),
		listItemRange = listItem.getOuterRange(),
		innerListItemRange,
		outerListItemRange,
		mergeStart,
		mergeEnd;

	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return;
	}

	range = selection.getRange();

	// CAREFUL: after initializing the variables above, we cannot use the model tree!
	// The first transaction will cause rebuilds so the nodes we have references to now
	// will be detached and useless after the first transaction. Instead, inspect
	// documentModel.data to find out things about the current structure.

	// (1) Wrap the listItem in a list and a listItem
	tx = ve.dm.Transaction.newFromWrap( documentModel,
		listItemRange,
		[],
		[ { type: 'listItem' }, { type: 'list', attributes: { style: listType } } ],
		[],
		[]
	);
	surfaceModel.change( tx );
	range = tx.translateRange( range );
	// tx.translateRange( innerListItemRange ) doesn't do what we want
	innerListItemRange = listItemRange.translate( 2 );
	outerListItemRange = new ve.Range( listItemRange.start, listItemRange.end + 2 );

	// (2) Merge the listItem into the previous listItem (if there is one)
	if (
		documentModel.data.getData( listItemRange.start ).type === 'listItem' &&
		documentModel.data.getData( listItemRange.start - 1 ).type === '/listItem'
	) {
		mergeStart = listItemRange.start - 1;
		mergeEnd = listItemRange.start + 1;
		// (3) If this results in adjacent lists, merge those too
		if (
			documentModel.data.getData( mergeEnd ).type === 'list' &&
			documentModel.data.getData( mergeStart - 1 ).type === '/list'
		) {
			mergeStart--;
			mergeEnd++;
		}
		tx = ve.dm.Transaction.newFromRemoval( documentModel, new ve.Range( mergeStart, mergeEnd ) );
		surfaceModel.change( tx );
		range = tx.translateRange( range );
		innerListItemRange = tx.translateRange( innerListItemRange );
		outerListItemRange = tx.translateRange( outerListItemRange );
	}

	// TODO If this listItem has a child list, split&unwrap it

	surfaceModel.setLinearSelection( range );
};

/**
 * Unindent a list item.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @method
 * @param {ve.dm.ListItemNode} listItem List item to unindent
 * @throws {Error} listItem must be a ve.dm.ListItemNode
 */
ve.ui.IndentationAction.prototype.unindentListItem = function ( listItem ) {
	if ( !( listItem instanceof ve.dm.ListItemNode ) ) {
		throw new Error( 'listItem must be a ve.dm.ListItemNode' );
	}
	/*
	 * Outdenting a list item is done as follows:
	 * 1. Split the parent list to isolate the listItem in its own list
	 * 1a. Split the list before the listItem if it's not the first child
	 * 1b. Split the list after the listItem if it's not the last child
	 * 2. If this isolated list's parent is not a listItem, unwrap the listItem and the isolated list, and stop.
	 * 3. Split the parent listItem to isolate the list in its own listItem
	 * 3a. Split the listItem before the list if it's not the first child
	 * 3b. Split the listItem after the list if it's not the last child
	 * 4. Unwrap the now-isolated listItem and the isolated list
	 */
	// TODO: Child list handling, gotta figure that out.
	var tx, i, length, children, child, splitListRange,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument(),
		fragment = surfaceModel.getLinearFragment( listItem.getOuterRange(), true ),
		list = listItem.getParent(),
		listElement = list.getClonedElement(),
		grandParentType = list.getParent().getType(),
		listItemRange = listItem.getOuterRange();

	// CAREFUL: after initializing the variables above, we cannot use the model tree!
	// The first transaction will cause rebuilds so the nodes we have references to now
	// will be detached and useless after the first transaction. Instead, inspect
	// documentModel.data to find out things about the current structure.

	// (1) Split the listItem into a separate list
	if ( documentModel.data.getData( listItemRange.start - 1 ).type !== 'list' ) {
		// (1a) listItem is not the first child, split the list before listItem
		tx = ve.dm.Transaction.newFromInsertion( documentModel, listItemRange.start,
			[ { type: '/list' }, listElement ]
		);
		surfaceModel.change( tx );
		// tx.translateRange( listItemRange ) doesn't do what we want
		listItemRange = listItemRange.translate( 2 );
	}
	if ( documentModel.data.getData( listItemRange.end ).type !== '/list' ) {
		// (1b) listItem is not the last child, split the list after listItem
		tx = ve.dm.Transaction.newFromInsertion( documentModel, listItemRange.end,
			[ { type: '/list' }, listElement ]
		);
		surfaceModel.change( tx );
		// listItemRange is not affected by this transaction
	}
	splitListRange = new ve.Range( listItemRange.start - 1, listItemRange.end + 1 );

	if ( grandParentType !== 'listItem' ) {
		// The user is trying to unindent a list item that's not nested
		// (2) Unwrap both the list and the listItem, dumping the listItem's contents
		// into the list's parent
		tx = ve.dm.Transaction.newFromWrap( documentModel,
			new ve.Range( listItemRange.start + 1, listItemRange.end - 1 ),
			[ { type: 'list' }, { type: 'listItem' } ],
			[],
			[],
			[]
		);
		surfaceModel.change( tx );

		// ensure paragraphs are not wrapper paragraphs now
		// that they are not in a list
		children = fragment.getSiblingNodes();
		for ( i = 0, length = children.length; i < length; i++ ) {
			child = children[i].node;
			if (
				child.type === 'paragraph' &&
				child.element.internal &&
				child.element.internal.generated === 'wrapper'
			) {
				delete child.element.internal.generated;
				if ( ve.isEmptyObject( child.element.internal ) ) {
					delete child.element.internal;
				}
			}
		}
	} else {
		// (3) Split the list away from parentListItem into its own listItem
		// TODO factor common split logic somehow?
		if ( documentModel.data.getData( splitListRange.start - 1 ).type !== 'listItem' ) {
			// (3a) Split parentListItem before list
			tx = ve.dm.Transaction.newFromInsertion( documentModel, splitListRange.start,
				[ { type: '/listItem' }, { type: 'listItem' } ]
			);
			surfaceModel.change( tx );
			// tx.translateRange( splitListRange ) doesn't do what we want
			splitListRange = splitListRange.translate( 2 );
		}
		if ( documentModel.data.getData( splitListRange.end ).type !== '/listItem' ) {
			// (3b) Split parentListItem after list
			tx = ve.dm.Transaction.newFromInsertion( documentModel, splitListRange.end,
				[ { type: '/listItem' }, { type: 'listItem' } ]
			);
			surfaceModel.change( tx );
			// splitListRange is not affected by this transaction
		}

		// (4) Unwrap the list and its containing listItem
		tx = ve.dm.Transaction.newFromWrap( documentModel,
			new ve.Range( splitListRange.start + 1, splitListRange.end - 1 ),
			[ { type: 'listItem' }, { type: 'list' } ],
			[],
			[],
			[]
		);
		surfaceModel.change( tx );
	}
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.IndentationAction );

/*!
 * VisualEditor UserInterface ListAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * List action.
 *
 * @class
 * @extends ve.ui.Action
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.ListAction = function VeUiListAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.ListAction, ve.ui.Action );

/* Static Properties */

ve.ui.ListAction.static.name = 'list';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.ListAction.static.methods = [ 'wrap', 'unwrap', 'toggle', 'wrapOnce' ];

/* Methods */

/**
 * Check if the current selection is wrapped in a list of a given style
 *
 * @method
 * @param {string|null} style List style, e.g. 'number' or 'bullet', or null for any style
 * @return {boolean} Current selection is all wrapped in a list
 */
ve.ui.ListAction.prototype.allWrapped = function ( style ) {
	var i, len,
		attributes = style ? { style: style } : undefined,
		nodes = this.surface.getModel().getFragment().getLeafNodes(),
		all = !!nodes.length;

	for ( i = 0, len = nodes.length; i < len; i++ ) {
		if (
			( len === 1 || !nodes[i].range || nodes[i].range.getLength() ) &&
			!nodes[i].node.hasMatchingAncestor( 'list', attributes )
		) {
			all = false;
			break;
		}
	}
	return all;
};

/**
 * Toggle a list around content.
 *
 * @method
 * @param {string} style List style, e.g. 'number' or 'bullet'
 * @param {boolean} noBreakpoints Don't create breakpoints
 * @return {boolean} Action was executed
 */
ve.ui.ListAction.prototype.toggle = function ( style, noBreakpoints ) {
	return this[this.allWrapped( style ) ? 'unwrap' : 'wrap']( style, noBreakpoints );
};

/**
 * Add a list around content only if it has no list already.
 *
 * @method
 * @param {string} style List style, e.g. 'number' or 'bullet'
 * @param {boolean} noBreakpoints Don't create breakpoints
 * @return {boolean} Action was executed
 */
ve.ui.ListAction.prototype.wrapOnce = function ( style, noBreakpoints ) {
	// Check for a list of any style
	if ( !this.allWrapped() ) {
		return this.wrap( style, noBreakpoints );
	}
	return false;
};

/**
 * Add a list around content.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @method
 * @param {string} style List style, e.g. 'number' or 'bullet'
 * @param {boolean} noBreakpoints Don't create breakpoints
 * @return {boolean} Action was executed
 */
ve.ui.ListAction.prototype.wrap = function ( style, noBreakpoints ) {
	var tx, i, previousList, groupRange, group, range,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument(),
		selection = surfaceModel.getSelection(),
		groups;

	if ( !( selection instanceof ve.dm.LinearSelection ) ) {
		return false;
	}

	range = selection.getRange();

	if ( !noBreakpoints ) {
		surfaceModel.breakpoint();
	}

	// TODO: Would be good to refactor at some point and avoid/abstract path split for block slug
	// and not block slug.

	if (
		range.isCollapsed() &&
		!documentModel.data.isContentOffset( range.to ) &&
		documentModel.hasSlugAtOffset( range.to )
	) {
		// Inside block level slug
		surfaceModel.change(
			ve.dm.Transaction.newFromInsertion(
				documentModel,
				range.from,
				[
					{ type: 'list', attributes: { style: style } },
					{ type: 'listItem' },
					{ type: 'paragraph' },
					{ type: '/paragraph' },
					{ type: '/listItem' },
					{ type: '/list' }

				]
			),
			new ve.dm.LinearSelection( documentModel, new ve.Range( range.to + 3 ) )
		);
	} else {
		groups = documentModel.getCoveredSiblingGroups( range );
		for ( i = 0; i < groups.length; i++ ) {
			group = groups[i];
			if ( group.grandparent && group.grandparent.getType() === 'list' ) {
				if ( group.grandparent !== previousList ) {
					// Change the list style
					surfaceModel.change(
						ve.dm.Transaction.newFromAttributeChanges(
							documentModel, group.grandparent.getOffset(), { style: style }
						),
						selection
					);
					// Skip this one next time
					previousList = group.grandparent;
				}
			} else {
				// Get a range that covers the whole group
				groupRange = new ve.Range(
					group.nodes[0].getOuterRange().start,
					group.nodes[group.nodes.length - 1].getOuterRange().end
				);
				// Convert everything to paragraphs first
				surfaceModel.change(
					ve.dm.Transaction.newFromContentBranchConversion(
						documentModel, groupRange, 'paragraph'
					),
					selection
				);
				// Wrap everything in a list and each content branch in a listItem
				tx = ve.dm.Transaction.newFromWrap(
					documentModel,
					groupRange,
					[],
					[{ type: 'list', attributes: { style: style } }],
					[],
					[{ type: 'listItem' }]
				);
				surfaceModel.change(
					tx,
					new ve.dm.LinearSelection( documentModel, tx.translateRange( range ) )
				);
			}
		}
	}
	if ( !noBreakpoints ) {
		surfaceModel.breakpoint();
	}
	this.surface.getView().focus();
	return true;
};

/**
 * Remove list around content.
 *
 * TODO: Refactor functionality into {ve.dm.SurfaceFragment}.
 *
 * @method
 * @param {boolean} noBreakpoints Don't create breakpoints
 * @return {boolean} Action was executed
 */
ve.ui.ListAction.prototype.unwrap = function ( noBreakpoints ) {
	var node,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument();

	if ( !( surfaceModel.getSelection() instanceof ve.dm.LinearSelection ) ) {
		return false;
	}

	if ( !noBreakpoints ) {
		surfaceModel.breakpoint();
	}

	do {
		node = documentModel.getBranchNodeFromOffset( surfaceModel.getSelection().getRange().start );
	} while ( node.hasMatchingAncestor( 'list' ) && this.surface.execute( 'indentation', 'decrease' ) );

	if ( !noBreakpoints ) {
		surfaceModel.breakpoint();
	}

	this.surface.getView().focus();
	return true;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.ListAction );

/*!
 * VisualEditor ContentEditable TableNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * Table action.
 *
 * @class
 * @extends ve.ui.Action
 *
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.TableAction = function VeUiTableAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.TableAction, ve.ui.Action );

/* Static Properties */

ve.ui.TableAction.static.name = 'table';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.TableAction.static.methods = [ 'create', 'insert', 'delete', 'changeCellStyle', 'mergeCells', 'caption' ];

/* Methods */

/**
 * Creates a new table.
 *
 * @param {Object} [options] Table creation options
 * @param {number} [options.cols=4] Number of rows
 * @param {number} [options.rows=3] Number of columns
 * @param {boolean} [options.header] Make the first row a header row
 * @param {Object} [options.type='table'] Table node type, must inherit from table
 * @param {Object} [options.attributes] Attributes to give the table
 * @return {boolean} Action was executed
 */
ve.ui.TableAction.prototype.create = function ( options ) {
	options = options || {};
	var i,
		type = options.type || 'table',
		tableElement = { type: type },
		surfaceModel = this.surface.getModel(),
		fragment = surfaceModel.getFragment(),
		data = [],
		numberOfCols = options.cols || 4,
		numberOfRows = options.rows || 3;

	if ( !( fragment.getSelection() instanceof ve.dm.LinearSelection ) ) {
		return false;
	}

	if ( options.attributes ) {
		tableElement.attributes = ve.copy( options.attributes );
	}

	data.push( tableElement );
	data.push( { type: 'tableSection', attributes: { style: 'body' } } );
	if ( options.header ) {
		data = data.concat( ve.dm.TableRowNode.static.createData( { style: 'header', cellCount: numberOfCols } ) );
	}
	for ( i = 0; i < numberOfRows; i++ ) {
		data = data.concat( ve.dm.TableRowNode.static.createData( { style: 'data', cellCount: numberOfCols } ) );
	}
	data.push( { type: '/tableSection' } );
	data.push( { type: '/' + type } );

	fragment.insertContent( data, false );
	surfaceModel.setSelection( new ve.dm.TableSelection(
		fragment.getDocument(), fragment.getSelection().getRange(), 0, 0, 0, 0
	) );
	return true;
};

/**
 * Inserts a new row or column into the currently focused table.
 *
 * @param {String} mode Insertion mode; 'row' to insert a new row, 'col' for a new column
 * @param {String} position Insertion position; 'before' to insert before the current selection,
 *   'after' to insert after it
 * @return {boolean} Action was executed
 */
ve.ui.TableAction.prototype.insert = function ( mode, position ) {
	var index,
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection();

	if ( !( selection instanceof ve.dm.TableSelection ) ) {
		return false;
	}
	if ( mode === 'col' ) {
		index = position === 'before' ? selection.startCol : selection.endCol;
	} else {
		index = position === 'before' ? selection.startRow : selection.endRow;
	}
	if ( position === 'before' ) {
		if ( mode === 'col' ) {
			selection = selection.newFromAdjustment( 1, 0 );
		} else {
			selection = selection.newFromAdjustment( 0, 1 );
		}
		surfaceModel.setSelection( selection );
	}
	this.insertRowOrCol( selection.getTableNode(), mode, index, position, selection );
	return true;
};

/**
 * Deletes selected rows, columns, or the whole table.
 *
 * @param {String} mode Deletion mode; 'row' to delete rows, 'col' for columns, 'table' to remove the whole table
 * @return {boolean} Action was executed
 */
ve.ui.TableAction.prototype.delete = function ( mode ) {
	var tableNode, minIndex, maxIndex, isFull,
		selection = this.surface.getModel().getSelection();

	if ( !( selection instanceof ve.dm.TableSelection ) ) {
		return false;
	}

	tableNode = selection.getTableNode();
	// Either delete the table or rows or columns
	if ( mode === 'table' ) {
		this.deleteTable( tableNode );
	} else {
		if ( mode === 'col' ) {
			minIndex = selection.startCol;
			maxIndex = selection.endCol;
			isFull = selection.isFullRow();
		} else {
			minIndex = selection.startRow;
			maxIndex = selection.endRow;
			isFull = selection.isFullCol();
		}
		// delete the whole table if all rows or cols get deleted
		if ( isFull ) {
			this.deleteTable( tableNode );
		} else {
			this.deleteRowsOrColumns( tableNode.matrix, mode, minIndex, maxIndex );
		}
	}
	return true;
};

/**
 * Change cell style
 *
 * @param {string} style Cell style; 'header' or 'data'
 * @return {boolean} Action was executed
 */
ve.ui.TableAction.prototype.changeCellStyle = function ( style ) {
	var i, ranges,
		txs = [],
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection();

	if ( !( selection instanceof ve.dm.TableSelection ) ) {
		return false;
	}

	ranges = selection.getOuterRanges();
	for ( i = ranges.length - 1; i >= 0; i-- ) {
		txs.push(
			ve.dm.Transaction.newFromAttributeChanges(
				surfaceModel.getDocument(), ranges[i].start, { style: style }
			)
		);
	}
	surfaceModel.change( txs );
	return true;
};

/**
 * Merge multiple cells into one, or split a merged cell.
 *
 * @return {boolean} Action was executed
 */
ve.ui.TableAction.prototype.mergeCells = function () {
	var i, r, c, cell, cells, hasNonPlaceholders,
		txs = [],
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection(),
		matrix = selection.getTableNode().getMatrix();

	if ( !( selection instanceof ve.dm.TableSelection ) ) {
		return false;
	}

	if ( selection.isSingleCell() ) {
		// Split
		cells = selection.getMatrixCells( true );
		txs.push(
			ve.dm.Transaction.newFromAttributeChanges(
				surfaceModel.getDocument(), cells[0].node.getOuterRange().start,
				{ colspan: 1, rowspan: 1 }
			)
		);
		for ( i = cells.length - 1; i >= 1; i-- ) {
			txs.push(
				this.replacePlaceholder(
					matrix,
					cells[i],
					{ style: cells[0].node.getStyle() }
				)
			);
		}
		surfaceModel.change( txs );
	} else {
		// Merge
		cells = selection.getMatrixCells();
		txs.push(
			ve.dm.Transaction.newFromAttributeChanges(
				surfaceModel.getDocument(), cells[0].node.getOuterRange().start,
				{
					colspan: 1 + selection.endCol - selection.startCol,
					rowspan: 1 + selection.endRow - selection.startRow
				}
			)
		);
		for ( i = cells.length - 1; i >= 1; i-- ) {
			txs.push(
				ve.dm.Transaction.newFromRemoval(
					surfaceModel.getDocument(), cells[i].node.getOuterRange()
				)
			);
		}
		surfaceModel.change( txs );

		// Check for rows filled with entirely placeholders. If such a row exists, delete it.
		for ( r = selection.endRow; r >= selection.startRow; r-- ) {
			hasNonPlaceholders = false;
			for ( c = 0; ( cell = matrix.getCell( r, c ) ) !== undefined; c++ ) {
				if ( cell && !cell.isPlaceholder() ) {
					hasNonPlaceholders = true;
					break;
				}
			}
			if ( !hasNonPlaceholders ) {
				this.deleteRowsOrColumns( matrix, 'row', r, r );
			}
		}

		// Check for columns filled with entirely placeholders. If such a column exists, delete it.
		for ( c = selection.endCol; c >= selection.startCol; c-- ) {
			hasNonPlaceholders = false;
			for ( r = 0; ( cell = matrix.getCell( r, c ) ) !== undefined; r++ ) {
				if ( cell && !cell.isPlaceholder() ) {
					hasNonPlaceholders = true;
					break;
				}
			}
			if ( !hasNonPlaceholders ) {
				this.deleteRowsOrColumns( matrix, 'col', c, c );
			}
		}
	}
	return true;
};

/**
 * Toggle the existence of a caption node on the table
 *
 * @return {boolean} Action was executed
 */
ve.ui.TableAction.prototype.caption = function () {
	var fragment, captionNode, nodes, node, tableFragment,
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection();

	if ( selection instanceof ve.dm.TableSelection ) {
		captionNode = selection.getTableNode().getCaptionNode();
	} else if ( selection instanceof ve.dm.LinearSelection ) {
		nodes = surfaceModel.getFragment().getSelectedLeafNodes();

		node = nodes[0];
		while ( node ) {
			if ( node instanceof ve.dm.TableCaptionNode ) {
				captionNode = node;
				break;
			}
			node = node.getParent();
		}
		if ( !captionNode ) {
			return;
		}
		tableFragment = surfaceModel.getFragment( new ve.dm.TableSelection(
			surfaceModel.getDocument(),
			captionNode.getParent().getOuterRange(),
			0, 0, 0, 0,
			true
		) );
	} else {
		return false;
	}

	if ( captionNode ) {
		fragment = surfaceModel.getLinearFragment( captionNode.getOuterRange(), true );
		fragment.removeContent();
		if ( tableFragment ) {
			tableFragment.select();
		}
	} else {
		fragment = surfaceModel.getLinearFragment( new ve.Range( selection.tableRange.start + 1 ), true );

		fragment.insertContent( [
			{ type: 'tableCaption' },
			{ type: 'paragraph', internal: { generated: 'wrapper' } },
			{ type: '/paragraph' },
			{ type: '/tableCaption' }
		], false );

		fragment.collapseToStart().adjustLinearSelection( 2, 2 ).select();
	}
	return true;
};

/* Low-level API */
// TODO: This API does only depends on the model so it should possibly be moved

/**
 * Deletes a whole table.
 *
 * @param {ve.dm.TableNode} tableNode Table node
 */
ve.ui.TableAction.prototype.deleteTable = function ( tableNode ) {
	this.surface.getModel().getLinearFragment( tableNode.getOuterRange() ).delete();
};

/**
 * Inserts a new row or column.
 *
 * Example: a new row can be inserted after the 2nd row using
 *
 *    insertRowOrCol( table, 'row', 1, 'after' );
 *
 * @param {ve.dm.TableNode} tableNode Table node
 * @param {String} mode Insertion mode; 'row' or 'col'
 * @param {Number} index Row or column index of the base row or column.
 * @param {String} position Insertion position; 'before' or 'after'
 * @param {ve.dm.TableSelection} [selection] Selection to move to after insertion
 */
ve.ui.TableAction.prototype.insertRowOrCol = function ( tableNode, mode, index, position, selection ) {
	var refIndex, cells, refCells, before,
		offset, range, i, l, cell, refCell, data, style,
		matrix = tableNode.matrix,
		txs = [],
		updated = {},
		inserts = [],
		surfaceModel = this.surface.getModel();

	before = position === 'before';

	// Note: when we insert a new row (or column) we might need to increment a span property
	// instead of inserting a new cell.
	// To achieve this we look at the so called base row and a so called reference row.
	// The base row is the one after or before which the new row will be inserted.
	// The reference row is the one which is currently at the place of the new one.
	// E.g., consider inserting a new row after the second: the base row is the second, the
	// reference row is the third.
	// A span must be increased if the base cell and the reference cell have the same 'owner'.
	// E.g.:  C* | P**; C | P* | P**, i.e., one of the two cells might be the owner of the other,
	// or vice versa, or both a placeholders of a common cell.

	// The index of the reference row or column
	refIndex = index + ( before ? -1 : 1 );
	// cells of the selected row or column
	if ( mode === 'row' ) {
		cells = matrix.getRow( index ) || [];
		refCells = matrix.getRow( refIndex ) || [];
	} else {
		cells = matrix.getColumn( index ) || [];
		refCells = matrix.getColumn( refIndex ) || [];
	}

	for ( i = 0, l = cells.length; i < l; i++ ) {
		cell = cells[i];
		if ( !cell ) {
			continue;
		}
		refCell = refCells[i];
		// Detect if span update is necessary
		if ( refCell && ( cell.isPlaceholder() || refCell.isPlaceholder() ) ) {
			if ( cell.node === refCell.node ) {
				cell = cell.owner || cell;
				if ( !updated[cell.key] ) {
					// Note: we can safely record span modifications as they do not affect range offsets.
					txs.push( this.incrementSpan( cell, mode ) );
					updated[cell.key] = true;
				}
				continue;
			}
		}
		// If it is not a span changer, we record the base cell as a reference for insertion
		inserts.push( cell );
	}

	// Inserting a new row differs completely from inserting a new column:
	// For a new row, a new row node is created, and inserted relative to an existing row node.
	// For a new column, new cells are inserted into existing row nodes at appropriate positions,
	// i.e., relative to an existing cell node.
	if ( mode === 'row' ) {
		data = ve.dm.TableRowNode.static.createData( {
			cellCount: inserts.length,
			// Take the style of the first cell of the selected row
			style: cells[0].node.getStyle()
		} );
		range = matrix.getRowNode( index ).getOuterRange();
		offset = before ? range.start : range.end;
		txs.push( ve.dm.Transaction.newFromInsertion( surfaceModel.getDocument(), offset, data ) );
	} else {
		// Make sure that the inserts are in descending offset order
		// so that the transactions do not affect subsequent range offsets.
		inserts.sort( ve.dm.TableMatrixCell.static.sortDescending );

		// For inserting a new cell we need to find a reference cell node
		// which we can use to get a proper insertion offset.
		for ( i = 0; i < inserts.length; i++ ) {
			cell = inserts[i];
			if ( !cell ) {
				continue;
			}
			// If the cell is a placeholder this will find a close cell node in the same row
			refCell = matrix.findClosestCell( cell );
			if ( refCell ) {
				range = refCell.node.getOuterRange();
				// if the found cell is before the base cell the new cell must be placed after it, in any case,
				// Only if the base cell is not a placeholder we have to consider the insert mode.
				if ( refCell.col < cell.col || ( refCell.col === cell.col && !before ) ) {
					offset = range.end;
				} else {
					offset = range.start;
				}
				style = refCell.node.getStyle();
			} else {
				// if there are only placeholders in the row, we use the row node's inner range
				// for the insertion offset
				range = matrix.getRowNode( cell.row ).getRange();
				offset = before ? range.start : range.end;
				style = cells[0].node.getStyle();
			}
			data = ve.dm.TableCellNode.static.createData( { style: style } );
			txs.push( ve.dm.Transaction.newFromInsertion( surfaceModel.getDocument(), offset, data ) );
		}
	}
	surfaceModel.change( txs, selection.translateByTransactions( txs ) );
};

/**
 * Increase the span of a cell by one.
 *
 * @param {ve.dm.TableMatrixCell} cell Table matrix cell
 * @param {String} mode Span to increment; 'row' or 'col'
 * @return {ve.dm.Transaction} Transaction
 */
ve.ui.TableAction.prototype.incrementSpan = function ( cell, mode ) {
	var data,
		surfaceModel = this.surface.getModel();

	if ( mode === 'row' ) {
		data = { rowspan: cell.node.getRowspan() + 1 };
	} else {
		data = { colspan: cell.node.getColspan() + 1 };
	}

	return ve.dm.Transaction.newFromAttributeChanges( surfaceModel.getDocument(), cell.node.getOuterRange().start, data );
};

/**
 * Decreases the span of a cell so that the given interval is removed.
 *
 * @param {ve.dm.TableMatrixCell} cell Table matrix cell
 * @param {String} mode Span to decrement 'row' or 'col'
 * @param {Number} minIndex Smallest row or column index (inclusive)
 * @param {Number} maxIndex Largest row or column index (inclusive)
 * @return {ve.dm.Transaction} Transaction
 */
ve.ui.TableAction.prototype.decrementSpan = function ( cell, mode, minIndex, maxIndex ) {
	var span, data,
		surfaceModel = this.surface.getModel();

	span = ( minIndex - cell[mode] ) + Math.max( 0, cell[mode] + cell.node.getSpans()[mode] - 1 - maxIndex );
	if ( mode === 'row' ) {
		data = { rowspan: span };
	} else {
		data = { colspan: span };
	}

	return ve.dm.Transaction.newFromAttributeChanges( surfaceModel.getDocument(), cell.node.getOuterRange().start, data );
};

/**
 * Deletes rows or columns within a given range.
 *
 * e.g. rows 2-4 can be deleted using
 *
 *    ve.ui.TableAction.deleteRowsOrColumns( matrix, 'row', 1, 3 );
 *
 * @param {ve.dm.TableMatrix} matrix Table matrix
 * @param {String} mode 'row' or 'col'
 * @param {Number} minIndex Smallest row or column index to be deleted
 * @param {Number} maxIndex Largest row or column index to be deleted (inclusive)
 */
ve.ui.TableAction.prototype.deleteRowsOrColumns = function ( matrix, mode, minIndex, maxIndex ) {
	var row, col, i, l, cell, key,
		span, startRow, startCol, endRow, endCol, rowNode,
		cells = [],
		txs = [],
		adapted = {},
		actions = [],
		surfaceModel = this.surface.getModel();

	// Deleting cells can have two additional consequences:
	// 1. The cell is a Placeholder. The owner's span must be decreased.
	// 2. The cell is owner of placeholders which get orphaned by the deletion.
	//    The first of the placeholders now becomes the real cell, with the span adjusted.
	//    It also inherits all of the properties and content of the removed cell.
	// Insertions and deletions of cells must be done in an appropriate order, so that the transactions
	// do not interfere with each other. To achieve that, we record insertions and deletions and
	// sort them by the position of the cell (row, column) in the table matrix.

	if ( mode === 'row' ) {
		for ( row = minIndex; row <= maxIndex; row++ ) {
			cells = cells.concat( matrix.getRow( row ) );
		}
	} else {
		for ( col = minIndex; col <= maxIndex; col++ ) {
			cells = cells.concat( matrix.getColumn( col ) );
		}
	}

	for ( i = 0, l = cells.length; i < l; i++ ) {
		cell = cells[i];
		if ( !cell ) {
			continue;
		}
		if ( cell.isPlaceholder() ) {
			key = cell.owner.key;
			if ( !adapted[key] ) {
				// Note: we can record this transaction already, as it does not have an effect on the
				// node range
				txs.push( this.decrementSpan( cell.owner, mode, minIndex, maxIndex ) );
				adapted[key] = true;
			}
			continue;
		}

		// Detect if the owner of a spanning cell gets deleted and
		// leaves orphaned placeholders
		span = cell.node.getSpans()[mode];
		if ( cell[mode] + span - 1  > maxIndex ) {
			// add inserts for orphaned place holders
			if ( mode === 'col' ) {
				startRow = cell.row;
				startCol = maxIndex + 1;
			} else {
				startRow = maxIndex + 1;
				startCol = cell.col;
			}
			endRow = cell.row + cell.node.getRowspan() - 1;
			endCol = cell.col + cell.node.getColspan() - 1;

			// Record the insertion to apply it later
			actions.push( {
				action: 'insert',
				cell: matrix.getCell( startRow, startCol ),
				colspan: 1 + endCol - startCol,
				rowspan: 1 + endRow - startRow,
				style: cell.node.getStyle(),
				content: surfaceModel.getDocument().getData( cell.node.getRange() )
			} );
		}

		// Cell nodes only get deleted when deleting columns (otherwise row nodes)
		if ( mode === 'col' ) {
			actions.push( { action: 'delete', cell: cell });
		}
	}

	// Make sure that the actions are in descending offset order
	// so that the transactions do not affect subsequent range offsets.
	// Sort recorded actions to make sure the transactions will not interfere with respect to offsets
	actions.sort( function ( a, b ) {
		return ve.dm.TableMatrixCell.static.sortDescending( a.cell, b.cell );
	} );

	if ( mode === 'row' ) {
		// First replace orphaned placeholders which are below the last deleted row,
		// thus, this works with regard to transaction offsets
		for ( i = 0; i < actions.length; i++ ) {
			txs.push( this.replacePlaceholder( matrix, actions[i].cell, actions[i] ) );
		}
		// Remove rows in reverse order to have valid transaction offsets
		for ( row = maxIndex; row >= minIndex; row-- ) {
			rowNode = matrix.getRowNode( row );
			txs.push( ve.dm.Transaction.newFromRemoval( surfaceModel.getDocument(), rowNode.getOuterRange() ) );
		}
	} else {
		for ( i = 0; i < actions.length; i++ ) {
			if ( actions[i].action === 'insert' ) {
				txs.push( this.replacePlaceholder( matrix, actions[i].cell, actions[i] ) );
			} else {
				txs.push( ve.dm.Transaction.newFromRemoval( surfaceModel.getDocument(), actions[i].cell.node.getOuterRange() ) );
			}
		}
	}
	surfaceModel.change( txs, new ve.dm.NullSelection( surfaceModel.getDocument() ) );
};

/**
 * Inserts a new cell for an orphaned placeholder.
 *
 * @param {ve.dm.TableMatrix} matrix Table matrix
 * @param {ve.dm.TableMatrixCell} placeholder Placeholder cell to replace
 * @param {Object} [options] Options to pass to ve.dm.TableCellNode.static.createData
 * @return {ve.dm.Transaction} Transaction
 */
ve.ui.TableAction.prototype.replacePlaceholder = function ( matrix, placeholder, options ) {
	var range, offset, data,
		// For inserting the new cell a reference cell node
		// which is used to get an insertion offset.
		refCell = matrix.findClosestCell( placeholder ),
		surfaceModel = this.surface.getModel();

	if ( refCell ) {
		range = refCell.node.getOuterRange();
		offset = ( placeholder.col < refCell.col ) ? range.start : range.end;
	} else {
		// if there are only placeholders in the row, the row node's inner range is used
		range = matrix.getRowNode( placeholder.row ).getRange();
		offset = range.start;
	}
	data = ve.dm.TableCellNode.static.createData( options );
	return ve.dm.Transaction.newFromInsertion( surfaceModel.getDocument(), offset, data );
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.TableAction );

/*!
 * VisualEditor UserInterface WindowAction class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Window action.
 *
 * @class
 * @extends ve.ui.Action
 * @constructor
 * @param {ve.ui.Surface} surface Surface to act on
 */
ve.ui.WindowAction = function VeUiWindowAction( surface ) {
	// Parent constructor
	ve.ui.Action.call( this, surface );
};

/* Inheritance */

OO.inheritClass( ve.ui.WindowAction, ve.ui.Action );

/* Static Properties */

ve.ui.WindowAction.static.name = 'window';

/**
 * List of allowed methods for the action.
 *
 * @static
 * @property
 */
ve.ui.WindowAction.static.methods = [ 'open', 'close', 'toggle' ];

/* Methods */

/**
 * Open a window.
 *
 * @method
 * @param {string} name Symbolic name of window to open
 * @param {Object} [data] Window opening data
 * @param {string} [action] Action to execute after opening, or immediately if the window is already open
 * @return {boolean} Action was executed
 */
ve.ui.WindowAction.prototype.open = function ( name, data, action ) {
	var windowType = this.getWindowType( name ),
		windowManager = windowType && this.getWindowManager( windowType ),
		surface = this.surface,
		fragment = surface.getModel().getFragment( undefined, true ),
		dir = surface.getView().getDocument().getDirectionFromSelection( fragment.getSelection() ) ||
			surface.getModel().getDocument().getDir();

	if ( !windowManager ) {
		return false;
	}

	data = ve.extendObject( { dir: dir }, data, { fragment: fragment } );

	surface.getView().deactivate();
	if ( windowType === 'toolbar' ) {
		data = ve.extendObject( data, { surface: surface } );
	}

	windowManager.getWindow( name ).then( function ( win ) {
		var opening = windowManager.openWindow( win, data );

		surface.getView().emit( 'position' );

		opening.then( function ( closing ) {
			closing.then( function ( closed ) {
				surface.getView().activate();
				closed.then( function () {
					surface.getView().emit( 'position' );
				} );
			} );
		} ).always( function () {
			if ( action ) {
				win.executeAction( action );
			}
		} );
	} );

	return true;
};

/**
 * Close a window
 *
 * @method
 * @param {string} name Symbolic name of window to open
 * @param {Object} [data] Window closing data
 * @return {boolean} Action was executed
 */
ve.ui.WindowAction.prototype.close = function ( name, data ) {
	var windowType = this.getWindowType( name ),
		windowManager = windowType && this.getWindowManager( windowType );

	if ( !windowManager ) {
		return false;
	}

	windowManager.closeWindow( name, data );
	return true;
};

/**
 * Toggle a window between open and close
 *
 * @method
 * @param {string} name Symbolic name of window to open or close
 * @param {Object} [data] Window opening or closing data
 * @return {boolean} Action was executed
 */
ve.ui.WindowAction.prototype.toggle = function ( name, data ) {
	var win,
		windowType = this.getWindowType( name ),
		windowManager = windowType && this.getWindowManager( windowType );

	if ( !windowManager ) {
		return false;
	}

	win = windowManager.getCurrentWindow();
	if ( !win || win.constructor.static.name !== name ) {
		this.open( name, data );
	} else {
		this.close( name, data );
	}
	return true;
};

/**
 * Get the type of a window class
 *
 * @param {string} name Window name
 * @return {string|null} Window type: 'inspector', 'toolbar' or 'dialog'
 */
ve.ui.WindowAction.prototype.getWindowType = function ( name ) {
	var windowClass = ve.ui.windowFactory.lookup( name );
	if ( windowClass.prototype instanceof ve.ui.FragmentInspector ) {
		return 'inspector';
	} else if ( windowClass.prototype instanceof ve.ui.ToolbarDialog ) {
		return 'toolbar';
	} else if ( windowClass.prototype instanceof OO.ui.Dialog ) {
		return 'dialog';
	}
	return null;
};

/**
 * Get the window manager for a specified window class
 *
 * @param {Function} windowClass Window class
 * @return {ve.ui.WindowManager|null} Window manager
 */
ve.ui.WindowAction.prototype.getWindowManager = function ( windowType ) {
	switch ( windowType ) {
		case 'inspector':
			return this.surface.getContext().getInspectors();
		case 'toolbar':
			return this.surface.getToolbarDialogs();
		case 'dialog':
			return this.surface.getDialogs();
	}
	return null;
};

/* Registration */

ve.ui.actionFactory.register( ve.ui.WindowAction );

/*!
 * VisualEditor UserInterface ClearAnnotationCommand class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface clear all annotations command.
 *
 * @class
 * @extends ve.ui.Command
 *
 * @constructor
 */
ve.ui.ClearAnnotationCommand = function VeUiClearAnnotationCommand() {
	// Parent constructor
	ve.ui.ClearAnnotationCommand.super.call(
		this, 'clear', 'annotation', 'clearAll',
		{ supportedSelections: ['linear', 'table'] }
	);
};

/* Inheritance */

OO.inheritClass( ve.ui.ClearAnnotationCommand, ve.ui.Command );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.ClearAnnotationCommand.prototype.isExecutable = function ( fragment ) {
	// Parent method
	return ve.ui.ClearAnnotationCommand.super.prototype.isExecutable.apply( this, arguments ) &&
		fragment.hasAnnotations();
};

/* Registration */

ve.ui.commandRegistry.register( new ve.ui.ClearAnnotationCommand() );

/*!
 * VisualEditor UserInterface HistoryCommand class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface history command.
 *
 * @class
 * @extends ve.ui.Command
 *
 * @constructor
 * @param {string} name
 * @param {string} method
 */
ve.ui.HistoryCommand = function VeUiHistoryCommand( name, method ) {
	// Parent constructor
	ve.ui.HistoryCommand.super.call( this, name, 'history', method );

	this.check = {
		undo: 'canUndo',
		redo: 'canRedo'
	}[method];
};

/* Inheritance */

OO.inheritClass( ve.ui.HistoryCommand, ve.ui.Command );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.HistoryCommand.prototype.isExecutable = function ( fragment ) {
	var surface = fragment.getSurface();

	// Parent method
	return ve.ui.HistoryCommand.super.prototype.isExecutable.apply( this, arguments ) &&
		surface[this.check].call( surface );
};

/* Registration */

ve.ui.commandRegistry.register( new ve.ui.HistoryCommand( 'undo', 'undo' ) );

ve.ui.commandRegistry.register( new ve.ui.HistoryCommand( 'redo', 'redo' ) );

/*!
 * VisualEditor UserInterface IndentationCommand class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface indentation command.
 *
 * @class
 * @extends ve.ui.Command
 *
 * @constructor
 * @param {string} name
 * @param {string} method
 */
ve.ui.IndentationCommand = function VeUiIndentationCommand( name, method ) {
	// Parent constructor
	ve.ui.IndentationCommand.super.call(
		this, name, 'indentation', method,
		{ supportedSelections: ['linear'] }
	);
};

/* Inheritance */

OO.inheritClass( ve.ui.IndentationCommand, ve.ui.Command );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.IndentationCommand.prototype.isExecutable = function ( fragment ) {
	// Parent method
	if ( !ve.ui.IndentationCommand.super.prototype.isExecutable.apply( this, arguments ) ) {
		return false;
	}
	var i, len,
		nodes = fragment.getSelectedLeafNodes(),
		any = false;
	for ( i = 0, len = nodes.length; i < len; i++ ) {
		if ( nodes[i].hasMatchingAncestor( 'listItem' ) ) {
			any = true;
			break;
		}
	}
	return any;
};

/* Registration */

ve.ui.commandRegistry.register( new ve.ui.IndentationCommand( 'indent', 'increase' ) );

ve.ui.commandRegistry.register( new ve.ui.IndentationCommand( 'outdent', 'decrease' ) );

/*!
 * VisualEditor UserInterface MergeCellsCommand class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface merge cells command.
 *
 * @class
 * @extends ve.ui.Command
 *
 * @constructor
 */
ve.ui.MergeCellsCommand = function VeUiMergeCellsCommand() {
	// Parent constructor
	ve.ui.MergeCellsCommand.super.call(
		this, 'mergeCells', 'table', 'mergeCells',
		{ supportedSelections: ['table'] }
	);
};

/* Inheritance */

OO.inheritClass( ve.ui.MergeCellsCommand, ve.ui.Command );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.MergeCellsCommand.prototype.isExecutable = function ( fragment ) {
	// Parent method
	return ve.ui.MergeCellsCommand.super.prototype.isExecutable.apply( this, arguments ) &&
		fragment.getSelection().getMatrixCells( true ).length > 1;
};

/* Registration */

ve.ui.commandRegistry.register( new ve.ui.MergeCellsCommand() );

/*!
 * VisualEditor UserInterface TableCaptionCommand class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface table caption command.
 *
 * @class
 * @extends ve.ui.Command
 *
 * @constructor
 */
ve.ui.TableCaptionCommand = function VeUiTableCaptionCommand() {
	// Parent constructor
	ve.ui.TableCaptionCommand.super.call(
		this, 'tableCaption', 'table', 'caption',
		{ supportedSelections: ['linear', 'table'] }
	);
};

/* Inheritance */

OO.inheritClass( ve.ui.TableCaptionCommand, ve.ui.Command );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.TableCaptionCommand.prototype.isExecutable = function ( fragment ) {
	// Parent method
	if ( !ve.ui.TableCaptionCommand.super.prototype.isExecutable.apply( this, arguments ) ) {
		return false;
	}

	var i, len, nodes, hasCaptionNode,
		selection = fragment.getSelection();

	if ( selection instanceof ve.dm.TableSelection ) {
		return true;
	} else {
		nodes = fragment.getSelectedLeafNodes();
		hasCaptionNode = !!nodes.length;

		for ( i = 0, len = nodes.length; i < len; i++ ) {
			if ( !nodes[i].hasMatchingAncestor( 'tableCaption' ) ) {
				hasCaptionNode = false;
				break;
			}
		}
		return hasCaptionNode;
	}
};

/* Registration */

ve.ui.commandRegistry.register( new ve.ui.TableCaptionCommand() );

/*!
 * VisualEditor UserInterface FragmentDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Dialog for working with fragments of content.
 *
 * @class
 * @abstract
 * @extends OO.ui.ProcessDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.FragmentDialog = function VeUiFragmentDialog( config ) {
	// Parent constructor
	ve.ui.FragmentDialog.super.call( this, config );

	// Properties
	this.fragment = null;
};

/* Inheritance */

OO.inheritClass( ve.ui.FragmentDialog, OO.ui.ProcessDialog );

/**
 * @inheritdoc
 * @throws {Error} If fragment was not provided through data parameter
 */
ve.ui.FragmentDialog.prototype.getSetupProcess = function ( data ) {
	data = data || {};
	return ve.ui.FragmentDialog.super.prototype.getSetupProcess.apply( this, data )
		.next( function () {
			if ( !( data.fragment instanceof ve.dm.SurfaceFragment ) ) {
				throw new Error( 'Cannot open dialog: opening data must contain a fragment' );
			}
			this.fragment = data.fragment;
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.FragmentDialog.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.FragmentDialog.super.prototype.getTeardownProcess.apply( this, data )
		.first( function () {
			this.fragment.select();
			this.fragment = null;
		}, this );
};

/**
 * Get the surface fragment the dialog is for
 *
 * @returns {ve.dm.SurfaceFragment|null} Surface fragment the dialog is for, null if the dialog is closed
 */
ve.ui.FragmentDialog.prototype.getFragment = function () {
	return this.fragment;
};

/*!
 * VisualEditor user interface NodeDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Dialog for working with a node.
 *
 * @class
 * @extends ve.ui.FragmentDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.NodeDialog = function VeUiNodeDialog( config ) {
	// Parent constructor
	ve.ui.NodeDialog.super.call( this, config );

	// Properties
	this.selectedNode = null;
};

/* Inheritance */

OO.inheritClass( ve.ui.NodeDialog, ve.ui.FragmentDialog );

/* Static Properties */

/**
 * Node classes compatible with this dialog.
 *
 * @static
 * @property {Function}
 * @inheritable
 */
ve.ui.NodeDialog.static.modelClasses = [];

/* Methods */

/**
 * Get the selected node.
 *
 * Should only be called after setup and before teardown.
 * If no node is selected or the selected node is incompatible, null will be returned.
 *
 * @param {Object} [data] Dialog opening data
 * @return {ve.dm.Node} Selected node
 */
ve.ui.NodeDialog.prototype.getSelectedNode = function () {
	var i, len,
		modelClasses = this.constructor.static.modelClasses,
		selectedNode = this.getFragment().getSelectedNode();

	for ( i = 0, len = modelClasses.length; i < len; i++ ) {
		if ( selectedNode instanceof modelClasses[i] ) {
			return selectedNode;
		}
	}
	return null;
};

/**
 * @inheritdoc
 */
ve.ui.NodeDialog.prototype.initialize = function ( data ) {
	// Parent method
	ve.ui.NodeDialog.super.prototype.initialize.call( this, data );

	// Initialization
	this.$content.addClass( 've-ui-nodeDialog' );
};

/**
 * @inheritdoc
 */
ve.ui.NodeDialog.prototype.getSetupProcess = function ( data ) {
	return ve.ui.NodeDialog.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			this.selectedNode = this.getSelectedNode( data );
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.NodeDialog.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.NodeDialog.super.prototype.getTeardownProcess.call( this, data )
		.first( function () {
			this.selectedNode = null;
		}, this );
};

/*!
 * VisualEditor UserInterface ToolbarDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Toolbar dialog.
 *
 * @class
 * @abstract
 * @extends OO.ui.Dialog
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {Object} [config] Configuration options
 */
ve.ui.ToolbarDialog = function VeUiToolbarDialog( config ) {
	// Parent constructor
	ve.ui.ToolbarDialog.super.call( this, config );

	// Pre-initialization
	// This class needs to exist before setup to constrain the height
	// of the dialog when it first loads.
	this.$element.addClass( 've-ui-toolbarDialog' );
};

/* Inheritance */

OO.inheritClass( ve.ui.ToolbarDialog, OO.ui.Dialog );

/* Static Properties */

ve.ui.ToolbarDialog.static.size = 'full';

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.ToolbarDialog.prototype.initialize = function () {
	// Parent method
	ve.ui.ToolbarDialog.super.prototype.initialize.call( this );

	this.$content.addClass( 've-ui-toolbarDialog-content' );
};

/*!
 * VisualEditor UserInterface CommandHelpDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Dialog for listing all command keyboard shortcuts.
 *
 * @class
 * @extends OO.ui.ProcessDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.CommandHelpDialog = function VeUiCommandHelpDialog( config ) {
	// Parent constructor
	ve.ui.CommandHelpDialog.super.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.CommandHelpDialog, OO.ui.ProcessDialog );

/* Static Properties */

ve.ui.CommandHelpDialog.static.name = 'commandHelp';

ve.ui.CommandHelpDialog.static.size = 'large';

ve.ui.CommandHelpDialog.static.title =
	OO.ui.deferMsg( 'visualeditor-dialog-command-help-title' );

ve.ui.CommandHelpDialog.static.actions = [
	{
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-done' ),
		flags: 'safe'
	}
];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.CommandHelpDialog.prototype.getBodyHeight = function () {
	return Math.round( this.contentLayout.$element[0].scrollHeight );
};

/**
 * @inheritdoc
 */
ve.ui.CommandHelpDialog.prototype.initialize = function () {
	// Parent method
	ve.ui.CommandHelpDialog.super.prototype.initialize.call( this );

	var i, j, jLen, k, kLen, triggerList, commands, shortcut,
		platform = ve.getSystemPlatform(),
		platformKey = platform === 'mac' ? 'mac' : 'pc',
		$list, $shortcut,
		commandGroups = this.constructor.static.getCommandGroups();

	this.contentLayout = new OO.ui.PanelLayout( {
		$: this.$,
		scrollable: true,
		padded: true,
		expanded: false
	} );
	this.$container = this.$( '<div>' ).addClass( 've-ui-commandHelpDialog-container' );

	for ( i in commandGroups ) {
		commands = commandGroups[i].commands;
		$list = this.$( '<dl>' ).addClass( 've-ui-commandHelpDialog-list' );
		for ( j = 0, jLen = commands.length; j < jLen; j++ ) {
			if ( commands[j].trigger ) {
				triggerList = ve.ui.triggerRegistry.lookup( commands[j].trigger );
			} else {
				triggerList = [];
				for ( k = 0, kLen = commands[j].shortcuts.length; k < kLen; k++ ) {
					shortcut = commands[j].shortcuts[k];
					triggerList.push(
						new ve.ui.Trigger(
							ve.isPlainObject( shortcut ) ? shortcut[platformKey] : shortcut,
							true
						)
					);
				}
			}
			$shortcut = this.$( '<dt>' );
			for ( k = 0, kLen = triggerList.length; k < kLen; k++ ) {
				$shortcut.append( this.$( '<kbd>' ).text(
					triggerList[k].getMessage().replace( /\+/g, ' + ' )
				) );
			}
			$list.append(
				$shortcut,
				this.$( '<dd>' ).text( ve.msg( commands[j].msg ) )
			);
		}
		this.$container.append(
			this.$( '<div>' )
				.addClass( 've-ui-commandHelpDialog-section' )
				.append(
					this.$( '<h3>' ).text( ve.msg( commandGroups[i].title ) ),
					$list
				)
		);
	}

	this.contentLayout.$element.append( this.$container );
	this.$body.append( this.contentLayout.$element );
};

/* Static methods */

/**
 * Get the list of commands, grouped by type
 *
 * @static
 * @returns {Object} Object containing command groups, consist of a title message and array of commands
 */
ve.ui.CommandHelpDialog.static.getCommandGroups = function () {
	return {
		textStyle: {
			title: 'visualeditor-shortcuts-text-style',
			commands: [
				{ trigger: 'bold', msg: 'visualeditor-annotationbutton-bold-tooltip' },
				{ trigger: 'italic', msg: 'visualeditor-annotationbutton-italic-tooltip' },
				{ trigger: 'link', msg: 'visualeditor-annotationbutton-link-tooltip' },
				{ trigger: 'superscript', msg: 'visualeditor-annotationbutton-superscript-tooltip' },
				{ trigger: 'subscript', msg: 'visualeditor-annotationbutton-subscript-tooltip' },
				{ trigger: 'underline', msg: 'visualeditor-annotationbutton-underline-tooltip' },
				{ trigger: 'code', msg: 'visualeditor-annotationbutton-code-tooltip' },
				{ trigger: 'strikethrough', msg: 'visualeditor-annotationbutton-strikethrough-tooltip' },
				{ trigger: 'clear', msg: 'visualeditor-clearbutton-tooltip' }
			]
		},
		clipboard: {
			title: 'visualeditor-shortcuts-clipboard',
			commands: [
				{
					shortcuts: [ {
						mac: 'cmd+x',
						pc: 'ctrl+x'
					} ],
					msg: 'visualeditor-clipboard-cut'
				},
				{
					shortcuts: [ {
						mac: 'cmd+c',
						pc: 'ctrl+c'
					} ],
					msg: 'visualeditor-clipboard-copy'
				},
				{
					shortcuts: [ {
						mac: 'cmd+v',
						pc: 'ctrl+v'
					} ],
					msg: 'visualeditor-clipboard-paste'
				},
				{ trigger: 'pasteSpecial', msg: 'visualeditor-clipboard-paste-special' }
			]
		},
		formatting: {
			title: 'visualeditor-shortcuts-formatting',
			commands: [
				{ trigger: 'paragraph', msg: 'visualeditor-formatdropdown-format-paragraph' },
				{ shortcuts: ['ctrl+(1-6)'], msg: 'visualeditor-formatdropdown-format-heading-label' },
				{ trigger: 'preformatted', msg: 'visualeditor-formatdropdown-format-preformatted' },
				{ trigger: 'blockquote', msg: 'visualeditor-formatdropdown-format-blockquote' },
				{ trigger: 'indent', msg: 'visualeditor-indentationbutton-indent-tooltip' },
				{ trigger: 'outdent', msg: 'visualeditor-indentationbutton-outdent-tooltip' }
			]
		},
		history: {
			title: 'visualeditor-shortcuts-history',
			commands: [
				{ trigger: 'undo', msg: 'visualeditor-historybutton-undo-tooltip' },
				{ trigger: 'redo', msg: 'visualeditor-historybutton-redo-tooltip' }
			]
		},
		other: {
			title: 'visualeditor-shortcuts-other',
			commands: [
				{ trigger: 'findAndReplace', msg: 'visualeditor-find-and-replace-title' },
				{ trigger: 'findNext', msg: 'visualeditor-find-and-replace-next-button' },
				{ trigger: 'findPrevious', msg: 'visualeditor-find-and-replace-previous-button' },
				{ trigger: 'selectAll', msg: 'visualeditor-content-select-all' },
				{ trigger: 'commandHelp', msg: 'visualeditor-dialog-command-help-title' }
			]
		}
	};
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.CommandHelpDialog );

/*!
 * VisualEditor UserInterface FindAndReplaceDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Find and replace dialog.
 *
 * @class
 * @extends ve.ui.ToolbarDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.FindAndReplaceDialog = function VeUiFindAndReplaceDialog( config ) {
	// Parent constructor
	ve.ui.FindAndReplaceDialog.super.call( this, config );

	// Properties
	this.surface = null;
	this.invalidRegex = false;

	// Pre-initialization
	this.$element.addClass( 've-ui-findAndReplaceDialog' );
};

/* Inheritance */

OO.inheritClass( ve.ui.FindAndReplaceDialog, ve.ui.ToolbarDialog );

ve.ui.FindAndReplaceDialog.static.name = 'findAndReplace';

ve.ui.FindAndReplaceDialog.static.title = OO.ui.deferMsg( 'visualeditor-find-and-replace-title' );

/**
 * Maximum number of results to render
 *
 * @property {number}
 */
ve.ui.FindAndReplaceDialog.static.maxRenderedResults = 100;

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.FindAndReplaceDialog.prototype.initialize = function () {
	// Parent method
	ve.ui.FindAndReplaceDialog.super.prototype.initialize.call( this );

	this.$findResults = this.$( '<div>' ).addClass( 've-ui-findAndReplaceDialog-findResults' );
	this.fragments = [];
	this.results = 0;
	// Range over the list of fragments indicating which ones where rendered,
	// e.g. [1,3] means fragments 1 & 2 were rendered
	this.renderedFragments = null;
	this.replacing = false;
	this.focusedIndex = 0;
	this.query = null;
	this.findText = new OO.ui.TextInputWidget( {
		$: this.$,
		placeholder: ve.msg( 'visualeditor-find-and-replace-find-text' )
	} );
	this.matchCaseToggle = new OO.ui.ToggleButtonWidget( {
		$: this.$,
		icon: 'case-sensitive',
		iconTitle: ve.msg( 'visualeditor-find-and-replace-match-case' )
	} );
	this.regexToggle = new OO.ui.ToggleButtonWidget( {
		$: this.$,
		icon: 'regular-expression',
		iconTitle: ve.msg( 'visualeditor-find-and-replace-regular-expression' )
	} );

	this.previousButton = new OO.ui.ButtonWidget( {
		$: this.$,
		icon: 'previous',
		iconTitle: ve.msg( 'visualeditor-find-and-replace-previous-button' ) + ' ' +
			ve.ui.triggerRegistry.getMessages( 'findPrevious' ).join( ', ' )
	} );
	this.nextButton = new OO.ui.ButtonWidget( {
		$: this.$,
		icon: 'next',
		iconTitle: ve.msg( 'visualeditor-find-and-replace-next-button' ) + ' ' +
			ve.ui.triggerRegistry.getMessages( 'findNext' ).join( ', ' )
	} );
	this.replaceText = new OO.ui.TextInputWidget( {
		$: this.$,
		placeholder: ve.msg( 'visualeditor-find-and-replace-replace-text' )
	} );
	this.replaceButton = new OO.ui.ButtonWidget( {
		$: this.$,
		label: ve.msg( 'visualeditor-find-and-replace-replace-button' )
	} );
	this.replaceAllButton = new OO.ui.ButtonWidget( {
		$: this.$,
		label: ve.msg( 'visualeditor-find-and-replace-replace-all-button' )
	} );

	var optionsGroup = new OO.ui.ButtonGroupWidget( {
			$: this.$,
			classes: ['ve-ui-findAndReplaceDialog-cell'],
			items: [
				this.matchCaseToggle,
				this.regexToggle
			]
		} ),
		navigateGroup = new OO.ui.ButtonGroupWidget( {
			$: this.$,
			classes: ['ve-ui-findAndReplaceDialog-cell'],
			items: [
				this.previousButton,
				this.nextButton
			]
		} ),
		replaceGroup = new OO.ui.ButtonGroupWidget( {
			$: this.$,
			classes: ['ve-ui-findAndReplaceDialog-cell'],
			items: [
				this.replaceButton,
				this.replaceAllButton
			]
		} ),
		doneButton = new OO.ui.ButtonWidget( {
			$: this.$,
			classes: ['ve-ui-findAndReplaceDialog-cell'],
			label: ve.msg( 'visualeditor-find-and-replace-done' )
		} ),
		$findRow = this.$( '<div>' ).addClass( 've-ui-findAndReplaceDialog-row' ),
		$replaceRow = this.$( '<div>' ).addClass( 've-ui-findAndReplaceDialog-row' );

	// Events
	this.onWindowScrollDebounced = ve.debounce( this.onWindowScroll.bind( this ), 250 );
	this.updateFragmentsDebounced = ve.debounce( this.updateFragments.bind( this ) );
	this.renderFragmentsDebounced = ve.debounce( this.renderFragments.bind( this ) );
	this.findText.connect( this, {
		change: 'onFindChange',
		enter: 'onFindTextEnter'
	} );
	this.matchCaseToggle.connect( this, { change: 'onFindChange' } );
	this.regexToggle.connect( this, { change: 'onFindChange' } );
	this.nextButton.connect( this, { click: 'findNext' } );
	this.previousButton.connect( this, { click: 'findPrevious' } );
	this.replaceButton.connect( this, { click: 'onReplaceButtonClick' } );
	this.replaceAllButton.connect( this, { click: 'onReplaceAllButtonClick' } );
	doneButton.connect( this, { click: 'close' } );

	// Initialization
	this.findText.$input.prop( 'tabIndex', 1 );
	this.replaceText.$input.prop( 'tabIndex', 2 );
	this.$content.addClass( 've-ui-findAndReplaceDialog-content' );
	this.$body
		.append(
			$findRow.append(
				this.$( '<div>' ).addClass( 've-ui-findAndReplaceDialog-cell ve-ui-findAndReplaceDialog-cell-input' ).append(
					this.findText.$element
				),
				navigateGroup.$element,
				optionsGroup.$element
			),
			$replaceRow.append(
				this.$( '<div>' ).addClass( 've-ui-findAndReplaceDialog-cell ve-ui-findAndReplaceDialog-cell-input' ).append(
					this.replaceText.$element
				),
				replaceGroup.$element,
				doneButton.$element
			)
		);
};

/**
 * @inheritdoc
 */
ve.ui.FindAndReplaceDialog.prototype.getSetupProcess = function ( data ) {
	data = data || {};
	return ve.ui.FindAndReplaceDialog.super.prototype.getSetupProcess.call( this, data )
		.first( function () {
			this.surface = data.surface;
			this.surface.$selections.append( this.$findResults );

			// Events
			this.surface.getModel().connect( this, { documentUpdate: this.updateFragmentsDebounced } );
			this.surface.getView().connect( this, { position: this.renderFragmentsDebounced } );
			this.surface.getView().$window.on( 'scroll', this.onWindowScrollDebounced );

			var text = data.fragment.getText();
			if ( text && text !== this.findText.getValue() ) {
				this.findText.setValue( text );
			} else {
				this.onFindChange();
			}
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.FindAndReplaceDialog.prototype.getReadyProcess = function ( data ) {
	return ve.ui.FindAndReplaceDialog.super.prototype.getReadyProcess.call( this, data )
		.next( function () {
			this.findText.focus().select();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.FindAndReplaceDialog.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.FindAndReplaceDialog.super.prototype.getTeardownProcess.call( this, data )
		.next( function () {
			var surfaceView = this.surface.getView();

			// Events
			this.surface.getModel().disconnect( this );
			surfaceView.disconnect( this );
			this.surface.getView().$window.off( 'scroll', this.onWindowScrollDebounced );

			surfaceView.focus();
			this.$findResults.empty().detach();
			this.fragments = [];
			this.surface = null;
		}, this );
};

/**
 * Handle window scroll events
 */
ve.ui.FindAndReplaceDialog.prototype.onWindowScroll = function () {
	if ( this.renderedFragments.getLength() < this.results ) {
		// If viewport clipping is being used, reposition results based on the current viewport
		this.renderFragments();
	}
};

/**
 * Handle change events to the find inputs (text or match case)
 */
ve.ui.FindAndReplaceDialog.prototype.onFindChange = function () {
	this.updateFragments();
	this.renderFragments();
	this.highlightFocused( true );
};

/**
 * Handle enter events on the find text input
 *
 * @param {jQuery.Event} e
 */
ve.ui.FindAndReplaceDialog.prototype.onFindTextEnter = function ( e ) {
	if ( !this.results ) {
		return;
	}
	if ( e.shiftKey ) {
		this.findPrevious();
	} else {
		this.findNext();
	}
};

/**
 * Update search result fragments
 */
ve.ui.FindAndReplaceDialog.prototype.updateFragments = function () {
	var i, l,
		surfaceModel = this.surface.getModel(),
		documentModel = surfaceModel.getDocument(),
		ranges = [],
		matchCase = this.matchCaseToggle.getValue(),
		isRegex = this.regexToggle.getValue(),
		find = this.findText.getValue();

	this.invalidRegex = false;

	if ( isRegex && find ) {
		try {
			this.query = new RegExp( find );
		} catch ( e ) {
			this.invalidRegex = true;
		}
	} else {
		this.query = find;
	}
	this.findText.$element.toggleClass( 've-ui-findAndReplaceDialog-findText-error', this.invalidRegex );

	this.fragments = [];
	if ( this.query ) {
		ranges = documentModel.findText( this.query, matchCase, true );
		for ( i = 0, l = ranges.length; i < l; i++ ) {
			this.fragments.push( surfaceModel.getLinearFragment( ranges[i], true, true ) );
		}
	}
	this.results = this.fragments.length;
	this.focusedIndex = Math.min( this.focusedIndex, this.results ? this.results - 1 : 0 );
	this.nextButton.setDisabled( !this.results );
	this.previousButton.setDisabled( !this.results );
	this.replaceButton.setDisabled( !this.results );
	this.replaceAllButton.setDisabled( !this.results );
};

/**
 * Position results markers
 */
ve.ui.FindAndReplaceDialog.prototype.renderFragments = function () {
	if ( this.replacing ) {
		return;
	}

	var i, selection, viewportRange,
		start = 0,
		end = this.results;

	// When there are a large number of results, calculate the viewport range for clipping
	if ( this.results > 50 ) {
		viewportRange = this.surface.getView().getViewportRange();
		for ( i = 0; i < this.results; i++ ) {
			selection = this.fragments[i].getSelection();
			if ( viewportRange && selection.getRange().start < viewportRange.start ) {
				start = i + 1;
				continue;
			}
			if ( viewportRange && selection.getRange().end > viewportRange.end ) {
				end = i;
				break;
			}
		}
	}

	// When there are too many results to render, just render the current one
	if ( end - start <= this.constructor.static.maxRenderedResults ) {
		this.renderRangeOfFragments( new ve.Range( start, end ) );
	} else {
		this.renderRangeOfFragments( new ve.Range( this.focusedIndex, this.focusedIndex + 1 ) );
	}
};

/**
 * Render subset of search result fragments
 *
 * @param {ve.Range} range Range of fragments to render
 */
ve.ui.FindAndReplaceDialog.prototype.renderRangeOfFragments = function ( range ) {
	var i, j, jlen, rects, $result, top;
	this.$findResults.empty();
	for ( i = range.start; i < range.end; i++ ) {
		rects = this.surface.getView().getSelectionRects( this.fragments[i].getSelection() );
		$result = this.$( '<div>' ).addClass( 've-ui-findAndReplaceDialog-findResult' );
		top = Infinity;
		for ( j = 0, jlen = rects.length; j < jlen; j++ ) {
			top = Math.min( top, rects[j].top );
			$result.append( this.$( '<div>' ).css( {
				top: rects[j].top,
				left: rects[j].left,
				width: rects[j].width,
				height: rects[j].height
			} ) );
		}
		$result.data( 'top', top );
		this.$findResults.append( $result );
	}
	this.renderedFragments = range;
	this.highlightFocused();
};

/**
 * Highlight the focused result marker
 *
 * @param {boolean} scrollIntoView Scroll the marker into view
 */
ve.ui.FindAndReplaceDialog.prototype.highlightFocused = function ( scrollIntoView ) {
	var $result, rect, top,
		offset, windowScrollTop, windowScrollHeight,
		surfaceView = this.surface.getView();

	if ( this.results ) {
		this.findText.setLabel(
			ve.msg( 'visualeditor-find-and-replace-results', this.focusedIndex + 1, this.results )
		);
	} else {
		this.findText.setLabel(
			this.invalidRegex ? ve.msg( 'visualeditor-find-and-replace-invalid-regex' ) : ''
		);
		return;
	}

	this.$findResults
		.find( '.ve-ui-findAndReplaceDialog-findResult-focused' )
		.removeClass( 've-ui-findAndReplaceDialog-findResult-focused' );

	if ( this.renderedFragments.containsOffset( this.focusedIndex ) ) {
		$result = this.$findResults.children().eq( this.focusedIndex - this.renderedFragments.start )
			.addClass( 've-ui-findAndReplaceDialog-findResult-focused' );

		top = $result.data( 'top' );
	} else {
		// Focused result hasn't been rendered yet so find its offset manually
		rect = surfaceView.getSelectionBoundingRect( this.fragments[this.focusedIndex].getSelection() );
		top = rect.top;
		this.renderRangeOfFragments( new ve.Range( this.focusedIndex, this.focusedIndex + 1 ) );
	}

	if ( scrollIntoView ) {
		surfaceView = this.surface.getView();
		offset = top + surfaceView.$element.offset().top;
		windowScrollTop = surfaceView.$window.scrollTop() + this.surface.toolbarHeight;
		windowScrollHeight = surfaceView.$window.height() - this.surface.toolbarHeight;

		if ( offset < windowScrollTop || offset > windowScrollTop + windowScrollHeight ) {
			surfaceView.$( 'body, html' ).animate( { scrollTop: offset - ( windowScrollHeight / 2  ) }, 'fast' );
		}
	}
};

/**
 * Find the next result
 */
ve.ui.FindAndReplaceDialog.prototype.findNext = function () {
	this.focusedIndex = ( this.focusedIndex + 1 ) % this.results;
	this.highlightFocused( true );
};

/**
 * Find the previous result
 */
ve.ui.FindAndReplaceDialog.prototype.findPrevious = function () {
	this.focusedIndex = ( this.focusedIndex + this.results - 1 ) % this.results;
	this.highlightFocused( true );
};

/**
 * Handle click events on the replace button
 */
ve.ui.FindAndReplaceDialog.prototype.onReplaceButtonClick = function () {
	var end;

	if ( !this.results ) {
		return;
	}

	this.replace( this.focusedIndex );

	// Find the next fragment after this one ends. Ensures that if we replace
	// 'foo' with 'foofoo' we don't select the just-inserted text.
	end = this.fragments[this.focusedIndex].getSelection().getRange().end;
	// updateFragmentsDebounced is triggered by insertContent, but call it immediately
	// so we can find the next fragment to select.
	this.updateFragments();
	if ( !this.results ) {
		this.focusedIndex = 0;
		return;
	}
	while ( this.fragments[this.focusedIndex] && this.fragments[this.focusedIndex].getSelection().getRange().end <= end ) {
		this.focusedIndex++;
	}
	// We may have iterated off the end
	this.focusedIndex = this.focusedIndex % this.results;
};

/**
 * Handle click events on the previous all button
 */
ve.ui.FindAndReplaceDialog.prototype.onReplaceAllButtonClick = function () {
	var i, l;

	for ( i = 0, l = this.results; i < l; i++ ) {
		this.replace( i );
	}
};

/**
 * Replace the result at a specified index
 *
 * @param {number} index Index to replace
 */
ve.ui.FindAndReplaceDialog.prototype.replace = function ( index ) {
	var replace = this.replaceText.getValue();

	if ( this.query instanceof RegExp ) {
		this.fragments[index].insertContent(
			this.fragments[index].getText().replace( this.query, replace ),
			true
		);
	} else {
		this.fragments[index].insertContent( replace, true );
	}
};

/**
 * @inheritdoc
 */
ve.ui.FindAndReplaceDialog.prototype.getActionProcess = function ( action ) {
	if ( action === 'findNext' || action === 'findPrevious' ) {
		return new OO.ui.Process( this[action], this );
	}
	return ve.ui.FindAndReplaceDialog.super.prototype.getActionProcess.call( this, action );
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.FindAndReplaceDialog );

/*!
 * VisualEditor UserInterface ProgressDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Dialog for showing operations in progress.
 *
 * @class
 * @extends OO.ui.MessageDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.ProgressDialog = function VeUiProgressDialog( config ) {
	// Parent constructor
	ve.ui.ProgressDialog.super.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.ProgressDialog, OO.ui.MessageDialog );

/* Static Properties */

ve.ui.ProgressDialog.static.name = 'progress';

ve.ui.ProgressDialog.static.size = 'medium';

ve.ui.ProgressDialog.static.actions = [
	{
		action: 'cancel',
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-cancel' ),
		flags: 'destructive'
	}
];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.ProgressDialog.prototype.initialize = function () {
	// Parent method
	ve.ui.ProgressDialog.super.prototype.initialize.call( this );

	// Properties
	this.inProgress = 0;
	this.cancelDeferreds = [];
};

/**
 * @inheritdoc
 */
ve.ui.ProgressDialog.prototype.getSetupProcess = function ( data ) {
	data = data || {};

	// Parent method
	return ve.ui.ProgressDialog.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			var i, l, $row, progressBar, fieldLayout, cancelButton, cancelDeferred,
				progresses = data.progresses;

			this.inProgress = progresses.length;
			this.text.$element.empty();
			this.cancelDeferreds = [];

			for ( i = 0, l = progresses.length; i < l; i++ ) {
				cancelDeferred = $.Deferred();
				$row = this.$( '<div>' ).addClass( 've-ui-progressDialog-row' );
				progressBar = new OO.ui.ProgressBarWidget( { $: this.$ } );
				fieldLayout = new OO.ui.FieldLayout(
					progressBar,
					{
						$: this.$,
						label: progresses[i].label,
						align: 'top'
					}
				);
				cancelButton = new OO.ui.ButtonWidget( {
					$: this.$,
					framed: false,
					icon: 'clear',
					iconTitle: OO.ui.deferMsg( 'visualeditor-dialog-action-cancel' )
				} ).on( 'click', cancelDeferred.reject.bind( cancelDeferred ) );

				this.text.$element.append(
					$row.append(
						fieldLayout.$element, cancelButton.$element
					)
				);
				progresses[i].progressBarDeferred.resolve( progressBar, cancelDeferred.promise() );
				/*jshint loopfunc:true */
				progresses[i].progressCompletePromise.then(
					this.progressComplete.bind( this, $row, false ),
					this.progressComplete.bind( this, $row, true )
				);
				this.cancelDeferreds.push( cancelDeferred );
			}
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.ProgressDialog.prototype.getActionProcess = function ( action ) {
	return new OO.ui.Process( function () {
		var i, l;
		if ( action === 'cancel' ) {
			for ( i = 0, l = this.cancelDeferreds.length; i < l; i++ ) {
				this.cancelDeferreds[i].reject();
			}
		}
		this.close( { action: action } );
	}, this );
};

/**
 * Progress has completed for an item
 *
 * @param {jQuery} $row Row containing progress bar which has completed
 * @param {boolean} failed The item failed
 */
ve.ui.ProgressDialog.prototype.progressComplete = function ( $row, failed ) {
	this.inProgress--;
	if ( !this.inProgress ) {
		this.close();
	}
	if ( failed ) {
		$row.remove();
		this.updateSize();
	}
};

/* Static methods */

/* Registration */

ve.ui.windowFactory.register( ve.ui.ProgressDialog );

/*!
 * VisualEditor UserInterface delimiter-separated values file transfer handler class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Delimiter-separated values file transfer handler.
 *
 * @class
 * @extends ve.ui.DataTransferHandler
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {File} file
 */
ve.ui.DSVFileTransferHandler = function VeUiDSVFileTransferHandler() {
	// Parent constructor
	ve.ui.DSVFileTransferHandler.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ui.DSVFileTransferHandler, ve.ui.DataTransferHandler );

/* Static properties */

ve.ui.DSVFileTransferHandler.static.name = 'dsv';

ve.ui.DSVFileTransferHandler.static.types = [ 'text/csv', 'text/tab-separated-values' ];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.DSVFileTransferHandler.prototype.process = function () {
	this.createProgress( this.insertableDataDeferred.promise() );
	this.reader.readAsText( this.file );
};

/**
 * @inheritdoc
 */
ve.ui.DSVFileTransferHandler.prototype.onFileProgress = function ( e ) {
	if ( e.lengthComputable ) {
		this.setProgress( 100 * e.loaded / e.total );
	} else {
		this.setProgress( false );
	}
};

/**
 * @inheritdoc
 */
ve.ui.DSVFileTransferHandler.prototype.onFileLoad = function () {
	var i, j, line,
		data = [],
		input = Papa.parse( this.reader.result );

	if ( input.meta.aborted || ( input.data.length <= 0 ) ) {
		this.insertableDataDeffered.reject();
		return;
	}

	data.push( { type: 'table' } );
	data.push( { type: 'tableSection', attributes: { style: 'body' } } );

	for ( i = 0; i < input.data.length; i++ ) {
		data.push( { type: 'tableRow' } );
		line = input.data[i];
		for ( j = 0; j < line.length; j++ ) {
			data.push( { type: 'tableCell', attributes: { style: ( i === 0 ? 'header' : 'data' ) } } );
			data.push( { type: 'paragraph', internal: { generated: 'wrapper' } } );
			data = data.concat( line[j].split( '' ) );
			data.push( { type: '/paragraph' } );
			data.push( { type: '/tableCell' } );
		}
		data.push( { type: '/tableRow' } );
	}

	data.push( { type: '/tableSection' } );
	data.push( { type: '/table' } );

	this.insertableDataDeferred.resolve( data );
	this.setProgress( 100 );
};

/**
 * @inheritdoc
 */
ve.ui.DSVFileTransferHandler.prototype.onFileLoadEnd = function () {
	// 'loadend' fires after 'load'/'abort'/'error'.
	// Reject the deferred if it hasn't already resolved.
	this.insertableDataDeferred.reject();
};

/**
 * @inheritdoc
 */
ve.ui.DSVFileTransferHandler.prototype.abort = function () {
	// Parent method
	ve.ui.DSVFileTransferHandler.super.prototype.abort.call( this );

	this.reader.abort();
};

/* Registration */

ve.ui.dataTransferHandlerFactory.register( ve.ui.DSVFileTransferHandler );

/*!
 * VisualEditor UserInterface plain text file data transfer handler class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Plain text data transfer filetransfer handler.
 *
 * @class
 * @extends ve.ui.DataTransferHandler
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {File} file
 */
ve.ui.PlainTextFileTransferHandler = function VeUiPlainTextFileTransferHandler() {
	// Parent constructor
	ve.ui.PlainTextFileTransferHandler.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ui.PlainTextFileTransferHandler, ve.ui.DataTransferHandler );

/* Static properties */

ve.ui.PlainTextFileTransferHandler.static.name = 'plainText';

ve.ui.PlainTextFileTransferHandler.static.types = ['text/plain'];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.PlainTextFileTransferHandler.prototype.process = function () {
	this.createProgress( this.insertableDataDeferred.promise() );
	this.reader.readAsText( this.file );
};

/**
 * @inheritdoc
 */
ve.ui.PlainTextFileTransferHandler.prototype.onFileProgress = function ( e ) {
	if ( e.lengthComputable ) {
		this.setProgress( 100 * e.loaded / e.total );
	} else {
		this.setProgress( false );
	}
};

/**
 * @inheritdoc
 */
ve.ui.PlainTextFileTransferHandler.prototype.onFileLoad = function () {
	var i, l,
		data = [],
		lines = this.reader.result.split( /[\r\n]+/ );

	for ( i = 0, l = lines.length; i < l; i++ ) {
		if ( lines[i].length ) {
			data.push( { type: 'paragraph' } );
			data = data.concat( lines[i].split( '' ) );
			data.push( { type: '/paragraph' } );
		}
	}
	this.insertableDataDeferred.resolve( data );
	this.setProgress( 100 );
};

/**
 * @inheritdoc
 */
ve.ui.PlainTextFileTransferHandler.prototype.onFileLoadEnd = function () {
	// 'loadend' fires after 'load'/'abort'/'error'.
	// Reject the deferred if it hasn't already resolved.
	this.insertableDataDeferred.reject();
};

/**
 * @inheritdoc
 */
ve.ui.PlainTextFileTransferHandler.prototype.abort = function () {
	// Parent method
	ve.ui.PlainTextFileTransferHandler.super.prototype.abort.call( this );

	this.reader.abort();
};

/* Registration */

ve.ui.dataTransferHandlerFactory.register( ve.ui.PlainTextFileTransferHandler );

/*!
 * VisualEditor UserInterface HTML file transfer handler class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * HTML file transfer handler.
 *
 * @class
 * @extends ve.ui.DataTransferHandler
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {File} file
 */
ve.ui.HTMLFileTransferHandler = function VeUiHTMLFileTransferHandler() {
	// Parent constructor
	ve.ui.HTMLFileTransferHandler.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ui.HTMLFileTransferHandler, ve.ui.DataTransferHandler );

/* Static properties */

ve.ui.HTMLFileTransferHandler.static.name = 'html';

ve.ui.HTMLFileTransferHandler.static.types = [ 'text/html', 'application/xhtml+xml' ];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.HTMLFileTransferHandler.prototype.process = function () {
	this.createProgress( this.insertableDataDeferred.promise() );
	this.reader.readAsText( this.file );
};

/**
 * @inheritdoc
 */
ve.ui.HTMLFileTransferHandler.prototype.onFileProgress = function ( e ) {
	if ( e.lengthComputable ) {
		this.setProgress( 100 * e.loaded / e.total );
	} else {
		this.setProgress( false );
	}
};

/**
 * @inheritdoc
 */
ve.ui.HTMLFileTransferHandler.prototype.onFileLoad = function () {
	this.insertableDataDeferred.resolve(
		this.surface.getModel().getDocument().newFromHtml( this.reader.result )
	);
	this.setProgress( 100 );
};

/**
 * @inheritdoc
 */
ve.ui.HTMLFileTransferHandler.prototype.onFileLoadEnd = function () {
	// 'loadend' fires after 'load'/'abort'/'error'.
	// Reject the deferred if it hasn't already resolved.
	this.insertableDataDeferred.reject();
};

/**
 * @inheritdoc
 */
ve.ui.HTMLFileTransferHandler.prototype.abort = function () {
	// Parent method
	ve.ui.HTMLFileTransferHandler.super.prototype.abort.call( this );

	this.reader.abort();
};

/* Registration */

ve.ui.dataTransferHandlerFactory.register( ve.ui.HTMLFileTransferHandler );

/*!
 * VisualEditor UserInterface ToolbarDialogWindowManager class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Window manager for toolbar dialogs.
 *
 * @class
 * @extends ve.ui.WindowManager
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {ve.ui.Overlay} [overlay] Overlay to use for menus
 */
ve.ui.ToolbarDialogWindowManager = function VeUiToolbarDialogWindowManager( config ) {
	// Parent constructor
	ve.ui.ToolbarDialogWindowManager.super.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.ToolbarDialogWindowManager, ve.ui.WindowManager );

/* Static Properties */

ve.ui.ToolbarDialogWindowManager.static.sizes = ve.copy(
	ve.ui.ToolbarDialogWindowManager.super.static.sizes
);
ve.ui.ToolbarDialogWindowManager.static.sizes.full = {
	width: '100%',
	maxHeight: '100%'
};

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.ToolbarDialogWindowManager.prototype.getTeardownDelay = function () {
	return 250;
};

/*!
 * VisualEditor UserInterface AlignWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Widget that lets the user edit alignment of an object
 *
 * @class
 * @extends OO.ui.ButtonSelectWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {string} [dir='ltr'] Interface directionality
 */
ve.ui.AlignWidget = function VeUiAlignWidget( config ) {
	// Parent constructor
	ve.ui.AlignWidget.super.call( this, config );

	var alignButtons = [
			new OO.ui.ButtonOptionWidget( {
				$: this.$,
				data: 'left',
				icon: 'align-float-left',
				label: ve.msg( 'visualeditor-align-widget-left' )
			} ),
			new OO.ui.ButtonOptionWidget( {
				$: this.$,
				data: 'center',
				icon: 'align-center',
				label: ve.msg( 'visualeditor-align-widget-center' )
			} ),
			new OO.ui.ButtonOptionWidget( {
				$: this.$,
				data: 'right',
				icon: 'align-float-right',
				label: ve.msg( 'visualeditor-align-widget-right' )
			} )
		];

	if ( config.dir === 'rtl' ) {
		alignButtons = alignButtons.reverse();
	}

	this.addItems( alignButtons, 0 );

};

/* Inheritance */

OO.inheritClass( ve.ui.AlignWidget, OO.ui.ButtonSelectWidget );

/*!
 * VisualEditor UserInterface LanguageSearchWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Creates an ve.ui.LanguageSearchWidget object.
 *
 * @class
 * @extends OO.ui.SearchWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.LanguageSearchWidget = function VeUiLanguageSearchWidget( config ) {
	// Configuration initialization
	config = ve.extendObject( {
		placeholder: ve.msg( 'visualeditor-language-search-input-placeholder' )
	}, config );

	// Parent constructor
	OO.ui.SearchWidget.call( this, config );

	// Properties
	this.languageResultWidgets = [];
	this.filteredLanguageResultWidgets = [];

	var i, l, languageCode,
		languageCodes = ve.init.platform.getLanguageCodes().sort();

	for ( i = 0, l = languageCodes.length; i < l; i++ ) {
		languageCode = languageCodes[i];
		this.languageResultWidgets.push(
			new ve.ui.LanguageResultWidget( {
				$: this.$,
				data: {
					code: languageCode,
					name: ve.init.platform.getLanguageName( languageCode ),
					autonym: ve.init.platform.getLanguageAutonym( languageCode )
				}
			} )
		);
	}
	this.setAvailableLanguages();

	// Initialization
	this.$element.addClass( 've-ui-languageSearchWidget' );
};

/* Inheritance */

OO.inheritClass( ve.ui.LanguageSearchWidget, OO.ui.SearchWidget );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.LanguageSearchWidget.prototype.onQueryChange = function () {
	// Parent method
	OO.ui.SearchWidget.prototype.onQueryChange.call( this );

	// Populate
	this.addResults();
};

/**
 * Set available languages to show
 *
 * @param {string[]} Available language codes to show, all if undefined
 */
ve.ui.LanguageSearchWidget.prototype.setAvailableLanguages = function ( availableLanguages ) {
	if ( !availableLanguages ) {
		this.filteredLanguageResultWidgets = this.languageResultWidgets.slice();
		return;
	}
	var i, iLen, languageResult, data;

	this.filteredLanguageResultWidgets = [];

	for ( i = 0, iLen = this.languageResultWidgets.length; i < iLen; i++ ) {
		languageResult = this.languageResultWidgets[i];
		data = languageResult.getData();
		if ( ve.indexOf( data.code, availableLanguages ) !== -1 ) {
			this.filteredLanguageResultWidgets.push( languageResult );
		}
	}
};

/**
 * Update search results from current query
 */
ve.ui.LanguageSearchWidget.prototype.addResults = function () {
	var i, iLen, j, jLen, languageResult, data, matchedProperty,
		matchProperties = ['name', 'autonym', 'code'],
		query = this.query.getValue().trim(),
		matcher = new RegExp( '^' + this.constructor.static.escapeRegex( query ), 'i' ),
		hasQuery = !!query.length,
		items = [];

	this.results.clearItems();

	for ( i = 0, iLen = this.filteredLanguageResultWidgets.length; i < iLen; i++ ) {
		languageResult = this.filteredLanguageResultWidgets[i];
		data = languageResult.getData();
		matchedProperty = null;

		for ( j = 0, jLen = matchProperties.length; j < jLen; j++ ) {
			if ( matcher.test( data[matchProperties[j]] ) ) {
				matchedProperty = matchProperties[j];
				break;
			}
		}

		if ( query === '' || matchedProperty ) {
			items.push(
				languageResult
					.updateLabel( query, matchedProperty )
					.setSelected( false )
					.setHighlighted( false )
			);
		}
	}

	this.results.addItems( items );
	if ( hasQuery ) {
		this.results.highlightItem( this.results.getFirstSelectableItem() );
	}
};

/**
 * Escape regex.
 *
 * Ported from Languagefilter#escapeRegex in jquery.uls.
 *
 * @param {string} value Text
 * @returns {string} Text escaped for use in regex
 */
ve.ui.LanguageSearchWidget.static.escapeRegex = function ( value ) {
	return value.replace( /[\-\[\]{}()*+?.,\\\^$\|#\s]/g, '\\$&' );
};

/*!
 * VisualEditor UserInterface LanguageResultWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Creates an ve.ui.LanguageResultWidget object.
 *
 * @class
 * @extends OO.ui.OptionWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.LanguageResultWidget = function VeUiLanguageResultWidget( config ) {
	// Parent constructor
	OO.ui.OptionWidget.call( this, config );

	// Initialization
	this.$element.addClass( 've-ui-languageResultWidget' );
	this.$name = this.$( '<div>' ).addClass( 've-ui-languageResultWidget-name' );
	this.$otherMatch = this.$( '<div>' ).addClass( 've-ui-languageResultWidget-otherMatch' );
	this.setLabel( this.$otherMatch.add( this.$name ) );
};

/* Inheritance */

OO.inheritClass( ve.ui.LanguageResultWidget, OO.ui.OptionWidget );

/* Methods */

/**
 * Update labels based on query
 *
 * @param {string} [query] Query text which matched this result
 * @param {string} [matchedProperty] Data property which matched the query text
 * @chainable
 */
ve.ui.LanguageResultWidget.prototype.updateLabel = function ( query, matchedProperty ) {
	var $highlighted, data = this.getData();

	// Reset text
	this.$name.text( data.name );
	this.$otherMatch.text( data.code );

	// Highlight where applicable
	if ( matchedProperty ) {
		$highlighted = this.highlightQuery( data[matchedProperty], query );
		if ( matchedProperty === 'name' ) {
			this.$name.empty().append( $highlighted );
		} else {
			this.$otherMatch.empty().append( $highlighted );
		}
	}

	return this;
};

/**
 * Highlight text where a substring query matches
 *
 * @param {string} text Text
 * @param {string} query Query to find
 * @returns {jQuery} Text with query substring wrapped in highlighted span
 */
ve.ui.LanguageResultWidget.prototype.highlightQuery = function ( text, query ) {
	var $result = this.$( '<span>' ),
		offset = text.toLowerCase().indexOf( query.toLowerCase() );

	if ( !query.length || offset === -1 ) {
		return $result.text( text );
	}
	$result.append(
		document.createTextNode( text.slice( 0, offset ) ),
		this.$( '<span>' )
			.addClass( 've-ui-languageResultWidget-highlight' )
			.text( text.slice( offset, offset + query.length ) ),
		document.createTextNode( text.slice( offset + query.length ) )
	);
	return $result.contents();
};

/*!
 * VisualEditor UserInterface LanguageSearchDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Dialog for searching for and selecting a language.
 *
 * @class
 * @extends OO.ui.ProcessDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.LanguageSearchDialog = function VeUiLanguageSearchDialog( config ) {
	// Parent constructor
	ve.ui.LanguageSearchDialog.super.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.LanguageSearchDialog, OO.ui.ProcessDialog );

/* Static Properties */

ve.ui.LanguageSearchDialog.static.name = 'languageSearch';

ve.ui.LanguageSearchDialog.static.size = 'medium';

ve.ui.LanguageSearchDialog.static.title =
	OO.ui.deferMsg( 'visualeditor-dialog-language-search-title' );

ve.ui.LanguageSearchDialog.static.actions = [
	{
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-cancel' )
	}
];

/**
 * Language search widget class to use.
 *
 * @static
 * @property {Function}
 * @inheritable
 */
ve.ui.LanguageSearchDialog.static.languageSearchWidget = ve.ui.LanguageSearchWidget;

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.LanguageSearchDialog.prototype.initialize = function () {
	ve.ui.LanguageSearchDialog.super.prototype.initialize.apply( this, arguments );

	this.searchWidget = new this.constructor.static.languageSearchWidget( {
		$: this.$
	} ).on( 'select', this.onSearchWidgetSelect.bind( this ) );
	this.$body.append( this.searchWidget.$element );
};

/**
 * Handle the search widget being selected
 *
 * @param {Object} data Data from the selected option widget
 */
ve.ui.LanguageSearchDialog.prototype.onSearchWidgetSelect = function ( data ) {
	this.close( {
		action: 'apply',
		lang: data.code,
		dir: ve.init.platform.getLanguageDirection( data.code )
	} );
};

/**
 * @inheritdoc
 */
ve.ui.LanguageSearchDialog.prototype.getSetupProcess = function ( data ) {
	return ve.ui.LanguageSearchDialog.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			this.searchWidget.setAvailableLanguages( data.availableLanguages );
			this.searchWidget.addResults();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.LanguageSearchDialog.prototype.getReadyProcess = function ( data ) {
	return ve.ui.LanguageSearchDialog.super.prototype.getReadyProcess.call( this, data )
		.next( function () {
			this.searchWidget.getQuery().focus();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.LanguageSearchDialog.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.LanguageSearchDialog.super.prototype.getTeardownProcess.call( this, data )
		.first( function () {
			this.searchWidget.getQuery().setValue( '' );
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.LanguageSearchDialog.prototype.getBodyHeight = function () {
	return 300;
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.LanguageSearchDialog );

/*!
 * VisualEditor UserInterface LanguageInputWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Creates an ve.ui.LanguageInputWidget object.
 *
 * @class
 * @extends OO.ui.Widget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {boolean} [requireDir] Require directionality to be set (no 'auto' value)
 * @cfg {ve.ui.WindowManager} [dialogManager] Window manager to launch the language search dialog in
 * @cfg {string[]} [availableLanguages] Available language codes to show in search dialog
 */
ve.ui.LanguageInputWidget = function VeUiLanguageInputWidget( config ) {
	// Configuration initialization
	config = config || {};

	// Parent constructor
	OO.ui.Widget.call( this, config );

	// Properties
	this.lang = null;
	this.dir = null;
	this.overlay = new ve.ui.Overlay( { classes: ['ve-ui-overlay-global'] } );
	this.dialogs = config.dialogManager || new ve.ui.WindowManager( { factory: ve.ui.windowFactory, isolate: true } );
	this.availableLanguages = config.availableLanguages;
	this.findLanguageButton = new OO.ui.ButtonWidget( {
		$: this.$,
		classes: [ 've-ui-languageInputWidget-findLanguageButton' ],
		label: ve.msg( 'visualeditor-languageinspector-widget-changelang' ),
		indicator: 'next'
	} );
	this.languageCodeTextInput = new OO.ui.TextInputWidget( {
		$: this.$,
		classes: [ 've-ui-languageInputWidget-languageCodeTextInput' ]
	} );
	this.directionSelect = new OO.ui.ButtonSelectWidget( {
		$: this.$,
		classes: [ 've-ui-languageInputWidget-directionSelect' ]
	} );
	this.findLanguageField = new OO.ui.FieldLayout( this.findLanguageButton, {
		$: this.$,
		align: 'left',
		label: ve.msg( 'visualeditor-languageinspector-widget-label-language' )
	} );
	this.languageCodeField = new OO.ui.FieldLayout( this.languageCodeTextInput, {
		$: this.$,
		align: 'left',
		label: ve.msg( 'visualeditor-languageinspector-widget-label-langcode' )
	} );
	this.directionField = new OO.ui.FieldLayout( this.directionSelect, {
		$: this.$,
		align: 'left',
		label: ve.msg( 'visualeditor-languageinspector-widget-label-direction' )
	} );

	// Events
	this.findLanguageButton.connect( this, { click: 'onFindLanguageButtonClick' } );
	this.languageCodeTextInput.connect( this, { change: 'onChange' } );
	this.directionSelect.connect( this, { select: 'onChange' } );

	// Initialization
	var dirItems = [
		new OO.ui.ButtonOptionWidget( {
			$: this.$,
			data: 'rtl',
			icon: 'text-dir-rtl'
		} ),
		new OO.ui.ButtonOptionWidget( {
			$: this.$,
			data: 'ltr',
			icon: 'text-dir-ltr'
		} )
	];
	if ( !config.requireDir ) {
		dirItems.splice(
			1, 0, new OO.ui.ButtonOptionWidget( {
				$: this.$,
				data: null,
				label: ve.msg( 'visualeditor-dialog-language-auto-direction' )
			} )
		);
	}
	this.directionSelect.addItems( dirItems );
	this.overlay.$element.append( this.dialogs.$element );
	$( 'body' ).append( this.overlay.$element );

	this.$element
		.addClass( 've-ui-languageInputWidget' )
		.append(
			this.findLanguageField.$element,
			this.languageCodeField.$element,
			this.directionField.$element
		);
};

/* Inheritance */

OO.inheritClass( ve.ui.LanguageInputWidget, OO.ui.Widget );

/* Events */

/**
 * @event change
 * @param {string} lang Language code
 * @param {string} dir Directionality
 */

/* Methods */

/**
 * Handle find language button click events.
 */
ve.ui.LanguageInputWidget.prototype.onFindLanguageButtonClick = function () {
	var widget = this;
	this.dialogs.openWindow( 'languageSearch', { availableLanguages: this.availableLanguages } )
		.then( function ( opened ) {
			opened.then( function ( closing ) {
				closing.then( function ( data ) {
					data = data || {};
					if ( data.action === 'apply' ) {
						widget.setLangAndDir( data.lang, data.dir );
					}
				} );
			} );
		} );
};

/**
 * Handle input widget change events.
 */
ve.ui.LanguageInputWidget.prototype.onChange = function () {
	if ( this.updating ) {
		return;
	}

	var selectedItem = this.directionSelect.getSelectedItem();
	this.setLangAndDir(
		this.languageCodeTextInput.getValue(),
		selectedItem ? selectedItem.getData() : null
	);
};

/**
 * Set language and directionality
 *
 * The inputs value will automatically be updated.
 *
 * @param {string} lang Language code
 * @param {string} dir Directionality
 * @fires change
 */
ve.ui.LanguageInputWidget.prototype.setLangAndDir = function ( lang, dir ) {
	if ( lang === this.lang && dir === this.dir ) {
		// No change
		return;
	}

	// Set state flag while programmatically changing input widget values
	this.updating = true;
	if ( lang || dir ) {
		lang = lang || '';
		this.languageCodeTextInput.setValue( lang );
		this.findLanguageButton.setLabel(
			ve.init.platform.getLanguageName( lang.toLowerCase() ) ||
			ve.msg( 'visualeditor-languageinspector-widget-changelang' )
		);
		this.directionSelect.selectItem(
			this.directionSelect.getItemFromData( dir || null )
		);
	} else {
		this.languageCodeTextInput.setValue( '' );
		this.findLanguageButton.setLabel(
			ve.msg( 'visualeditor-languageinspector-widget-changelang' )
		);
		this.directionSelect.selectItem( this.directionSelect.getItemFromData( null ) );
	}
	this.updating = false;

	this.emit( 'change', lang, dir );
	this.lang = lang;
	this.dir = dir;
};

/**
 * Get the language
 *
 * @returns {string} Language code
 */
ve.ui.LanguageInputWidget.prototype.getLang = function () {
	return this.lang;
};

/**
 * Get the directionality
 *
 * @returns {string} Directionality (ltr/rtl)
 */
ve.ui.LanguageInputWidget.prototype.getDir = function () {
	return this.dir;
};

/*!
 * VisualEditor UserInterface SurfaceWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Creates an ve.ui.SurfaceWidget object.
 *
 * @class
 * @abstract
 * @extends OO.ui.Widget
 *
 * @constructor
 * @param {ve.dm.Document} doc Document model
 * @param {Object} [config] Configuration options
 * @cfg {Object[]} [tools] Toolbar configuration
 * @cfg {string[]} [excludeCommands] List of commands to exclude
 * @cfg {Object} [importRules] Import rules
 */
ve.ui.SurfaceWidget = function VeUiSurfaceWidget( doc, config ) {
	// Config initialization
	config = config || {};

	// Parent constructor
	OO.ui.Widget.call( this, config );

	// Properties
	this.surface = ve.init.target.createSurface( doc, {
		$: this.$,
		excludeCommands: config.excludeCommands,
		importRules: config.importRules
	} );
	this.toolbar = new ve.ui.Toolbar( this.surface, { $: this.$ } );

	// Initialization
	this.surface.$element.addClass( 've-ui-surfaceWidget-surface' );
	this.toolbar.$element.addClass( 've-ui-surfaceWidget-toolbar' );
	this.$element
		.addClass( 've-ui-surfaceWidget' )
		.append( this.toolbar.$element, this.surface.$element );
	if ( config.tools ) {
		this.toolbar.setup( config.tools, this.surface );
	}
};

/* Inheritance */

OO.inheritClass( ve.ui.SurfaceWidget, OO.ui.Widget );

/* Methods */

/**
 * Get surface.
 *
 * @method
 * @returns {ve.ui.Surface} Surface
 */
ve.ui.SurfaceWidget.prototype.getSurface = function () {
	return this.surface;
};

/**
 * Get toolbar.
 *
 * @method
 * @returns {OO.ui.Toolbar} Toolbar
 */
ve.ui.SurfaceWidget.prototype.getToolbar = function () {
	return this.toolbar;
};

/**
 * Get content data.
 *
 * @method
 * @returns {ve.dm.ElementLinearData} Content data
 */
ve.ui.SurfaceWidget.prototype.getContent = function () {
	return this.surface.getModel().getDocument().getData();
};

/**
 * Initialize surface and toolbar.
 *
 * Widget must be attached to DOM before initializing.
 *
 * @method
 */
ve.ui.SurfaceWidget.prototype.initialize = function () {
	this.toolbar.initialize();
	this.surface.initialize();
};

/**
 * Destroy surface and toolbar.
 *
 * @method
 */
ve.ui.SurfaceWidget.prototype.destroy = function () {
	if ( this.surface ) {
		this.surface.destroy();
	}
	if ( this.toolbar ) {
		this.toolbar.destroy();
	}
	this.$element.remove();
};

/**
 * Focus the surface.
 */
ve.ui.SurfaceWidget.prototype.focus = function () {
	this.surface.getView().focus();
};

/*!
 * VisualEditor UserInterface LinkTargetInputWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Creates an ve.ui.LinkTargetInputWidget object.
 *
 * @class
 * @extends OO.ui.TextInputWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.LinkTargetInputWidget = function VeUiLinkTargetInputWidget( config ) {
	// Parent constructor
	OO.ui.TextInputWidget.call( this, $.extend( {
		validate: /^(https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?/gi
	}, config ) );

	// Properties
	this.annotation = null;

	// Initialization
	this.$element.addClass( 've-ui-linkTargetInputWidget' );

	// Default RTL/LTR check
	// Has to use global $() instead of this.$() because only the main document's <body> has
	// the 'rtl' class; inspectors and dialogs have oo-ui-rtl instead.
	if ( $( 'body' ).hasClass( 'rtl' ) ) {
		this.$input.addClass( 'oo-ui-rtl' );
	}
};

/* Inheritance */

OO.inheritClass( ve.ui.LinkTargetInputWidget, OO.ui.TextInputWidget );

/* Methods */

/**
 * Handle value-changing events
 *
 * Overrides onEdit to perform RTL test based on the typed URL
 *
 * @method
 */
ve.ui.LinkTargetInputWidget.prototype.onEdit = function () {
	var widget = this;
	if ( !this.disabled ) {

		// Allow the stack to clear so the value will be updated
		setTimeout( function () {
			// RTL/LTR check
			// Has to use global $() instead of this.$() because only the main document's <body> has
			// the 'rtl' class; inspectors and dialogs have oo-ui-rtl instead.
			if ( $( 'body' ).hasClass( 'rtl' ) ) {
				var isExt = ve.init.platform.getExternalLinkUrlProtocolsRegExp()
					.test( widget.$input.val() );
				// If URL is external, flip to LTR. Otherwise, set back to RTL
				widget.setRTL( !isExt );
			}
			widget.setValue( widget.$input.val() );
		} );
	}
};

/**
 * Set the value of the input.
 *
 * Overrides setValue to keep annotations in sync.
 *
 * @method
 * @param {string} value New value
 */
ve.ui.LinkTargetInputWidget.prototype.setValue = function ( value ) {
	// Keep annotation in sync with value
	value = this.cleanUpValue( value );
	if ( value === '' ) {
		this.annotation = null;
	} else {
		this.setAnnotation( new ve.dm.LinkAnnotation( {
			type: 'link',
			attributes: {
				href: value
			}
		} ) );
	}

	// Parent method
	OO.ui.TextInputWidget.prototype.setValue.call( this, value );
};

/**
 * Sets the annotation value.
 *
 * The input value will automatically be updated.
 *
 * @method
 * @param {ve.dm.LinkAnnotation} annotation Link annotation
 * @chainable
 */
ve.ui.LinkTargetInputWidget.prototype.setAnnotation = function ( annotation ) {
	this.annotation = annotation;

	// Parent method
	OO.ui.TextInputWidget.prototype.setValue.call(
		this, this.getTargetFromAnnotation( annotation )
	);

	return this;
};

/**
 * Gets the annotation value.
 *
 * @method
 * @returns {ve.dm.LinkAnnotation} Link annotation
 */
ve.ui.LinkTargetInputWidget.prototype.getAnnotation = function () {
	return this.annotation;
};

/**
 * Get the hyperlink location.
 *
 * @return {string} Hyperlink location
 */
ve.ui.LinkTargetInputWidget.prototype.getHref = function () {
	return this.getValue();
};

/**
 * Gets a target from an annotation.
 *
 * @method
 * @param {ve.dm.LinkAnnotation} annotation Link annotation
 * @returns {string} Target
 */
ve.ui.LinkTargetInputWidget.prototype.getTargetFromAnnotation = function ( annotation ) {
	if ( annotation instanceof ve.dm.LinkAnnotation ) {
		return annotation.getAttribute( 'href' );
	}
	return '';
};

/*!
 * VisualEditor Context Menu widget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Menu of items, each an inspectable attribute of the current context.
 *
 * Use with ve.ui.ContextOptionWidget.
 *
 * @class
 * @extends OO.ui.SelectWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.ContextSelectWidget = function VeUiContextSelectWidget( config ) {
	// Config initialization
	config = config || {};

	// Parent constructor
	ve.ui.ContextSelectWidget.super.call( this, config );

	this.connect( this, { choose: 'onChooseItem' } );

	// Initialization
	this.$element.addClass( 've-ui-contextSelectWidget' );
};

/* Setup */

OO.inheritClass( ve.ui.ContextSelectWidget, OO.ui.SelectWidget );

/* Methods */

/**
 * Handle choose item events.
 */
ve.ui.ContextSelectWidget.prototype.onChooseItem = function () {
	// Auto-deselect
	this.selectItem( null );
};

/*!
 * VisualEditor Context Item widget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Proxy for a tool, displaying information about the current context.
 *
 * Use with ve.ui.ContextSelectWidget.
 *
 * @class
 * @extends OO.ui.DecoratedOptionWidget
 *
 * @constructor
 * @param {Function} tool Tool item is a proxy for
 * @param {ve.dm.Node|ve.dm.Annotation} model Node or annotation item is related to
 * @param {Object} [config] Configuration options
 */
ve.ui.ContextOptionWidget = function VeUiContextOptionWidget( tool, model, config ) {
	// Config initialization
	config = config || {};

	// Parent constructor
	ve.ui.ContextOptionWidget.super.call( this, config );

	// Properties
	this.tool = tool;
	this.model = model;

	// Initialization
	this.$element.addClass( 've-ui-contextOptionWidget' );
	this.setIcon( this.tool.static.icon );

	this.setLabel( this.getDescription() );
};

/* Setup */

OO.inheritClass( ve.ui.ContextOptionWidget, OO.ui.DecoratedOptionWidget );

/* Methods */

/**
 * Get a description of the model.
 *
 * @return {string} Description of model
 */
ve.ui.ContextOptionWidget.prototype.getDescription = function () {
	var description;

	if ( this.model instanceof ve.dm.Annotation ) {
		description = ve.ce.annotationFactory.getDescription( this.model );
	} else if ( this.model instanceof ve.dm.Node ) {
		description = ve.ce.nodeFactory.getDescription( this.model );
	}
	if ( !description ) {
		description = this.tool.static.title;
	}

	return description;
};

/**
 * Get the command for this item.
 *
 * @return {ve.ui.Command} Command
 */
ve.ui.ContextOptionWidget.prototype.getCommand = function () {
	return ve.ui.commandRegistry.lookup( this.tool.static.commandName );
};

/*!
 * VisualEditor UserInterface DimensionsWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Widget that visually displays width and height inputs.
 * This widget is for presentation-only, no calculation is done.
 *
 * @class
 * @extends OO.ui.Widget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {Object} [defaults] Default dimensions
 */
ve.ui.DimensionsWidget = function VeUiDimensionsWidget( config ) {
	var labelTimes, labelPx;

	// Configuration
	config = config || {};

	// Parent constructor
	OO.ui.Widget.call( this, config );

	this.widthInput = new OO.ui.TextInputWidget( {
		$: this.$
	} );
	this.heightInput = new OO.ui.TextInputWidget( {
		$: this.$
	} );

	this.defaults = config.defaults || { width: '', height: '' };
	this.renderDefaults();

	labelTimes = new OO.ui.LabelWidget( {
		$: this.$,
		label: ve.msg( 'visualeditor-dimensionswidget-times' )
	} );
	labelPx = new OO.ui.LabelWidget( {
		$: this.$,
		label: ve.msg( 'visualeditor-dimensionswidget-px' )
	} );

	// Events
	this.widthInput.connect( this, { change: 'onWidthChange' } );
	this.heightInput.connect( this, { change: 'onHeightChange' } );

	// Setup
	this.$element
		.addClass( 've-ui-dimensionsWidget' )
		.append(
			this.widthInput.$element,
			labelTimes.$element
				.addClass( 've-ui-dimensionsWidget-label-times' ),
			this.heightInput.$element,
			labelPx.$element
				.addClass( 've-ui-dimensionsWidget-label-px' )
		);
};

/* Inheritance */

OO.inheritClass( ve.ui.DimensionsWidget, OO.ui.Widget );

/* Events */

/**
 * @event widthChange
 * @param {string} value The new width
 */

/**
 * @event heightChange
 * @param {string} value The new width
 */

/* Methods */

/**
 * Respond to width change, propagate the input change event
 * @param {string} value The new changed value
 * @fires widthChange
 */
ve.ui.DimensionsWidget.prototype.onWidthChange = function ( value ) {
	this.emit( 'widthChange', value );
};

/**
 * Respond to height change, propagate the input change event
 * @param {string} value The new changed value
 * @fires heightChange
 */
ve.ui.DimensionsWidget.prototype.onHeightChange = function ( value ) {
	this.emit( 'heightChange', value );
};

/**
 * Set default dimensions
 * @param {Object} dimensions Default dimensions, width and height
 */
ve.ui.DimensionsWidget.prototype.setDefaults = function ( dimensions ) {
	if ( dimensions.width && dimensions.height ) {
		this.defaults = ve.copy( dimensions );
		this.renderDefaults();
	}
};

/**
 * Render the default dimensions as input placeholders
 */
ve.ui.DimensionsWidget.prototype.renderDefaults = function () {
	this.widthInput.$input.prop( 'placeholder', this.getDefaults().width );
	this.heightInput.$input.prop( 'placeholder', this.getDefaults().height );
};

/**
 * Get the default dimensions
 * @returns {Object} Default dimensions
 */
ve.ui.DimensionsWidget.prototype.getDefaults = function () {
	return this.defaults;
};

/**
 * Remove the default dimensions
 */
ve.ui.DimensionsWidget.prototype.removeDefaults = function () {
	this.defaults = { width: '', height: '' };
	this.renderDefaults();
};

/**
 * Check whether the widget is empty.
 * @returns {boolean} Both values are empty
 */
ve.ui.DimensionsWidget.prototype.isEmpty = function () {
	return (
		this.widthInput.getValue() === '' &&
		this.heightInput.getValue() === ''
	);
};

/**
 * Set an empty value for the dimensions inputs so they show
 * the placeholders if those exist.
 */
ve.ui.DimensionsWidget.prototype.clear = function () {
	this.widthInput.setValue( '' );
	this.heightInput.setValue( '' );
};

/**
 * Reset the dimensions to the default dimensions.
 */
ve.ui.DimensionsWidget.prototype.reset = function () {
	this.setDimensions( this.getDefaults() );
};

/**
 * Set the dimensions value of the inputs
 * @param {Object} dimensions The width and height values of the inputs
 * @param {number} dimensions.width The value of the width input
 * @param {number} dimensions.height The value of the height input
 */
ve.ui.DimensionsWidget.prototype.setDimensions = function ( dimensions ) {
	if ( dimensions.width ) {
		this.setWidth( dimensions.width );
	}
	if ( dimensions.height ) {
		this.setHeight( dimensions.height );
	}
};

/**
 * Return the current dimension values in the widget
 * @returns {Object} dimensions The width and height values of the inputs
 * @returns {number} dimensions.width The value of the width input
 * @returns {number} dimensions.height The value of the height input
 */
ve.ui.DimensionsWidget.prototype.getDimensions = function () {
	return {
		width: this.widthInput.getValue(),
		height: this.heightInput.getValue()
	};
};

/**
 * Disable or enable the inputs
 * @param {boolean} isDisabled Set disabled or enabled
 */
ve.ui.DimensionsWidget.prototype.setDisabled = function ( isDisabled ) {
	// The 'setDisabled' method runs in the constructor before the
	// inputs are initialized
	if ( this.widthInput ) {
		this.widthInput.setDisabled( isDisabled );
	}
	if ( this.heightInput ) {
		this.heightInput.setDisabled( isDisabled );
	}
};

/**
 * Get the current value in the width input
 * @returns {string} Input value
 */
ve.ui.DimensionsWidget.prototype.getWidth = function () {
	return this.widthInput.getValue();
};

/**
 * Get the current value in the height input
 * @returns {string} Input value
 */
ve.ui.DimensionsWidget.prototype.getHeight = function () {
	return this.heightInput.getValue();
};

/**
 * Set a value for the width input
 * @param {string} value
 */
ve.ui.DimensionsWidget.prototype.setWidth = function ( value ) {
	this.widthInput.setValue( value );
};

/**
 * Set a value for the height input
 * @param {string} value
 */
ve.ui.DimensionsWidget.prototype.setHeight = function ( value ) {
	this.heightInput.setValue( value );
};

/*!
 * VisualEditor UserInterface MediaSizeWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Widget that lets the user edit dimensions (width and height),
 * based on a scalable object.
 *
 * @class
 * @extends OO.ui.Widget
 *
 * @constructor
 * @param {ve.dm.Scalable} scalable A scalable object
 * @param {Object} [config] Configuration options
 */
ve.ui.MediaSizeWidget = function VeUiMediaSizeWidget( scalable, config ) {
	var fieldScale, fieldCustom, scalePercentLabel;

	// Configuration
	config = config || {};

	this.scalable = scalable || {};

	// Parent constructor
	OO.ui.Widget.call( this, config );

	// Properties
	this.ratio = {};
	this.currentDimensions = {};
	this.maxDimensions = {};
	this.valid = null;

	// Define button select widget
	this.sizeTypeSelectWidget = new OO.ui.ButtonSelectWidget( {
		$: this.$,
		classes: [ 've-ui-mediaSizeWidget-section-sizetype' ]
	} );
	this.sizeTypeSelectWidget.addItems( [
		new OO.ui.ButtonOptionWidget( {
			$: this.$,
			data: 'default',
			label: ve.msg( 'visualeditor-mediasizewidget-sizeoptions-default' )
		} ),
		// TODO: when upright is supported by Parsoid
		// new OO.ui.ButtonOptionWidget( {
		// $: this.$,
		// data: 'scale',
		// label: ve.msg( 'visualeditor-mediasizewidget-sizeoptions-scale' )
		// } ),
		new OO.ui.ButtonOptionWidget( {
			$: this.$,
			data: 'custom',
			label: ve.msg( 'visualeditor-mediasizewidget-sizeoptions-custom' )
		} )
	] );

	// Define scale
	this.scaleInput = new OO.ui.TextInputWidget( {
		$: this.$
	} );
	scalePercentLabel = new OO.ui.LabelWidget( {
		$: this.$,
		input: this.scaleInput,
		label: ve.msg( 'visualeditor-mediasizewidget-label-scale-percent' )
	} );

	this.dimensionsWidget = new ve.ui.DimensionsWidget( {
		$: this.$
	} );

	// Error label is available globally so it can be displayed and
	// hidden as needed
	this.errorLabel = new OO.ui.LabelWidget( {
		$: this.$,
		label: ve.msg( 'visualeditor-mediasizewidget-label-defaulterror' )
	} );

	// Field layouts
	fieldScale = new OO.ui.FieldLayout(
		this.scaleInput, {
			$: this.$,
			align: 'right',
			// TODO: when upright is supported by Parsoid
			// classes: ['ve-ui-mediaSizeWidget-section-scale'],
			label: ve.msg( 'visualeditor-mediasizewidget-label-scale' )
		}
	);
	// TODO: when upright is supported by Parsoid
	// this.scaleInput.$element.append( scalePercentLabel.$element );
	fieldCustom = new OO.ui.FieldLayout(
		this.dimensionsWidget, {
			$: this.$,
			align: 'right',
			label: ve.msg( 'visualeditor-mediasizewidget-label-custom' ),
			classes: ['ve-ui-mediaSizeWidget-section-custom']
		}
	);

	// Buttons
	this.fullSizeButton = new OO.ui.ButtonWidget( {
		$: this.$,
		label: ve.msg( 'visualeditor-mediasizewidget-button-originaldimensions' ),
		classes: ['ve-ui-mediaSizeWidget-button-fullsize']
	} );

	// Build GUI
	this.$element
		.addClass( 've-ui-mediaSizeWidget' )
		.append(
			this.sizeTypeSelectWidget.$element,
			// TODO: when upright is supported by Parsoid
			// fieldScale.$element,
			fieldCustom.$element,
			this.fullSizeButton.$element,
			this.$( '<div>' )
				.addClass( 've-ui-mediaSizeWidget-label-error' )
				.append( this.errorLabel.$element )
		);

	// Events
	this.dimensionsWidget.connect( this, {
		widthChange: ['onDimensionsChange', 'width'],
		heightChange: ['onDimensionsChange', 'height']
	} );
	// TODO: when upright is supported by Parsoid
	// this.scaleInput.connect( this, { change: 'onScaleChange' } );
	this.sizeTypeSelectWidget.connect( this, { choose: 'onSizeTypeChoose' } );
	this.fullSizeButton.connect( this, { click: 'onFullSizeButtonClick' } );

};

/* Inheritance */

OO.inheritClass( ve.ui.MediaSizeWidget, OO.ui.Widget );

/* Events */

/**
 * @event change
 * @param {Object} dimensions Width and height dimensions
 */

/**
 * @event valid
 * @param {boolean} isValid Current dimensions are valid
 */

/**
 * @event changeSizeType
 * @param {string} sizeType 'default', 'custom' or 'scale'
 */

/* Methods */

/**
 * Respond to change in original dimensions in the scalable object.
 * Specifically, enable or disable to 'set full size' button and the 'default' option.
 *
 * @param {Object} dimensions Original dimensions
 */
ve.ui.MediaSizeWidget.prototype.onScalableOriginalSizeChange = function ( dimensions ) {
	var disabled = !dimensions || $.isEmptyObject( dimensions );
	this.fullSizeButton.setDisabled( disabled );
	this.sizeTypeSelectWidget.getItemFromData( 'default' ).setDisabled( disabled );
	// Revalidate current dimensions
	this.validateDimensions();
};

/**
 * Respond to change in current dimensions in the scalable object.
 *
 * @param {Object} dimensions Original dimensions
 */
ve.ui.MediaSizeWidget.prototype.onScalableCurrentSizeChange = function ( dimensions ) {
	if ( !$.isEmptyObject( dimensions ) ) {
		this.setCurrentDimensions( dimensions );
		this.validateDimensions();
	}
};

/**
 * Respond to default size or status change in the scalable object.
 * @param {boolean} isDefault Current default state
 */
ve.ui.MediaSizeWidget.prototype.onScalableDefaultSizeChange = function ( isDefault ) {
	// Update the default size into the dimensions widget
	this.updateDefaultDimensions();
	// TODO: When 'scale' ('upright' support) is ready, this will need to be adjusted
	// to support that as well
	this.setSizeType(
		isDefault ?
		'default' :
		'custom'
	);
	this.validateDimensions();
};

/**
 * Respond to width/height input value change. Only update dimensions if
 * the value is numeric. Invoke validation for every change.
 *
 * This is triggered every time the dimension widget has its values changed
 * either by the user or externally. The external call to 'setCurrentDimensions'
 * will result in this event being evoked if the dimension inputs have changed,
 * and same with clicking the 'full size' button and changing dimensions type.
 * The 'change' event for the entire widget is emitted through this method, as
 * it means that the actual values have changed, regardless of whether they
 * are valid or not.
 *
 * @param {string} type The input that was updated, 'width' or 'height'
 * @param {string} value The new value of the input
 * @fires change
 */
ve.ui.MediaSizeWidget.prototype.onDimensionsChange = function ( type, value ) {
	var dimensions = {};

	if ( Number( value ) === 0 ) {
		this.setSizeType( 'default' );
	} else {
		this.setSizeType( 'custom' );
		if ( $.isNumeric( value ) ) {
			dimensions[type] = Number( value );
			this.setCurrentDimensions( dimensions );
		} else {
			this.validateDimensions();
		}
	}
};

/**
 * Respond to change of the scale input
 */
ve.ui.MediaSizeWidget.prototype.onScaleChange = function () {
	// If the input changed (and not empty), set to 'custom'
	// Otherwise, set to 'default'
	if ( !this.dimensionsWidget.isEmpty() ) {
		this.sizeTypeSelectWidget.selectItem(
			this.sizeTypeSelectWidget.getItemFromData( 'scale' )
		);
	} else {
		this.sizeTypeSelectWidget.selectItem(
			this.sizeTypeSelectWidget.getItemFromData( 'default' )
		);
	}
};

/**
 * Respond to size type change
 * @param {OO.ui.OptionWidget} item Selected size type item
 * @fires changeSizeType
 */
ve.ui.MediaSizeWidget.prototype.onSizeTypeChoose = function ( item ) {
	var selectedType = item && item.getData(),
		wasDefault = this.scalable.isDefault();

	this.scalable.toggleDefault( selectedType === 'default' );

	if ( selectedType === 'default' ) {
		this.scaleInput.setDisabled( true );
		// If there are defaults, put them into the values
		if ( !$.isEmptyObject( this.dimensionsWidget.getDefaults() ) ) {
			this.dimensionsWidget.clear();
		}
	} else if ( selectedType === 'scale' ) {
		// Disable the dimensions widget
		this.dimensionsWidget.setDisabled( true );
		// Enable the scale input
		this.scaleInput.setDisabled( false );
	} else if ( selectedType === 'custom' ) {
		// Enable the dimensions widget
		this.dimensionsWidget.setDisabled( false );
		// Disable the scale input
		this.scaleInput.setDisabled( true );
		// If we were default size before, set the current dimensions to the default size
		if ( wasDefault && !$.isEmptyObject( this.dimensionsWidget.getDefaults() ) ) {
			this.setCurrentDimensions( this.dimensionsWidget.getDefaults() );
		}
		this.validateDimensions();
	}

	this.emit( 'changeSizeType', selectedType );
	this.validateDimensions();
};

/**
 * Set the placeholder value of the scale input
 * @param {number} value Placeholder value
 */
ve.ui.MediaSizeWidget.prototype.setScalePlaceholder = function ( value ) {
	this.scaleInput.$element.prop( 'placeholder', value );
};

/**
 * Get the placeholder value of the scale input
 * @returns {string} Placeholder value
 */
ve.ui.MediaSizeWidget.prototype.getScalePlaceholder = function () {
	return this.scaleInput.$element.prop( 'placeholder' );
};

/**
 * Select a size type in the select widget
 * @param {string} sizeType The size type to select
 */
ve.ui.MediaSizeWidget.prototype.setSizeType = function ( sizeType ) {
	if (
		this.getSizeType() !== sizeType ||
		// If the dimensions widget has zeros make sure to
		// allow for the change in size type
		Number( this.dimensionsWidget.getWidth() ) === 0 ||
		Number( this.dimensionsWidget.getHeight() ) === 0
	) {
		this.sizeTypeSelectWidget.chooseItem(
			this.sizeTypeSelectWidget.getItemFromData( sizeType )
		);
	}
};
/**
 * Get the size type from the select widget
 *
 * @returns {string} The size type
 */
ve.ui.MediaSizeWidget.prototype.getSizeType = function () {
	return this.sizeTypeSelectWidget.getSelectedItem() ? this.sizeTypeSelectWidget.getSelectedItem().getData() : '';
};

/**
 * Set the scalable object the widget deals with
 *
 * @param {ve.dm.Scalable} scalable A scalable object representing the media source being resized.
 */
ve.ui.MediaSizeWidget.prototype.setScalable = function ( scalable ) {
	if ( this.scalable instanceof ve.dm.Scalable ) {
		this.scalable.disconnect( this );
	}
	this.scalable = scalable;
	// Events
	this.scalable.connect( this, {
		defaultSizeChange: 'onScalableDefaultSizeChange',
		originalSizeChange: 'onScalableOriginalSizeChange',
		currentSizeChange: 'onScalableCurrentSizeChange'
	} );

	this.updateDefaultDimensions();

	if ( !this.scalable.isDefault() ) {
		// Reset current dimensions to new scalable object
		this.setCurrentDimensions( this.scalable.getCurrentDimensions() );
	}

	// If we don't have original dimensions, disable the full size button
	if ( !this.scalable.getOriginalDimensions() ) {
		this.fullSizeButton.setDisabled( true );
		this.sizeTypeSelectWidget.getItemFromData( 'default' ).setDisabled( true );
	} else {
		this.fullSizeButton.setDisabled( false );
		this.sizeTypeSelectWidget.getItemFromData( 'default' ).setDisabled( false );

		// Call for the set size type according to default or custom settings of the scalable
		this.setSizeType(
			this.scalable.isDefault() ?
			'default' :
			'custom'
		);
	}
	this.validateDimensions();
};

/**
 * Get the attached scalable object
 * @returns {ve.dm.Scalable} The scalable object representing the media
 * source being resized.
 */
ve.ui.MediaSizeWidget.prototype.getScalable = function () {
	return this.scalable;
};

/**
 * Handle click events on the full size button.
 * Set the width/height values to the original media dimensions
 */
ve.ui.MediaSizeWidget.prototype.onFullSizeButtonClick = function () {
	this.sizeTypeSelectWidget.chooseItem(
		this.sizeTypeSelectWidget.getItemFromData( 'custom' )
	);
	this.setCurrentDimensions( this.scalable.getOriginalDimensions() );
	this.dimensionsWidget.setDisabled( false );
};

/**
 * Set the image aspect ratio explicitly
 * @param {number} Numerical value of an aspect ratio
 */
ve.ui.MediaSizeWidget.prototype.setRatio = function ( ratio ) {
	this.scalable.setRatio( ratio );
};

/**
 * Get the current aspect ratio
 * @returns {number} Aspect ratio
 */
ve.ui.MediaSizeWidget.prototype.getRatio = function () {
	return this.scalable.getRatio();
};

/**
 * Set the maximum dimensions for the image. These will be limited only if
 * enforcedMax is true.
 * @param {Object} dimensions Height and width
 */
ve.ui.MediaSizeWidget.prototype.setMaxDimensions = function ( dimensions ) {
	// Normalize dimensions before setting
	var maxDimensions = ve.dm.Scalable.static.getDimensionsFromValue( dimensions, this.scalable.getRatio() );
	this.scalable.setMaxDimensions( maxDimensions );
};

/**
 * Retrieve the currently defined maximum dimensions
 * @returns {Object} dimensions Height and width
 */
ve.ui.MediaSizeWidget.prototype.getMaxDimensions = function () {
	return this.scalable.getMaxDimensions();
};

/**
 * Retrieve the current dimensions
 * @returns {Object} Width and height
 */
ve.ui.MediaSizeWidget.prototype.getCurrentDimensions = function () {
	return this.currentDimensions;
};

/**
 * Disable or enable the entire widget
 * @param {boolean} isDisabled Disable the widget
 */
ve.ui.MediaSizeWidget.prototype.setDisabled = function ( isDisabled ) {
	// The 'setDisabled' method seems to be called before the widgets
	// are fully defined. So, before disabling/enabling anything,
	// make sure the objects exist
	if ( this.sizeTypeSelectWidget &&
		this.dimensionsWidget &&
		this.scalable &&
		this.fullSizeButton
	) {
		// Disable the type select
		this.sizeTypeSelectWidget.setDisabled( isDisabled );

		// Disable the dimensions widget
		this.dimensionsWidget.setDisabled( isDisabled );

		// Double negatives aren't never fun!
		this.fullSizeButton.setDisabled(
			// Disable if asked to disable
			isDisabled ||
			// Only enable if the scalable has
			// the original dimensions available
			!this.scalable.getOriginalDimensions()
		);
	}
};

/**
 * Updates the current dimensions in the inputs, either one at a time or both
 *
 * @param {Object} dimensions Dimensions with width and height
 * @fires change
 */
ve.ui.MediaSizeWidget.prototype.setCurrentDimensions = function ( dimensions ) {
	var normalizedDimensions;

	// Recursion protection
	if ( this.preventChangeRecursion ) {
		return;
	}
	this.preventChangeRecursion = true;

	// Normalize the new dimensions
	normalizedDimensions = ve.dm.Scalable.static.getDimensionsFromValue( dimensions, this.scalable.getRatio() );

	if (
		// Update only if the dimensions object is valid
		this.scalable.isDimensionsObjectValid( normalizedDimensions ) &&
		// And only if the dimensions object is not default
		!this.scalable.isDefault()
	) {
		this.currentDimensions = normalizedDimensions;
		// This will only update if the value has changed
		// Set width & height individually as they may be 0
		this.dimensionsWidget.setWidth( this.currentDimensions.width );
		this.dimensionsWidget.setHeight( this.currentDimensions.height );

		// Update scalable object
		this.scalable.setCurrentDimensions( this.currentDimensions );

		this.validateDimensions();
		// Emit change event
		this.emit( 'change', this.currentDimensions );
	}
	this.preventChangeRecursion = false;
};

/**
 * Validate current dimensions.
 * Explicitly call for validating the current dimensions. This is especially
 * useful if we've changed conditions for the widget, like limiting image
 * dimensions for thumbnails when the image type changes. Triggers the error
 * class if needed.
 *
 * @returns {boolean} Current dimensions are valid
 */
ve.ui.MediaSizeWidget.prototype.validateDimensions = function () {
	var isValid = this.isValid();

	if ( this.valid !== isValid ) {
		this.valid = isValid;
		this.errorLabel.toggle( !isValid );
		this.$element.toggleClass( 've-ui-mediaSizeWidget-input-hasError', !isValid );
		// Emit change event
		this.emit( 'valid', this.valid );
	}
	return isValid;
};

/**
 * Set default dimensions for the widget. Values are given by scalable's
 * defaultDimensions. If no default dimensions are available,
 * the defaults are removed.
 */
ve.ui.MediaSizeWidget.prototype.updateDefaultDimensions = function () {
	var defaultDimensions = this.scalable.getDefaultDimensions();

	if ( !$.isEmptyObject( defaultDimensions ) ) {
		this.dimensionsWidget.setDefaults( defaultDimensions );
	} else {
		this.dimensionsWidget.removeDefaults();
	}
	this.sizeTypeSelectWidget.getItemFromData( 'default' ).setDisabled(
		$.isEmptyObject( defaultDimensions )
	);
	this.validateDimensions();
};

/**
 * Check if the custom dimensions are empty.
 * @returns {boolean} Both width/height values are empty
 */
ve.ui.MediaSizeWidget.prototype.isCustomEmpty = function () {
	return this.dimensionsWidget.isEmpty();
};

/**
 * Toggle a disabled state for the full size button
 * @param {boolean} isDisabled Disabled or not
 */
ve.ui.MediaSizeWidget.prototype.toggleFullSizeButtonDisabled = function ( isDisabled ) {
	this.fullSizeButton.setDisabled( isDisabled );
};

/**
 * Check if the scale input is empty.
 * @returns {boolean} Scale input value is empty
 */
ve.ui.MediaSizeWidget.prototype.isScaleEmpty = function () {
	return ( this.scaleInput.getValue() === '' );
};

/**
 * Check if all inputs are empty.
 * @returns {boolean} All input values are empty
 */
ve.ui.MediaSizeWidget.prototype.isEmpty = function () {
	return ( this.isCustomEmpty() && this.isScaleEmpty() );
};

/**
 * Check whether the current value inputs are valid
 * 1. If placeholders are visible, the input is valid
 * 2. If inputs have non numeric values, input is invalid
 * 3. If inputs have numeric values, validate through scalable
 *    calculations to see if the dimensions follow the rules.
 * @returns {boolean} Valid or invalid dimension values
 */
ve.ui.MediaSizeWidget.prototype.isValid = function () {
	var itemType = this.sizeTypeSelectWidget.getSelectedItem() ?
		this.sizeTypeSelectWidget.getSelectedItem().getData() : 'custom';

	// TODO: when upright is supported by Parsoid add validation for scale

	if ( itemType === 'custom' ) {
		if (
			this.dimensionsWidget.getDefaults() &&
			this.dimensionsWidget.isEmpty()
		) {
			return true;
		} else if (
			$.isNumeric( this.dimensionsWidget.getWidth() ) &&
			$.isNumeric( this.dimensionsWidget.getHeight() )
		) {
			return this.scalable.isCurrentDimensionsValid();
		} else {
			return false;
		}
	} else {
		// Default images are always valid size
		return true;
	}
};

/*!
 * VisualEditor UserInterface WhitespacePreservingTextInputWidget class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Text input widget which hides but preserves leading and trailing whitespace
 *
 * @class
 * @extends OO.ui.TextInputWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {string} [valueAndWhitespace] Initial value and whitespace
 * @cfg {number} [limit] Maximum number of characters to preserve at each end
 */
ve.ui.WhitespacePreservingTextInputWidget = function VeUiWhitespacePreservingTextInputWidget( config ) {
	// Configuration
	config = config || {};

	// Parent constructor
	ve.ui.WhitespacePreservingTextInputWidget.super.call( this, config );

	this.limit = config.limit;

	this.whitespace = [ '', '' ];
	this.setValueAndWhitespace( config.valueAndWhitespace || '' );

	this.$element.addClass( 've-ui-WhitespacePreservingTextInputWidget' );
};

/* Inheritance */

OO.inheritClass( ve.ui.WhitespacePreservingTextInputWidget, OO.ui.TextInputWidget );

/* Methods */

/**
 * Set the value of the widget and extract whitespace.
 *
 * @param {string} value Value
 */
ve.ui.WhitespacePreservingTextInputWidget.prototype.setValueAndWhitespace = function ( value ) {
	var leftValue, rightValue;

	leftValue = this.limit ? value.slice( 0, this.limit ) : value;
	this.whitespace[0] = leftValue.match( /^\s*/ )[0];
	value = value.slice( this.whitespace[0].length );

	rightValue = this.limit ? value.slice( -this.limit ) : value;
	this.whitespace[1] = rightValue.match( /\s*$/ )[0];
	value = value.slice( 0, value.length - this.whitespace[1].length );

	this.setValue( value );
};

/**
 * Set the value of the widget and extract whitespace.
 *
 * @param {string[]} whitespace Outer whitespace
 */
ve.ui.WhitespacePreservingTextInputWidget.prototype.setWhitespace = function ( whitespace ) {
	this.whitespace = whitespace;
};

/**
 * @inheritdoc
 */
ve.ui.WhitespacePreservingTextInputWidget.prototype.getValue = function () {
	if ( !this.whitespace ) {
		// In case getValue() is called from a parent constructor
		return this.value;
	}
	return this.whitespace[0] + this.value + this.whitespace[1];
};

/**
 * Get the inner/displayed value of text widget, excluding hidden outer whitespace
 *
 * @return {string} Inner/displayed value
 */
ve.ui.WhitespacePreservingTextInputWidget.prototype.getInnerValue = function () {
	return this.value;
};

/*!
 * VisualEditor UserInterface AnnotationTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface annotation tool.
 *
 * @class
 * @abstract
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.AnnotationTool = function VeUiAnnotationTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.AnnotationTool, ve.ui.Tool );

/* Static Properties */

/**
 * Annotation name and data the tool applies.
 *
 * @abstract
 * @static
 * @property {Object}
 * @inheritable
 */
ve.ui.AnnotationTool.static.annotation = { name: '' };

ve.ui.AnnotationTool.static.deactivateOnSelect = false;

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.AnnotationTool.prototype.onUpdateState = function ( fragment ) {
	// Parent method
	ve.ui.Tool.prototype.onUpdateState.apply( this, arguments );

	this.setActive(
		fragment && fragment.getAnnotations().hasAnnotationWithName( this.constructor.static.annotation.name )
	);
};

/**
 * UserInterface bold tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.BoldAnnotationTool = function VeUiBoldAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.BoldAnnotationTool, ve.ui.AnnotationTool );
ve.ui.BoldAnnotationTool.static.name = 'bold';
ve.ui.BoldAnnotationTool.static.group = 'textStyle';
ve.ui.BoldAnnotationTool.static.icon = {
	default: 'bold-a',
	ar: 'bold-arab-ain',
	be: 'bold-cyrl-te',
	cs: 'bold-b',
	da: 'bold-f',
	de: 'bold-f',
	en: 'bold-b',
	es: 'bold-n',
	eu: 'bold-l',
	fa: 'bold-arab-dad',
	fi: 'bold-l',
	fr: 'bold-g',
	gl: 'bold-n',
	he: 'bold-b',
	hu: 'bold-f',
	hy: 'bold-armn-to',
	it: 'bold-g',
	ka: 'bold-geor-man',
	ksh: 'bold-f',
	ky: 'bold-cyrl-zhe',
	ml: 'bold-b',
	nl: 'bold-v',
	nn: 'bold-f',
	no: 'bold-f',
	os: 'bold-cyrl-be',
	pl: 'bold-b',
	pt: 'bold-n',
	ru: 'bold-cyrl-zhe',
	sv: 'bold-f'
};
ve.ui.BoldAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-bold-tooltip' );
ve.ui.BoldAnnotationTool.static.annotation = { name: 'textStyle/bold' };
ve.ui.BoldAnnotationTool.static.commandName = 'bold';
ve.ui.toolFactory.register( ve.ui.BoldAnnotationTool );

/**
 * UserInterface italic tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.ItalicAnnotationTool = function VeUiItalicAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.ItalicAnnotationTool, ve.ui.AnnotationTool );
ve.ui.ItalicAnnotationTool.static.name = 'italic';
ve.ui.ItalicAnnotationTool.static.group = 'textStyle';
ve.ui.ItalicAnnotationTool.static.icon = {
	default: 'italic-a',
	ar: 'italic-arab-meem',
	be: 'italic-cyrl-ka',
	cs: 'italic-i',
	da: 'italic-k',
	de: 'italic-k',
	en: 'italic-i',
	es: 'italic-c',
	eu: 'italic-e',
	fa: 'italic-arab-keheh-jeem',
	fi: 'italic-k',
	fr: 'italic-i',
	gl: 'italic-c',
	he: 'italic-i',
	hu: 'italic-d',
	hy: 'italic-armn-sha',
	it: 'italic-c',
	ka: 'italic-geor-kan',
	ksh: 'italic-s',
	ky: 'italic-cyrl-ka',
	ml: 'italic-i',
	nl: 'italic-c',
	nn: 'italic-k',
	no: 'italic-k',
	os: 'italic-cyrl-ka',
	pl: 'italic-i',
	pt: 'italic-i',
	ru: 'italic-cyrl-ka',
	sv: 'italic-k'
};
ve.ui.ItalicAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-italic-tooltip' );
ve.ui.ItalicAnnotationTool.static.annotation = { name: 'textStyle/italic' };
ve.ui.ItalicAnnotationTool.static.commandName = 'italic';
ve.ui.toolFactory.register( ve.ui.ItalicAnnotationTool );

/**
 * UserInterface code tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.CodeAnnotationTool = function VeUiCodeAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.CodeAnnotationTool, ve.ui.AnnotationTool );
ve.ui.CodeAnnotationTool.static.name = 'code';
ve.ui.CodeAnnotationTool.static.group = 'textStyle';
ve.ui.CodeAnnotationTool.static.icon = 'code';
ve.ui.CodeAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-code-tooltip' );
ve.ui.CodeAnnotationTool.static.annotation = { name: 'textStyle/code' };
ve.ui.CodeAnnotationTool.static.commandName = 'code';
ve.ui.toolFactory.register( ve.ui.CodeAnnotationTool );

/**
 * UserInterface strikethrough tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.StrikethroughAnnotationTool = function VeUiStrikethroughAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.StrikethroughAnnotationTool, ve.ui.AnnotationTool );
ve.ui.StrikethroughAnnotationTool.static.name = 'strikethrough';
ve.ui.StrikethroughAnnotationTool.static.group = 'textStyle';
ve.ui.StrikethroughAnnotationTool.static.icon = {
	default: 'strikethrough-a',
	en: 'strikethrough-s',
	fi: 'strikethrough-y'
};
ve.ui.StrikethroughAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-strikethrough-tooltip' );
ve.ui.StrikethroughAnnotationTool.static.annotation = { name: 'textStyle/strikethrough' };
ve.ui.StrikethroughAnnotationTool.static.commandName = 'strikethrough';
ve.ui.toolFactory.register( ve.ui.StrikethroughAnnotationTool );

/**
 * UserInterface underline tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.UnderlineAnnotationTool = function VeUiUnderlineAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.UnderlineAnnotationTool, ve.ui.AnnotationTool );
ve.ui.UnderlineAnnotationTool.static.name = 'underline';
ve.ui.UnderlineAnnotationTool.static.group = 'textStyle';
ve.ui.UnderlineAnnotationTool.static.icon = {
	default: 'underline-a',
	en: 'underline-u'
};
ve.ui.UnderlineAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-underline-tooltip' );
ve.ui.UnderlineAnnotationTool.static.annotation = { name: 'textStyle/underline' };
ve.ui.UnderlineAnnotationTool.static.commandName = 'underline';
ve.ui.toolFactory.register( ve.ui.UnderlineAnnotationTool );

/**
 * UserInterface superscript tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.SuperscriptAnnotationTool = function VeUiSuperscriptAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.SuperscriptAnnotationTool, ve.ui.AnnotationTool );
ve.ui.SuperscriptAnnotationTool.static.name = 'superscript';
ve.ui.SuperscriptAnnotationTool.static.group = 'textStyle';
ve.ui.SuperscriptAnnotationTool.static.icon = 'superscript';
ve.ui.SuperscriptAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-superscript-tooltip' );
ve.ui.SuperscriptAnnotationTool.static.annotation = { name: 'textStyle/superscript' };
ve.ui.SuperscriptAnnotationTool.static.commandName = 'superscript';
ve.ui.toolFactory.register( ve.ui.SuperscriptAnnotationTool );

/**
 * UserInterface subscript tool.
 *
 * @class
 * @extends ve.ui.AnnotationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.SubscriptAnnotationTool = function VeUiSubscriptAnnotationTool( toolGroup, config ) {
	ve.ui.AnnotationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.SubscriptAnnotationTool, ve.ui.AnnotationTool );
ve.ui.SubscriptAnnotationTool.static.name = 'subscript';
ve.ui.SubscriptAnnotationTool.static.group = 'textStyle';
ve.ui.SubscriptAnnotationTool.static.icon = 'subscript';
ve.ui.SubscriptAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-subscript-tooltip' );
ve.ui.SubscriptAnnotationTool.static.annotation = { name: 'textStyle/subscript' };
ve.ui.SubscriptAnnotationTool.static.commandName = 'subscript';
ve.ui.toolFactory.register( ve.ui.SubscriptAnnotationTool );

/*!
 * VisualEditor UserInterface ClearAnnotationTool class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface clear all annotations tool.
 *
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.ClearAnnotationTool = function VeUiClearAnnotationTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );

	// Initialization
	this.setDisabled( true );
};

/* Inheritance */

OO.inheritClass( ve.ui.ClearAnnotationTool, ve.ui.Tool );

/* Static Properties */

ve.ui.ClearAnnotationTool.static.name = 'clear';

ve.ui.ClearAnnotationTool.static.group = 'utility';

ve.ui.ClearAnnotationTool.static.icon = 'clear';

ve.ui.ClearAnnotationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-clearbutton-tooltip' );

ve.ui.ClearAnnotationTool.static.commandName = 'clear';

/* Registration */

ve.ui.toolFactory.register( ve.ui.ClearAnnotationTool );

/*!
 * VisualEditor UserInterface DialogTool class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface dialog tool.
 *
 * @abstract
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.DialogTool = function VeUiDialogTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.DialogTool, ve.ui.Tool );

/* Static Properties */

/**
 * Annotation or node models this tool is related to.
 *
 * Used by #isCompatibleWith.
 *
 * @static
 * @property {Function[]}
 * @inheritable
 */
ve.ui.DialogTool.static.modelClasses = [];

/**
 * @inheritdoc
 */
ve.ui.DialogTool.static.isCompatibleWith = function ( model ) {
	return ve.isInstanceOfAny( model, this.modelClasses );
};

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.DialogTool.prototype.onUpdateState = function () {
	// Parent method
	ve.ui.Tool.prototype.onUpdateState.apply( this, arguments );
	// Never show the tool as active
	this.setActive( false );
};

/**
 * @class
 * @extends ve.ui.DialogTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.CommandHelpDialogTool = function VeUiCommandHelpDialogTool( toolGroup, config ) {
	ve.ui.DialogTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.CommandHelpDialogTool, ve.ui.DialogTool );
ve.ui.CommandHelpDialogTool.static.name = 'commandHelp';
ve.ui.CommandHelpDialogTool.static.group = 'dialog';
ve.ui.CommandHelpDialogTool.static.icon = 'help';
ve.ui.CommandHelpDialogTool.static.title =
	OO.ui.deferMsg( 'visualeditor-dialog-command-help-title' );
ve.ui.CommandHelpDialogTool.static.autoAddToCatchall = false;
ve.ui.CommandHelpDialogTool.static.autoAddToGroup = false;
ve.ui.CommandHelpDialogTool.static.commandName = 'commandHelp';
ve.ui.toolFactory.register( ve.ui.CommandHelpDialogTool );

/*!
 * VisualEditor UserInterface FindAndReplaceTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface FindAndReplace tool.
 *
 * @abstract
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.FindAndReplaceTool = function VeUiFindAndReplaceTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.FindAndReplaceTool, ve.ui.Tool );

ve.ui.FindAndReplaceTool.static.name = 'findAndReplace';
ve.ui.FindAndReplaceTool.static.group = 'dialog';
ve.ui.FindAndReplaceTool.static.icon = 'find';
ve.ui.FindAndReplaceTool.static.title =
	OO.ui.deferMsg( 'visualeditor-find-and-replace-title' );
ve.ui.FindAndReplaceTool.static.autoAddToCatchall = false;
ve.ui.FindAndReplaceTool.static.autoAddToGroup = false;
ve.ui.FindAndReplaceTool.static.commandName = 'findAndReplace';
ve.ui.toolFactory.register( ve.ui.FindAndReplaceTool );

/*!
 * VisualEditor UserInterface FormatTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface format tool.
 *
 * @abstract
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.FormatTool = function VeUiFormatTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );

	// Properties
	this.convertible = false;
};

/* Inheritance */

OO.inheritClass( ve.ui.FormatTool, ve.ui.Tool );

/* Static Properties */

/**
 * Format the tool applies.
 *
 * Object should contain a required `type` and optional `attributes` property.
 *
 * @abstract
 * @static
 * @property {Object}
 * @inheritable
 */
ve.ui.FormatTool.static.format = null;

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.FormatTool.prototype.onUpdateState = function ( fragment ) {
	// Parent method
	ve.ui.FormatTool.super.prototype.onUpdateState.apply( this, arguments );

	// Hide and de-activate disabled tools
	if ( this.isDisabled() ) {
		this.toggle( false );
		this.setActive( false );
		return;
	}

	this.toggle( true );

	var i, len, nodes, all, cells,
		selection = fragment.getSelection(),
		format = this.constructor.static.format;

	if ( selection instanceof ve.dm.LinearSelection ) {
		nodes = fragment.getSelectedLeafNodes();
		all = !!nodes.length;
		for ( i = 0, len = nodes.length; i < len; i++ ) {
			if ( !nodes[i].hasMatchingAncestor( format.type, format.attributes ) ) {
				all = false;
				break;
			}
		}
	} else if ( selection instanceof ve.dm.TableSelection ) {
		cells = selection.getMatrixCells();
		all = true;
		for ( i = cells.length - 1; i >= 0; i-- ) {
			if ( !cells[i].node.matches( format.type, format.attributes ) ) {
				all = false;
				break;
			}
		}
	}
	this.convertible = !all;
	this.setActive( all );
};

/**
 * UserInterface paragraph tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.ParagraphFormatTool = function VeUiParagraphFormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.ParagraphFormatTool, ve.ui.FormatTool );
ve.ui.ParagraphFormatTool.static.name = 'paragraph';
ve.ui.ParagraphFormatTool.static.group = 'format';
ve.ui.ParagraphFormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-paragraph' );
ve.ui.ParagraphFormatTool.static.format = { type: 'paragraph' };
ve.ui.ParagraphFormatTool.static.commandName = 'paragraph';
ve.ui.toolFactory.register( ve.ui.ParagraphFormatTool );

/**
 * UserInterface heading 1 tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Heading1FormatTool = function VeUiHeading1FormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.Heading1FormatTool, ve.ui.FormatTool );
ve.ui.Heading1FormatTool.static.name = 'heading1';
ve.ui.Heading1FormatTool.static.group = 'format';
ve.ui.Heading1FormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-heading1' );
ve.ui.Heading1FormatTool.static.format = { type: 'heading', attributes: { level: 1 } };
ve.ui.Heading1FormatTool.static.commandName = 'heading1';
ve.ui.toolFactory.register( ve.ui.Heading1FormatTool );

/**
 * UserInterface heading 2 tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Heading2FormatTool = function VeUiHeading2FormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.Heading2FormatTool, ve.ui.FormatTool );
ve.ui.Heading2FormatTool.static.name = 'heading2';
ve.ui.Heading2FormatTool.static.group = 'format';
ve.ui.Heading2FormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-heading2' );
ve.ui.Heading2FormatTool.static.format = { type: 'heading', attributes: { level: 2 } };
ve.ui.Heading2FormatTool.static.commandName = 'heading2';
ve.ui.toolFactory.register( ve.ui.Heading2FormatTool );

/**
 * UserInterface heading 3 tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Heading3FormatTool = function VeUiHeading3FormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.Heading3FormatTool, ve.ui.FormatTool );
ve.ui.Heading3FormatTool.static.name = 'heading3';
ve.ui.Heading3FormatTool.static.group = 'format';
ve.ui.Heading3FormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-heading3' );
ve.ui.Heading3FormatTool.static.format = { type: 'heading', attributes: { level: 3 } };
ve.ui.Heading3FormatTool.static.commandName = 'heading3';
ve.ui.toolFactory.register( ve.ui.Heading3FormatTool );

/**
 * UserInterface heading 4 tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Heading4FormatTool = function VeUiHeading4FormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.Heading4FormatTool, ve.ui.FormatTool );
ve.ui.Heading4FormatTool.static.name = 'heading4';
ve.ui.Heading4FormatTool.static.group = 'format';
ve.ui.Heading4FormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-heading4' );
ve.ui.Heading4FormatTool.static.format = { type: 'heading', attributes: { level: 4 } };
ve.ui.Heading4FormatTool.static.commandName = 'heading4';
ve.ui.toolFactory.register( ve.ui.Heading4FormatTool );

/**
 * UserInterface heading 5 tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Heading5FormatTool = function VeUiHeading5FormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.Heading5FormatTool, ve.ui.FormatTool );
ve.ui.Heading5FormatTool.static.name = 'heading5';
ve.ui.Heading5FormatTool.static.group = 'format';
ve.ui.Heading5FormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-heading5' );
ve.ui.Heading5FormatTool.static.format = { type: 'heading', attributes: { level: 5 } };
ve.ui.Heading5FormatTool.static.commandName = 'heading5';
ve.ui.toolFactory.register( ve.ui.Heading5FormatTool );

/**
 * UserInterface heading 6 tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.Heading6FormatTool = function VeUiHeading6FormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.Heading6FormatTool, ve.ui.FormatTool );
ve.ui.Heading6FormatTool.static.name = 'heading6';
ve.ui.Heading6FormatTool.static.group = 'format';
ve.ui.Heading6FormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-heading6' );
ve.ui.Heading6FormatTool.static.format = { type: 'heading', attributes: { level: 6 } };
ve.ui.Heading6FormatTool.static.commandName = 'heading6';
ve.ui.toolFactory.register( ve.ui.Heading6FormatTool );

/**
 * UserInterface preformatted tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.PreformattedFormatTool = function VeUiPreformattedFormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.PreformattedFormatTool, ve.ui.FormatTool );
ve.ui.PreformattedFormatTool.static.name = 'preformatted';
ve.ui.PreformattedFormatTool.static.group = 'format';
ve.ui.PreformattedFormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-preformatted' );
ve.ui.PreformattedFormatTool.static.format = { type: 'preformatted' };
ve.ui.PreformattedFormatTool.static.commandName = 'preformatted';
ve.ui.toolFactory.register( ve.ui.PreformattedFormatTool );

/**
 * UserInterface blockquote tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.BlockquoteFormatTool = function VeUiBlockquoteFormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.BlockquoteFormatTool, ve.ui.FormatTool );
ve.ui.BlockquoteFormatTool.static.name = 'blockquote';
ve.ui.BlockquoteFormatTool.static.group = 'format';
ve.ui.BlockquoteFormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-formatdropdown-format-blockquote' );
ve.ui.BlockquoteFormatTool.static.format = { type: 'blockquote' };
ve.ui.BlockquoteFormatTool.static.commandName = 'blockquote';
ve.ui.toolFactory.register( ve.ui.BlockquoteFormatTool );

/**
 * UserInterface table cell header tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.TableCellHeaderFormatTool = function VeUiTableCellHeaderFormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.TableCellHeaderFormatTool, ve.ui.FormatTool );
ve.ui.TableCellHeaderFormatTool.static.name = 'tableCellHeader';
ve.ui.TableCellHeaderFormatTool.static.group = 'format';
ve.ui.TableCellHeaderFormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-format-header' );
ve.ui.TableCellHeaderFormatTool.static.format = { type: 'tableCell', attributes: { style: 'header' } };
ve.ui.TableCellHeaderFormatTool.static.commandName = 'tableCellHeader';
ve.ui.toolFactory.register( ve.ui.TableCellHeaderFormatTool );

/**
 * UserInterface table cell data tool.
 *
 * @class
 * @extends ve.ui.FormatTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.TableCellDataFormatTool = function VeUiTableCellDataFormatTool( toolGroup, config ) {
	ve.ui.FormatTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.TableCellDataFormatTool, ve.ui.FormatTool );
ve.ui.TableCellDataFormatTool.static.name = 'tableCellData';
ve.ui.TableCellDataFormatTool.static.group = 'format';
ve.ui.TableCellDataFormatTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-format-data' );
ve.ui.TableCellDataFormatTool.static.format = { type: 'tableCell', attributes: { style: 'data' } };
ve.ui.TableCellDataFormatTool.static.commandName = 'tableCellData';
ve.ui.toolFactory.register( ve.ui.TableCellDataFormatTool );

/*!
 * VisualEditor UserInterface HistoryTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface history tool.
 *
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.HistoryTool = function VeUiHistoryTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );

	// Events
	this.toolbar.getSurface().getModel().connect( this, { history: 'onHistory' } );

	// Initialization
	this.setDisabled( true );
};

/* Inheritance */

OO.inheritClass( ve.ui.HistoryTool, ve.ui.Tool );

/* Methods */

/**
 * Handle history events on the surface model
 */
ve.ui.HistoryTool.prototype.onHistory = function () {
	this.onUpdateState( this.toolbar.getSurface().getModel().getFragment() );
};

/**
 * @inheritdoc
 */
ve.ui.HistoryTool.prototype.destroy = function () {
	this.toolbar.getSurface().getModel().disconnect( this );
	ve.ui.HistoryTool.super.prototype.destroy.call( this );
};

/**
 * UserInterface undo tool.
 *
 * @class
 * @extends ve.ui.HistoryTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.UndoHistoryTool = function VeUiUndoHistoryTool( toolGroup, config ) {
	ve.ui.HistoryTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.UndoHistoryTool, ve.ui.HistoryTool );
ve.ui.UndoHistoryTool.static.name = 'undo';
ve.ui.UndoHistoryTool.static.group = 'history';
ve.ui.UndoHistoryTool.static.icon = 'undo';
ve.ui.UndoHistoryTool.static.title =
	OO.ui.deferMsg( 'visualeditor-historybutton-undo-tooltip' );
ve.ui.UndoHistoryTool.static.commandName = 'undo';
ve.ui.toolFactory.register( ve.ui.UndoHistoryTool );

/**
 * UserInterface redo tool.
 *
 * @class
 * @extends ve.ui.HistoryTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.RedoHistoryTool = function VeUiRedoHistoryTool( toolGroup, config ) {
	ve.ui.HistoryTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.RedoHistoryTool, ve.ui.HistoryTool );
ve.ui.RedoHistoryTool.static.name = 'redo';
ve.ui.RedoHistoryTool.static.group = 'history';
ve.ui.RedoHistoryTool.static.icon = 'redo';
ve.ui.RedoHistoryTool.static.title =
	OO.ui.deferMsg( 'visualeditor-historybutton-redo-tooltip' );
ve.ui.RedoHistoryTool.static.commandName = 'redo';
ve.ui.toolFactory.register( ve.ui.RedoHistoryTool );

/*!
 * VisualEditor UserInterface IndentationTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface indentation tool.
 *
 * @abstract
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.IndentationTool = function VeUiIndentationTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.IndentationTool, ve.ui.Tool );

/**
 * UserInterface indent tool.
 *
 * @class
 * @extends ve.ui.IndentationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.IncreaseIndentationTool = function VeUiIncreaseIndentationTool( toolGroup, config ) {
	ve.ui.IndentationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.IncreaseIndentationTool, ve.ui.IndentationTool );
ve.ui.IncreaseIndentationTool.static.name = 'indent';
ve.ui.IncreaseIndentationTool.static.group = 'structure';
ve.ui.IncreaseIndentationTool.static.icon = 'indent-list';
ve.ui.IncreaseIndentationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-indentationbutton-indent-tooltip' );
ve.ui.IncreaseIndentationTool.static.commandName = 'indent';
ve.ui.toolFactory.register( ve.ui.IncreaseIndentationTool );

/**
 * UserInterface outdent tool.
 *
 * TODO: Consistency between increase/decrease, indent/outdent and indent/unindent.
 *
 * @class
 * @extends ve.ui.IndentationTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.DecreaseIndentationTool = function VeUiDecreaseIndentationTool( toolGroup, config ) {
	ve.ui.IndentationTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.DecreaseIndentationTool, ve.ui.IndentationTool );
ve.ui.DecreaseIndentationTool.static.name = 'outdent';
ve.ui.DecreaseIndentationTool.static.group = 'structure';
ve.ui.DecreaseIndentationTool.static.icon = 'outdent-list';
ve.ui.DecreaseIndentationTool.static.title =
	OO.ui.deferMsg( 'visualeditor-indentationbutton-outdent-tooltip' );
ve.ui.DecreaseIndentationTool.static.commandName = 'outdent';
ve.ui.toolFactory.register( ve.ui.DecreaseIndentationTool );

/*!
 * VisualEditor UserInterface InspectorTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface inspector tool.
 *
 * @abstract
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.InspectorTool = function VeUiInspectorTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.InspectorTool, ve.ui.Tool );

/* Static Properties */

/**
 * Annotation or node models this tool is related to.
 *
 * Used by #isCompatibleWith.
 *
 * @static
 * @property {Function[]}
 * @inheritable
 */
ve.ui.InspectorTool.static.modelClasses = [];

ve.ui.InspectorTool.static.deactivateOnSelect = false;

/**
 * @inheritdoc
 */
ve.ui.InspectorTool.static.isCompatibleWith = function ( model ) {
	return ve.isInstanceOfAny( model, this.modelClasses );
};

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.InspectorTool.prototype.onUpdateState = function ( fragment ) {
	var i, len, models,
		active = false;

	// Parent method
	ve.ui.Tool.prototype.onUpdateState.apply( this, arguments );

	models = fragment ? fragment.getSelectedModels() : [];
	for ( i = 0, len = models.length; i < len; i++ ) {
		if ( this.constructor.static.isCompatibleWith( models[i] ) ) {
			active = true;
			break;
		}
	}
	this.setActive( active );
};

/**
 * UserInterface link tool.
 *
 * @class
 * @extends ve.ui.InspectorTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.LinkInspectorTool = function VeUiLinkInspectorTool( toolGroup, config ) {
	ve.ui.InspectorTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.LinkInspectorTool, ve.ui.InspectorTool );
ve.ui.LinkInspectorTool.static.name = 'link';
ve.ui.LinkInspectorTool.static.group = 'meta';
ve.ui.LinkInspectorTool.static.icon = 'link';
ve.ui.LinkInspectorTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-link-tooltip' );
ve.ui.LinkInspectorTool.static.modelClasses = [ ve.dm.LinkAnnotation ];
ve.ui.LinkInspectorTool.static.commandName = 'link';
ve.ui.toolFactory.register( ve.ui.LinkInspectorTool );

/**
 * Insert characters tool.
 *
 * @class
 * @extends ve.ui.InspectorTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.InsertCharacterInspectorTool = function VeUiInsertCharacterInspectorTool( toolGroup, config ) {
	ve.ui.InspectorTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.InsertCharacterInspectorTool, ve.ui.InspectorTool );
ve.ui.InsertCharacterInspectorTool.static.name = 'specialcharacter';
ve.ui.InsertCharacterInspectorTool.static.group = 'insert';
ve.ui.InsertCharacterInspectorTool.static.icon = 'special-character';
ve.ui.InsertCharacterInspectorTool.static.title =
	OO.ui.deferMsg( 'visualeditor-specialcharacter-button-tooltip' );
ve.ui.InsertCharacterInspectorTool.static.commandName = 'specialcharacter';
ve.ui.InsertCharacterInspectorTool.static.deactivateOnSelect = true;
ve.ui.toolFactory.register( ve.ui.InsertCharacterInspectorTool );

/**
 * UserInterface comment tool.
 *
 * @class
 * @extends ve.ui.InspectorTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.CommentInspectorTool = function VeUiCommentInspectorTool( toolGroup, config ) {
	ve.ui.InspectorTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.CommentInspectorTool, ve.ui.InspectorTool );
ve.ui.CommentInspectorTool.static.name = 'comment';
ve.ui.CommentInspectorTool.static.group = 'meta';
ve.ui.CommentInspectorTool.static.icon = 'comment';
ve.ui.CommentInspectorTool.static.title =
	OO.ui.deferMsg( 'visualeditor-commentinspector-tooltip' );
ve.ui.CommentInspectorTool.static.modelClasses = [ ve.dm.CommentNode ];
ve.ui.CommentInspectorTool.static.commandName = 'comment';
ve.ui.CommentInspectorTool.static.deactivateOnSelect = true;
ve.ui.toolFactory.register( ve.ui.CommentInspectorTool );

/*!
 * VisualEditor UserInterface language tool class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface language tool.
 *
 * @class
 * @extends ve.ui.InspectorTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.LanguageInspectorTool = function VeUiLanguageInspectorTool( toolGroup, config ) {
	ve.ui.InspectorTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.LanguageInspectorTool, ve.ui.InspectorTool );
ve.ui.LanguageInspectorTool.static.name = 'language';
ve.ui.LanguageInspectorTool.static.group = 'meta';
ve.ui.LanguageInspectorTool.static.icon = 'language';
ve.ui.LanguageInspectorTool.static.title =
	OO.ui.deferMsg( 'visualeditor-annotationbutton-language-tooltip' );
ve.ui.LanguageInspectorTool.static.modelClasses = [ ve.dm.LanguageAnnotation ];
ve.ui.LanguageInspectorTool.static.commandName = 'language';
ve.ui.toolFactory.register( ve.ui.LanguageInspectorTool );

/*!
 * VisualEditor UserInterface ListTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface list tool.
 *
 * @abstract
 * @class
 * @extends ve.ui.Tool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.ListTool = function VeUiListTool( toolGroup, config ) {
	// Parent constructor
	ve.ui.Tool.call( this, toolGroup, config );

	// Properties
	this.method = null;
};

/* Inheritance */

OO.inheritClass( ve.ui.ListTool, ve.ui.Tool );

/* Static Properties */

/**
 * List style the tool applies.
 *
 * @abstract
 * @static
 * @property {string}
 * @inheritable
 */
ve.ui.ListTool.static.style = '';

ve.ui.ListTool.static.deactivateOnSelect = false;

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.ListTool.prototype.onUpdateState = function ( fragment ) {
	// Parent method
	ve.ui.Tool.prototype.onUpdateState.apply( this, arguments );

	var i, len,
		nodes = fragment ? fragment.getSelectedLeafNodes() : [],
		style = this.constructor.static.style,
		all = !!nodes.length;

	for ( i = 0, len = nodes.length; i < len; i++ ) {
		if ( !nodes[i].hasMatchingAncestor( 'list', { style: style } ) ) {
			all = false;
			break;
		}
	}
	this.setActive( all );
};

/**
 * UserInterface bullet tool.
 *
 * @class
 * @extends ve.ui.ListTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.BulletListTool = function VeUiBulletListTool( toolGroup, config ) {
	ve.ui.ListTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.BulletListTool, ve.ui.ListTool );
ve.ui.BulletListTool.static.name = 'bullet';
ve.ui.BulletListTool.static.group = 'structure';
ve.ui.BulletListTool.static.icon = 'bullet-list';
ve.ui.BulletListTool.static.title =
	OO.ui.deferMsg( 'visualeditor-listbutton-bullet-tooltip' );
ve.ui.BulletListTool.static.style = 'bullet';
ve.ui.BulletListTool.static.commandName = 'bullet';
ve.ui.toolFactory.register( ve.ui.BulletListTool );

/**
 * UserInterface number tool.
 *
 * @class
 * @extends ve.ui.ListTool
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config] Configuration options
 */
ve.ui.NumberListTool = function VeUiNumberListTool( toolGroup, config ) {
	ve.ui.ListTool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.NumberListTool, ve.ui.ListTool );
ve.ui.NumberListTool.static.name = 'number';
ve.ui.NumberListTool.static.group = 'structure';
ve.ui.NumberListTool.static.icon = 'number-list';
ve.ui.NumberListTool.static.title =
	OO.ui.deferMsg( 'visualeditor-listbutton-number-tooltip' );
ve.ui.NumberListTool.static.style = 'number';
ve.ui.NumberListTool.static.commandName = 'number';
ve.ui.toolFactory.register( ve.ui.NumberListTool );

/*!
 * VisualEditor UserInterface ListTool classes.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/* Tools */

ve.ui.InsertTableTool = function VeUiInsertTableTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.InsertTableTool, ve.ui.Tool );
ve.ui.InsertTableTool.static.name = 'insertTable';
ve.ui.InsertTableTool.static.group = 'insert';
ve.ui.InsertTableTool.static.icon = 'table-insert';
ve.ui.InsertTableTool.static.title = OO.ui.deferMsg( 'visualeditor-table-insert-table' );
ve.ui.InsertTableTool.static.commandName = 'insertTable';
ve.ui.toolFactory.register( ve.ui.InsertTableTool );

ve.ui.DeleteTableTool = function VeUiDeleteTableTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.DeleteTableTool, ve.ui.Tool );
ve.ui.DeleteTableTool.static.name = 'deleteTable';
ve.ui.DeleteTableTool.static.group = 'table';
ve.ui.DeleteTableTool.static.autoAddToCatchall = false;
ve.ui.DeleteTableTool.static.icon = 'remove';
ve.ui.DeleteTableTool.static.title = OO.ui.deferMsg( 'visualeditor-table-delete-table' );
ve.ui.DeleteTableTool.static.commandName = 'deleteTable';
ve.ui.toolFactory.register( ve.ui.DeleteTableTool );

ve.ui.InsertRowBeforeTool = function VeUiInsertRowBeforeTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.InsertRowBeforeTool, ve.ui.Tool );
ve.ui.InsertRowBeforeTool.static.name = 'insertRowBefore';
ve.ui.InsertRowBeforeTool.static.group = 'table-row';
ve.ui.InsertRowBeforeTool.static.autoAddToCatchall = false;
ve.ui.InsertRowBeforeTool.static.icon = 'table-insert-row-before';
ve.ui.InsertRowBeforeTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-insert-row-before' );
ve.ui.InsertRowBeforeTool.static.commandName = 'insertRowBefore';
ve.ui.toolFactory.register( ve.ui.InsertRowBeforeTool );

ve.ui.InsertRowAfterTool = function VeUiInsertRowAfterTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.InsertRowAfterTool, ve.ui.Tool );
ve.ui.InsertRowAfterTool.static.name = 'insertRowAfter';
ve.ui.InsertRowAfterTool.static.group = 'table-row';
ve.ui.InsertRowAfterTool.static.autoAddToCatchall = false;
ve.ui.InsertRowAfterTool.static.icon = 'table-insert-row-after';
ve.ui.InsertRowAfterTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-insert-row-after' );
ve.ui.InsertRowAfterTool.static.commandName = 'insertRowAfter';
ve.ui.toolFactory.register( ve.ui.InsertRowAfterTool );

ve.ui.DeleteRowTool = function VeUiDeleteRowTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.DeleteRowTool, ve.ui.Tool );
ve.ui.DeleteRowTool.static.name = 'deleteRow';
ve.ui.DeleteRowTool.static.group = 'table-row';
ve.ui.DeleteRowTool.static.autoAddToCatchall = false;
ve.ui.DeleteRowTool.static.icon = 'remove';
ve.ui.DeleteRowTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-delete-row' );
ve.ui.DeleteRowTool.static.commandName = 'deleteRow';
ve.ui.toolFactory.register( ve.ui.DeleteRowTool );

ve.ui.InsertColumnBeforeTool = function VeUiInsertColumnBeforeTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.InsertColumnBeforeTool, ve.ui.Tool );
ve.ui.InsertColumnBeforeTool.static.name = 'insertColumnBefore';
ve.ui.InsertColumnBeforeTool.static.group = 'table-col';
ve.ui.InsertColumnBeforeTool.static.autoAddToCatchall = false;
ve.ui.InsertColumnBeforeTool.static.icon = 'table-insert-column-before';
ve.ui.InsertColumnBeforeTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-insert-col-before' );
ve.ui.InsertColumnBeforeTool.static.commandName = 'insertColumnBefore';
ve.ui.toolFactory.register( ve.ui.InsertColumnBeforeTool );

ve.ui.InsertColumnAfterTool = function VeUiInsertColumnAfterTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.InsertColumnAfterTool, ve.ui.Tool );
ve.ui.InsertColumnAfterTool.static.name = 'insertColumnAfter';
ve.ui.InsertColumnAfterTool.static.group = 'table-col';
ve.ui.InsertColumnAfterTool.static.autoAddToCatchall = false;
ve.ui.InsertColumnAfterTool.static.icon = 'table-insert-column-after';
ve.ui.InsertColumnAfterTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-insert-col-after' );
ve.ui.InsertColumnAfterTool.static.commandName = 'insertColumnAfter';
ve.ui.toolFactory.register( ve.ui.InsertColumnAfterTool );

ve.ui.DeleteColumnTool = function VeUiDeleteColumnTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.DeleteColumnTool, ve.ui.Tool );
ve.ui.DeleteColumnTool.static.name = 'deleteColumn';
ve.ui.DeleteColumnTool.static.group = 'table-col';
ve.ui.DeleteColumnTool.static.autoAddToCatchall = false;
ve.ui.DeleteColumnTool.static.icon = 'remove';
ve.ui.DeleteColumnTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-delete-col' );
ve.ui.DeleteColumnTool.static.commandName = 'deleteColumn';
ve.ui.toolFactory.register( ve.ui.DeleteColumnTool );

ve.ui.MergeCellsTool = function VeUiMergeCellsTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.MergeCellsTool, ve.ui.Tool );
ve.ui.MergeCellsTool.static.name = 'mergeCells';
ve.ui.MergeCellsTool.static.group = 'table';
ve.ui.MergeCellsTool.static.autoAddToCatchall = false;
ve.ui.MergeCellsTool.static.icon = 'table-merge-cells';
ve.ui.MergeCellsTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-merge-cells' );
ve.ui.MergeCellsTool.static.commandName = 'mergeCells';
ve.ui.MergeCellsTool.static.deactivateOnSelect = false;

ve.ui.MergeCellsTool.prototype.onUpdateState = function ( fragment ) {
	// Parent method
	ve.ui.MergeCellsTool.super.prototype.onUpdateState.apply( this, arguments );

	if ( this.isDisabled() ) {
		this.setActive( false );
		return;
	}

	// If not disabled, selection must be table and spanning multiple matrix cells
	this.setActive( fragment.getSelection().isSingleCell() );
};
ve.ui.toolFactory.register( ve.ui.MergeCellsTool );

ve.ui.TableCaptionTool = function VeUiTableCaptionTool( toolGroup, config ) {
	ve.ui.Tool.call( this, toolGroup, config );
};
OO.inheritClass( ve.ui.TableCaptionTool, ve.ui.Tool );
ve.ui.TableCaptionTool.static.name = 'tableCaption';
ve.ui.TableCaptionTool.static.group = 'table';
ve.ui.TableCaptionTool.static.autoAddToCatchall = false;
ve.ui.TableCaptionTool.static.icon = 'table-caption';
ve.ui.TableCaptionTool.static.title =
	OO.ui.deferMsg( 'visualeditor-table-caption' );
ve.ui.TableCaptionTool.static.commandName = 'tableCaption';
ve.ui.TableCaptionTool.static.deactivateOnSelect = false;

ve.ui.TableCaptionTool.prototype.onUpdateState = function ( fragment ) {
	// Parent method
	ve.ui.TableCaptionTool.super.prototype.onUpdateState.apply( this, arguments );

	if ( this.isDisabled() ) {
		this.setActive( false );
		return;
	}

	var hasCaptionNode,
		selection = fragment.getSelection();

	if ( selection instanceof ve.dm.TableSelection ) {
		hasCaptionNode = !!selection.getTableNode().getCaptionNode();
	} else {
		// If not disabled, linear selection must have a caption
		hasCaptionNode = true;
	}
	this.setActive( hasCaptionNode );
};
ve.ui.toolFactory.register( ve.ui.TableCaptionTool );

/*!
 * VisualEditor UserInterface FragmentInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Inspector for working with fragments of content.
 *
 * @class
 * @extends OO.ui.ProcessDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.FragmentInspector = function VeUiFragmentInspector( config ) {
	// Parent constructor
	ve.ui.FragmentInspector.super.call( this, config );

	// Properties
	this.fragment = null;
};

/* Inheritance */

OO.inheritClass( ve.ui.FragmentInspector, OO.ui.ProcessDialog );

/* Static Properties */

ve.ui.FragmentInspector.static.actions = ve.ui.FragmentInspector.super.static.actions.concat( [
	{
		action: 'done',
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-done' ),
		flags: [ 'progressive', 'primary' ]
	}
] );

/* Methods */

/**
 * Handle form submit events.
 *
 * @method
 */
ve.ui.FragmentInspector.prototype.onFormSubmit = function () {
	this.close( { action: 'done' } );
};

/**
 * Get the surface fragment the inspector is for.
 *
 * @returns {ve.dm.SurfaceFragment|null} Surface fragment the inspector is for, null if the
 *   inspector is closed
 */
ve.ui.FragmentInspector.prototype.getFragment = function () {
	return this.fragment;
};

/**
 * @inheritdoc
 */
ve.ui.FragmentInspector.prototype.initialize = function () {
	// Parent method
	ve.ui.FragmentInspector.super.prototype.initialize.call( this );

	// Properties
	this.container = new OO.ui.PanelLayout( {
		$: this.$, scrollable: true, classes: [ 've-ui-fragmentInspector-container' ]
	} );
	this.form = new OO.ui.FormLayout( {
		$: this.$, classes: [ 've-ui-fragmentInspector-form' ]
	} );

	// Events
	this.form.connect( this, { submit: 'onFormSubmit' } );

	// Initialization
	this.$element.addClass( 've-ui-fragmentInspector' );
	this.$content.addClass( 've-ui-fragmentInspector-content' );
	this.container.$element.append( this.form.$element, this.$otherActions );
	this.$body.append( this.container.$element );
};

/**
 * @inheritdoc
 */
ve.ui.FragmentInspector.prototype.getActionProcess = function ( action ) {
	if ( action === 'done' ) {
		return new OO.ui.Process( function () {
			this.close( { action: 'done' } );
		}, this );
	}
	return ve.ui.FragmentInspector.super.prototype.getActionProcess.call( this, action );
};

/**
 * @inheritdoc
 */
ve.ui.FragmentInspector.prototype.getSetupProcess = function ( data ) {
	data = data || {};
	return ve.ui.FragmentInspector.super.prototype.getSetupProcess.call( this, data )
		.first( function () {
			if ( !( data.fragment instanceof ve.dm.SurfaceFragment ) ) {
				throw new Error( 'Cannot open inspector: opening data must contain a fragment' );
			}
			this.fragment = data.fragment;
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.FragmentInspector.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.FragmentDialog.super.prototype.getTeardownProcess.apply( this, data )
		.next( function () {
			this.fragment = null;
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.FragmentInspector.prototype.getReadyProcess = function ( data ) {
	return ve.ui.FragmentInspector.super.prototype.getReadyProcess.call( this, data )
		// Add a 0ms timeout before doing anything. Because... Internet Explorer :(
		.first( 0 );
};

/**
 * @inheritdoc
 */
ve.ui.FragmentInspector.prototype.getBodyHeight = function () {
	// HACK: Chrome gets the height wrong by 1px for elements with opacity < 1
	// e.g. a disabled button.
	return Math.ceil( this.container.$element[0].scrollHeight ) + 1;
};

/*!
 * VisualEditor UserInterface AnnotationInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Inspector for working with content annotations.
 *
 * @class
 * @abstract
 * @extends ve.ui.FragmentInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.AnnotationInspector = function VeUiAnnotationInspector( config ) {
	// Parent constructor
	ve.ui.FragmentInspector.call( this, config );

	// Properties
	this.previousSelection = null;
	this.initialSelection = null;
	this.initialAnnotation = null;
	this.initialAnnotationIsCovering = false;
};

/* Inheritance */

OO.inheritClass( ve.ui.AnnotationInspector, ve.ui.FragmentInspector );

/**
 * Annotation models this inspector can edit.
 *
 * @static
 * @inheritable
 * @property {Function[]}
 */
ve.ui.AnnotationInspector.static.modelClasses = [];

ve.ui.AnnotationInspector.static.actions = [
	{
		action: 'remove',
		label: OO.ui.deferMsg( 'visualeditor-inspector-remove-tooltip' ),
		flags: 'destructive'
	}
].concat( ve.ui.FragmentInspector.static.actions );

/* Methods */

/**
 * Check if form is empty, which if saved should result in removing the annotation.
 *
 * Only override this if the form provides the user a way to blank out primary information, allowing
 * them to remove the annotation by clearing the form.
 *
 * @returns {boolean} Form is empty
 */
ve.ui.AnnotationInspector.prototype.shouldRemoveAnnotation = function () {
	return false;
};

/**
 * Get data to insert if nothing was selected when the inspector opened.
 *
 * Defaults to using #getInsertionText.
 *
 * @returns {Array} Linear model content to insert
 */
ve.ui.AnnotationInspector.prototype.getInsertionData = function () {
	return this.getInsertionText().split( '' );
};

/**
 * Get text to insert if nothing was selected when the inspector opened.
 *
 * @returns {string} Text to insert
 */
ve.ui.AnnotationInspector.prototype.getInsertionText = function () {
	return '';
};

/**
 * Get the annotation object to apply.
 *
 * This method is called when the inspector is closing, and should return the annotation to apply
 * to the text. If this method returns a falsey value like null, no annotation will be applied,
 * but existing annotations won't be removed either.
 *
 * @abstract
 * @returns {ve.dm.Annotation} Annotation to apply
 * @throws {Error} If not overridden in subclass
 */
ve.ui.AnnotationInspector.prototype.getAnnotation = function () {
	throw new Error(
		've.ui.AnnotationInspector.getAnnotation not implemented in subclass'
	);
};

/**
 * Get an annotation object from a fragment.
 *
 * @abstract
 * @param {ve.dm.SurfaceFragment} fragment Surface fragment
 * @returns {ve.dm.Annotation} Annotation
 * @throws {Error} If not overridden in a subclass
 */
ve.ui.AnnotationInspector.prototype.getAnnotationFromFragment = function () {
	throw new Error(
		've.ui.AnnotationInspector.getAnnotationFromFragment not implemented in subclass'
	);
};

/**
 * Get matching annotations within a fragment.
 *
 * @method
 * @param {ve.dm.SurfaceFragment} fragment Fragment to get matching annotations within
 * @param {boolean} [all] Get annotations which only cover some of the fragment
 * @returns {ve.dm.AnnotationSet} Matching annotations
 */
ve.ui.AnnotationInspector.prototype.getMatchingAnnotations = function ( fragment, all ) {
	var modelClasses = this.constructor.static.modelClasses;

	return fragment.getAnnotations( all ).filter( function ( annotation ) {
		return ve.isInstanceOfAny( annotation, modelClasses );
	} );
};

/**
 * @inheritdoc
 */
ve.ui.AnnotationInspector.prototype.getActionProcess = function ( action ) {
	if ( action === 'remove' ) {
		return new OO.ui.Process( function () {
			this.close( { action: 'remove' } );
		}, this );
	}
	return ve.ui.AnnotationInspector.super.prototype.getActionProcess.call( this, action );
};

/**
 * Handle the inspector being setup.
 *
 * There are 4 scenarios:
 *
 * - Zero-length selection not near a word -> no change, text will be inserted on close
 * - Zero-length selection inside or adjacent to a word -> expand selection to cover word
 * - Selection covering non-annotated text -> trim selection to remove leading/trailing whitespace
 * - Selection covering annotated text -> expand selection to cover annotation
 *
 * @method
 * @param {Object} [data] Inspector opening data
 */
ve.ui.AnnotationInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.AnnotationInspector.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			var expandedFragment, trimmedFragment, initialCoveringAnnotation,
				fragment = this.getFragment(),
				surfaceModel = fragment.getSurface(),
				annotation = this.getMatchingAnnotations( fragment, true ).get( 0 );

			this.previousSelection = fragment.getSelection();
			surfaceModel.pushStaging();

			// Initialize range
			if ( this.previousSelection instanceof ve.dm.LinearSelection && !annotation ) {
				if (
					fragment.getSelection().isCollapsed() &&
					fragment.getDocument().data.isContentOffset( fragment.getSelection().getRange().start )
				) {
					// Expand to nearest word
					expandedFragment = fragment.expandLinearSelection( 'word' );
					fragment = expandedFragment;
				} else {
					// Trim whitespace
					trimmedFragment = fragment.trimLinearSelection();
					fragment = trimmedFragment;
				}
				if ( !fragment.getSelection().isCollapsed() ) {
					// Create annotation from selection
					annotation = this.getAnnotationFromFragment( fragment );
					if ( annotation ) {
						fragment.annotateContent( 'set', annotation );
					}
				}
			} else {
				// Expand range to cover annotation
				expandedFragment = fragment.expandLinearSelection( 'annotation', annotation );
				fragment = expandedFragment;
			}

			// Update selection
			fragment.select();
			this.initialSelection = fragment.getSelection();

			// The initial annotation is the first matching annotation in the fragment
			this.initialAnnotation = this.getMatchingAnnotations( fragment, true ).get( 0 );
			initialCoveringAnnotation = this.getMatchingAnnotations( fragment ).get( 0 );
			// Fallback to a default annotation
			if ( !this.initialAnnotation ) {
				this.initialAnnotation = this.getAnnotationFromFragment( fragment );
			} else if (
				initialCoveringAnnotation &&
				initialCoveringAnnotation.compareTo( this.initialAnnotation )
			) {
				// If the initial annotation doesn't cover the fragment, record this as we'll need
				// to forcefully apply it to the rest of the fragment later
				this.initialAnnotationIsCovering = true;
			}
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.AnnotationInspector.prototype.getTeardownProcess = function ( data ) {
	data = data || {};
	return ve.ui.AnnotationInspector.super.prototype.getTeardownProcess.call( this, data )
		.first( function () {
			var i, len, annotations, insertion,
				insertionAnnotation = false,
				insertText = false,
				replace = false,
				annotation = this.getAnnotation(),
				remove = this.shouldRemoveAnnotation() || data.action === 'remove',
				surfaceModel = this.getFragment().getSurface(),
				fragment = surfaceModel.getFragment( this.initialSelection, false ),
				selection = this.getFragment().getSelection();

			if ( !( selection instanceof ve.dm.LinearSelection ) ) {
				return;
			}

			if ( !remove ) {
				if ( this.initialSelection.isCollapsed() ) {
					insertText = true;
				}
				if ( annotation ) {
					// Check if the initial annotation has changed, or didn't cover the whole fragment
					// to begin with
					if (
						!this.initialAnnotationIsCovering ||
						!this.initialAnnotation ||
						!this.initialAnnotation.compareTo( annotation )
					) {
						replace = true;
					}
				}
			}
			// If we are setting a new annotation, clear any annotations the inspector may have
			// applied up to this point. Otherwise keep them.
			if ( replace ) {
				surfaceModel.popStaging();
			} else {
				surfaceModel.applyStaging();
			}
			if ( insertText ) {
				insertion = this.getInsertionData();
				if ( insertion.length ) {
					fragment.insertContent( insertion, true );
					// Move cursor to the end of the inserted content, even if back button is used
					fragment.adjustLinearSelection( -insertion.length, 0 );
					this.previousSelection = new ve.dm.LinearSelection( fragment.getDocument(), new ve.Range(
						this.initialSelection.getRange().start + insertion.length
					) );
				}
			}
			if ( remove || replace ) {
				// Clear all existing annotations
				annotations = this.getMatchingAnnotations( fragment, true ).get();
				for ( i = 0, len = annotations.length; i < len; i++ ) {
					fragment.annotateContent( 'clear', annotations[i] );
				}
			}
			if ( replace ) {
				// Apply new annotation
				if ( fragment.getSelection().isCollapsed() ) {
					insertionAnnotation = true;
				} else {
					fragment.annotateContent( 'set', annotation );
				}
			}
			if ( !data.action || insertText ) {
				// Restore selection to what it was before we expanded it
				selection = this.previousSelection;
			}
			if ( data.action ) {
				surfaceModel.setSelection( selection );
			}

			if ( insertionAnnotation ) {
				surfaceModel.addInsertionAnnotations( annotation );
			}
		}, this )
		.next( function () {
			// Reset state
			this.previousSelection = null;
			this.initialSelection = null;
			this.initialAnnotation = null;
			this.initialAnnotationIsCovering = false;
		}, this );
};

/*!
 * VisualEditor user interface NodeInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Inspector for working with a node.
 *
 * @class
 * @extends ve.ui.FragmentInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.NodeInspector = function VeUiNodeInspector( config ) {
	// Parent constructor
	ve.ui.FragmentInspector.call( this, config );

	// Properties
	this.selectedNode = null;
};

/* Inheritance */

OO.inheritClass( ve.ui.NodeInspector, ve.ui.FragmentInspector );

/* Static Properties */

/**
 * Node classes compatible with this dialog.
 *
 * @static
 * @property {Function}
 * @inheritable
 */
ve.ui.NodeInspector.static.modelClasses = [];

/* Methods */

/**
 * Get the selected node.
 *
 * Should only be called after setup and before teardown.
 * If no node is selected or the selected node is incompatible, null will be returned.
 *
 * @param {Object} [data] Inspector opening data
 * @return {ve.dm.Node} Selected node
 */
ve.ui.NodeInspector.prototype.getSelectedNode = function () {
	var i, len,
		modelClasses = this.constructor.static.modelClasses,
		selectedNode = this.getFragment().getSelectedNode();

	for ( i = 0, len = modelClasses.length; i < len; i++ ) {
		if ( selectedNode instanceof modelClasses[i] ) {
			return selectedNode;
		}
	}
	return null;
};

/**
 * @inheritdoc
 */
ve.ui.NodeInspector.prototype.initialize = function ( data ) {
	// Parent method
	ve.ui.NodeInspector.super.prototype.initialize.call( this, data );

	// Initialization
	this.$content.addClass( 've-ui-nodeInspector' );
};

/**
 * @inheritdoc
 */
ve.ui.NodeInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.NodeInspector.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			this.selectedNode = this.getSelectedNode( data );
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.NodeInspector.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.NodeInspector.super.prototype.getTeardownProcess.call( this, data )
		.next( function () {
			this.selectedNode = null;
		}, this );
};

/*!
 * VisualEditor UserInterface LinkInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Inspector for linked content.
 *
 * @class
 * @extends ve.ui.AnnotationInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.LinkInspector = function VeUiLinkInspector( config ) {
	// Parent constructor
	ve.ui.AnnotationInspector.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.LinkInspector, ve.ui.AnnotationInspector );

/* Static properties */

ve.ui.LinkInspector.static.name = 'link';

ve.ui.LinkInspector.static.title = OO.ui.deferMsg( 'visualeditor-linkinspector-title' );

ve.ui.LinkInspector.static.linkTargetInputWidget = ve.ui.LinkTargetInputWidget;

ve.ui.LinkInspector.static.modelClasses = [ ve.dm.LinkAnnotation ];

ve.ui.LinkInspector.static.actions = ve.ui.LinkInspector.super.static.actions.concat( [
	{
		action: 'open',
		label: OO.ui.deferMsg( 'visualeditor-linkinspector-open' )
	}
] );

/* Methods */

/**
 * Handle target input change events.
 *
 * Updates the open button's hyperlink location.
 *
 * @param {string} value New target input value
 */
ve.ui.LinkInspector.prototype.onTargetInputChange = function () {
	var href = this.targetInput.getHref(),
		inspector = this;
	this.targetInput.isValid().done( function ( valid ) {
		inspector.actions.forEach( { actions: 'open' }, function ( action ) {
			action.setHref( href ).setTarget( '_blank' ).setDisabled( !valid );
			// HACK: Chrome renders a dark outline around the action when it's a link, but causing it to
			// re-render makes it magically go away; this is incredibly evil and needs further
			// investigation
			action.$element.hide().fadeIn( 0 );
		} );
	} );
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.shouldRemoveAnnotation = function () {
	return !this.targetInput.getValue().length;
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getInsertionText = function () {
	return this.targetInput.getValue();
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getAnnotation = function () {
	return this.targetInput.getAnnotation();
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getAnnotationFromFragment = function ( fragment ) {
	return new ve.dm.LinkAnnotation( {
		type: 'link',
		attributes: { href: fragment.getText() }
	} );
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.initialize = function () {
	var overlay = this.manager.getOverlay();

	// Parent method
	ve.ui.LinkInspector.super.prototype.initialize.call( this );

	// Properties
	this.targetInput = new this.constructor.static.linkTargetInputWidget( {
		$: this.$,
		$overlay: overlay ? overlay.$element : this.$frame,
		disabled: true,
		classes: [ 've-ui-linkInspector-target' ]
	} );

	// Events
	this.targetInput.connect( this, { change: 'onTargetInputChange' } );

	// Initialization
	this.$content.addClass( 've-ui-linkInspector-content' );
	this.form.$element.append( this.targetInput.$element );
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.LinkInspector.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			// Disable surface until animation is complete; will be reenabled in ready()
			this.getFragment().getSurface().disable();
			this.targetInput.setAnnotation( this.initialAnnotation );
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getReadyProcess = function ( data ) {
	return ve.ui.LinkInspector.super.prototype.getReadyProcess.call( this, data )
		.next( function () {
			this.targetInput.setDisabled( false ).focus().select();
			this.getFragment().getSurface().enable();
			this.onTargetInputChange();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getHoldProcess = function ( data ) {
	return ve.ui.LinkInspector.super.prototype.getHoldProcess.call( this, data )
		.next( function () {
			this.targetInput.setDisabled( true ).blur();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.LinkInspector.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.LinkInspector.super.prototype.getTeardownProcess.call( this, data )
		.next( function () {
			this.targetInput.setAnnotation( null );
		}, this );
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.LinkInspector );

/*!
 * VisualEditor UserInterface CommentInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Comment inspector.
 *
 * @class
 * @extends ve.ui.NodeInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.CommentInspector = function VeUiCommentInspector( config ) {
	// Parent constructor
	ve.ui.NodeInspector.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.CommentInspector, ve.ui.NodeInspector );

/* Static properties */

ve.ui.CommentInspector.static.name = 'comment';

ve.ui.CommentInspector.static.icon = 'comment';

ve.ui.CommentInspector.static.title =
	OO.ui.deferMsg( 'visualeditor-commentinspector-title' );

ve.ui.CommentInspector.static.modelClasses = [ ve.dm.CommentNode ];

ve.ui.CommentInspector.static.size = 'large';

ve.ui.CommentInspector.static.actions = [
	{
		action: 'done',
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-done' ),
		flags: [ 'progressive', 'primary' ],
		modes: 'edit'
	},
	{
		action: 'insert',
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-insert' ),
		flags: [ 'constructive', 'primary' ],
		modes: 'insert'
	},
	{
		action: 'remove',
		label: OO.ui.deferMsg( 'visualeditor-inspector-remove-tooltip' ),
		flags: 'destructive',
		modes: 'edit'
	}
];

/**
 * Handle frame ready events.
 *
 * @method
 */
ve.ui.CommentInspector.prototype.initialize = function () {
	// Parent method
	ve.ui.CommentInspector.super.prototype.initialize.call( this );

	this.textWidget = new ve.ui.WhitespacePreservingTextInputWidget( {
		$: this.$,
		multiline: true,
		autosize: true
	} );
	this.previousTextWidgetHeight = 0;

	this.textWidget.connect( this, { change: 'onTextInputWidgetChange' } );

	this.$content.addClass( 've-ui-commentInspector-content' );
	this.form.$element.append( this.textWidget.$element );
};

/**
 * Called when the text input widget value has changed.
 */
ve.ui.CommentInspector.prototype.onTextInputWidgetChange = function () {
	var height = this.textWidget.$element.height();
	if ( height !== this.previousTextWidgetHeight ) {
		this.updateSize();
		this.previousTextWidgetHeight = height;
	}
};

/**
 * @inheritdoc
 */
ve.ui.CommentInspector.prototype.getActionProcess = function ( action ) {
	if ( action === 'remove' || action === 'insert' ) {
		return new OO.ui.Process( function () {
			this.close( { action: action } );
		}, this );
	}
	return ve.ui.CommentInspector.super.prototype.getActionProcess.call( this, action );
};

/**
 * Handle the inspector being setup.
 *
 * @method
 * @param {Object} [data] Inspector opening data
 */
ve.ui.CommentInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.CommentInspector.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			this.getFragment().getSurface().pushStaging();

			this.commentNode = this.getSelectedNode();
			if ( this.commentNode ) {
				this.textWidget.setValueAndWhitespace( this.commentNode.getAttribute( 'text' ) || '' );
				this.actions.setMode( 'edit' );
			} else {
				this.textWidget.setWhitespace( [ ' ', ' ' ] );
				this.actions.setMode( 'insert' );
				this.getFragment().insertContent( [
					{
						type: 'comment',
						attributes: { text: '' }
					},
					{ type: '/comment' }
				] );
				this.commentNode = this.getSelectedNode();
			}
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.CommentInspector.prototype.getReadyProcess = function ( data ) {
	return ve.ui.CommentInspector.super.prototype.getReadyProcess.call( this, data )
		.next( function () {
			this.getFragment().getSurface().enable();
			this.textWidget.focus();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.CommentInspector.prototype.getTeardownProcess = function ( data ) {
	data = data || {};
	return ve.ui.CommentInspector.super.prototype.getTeardownProcess.call( this, data )
		.first( function () {
			var surfaceModel = this.getFragment().getSurface(),
				text = this.textWidget.getValue(),
				innerText = this.textWidget.getInnerValue();

			if ( data.action === 'remove' || innerText === '' ) {
				surfaceModel.popStaging();
				// If popStaging removed the node then this will be a no-op
				this.getFragment().removeContent();
			} else {
				// Edit comment node
				this.getFragment().changeAttributes( { text: text } );
				surfaceModel.applyStaging();
			}

			// Reset inspector
			this.textWidget.setValueAndWhitespace( '' );
		}, this );
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.CommentInspector );

/*!
 * VisualEditor UserInterface LanguageInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Inspector for specifying the language of content.
 *
 * @class
 * @extends ve.ui.AnnotationInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.LanguageInspector = function VeUiLanguageInspector( config ) {
	// Parent constructor
	ve.ui.AnnotationInspector.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.LanguageInspector, ve.ui.AnnotationInspector );

/* Static properties */

ve.ui.LanguageInspector.static.name = 'language';

ve.ui.LanguageInspector.static.title =
	OO.ui.deferMsg( 'visualeditor-languageinspector-title' );

ve.ui.LanguageInspector.static.modelClasses = [ ve.dm.LanguageAnnotation ];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.LanguageInspector.prototype.getAnnotation = function () {
	var lang = this.languageInput.getLang(),
		dir = this.languageInput.getDir();
	return ( lang || dir ?
		new ve.dm.LanguageAnnotation( {
			type: 'meta/language',
			attributes: {
				lang: lang,
				dir: dir
			}
		} ) :
		null
	);
};

/**
 * @inheritdoc
 */
ve.ui.LanguageInspector.prototype.getAnnotationFromFragment = function ( fragment ) {
	return new ve.dm.LanguageAnnotation( {
		type: 'meta/language',
		attributes: {
			lang: fragment.getDocument().getLang(),
			dir: fragment.getDocument().getDir()
		}
	} );
};

/**
 * @inheritdoc
 */
ve.ui.LanguageInspector.prototype.initialize = function () {
	// Parent method
	ve.ui.LanguageInspector.super.prototype.initialize.call( this );

	// Properties
	this.languageInput = new ve.ui.LanguageInputWidget( { $: this.$ } );

	// Initialization
	this.form.$element.append( this.languageInput.$element );
};

/**
 * @inheritdoc
 */
ve.ui.LanguageInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.LanguageInspector.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			this.languageInput.setLangAndDir(
				this.initialAnnotation.getAttribute( 'lang' ),
				this.initialAnnotation.getAttribute( 'dir' )
			);
		}, this );
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.LanguageInspector );

/*!
 * VisualEditor UserInterface SpecialCharacterInspector class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Inspector for inserting special characters.
 *
 * @class
 * @extends ve.ui.FragmentInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.SpecialCharacterInspector = function VeUiSpecialCharacterInspector( config ) {
	// Parent constructor
	ve.ui.FragmentInspector.call( this, config );

	this.characters = null;
	this.$buttonDomList = null;
	this.categories = null;

	this.$element.addClass( 've-ui-specialCharacterInspector' );
};

/* Inheritance */

OO.inheritClass( ve.ui.SpecialCharacterInspector, ve.ui.FragmentInspector );

/* Static properties */

ve.ui.SpecialCharacterInspector.static.name = 'specialcharacter';

ve.ui.SpecialCharacterInspector.static.title =
	OO.ui.deferMsg( 'visualeditor-specialcharacterinspector-title' );

ve.ui.SpecialCharacterInspector.static.size = 'large';

ve.ui.SpecialCharacterInspector.static.actions = [
	{
		action: 'cancel',
		label: OO.ui.deferMsg( 'visualeditor-dialog-action-cancel' ),
		flags: 'safe'
	}
];

/* Methods */

/**
 * Handle frame ready events.
 *
 * @method
 */
ve.ui.SpecialCharacterInspector.prototype.initialize = function () {
	// Parent method
	ve.ui.SpecialCharacterInspector.super.prototype.initialize.call( this );

	this.$spinner = this.$( '<div>' ).addClass( 've-ui-specialCharacterInspector-spinner' );
	this.form.$element.append( this.$spinner );
};

/**
 * Handle the inspector being setup.
 *
 * @method
 * @param {Object} [data] Inspector opening data
 */
ve.ui.SpecialCharacterInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.SpecialCharacterInspector.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			var inspector = this;
			// Stage a space to show insertion position
			this.getFragment().getSurface().pushStaging();
			this.getFragment().insertContent( ' ' );
			// Don't request the character list again if we already have it
			if ( !this.characters ) {
				this.$spinner.removeClass( 'oo-ui-element-hidden' );
				this.fetchCharList()
					.done( function () {
						inspector.buildButtonList();
					} )
					// TODO: show error message on fetchCharList().fail
					.always( function () {
						// TODO: generalize push/pop pending, like we do in Dialog
						inspector.$spinner.addClass( 'oo-ui-element-hidden' );
					} );
			}
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.SpecialCharacterInspector.prototype.getTeardownProcess = function ( data ) {
	data = data || {};
	return ve.ui.SpecialCharacterInspector.super.prototype.getTeardownProcess.call( this, data )
		.first( function () {
			this.getFragment().getSurface().popStaging();
			if ( data.character ) {
				this.getFragment().insertContent( data.character, true ).collapseToEnd().select();
			}
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.SpecialCharacterInspector.prototype.getActionProcess = function ( action ) {
	return new OO.ui.Process( function () {
		this.close( { action: action } );
	}, this );
};

/**
 * Fetch the special character list object
 *
 * Returns a promise which resolves when this.characters has been populated
 *
 * @returns {jQuery.Promise}
 */
ve.ui.SpecialCharacterInspector.prototype.fetchCharList = function () {
	var charsList,
		charsObj = {};

	// Get the character list
	charsList = ve.msg( 'visualeditor-specialcharinspector-characterlist-insert' );
	try {
		charsObj = $.parseJSON( charsList );
	} catch ( err ) {
		// There was no character list found, or the character list message is
		// invalid json string. Force a fallback to the minimal character list
		ve.log( 've.ui.SpecialCharacterInspector: Could not parse the Special Character list.');
		ve.log( err.message );
	} finally {
		this.characters = charsObj;
	}

	// This implementation always resolves instantly
	return $.Deferred().resolve().promise();
};

/**
 * Builds the button DOM list based on the character list
 */
ve.ui.SpecialCharacterInspector.prototype.buildButtonList = function () {
	var category, character, characters, $categoryButtons,
		$list = this.$( '<div>' ).addClass( 've-ui-specialCharacterInspector-list' );

	for ( category in this.characters ) {
		characters = this.characters[category];
		$categoryButtons = $( '<div>' ).addClass( 've-ui-specialCharacterInspector-list-group' );
		for ( character in characters ) {
			$categoryButtons.append(
				$( '<div>' )
					.addClass( 've-ui-specialCharacterInspector-list-character' )
					.data( 'character', characters[character] )
					.text( character )
			);
		}

		$list
			.append( this.$( '<h3>').text( category ) )
			.append( $categoryButtons );
	}

	$list.on( 'click', this.onListClick.bind( this ) );

	this.form.$element.append( $list );
};

/**
 * Handle the click event on the list
 */
ve.ui.SpecialCharacterInspector.prototype.onListClick = function ( e ) {
	this.close( { character: $( e.target ).data( 'character' ) } );
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.SpecialCharacterInspector );

/*!
 * VisualEditor UserInterface DesktopSurface class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * A surface is a top-level object which contains both a surface model and a surface view.
 * This is the mobile version of the surface.
 *
 * @class
 * @extends ve.ui.Surface
 *
 * @constructor
 * @param {HTMLDocument|Array|ve.dm.LinearData|ve.dm.Document} dataOrDoc Document data to edit
 * @param {Object} [config] Configuration options
 */
ve.ui.DesktopSurface = function VeUiDesktopSurface() {
	// Parent constructor
	ve.ui.Surface.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.ui.DesktopSurface, ve.ui.Surface );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.DesktopSurface.prototype.createContext = function () {
	return new ve.ui.DesktopContext( this, { $: this.$ } );
};

/**
 * @inheritdoc
 */
ve.ui.DesktopSurface.prototype.createDialogWindowManager = function () {
	return new ve.ui.WindowManager( { factory: ve.ui.windowFactory } );
};

/*!
 * VisualEditor UserInterface DesktopContext class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Context menu and inspectors.
 *
 * @class
 * @extends ve.ui.Context
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {Object} [config] Configuration options
 */
ve.ui.DesktopContext = function VeUiDesktopContext( surface, config ) {
	// Parent constructor
	ve.ui.DesktopContext.super.call( this, surface, config );

	// Properties
	this.popup = new OO.ui.PopupWidget( { $: this.$, $container: this.surface.$element } );
	this.transitioning = null;
	this.suppressed = false;
	this.onWindowResizeHandler = this.onPosition.bind( this );
	this.$window = this.$( this.getElementWindow() );

	// Events
	this.surface.getView().connect( this, {
		relocationStart: 'onSuppress',
		relocationEnd: 'onUnsuppress',
		blur: 'onSuppress',
		focus: 'onUnsuppress',
		position: 'onPosition'
	} );
	this.surface.getModel().connect( this, {
		select: 'onModelSelect'
	} );
	this.inspectors.connect( this, {
		resize: 'setPopupSize'
	} );
	this.$window.on( 'resize', this.onWindowResizeHandler );

	// Initialization
	this.$element
		.addClass( 've-ui-desktopContext' )
		.append( this.popup.$element );
	this.menu.$element.addClass( 've-ui-desktopContext-menu' );
	this.inspectors.$element.addClass( 've-ui-desktopContext-inspectors' );
	this.popup.$body.append( this.menu.$element, this.inspectors.$element );

	// HACK: hide the popup with visibility: hidden; rather than display: none;, because
	// the popup contains inspector iframes, and applying display: none; to those causes them to
	// not load in Firefox
	this.popup.$element
		.css( { visibility: 'hidden' } )
		.removeClass( 'oo-ui-element-hidden' );
};

/* Inheritance */

OO.inheritClass( ve.ui.DesktopContext, ve.ui.Context );

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.DesktopContext.prototype.afterContextChange = function () {
	// Parent method
	ve.ui.DesktopContext.super.prototype.afterContextChange.call( this );

	// Bypass while dragging
	if ( this.suppressed ) {
		return;
	}
};

/**
 * Handle context suppression event.
 */
ve.ui.DesktopContext.prototype.onSuppress = function () {
	this.suppressed = true;

	if ( this.isVisible() ) {
		if ( this.menu.isVisible() ) {
			// Change state: menu -> closed
			this.menu.toggle( false );
			this.toggle( false );
		} else if ( this.inspector ) {
			// Change state: inspector -> closed
			this.inspector.close();
		}
	}
};

/**
 * Handle context unsuppression event.
 */
ve.ui.DesktopContext.prototype.onUnsuppress = function () {
	var inspectable = !!this.getAvailableTools().length;

	this.suppressed = false;

	if ( inspectable ) {
		// Change state: closed -> menu
		this.menu.toggle( true );
		this.populateMenu();
		this.toggle( true );
	}
};

/**
 * Handle model select event.
 */
ve.ui.DesktopContext.prototype.onModelSelect = function () {
	if ( this.isVisible() ) {
		if ( this.inspector && this.inspector.isOpened() ) {
			this.inspector.close();
		}
		this.updateDimensionsDebounced();
	}
};

/**
 * Handle cursor position change event.
 */
ve.ui.DesktopContext.prototype.onPosition = function () {
	if ( this.isVisible() ) {
		this.updateDimensionsDebounced();
	}
};

/**
 * @inheritdoc
 */
ve.ui.DesktopContext.prototype.createInspectorWindowManager = function () {
	return new ve.ui.DesktopInspectorWindowManager( {
		$: this.$,
		factory: ve.ui.windowFactory,
		overlay: this.surface.getLocalOverlay(),
		modal: false
	} );
};

/**
 * @inheritdoc
 */
ve.ui.DesktopContext.prototype.onInspectorOpening = function () {
	ve.ui.DesktopContext.super.prototype.onInspectorOpening.apply( this, arguments );
	// Resize the popup before opening so the body height of the window is measured correctly
	this.setPopupSize();
};

/**
 * @inheritdoc
 */
ve.ui.DesktopContext.prototype.toggle = function ( show ) {
	var promise;

	if ( this.transitioning ) {
		return this.transitioning;
	}
	show = show === undefined ? !this.visible : !!show;
	if ( show === this.visible ) {
		return $.Deferred().resolve().promise();
	}

	this.visible = show;
	this.transitioning = $.Deferred();
	promise = this.transitioning.promise();

	this.popup.toggle( show );
	// HACK: make the context and popup visibility: hidden; instead of display: none; because
	// they contain inspector iframes, and applying display: none; to those causes them to
	// not load in Firefox
	this.$element.add( this.popup.$element )
		.removeClass( 'oo-ui-element-hidden' )
		.css( {
			visibility: show ? 'visible' : 'hidden'
		} );

	this.transitioning.resolve();
	this.transitioning = null;
	this.visible = show;

	if ( show ) {
		if ( this.inspector ) {
			this.inspector.updateSize();
		}
		// updateDimensionsDebounced is not necessary here and causes a movement flicker
		this.updateDimensions();
	} else if ( this.inspector ) {
		this.inspector.close();
	}

	return promise;
};

/**
 * @inheritdoc
 */
ve.ui.DesktopContext.prototype.updateDimensions = function () {
	var startAndEndRects, position, embeddable, middle,
		rtl = this.surface.getModel().getDocument().getDir() === 'rtl',
		surface = this.surface.getView(),
		focusedNode = surface.getFocusedNode(),
		boundingRect = surface.getSelectionBoundingRect();

	if ( !boundingRect ) {
		// If !boundingRect, the surface apparently isn't selected.
		// This shouldn't happen because the context is only supposed to be
		// displayed in response to a selection, but it sometimes does happen due
		// to browser weirdness.
		// Skip updating the cursor position, but still update the width and height.
		this.popup.toggleAnchor( true );
		this.popup.align = 'center';
	} else if ( focusedNode && !focusedNode.isContent() ) {
		embeddable = !this.hasInspector() &&
			boundingRect.height > this.menu.$element.outerHeight() + 5 &&
			boundingRect.width > this.menu.$element.outerWidth() + 10;
		this.popup.toggleAnchor( !embeddable );
		if ( embeddable ) {
			// Embedded context position depends on directionality
			position = {
				x: rtl ? boundingRect.left : boundingRect.right,
				y: boundingRect.top
			};
			this.popup.align = rtl ? 'left' : 'right';
		} else {
			// Position the context underneath the center of the node
			middle = ( boundingRect.left + boundingRect.right ) / 2;
			position = {
				x: middle,
				y: boundingRect.bottom
			};
			this.popup.align = 'center';
		}
	} else {
		// The selection is text or an inline focused node
		startAndEndRects = surface.getSelectionStartAndEndRects();
		if ( startAndEndRects ) {
			middle = ( boundingRect.left + boundingRect.right ) / 2;
			if (
				( !rtl && startAndEndRects.end.right > middle ) ||
				( rtl && startAndEndRects.end.left < middle )
			) {
				// If the middle position is within the end rect, use it
				position = {
					x: middle,
					y: boundingRect.bottom
				};
			} else {
				// ..otherwise use the side of the end rect
				position = {
					x: rtl ? startAndEndRects.end.left : startAndEndRects.end.right,
					y: startAndEndRects.end.bottom
				};
			}
		}

		this.popup.toggleAnchor( true );
		this.popup.align = 'center';
	}

	if ( position ) {
		this.$element.css( { left: position.x, top: position.y } );
	}

	// HACK: setPopupSize() has to be called at the end because it reads this.popup.align,
	// which we set directly in the code above
	this.setPopupSize();

	return this;
};

/**
 * Resize the popup to match the size of its contents (menu or inspector).
 */
ve.ui.DesktopContext.prototype.setPopupSize = function () {
	var $container = this.inspector ? this.inspector.$frame : this.menu.$element;

	// PopupWidget normally is clippable, suppress that to be able to resize and scroll it into view.
	// Needs to be repeated before every call, as it resets itself when the popup is shown or hidden.
	this.popup.toggleClipping( false );

	this.popup.setSize(
		$container.outerWidth( true ),
		$container.outerHeight( true )
	);

	this.popup.scrollElementIntoView();
};

/**
 * @inheritdoc
 */
ve.ui.DesktopContext.prototype.destroy = function () {
	// Disconnect
	this.surface.getView().disconnect( this );
	this.surface.getModel().disconnect( this );
	this.$window.off( 'resize', this.onWindowResizeHandler );

	// Parent method
	return ve.ui.DesktopContext.super.prototype.destroy.call( this );
};

/*!
 * VisualEditor UserInterface DesktopInspectorWindowManager class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Window manager for desktop inspectors.
 *
 * @class
 * @extends ve.ui.WindowManager
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {ve.ui.Overlay} [overlay] Overlay to use for menus
 */
ve.ui.DesktopInspectorWindowManager = function VeUiDesktopInspectorWindowManager( config ) {
	// Parent constructor
	ve.ui.DesktopInspectorWindowManager.super.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.DesktopInspectorWindowManager, ve.ui.WindowManager );

/* Static Properties */

ve.ui.DesktopInspectorWindowManager.static.sizes = {
	small: {
		width: 200,
		maxHeight: '100%'
	},
	medium: {
		width: 300,
		maxHeight: '100%'
	},
	large: {
		width: 400,
		maxHeight: '100%'
	},
	full: {
		// These can be non-numeric because they are never used in calculations
		width: '100%',
		height: '100%'
	}
};

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.DesktopInspectorWindowManager.prototype.getSetupDelay = function () {
	return 0;
};

/**
 * @inheritdoc
 */
ve.ui.DesktopInspectorWindowManager.prototype.getReadyDelay = function () {
	return 0;
};

/**
 * @inheritdoc
 */
ve.ui.DesktopInspectorWindowManager.prototype.getHoldDelay = function () {
	return 0;
};

/**
 * @inheritdoc
 */
ve.ui.DesktopInspectorWindowManager.prototype.getTeardownDelay = function () {
	return 0;
};
