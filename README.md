<h1>
    <span style="float: left;">davup</span>
    <a style="float: right;" href="https://nodei.co/npm/davup/">
        <img src="https://nodei.co/npm/davup.png?downloads=true&downloadRank=true&stars=true"
             alt="NPM"
             data-canonical-src="https://nodei.co/npm/davup.png?downloads=true&downloadRank=true&stars=true"
             style="max-width:100%;">
    </a>
</h1>

> Watches a local directory ( via [chokidar](https://github.com/paulmillr/chokidar) ) and uploads changes using webdav ( ala [cyberduck cli](https://trac.cyberduck.io/wiki/help/en/howto/cli) ) to a remote directory

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
Here is an example of a gulpfile ( in Coffeescript ) using davup.

This example also uses [run-sequence](https://github.com/OverZealous/run-sequence) which is quite handy for waiting until the davup promise is resolved before continuing with your build process.

Apparently gulp 4.0 will support synchronous blocking tasks without the need for awesomeness like run-sequence.

NOTE : Without some sort of blocking help such as run-sequence the input via terminal looks pretty funky in a gulp environment - but does work.

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
## Next Planned Features

* Detect missing external dependency 'cyberduck cli' a.k.a. 'duck' and fail gracefully with information
* Add facility to flag saving the password in config.dat - currently hand editing is the only mechanism


## Possible Future Features

* Replace cyberduck with suitable node-friendly option - not *totally* sure this would be worth the effort - interesting in hearing opinions
* Demandware specific feature : ability to flatten cartridges if they are nested locally - again, only if there is enough interest
