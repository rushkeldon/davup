'use strict';

// constants
var CN = 'davup';
var CONFIG_FILE_PATH = __dirname + "/config.dat";
var DOT = "\u2022";
var UTF8 = 'utf8';


var chalk = require( 'chalk' );
var chokidar = require( 'chokidar' );
var fs = require( 'fs' );
var inquirer = require( 'inquirer' );
var childProcess = require( 'child_process' );
var pkgData = require( './package.json' );
var q = require( 'q' );
var deferred = null;
var hasPromiseBeenResolved = false;

var childProcesses = [];
var watcher;
var duck;

// objects
var configData = {};
var newConfigDataFromArgs = {};

// booleans
var configFileAlreadyHadPassword = false;
var isCleaningUp = false;
var shouldResetConfig = false;

// numbers & strings
var fileEventToggle = 0;
var password;

var exitTypes = {
	EXIT : "exit",
	SIGINT : "SIGINT",
	UNCAUGHT_EXCEPTION : "uncaughtException"
};

var stdEvents = {
	DATA : "data"
}

var chokidarEvents = {
	READY : "ready",
	ALL : "all"
}

var fsEvents = {
	add : "add",
	addDir : "addDir",
	change : "change",
	error : "error",
	raw : "raw",
	ready : "ready",
	unlink : "unlink",
	unlinkDir : "unlinkDir"
};

var flags = {
	h : '-h',
	help : '-help',
	l : '-l',
	local : '-local',
	p : '-p',
	pass : '-pass',
	r : '-r',
	remote : '-remote',
	R : '-R',
	reset : '-reset',
	u : '-u',
	user : '-user',
	v : '-v',
	version : '-version'
};

// init kicks things off
function init( argsArray ) {
	// console.log( CN + ".init" );

	deferred = q.defer();

	// processArgs sets shouldResetConfig
	processArgs( argsArray );

	addEventListeners();

	if( shouldResetConfig ) {
		resetConfigData();
		getConfigDataFromUser();
	} else {
		try {
			if( fs.lstatSync( CONFIG_FILE_PATH ).isFile() ) {
				readConfigFile();
			} else {
				getConfigDataFromUser();
			}
		}
		catch( error ) {
			// we don't send the error to the console because this likely means the file doesn't exist
			getConfigDataFromUser();
		}
	}

	return deferred.promise;
}

function resolvePromise(){
	if( deferred ){
		deferred.resolve( configData );
	}
	hasPromiseBeenResolved = true;
}

function rejectPromise(){
	if( deferred ){
		deferred.reject( new Error( CN + " has exited without fulfilling it's promise.  Quite disappointing." ) );
	}
}

function processArgs( args ){
	// console.log( CN + ".processArgs" );

	var shouldProcessAsArray = false;

	switch( true ){
		case ( trueTypeOf( args ) === 'array' ) :
			// noop - drop on through
			shouldProcessAsArray = true;
			break;
		case ( !args && trueTypeOf( process.argv ) === 'array' ) :
			// must have been run from cli?
			shouldProcessAsArray = true;
			args = process.argv;
			break;
		case ( trueTypeOf( args ) === 'object' && Object.keys( args ).length ) :
			newConfigDataFromArgs = args;
			break;
		default :
			// nothing to process
			return;
			break;
	}

	var i, arg;

	if( shouldProcessAsArray ){
		for( i=0; i<args.length; i++ ){
			arg = args[ i ];
			switch( arg ){
				case flags.reset :
				case flags.R :
					shouldResetConfig = true;
					break;
				case flags.user :
				case flags.u :
					newConfigDataFromArgs.username = args[ ++i ];
					break;
				case flags.pass :
				case flags.p :
					password = args[ ++i ];
					newConfigDataFromArgs.password = password;
					break;
				case flags.local :
				case flags.l :
					newConfigDataFromArgs.localDir = args[ ++i ];
					break;
				case flags.remote :
				case flags.r :
					newConfigDataFromArgs.remoteDir = "davs://" + args[ ++i ];
					break;
				case flags.help :
				case flags.h :
					displayHelp();
					return;
					break;
				case flags.version :
				case flags.v :
					displayVersion();
					return;
					break;
			}
		}
	} else {
		// normalize data a bit
		if( newConfigDataFromArgs.hasOwnProperty( 'password' ) ){
			password = newConfigDataFromArgs.password;
		}

		if( newConfigDataFromArgs.hasOwnProperty( 'remoteDir' ) ){
			newConfigDataFromArgs.remoteDir = "davs://" + newConfigDataFromArgs.remoteDir;
		}

		if( newConfigDataFromArgs.hasOwnProperty( 'shouldResetConfig' ) ){
			shouldResetConfig = true;
			delete newConfigDataFromArgs.shouldResetConfig;
		}

	}

	if( Object.keys( newConfigDataFromArgs ).length ){
		console.log( chalk.yellow( 'we have newConfigDataFromArgs :' ) );
		console.log( chalk.magenta( JSON.stringify( newConfigDataFromArgs, null, 2 ) ) );
	} else {
		// console.log( 'there are no newConfigDataFromArgs' );
	}
}

