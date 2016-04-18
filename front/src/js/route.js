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
            //Раздел "Статистика"
            .state('index.stat', {
                url: 'stat/',
                views: {
                    'content': {
                        url: 'stat/',
                        templateUrl: './templates/js/ui/stat/controllers/statController.html',
                        controller: 'statController'
                    }
                },
                parent: 'index'
            })
            //Общая статистика
            .state('index.stat.main', {
                url: 'main/',
                views: {
                    'stat': {
                        url: 'stat/main',
                        templateUrl: './templates/js/ui/stat/controllers/statMainController/statMainController.html',
                        controller: 'statMainController'
                    }
                },
                parent: 'index.stat'
            })
            //Анализ публикаций
            .state('index.stat.publishAnalisys', {
                url: 'publishAnalisys/',
                views: {
                    'stat': {
                        url: 'stat/publishAnalisys',
                        templateUrl: './templates/js/ui/stat/controllers/statPublishAnalisysController/statPublishAnalisysController.html',
                        controller: 'statPublishAnalisysController'
                    }
                },
                parent: 'index.stat'
            })
            //Сравнение аудиторий
            .state('index.stat.auditoryCompare', {
                url: 'auditoryCompare/',
                views: {
                    'stat': {
                        url: 'stat/auditoryCompare',
                        templateUrl: './templates/js/ui/stat/controllers/statAuditoryCompareController/statAuditoryCompareController.html',
                        controller: 'statAuditoryCompareController'
                    }
                },
                parent: 'index.stat'
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