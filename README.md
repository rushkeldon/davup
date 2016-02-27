# davup

> Watches a local directory ( via [chokidar](https://github.com/paulmillr/chokidar) ) and uploads changes using webdav ( ala [cyberduck cli](https://trac.cyberduck.io/wiki/help/en/howto/cli) ) to a remote directory

[![NPM](https://nodei.co/npm-dl/davup.png)](https://nodei.co/npm/davup/)
[![NPM](https://nodei.co/npm/davup.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/davup/)


## Why?

* Tired of running Eclipse just so that Demandware cartridge changes would be uploaded via webdav
* Wanted to integrate webdav upload into projects' gulp tasks

## Getting started

#### External Dependencies

* You must [install the cyberduck cli app from here](https://trac.cyberduck.io/wiki/help/en/howto/cli)
* There are different installers for Mac, Windows & Linux - not via NPM
* Currently davup has only been tested on Mac - [please report any issues](https://github.com/rushkeldon/davup/issues)

#### Install with npm :

    npm install davup --save

#### Then `require` and use it in your code :

```javascript
    // example of an options object you can (optionally) pass to davup.start
    var options = {
     "username": "devgod",
     "localDir": "/full/local/path/to/dir/to/watch/",
     "remoteDir": "domain.com/full/path/to/dir/upload/to/",
     "password": "secretwerd"
    };

```
Here is an example of a gulpfile ( in Coffeescript ) using davup

```coffeescript
g = require 'gulp'
davup = require 'davup'
runSequence = require 'run-sequence'

g.task 'startdav', ->
    # you can pass an options argument to start to create or overwrite the config.dat file
    # otherwise you will be prompted for config data
    return davup.start()

g.task 'build-all', ( callback ) ->
    runSequence 'stylus', 'coffee-modules', 'coffee-services', callback

g.task 'default', ( callback ) ->
    runSequence 'startdav', 'build-all', 'watch', callback

```