function displayVersion(){
	console.log( chalk.yellow( '  ' + CN + ' ' + pkg.version ) );
	process.exit( 0 );
}

function displayHelp(){
	// console.log( CN + ".displayHelp" );

	var tab = '         ';
	var indent = '\n' + tab;
	var msg = 'Usage :\n  ' + CN + ' [ options... ]\n\nOptions :\n';
	function m( flagShort, flagLong, dataType, blurb ){
		msg += '  ' + flagShort + ', ' + flagLong + ' ' + chalk.green.bold( dataType ) + indent + blurb + '\n';
	}
	m( flags.h, flags.help, '', 'Displays this help then exits.' );
	m( flags.v, flags.version, '', 'Displays installed ' + CN + ' version then exits.' );
	m( flags.R, flags.reset, '', 'Deletes stored config data and prompts for any data' + indent + 'not supplied by options.' );
	m( flags.u, flags.user, '<username>', 'Sets the username for webdav authentication.' + indent + 'Saved in config file.' );
	m( flags.p, flags.pass, '<password>', 'Sets the password for the session.' + indent + 'NOT saved in the config file.' );
	m( flags.l, flags.local, '<localDir>', 'Sets the local directory to watch' + indent + chalk.red( 'NOTE : include trailing forward slash!' ) + indent + 'Saved in the config file.' );
	m( flags.r, flags.remote, '<remoteDir>',
		'Sets the remote webdav directory that ALL changes in ' + indent + chalk.green.bold( '<localDir>' ) + ' will be uploaded to.' + indent +
		chalk.red( 'NOTE : include trailing forward slash!' + indent ) +
		'Saved in the config file.' + indent +
		chalk.red( 'NOTE : Demandware users - there is no automatic' + indent + 'flattening of cartridges.' + indent + chalk.red.bold( 'Nested cartridges BAD!!' ) ) );

	console.log( chalk.yellow( msg ) );
	process.exit( 0 );
}

function addEventListeners() {
	// console.log( CN + ".addEventListeners" );

	process.once( exitTypes.EXIT, cleanup.bind( this, exitTypes.EXIT ) );
	process.once( exitTypes.SIGINT, cleanup.bind( this, exitTypes.SIGINT ) );
	process.once( exitTypes.UNCAUGHT_EXCEPTION, cleanup.bind( this, exitTypes.UNCAUGHT_EXCEPTION ) );
}

