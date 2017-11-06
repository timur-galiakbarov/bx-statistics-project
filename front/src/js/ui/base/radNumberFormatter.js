angular.module('rad.ui.directives').filter('radNumberFormatter', function () {
    return function (val, withNbsp) {
        //console.log(val);
        if (!val && val != 0) {
            return "";
        }
        if (isNaN(val)) {
            return val;
        }

        var symbol = ' ';
        if (withNbsp) symbol = '&nbsp;';

        var pointPosition = val.toString().indexOf(".");
        var fractLength = val.toString().length - (pointPosition >= 0 ? pointPosition + 1 : val.toString().length);
        var fractional = parseFloat(val);
        fractional = fractional - Math.floor(fractional);
        fractional = fractional.toFixed(fractLength).toString().substring(1);

        return Math.floor(parseFloat(val)).toString().replace(/./g, function (c, i, a) {
                return i && c !== "." && ((a.length - i) % 3 === 0) ? symbol + c : c;
            }).toString() + fractional;

    };
});