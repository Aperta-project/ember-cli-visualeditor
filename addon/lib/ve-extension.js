
function VeExtension() {};

/**
 * Registers the extension with a VeRegistry used by a VisualEditor instance.
 * This is called once before any VE Document is created.
 */
VeExtension.prototype.register = function(veRegistry) {
};

/**
 * Called after a new ve.dm.Document has been created.
 */
VeExtension.prototype.afterDocumentCreated = function(documentModel) {
};

/**
 *
 */
VeExtension.prototype.beforeDocumentDisposed = function(documentModel) {
};

/**
 * Called after a new ve.dm.Surface has been created.
 */
VeExtension.prototype.afterSurfaceCreated = function(surfaceModel) {
};

VeExtension.prototype.beforeSurfaceDisposed = function(surfaceModel) {
};

/**
 * Called after a new ve.dm.Surface has been created.
 */
VeExtension.prototype.afterSurfaceUICreated = function(surfaceUI) {
};

VeExtension.prototype.beforeSurfaceUIDisposed = function(surfaceUI) {
};

export default VeExtension;
