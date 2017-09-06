var gulp = require('gulp');
var path = require('./path.js');
var watch = require('gulp-watch');
runSequence = require('gulp-run-sequence');


gulp.task('watch', function () {
    watch([path.watch.html], function (event, cb) {
        gulp.start('html:build');
    });
    watch([path.watch.css], function (event, cb) {
        gulp.start('css:build');
    });
    watch([path.watch.js], function (event, cb) {
        gulp.start('js:build');
    });
    watch([path.watch.tpljs], function (event, cb) {
        gulp.start('js:tplbuild');
    });
});