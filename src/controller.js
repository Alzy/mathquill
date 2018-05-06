/*********************************************
 * Controller for a MathQuill instance,
 * on which services are registered with
 *
 *   Controller.open(function(_) { ... });
 *
 ********************************************/

var Controller = P(function(_) {
  _.activeUndo = false;
  _.undoTimer = false;
  _.undoHash = false;
  var maxActions = 50; // Set size of undo stack

  _.init = function(root, container, options) {
    this.id = root.id;
    this.data = {};

    this.root = root;
    this.container = container;
    this.options = options;

    root.controller = this;

    this.cursor = root.cursor = Cursor(root, options);
    // TODO: stop depending on root.cursor, and rm it

    this.undoArray = [];
    this.redoArray = [];
  };

  _.handle = function(name, dir) {
    var handlers = this.options.handlers;
    if (handlers && handlers.fns[name]) {
      var mq = handlers.APIClasses[this.KIND_OF_MQ](this);
      if (dir === L || dir === R) handlers.fns[name](dir, mq);
      else handlers.fns[name](mq);
    }
  };

  var notifyees = [];
  this.onNotify = function(f) { notifyees.push(f); };
  _.notify = function() {
    for (var i = 0; i < notifyees.length; i += 1) {
      notifyees[i].apply(this.cursor, arguments);
    }
    return this;
  };

  // Schedule function works to avoid setting an undo for every letter of keypress
  // Called on every keypress BEFORE change is made to mathquill, records current state
  // and will wait 1000ms to record it into the undo stack.  Any more keypresses in that
  // timeframe will simply delay the record time another 1000ms.
  _.scheduleUndoPoint = function(el) {
    // If this was called by something being altered by an undo action, we ignore it...we already know
    if(this.activeUndo) return; 
    // Check for active undotimer
    if(this.undoTimer) 
      window.clearTimeout(this.undoTimer);
    else 
      this.undoHash = this.currentState();
    this.undoTimer = window.setTimeout(function(_this) { 
      return function() { 
        _this.undoTimer = false;
        _this.setUndoPoint(_this.undoHash);
        _this.undoHash = false;
      }; 
    }(this), 1000);
  }

  // Register the current or provided status in to the undo manager
  // Called on a delay by scheduleUndoPoint, or call immediately for 'big' 
  // undo events (like paste, cut, etc) BEFORE the mathquill object is changed.
  _.setUndoPoint = function(hash) {
    // Was this called by something being altered by an undo/redo action?
    if(this.activeUndo) return;
    // Was I called directly while a scheduled undo is waiting? 
    if(this.undoTimer) {
      window.clearTimeout(this.undoTimer);
      this.undoTimer = false;
      if(typeof hash === 'undefined') 
        hash = this.undoHash; 
      else 
        this.setUndoPoint(this.undoHash);
      this.undoHash = false;
    } 
    if(typeof hash === 'undefined') hash = this.currentState();
    this.undoArray.push(hash);
    console.log(this.undoArray);
    if(this.undoArray.length > maxActions) 
      this.undoArray.shift();
    while(this.redoArray.length) // Clear redo manager after a new undo point is set
      this.redoArray.pop();
    this.handle('onUndoPointSet');
  }

  // erase undo and redo stacks and reset all related variables.
  _.clearUndoRedoStack = function() {
    this.undoArray.length = 0;
    this.redoArray.length = 0;
    this.activeUndo = false;
    this.undoTimer = false;
    this.undoHash = false;
  }

  // record the current state
  _.currentState = function() {
    console.log('cursor', this.cursor.root);
    return {
        latex: this.API.latex(),
        cursor: {
          'target': this.cursor.root,
          'pageX': this.cursor._jQ.offset().left,
          'pageY': this.cursor._jQ.offset().top
        }
    };
  }
  // Restore to provided state
  _.restoreState = function(data) {
    this.API.select();
    this.cursor.deleteSelection();
    this.API.moveToLeftEnd();
    // this.writeLatex(data.latex.slice(6, -1));
    this.writeLatex(data.latex);
    this.cursor.setPosition(data.cursor);
  }


  // Attach these methods to the ctrl-z and ctrl-y actions, and any software buttons (from a pulldown menu for example)
  _.restoreUndoPoint = function() {
    if(this.undoTimer) { // Something is scheduled...add it in now
      this.undoTimer = false;
      this.setUndoPoint(this.undoHash);
      this.undoHash = false;
    }
    this.undoRedo(true);
  }
  _.restoreRedoPoint = function() {
    this.undoRedo(false);
  }

  //Perform the undo/redo action.  It restores to the last item in the undo/redo stack,
  // and then adds this action to the other stack so it can be undone/redone
  _.undoRedo = function(undo) {
    if(undo && (this.undoArray.length == 0)) return;
    if(!undo && (this.redoArray.length == 0)) return;
    this.activeUndo = true;
    var action = undo ? this.undoArray.pop() : this.redoArray.pop();
    var reverseAction = this.currentState();  // Reverse action is used to populate redo when this action completes
    this.restoreState(action);
    // Add the reverse action to the undo/redo array
    if(undo) {
      this.redoArray.push(reverseAction);
      if(this.redoArray.length > maxActions) 
        this.redoArray.shift();
    } else {
      this.undoArray.push(reverseAction);
      if(this.undoArray.length > maxActions) 
        this.undoArray.shift();
    }
    this.activeUndo = false;
    // delete action;
    action = null;
    // handle this event
    if(undo){
      this.handle('onUndo');
    } else {
      this.handle('onRedo');
    }
  }
});