function cleanup( exitType ) {
	// console.log( CN + ".cleanup" );

	var prefix = exitType === exitTypes.SIGINT ? "\n" : "";

	if( !isCleaningUp ) {
		isCleaningUp = true;
		if( watcher ) {
			watcher.removeListener( chokidarEvents.READY, watcherReady );
			watcher.removeListener( chokidarEvents.ALL, fileEventReceived );
			watcher.unwatch( configData.localDir );
			watcher.close();
		}

		if( duck ) {
			duck.removeAllListeners( exitTypes.EXIT );
			if( duck.stdout ) {
				duck.stdout.removeAllListeners( stdEvents.DATA );
			}
			if( duck.stderr ) {
				duck.stderr.removeAllListeners( stdEvents.DATA );
			}
		}

		if( childProcesses && childProcesses.length ){
			childProcesses.forEach( function killChildProcess( childProcess ) {
				if( childProcess && childProcess.kill ){
					childProcess.kill();
				}
			} );
		}
	}

	if( !hasPromiseBeenResolved ){
		rejectPromise();
	}
}

function resetConfigData(){
	// console.log( CN + ".resetConfigData" );

	configData = {};
	shouldResetConfig = false;
}

function readConfigFile() {
	// console.log( CN + ".readConfigFile" );

	configData = {};

	try {
		configData = JSON.parse( fs.readFileSync( CONFIG_FILE_PATH, UTF8 ) );
	} catch( error ) {
		// console.log( error.toString() );
		configData = {};
		getConfigDataFromUser();
		return;
	}

	if( configData ){
		// console.log( CN + ".configFileHasBeenRead" );

		// was password already saved in config file?
		configFileAlreadyHadPassword = configData.hasOwnProperty( 'password' ) && !!configData.password;
		// console.log( "\tconfigFileAlreadyHadPassword :", configFileAlreadyHadPassword );

		transferConfigData( newConfigDataFromArgs );

		if( testConfigData() ) {
			startWatching();
		} else {
			getConfigDataFromUser();
		}
	}
}

function writeConfigFile(){
	// console.log( CN + ".writeConfigFile" );

	if( !configFileAlreadyHadPassword ){
		password = password ? password : configData.password;
		delete configData.password;
	}

	try{
		fs.writeFileSync( CONFIG_FILE_PATH, JSON.stringify( configData, null, 2 ), UTF8 );
	} catch( error ){
		console.log( chalk.red.bold( 'ERROR : attempting to write config file.' ) );
		console.log( chalk.red.bold( error.toString() ) );
		process.exit( 1 );
		return;
	}

	// console.log( chalk.green( CN + "file written successfully :\n  " + chalk.green.bold( CONFIG_FILE_PATH ) ) );
	readConfigFile();
}

function transferConfigData( transferData, isWritePending ){
	// console.log( CN + ".transferConfigData" );

	isWritePending = !!isWritePending;

	// always transfer password to configData if we have it
	if( password ){
		configData.password = password;
	}

	var doesTransferDataHaveProps = !!transferData && !!Object.keys( transferData ).length;

	if( doesTransferDataHaveProps ){
		// transfer values
		var propName;
		for( propName in transferData ){
			configData[ propName ] = transferData[ propName ];
		}

		// if transferred newConfigDataFromArgs then reset that now (for next entry)
		if( transferData === newConfigDataFromArgs ){
			newConfigDataFromArgs = {};
		}

		if( !isWritePending ){
			writeConfigFile();
		}
	}
}

function testConfigData() {
	var success = false;
	switch( true ) {
		case !configData : break;
		case !configData.username : break;
		case !configData.password : break;
		case !configData.localDir : break;
		case !configData.remoteDir : break;
		default :
			success = true;
	}
	return success;
}

