var fs = require('fs')

var parseRange = require('range-parser')

var ByteLengths = require('./ByteLengths')


function getRangeLength(range)
{
  return range.end - range.start
}


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
      function closeError(error)
      {
        fs.close(fd, next.bind(null, error))
      }

      ranges = parseRange(Math.Infinity, ranges).filter(getRangeLength)

      var byteLengths = ByteLengths(ranges.map(getRangeLength))
      var rangeStart

      req.pipe(byteLengths)
      .on('data', function(data)
      {
        rangeStart = ranges.shift().start

        fs.writeSync(fd, data, rangeStart)
      })
      .on('end', function()
      {
        var truncate = byteLengths.truncate
        if(truncate != null) return fs.close(fd, next)

        fs.ftruncate(fd, rangeStart + truncate, function(error)
        {
          if(error) return closeError(error)

          fs.close(fd, next)
        })
      })
      .on('error', closeError)
    })
  }


  return function(error)
  {
    if(error) return next(error)

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
        next()
    }
  }
}


module.exports = recv
