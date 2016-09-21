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
            /*//Раздел "Статистика"
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
             })*/
            //Общая статистика
            .state('index.stat', {
                url: 'stat/?getStatFromGroup',
                views: {
                    'content': {
                        url: 'stat',
                        templateUrl: './templates/js/ui/stat/controllers/statMainController/statMainController.html',
                        controller: 'statMainController'
                    }
                },
                parent: 'index'
            })
            //Анализ публикаций
            .state('index.publishAnalysis', {
                url: 'publishAnalysis/?getStatFromGroup',
                views: {
                    'content': {
                        url: 'publishAnalysis/',
                        templateUrl: './templates/js/ui/stat/controllers/statPublishAnalysisController/statPublishAnalysisController.html',
                        controller: 'statPublishAnalysisController'
                    }
                },
                parent: 'index'
            })
            //Раздел "Мои записи"
            .state('index.publishFavorites', {
                url: 'publishAnalysis/favorites',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/favorites/controllers/favoritesController/favoritesController.html',
                        controller: 'favoritesController'
                    }
                },
                parent: 'index'
            })
            //Сравнение аудиторий
            .state('index.auditoryCompare', {
                url: 'auditoryCompare/',
                views: {
                    'content': {
                        url: 'auditoryCompare',
                        templateUrl: './templates/js/ui/stat/controllers/statAuditoryCompareController/statAuditoryCompareController.html',
                        controller: 'statAuditoryCompareController'
                    }
                },
                parent: 'index'
            })
            //Поиск мертвых участников
            .state('index.findBots', {
                url: 'findBots/',
                views: {
                    'content': {
                        url: 'findBots',
                        templateUrl: './templates/js/ui/stat/controllers/findBotsController/findBotsController.html',
                        controller: 'findBotsController'
                    }
                },
                parent: 'index'
            })
            .state('index.groupsAnalog', {
                url: 'groupsAnalog/',
                views: {
                    'content': {
                        url: 'groupsAnalog',
                        templateUrl: './templates/js/ui/stat/controllers/groupsAnalogController/groupsAnalogController.html',
                        controller: 'groupsAnalogController'
                    }
                },
                parent: 'index'
            })
            //----------------------------------------------------------------------------------------------------------
            //Админка
            .state('index.admin', {
                url: 'admin/',
                views: {
                    'content': {
                        url: 'admin',
                        templateUrl: './templates/js/ui/admin/controllers/adminController.html',
                        controller: 'adminController'
                    }
                },
                parent: 'index'
            })
            .state('index.admin.vksync', {
                url: 'vksync/',
                views: {
                    'admin': {
                        url: 'vksync',
                        templateUrl: './templates/js/ui/admin/controllers/vksyncController/vksyncController.html',
                        controller: 'vksyncController'
                    }
                },
                parent: 'index.admin'
            })
            .state('index.admin.dashboard', {
                url: 'dashboard/',
                views: {
                    'admin': {
                        url: 'dashboard',
                        templateUrl: './templates/js/ui/admin/controllers/adminDashboardController/adminDashboardController.html',
                        controller: 'adminDashboardController'
                    }
                },
                parent: 'index.admin'
            });

        //$locationProvider.html5Mode(true);
    }]);