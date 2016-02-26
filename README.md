# davup

> Watches a local directory ( via [chokidar](https://github.com/paulmillr/chokidar) )and uploads changes via webdav ( ala [cyberduck cli](https://trac.cyberduck.io/wiki/help/en/howto/cli) )to a remote directory

[![NPM](https://nodei.co/npm-dl/davup.png)](https://nodei.co/npm/davup/)
[![NPM](https://nodei.co/npm/davup.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/davup/)


## Why?

* Tired of running Eclipse just so that Demandware cartridge changes would be uploaded via webdav
* Wanted to integrate webdav upload into projects' gulp tasks

## How?



## Getting started

#### External Dependencies

* You must [install the cyberduck cli app from here](https://trac.cyberduck.io/wiki/help/en/howto/cli)
* There are different installers for Mac, Windows & Linux - not via NPM
* Currently davup has only been tested on Mac - [please report any issues](https://github.com/rushkeldon/davup/issues)

#### Install with npm :

    npm install davup --save

#### Then `require` and use it in your code :

```javascript
var davup = require( 'davup' );

var options = {
 "username": "devgod",
 "localDir": "/full/local/path/to/dir/to/watch/",
 "remoteDir": "domain.com/full/path/to/dir/upload/to/",
 "password": "secretwerd"
};

var davupPromise = davup.start( options )
    .then(
        function davupStarted( configData ) {
            // success code here
        },
        function davupFailed( err ) {
            console.log( err.toString() );
            // failure code here
    } );

davup.stop();
```
