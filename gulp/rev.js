var gulp = require('gulp');
var browserSync = require("browser-sync");
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var reload = browserSync.reload;
var runSequence = require('gulp-run-sequence');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var ftp = require('gulp-ftp');
var buffer = require('gulp-buffer');
var revAll = require('gulp-rev-all');

var config = require('./config.js');
var path = require('./path.js');
var fs = require('fs');
var rimraf = require('rimraf');

var revdel = require('gulp-rev-delete-original');

gulp.task('rev', function (done) {
    return runSequence(
        'rev:js',
        'rev:css',
        done);
});

gulp.task('rev:js', function () {
    return gulp.src(path.build.js + "**/*")
        .pipe(revAll.revision())
        .pipe(revdel())
        .pipe(gulp.dest(path.build.js));
});

gulp.task('rev:css', function () {
    return gulp.src(path.build.css + "**/*")
        .pipe(revAll.revision())
        .pipe(revdel())
        .pipe(gulp.dest(path.build.css));
});