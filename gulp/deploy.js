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
var gutil = require('gulp-util');

var config = require('./config.js');
var path = require('./path.js');

gulp.task('ftpFront:deploy', function () {

    return gulp.src('./lk/**/*')
        .pipe(ftp({
            host: '77.222.56.183',
            user: 'usatuhelru_timur',
            pass: 'XSW@zaq1',
            remotePath: '/socstat/public_html/lk/'
        }))
        .pipe(gutil.noop());
});

gulp.task('ftpControllers:deploy', function () {

    return gulp.src('./controllers/**/*')
        .pipe(ftp({
            host: '77.222.56.183',
            user: 'usatuhelru_timur',
            pass: 'XSW@zaq1',
            remotePath: '/socstat/public_html/controllers/'
        }))
        .pipe(gutil.noop());
});