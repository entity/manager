
// slice

var slice = [].slice

/**
 * Module dependencies.
 */

var Entity = require('entity')

/**
 * Manager factory.
 */

module.exports = Manager

/**
 * Manager class.
 */

function Manager (parent) {
  if (!(this instanceof Manager)) return new Manager(parent)

  this.parent = parent || this
  this.root = this.parent.root || this
  this.children = []

  this.systems = []
  this.entities = []
  this.components = {}
  this.componentsIndex = []

  this.listeners = {}

  this.state('ready')
}

/**
 * Create an entity of components, and use it.
 *
 * @param {component} c...
 * @return {entity} entity
 * @api public
 */

Manager.prototype.createEntity = function () {
  var args = slice.call(arguments)
  var e = new Entity(args)
  this.use(e, true)
  return e
}

/**
 * Remove all entities.
 *
 * @return {object} this
 * @api public
 */

Manager.prototype.removeAllEntities = function () {
  this.entities.slice().forEach(function (e) {
    this.root.removeEntity(e)
    this.removeEntity(e)
  }, this)
  return this
}

/**
 * Remove an entity.
 *
 * @param {entity} e
 * @return {object) this
 * @api public
 */

Manager.prototype.removeEntity = function (e) {
  var self = this
  
  var idx = this.entities.indexOf(e)
  if (~idx) this.entities.splice(idx, 1)
  
  e.components.forEach(function (c) {
    var idx = self.componentsIndex.indexOf(c)
    var comps = self.components[idx]
    if (null != comps) {
      var idx = comps.indexOf(e)
      if (~idx) comps.splice(idx, 1)
    }
  })

  return this
}

/**
 * Create a manager and use it.
 *
 * @return {manager}
 * @api public
 */

Manager.prototype.createManager = function () {
  var manager = new Manager(this)
  this.use(manager)
  return manager
}

/**
 * Register the components of an entity.
 *
 * @param {entity} e 
 * @return {object} this
 * @api private
 */

Manager.prototype.registerComponents = function (e) {
  var self = this
  e.components.forEach(function (c) {
    self.reg(c, e)
  })
  return this
}

/**
 * Apply component data to an entity or all.
 *
 * @param {entity} [e]
 * @api public
 */

Manager.prototype.applyComponents = function (e) {
  if (e) {
    e.components.forEach(function (c) {
      e.applyComponent(c)
    })
    return this
  }
  else {
    this.each(this.applyComponents.bind(this))
  }
  return this
}

/**
 * Listen on events.
 *
 * @param {string} ev 
 * @param {fn} fn 
 * @return {object} this
 * @api public
 */

Manager.prototype.on = function (ev, fn) {
  this.listeners[ev] = this.listeners[ev] || []
  this.listeners[ev].push(fn)
  return this
}

/**
 * Emit events.
 *
 * @param {string} ev 
 * @param {mixed} arguments
 * @return {object} this
 * @api private
 */

Manager.prototype.emit = function (ev, a, b, c, d) {
  if (!(ev in this.listeners)) return
  for (var i=0, len=this.listeners[ev].length; i<len; i++) {
    this.listeners[ev][i].call(this, a, b, c, d)
  }
  return this
}

/**
 * Determine whether this is the root manager.
 *
 * @return {boolean}
 * @api public
 */

Manager.prototype.isRoot = function () {
  return this.parent === this
}

/**
 * Attach listeners for the methods of an object.
 *
 * @param {object} obj
 * @return {object} this
 * @api private
 */

Manager.prototype.addListeners = function (obj) {
  Object.keys(obj)
    .filter(function (k) { return '_' != k.substr(0,1) })
    .forEach(function (k) {
      if ('function' == typeof obj[k]) {
        this.on(k, function () {
          var args = slice.call(arguments)

          if (!obj[k].length) {
            return obj[k].call(obj)
          }

          this.each(obj, function (e) {
            obj[k].apply(obj, [e].concat(args))
          })
        })
      }
    }, this)
  return this
}

/**
 * Generate a string serialized snapshot of our entities.
 *
 * @return {string}
 * @api public
 */

Manager.prototype.snapshot = function () {
  return JSON.stringify(this.entities)
}

/**
 * Main event handlers.
 * 
 * init, start, pause, stop, tear
 *
 * @api public
 */

Manager.prototype.init = function () { return this.state('init') }
Manager.prototype.start = function () { return this.state('start') }
Manager.prototype.pause = function () { return this.state('pause') }
Manager.prototype.stop = function () { return this.state('stop') }
Manager.prototype.tear = function () { return this.state('tear') }
Manager.prototype.reset = function () {
  this.stop()
  this.tear()
  setTimeout(function () {
    this.init()
    this.start()
  }.bind(this), 0)
  return this
}

/**
 * State accessor. Also emits state on change.
 *
 * @param {string} [s]
 * @return {string} s
 * @api private
 */

