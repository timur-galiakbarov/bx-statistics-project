angular.module('app').config(['$stateProvider', '$urlRouterProvider',
    function ($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise("/");
        //$urlRouterProvider.when('page-detail', '/contacts/:pageCode');
        $stateProvider
            .state('index', {
                url: '/',
                templateUrl: './templates/template/app/template.html',
                controller: 'appController'
            })
            //Раздел "Главная"
            .state('index.dashboard', {
                url: 'dashboard/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/dashboard/controllers/dashboardController.html',
                        controller: 'dashboardController'
                    }
                },
                parent: 'index'
            })
            //Раздел "Магазин"
            .state('index.shop', {
                url: 'shop/',
                views: {
                    'content': {
                        url: 'shop/',
                        templateUrl: './templates/js/ui/shop/controllers/shopController.html',
                        controller: 'shopController'
                    }
                },
                parent: 'index'
            })
            //Раздел "Заказы"
            .state('index.orders', {
                url: 'orders/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/orders/controllers/ordersController.html',
                        controller: 'ordersController'
                    }
                },
                parent: 'index'
            })
            //Раздел "Настройки"
            .state('index.settings', {
                url: 'settings/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/settings/controllers/settingsController.html',
                        controller: 'settingsController'
                    }
                },
                parent: 'index'
            });

        //$locationProvider.html5Mode(true);
    }]);