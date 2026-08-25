import angular from "angular";

angular.module('rad.common', []);

angular.module('rad.menu', []);
angular.module('templates', []);

angular.module('rad.ui.directives', []);
angular.module('rad.stat', ['rad.ui.directives', 'ui.bootstrap', 'rad.common']);
angular.module('rad.dashboard', []);
angular.module('rad.favorites', []);
angular.module('rad.account', []);


/*
import menu from './menu/module.js'*/