function getConfigDataFromUser() {
	transferConfigData( newConfigDataFromArgs, true );

	var questionName;
	var questionsToAsk = [];
	var allQuestions = {
		username : {
			type : "input",
			name : "username",
			message : "webdav username :"
		},
		password : {
			type : "password",
			name : "password",
			message : "webdav password :"
		},
		localDir : {
			type : "input",
			name : "localDir",
			message : "absolute path to the local directory to watch\n   " + chalk.green( "NOTE : include trailing forward slash!" ) + "\n   localDir :"
		},
		remoteDir : {
			type : "input",
			name : "remoteDir",
			message : "path to remote webdav directory\n   " + chalk.green( "NOTE : include trailing forward slash!" ) + chalk.yellow( "\n   Example :\n    dev04-store-sees.demandware.net/on/demandware.servlet/webdav/Sites/Cartridges/version7/" ) + "\n   remoteDir :"
		}
	};

	for( questionName in allQuestions ) {
		if( configData.hasOwnProperty( questionName ) && configData[ questionName ] ) {
			// noop - we already have the answer to the question
		} else {
			// add this question to questionsToAsk
			questionsToAsk.push( allQuestions[ questionName ] );
		}
	}

	inquirer.prompt( questionsToAsk, function answersReceived( answers ) {
		// normalize remoteDir
		// TODO : we may want to check for trailing slash and pre-existing 'davs://'
		if( answers.hasOwnProperty( 'remoteDir' ) && answers.remoteDir ) {
			answers.remoteDir = "davs://" + answers.remoteDir;
		}
		// transfer any answers to configData
		transferConfigData( answers );
	} );
}

function startWatching() {
	var optionsWatch = {
		awaitWriteFinish : {
			stabilityThreshold : 200,
			pollInterval : 50
		},
		ignored : /[\/\\]\./,
		persistent : true
	};
	watcher = chokidar.watch( configData.localDir, optionsWatch );
	watcher.on( 'ready', watcherReady );
}

function watcherReady() {
	console.log( chalk.green( CN + " is watching for changes in localDir :\n  " + configData.localDir ) );
	console.log( chalk.green( "changes will be uploaded / synced to remoteDir :\n  " + configData.remoteDir ) );
	console.log( chalk.green( "username :\n  " + configData.username ) );
	watcher.on( 'all', fileEventReceived );

	resolvePromise();
}

function trace( msg, toggle ) {
	if( toggle ) {
		console.log( chalk.magenta( msg ) );
	} else {
		console.log( chalk.cyan( msg ) );
	}
}

function fileEventReceived( eventType, filePath, stats ) {
	// console.log( CN + ".fileEventReceived" );

	var traceToggle = fileEventToggle;
	fileEventToggle = fileEventToggle ? 0 : 1;

	var actionMsgs = {
		noop : '-taking no action-',
		uploading : 'starting upload',
		deleting : 'deleting'
	};
	var eventMsg = "\n";
	var actionMsg = actionMsgs.noop;

	switch( eventType ) {
		case fsEvents.add :
			eventMsg += "file added";
			actionMsg = actionMsgs.uploading;
			break;
		case fsEvents.addDir :
			eventMsg += "directory added";
			break;
		case fsEvents.change :
			eventMsg += "file changed";
			actionMsg = actionMsgs.uploading;
			break;
		case fsEvents.error :
			eventMsg += "error encountered";
			actionMsg = actionMsgs.noop;
			break;
		case fsEvents.raw :
			eventMsg += "raw event";
			actionMsg = actionMsgs.noop;
			break;
		case fsEvents.ready :
			eventMsg += "watcher is ready (again?!?)";
			actionMsg = actionMsgs.noop;
			break;
		case fsEvents.unlink :
			eventMsg += "file removed";
			actionMsg = actionMsgs.deleting;
			break;
		case fsEvents.unlinkDir :
			eventMsg += "directory removed";
			actionMsg = actionMsgs.deleting;
			break;
		default :
			console.log( chalk.red.bold( "\nALERT : an unknown eventType was encountered : " + eventType + ":" ) );
			break;
	}

	var relativePath = filePath.split( configData.localDir )[ 1 ];
	var remotePath = configData.remoteDir + relativePath;
	var simpleName = relativePath.split( "/" ).pop();

	eventMsg += " " + DOT + " " + actionMsg + " " + DOT + " " + timestamp() + "\n  " + relativePath;
	actionMsg += simpleName;
	trace( eventMsg, traceToggle );

	switch( eventType ) {
		case fsEvents.add :
		case fsEvents.addDir :
		case fsEvents.change :
		case fsEvents.unlink :
		case fsEvents.unlinkDir :
			// trace( actionMsg, traceToggle );
			webDav( filePath, remotePath, simpleName, eventType, traceToggle );
			break;
		default :
		// noop
	}
}

