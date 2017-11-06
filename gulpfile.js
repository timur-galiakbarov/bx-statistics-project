'use strict';

var gulp = require('gulp'),
    runSequence = require('gulp-run-sequence');

require('require-dir')('./gulp/');
var config = require('./gulp/config.js');
var path = require('./gulp/path.js');

gulp.task('default', ['clean'], function (done) {
    if (config.buildBitrix) {
        path.build = path.bitrix;
        return runSequence('build', 'rev', 'injects', 'watch', done);
    } else {
        return runSequence('build', 'rev', 'injects', 'watch', 'webserver', done);
    }
});

function done() {
    //runSequence('ftpFront:deploy');
}