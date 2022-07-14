'use strict';

var gulp = require('gulp');

require('require-dir')('./gulp/');
var config = require('./gulp/config.js');
var path = require('./gulp/path.js');

/*gulp.task('default', function (done) {//['clean']
    if (config.buildBitrix) {
        path.build = path.bitrix;
        return runSequence('build', 'rev', 'injects', 'watch', done);
    } else {
        return runSequence('build', 'rev', 'injects', 'watch', 'webserver', done);
    }
});*/

const defaultTask = gulp.series('clean', 'build', 'rev', 'injects', 'watch', 'webserver');

exports.default = defaultTask;
