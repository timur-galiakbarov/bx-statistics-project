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
            //Аналитика - Dashboard
            .state('index.analytics', {
                url: 'analytics/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/analyticsDashboardController.html',
                        controller: 'analyticsDashboardController'
                    }
                },
                parent: 'index'
            })
            //Аналитика
            .state('index.analytics.common', {
                url: 'analytics/group/:gid',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/commonAnalytics/commonAnalyticsController.html',
                        controller: 'commonAnalyticsController'
                    }
                },
                parent: 'index'
            })
            .state('index.account', {
                url: 'account/',
                views: {
                    'content': {
                        url: 'account/',
                        templateUrl: './templates/js/ui/account/controllers/accountController.html',
                        controller: 'accountController'
                    }
                },
                parent: 'index'
            })
            .state('index.partners', {
                url: 'partners/',
                views: {
                    'content': {
                        url: 'partners/',
                        templateUrl: './templates/js/ui/account/controllers/partnersController.html',
                        controller: 'partnersController'
                    }
                },
                parent: 'index'
            })
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
            .state('index.findContent', {
                url: 'findContent/',
                views: {
                    'content': {
                        url: 'findContent/',
                        templateUrl: './templates/js/ui/stat/controllers/findContentController/findContentController.html',
                        controller: 'findContentController'
                    }
                },
                parent: 'index'
            })
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
            .state('index.auditoryCompare', {
                url: 'auditoryCompare/?getStatFromGroup',
                views: {
                    'content': {
                        url: 'auditoryCompare',
                        templateUrl: './templates/js/ui/stat/controllers/statAuditoryCompareController/statAuditoryCompareController.html',
                        controller: 'statAuditoryCompareController'
                    }
                },
                parent: 'index'
            })
            .state('index.findBots', {
                url: 'findBots/?getStatFromGroup',
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
                url: 'groupsAnalog/?getStatFromGroup',
                views: {
                    'content': {
                        url: 'groupsAnalog',
                        templateUrl: './templates/js/ui/stat/controllers/groupsAnalogController/groupsAnalogController.html',
                        controller: 'groupsAnalogController'
                    }
                },
                parent: 'index'
            })
            .state('index.findAdv', {
                url: 'findAdv/?getStatFromGroup',
                views: {
                    'content': {
                        url: 'findAdv',
                        templateUrl: './templates/js/ui/stat/controllers/findAdvPostsController/findAdvPostsController.html',
                        controller: 'findAdvPostsController'
                    }
                },
                parent: 'index'
            })
            .state('index.findActiveUsers', {
                url: 'findActiveUsers/?getStatFromGroup',
                views: {
                    'content': {
                        url: 'findActiveUsers',
                        templateUrl: './templates/js/ui/stat/controllers/findActiveUsersController/findActiveUsersController.html',
                        controller: 'findActiveUsersController'
                    }
                },
                parent: 'index'
            })
            //----------------------------------------------------------------------------------------------------------
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
            .state('index.admin.crm', {
                url: 'crm/',
                views: {
                    'admin': {
                        url: 'crm',
                        templateUrl: './templates/js/ui/admin/controllers/crmController/crmController.html',
                        controller: 'crmController'
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