function webDav( localPath, remotePath, simpleName, eventType, traceToggle ) {

	// different arguments to send to duck keyed on fsEvent
	var duckActions = {
		add : '--upload',
		addDir : '--upload',
		change : '--upload',
		error : '',
		raw : '',
		ready : '',
		unlink : '--delete',
		unlinkDir : '--delete'
	};

	var duckAction = duckActions[ eventType ];

	// if we aren't going to take an action then nevermind
	if( !duckAction ) { return; }

	// all arguments to pass to duck via spawn
	var options = [
		'-v',
		'--username',
		configData.username,
		'--password',
		configData.password,
		duckAction,
		remotePath,
		localPath,
		"-existing",
		"overwrite"
	];

	var duckMsgs = {
		BAD_CREDS : "401 Unauthorized"
	};

	var spawn = childProcess.spawn;
	childProcesses.push( spawn );
	var duckLastStdOut;
	// var duckLastStdErr;
	var mainProcess = process;
	duck = spawn( 'duck', options );

	function stdOutReceived( data ) {
		duckLastStdOut = data.toString();
		switch( true ){
			case ( !duckLastStdOut ) :
				return;
				break;
			case ( duckLastStdOut.indexOf( duckMsgs.BAD_CREDS ) != -1 ) :
				console.log( chalk.red.bold( '  Authentication failed - check your username and password.' ) );
				if( spawn && spawn.kill ){
					spawn.kill();
				}
				if( mainProcess && mainProcess.exit ){
					mainProcess.exit( 1 );
				}
				return;
				break;
		}
	}
	/*
	 function stdErrReceived( data ){
	 duckLastStdErr = data.toString();
	 }
	 */
	duck.stdout.on( stdEvents.DATA, stdOutReceived );
	// duck.stderr.on( stdEvents.DATA, stdErrReceived );

	var successMsg = duckAction == '--upload' ? "  uploaded " + DOT + " " : "  deleted " + DOT + " " ;
	duck.on( 'exit', function processExited( exitCode ) {
		if( exitCode === 0 ) {
			trace( successMsg + timestamp() + " " + DOT + " " + simpleName, traceToggle );
		} else {
			console.log( chalk.red.bold( 'ERROR : upload failed for : ' + simpleName  ) );
			console.log( chalk.red.bold( '  Check your config file ( the version in your remoteDir? Both dirs have trailing slashes? ) :\n  ' + CONFIG_FILE_PATH ) );
		}
	} );
}

function trueTypeOf(o) {
	return (({}).toString.call(o).match(/\s([a-zA-Z]+)/)[1].toLowerCase());
};

function timestamp( isDateRequested ) {
	var stamp = "";
	var now = new Date();
	var date = [ now.getMonth() + 1, now.getDate(), now.getFullYear() ];
	var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];
	var suffix = ( time[ 0 ] < 12 ) ? "AM" : "PM";
	time[ 0 ] = ( time[ 0 ] < 12 ) ? time[ 0 ] : time[ 0 ] - 12;
	time[ 0 ] = time[ 0 ] ? time[ 0 ] : 12;
	for( var i = 1; i < 3; i++ ) {
		if( time[ i ] < 10 ) {
			time[ i ] = "0" + time[ i ];
		}
	}
	if( isDateRequested ){
		stamp = date.join( "/" ) + " " + time.join( ":" ) + " " + suffix;
	} else {
		stamp = time.join( ":" ) + " " + suffix;
	}
	return stamp;
}

function stop(){
	process.exit( 0 );
}

module.exports = {
	start : init,
	help : displayHelp,
	ver : displayVersion,
	stop : stop
};
