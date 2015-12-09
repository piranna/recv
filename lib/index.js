var fs = require('fs')

var parseRange = require('range-parser')

var ByteLengths = require('./ByteLengths')


function recv(req, res, next)
{
  var path = req.url

  function doStream(options)
  {
    var stream = fs.createWriteStream(path, options)

    // [ToDo] Save data on intermediary chunk and apply it on end, so changes
    // could be reverted on error
    stream.once('error', function(err)
    {
      this.end()

      next(err)
    });
    stream.once('end', res.end.bind(res));

    req.pipe(stream)
  }

  function put()
  {
    // Use range header to allow partial updates
    var ranges = req.headers.range;
    if(!ranges) return doStream()

    fs.open(path, 'r+', function(err, fd)
    {
      ranges = parseRange(Math.Infinity, ranges)

      var lengths = ranges.map(function(range)
      {
        return range.end - range.start
      })

      req.pipe(ByteLengths(lengths))
      .on('data', function(data)
      {
        fs.writeSync(fd, data, ranges.shift().start)
      })
      .on('end', function()
      {
        // [ToDo] Truncate file when end is not specified (infinite)
//        fs.ftruncateSync(fd, len)

        fs.closeSync(fd)
      })
      .on('error', function(error)
      {
        fs.closeSync(fd)
        next(error)
      })
    })
  }

  return function(error)
  {
    if(error && (error.status || error) !== 405) return next(error)

    switch(req.method)
    {
      case 'DELETE':
        fs.unlink(path, next)
      break

      case 'POST':
        doStream({flags: 'a'})
      break

      case 'PUT':
        put()
      break

      default:
        next(405)
    }
  }
}


module.exports = recv