Manager.prototype.state = function (s) {
  if (null == s) return this._state
  this._state = s
  this.emit(s)
  this.emit('state', s)
  return this
}

/**
 * Get all entities using all the components in the array.
 *
 * @param {array} arr
 * @return {array} entities
 * @api public
 */

Manager.prototype.of = function (arr) {
  var res = []
  var ents = []
  for (var i=0, c, len=arr.length; i<len; i++) {
    c = arr[i]
    if ('string' == typeof c) {
      ents.push(this.entities.filter(function (e) {
        return (c in e)
      }))
    }
    else {
      c = c.component || c
      var index = this.componentsIndex
      var idx = index.indexOf(c)
      if (~idx) ents.push(this.components[idx] || [])
    }
  }
  var exclude
  if (!ents.length) return res
  for (var i=0, e, len=ents[0].length; i<len; i++) {
    e = ents[0][i]
    exclude = false
    ents.forEach(function (list) {
      if (!~list.indexOf(e)) exclude = true
    })
    if (!exclude) res.push(e)
  }
  return res
}

/**
 * Iterate entities of certain components,
 * or through all if no component is passed.
 *
 * @param {component} [c...]
 * @param {fn} fn
 * @return {object} this
 * @api public
 */

Manager.prototype.each = function (c, fn) {
  var args
  if ('function' == typeof c) {
    this.entities.forEach(c, this)
    return this
  }
  else if (Array.isArray(c)) {
    args = c
  }
  else {
    args = slice.call(arguments)
  }
  fn = args.pop()
  this.of(args).forEach(fn)
  return this
}

/**
 * Get the first entity matching component.
 *
 * @param {component} c 
 * @return {entity}
 * @api public
 */

Manager.prototype.get = function (c) {
  return this.of(c)[0]
}

/**
 * Use an entity, system or manager.
 *
 * When entity:
 *   Registers an entity (creating a new one or reusing
 *   the one passed).
 *
 * When system:
 *   Registers a system to be used. Order matters.
 *
 * When manager:
 *   Adds the manager to its children.
 *
 * @param {manager|system|entity} item
 * @param {boolean} reuse
 * @return {object} this
 * @api public
 */

Manager.prototype.use = function (item, reuse) {
  if (item instanceof Entity) {
    var e = item
    if (!reuse) e = new Entity(item)
    if (!~this.entities.indexOf(e)) {
      var self = this
      e.on('add', function (c) {
        self.reg(c, e)
      })
      this.entities.push(e)
      this.registerComponents(e)
      if (this.root != this) {
        if (!~this.root.entities.indexOf(e)) {
          this.root.entities.push(e)
          this.root.registerComponents(e)
        }
      }
    }
  }
  else if ('object' == typeof item || 'function' == typeof item) {
    item = item.system || item

    this.addListeners(item)

    if (!('children' in item)) {
      item.emit = this.emit.bind(this)
      item.each = this.each.bind(this)
      item.of = this.of.bind(this)
      this.systems.push(item)
    }
    else {
      item.root = this.root
      this.children.push(item)
    }
  }
  else console.error('unknown', item)
  return this
}

/**
 * Register a component for an entity.
 *
 * @param {component} c 
 * @param {entity} e 
 * @return {object} this
 * @api private
 */

Manager.prototype.reg = function (c, e) {
  var comps = this.components
  var index = this.componentsIndex
  var idx = index.indexOf(c)
  if (~idx) {
    if (!~comps[idx].indexOf(e)) {
      comps[idx].push(e)
    }
  }
  else {
    index.push(c)
    comps[index.length-1] = [e]
  }
  return this
}

/**
 * Join (late) an entity.
 * 
 * It will try to apply components and systems
 * based on the current state.
 *
 * @param {entity} e 
 * @return {object} this
 * @api public
 */

Manager.prototype.join = function (e) {
  this.use(e, true)
  this.applyComponents(e)
  var s = this.state()
  if ('none' == s) return this
  if ('init' == s || 'start' == s || 'pause' == s || 'stop' == s) {
    this.runSystems(e, 'init')
  }
  if ('start' == s || 'pause' == s) {
    this.runSystems(e, 'start')
  }
  if ('pause' == s) {
    this.runSystems(e, 'pause')
  }
  return this
}

/**
 * Run the systems for an entity alone.
 *
 * @param {entity} e 
 * @param {string} method 
 * @return {object} this
 * @api private
 */

Manager.prototype.runSystems = function (e, method) {
  this.systems.forEach(function (system) {
    if (!system[method]) return
    if (!system[method].length) {
      return
    }
    system.each(system, function (_e) {
      if (e === _e) {
        system[method].call(system, e)
      }
    })
  })
  return this
}

/**
 * Mixin helper.
 *
 * @param {object} target
 * @param {object} source
 * @param {boolean} force
 * @api private
 */

function mixin (t, s, f) {
  for (var k in s) {
    if (f || !(k in t)) t[k] = s[k]
  }
}
