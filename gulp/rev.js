var gulp = require('gulp');
var revAll = require('gulp-rev-all');
var revdel = require('gulp-rev-delete-original');

var path = require('./path.js');


gulp.task('rev:html', function () {
	return gulp.src(path.build.html + "**/*")
		.pipe(revAll.revision({ hashLength: 6 }))
		.pipe(revdel())
		.pipe(gulp.dest(path.build.html));
});

gulp.task('rev:js', function () {
	return gulp.src(path.build.js + "**/*")
		.pipe(revAll.revision({ hashLength: 3 }))
		.pipe(revdel())
		.pipe(gulp.dest(path.build.js));
});

gulp.task('rev:commonjs', function () {
	return gulp.src(path.build.commonjs + "**/*")
		.pipe(revAll.revision({ hashLength: 5 }))
		.pipe(revdel())
		.pipe(gulp.dest(path.build.commonjs));
});

gulp.task('rev:css', function () {
	return gulp.src(path.build.css + "**/*")
		.pipe(revAll.revision({ hashLength: 3 }))
		.pipe(revdel())
		.pipe(gulp.dest(path.build.css));
});

gulp.task('rev', gulp.series(
	'rev:js',
	'rev:commonjs',
	'rev:css',
	//'rev:html'
	)
);
