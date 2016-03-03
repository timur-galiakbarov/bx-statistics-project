'use strict';

var gulp = require('gulp'),
    runSequence = require('gulp-run-sequence');

require('require-dir')('./gulp/');
var config = require('./gulp/config.js');
var path = require('./gulp/path.js');

gulp.task('default', ['clean'], function (done) {
    if (config.buildBitrix){
        path.build = path.bitrix;
        runSequence('build', 'injects', 'watch', done);
    } else {
        runSequence('build', 'injects', 'watch', 'webserver', done);
    }
});

/*watch = require('gulp-watch'),
 uglify = require('gulp-uglify'),
 rigger = require('gulp-rigger'),
 browserSync = require("browser-sync"),
 sourcemaps = require('gulp-sourcemaps'),
 mainBowerFiles = require('main-bower-files'),
 filter = require('gulp-filter'),
 concat = require('gulp-concat'),
 order = require('gulp-order'),
 babel = require('gulp-babel'),
 browserify = require('browserify'),
 babelify = require('babelify'),
 rimraf = require('rimraf'),
 reload = browserSync.reload,*/