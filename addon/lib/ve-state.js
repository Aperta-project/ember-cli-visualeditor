
var VeState = function(editor) {
  this.editor = editor;
  this.fragment = null;
  this.selection = null;
  this.fragmentAnnotations = null;
  this.isDirty = false;
};

VeState.prototype.getEditor = function() {
  return this.editor;
};

VeState.prototype.update = function(surface) {
  var newSelection = surface.getSelection();
  // skip update if the selection is the same and the state is not dirty
  if (!this.isDirty && this.selection && this.selection.equals(newSelection)) {
    return false;
  }

  this.fragment = surface.getFragment();
  this.selection = surface.getSelection();
  this.fragmentAnnotations = this.fragment.getAnnotations();
  this.isDirty = false;
  return true;
};

VeState.prototype.isAnnotationSelected = function(name) {
  var fragmentAnnotations = this.getFragmentAnnotations();
  if (fragmentAnnotations) {
    return fragmentAnnotations.hasAnnotationWithName(name);
  } else {
    return false;
  }
};

export default VeState;
