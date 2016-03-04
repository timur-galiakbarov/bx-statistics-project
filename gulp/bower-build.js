var gulp = require('gulp');
var rigger = require('rigger');
var browserSync = require("browser-sync");
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var reload = browserSync.reload;
var runSequence = require('gulp-run-sequence');
var requireDir = require('require-dir')();

var path = require('./path.js');
/**
 * Перенос зависимостей bower_components
 */
gulp.task('bower_components', function () {
    return gulp.src(path.src.bower)
        .pipe(gulp.dest(path.build.bower));
});

/*gulp.task('bower:js', function () {
 var vendors = mainBowerFiles();
 return gulp.src(vendors)
 .pipe(filter('**.js'))
 //.pipe(order(vendors))
 .pipe(concat('vendor.js'))
 .pipe(gulp.dest(path.build.bower));
 });

 gulp.task('bower:css', function () {
 var vendors = mainBowerFiles();
 return gulp.src(vendors, {
 "overrides": {
 "bootstrap": {
 "main": [
 "./dist/css/bootstrap.min.css",
 "./dist/css/bootstrap-theme.min.css"
 ]
 },
 "font-awesome": {
 "main": [
 "./css/font-awesome.min.css",
 ]
 }
 }})
 .pipe(concat('bootstrap.css'))
 .pipe(gulp.dest(path.build.bower))
 });

 gulp.task('bower', ['bower:js', 'bower:css']);

 */