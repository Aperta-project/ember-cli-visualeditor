import Ember from 'ember';

var VeState = function() {
  this.fragment = null;
  this.selection = null;
  this.fragmentAnnotations = null;
};

VeState.prototype.update = function(surface) {
  this.fragment = surface.getFragment();
  this.selection = surface.getSelection();
  this.fragmentAnnotations = this.fragment.getAnnotations();
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
