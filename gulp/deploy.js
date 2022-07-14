var gulp = require('gulp');
var browserSync = require("browser-sync");
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var reload = browserSync.reload;
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var ftp = require('gulp-ftp');
var gutil = require('gulp-util');

var config = require('./config.js');
var path = require('./path.js');

var ftpFrontConfig = {
    host: '77.222.56.183',
    user: 'usatuhelru_timur',
    pass: 'XSW@zaq1',
    remotePath: '/socstat/public_html/lk/'
};

var ftpControllersConfig = {
    host: '77.222.56.183',
    user: 'usatuhelru_timur',
    pass: 'XSW@zaq1',
    remotePath: '/socstat/public_html/controllers/'
};

gulp.task('ftpFront:deploy', function () {
        return gulp.series(
            'ftpFront:bowerComponents',
            'ftpFront:lk'
        );
});

gulp.task('ftpControllers:deploy', function () {

    return gulp.src('./controllers/**/*')
        .pipe(ftp(ftpControllersConfig))
        .pipe(gutil.noop());
});

gulp.task('ftpFront:bowerComponents', function () {
    return gulp.src('./lk/bower_components/**/*')
        .pipe(ftp(ftpFrontConfig))
        .pipe(gutil.noop());
});

gulp.task('ftpFront:lk', function () {
    return gulp.src(['./lk/**/*', '!./lk/bower_components/**/*'])
        .pipe(ftp(ftpFrontConfig))
        .pipe(gutil.noop());
});
