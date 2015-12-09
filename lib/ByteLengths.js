// Based on code from https://github.com/Medium/sculpt

/**
 * @fileoverview A transform stream that splits streams into chunks of the
 * required sizes in bytes.
 * Buffer splitting is based on https://github.com/substack/rolling-hash.
 */

var Transform = require('stream').Transform

var inherit = require('inherit')


/**
 * Create a Mapper stream that splits incoming data into  chunks of the required
 * sizes. _length is always calculated as Buffers, output is always Buffer objects.
 * @param {Number} _length
 * @return {Mapper}
 */
function ByteLengths(lengths)
{
  if(!(this instanceof ByteLengths)) return new ByteLengths(lengths)

  ByteLengths.super_.call(this, {readableObjectMode: true})

  var cache = []
  var cachedBytes = 0

  var _length
  var _lengths = []


  function flushCache()
  {
    var result = new Buffer(cache)
    cache = []
    cachedBytes = 0

    return result
  }


  this.pushLength = function(length)
  {
    if(!(length instanceof Array)) length = [length]

    _lengths = _lengths.concat(length.filter(function(item){return item}))

    if(!_length) _length = _lengths.shift()
  }
  this.pushLength(lengths)


  this._transform = function(chunk, encoding, callback)
  {
    if(!_length) return callback('Not waiting for data')

    // Make sure we're always dealing with Buffers
    if(encoding !== 'buffer') chunk = new Buffer(chunk)

    cache.push(chunk)
    cachedBytes += chunk.length

    // Check to see if we have enough data to push out to consumers
    if(cachedBytes < _length) return callback()

    // Create a Buffer with all the cached data
    var result = flushCache()

    // Cache any leftover data
    var extraBytes = result.length % _length
    if(extraBytes)
    {
      var length = result.length - extraBytes

      cache.push(result.slice(length))
      cachedBytes += extraBytes

      result = result.slice(0, length)
    }

    // Emit _length splitted data
    this.push(result)

    // Move to the next _length
    _length = _lengths.shift()
    if(!_length) this.push(null)

    // We are done with this data chunk
    callback()
  }

  this._flush = function(callback)
  {
    if(cache.length) this.push(flushCache())

    if(_length && _length !== Math.Infinity) return callback('Waiting for data')

    callback()
  }
}
inherit(ByteLengths, Transform)


module.exports = ByteLengths
