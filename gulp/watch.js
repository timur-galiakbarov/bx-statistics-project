var gulp = require('gulp');
var path = require('./path.js');
var watch = require('gulp-watch');
var runSequence = require('gulp-run-sequence');
var gulp_rimraf = require('gulp-rimraf');
require('./build.js');
require('./inject.js');


gulp.task('watch', function () {
    gulp.watch([path.watch.html], function (event, cb) {
        return runSequence(
            ['html:clear'],
            'html:build',
            'rev:html',
            'injectHtml'
        );
    });
    gulp.watch([path.watch.css], function (event, cb) {
        return runSequence(
            ['css:clear'],
            'build_all:css',
            'rev:css',
            'injectCss'
        );
    });
    gulp.watch([path.watch.js, path.watch.tpljs], function (event, cb) {
        return runSequence(
            ['js:clear'],
            'build_all:js',
            'rev:js',
            'injectJs'
        );
    });
});

gulp.task('css:clear', function (cb) {
    return gulp.src(path.build.css + '**', { read: false })
        .pipe(gulp_rimraf());
});

gulp.task('js:clear', function (cb) {
    return gulp.src(path.build.js + '**', { read: false })
        .pipe(gulp_rimraf());
});

gulp.task('html:clear', function (cb) {
    return gulp.src(path.build.html + '**', { read: false })
        .pipe(gulp_rimraf());
});