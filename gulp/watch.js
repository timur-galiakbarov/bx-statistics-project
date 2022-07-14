var gulp = require('gulp');
var path = require('./path.js');
var gulp_rimraf = require('gulp-rimraf');
require('./build.js');
require('./inject.js');

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

gulp.task('watch:rebuildJS', gulp.series(
	'js:clear',
	'build_all:js',
	'rev:js',
	'injectJs'
));

gulp.task('watch', function (cb) {
	gulp.watch(path.watch.html, gulp.series(
		'html:clear',
		'html:build',
		'rev:html',
		'injectHtml',
		cb
	));

	gulp.watch([path.watch.css], gulp.series(
		'css:clear',
		'build_all:css',
		'rev:css',
		'injectCss',
		cb
	));

	gulp.watch([path.watch.js, path.watch.tpljs],  gulp.series('watch:rebuildJS'));

	cb();
});
