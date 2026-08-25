angular.module('rad.ui.directives').filter('radAmountFilter', function () {
	return function (val) {

		return parseInt(val).toFixed(2).replace(/./g, function(c, i, a) {
			return i && c !== "." && ((a.length - i) % 3 === 0) ? ' ' + c : c;
		});
	};
});